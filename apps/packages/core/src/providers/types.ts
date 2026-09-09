/**
 * Axe 2 de configuration — provider d'un module retenu (TECHNICAL.md §13).
 *
 * Un point ne mérite le traitement « provider » que s'il existe au moins deux solutions
 * réellement solides sans gagnant technique évident. La CLI ne fige donc pas un choix en
 * dur : elle le propose avec un défaut sensé, et la résolution passe par une factory.
 */

import type { ModuleId } from '../modules.js';
import type { ScaffoldContext, ScaffoldFile } from '../scaffold/types.js';

export const PROVIDER_POINTS = [
  'workspace',
  'docs',
  'contracts',
  'tickets-index',
  'mockups-composition',
  'visual-regression',
  'tokens-pipeline',
] as const;

export type ProviderPoint = (typeof PROVIDER_POINTS)[number];

export interface ProviderPointDefinition {
  readonly point: ProviderPoint;
  readonly label: string;
  /** Question posée en mode interactif. */
  readonly question: string;
  /** Le point n'est demandé que si ce module est retenu (`null` = point du socle). */
  readonly requiresModule: ModuleId | null;
  /** Provider appliqué par `--yes` et par les presets. */
  readonly defaultProvider: string;
  /** Section de TECHNICAL.md qui motive le point. */
  readonly reference: string;
  /**
   * Phase de la roadmap à laquelle la génération de fichiers de ce point est implémentée.
   * Le choix est enregistré dans project.config.json dès la phase 0 (§13), mais tous les
   * providers ne produisent pas encore de fichiers.
   */
  readonly scaffoldingPhase: number;
}

/**
 * Interface commune à tous les providers. Ajouter un provider ne doit jamais nécessiter
 * de toucher au reste du code : il suffit d'implémenter cette interface et de l'enregistrer
 * dans la factory (`registry.ts`).
 */
export interface Provider {
  readonly id: string;
  readonly point: ProviderPoint;
  readonly label: string;
  readonly description: string;
  files(context: ScaffoldContext): ScaffoldFile[];
}

export function isProviderPoint(value: string): value is ProviderPoint {
  return (PROVIDER_POINTS as readonly string[]).includes(value);
}
