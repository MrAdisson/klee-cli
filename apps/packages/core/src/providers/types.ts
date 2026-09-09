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
   *
   * `null` = **non planifié** : la roadmap de TECHNICAL.md ne situe ce point dans aucune
   * phase. Écrire un numéro au jugé ferait dire au code une chose que le brief ne dit pas.
   * Ne concerne que la génération du provider — le module, lui, peut très bien produire ses
   * fichiers de convention dès aujourd'hui.
   */
  readonly scaffoldingPhase: number | null;
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
   * autre. Klee n'embarque aucun gestionnaire de paquets, il délègue.
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
  /**
   * Scripts de post-installation qu'apportent les dépendances de ce provider, et la décision
   * prise pour chacun (`true` = exécuter, `false` = ne pas exécuter).
   *
   * Le gestionnaire de paquets refuse d'ignorer un tel script en silence : sans décision,
   * l'installation échoue. C'est le provider qui apporte la dépendance qui sait de quoi il
   * s'agit ; c'est le provider `workspace` qui possède le fichier où la décision s'écrit.
   * Déclarer ici plutôt que d'aller écrire là-bas est ce qui permet d'ajouter un provider
   * sans toucher à un autre (ADR 0012).
   */
  readonly installScripts?: Readonly<Record<string, boolean>>;
  /**
   * Versions imposées dans l'arbre transitif de ce provider, pour corriger ce qu'une
   * dépendance profonde traîne et que son auteur n'a pas encore corrigé.
   *
   * La clé porte de préférence la portée : `uuid@<11.1.1` ne s'applique qu'aux versions
   * concernées et cesse d'agir d'elle-même le jour où l'amont passe au-delà. Un override
   * inconditionnel survivrait à sa raison d'être et finirait par bloquer une mise à jour.
   */
  readonly dependencyOverrides?: Readonly<Record<string, string>>;
}

export function isProviderPoint(value: string): value is ProviderPoint {
  return (PROVIDER_POINTS as readonly string[]).includes(value);
}
