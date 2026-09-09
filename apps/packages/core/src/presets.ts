/**
 * Presets d'init (TECHNICAL.md §13) — évitent de répondre à toutes les questions
 * de modules à chaque fois.
 *
 * Un preset fixe l'axe 1 (présence des modules). Il peut en outre **proposer** un défaut de
 * provider, sans jamais l'imposer : le mode interactif le présélectionne, `--provider` le
 * remplace, et l'édition de `project.config.json` reste toujours possible (ADR 0012).
 */

import { CORE_MODULE_IDS, MODULE_IDS, type ModuleId, type ModuleSelection } from './modules.js';
import type { ProviderPoint } from './providers/types.js';

export const PRESET_IDS = ['full-product', 'api-service', 'internal-lib'] as const;

export type PresetId = (typeof PRESET_IDS)[number];

export interface PresetDefinition {
  readonly id: PresetId;
  readonly label: string;
  readonly description: string;
  /** Modules optionnels retenus. Le socle est toujours inclus en plus. */
  readonly optionalModules: readonly ModuleId[];
  /**
   * Défauts de provider proposés par ce preset, pour les points que le choix de modules ne
   * suffit pas à trancher. Une proposition, jamais une contrainte.
   */
  readonly providerDefaults?: Readonly<Partial<Record<ProviderPoint, string>>>;
}

export const PRESETS: Readonly<Record<PresetId, PresetDefinition>> = {
  'full-product': {
    id: 'full-product',
    label: 'full-product',
    description: 'Tous les modules — produit complet avec interface, API et docs produit.',
    optionalModules: ['mockups', 'contracts', 'docs-product', 'docs-i18n-copy'],
  },
  'api-service': {
    id: 'api-service',
    label: 'api-service',
    description: 'Service exposant une API : contracts inclus, pas de maquettes.',
    optionalModules: ['contracts'],
  },
  'internal-lib': {
    id: 'internal-lib',
    label: 'internal-lib',
    description: 'Bibliothèque interne : ni maquettes, ni contracts, ni docs produit.',
    optionalModules: [],
    /**
     * Le point `docs` appartient au socle : sans cette proposition, une bibliothèque interne
     * dont les quelques ADR se lisent très bien sur une forge installerait React et toute la
     * chaîne de construction d'un site. Le choix reste modifiable (ADR 0012).
     */
    providerDefaults: { docs: 'markdown-only' },
  },
};

/** Preset appliqué par `klee init --yes` sans preset explicite (TECHNICAL.md §13). */
export const DEFAULT_PRESET_ID: PresetId = 'full-product';

/** Défauts de provider que ce preset propose. Vide pour un preset qui n'en propose aucun. */
export function providerDefaultsFromPreset(
  presetId: PresetId,
): Readonly<Partial<Record<ProviderPoint, string>>> {
  return PRESETS[presetId].providerDefaults ?? {};
}

export function isPresetId(value: string): value is PresetId {
  return (PRESET_IDS as readonly string[]).includes(value);
}

export function moduleSelectionFromPreset(presetId: PresetId): ModuleSelection {
  const retained = new Set<ModuleId>([...CORE_MODULE_IDS, ...PRESETS[presetId].optionalModules]);
  return Object.fromEntries(
    MODULE_IDS.map((id) => [id, retained.has(id)]),
  ) as unknown as ModuleSelection;
}

/** Construit une sélection complète à partir des seuls modules optionnels retenus. */
export function moduleSelectionFromOptional(optional: readonly ModuleId[]): ModuleSelection {
  const retained = new Set<ModuleId>([...CORE_MODULE_IDS, ...optional]);
  return Object.fromEntries(
    MODULE_IDS.map((id) => [id, retained.has(id)]),
  ) as unknown as ModuleSelection;
}
