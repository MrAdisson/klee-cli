import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createProjectConfig,
  createTicket,
  moduleSelectionFromPreset,
  readTickets,
  writeProjectConfig,
} from '@klee/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startBoardServer, type RunningBoard } from './server.js';
import type { Project } from '../project.js';

/** Le board écrit de vrais fichiers markdown : c'est ce que ces tests vérifient. */

let root: string;
let board: RunningBoard;
let base: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'klee-board-'));
  const config = createProjectConfig({
    name: 'demo',
    idPrefix: 'ACME',
    modules: moduleSelectionFromPreset('internal-lib'),
  });
  await writeProjectConfig(root, config);

  const project: Project = { root, config };
  board = await startBoardServer({ project, port: 0 });
  base = board.url.replace(/\/$/, '');
});

afterEach(async () => {
  await board.close();
  await rm(root, { recursive: true, force: true });
});

function form(body: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  };
}

describe('board', () => {
  it('rend une colonne par statut, sans JavaScript', async () => {
    const html = await (await fetch(`${base}/`)).text();

    for (const status of ['backlog', 'ready-for-dev', 'in-progress', 'in-review', 'done']) {
      expect(html).toContain(`id="col-${status}"`);
    }
    // Chaque action est un formulaire : le board reste utilisable JS désactivé.
    expect(html).toContain('<form method="post" action="/tickets">');
  });

  it('crée un ticket depuis le formulaire, sur disque', async () => {
    const response = await fetch(
      `${base}/tickets`,
      form({ title: 'Depuis le navigateur', status: 'ready-for-dev', assignee: 'cedric' }),
    );

    expect(response.status).toBe(303);

    const tickets = await readTickets(root);
    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.title).toBe('Depuis le navigateur');
    expect(tickets[0]?.status).toBe('ready-for-dev');
    expect(tickets[0]?.assignee).toBe('cedric');
  });

  it('refuse un titre vide sans rien écrire', async () => {
    const response = await fetch(`${base}/tickets`, form({ title: '   ' }));

    expect(response.status).toBe(303);
    expect(await readTickets(root)).toHaveLength(0);
  });

  it('déplace un ticket et met à jour le fichier', async () => {
    const ticket = await createTicket({ root, prefix: 'ACME', title: 'À déplacer' });

    const response = await fetch(`${base}/tickets/${ticket.id}/move`, form({ status: 'done' }));
    expect(response.status).toBe(303);

    await expect(readFile(join(root, ticket.path), 'utf8')).resolves.toContain('status: done');
  });

  it('ignore un statut inconnu plutôt que de corrompre le ticket', async () => {
    const ticket = await createTicket({ root, prefix: 'ACME', title: 'Intacte' });

    await fetch(`${base}/tickets/${ticket.id}/move`, form({ status: 'n-importe-quoi' }));

    await expect(readFile(join(root, ticket.path), 'utf8')).resolves.toContain('status: backlog');
  });

  it('échappe le HTML des titres', async () => {
    await fetch(`${base}/tickets`, form({ title: '<script>alert(1)</script>' }));

    const html = await (await fetch(`${base}/`)).text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('expose les tickets en JSON, pour un agent', async () => {
    await createTicket({ root, prefix: 'ACME', title: 'Lisible par une machine' });

    const tickets = (await (await fetch(`${base}/api/tickets`)).json()) as { id: string }[];
    expect(tickets.map((ticket) => ticket.id)).toEqual(['ACME-001']);
  });
});

/**
 * Les liens croisés doivent être cliquables partout où un identifiant apparaît
 * (DESIGN.md §5). Sans terminal, c'est la seule façon de suivre le graphe.
 */
describe('graphe dans le board', () => {
  beforeEach(async () => {
    await createTicket({
      root,
      prefix: 'ACME',
      title: 'Transcrire la maquette',
      relatedDocs: ['DOC-001'],
    });
    await mkdir(join(root, 'docs', 'technical'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'technical', 'guide.md'),
      '---\nid: DOC-001\n---\n\n# Guide\n',
      'utf8',
    );
  });

  it('rend chaque identifiant d’une carte cliquable', async () => {
    const html = await (await fetch(`${base}/`)).text();
    expect(html).toContain('href="/links/ACME-001"');
    expect(html).toContain('href="/links/DOC-001"');
  });

  it('affiche le voisinage d’un identifiant, dans les deux sens', async () => {
    const fromTicket = await (await fetch(`${base}/links/ACME-001`)).text();
    expect(fromTicket).toContain('DOC-001');
    expect(fromTicket).toContain('Guide');

    // La doc ne déclare rien : c'est la résolution de l'arête qui la relie au ticket.
    const fromDoc = await (await fetch(`${base}/links/DOC-001`)).text();
    expect(fromDoc).toContain('ACME-001');
    expect(fromDoc).toContain('Transcrire la maquette');
  });

  it('répond 404 sur un identifiant inconnu, sans planter', async () => {
    const response = await fetch(`${base}/links/DOC-404`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('Aucun artefact');
  });
});
