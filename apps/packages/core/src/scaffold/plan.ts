import type { ProjectConfig } from '../config/schema.js';
import { MODULE_IDS, type ModuleId } from '../modules.js';
import { providerRegistry } from '../providers/index.js';
import { PROVIDER_POINT_DEFINITIONS } from '../providers/points.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { PROVIDER_POINTS, type ProviderPoint } from '../providers/types.js';
import { mergeDependencies } from './dependencies.js';
import { MODULE_GENERATORS, rootGenerator } from './modules/index.js';
import type {
  ScaffoldContext,
  ScaffoldDependency,
  ScaffoldFile,
  ScaffoldGenerator,
  ScaffoldPlan,
} from './types.js';

export interface BuildScaffoldPlanOptions {
  readonly config: ProjectConfig;
  /** Horloge injectable — à date fixée, le plan est reproductible. */
  readonly now?: Date;
  readonly registry?: ProviderRegistry;
  /** Restreint le plan à ces modules. Par défaut : tous les modules retenus. */
  readonly modules?: readonly ModuleId[];
  /** Fichiers de racine (README, AGENTS.md, project.config.json). */
  readonly includeRoot?: boolean;
  /** Fichiers produits par les providers (workspace, docs, …). */
  readonly includeProviders?: boolean;
  /**
   * Restreint aux providers de ces points. Sans ce filtre, `klee module add mockups`
   * générerait le dossier du module sans la configuration du pipeline qui le fait marcher.
   */
  readonly providerPoints?: readonly ProviderPoint[];
}

/**
 * Construit le plan de génération sans toucher au disque. Tout passe par ici : `--dry-run`
 * affiche exactement ce que l'écriture produira, et les tests portent sur le plan plutôt
 * que sur des effets de bord.
 */
export function buildScaffoldPlan(options: BuildScaffoldPlanOptions): ScaffoldPlan {
  const { config } = options;
  const context: ScaffoldContext = {
    config,
    now: options.now ?? new Date(),
    registry: options.registry ?? providerRegistry,
  };

  const files: ScaffoldFile[] = [];
  const dependencies: ScaffoldDependency[] = [];

  const collect = (generator: ScaffoldGenerator): void => {
    files.push(...generator.files(context));
    dependencies.push(...(generator.dependencies?.(context) ?? []));
  };

  if (options.includeRoot ?? true) {
    collect(rootGenerator);
  }

  // Ordre déterministe : MODULE_IDS, pas l'ordre de la sélection utilisateur.
  for (const id of MODULE_IDS) {
    if (!config.modules[id]) continue;
    if (options.modules !== undefined && !options.modules.includes(id)) continue;
    collect(MODULE_GENERATORS[id]);
  }

  let installCommand: readonly string[] | null = null;

  if (options.includeProviders ?? true) {
    for (const point of PROVIDER_POINTS) {
      if (options.providerPoints !== undefined && !options.providerPoints.includes(point)) continue;
      const requires = PROVIDER_POINT_DEFINITIONS[point].requiresModule;
      if (requires !== null && !config.modules[requires]) continue;

      const provider = context.registry.resolve(point, config.providers[point]);
      collect(provider);

      if (point === 'workspace' && provider.workspace !== undefined) {
        installCommand = provider.workspace.install;
      }
    }
  }

  assertNoDuplicatePaths(files);
  return { files: mergeDependencies(files, dependencies), dependencies, installCommand };
}

/**
 * Deux générateurs qui revendiquent le même chemin est un bug de conception, pas un cas
 * à arbitrer silencieusement à l'écriture.
 */
function assertNoDuplicatePaths(files: readonly ScaffoldFile[]): void {
  const seen = new Map<string, string>();
  for (const file of files) {
    const previous = seen.get(file.path);
    if (previous !== undefined) {
      throw new Error(
        `Chemin revendiqué deux fois dans le plan : ${file.path} (${previous} puis ${file.origin}).`,
      );
    }
    seen.set(file.path, file.origin);
  }
}
