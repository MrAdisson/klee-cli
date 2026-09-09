import type { ProviderPoint, ProviderPointDefinition } from './types.js';
import { PROVIDER_POINTS } from './types.js';

/**
 * Liste vivante des points configurables (TECHNICAL.md §13). Chaque entrée dit à quel
 * module elle est rattachée : un point n'est jamais demandé pour un module non retenu.
 */
export const PROVIDER_POINT_DEFINITIONS: Readonly<Record<ProviderPoint, ProviderPointDefinition>> =
  {
    workspace: {
      point: 'workspace',
      label: 'Orchestrateur de monorepo',
      question: 'Quel orchestrateur de monorepo ?',
      requiresModule: 'apps',
      defaultProvider: 'pnpm-turborepo',
      reference: 'TECHNICAL.md §2',
      scaffoldingPhase: 0,
    },
    docs: {
      point: 'docs',
      label: 'Générateur de site de docs',
      question: 'Quel générateur de site de documentation ?',
      requiresModule: null,
      defaultProvider: 'docusaurus',
      reference: 'TECHNICAL.md §5',
      scaffoldingPhase: 3,
    },
    contracts: {
      point: 'contracts',
      label: "Format de contrat d'API",
      question: "Quel format de contrat d'API ?",
      requiresModule: 'contracts',
      defaultProvider: 'openapi',
      reference: 'TECHNICAL.md §8',
      scaffoldingPhase: 3,
    },
    'tickets-index': {
      point: 'tickets-index',
      label: 'Indexation du dashboard tickets',
      question: 'Comment indexer les tickets pour le dashboard ?',
      requiresModule: 'tickets',
      defaultProvider: 'markdown-sqlite',
      reference: 'TECHNICAL.md §6',
      scaffoldingPhase: 2,
    },
    'mockups-composition': {
      point: 'mockups-composition',
      label: 'Composition des mockups (includes)',
      question: 'Comment composer les mockups (includes de composants) ?',
      requiresModule: 'mockups',
      defaultProvider: 'eleventy',
      reference: 'TECHNICAL.md §4',
      scaffoldingPhase: 1,
    },
    'visual-regression': {
      point: 'visual-regression',
      label: 'Régression visuelle sur les mockups',
      question: 'Quel outil de régression visuelle ?',
      requiresModule: 'mockups',
      defaultProvider: 'playwright',
      reference: 'TECHNICAL.md §4',
      scaffoldingPhase: 1,
    },
    'tokens-pipeline': {
      point: 'tokens-pipeline',
      label: 'Pipeline de transformation des tokens',
      question: 'Quel pipeline de transformation des design tokens (DTCG → CSS/JS) ?',
      requiresModule: 'mockups',
      defaultProvider: 'style-dictionary',
      reference: 'TECHNICAL.md §3',
      scaffoldingPhase: 1,
    },
  };

export const PROVIDER_POINT_LIST: readonly ProviderPointDefinition[] = PROVIDER_POINTS.map(
  (point) => PROVIDER_POINT_DEFINITIONS[point],
);
