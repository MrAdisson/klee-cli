import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { KleeError } from '../errors.js';
import { formatId } from '../ids.js';
import { parseTicket, serializeTicket, newTicketBody } from './format.js';
import {
  DEFAULT_TICKET_STATUS,
  ticketFileName,
  type Ticket,
  type TicketFrontmatter,
  type TicketStatus,
} from './schema.js';

/**
 * Accès disque aux tickets. Les fichiers markdown sont la source de vérité : toute écriture
 * passe par ici et produit un fichier lisible tel quel, sans base intermédiaire.
 *
 * La lecture, elle, peut être accélérée par un index (cf providers `tickets-index`) — mais un
 * index n'est jamais qu'un cache reconstructible à partir de ces fichiers.
 */

export const TICKETS_DIRNAME = 'tickets';

const TICKET_FILE = /^([A-Z][A-Z0-9]{1,9})-(\d{1,6})(?:-[^/]*)?\.md$/;

export function ticketsDir(root: string): string {
  return join(root, TICKETS_DIRNAME);
}

/** Liste les fichiers de tickets. `AGENTS.md` et consorts sont exclus par la nomenclature. */
export async function listTicketFiles(root: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(ticketsDir(root));
  } catch {
    return [];
  }
  return entries.filter((entry) => TICKET_FILE.test(entry)).sort();
}

export async function readTickets(root: string): Promise<Ticket[]> {
  const files = await listTicketFiles(root);
  const tickets = await Promise.all(
    files.map(async (file) => {
      const contents = await readFile(join(ticketsDir(root), file), 'utf8');
      return parseTicket(`${TICKETS_DIRNAME}/${file}`, contents);
    }),
  );
  return tickets.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export async function readTicket(root: string, id: string): Promise<Ticket | null> {
  const tickets = await readTickets(root);
  return tickets.find((ticket) => ticket.id === id) ?? null;
}

/**
 * Alloue le prochain identifiant : le plus grand numéro existant, plus un.
 *
 * Limite connue et assumée : deux agents qui créent un ticket en parallèle sur deux branches
 * obtiennent le même numéro, et git ne signalera pas de conflit puisque les fichiers diffèrent.
 * Le fichier lui-même est la réservation ; en cas de collision, un ticket se renumérote sans
 * perte. Une réservation plus forte ne se justifiera qu'avec un usage qui la réclame.
 */
export async function nextTicketId(root: string, prefix: string): Promise<string> {
  const files = await listTicketFiles(root);
  let max = 0;
  for (const file of files) {
    const match = TICKET_FILE.exec(file);
    const digits = match?.[2];
    if (match?.[1] === prefix && digits !== undefined) {
      max = Math.max(max, Number.parseInt(digits, 10));
    }
  }
  return formatId(prefix, max + 1);
}

export interface CreateTicketInput {
  readonly root: string;
  readonly prefix: string;
  readonly title: string;
  readonly status?: TicketStatus;
  readonly assignee?: string | null;
  readonly dependsOn?: readonly string[];
  readonly relatedMockups?: readonly string[];
  readonly relatedDocs?: readonly string[];
  readonly authoredBy?: 'human' | 'agent';
  readonly description?: string;
  readonly now?: Date;
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const now = input.now ?? new Date();
  const today = isoDate(now);
  const id = await nextTicketId(input.root, input.prefix);

  const frontmatter: TicketFrontmatter = {
    id,
    title: input.title,
    status: input.status ?? DEFAULT_TICKET_STATUS,
    assignee: input.assignee ?? null,
    created: today,
    updated: today,
    depends_on: [...(input.dependsOn ?? [])],
    related_mockups: [...(input.relatedMockups ?? [])],
    related_docs: [...(input.relatedDocs ?? [])],
    authored_by: input.authoredBy ?? 'human',
  };

  const fileName = ticketFileName(id, input.title);
  const body = newTicketBody(input.description);

  await mkdir(ticketsDir(input.root), { recursive: true });
  await writeFile(
    join(ticketsDir(input.root), fileName),
    serializeTicket(frontmatter, body),
    'utf8',
  );

  return { ...frontmatter, path: `${TICKETS_DIRNAME}/${fileName}`, body, acceptance: '' };
}

/**
 * Change le statut d'un ticket. Le fichier n'est pas renommé : le statut vit dans le
 * frontmatter, pas dans l'arborescence. Déplacer un ticket entre colonnes ne doit pas
 * produire un renommage git à chaque transition.
 */
export async function moveTicket(
  root: string,
  id: string,
  status: TicketStatus,
  now: Date = new Date(),
): Promise<Ticket> {
  const ticket = await readTicket(root, id);
  if (ticket === null) {
    throw new KleeError(`Ticket introuvable : ${id}.`, {
      code: 'TICKET_NOT_FOUND',
      hint: 'Listez les tickets avec `klee ticket list`.',
    });
  }

  const updated: TicketFrontmatter = { ...toFrontmatter(ticket), status, updated: isoDate(now) };
  await writeFile(join(root, ticket.path), serializeTicket(updated, ticket.body), 'utf8');
  return { ...updated, path: ticket.path, body: ticket.body, acceptance: ticket.acceptance };
}

export interface UpdateTicketInput {
  readonly title: string;
  readonly assignee: string | null;
  readonly body: string;
}

export async function updateTicket(
  root: string,
  id: string,
  input: UpdateTicketInput,
  now: Date = new Date(),
): Promise<Ticket> {
  const ticket = await readTicket(root, id);
  if (ticket === null) {
    throw new KleeError(`Ticket introuvable : ${id}.`, { code: 'TICKET_NOT_FOUND' });
  }
  if (input.title.trim() === '') {
    throw new KleeError('Le titre ne peut pas être vide.', { code: 'TICKET_INVALID' });
  }

  const updated: TicketFrontmatter = {
    ...toFrontmatter(ticket),
    title: input.title.trim(),
    assignee: input.assignee,
    updated: isoDate(now),
  };
  const path = await renameTicketFile(root, { ...ticket, ...updated });
  await writeFile(join(root, path), serializeTicket(updated, input.body), 'utf8');
  return parseTicket(path, serializeTicket(updated, input.body));
}

/** Renomme le fichier quand le titre change, pour que le nom reste parlant. */
export async function renameTicketFile(root: string, ticket: Ticket): Promise<string> {
  const expected = `${TICKETS_DIRNAME}/${ticketFileName(ticket.id, ticket.title)}`;
  if (expected === ticket.path) return ticket.path;
  await rename(join(root, ticket.path), join(root, expected));
  return expected;
}

function toFrontmatter(ticket: Ticket): TicketFrontmatter {
  const { path: _path, body: _body, acceptance: _acceptance, ...frontmatter } = ticket;
  return frontmatter;
}

function isoDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}
