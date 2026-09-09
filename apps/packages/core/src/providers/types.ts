/**
 * Axe 2 de configuration — provider d'un module retenu (TECHNICAL.md §13).
 *
 * Un point ne mérite le traitement « provider » que s'il existe au moins deux solutions
 * réellement solides sans gagnant technique évident. La CLI ne fige donc pas un choix en
 * dur : elle le propose avec un défaut sensé, et la résolution passe par une factory.
 */

import type { ModuleId } from '../modules.js';
import type { ScaffoldGenerator } from '../scaffold/types.js';
import type { TicketIndexFactory } from '../tickets/ticket-index.js';

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
export interface Provider extends ScaffoldGenerator {
  readonly id: string;
  readonly point: ProviderPoint;
  readonly label: string;
  readonly description: string;
  /**
   * Ce que seul un provider du point `workspace` sait du projet généré : avec quoi il
   * s'installe, comment il lance un script, et sous quelle forme un package en référence un
   * autre. Keel n'embarque aucun gestionnaire de paquets, il délègue.
   */
  readonly workspace?: {
    readonly install: readonly string[];
    /** Préfixe d'exécution d'un script ; le nom du script est ajouté à la suite. */
    readonly run: readonly string[];
    /**
     * Portée à écrire pour dépendre d'un autre package du workspace. pnpm exige
     * `workspace:*` ; npm résout `*` vers le package local. Se tromper envoie le
     * gestionnaire chercher un paquet privé sur le registre public.
     */
    readonly dependencyRange: string;
    /** Valeur du champ `packageManager`, qu'exige Turborepo pour résoudre le workspace. */
    readonly packageManager: string;
  };
  /**
   * Lecture des tickets, pour les providers du point `tickets-index`. Un provider n'est donc
   * pas seulement un générateur de fichiers : il peut porter du comportement, tant que ce
   * comportement reste derrière une interface commune (§13).
   */
  readonly ticketIndex?: TicketIndexFactory;
}

export function isProviderPoint(value: string): value is ProviderPoint {
  return (PROVIDER_POINTS as readonly string[]).includes(value);
}
