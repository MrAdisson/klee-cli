import { basename, join, resolve } from 'node:path';

import {
  CONFIG_FILENAME,
  DEFAULT_PRESET_ID,
  DEFAULT_TICKET_PREFIX,
  KleeError,
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
  isProviderPoint,
  moduleSelectionFromOptional,
  moduleSelectionFromPreset,
  providerDefaultsFromPreset,
  providerRegistry,
  type ModuleSelection,
  type PresetId,
  type ProjectConfig,
  type ProviderPoint,
  type ScaffoldPlan,
  type TokenTarget,
} from '@klee/core';

import { field, heading, info, reportApply, success, warn, write } from '../ui/output.js';
import { refreshGraphReport } from './links.js';
import {
  askIdPrefix,
  askInstallDependencies,
  askOptionalModules,
  askProjectName,
  askProvider,
  askTargetDirectory,
  askTokenTargets,
} from '../ui/prompts.js';
import { fileExists, isInsideGitRepository } from '../fs.js';
import { spawnInherit } from '../spawn.js';

export interface InitOptions {
  readonly name?: string;
  readonly idPrefix?: string;
  readonly preset?: string;
  readonly yes?: boolean;
  readonly dryRun?: boolean;
  readonly force?: boolean;
  readonly install?: boolean;
  /** `--provider <point>=<id>`, répétable : impose un provider, quel que soit le preset. */
  readonly provider?: string[];
  /** `--no-git` : ne pas initialiser de dépôt. */
  readonly git?: boolean;
}

/**
 * Providers imposés en ligne de commande. Ils passent avant le défaut du point comme avant
 * la proposition du preset : c'est ce qui rend cette proposition non contraignante, y
 * compris sans terminal (ADR 0012).
 */
function explicitProviders(options: InitOptions): Partial<Record<ProviderPoint, string>> {
  const chosen: Partial<Record<ProviderPoint, string>> = {};

  for (const entry of options.provider ?? []) {
    const separator = entry.indexOf('=');
    const point = separator === -1 ? '' : entry.slice(0, separator);
    const id = separator === -1 ? '' : entry.slice(separator + 1);

    if (!isProviderPoint(point) || id === '') {
      throw new KleeError(`Option --provider invalide : "${entry}".`, {
        code: 'PROVIDER_OPTION_INVALID',
        hint: `Attendu : <point>=<provider>, avec un point parmi ${PROVIDER_POINTS.join(', ')}.`,
      });
    }

    // Résolution stricte tout de suite : mieux vaut échouer avant d'écrire quoi que ce soit
    // qu'à la première commande qui lira la configuration.
    providerRegistry.resolve(point, id);
    chosen[point] = id;
  }

  return chosen;
}

export async function runInit(directory: string | undefined, options: InitOptions): Promise<void> {
  const preset = resolvePreset(options.preset);
  const interactive = options.yes !== true;

  if (interactive && process.stdin.isTTY !== true) {
    throw new KleeError('Le mode interactif requiert un terminal.', {
      code: 'NOT_A_TTY',
      hint: 'Utilisez `klee init --yes` (éventuellement avec --preset) pour un usage scriptable.',
    });
  }

  let root = resolve(directory ?? '.');

  if (interactive) {
    heading('klee init');
    info(`Preset de départ : ${preset} — ${PRESETS[preset].description}`);
    write();

    // Le dossier est demandé avant le nom : c'est lui qui décide où atterrissent les fichiers,
    // et le nom par défaut en découle. L'inverse — déduire un dossier du nom — ferait muter
    // l'arborescence au gré d'une réponse, ce qu'aucun usage scriptable ne pourrait prévoir.
    if (directory === undefined) {
      root = resolve(await askTargetDirectory());
    }
    info(`Cible : ${root}`);
    write();
  }

  if ((await fileExists(configPath(root))) && options.force !== true) {
    throw new KleeError(`${root} contient déjà un ${CONFIG_FILENAME}.`, {
      code: 'ALREADY_INITIALIZED',
      hint: 'Utilisez `klee module add <module>` pour faire évoluer le projet, ou --force pour régénérer.',
    });
  }

  const config = interactive
    ? await interactiveConfig(root, preset, options)
    : nonInteractiveConfig(root, preset, options);

  const plan = buildScaffoldPlan({ config });
  const result = await applyScaffoldPlan(plan, {
    root,
    dryRun: options.dryRun ?? false,
    onConflict: options.force === true ? 'overwrite' : 'fail',
  });

  heading('Récapitulatif');
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

  if (result.dryRun) return;

  await initializeGitRepository(root, options, interactive);

  const installed = await installDependencies(root, plan, options, interactive);
  if (installed) {
    await buildTokens(root, config, interactive);
  }

  // Première vue du graphe. Comme le build des tokens, c'est local, déterministe, et sans
  // ça `docs/_generated/` — que TECHNICAL.md §5 impose — resterait une promesse vide.
  await refreshGraphReport({ root, config });

  reportNextSteps(config, plan, installed);
}

