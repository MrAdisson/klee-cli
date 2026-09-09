import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { buildTraceGraph, type GraphNode } from '@klee/core';

import { openTicketIndex, type Project } from '../project.js';
import { renderStudio, type StudioTab } from './render.js';
import { deepLinkFor, safeInnerPath, type TabId } from './targets.js';

/**
 * Serveur de la coquille du studio (ADR 0014).
 *
 * Il ne sert que deux choses : la page d'onglets, et la résolution des deep links. Tout le
 * contenu vient des serveurs agrégés, sur leur propre origine — c'est ce qui évite d'avoir à
 * les reconfigurer, et donc de les rendre dépendants du studio.
 *
 * Comme le board, il n'a ni état, ni session, ni authentification, et n'écoute que la boucle
 * locale : c'est un outil de poste de travail.
 */

export interface StudioServerOptions {
  readonly project: Project;
  readonly port: number;
  /**
   * Les onglets sont **lus à chaque requête**, pas capturés au démarrage : le serveur ouvre
   * son port d'abord, et les serveurs agrégés le rejoignent ensuite. Écouter en premier
   * permet d'échouer tout de suite sur un port pris, au lieu de le découvrir après avoir
   * démarré Docusaurus — et de le laisser orphelin.
   */
  readonly tabs: () => readonly StudioTab[];
  readonly host?: string;
}

export interface RunningStudio {
  readonly url: string;
  close(): Promise<void>;
}

export function startStudioServer(options: StudioServerOptions): Promise<RunningStudio> {
  const host = options.host ?? '127.0.0.1';

  const server = createServer((request, response) => {
    handle(request, response, options).catch((error: unknown) => {
      respond(response, 500, 'text/plain; charset=utf-8', describe(error));
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, host, () => {
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
  options: StudioServerOptions,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/') {
    renderShell(response, options, url);
    return;
  }

  // `/go/<ID>` — le point d'entrée des liens croisés : un identifiant, et le studio trouve
  // l'onglet et la page. C'est ce qui rend un `MOCK-001` cliquable depuis n'importe où.
  const go = /^\/go\/([^/]+)\/?$/.exec(url.pathname);
  if (request.method === 'GET' && go !== null && go[1] !== undefined) {
    await resolveDeepLink(response, options, decodeURIComponent(go[1]).toUpperCase());
    return;
  }

  respond(response, 404, 'text/plain; charset=utf-8', '404');
}

function renderShell(response: ServerResponse, options: StudioServerOptions, url: URL): void {
  const tabs = options.tabs();
  const requested = url.searchParams.get('tab');
  const active = tabs.find((tab) => tab.id === requested)?.id ?? tabs[0]?.id ?? 'board';

  const html = renderStudio({
    projectName: options.project.config.name,
    tabs,
    active: active as TabId,
    at: safeInnerPath(url.searchParams.get('at')) ?? '/',
    ...(url.searchParams.get('notice') === null
      ? {}
      : { notice: url.searchParams.get('notice') as string }),
  });
  respond(response, 200, 'text/html; charset=utf-8', html);
}

/**
 * Résout un identifiant, puis **vérifie** que la page déduite existe avant d'y envoyer
 * quiconque. Les conventions d'URL de Docusaurus et d'Eleventy ne nous appartiennent pas :
 * les déduire est correct, les supposer justes ne l'est pas.
 */
async function resolveDeepLink(
  response: ServerResponse,
  options: StudioServerOptions,
  id: string,
): Promise<void> {
  const node = await findNode(options.project, id);

  if (node === null) {
    redirect(response, `/?notice=${encodeURIComponent(`${id} n'existe pas dans ce projet.`)}`);
    return;
  }

  const link = deepLinkFor(node);
  const tab = options.tabs().find((candidate) => candidate.id === link?.tab);

  if (link === null || tab === undefined) {
    redirect(response, `/?notice=${encodeURIComponent(`${id} n'a pas d'onglet dans ce projet.`)}`);
    return;
  }

  if (tab.url === null) {
    redirect(
      response,
      `/?tab=${tab.id}&notice=${encodeURIComponent(`${id} vit dans « ${tab.label} », qui n'a pas démarré.`)}`,
    );
    return;
  }

  if (await pageExists(`${tab.url.replace(/\/$/, '')}${link.path}`)) {
    redirect(response, `/?tab=${tab.id}&at=${encodeURIComponent(link.path)}`);
    return;
  }

  redirect(
    response,
    `/?tab=${tab.id}&notice=${encodeURIComponent(`${id} est déclaré, mais ${link.path} ne répond pas — ouverture de l'accueil.`)}`,
  );
}

async function findNode(project: Project, id: string): Promise<GraphNode | null> {
  const index = openTicketIndex(project);
  try {
    const graph = await buildTraceGraph({
      root: project.root,
      ticketPrefix: project.config.idPrefix,
      tickets: await index.list(),
    });
    return graph.nodes.find((node) => node.id === id) ?? null;
  } finally {
    index.close();
  }
}

/** Une requête courte : le serveur est local, et une page absente ne doit pas faire attendre. */
async function pageExists(target: string): Promise<boolean> {
  try {
    const response = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(303, { location });
  response.end();
}

function respond(response: ServerResponse, status: number, type: string, body: string): void {
  response.writeHead(status, { 'content-type': type });
  response.end(body);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
