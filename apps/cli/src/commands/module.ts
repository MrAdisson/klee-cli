import {
  KleeError,
  MODULES,
  MODULE_IDS,
  OPTIONAL_MODULE_IDS,
  applyScaffoldPlan,
  buildScaffoldPlan,
  isModuleId,
  providerPointsForModule,
  providerRegistry,
  writeProjectConfig,
  type ModuleId,
  type ProjectConfig,
} from '@klee/core';

import { loadProject } from '../project.js';
import { field, heading, info, reportApply, success, warn, write } from '../ui/output.js';
import { spawnInherit } from '../spawn.js';

export interface ModuleCommandOptions {
  readonly dryRun?: boolean;
  /** Régénère aussi les fichiers de racine, qui énumèrent les modules retenus. */
  readonly refreshRoot?: boolean;
  /** Installe les dépendances que le module ajoute. */
  readonly install?: boolean;
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
    // Le module vient avec les providers qui le font fonctionner : ajouter `mockups` sans
    // le pipeline de tokens ni le serveur de maquettes ne produirait qu'une coquille.
    providerPoints: providerPointsForModule(moduleId),
  });

  const result = await applyScaffoldPlan(plan, { root, dryRun: options.dryRun ?? false });

  if (options.dryRun !== true) {
    await writeProjectConfig(root, next);
  }

  heading(`klee module add ${moduleId}`);
  reportApply(result);

  // Un module qui arrive apporte ses dépendances (ADR 0006) : les taire reviendrait à livrer
  // un dossier qui ne peut pas fonctionner tant que personne n'a deviné quoi installer.
  if (plan.dependencies.length > 0 && options.dryRun !== true) {
    write();
    info(`${String(plan.dependencies.length)} dépendance(s) déclarée(s) :`);
    for (const dependency of plan.dependencies) {
      write(`      ${dependency.name}@${dependency.version} → ${dependency.target}`);
    }

    const installCommand = workspaceInstallCommand(next);
    if (options.install === true) {
      const [command, ...args] = installCommand;
      if (command !== undefined) {
        write();
        info(`${command} ${args.join(' ')}`);
        write();
        const code = await spawnInherit(command, args, root);
        if (code !== 0) {
          process.exitCode = code;
          return;
        }
      }
    } else {
      write();
      info(`Lancez \`${installCommand.join(' ')}\` (ou \`--install\`) pour les installer.`);
    }
  }

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

/** Commande d'installation déclarée par le provider `workspace` du projet. */
function workspaceInstallCommand(config: ProjectConfig): readonly string[] {
  return (
    providerRegistry.resolve('workspace', config.providers.workspace).workspace?.install ?? [
      'pnpm',
      'install',
    ]
  );
}

function parseOptionalModuleId(value: string): ModuleId {
  if (!isModuleId(value)) {
    throw new KleeError(`Module inconnu : "${value}".`, {
      code: 'MODULE_UNKNOWN',
      hint: `Modules optionnels : ${OPTIONAL_MODULE_IDS.join(', ')}.`,
    });
  }
  if (MODULES[value].core) {
    throw new KleeError(
      `« ${value} » est un module socle : il ne peut pas être ajouté ni retiré.`,
      {
        code: 'MODULE_CORE',
        hint: `Modules optionnels : ${OPTIONAL_MODULE_IDS.join(', ')}.`,
      },
    );
  }
  return value;
}
