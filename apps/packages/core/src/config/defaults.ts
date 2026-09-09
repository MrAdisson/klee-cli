import { ConfigError } from '../errors.js';
import { DEFAULT_TICKET_PREFIX } from '../ids.js';
import type { ModuleSelection } from '../modules.js';
import { providerDefaultsFromPreset, type PresetId } from '../presets.js';
import { PROVIDER_POINT_DEFINITIONS } from '../providers/points.js';
import { PROVIDER_POINTS } from '../providers/types.js';
import {
  CONFIG_VERSION,
  REQUIRED_TOKEN_TARGET,
  projectConfigSchema,
  type ProjectConfig,
  type ProviderSelectionConfig,
  type TokenTarget,
} from './schema.js';
import { formatIssues } from './issues.js';
import { validateProjectConfig } from './validate.js';

/**
 * Providers appliqués par `--yes` (TECHNICAL.md §13).
 *
 * Le défaut du point s'applique, sauf si le preset en propose un autre : un preset décrit un
 * genre de projet, et certains points n'ont pas le même défaut sensé pour tous les genres
 * (ADR 0012). Un choix explicite de l'utilisateur passe avant les deux.
 */
export function defaultProviderSelection(preset?: PresetId): ProviderSelectionConfig {
  const proposed = preset === undefined ? {} : providerDefaultsFromPreset(preset);
  return Object.fromEntries(
    PROVIDER_POINTS.map((point) => [
      point,
      proposed[point] ?? PROVIDER_POINT_DEFINITIONS[point].defaultProvider,
    ]),
  ) as unknown as ProviderSelectionConfig;
}

export interface CreateProjectConfigInput {
  readonly name: string;
  readonly idPrefix?: string;
  readonly modules: ModuleSelection;
  readonly providers?: Partial<ProviderSelectionConfig>;
  readonly tokenTargets?: readonly TokenTarget[];
}

/**
 * Construit une configuration complète et déjà validée. Passer par ici plutôt que
 * d'assembler un objet à la main garantit qu'aucun chemin du code ne produit une config
 * partielle (providers manquants, designSystem incohérent).
 */
export function createProjectConfig(input: CreateProjectConfigInput): ProjectConfig {
  const targets = dedupeTargets(input.tokenTargets ?? [REQUIRED_TOKEN_TARGET]);

  const candidate = {
    version: CONFIG_VERSION,
    name: input.name,
    idPrefix: input.idPrefix ?? DEFAULT_TICKET_PREFIX,
    modules: { ...input.modules },
    providers: { ...defaultProviderSelection(), ...input.providers },
    ...(input.modules.mockups ? { designSystem: { targets } } : {}),
  };

  const parsed = projectConfigSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new ConfigError(`Configuration invalide :\n${formatIssues(parsed.error.issues)}`, {
      hint: 'Vérifiez le nom du projet et le préfixe d’identifiants.',
    });
  }

  validateProjectConfig(parsed.data);
  return parsed.data;
}

function dedupeTargets(targets: readonly TokenTarget[]): TokenTarget[] {
  return [...new Set<TokenTarget>([REQUIRED_TOKEN_TARGET, ...targets])];
}
