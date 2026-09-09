import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import {
  buildTraceGraph,
  createTicket,
  isTicketStatus,
  moveTicket,
  MOCKUP_STATUSES,
  updateMockupStatus,
  updateTicket,
  type A11yFinding,
  type TicketStatus,
} from '@klee/core';

import { openTicketIndex, type Project } from '../project.js';
import { renderBoard, renderLinks, renderTicket } from './render.js';
import { checkMockups } from '../commands/mockups-check.js';

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
  /**
   * URL du studio, quand celui-ci sert ce board dans un de ses onglets. Le board rend alors
   * ses identifiants vers `/go/<id>` du studio, pour qu'un clic sur `MOCK-002` montre la
   * maquette et non sa fiche.
   */
  readonly studioUrl?: string;
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

  const links = /^\/links(?:\/([^/]+))?\/?$/.exec(url.pathname);
  if (request.method === 'GET' && links !== null) {
    const focus = links[1] === undefined ? null : decodeURIComponent(links[1]).toUpperCase();
    const message = url.searchParams.get('message') ?? undefined;
    const messageKind: 'success' | 'error' =
      url.searchParams.get('kind') === 'error' ? 'error' : 'success';
    // Un ticket n'a qu'une page : celle qui porte son contenu et son voisinage. Rediriger
    // plutôt que dupliquer évite deux vues du même objet, dont une amputée.
    if (focus !== null && focus.startsWith(`${options.project.config.idPrefix}-`)) {
      response.writeHead(303, { location: `/tickets/${encodeURIComponent(focus)}` }).end();
      return;
    }
    await renderGraphPage(response, options, focus, message, messageKind);
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

  const detail = /^\/tickets\/([^/]+)\/?$/.exec(url.pathname);
  if (request.method === 'GET' && detail !== null && detail[1] !== undefined) {
    await renderTicketPage(
      response,
      options,
      decodeURIComponent(detail[1]).toUpperCase(),
      url.searchParams.get('message') ?? undefined,
    );
    return;
  }

  const edit = /^\/tickets\/([^/]+)\/edit$/.exec(url.pathname);
  if (request.method === 'POST' && edit !== null && edit[1] !== undefined) {
    const form = await readForm(request);
    const id = decodeURIComponent(edit[1]).toUpperCase();
    await updateTicket(options.project.root, id, {
      title: form.get('title') ?? '',
      assignee: (form.get('assignee') ?? '').trim() || null,
      body: form.get('body') ?? '',
    });
    response.writeHead(303, {
      location: `/tickets/${encodeURIComponent(id)}?message=${encodeURIComponent('Fiche mise à jour.')}`,
    });
    response.end();
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

  const mockupStatus = /^\/mockups\/([^/]+)\/status$/.exec(url.pathname);
  if (request.method === 'POST' && mockupStatus !== null && mockupStatus[1] !== undefined) {
    const form = await readForm(request);
    const id = decodeURIComponent(mockupStatus[1]).toUpperCase();
    const status = form.get('status');
    if (!MOCKUP_STATUSES.includes(status as (typeof MOCKUP_STATUSES)[number])) {
      redirectMockup(response, id, 'Statut inconnu : la maquette n’a pas été modifiée.', 'error');
      return;
    }
    const nextStatus = status as (typeof MOCKUP_STATUSES)[number];
    const report = await checkMockups(options.project, { [id]: nextStatus });
    if (report.failed) {
      const finding = report.findings.find((candidate) => candidate.mockupId === id);
      redirectMockup(
        response,
        id,
        `La maquette ne peut pas être validée pour le moment : ${a11yExplanation(finding)} Corrigez ce point dans la maquette, puis réessayez. Le statut reste « draft ».${finding === undefined ? '' : ` Détail technique : règle ${finding.rule}, cible ${finding.target}.`}`,
        'error',
      );
      return;
    }
    await updateMockupStatus(options.project.root, id, nextStatus);
    redirectMockup(response, id, `${id} validée : statut ${nextStatus} enregistré.`, 'success');
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
    const tickets = await index.list();
    const graph = await buildTraceGraph({
      root: options.project.root,
      ticketPrefix: options.project.config.idPrefix,
      tickets,
    });
    const mockupsByTicket: Record<string, string[]> = {};
    for (const edge of graph.edges) {
      const from = graph.nodes.find((node) => node.id === edge.from);
      const to = graph.nodes.find((node) => node.id === edge.to);
      if (from?.kind === 'ticket' && to?.kind === 'mockup') {
        (mockupsByTicket[from.id] ??= []).push(to.id);
      } else if (from?.kind === 'mockup' && to?.kind === 'ticket') {
        (mockupsByTicket[to.id] ??= []).push(from.id);
      }
    }
    const html = renderBoard({
      projectName: options.project.config.name,
      idPrefix: options.project.config.idPrefix,
      tickets,
      mockupsByTicket,
      ...(message === undefined ? {} : { message }),
      ...(options.studioUrl === undefined ? {} : { studioUrl: options.studioUrl }),
    });
    respond(response, 200, 'text/html; charset=utf-8', html);
  } finally {
    index.close();
  }
}

/** Page d'un ticket : sa description et ses critères d'acceptation, lisibles sans terminal. */
async function renderTicketPage(
  response: ServerResponse,
  options: BoardServerOptions,
  id: string,
  message?: string,
): Promise<void> {
  const index = openTicketIndex(options.project);
  try {
    const tickets = await index.list();
    const ticket = tickets.find((candidate) => candidate.id === id);
    if (ticket === undefined) {
      respond(
        response,
        404,
        'text/plain; charset=utf-8',
        `${id} : aucun ticket ne porte cet identifiant.`,
      );
      return;
    }
    respond(
      response,
      200,
      'text/html; charset=utf-8',
      renderTicket({
        projectName: options.project.config.name,
        idPrefix: options.project.config.idPrefix,
        ticket,
        // Le voisinage vient du graphe, pas du frontmatter : une arête déclarée d'en face
        // compte autant (ADR 0010), et le frontmatter seul n'en montrerait que la moitié.
        graph: await buildTraceGraph({
          root: options.project.root,
          ticketPrefix: options.project.config.idPrefix,
          tickets,
        }),
        ...(options.studioUrl === undefined ? {} : { studioUrl: options.studioUrl }),
        ...(message === undefined ? {} : { message }),
      }),
    );
  } finally {
    index.close();
  }
}

/**
 * Vue du graphe. Les tickets passent par l'index configuré, comme le board : le graphe
 * n'introduit pas un second chemin de lecture des mêmes fichiers.
 */
async function renderGraphPage(
  response: ServerResponse,
  options: BoardServerOptions,
  focus: string | null,
  message?: string,
  messageKind: 'success' | 'error' = 'success',
): Promise<void> {
  const index = openTicketIndex(options.project);
  try {
    const graph = await buildTraceGraph({
      root: options.project.root,
      ticketPrefix: options.project.config.idPrefix,
      tickets: await index.list(),
    });
    const html = renderLinks({
      projectName: options.project.config.name,
      idPrefix: options.project.config.idPrefix,
      graph,
      focus,
      ...(message === undefined ? {} : { message, messageKind }),
      ...(options.studioUrl === undefined ? {} : { studioUrl: options.studioUrl }),
    });
    respond(
      response,
      focus !== null && !graph.nodes.some((n) => n.id === focus) ? 404 : 200,
      'text/html; charset=utf-8',
      html,
    );
  } finally {
    index.close();
  }
}

/** Redirection après POST : évite qu'un rafraîchissement rejoue l'action. */
function redirect(response: ServerResponse, message: string): void {
  response.writeHead(303, { location: `/?message=${encodeURIComponent(message)}` });
  response.end();
}

function redirectMockup(
  response: ServerResponse,
  id: string,
  message: string,
  kind: 'success' | 'error',
): void {
  response.writeHead(303, {
    location: `/links/${encodeURIComponent(id)}?kind=${kind}&message=${encodeURIComponent(message)}`,
  });
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

function a11yExplanation(finding: A11yFinding | undefined): string {
  if (finding === undefined) return 'le contrôle d’accessibilité a détecté un problème.';

  const explanations: Readonly<Record<string, string>> = {
    'button-name': 'un bouton n’a pas de nom compréhensible par un lecteur d’écran.',
    'image-alt': 'une image n’a pas de texte alternatif pour décrire son contenu.',
    label: 'un champ de formulaire n’est pas associé à une étiquette lisible.',
  };
  return explanations[finding.rule] ?? `${finding.help}.`;
}
