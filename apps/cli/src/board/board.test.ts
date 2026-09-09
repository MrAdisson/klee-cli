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
import { renderBoard, renderLinks } from './render.js';
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

  it('affiche une maquette liée depuis son propre fichier de métadonnées', async () => {
    const ticket = await createTicket({ root, prefix: 'ACME', title: 'Avec maquette' });
    await mkdir(join(root, 'mockups', 'pages'), { recursive: true });
    await writeFile(
      join(root, 'mockups', 'pages', 'login.meta.yml'),
      `id: MOCK-001\ntitle: Connexion\nstatus: draft\nrelated_tickets: [${ticket.id}]\n`,
      'utf8',
    );

    const html = await (await fetch(`${base}/`)).text();
    expect(html).toContain('href="/links/MOCK-001"');
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
      title: 'Un ticket de démonstration',
      relatedDocs: ['DOC-001'],
    });
    await mkdir(join(root, 'docs', 'technical'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'technical', 'guide.md'),
      '---\nid: DOC-001\n---\n\n# Guide\n',
      'utf8',
    );
  });

  it('rend chaque identifiant d’une carte cliquable, vers ce qui le porte', async () => {
    const html = await (await fetch(`${base}/`)).text();
    // Un ticket a une page qui porte son contenu ; une doc n'en a pas dans le board, et
    // garde sa fiche du graphe.
    expect(html).toContain('href="/tickets/ACME-001"');
    expect(html).toContain('href="/links/DOC-001"');
  });

  it('renvoie /links/<ticket> vers la page du ticket, pour n’en avoir qu’une', async () => {
    await fetch(`${base}/tickets`, form({ title: 'Unique', status: 'backlog' }));
    const response = await fetch(`${base}/links/ACME-001`, { redirect: 'manual' });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/tickets/ACME-001');
  });

  it('affiche le voisinage d’un identifiant, dans les deux sens', async () => {
    const fromTicket = await (await fetch(`${base}/links/ACME-001`)).text();
    expect(fromTicket).toContain('DOC-001');
    expect(fromTicket).toContain('Guide');

    // La doc ne déclare rien : c'est la résolution de l'arête qui la relie au ticket.
    const fromDoc = await (await fetch(`${base}/links/DOC-001`)).text();
    expect(fromDoc).toContain('ACME-001');
    expect(fromDoc).toContain('Un ticket de démonstration');
  });

  it('répond 404 sur un identifiant inconnu, sans planter', async () => {
    const response = await fetch(`${base}/links/DOC-404`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('Aucun artefact');
  });
});

/**
 * Ce que devient un identifiant cliqué dépend de l'endroit d'où on le clique. Servi seul, le
 * board ne sait montrer que sa fiche de graphe ; intégré au studio, il doit envoyer vers
 * l'onglet où l'artefact vit réellement — sinon les liens croisés restent décoratifs.
 */
describe('identifiants cliquables', () => {
  it('reste interne quand le board est servi seul', () => {
    const html = renderBoard({ projectName: 'demo', idPrefix: 'ACME', tickets: [] });
    expect(html).not.toContain('target="_top"');
  });

  it('sort vers le studio quand il y est intégré', () => {
    const html = renderLinks({
      projectName: 'demo',
      idPrefix: 'ACME',
      graph: {
        nodes: [
          {
            id: 'MOCK-002',
            kind: 'mockup',
            title: 'Connexion',
            path: 'mockups/pages/login.meta.yml',
            status: 'draft',
            implementedIn: null,
          },
        ],
        edges: [],
        mentions: [],
        untracked: [],
      },
      focus: null,
      studioUrl: 'http://127.0.0.1:4300/',
    });

    expect(html).toContain('href="/links/MOCK-002"');

    const mockupPage = renderLinks({
      projectName: 'demo',
      idPrefix: 'ACME',
      graph: {
        nodes: [
          {
            id: 'MOCK-002',
            kind: 'mockup',
            title: 'Connexion',
            path: 'mockups/pages/login.meta.yml',
            status: 'draft',
            implementedIn: null,
          },
        ],
        edges: [],
        mentions: [],
        untracked: [],
      },
      focus: 'MOCK-002',
      studioUrl: 'http://127.0.0.1:4300/',
      message:
        'La maquette ne peut pas être validée pour le moment : une image n’a pas de texte alternatif pour décrire son contenu. Corrigez ce point dans la maquette, puis réessayez. Le statut reste « draft ». Détail technique : règle image-alt, cible img.',
      messageKind: 'error',
    });
    expect(mockupPage).toContain('action="/mockups/MOCK-002/status"');
    expect(mockupPage).toContain('value="validated"');
    expect(mockupPage).toContain('class="mockup-status"');
    expect(mockupPage).toContain('Vérification…');
    expect(mockupPage).toContain('Aperçu de la maquette');
    expect(mockupPage).toContain('href="http://127.0.0.1:4300/go/MOCK-002"');
    expect(mockupPage).toContain('class="flash flash--error"');
    expect(mockupPage).toContain('une image n’a pas de texte alternatif');
    expect(mockupPage).toContain('Le statut reste « draft ».');

    const docPage = renderLinks({
      projectName: 'demo',
      idPrefix: 'ACME',
      graph: {
        nodes: [
          {
            id: 'DOC-001',
            kind: 'doc',
            title: 'Guide',
            path: 'docs/technical/guide.md',
            status: null,
            implementedIn: null,
          },
        ],
        edges: [],
        mentions: [],
        untracked: [],
      },
      focus: 'DOC-001',
      studioUrl: 'http://127.0.0.1:4300/',
    });
    expect(docPage).toContain('Ouvrir le document');
    expect(docPage).toContain('href="http://127.0.0.1:4300/go/DOC-001"');
  });
});

