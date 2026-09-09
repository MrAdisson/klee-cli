import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { createTicket, isTicketStatus, moveTicket, type TicketStatus } from '@klee/core';

import { openTicketIndex, type Project } from '../project.js';
import { renderBoard } from './render.js';

/**
 * Dashboard local des tickets (TECHNICAL.md §6, DESIGN.md §5).
 *
 * Écoute uniquement sur la boucle locale : c'est un outil de poste de travail, pas un
 * service. Il n'a ni authentification ni état propre — les fichiers markdown restent la
 * source de vérité, et deux onglets ouverts voient donc toujours la même chose.
 */

export interface BoardServerOptions {
  readonly project: Project;
  readonly port: number;
  readonly host?: string;
}

export interface RunningBoard {
  readonly url: string;
  close(): Promise<void>;
}

const MAX_BODY_BYTES = 64 * 1024;

export function startBoardServer(options: BoardServerOptions): Promise<RunningBoard> {
  const host = options.host ?? '127.0.0.1';

  const server = createServer((request, response) => {
    handle(request, response, options).catch((error: unknown) => {
      respond(response, 500, 'text/plain; charset=utf-8', describe(error));
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, host, () => {
      // Le port demandé peut être 0 (éphémère) : seul le port réellement lié fait foi.
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : options.port;
      resolve({
        url: `http://${host}:${String(port)}/`,
        close: () =>
          new Promise<void>((done, fail) => {
            server.close((error) => {
              if (error) fail(error);
              else done();
            });
          }),
      });
    });
  });
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  options: BoardServerOptions,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/') {
    await renderPage(response, options, url.searchParams.get('message') ?? undefined);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/tickets') {
    const index = openTicketIndex(options.project);
    try {
      respond(response, 200, 'application/json; charset=utf-8', JSON.stringify(await index.list()));
    } finally {
      index.close();
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/tickets') {
    const form = await readForm(request);
    const title = (form.get('title') ?? '').trim();
    if (title === '') {
      redirect(response, 'Titre manquant : ticket non créé.');
      return;
    }

    const assignee = (form.get('assignee') ?? '').trim();
    const description = (form.get('description') ?? '').trim();
    const ticket = await createTicket({
      root: options.project.root,
      prefix: options.project.config.idPrefix,
      title,
      ...(parseStatus(form.get('status')) === null
        ? {}
        : { status: parseStatus(form.get('status')) as TicketStatus }),
      ...(assignee === '' ? {} : { assignee }),
      ...(description === '' ? {} : { description }),
    });

    redirect(response, `${ticket.id} créé.`);
    return;
  }

  const move = /^\/tickets\/([^/]+)\/move$/.exec(url.pathname);
  if (request.method === 'POST' && move !== null && move[1] !== undefined) {
    const form = await readForm(request);
    const status = parseStatus(form.get('status'));
    if (status === null) {
      redirect(response, 'Statut inconnu : rien n’a changé.');
      return;
    }

    const id = decodeURIComponent(move[1]);
    const ticket = await moveTicket(options.project.root, id, status);
    redirect(response, `${ticket.id} → ${ticket.status}.`);
    return;
  }

  respond(response, 404, 'text/plain; charset=utf-8', '404');
}

async function renderPage(
  response: ServerResponse,
  options: BoardServerOptions,
  message: string | undefined,
): Promise<void> {
  const index = openTicketIndex(options.project);
  try {
    const html = renderBoard({
      projectName: options.project.config.name,
      idPrefix: options.project.config.idPrefix,
      tickets: await index.list(),
      ...(message === undefined ? {} : { message }),
    });
    respond(response, 200, 'text/html; charset=utf-8', html);
  } finally {
    index.close();
  }
}

/** Redirection après POST : évite qu'un rafraîchissement rejoue l'action. */
function redirect(response: ServerResponse, message: string): void {
  response.writeHead(303, { location: `/?message=${encodeURIComponent(message)}` });
  response.end();
}

function respond(response: ServerResponse, status: number, type: string, body: string): void {
  response.writeHead(status, { 'content-type': type });
  response.end(body);
}

function parseStatus(value: string | null | undefined): TicketStatus | null {
  return value != null && isTicketStatus(value) ? value : null;
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error('Corps de requête trop volumineux.');
    }
    chunks.push(buffer);
  }

  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
