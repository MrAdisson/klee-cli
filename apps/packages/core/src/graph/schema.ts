import { z } from 'zod';

import { DOC_PREFIX, MOCKUP_PREFIX, type EntityKind } from '../ids.js';

/**
 * Modèle du graphe de traçabilité (TECHNICAL.md §7).
 *
 * Trois natures de nœud — ticket, maquette, document — et deux natures d'arête :
 *
 * - **déclarée** : écrite dans un frontmatter (`depends_on`, `related_*`). C'est un
 *   engagement, et `klee links check` refuse qu'elle pointe dans le vide.
 * - **mention** : un identifiant rencontré dans du texte libre. C'est une observation, pas
 *   un engagement : elle rend le texte cliquable (DESIGN.md §5) mais ne fait échouer personne.
 *
 * Le vocabulaire d'arête est le même pour les trois natures — `related_tickets`,
 * `related_mockups`, `related_docs` — cf ADR 0010. Un lecteur qui devrait porter un cas
 * particulier par type de fichier finirait par en oublier un.
 */

/** Une arête déclarée d'un seul côté vaut des deux : il n'y a rien à synchroniser. */
export const EDGE_KINDS = ['depends-on', 'related', 'mention'] as const;

export type EdgeKind = (typeof EDGE_KINDS)[number];

export interface GraphNode {
  readonly id: string;
  readonly kind: EntityKind;
  readonly title: string;
  /** Chemin du fichier qui porte le nœud, relatif à la racine, en POSIX. */
  readonly path: string;
  /** Statut propre à la nature du nœud (ticket, maquette). `null` pour un document. */
  readonly status: string | null;
  /**
   * Composant qui implémente réellement une maquette (TECHNICAL.md §7). Ce n'est pas une
   * arête : à l'autre bout il y a un chemin de fichier, pas un identifiant. Comparer les deux
   * automatiquement a été instruit puis écarté — cf ADR 0015. Le champ documente le lien.
   */
  readonly implementedIn: string | null;
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: EdgeKind;
  /** Fichiers où l'arête est écrite — plusieurs si les deux extrémités la déclarent. */
  readonly sources: readonly string[];
}

export interface TraceGraph {
  readonly nodes: readonly GraphNode[];
  /** Arêtes déclarées, dédoublonnées, jamais dupliquées par la déclaration réciproque. */
  readonly edges: readonly GraphEdge[];
  /** Identifiants croisés dans du texte libre, hors arêtes déclarées. */
  readonly mentions: readonly GraphEdge[];
  /** Fichiers de `docs/` sans identifiant : invisibles du graphe, donc signalés. */
  readonly untracked: readonly string[];
}

const idReference = z.string().regex(/^[A-Z][A-Z0-9]{1,9}-\d{1,6}$/);
const mockupReference = z.string().regex(new RegExp(`^${MOCKUP_PREFIX}-\\d{1,6}$`));
const docReference = z.string().regex(new RegExp(`^${DOC_PREFIX}-\\d{1,6}$`));

/**
 * Une liste d'identifiants tolère la forme scalaire : `related_tickets: KLEE-001` est ce
 * qu'écrit spontanément un humain, et le refuser n'apprendrait rien à personne.
 */
function idList(entry: z.ZodType<string>): z.ZodType<string[]> {
  return z.union([z.array(entry), entry.transform((value) => [value])]).default([]);
}

/**
 * Frontmatter d'un document (TECHNICAL.md §5).
 *
 * Volontairement permissif sur les champs inconnus : le générateur de site docs-as-code
 * pose les siens (`sidebar_position`, `slug`, `tags`…), et une doc n'a pas à choisir entre
 * être lisible par Klee et être publiable.
 */
export const docFrontmatterSchema = z.looseObject({
  id: docReference,
  title: z.string().min(1).optional(),
  related_tickets: idList(idReference),
  related_mockups: idList(mockupReference),
  related_docs: idList(docReference),
});

export type DocFrontmatter = z.infer<typeof docFrontmatterSchema>;

/** Statuts d'une maquette (TECHNICAL.md §4, DESIGN.md §3). */
export const MOCKUP_STATUSES = ['draft', 'validated', 'implemented'] as const;

export type MockupStatus = (typeof MOCKUP_STATUSES)[number];

/**
 * Métadonnées d'une maquette (`.meta.yml`).
 *
 * `ticket:` au singulier est la forme qu'a générée la phase 1 et que décrit encore
 * TECHNICAL.md §4. Elle reste lue comme un alias de `related_tickets` pour ne pas casser
 * les projets déjà scaffoldés, mais n'est plus écrite (ADR 0010).
 */
export const mockupMetaSchema = z.looseObject({
  id: mockupReference,
  title: z.string().min(1).optional(),
  status: z.enum(MOCKUP_STATUSES).default('draft'),
  ticket: idReference.nullish(),
  related_tickets: idList(idReference),
  related_docs: idList(docReference),
  implemented_in: z.string().min(1).nullish(),
});

export type MockupMeta = z.infer<typeof mockupMetaSchema>;
