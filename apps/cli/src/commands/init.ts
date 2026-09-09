import { basename, resolve } from 'node:path';

import {
  CONFIG_FILENAME,
  DEFAULT_PRESET_ID,
  DEFAULT_TICKET_PREFIX,
  KeelError,
  MODULE_IDS,
  PRESETS,
  PRESET_IDS,
  PROVIDER_POINTS,
  PROVIDER_POINT_DEFINITIONS,
  REQUIRED_TOKEN_TARGET,
  applyScaffoldPlan,
  buildScaffoldPlan,
  configPath,
  createProjectConfig,
  defaultProviderSelection,
  isPresetId,
  moduleSelectionFromOptional,
  moduleSelectionFromPreset,
  providerRegistry,
  type ModuleSelection,
  type PresetId,
  type ProjectConfig,
  type ProviderPoint,
  type TokenTarget,
} from '@keel/core';

import { field, heading, info, reportApply, write } from '../ui/output.js';
import {
  askIdPrefix,
  askOptionalModules,
  askProjectName,
  askProvider,
  askTokenTargets,
} from '../ui/prompts.js';
import { fileExists } from '../fs.js';

export interface InitOptions {
  readonly name?: string;
  readonly idPrefix?: string;
  readonly preset?: string;
  readonly yes?: boolean;
  readonly dryRun?: boolean;
  readonly force?: boolean;
}

export async function runInit(directory: string | undefined, options: InitOptions): Promise<void> {
  const root = resolve(directory ?? '.');
  const preset = resolvePreset(options.preset);

  if ((await fileExists(configPath(root))) && options.force !== true) {
    throw new KeelError(`${root} contient déjà un ${CONFIG_FILENAME}.`, {
      code: 'ALREADY_INITIALIZED',
      hint: 'Utilisez `klee module add <module>` pour faire évoluer le projet, ou --force pour régénérer.',
    });
  }

  const config =
    options.yes === true
      ? nonInteractiveConfig(root, preset, options)
      : await interactiveConfig(root, preset, options);

  const plan = buildScaffoldPlan({ config });
  const result = await applyScaffoldPlan(plan, {
    root,
    dryRun: options.dryRun ?? false,
    force: options.force ?? false,
  });

  heading('klee init');
  field('Projet', config.name);
  field('Préfixe', `${config.idPrefix}-xxx`);
  field('Modules', MODULE_IDS.filter((id) => config.modules[id]).join(', '));
  field(
    'Providers',
    applicablePoints(config.modules)
      .map((point) => `${point}=${config.providers[point]}`)
      .join(', '),
  );
  write();
  reportApply(result);

  if (!result.dryRun) {
    write();
    info('Prochaines étapes :');
    info('  • lire AGENTS.md à la racine, puis celui du dossier où vous travaillez ;');
    info('  • `klee module list` pour voir les modules actifs.');
    write();
  }
}

function resolvePreset(value: string | undefined): PresetId {
  if (value === undefined) return DEFAULT_PRESET_ID;
  if (!isPresetId(value)) {
    throw new KeelError(`Preset inconnu : "${value}".`, {
      code: 'PRESET_UNKNOWN',
      hint: `Presets disponibles : ${PRESET_IDS.join(', ')}.`,
    });
  }
  return value;
}

/** `--yes` : tous les défauts, aucune question — usage scriptable, CI, agent non supervisé. */
function nonInteractiveConfig(root: string, preset: PresetId, options: InitOptions): ProjectConfig {
  const modules = moduleSelectionFromPreset(preset);
  return createProjectConfig({
    name: options.name ?? defaultProjectName(root),
    idPrefix: options.idPrefix ?? DEFAULT_TICKET_PREFIX,
    modules,
    providers: defaultProviderSelection(),
    tokenTargets: [REQUIRED_TOKEN_TARGET],
  });
}

async function interactiveConfig(
  root: string,
  preset: PresetId,
  options: InitOptions,
): Promise<ProjectConfig> {
  if (process.stdin.isTTY !== true) {
    throw new KeelError('Le mode interactif requiert un terminal.', {
      code: 'NOT_A_TTY',
      hint: 'Utilisez `klee init --yes` (éventuellement avec --preset) pour un usage scriptable.',
    });
  }

  heading('klee init');
  info(`Preset de départ : ${preset} — ${PRESETS[preset].description}`);
  write();

  const name = options.name ?? (await askProjectName(defaultProjectName(root)));
  const idPrefix = options.idPrefix ?? (await askIdPrefix(DEFAULT_TICKET_PREFIX));

  const optionalModules = await askOptionalModules(PRESETS[preset].optionalModules);
  const modules = moduleSelectionFromOptional(optionalModules);

  const providers: Partial<Record<ProviderPoint, string>> = {};
  for (const point of applicablePoints(modules)) {
    providers[point] = await askProvider(point, providerRegistry);
  }

  const tokenTargets: TokenTarget[] = modules.mockups
    ? await askTokenTargets()
    : [REQUIRED_TOKEN_TARGET];

  return createProjectConfig({ name, idPrefix, modules, providers, tokenTargets });
}

/** Un point de provider n'est demandé que si le module dont il dépend est retenu (§13). */
function applicablePoints(modules: ModuleSelection): ProviderPoint[] {
  return PROVIDER_POINTS.filter((point) => {
    const requires = PROVIDER_POINT_DEFINITIONS[point].requiresModule;
    return requires === null || modules[requires];
  });
}

function defaultProjectName(root: string): string {
  const slug = basename(root)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/-+$/, '');
  return slug === '' ? 'projet' : slug;
}
