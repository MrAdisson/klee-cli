import {
  KeelError,
  TICKET_STATUSES,
  createTicket,
  isTicketStatus,
  moveTicket,
  type Ticket,
  type TicketStatus,
} from '@keel/core';

import { loadProject, openTicketIndex } from '../project.js';
import { field, heading, info, success, ticketRow, warn, write } from '../ui/output.js';

/**
 * `klee ticket …` (TECHNICAL.md §6). La CLI écrit directement les fichiers markdown ; seule
 * la lecture passe par l'index configuré.
 */

export interface TicketCreateOptions {
  readonly status?: string;
  readonly assignee?: string;
  readonly dependsOn?: string[];
  readonly mockup?: string[];
  readonly doc?: string[];
  readonly description?: string;
  /** Marque le ticket comme produit par un agent (provenance, §7). */
  readonly agent?: boolean;
}

export async function runTicketCreate(title: string, options: TicketCreateOptions): Promise<void> {
  const project = await loadProject();
  const status = parseStatus(options.status) ?? undefined;

  const ticket = await createTicket({
    root: project.root,
    prefix: project.config.idPrefix,
    title,
    ...(status === undefined ? {} : { status }),
    ...(options.assignee === undefined ? {} : { assignee: options.assignee }),
    dependsOn: options.dependsOn ?? [],
    relatedMockups: options.mockup ?? [],
    relatedDocs: options.doc ?? [],
    authoredBy: options.agent === true ? 'agent' : 'human',
    ...(options.description === undefined ? {} : { description: options.description }),
  });

  heading(`Ticket ${ticket.id}`);
  field('Titre', ticket.title);
  field('Statut', ticket.status);
  field('Fichier', ticket.path);
  write();
  success('Ticket créé.');
  info('Complétez ses critères d’acceptation dans le bloc ```gherkin du fichier.');
  write();
}

export interface TicketListOptions {
  readonly status?: string;
  readonly assignee?: string;
  readonly json?: boolean;
}

export async function runTicketList(options: TicketListOptions): Promise<void> {
  const project = await loadProject();
  const status = parseStatus(options.status);
  const index = openTicketIndex(project);

  try {
    let tickets = await index.list();
    if (status !== null) {
      tickets = tickets.filter((ticket) => ticket.status === status);
    }
    if (options.assignee !== undefined) {
      tickets = tickets.filter((ticket) => ticket.assignee === options.assignee);
    }

    if (options.json === true) {
      write(JSON.stringify(tickets, null, 2));
      return;
    }

    heading(`Tickets — ${project.config.name}`);
    if (tickets.length === 0) {
      write();
      info('Aucun ticket. `klee ticket create "Titre du ticket"` pour commencer.');
      write();
      return;
    }

    // Regroupé par statut : c'est l'ordre dans lequel on lit un board, pas l'ordre des ids.
    for (const candidate of TICKET_STATUSES) {
      const group = tickets.filter((ticket) => ticket.status === candidate);
      if (group.length === 0) continue;
      write();
      write(`  ${candidate} (${String(group.length)})`);
      for (const ticket of group) {
        ticketRow(ticket);
      }
    }

    write();
    warnAboutBlocked(tickets);
    write();
  } finally {
    index.close();
  }
}

export async function runTicketMove(id: string, statusName: string): Promise<void> {
  const project = await loadProject();
  const status = parseStatus(statusName);
  if (status === null) {
    throw unknownStatus(statusName);
  }

  const ticket = await moveTicket(project.root, id.toUpperCase(), status);

  heading(`Ticket ${ticket.id}`);
  success(`Statut → ${ticket.status}`);
  write();
}

export async function runTicketShow(id: string): Promise<void> {
  const project = await loadProject();
  const index = openTicketIndex(project);

  try {
    const ticket = await index.get(id.toUpperCase());
    if (ticket === null) {
      throw new KeelError(`Ticket introuvable : ${id}.`, {
        code: 'TICKET_NOT_FOUND',
        hint: 'Listez les tickets avec `klee ticket list`.',
      });
    }

    heading(`${ticket.id} — ${ticket.title}`);
    field('Statut', ticket.status);
    field('Assigné', ticket.assignee ?? '—');
    field('Créé', ticket.created);
    field('Modifié', ticket.updated);
    field('Dépend de', ticket.depends_on.join(', ') || '—');
    field('Maquettes', ticket.related_mockups.join(', ') || '—');
    field('Docs', ticket.related_docs.join(', ') || '—');
    field('Auteur', ticket.authored_by);
    field('Fichier', ticket.path);

    write();
    write(ticket.body.trimEnd());
    write();
  } finally {
    index.close();
  }
}

/**
 * Un ticket dont une dépendance n'est pas terminée est bloqué. Le signaler à la lecture évite
 * qu'un agent le prenne en pensant pouvoir avancer (§6).
 */
function warnAboutBlocked(tickets: readonly Ticket[]): void {
  const done = new Set(tickets.filter((ticket) => ticket.status === 'done').map((t) => t.id));
  const blocked = tickets.filter(
    (ticket) =>
      ticket.status !== 'done' && ticket.depends_on.some((dependency) => !done.has(dependency)),
  );

  if (blocked.length > 0) {
    warn(
      `${String(blocked.length)} ticket(s) en attente d'une dépendance : ${blocked
        .map((ticket) => ticket.id)
        .join(', ')}.`,
    );
  }
}

function parseStatus(value: string | undefined): TicketStatus | null {
  if (value === undefined) return null;
  if (!isTicketStatus(value)) throw unknownStatus(value);
  return value;
}

function unknownStatus(value: string): KeelError {
  return new KeelError(`Statut inconnu : "${value}".`, {
    code: 'TICKET_STATUS_UNKNOWN',
    hint: `Statuts disponibles : ${TICKET_STATUSES.join(', ')}.`,
  });
}
