import { z } from 'zod';

import { DOC_PREFIX, ID_PREFIX_PATTERN, MOCKUP_PREFIX } from '../ids.js';

/**
 * Format d'un ticket (TECHNICAL.md §6, §7, §11).
 *
 * Un ticket est un fichier markdown : frontmatter structuré pour ce qu'une machine doit
 * lire, corps libre pour ce qu'un humain doit comprendre. Le frontmatter est volontairement
 * court — tout ce qui s'y trouve est du liant de graphe, pas de la description.
 */

/**
 * Workflow imposé, non configurable. `ready-for-dev` en particulier n'est pas décoratif :
 * c'est la cible du webhook « une maquette passe en validated » (§7). Un workflow qui
 * varierait d'un projet à l'autre rendrait ces automatismes inécrivables.
 */
export const TICKET_STATUSES = [
  'backlog',
  'ready-for-dev',
  'in-progress',
  'in-review',
  'done',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const DEFAULT_TICKET_STATUS: TicketStatus = 'backlog';

/** Titre de section sous lequel vivent les critères d'acceptation (cf ADR 0008). */
export const ACCEPTANCE_HEADING = "Critères d'acceptation";

const idReference = z.string().regex(/^[A-Z][A-Z0-9]{1,9}-\d{1,6}$/);

export const ticketFrontmatterSchema = z.object({
  id: idReference,
  title: z.string().min(1),
  status: z.enum(TICKET_STATUSES),
  assignee: z.string().min(1).nullable().default(null),
  created: z.iso.date(),
  updated: z.iso.date(),
  /**
   * Graphe de dépendances, pas simple statut (§6) : c'est ce qui permet à un agent de savoir
   * s'il risque d'entrer en collision avec un autre agent travaillant en parallèle.
   */
  depends_on: z.array(idReference).default([]),
  related_mockups: z.array(z.string().regex(new RegExp(`^${MOCKUP_PREFIX}-\\d{1,6}$`))).default([]),
  related_docs: z.array(z.string().regex(new RegExp(`^${DOC_PREFIX}-\\d{1,6}$`))).default([]),
  /** Provenance (§7) : distinguer une modification d'agent d'une modification humaine. */
  authored_by: z.enum(['human', 'agent']).default('human'),
});

export type TicketFrontmatter = z.infer<typeof ticketFrontmatterSchema>;

export interface Ticket extends TicketFrontmatter {
  /** Chemin du fichier, relatif à la racine du projet. */
  readonly path: string;
  /** Corps markdown, critères d'acceptation compris. */
  readonly body: string;
  /**
   * Contenu des blocs ```gherkin du corps, concaténés. Vide si le ticket n'en déclare pas —
   * ce qui est licite : tous les tickets ne se prêtent pas à des critères exécutables.
   */
  readonly acceptance: string;
}

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

/** `KLEE-001-mettre-en-place-le-pipeline.md` — l'identifiant d'abord, pour trier et retrouver. */
export function ticketFileName(id: string, title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug === '' ? `${id}.md` : `${id}-${slug}.md`;
}

export function isValidTicketPrefix(prefix: string): boolean {
  return ID_PREFIX_PATTERN.test(prefix);
}
