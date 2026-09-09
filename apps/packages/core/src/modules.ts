/**
 * Axe 1 de configuration — présence d'un module (TECHNICAL.md §13).
 *
 * Un module non retenu ne génère aucun fichier, aucune dépendance, aucune section
 * dans le cockpit. Les modules « socle » ne sont jamais optionnels : ce sont eux qui
 * portent le graphe de traçabilité, et le rendre facultatif reviendrait à casser le
 * liant que le projet existe pour garantir.
 */

export const MODULE_IDS = [
  'apps',
  'tickets',
  'docs-technical',
  'docs-decisions',
  'mockups',
  'contracts',
  'docs-product',
  'docs-i18n-copy',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export interface ModuleDefinition {
  readonly id: ModuleId;
  readonly label: string;
  /** Socle (TECHNICAL.md §13, axe 1) : ne peut pas être désactivé. */
  readonly core: boolean;
  /** Critère de pertinence affiché à l'utilisateur pour trancher à l'init. */
  readonly hint: string;
  /** Chemins racine dont ce module est propriétaire, pour l'affichage et `module remove`. */
  readonly paths: readonly string[];
}

export const MODULES: Readonly<Record<ModuleId, ModuleDefinition>> = {
  apps: {
    id: 'apps',
    label: 'apps/ — code applicatif',
    core: true,
    hint: 'Toujours : le monorepo applicatif est le socle.',
    paths: ['apps/'],
  },
  tickets: {
    id: 'tickets',
    label: 'tickets/ — ticketing markdown-native',
    core: true,
    hint: "Toujours : c'est le point d'ancrage du graphe de traçabilité.",
    paths: ['tickets/'],
  },
  'docs-technical': {
    id: 'docs-technical',
    label: 'docs/technical/ — documentation technique',
    core: true,
    hint: 'Toujours.',
    paths: ['docs/technical/'],
  },
  'docs-decisions': {
    id: 'docs-decisions',
    label: 'docs/decisions/ — ADR',
    core: true,
    hint: 'Toujours : une décision non écrite est une décision perdue.',
    paths: ['docs/decisions/'],
  },
  mockups: {
    id: 'mockups',
    label: 'mockups/ + design-system/ — UI figée en HTML/CSS et tokens DTCG',
    core: false,
    hint: 'Le projet a une interface propre à designer (pas un service headless, une lib, un CLI).',
    paths: ['mockups/', 'design-system/'],
  },
  contracts: {
    id: 'contracts',
    label: 'contracts/ — schémas d’API et modèle de domaine',
    core: false,
    hint: "Le projet expose une API consommée par d'autres services ou clients.",
    paths: ['contracts/'],
  },
  'docs-product': {
    id: 'docs-product',
    label: 'docs/product/ — personas, flows, specs fonctionnelles',
    core: false,
    hint: 'Il y a un enjeu produit/utilisateur, pas juste une lib interne.',
    paths: ['docs/product/'],
  },
  'docs-i18n-copy': {
    id: 'docs-i18n-copy',
    label: 'docs/i18n-copy/ — UX writing et traductions',
    core: false,
    hint: 'Le projet est multi-langue ou a un enjeu de ton/copy dédié.',
    paths: ['docs/i18n-copy/'],
  },
};

export const CORE_MODULE_IDS: readonly ModuleId[] = MODULE_IDS.filter((id) => MODULES[id].core);

export const OPTIONAL_MODULE_IDS: readonly ModuleId[] = MODULE_IDS.filter(
  (id) => !MODULES[id].core,
);

export type ModuleSelection = Readonly<Record<ModuleId, boolean>>;

/**
 * `design-system/` suit exactement la condition de `mockups/` (TECHNICAL.md §3) :
 * pas de question CLI séparée, un projet sans interface n'a besoin ni de l'un ni de l'autre.
 */
export function hasDesignSystem(modules: ModuleSelection): boolean {
  return modules.mockups;
}

export function isModuleId(value: string): value is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(value);
}
