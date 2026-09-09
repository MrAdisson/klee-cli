import { z } from 'zod';

import { ID_PREFIX_PATTERN } from '../ids.js';
import type { ModuleId } from '../modules.js';
import type { ProviderPoint } from '../providers/types.js';

/**
 * Fichier de configuration racine (TECHNICAL.md §13). Il porte les deux axes :
 * la présence des modules (booléens) et le provider retenu pour chaque point.
 *
 * Le schéma décrit uniquement la *forme*. Les invariants sémantiques (socle obligatoire,
 * provider réellement enregistré, cohérence design-system/mockups) vivent dans
 * `validate.ts` : ils dépendent du registre, pas de la sérialisation.
 */

export const CONFIG_VERSION = 1;
export const CONFIG_FILENAME = 'project.config.json';

/** Nom de projet directement utilisable comme nom de package npm. */
export const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,213}$/;

/** Cibles de build des tokens (TECHNICAL.md §3) — multi-sélection, pas un choix exclusif. */
export const TOKEN_TARGETS = ['css', 'js', 'tailwind'] as const;
export type TokenTarget = (typeof TOKEN_TARGETS)[number];

/** `css` est le socle universel : toujours généré, quel que soit le stack front. */
export const REQUIRED_TOKEN_TARGET: TokenTarget = 'css';

const moduleSelectionShape = {
  apps: z.boolean(),
  tickets: z.boolean(),
  'docs-technical': z.boolean(),
  'docs-decisions': z.boolean(),
  mockups: z.boolean(),
  contracts: z.boolean(),
  'docs-product': z.boolean(),
  'docs-i18n-copy': z.boolean(),
} satisfies Record<ModuleId, z.ZodBoolean>;

const providerSelectionShape = {
  workspace: z.string().min(1),
  docs: z.string().min(1),
  contracts: z.string().min(1),
  'tickets-index': z.string().min(1),
  'mockups-composition': z.string().min(1),
  'visual-regression': z.string().min(1),
  'tokens-pipeline': z.string().min(1),
} satisfies Record<ProviderPoint, z.ZodString>;

export const moduleSelectionSchema = z.strictObject(moduleSelectionShape);
export const providerSelectionSchema = z.strictObject(providerSelectionShape);

export const designSystemSchema = z.strictObject({
  targets: z.array(z.enum(TOKEN_TARGETS)).min(1),
});

export const projectConfigSchema = z.strictObject({
  $schema: z.string().optional(),
  version: z.literal(CONFIG_VERSION),
  name: z.string().regex(PROJECT_NAME_PATTERN),
  idPrefix: z.string().regex(ID_PREFIX_PATTERN),
  modules: moduleSelectionSchema,
  providers: providerSelectionSchema,
  /** Présent si et seulement si le module `mockups` est retenu (§3). */
  designSystem: designSystemSchema.optional(),
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type ModuleSelectionConfig = z.infer<typeof moduleSelectionSchema>;
export type ProviderSelectionConfig = z.infer<typeof providerSelectionSchema>;
