import {
  KleeError,
  TICKET_STATUSES,
  buildTraceGraph,
  createTicket,
  isTicketStatus,
  moveTicket,
  neighbours,
  otherEnd,
  type Ticket,
  type TicketStatus,
} from '@klee/core';

import { loadProject, openTicketIndex, type Project } from '../project.js';
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
      throw new KleeError(`Ticket introuvable : ${id}.`, {
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

    await showIncomingLinks(project, ticket);

    write();
    write(ticket.body.trimEnd());
    write();
  } finally {
    index.close();
  }
}

/**
 * Ce qui pointe vers ce ticket sans qu'il le sache : une maquette qui le référence, une doc
 * qui le cite. Le frontmatter du ticket ne peut pas les connaître — c'est tout l'intérêt
 * d'une arête résolue dans les deux sens (ADR 0010).
 */
async function showIncomingLinks(project: Project, ticket: Ticket): Promise<void> {
  const graph = await buildTraceGraph({
    root: project.root,
    ticketPrefix: project.config.idPrefix,
  });

  const declared = new Set([
    ...ticket.depends_on,
    ...ticket.related_mockups,
    ...ticket.related_docs,
  ]);

  const around = neighbours(graph, ticket.id);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));

  const incoming = around.declared
    .map((edge) => otherEnd(edge, ticket.id))
    .filter((id) => !declared.has(id));

  const cited = around.mentions.map((edge) => otherEnd(edge, ticket.id));

  if (incoming.length > 0) {
    field(
      'Référencé par',
      incoming.map((id) => `${id} (${byId.get(id)?.title ?? '?'})`).join(', '),
    );
  }
  if (cited.length > 0) {
    field('Cite', cited.join(', '));
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

function unknownStatus(value: string): KleeError {
  return new KleeError(`Statut inconnu : "${value}".`, {
    code: 'TICKET_STATUS_UNKNOWN',
    hint: `Statuts disponibles : ${TICKET_STATUSES.join(', ')}.`,
  });
}