describe('page d’un ticket', () => {
  /** Le board savait créer et déplacer un ticket ; il devait aussi savoir le lire (KLEE-009). */
  async function createWithDescription(description: string): Promise<string> {
    const response = await fetch(
      `${base}/tickets`,
      form({ title: 'Ticket lisible', status: 'backlog', description }),
    );
    expect(response.status).toBe(303);
    return `${base}/tickets/ACME-001`;
  }

  it('relit la description écrite depuis le board', async () => {
    const url = await createWithDescription('Une description qui doit revenir.');
    const html = await (await fetch(url)).text();

    expect(html).toContain('Une description qui doit revenir.');
    // Sans JavaScript : le changement de statut reste un formulaire.
    expect(html).toContain('action="/tickets/ACME-001/move"');
  });

  it('édite une fiche depuis sa page détail et relit le fichier', async () => {
    await createWithDescription('Description initiale.');
    const response = await fetch(
      `${base}/tickets/ACME-001/edit`,
      form({
        title: 'Titre corrigé',
        assignee: 'po',
        body: 'Description corrigée.\n\n## Critères d’acceptation\n\nÀ vérifier.',
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      '/tickets/ACME-001?message=Fiche%20mise%20%C3%A0%20jour.',
    );

    const tickets = await readTickets(root);
    expect(tickets[0]?.title).toBe('Titre corrigé');
    expect(tickets[0]?.assignee).toBe('po');
    expect(tickets[0]?.body).toContain('Description corrigée.');
  });

  it('rend les critères d’acceptation en préformaté, indentation comprise', async () => {
    await createWithDescription('Peu importe.');
    const file = join(root, 'tickets', 'ACME-001-ticket-lisible.md');
    await writeFile(
      file,
      `${await readFile(file, 'utf8')}\n## Critères d'acceptation\n\n\`\`\`gherkin\nScénario: lisible\n  Étant donné MOCK-001\n\`\`\`\n`,
      'utf8',
    );

    const html = await (await fetch(`${base}/tickets/ACME-001`)).text();
    expect(html).toContain('<pre><code>');
    expect(html).toContain('  Étant donné MOCK-001');
    // Un identifiant dans un bloc de code est un exemple, pas une arête (ADR 0010).
    expect(html).not.toContain('href="/links/MOCK-001"');
  });

  it('lie les identifiants cités hors des blocs de code', async () => {
    const url = await createWithDescription('Transcrit MOCK-001 fidèlement.');
    const html = await (await fetch(url)).text();
    expect(html).toContain('href="/links/MOCK-001"');
  });

  it('n’affiche aucune section de critères quand le ticket n’en a pas', async () => {
    // Un ticket créé porte toujours le bloc gherkin du gabarit ; le cas visé est celui d'un
    // fichier rédigé à la main, que le format autorise (ADR 0008 : tous ne s'y prêtent pas).
    await createWithDescription('Peu importe.');
    const file = join(root, 'tickets', 'ACME-001-ticket-lisible.md');
    const [, frontmatter = ''] = /^(---\n[\s\S]*?\n---\n)/.exec(await readFile(file, 'utf8')) ?? [];
    await writeFile(file, `${frontmatter}\nUne description seule, sans critères.\n`, 'utf8');

    const html = await (await fetch(`${base}/tickets/ACME-001`)).text();
    expect(html).toContain('Une description seule, sans critères.');
    expect(html).not.toContain('<pre><code>');
  });

  it('mène à la page du ticket depuis sa carte', async () => {
    await createWithDescription('Peu importe.');
    const board = await (await fetch(`${base}/`)).text();
    expect(board).toContain('href="/tickets/ACME-001"');
  });

  it('ne propose pas de valider une maquette depuis la fiche ticket', async () => {
    await createTicket({
      root,
      prefix: 'ACME',
      title: 'Ticket avec maquette',
      relatedMockups: ['MOCK-001'],
    });
    await mkdir(join(root, 'mockups', 'components'), { recursive: true });
    await writeFile(
      join(root, 'mockups', 'components', 'button.meta.yml'),
      'id: MOCK-001\ntitle: Bouton\nstatus: draft\nrelated_tickets: [ACME-001]\n',
      'utf8',
    );

    const html = await (await fetch(`${base}/tickets/ACME-001`)).text();
    expect(html).not.toContain('action="/mockups/MOCK-001/status"');
    expect(html).toContain('href="/links/MOCK-001"');
  });

  it('répond 404 sur un ticket inexistant', async () => {
    expect((await fetch(`${base}/tickets/ACME-404`)).status).toBe(404);
  });
});
