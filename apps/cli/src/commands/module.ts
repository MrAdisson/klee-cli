import {
  KeelError,
  MODULES,
  MODULE_IDS,
  OPTIONAL_MODULE_IDS,
  applyScaffoldPlan,
  buildScaffoldPlan,
  findProjectRoot,
  isModuleId,
  readProjectConfig,
  writeProjectConfig,
  type ModuleId,
  type ProjectConfig,
} from '@keel/core';

import { field, heading, info, reportApply, success, warn, write } from '../ui/output.js';

export interface ModuleCommandOptions {
  readonly dryRun?: boolean;
  /** Régénère aussi les fichiers de racine, qui énumèrent les modules retenus. */
  readonly refreshRoot?: boolean;
}

interface ProjectHandle {
  readonly root: string;
  readonly config: ProjectConfig;
}

async function loadProject(): Promise<ProjectHandle> {
  const root = await findProjectRoot(process.cwd());
  if (root === null) {
    throw new KeelError('Aucun projet Keel trouvé depuis le dossier courant.', {
      code: 'PROJECT_NOT_FOUND',
      hint: 'Lancez `klee init` pour en créer un.',
    });
  }
  return { root, config: await readProjectConfig(root) };
}

export async function runModuleList(): Promise<void> {
  const { root, config } = await loadProject();

  heading('Modules');
  field('Projet', `${config.name} (${root})`);
  write();

  for (const id of MODULE_IDS) {
    const definition = MODULES[id];
    const state = config.modules[id] ? 'actif' : 'absent';
    const kind = definition.core ? 'socle' : 'optionnel';
    write(`  ${config.modules[id] ? '●' : '○'} ${id.padEnd(16)} ${state.padEnd(7)} ${kind}`);
  }

  write();
  info('`klee module add <module>` / `klee module remove <module>` pour faire évoluer le projet.');
  write();
}

export async function runModuleAdd(
  moduleName: string,
  options: ModuleCommandOptions,
): Promise<void> {
  const moduleId = parseOptionalModuleId(moduleName);
  const { root, config } = await loadProject();

  if (config.modules[moduleId]) {
    warn(`Le module « ${moduleId} » est déjà actif — rien à faire.`);
    return;
  }

  const next: ProjectConfig = {
    ...config,
    modules: { ...config.modules, [moduleId]: true },
    ...(moduleId === 'mockups' ? { designSystem: { targets: ['css' as const] } } : {}),
  };

  const plan = buildScaffoldPlan({
    config: next,
    modules: [moduleId],
    includeRoot: false,
    includeProviders: false,
  });

  const result = await applyScaffoldPlan(plan, { root, dryRun: options.dryRun ?? false });

  if (options.dryRun !== true) {
    await writeProjectConfig(root, next);
  }

  heading(`klee module add ${moduleId}`);
  reportApply(result);

  if (options.refreshRoot === true) {
    await refreshRootFiles(root, next, options.dryRun ?? false);
  } else {
    write();
    info('`README.md` énumère les modules du projet : `--refresh-root` pour le régénérer.');
  }
  write();
}

export async function runModuleRemove(
  moduleName: string,
  options: ModuleCommandOptions,
): Promise<void> {
  const moduleId = parseOptionalModuleId(moduleName);
  const { root, config } = await loadProject();

  if (!config.modules[moduleId]) {
    warn(`Le module « ${moduleId} » est déjà absent — rien à faire.`);
    return;
  }

  const next: ProjectConfig = { ...config, modules: { ...config.modules, [moduleId]: false } };
  if (moduleId === 'mockups') {
    delete (next as { designSystem?: unknown }).designSystem;
  }

  if (options.dryRun !== true) {
    await writeProjectConfig(root, next);
  }

  heading(`klee module remove ${moduleId}`);
  success(`Module « ${moduleId} » désactivé dans project.config.json.`);
  write();
  // Supprimer des fichiers versionnés à la place de l'auteur serait une décision, pas une
  // commodité : on signale, on ne détruit pas.
  warn('Les fichiers existants ne sont pas supprimés. À retirer si vous le souhaitez :');
  for (const path of MODULES[moduleId].paths) {
    write(`      ${path}`);
  }

  if (options.refreshRoot === true) {
    await refreshRootFiles(root, next, options.dryRun ?? false);
  }
  write();
}

async function refreshRootFiles(
  root: string,
  config: ProjectConfig,
  dryRun: boolean,
): Promise<void> {
  const plan = buildScaffoldPlan({
    config,
    modules: [],
    includeRoot: true,
    includeProviders: false,
  });
  const result = await applyScaffoldPlan(plan, { root, dryRun, force: true });
  write();
  info('Fichiers de racine régénérés :');
  reportApply(result);
}

function parseOptionalModuleId(value: string): ModuleId {
  if (!isModuleId(value)) {
    throw new KeelError(`Module inconnu : "${value}".`, {
      code: 'MODULE_UNKNOWN',
      hint: `Modules optionnels : ${OPTIONAL_MODULE_IDS.join(', ')}.`,
    });
  }
  if (MODULES[value].core) {
    throw new KeelError(
      `« ${value} » est un module socle : il ne peut pas être ajouté ni retiré.`,
      {
        code: 'MODULE_CORE',
        hint: `Modules optionnels : ${OPTIONAL_MODULE_IDS.join(', ')}.`,
      },
    );
  }
  return value;
}