/**
 * `git init` si — et seulement si — on n'est pas déjà dans un dépôt. Klee repose sur un
 * historique git unique (§1) ; un projet scaffoldé sans dépôt est incohérent avec sa propre
 * prémisse. On s'arrête là : le premier commit est une décision, pas une commodité.
 */
async function initializeGitRepository(
  root: string,
  options: InitOptions,
  interactive: boolean,
): Promise<void> {
  if (options.git === false) return;
  if (await isInsideGitRepository(root)) {
    if (interactive) {
      write();
      info('Dépôt git déjà présent : rien à initialiser.');
    }
    return;
  }

  write();
  const code = await spawnInherit('git', ['init', '--quiet'], root);
  if (code === 0) {
    success('Dépôt git initialisé. À vous de faire le premier commit.');
  } else {
    warn('`git init` a échoué — le projet est scaffoldé, mais pas versionné.');
  }
}

/** Retourne `true` si les dépendances ont réellement été installées. */
async function installDependencies(
  root: string,
  plan: ScaffoldPlan,
  options: InitOptions,
  interactive: boolean,
): Promise<boolean> {
  if (plan.installCommand === null || plan.dependencies.length === 0) return false;

  const [command, ...args] = plan.installCommand;
  if (command === undefined) return false;
  const printable = plan.installCommand.join(' ');

  write();
  info(`${String(plan.dependencies.length)} dépendance(s) déclarée(s) dans les package.json.`);

  // En mode scriptable, on n'installe que si on l'a demandé : le réseau ne doit jamais être
  // sollicité par surprise (ADR 0006). En interactif, on propose — l'oubli est systématique.
  const wanted =
    options.install === true || (interactive && (await askInstallDependencies(printable)));
  if (!wanted) return false;

  write();
  const code = await spawnInherit(command, args, root);
  if (code === 0) return true;

  process.exitCode = code;
  warn(`\`${printable}\` a échoué : lancez-le à la main pour terminer l'installation.`);
  return false;
}

/**
 * Premier build des tokens. Rien à voir avec l'installation refusée par l'ADR 0006 : c'est
 * local, déterministe, rapide, et le produit est ignoré par git. Sans lui, les maquettes se
 * servent sans aucune valeur de token — des pages muettes, et un 404 difficile à relier à sa
 * cause.
 */
async function buildTokens(
  root: string,
  config: ProjectConfig,
  interactive: boolean,
): Promise<void> {
  if (!config.modules.mockups) return;

  const workspace = providerRegistry.resolve('workspace', config.providers.workspace);
  const [command, ...prefix] = workspace.workspace?.run ?? [];
  if (command === undefined) return;

  write();
  const code = await spawnInherit(command, [...prefix, 'build'], join(root, 'design-system'));
  if (code === 0) {
    success('Tokens construits : les maquettes sont servables telles quelles.');
  } else if (interactive) {
    warn('Le build des tokens a échoué : `klee tokens build` pour réessayer.');
  }
}

function reportNextSteps(config: ProjectConfig, plan: ScaffoldPlan, installed: boolean): void {
  write();
  info('Prochaines étapes :');
  if (!installed && plan.installCommand !== null && plan.dependencies.length > 0) {
    info(`  • ${plan.installCommand.join(' ')} pour installer les dépendances déclarées ;`);
  }
  if (config.modules.mockups) {
    info(
      installed
        ? '  • `klee mockups serve` pour naviguer dans les maquettes ;'
        : '  • puis `klee tokens build` et `klee mockups serve` ;',
    );
  }
  info('  • lire AGENTS.md à la racine, puis celui du dossier où vous travaillez ;');
  info('  • `klee ticket create "…"` et `klee board` pour le suivi.');
  write();
}

function resolvePreset(value: string | undefined): PresetId {
  if (value === undefined) return DEFAULT_PRESET_ID;
  if (!isPresetId(value)) {
    throw new KleeError(`Preset inconnu : "${value}".`, {
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
    providers: { ...defaultProviderSelection(preset), ...explicitProviders(options) },
    tokenTargets: [REQUIRED_TOKEN_TARGET],
  });
}

async function interactiveConfig(
  root: string,
  preset: PresetId,
  options: InitOptions,
): Promise<ProjectConfig> {
  const name = options.name ?? (await askProjectName(defaultProjectName(root)));
  const idPrefix = options.idPrefix ?? (await askIdPrefix(DEFAULT_TICKET_PREFIX));

  const optionalModules = await askOptionalModules(PRESETS[preset].optionalModules);
  const modules = moduleSelectionFromOptional(optionalModules);

  const imposed = explicitProviders(options);
  const proposed = providerDefaultsFromPreset(preset);

  const providers: Partial<Record<ProviderPoint, string>> = { ...imposed };
  for (const point of applicablePoints(modules)) {
    // Un point tranché en ligne de commande n'a pas à être redemandé.
    if (imposed[point] !== undefined) continue;
    providers[point] = await askProvider(point, providerRegistry, proposed[point]);
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
