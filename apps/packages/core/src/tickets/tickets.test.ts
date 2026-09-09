import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ConfigError } from '../errors.js';
import { extractAcceptance, parseTicket, serializeTicket } from './format.js';
import { markdownTicketIndexFactory } from './markdown-index.js';
import { ticketFileName, type TicketFrontmatter } from './schema.js';
import { sqliteTicketIndexFactory } from './sqlite-index.js';
import { createTicket, moveTicket, nextTicketId, readTickets, ticketsDir } from './store.js';

const FIXED_NOW = new Date('2026-09-09T10:00:00.000Z');

const frontmatter: TicketFrontmatter = {
  id: 'KEEL-001',
  title: 'Mettre en place le pipeline',
  status: 'backlog',
  assignee: null,
  created: '2026-09-09',
  updated: '2026-09-09',
  depends_on: [],
  related_mockups: ['MOCK-001'],
  related_docs: [],
  authored_by: 'human',
};

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'keel-tickets-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('format', () => {
  it('fait un aller-retour sans altérer le fichier', () => {
    const body = 'Description.\n\n## Critères\n\n```gherkin\nScénario: x\n```';
    const serialized = serializeTicket(frontmatter, body);
    const parsed = parseTicket('tickets/KEEL-001.md', serialized);

    expect(serializeTicket(parsed, parsed.body)).toBe(serialized);
    expect(parsed.title).toBe(frontmatter.title);
    expect(parsed.related_mockups).toEqual(['MOCK-001']);
  });

  it('extrait les critères d’acceptation des blocs gherkin du corps', () => {
    const body = 'Intro\n\n```gherkin\nScénario: A\n```\n\nsuite\n\n```gherkin\nScénario: B\n```\n';
    expect(extractAcceptance(body)).toBe('Scénario: A\n\nScénario: B');
  });

  it('accepte un ticket sans critères — tous ne s’y prêtent pas', () => {
    const parsed = parseTicket(
      'tickets/KEEL-001.md',
      serializeTicket(frontmatter, 'Juste du texte.'),
    );
    expect(parsed.acceptance).toBe('');
  });

  it('applique les valeurs par défaut d’un frontmatter minimal', () => {
    const minimal = `---
id: KEEL-002
title: Minimal
status: todo-inconnu
created: 2026-09-09
updated: 2026-09-09
---

corps
`;
    expect(() => parseTicket('tickets/KEEL-002.md', minimal)).toThrow(ConfigError);

    const valid = minimal.replace('todo-inconnu', 'backlog');
    const parsed = parseTicket('tickets/KEEL-002.md', valid);
    expect(parsed.assignee).toBeNull();
    expect(parsed.depends_on).toEqual([]);
    expect(parsed.authored_by).toBe('human');
  });

  it('refuse un fichier sans frontmatter', () => {
    expect(() => parseTicket('tickets/x.md', '# Pas un ticket\n')).toThrow(/frontmatter/);
  });
});

describe('ticketFileName', () => {
  it('préfixe par l’identifiant et translittère le titre', () => {
    expect(ticketFileName('KEEL-001', 'Créer le pipeline de tokens')).toBe(
      'KEEL-001-creer-le-pipeline-de-tokens.md',
    );
  });

  it('retombe sur l’identifiant seul quand le titre ne donne aucun slug', () => {
    expect(ticketFileName('KEEL-002', '???')).toBe('KEEL-002.md');
  });
});

describe('store', () => {
  it('alloue des identifiants successifs', async () => {
    expect(await nextTicketId(root, 'KEEL')).toBe('KEEL-001');

    await createTicket({ root, prefix: 'KEEL', title: 'Premier', now: FIXED_NOW });
    expect(await nextTicketId(root, 'KEEL')).toBe('KEEL-002');
  });

  it('ignore les fichiers qui ne sont pas des tickets', async () => {
    await createTicket({ root, prefix: 'KEEL', title: 'Premier', now: FIXED_NOW });
    await writeFile(join(ticketsDir(root), 'AGENTS.md'), '# doc\n', 'utf8');

    const tickets = await readTickets(root);
    expect(tickets).toHaveLength(1);
  });

  it('change le statut sans renommer le fichier', async () => {
    const created = await createTicket({ root, prefix: 'KEEL', title: 'Premier', now: FIXED_NOW });
    const moved = await moveTicket(root, created.id, 'in-progress', FIXED_NOW);

    expect(moved.status).toBe('in-progress');
    expect(moved.path).toBe(created.path);
    await expect(readFile(join(root, created.path), 'utf8')).resolves.toContain(
      'status: in-progress',
    );
  });

  it('échoue explicitement sur un ticket inconnu', async () => {
    await expect(moveTicket(root, 'KEEL-404', 'done', FIXED_NOW)).rejects.toThrow(/introuvable/);
  });

  it('trie les identifiants numériquement, pas alphabétiquement', async () => {
    for (let index = 0; index < 11; index += 1) {
      await createTicket({
        root,
        prefix: 'KEEL',
        title: `Ticket ${String(index)}`,
        now: FIXED_NOW,
      });
    }
    const ids = (await readTickets(root)).map((ticket) => ticket.id);
    expect(ids.at(-1)).toBe('KEEL-011');
  });
});

describe.each([
  ['markdown-only', markdownTicketIndexFactory],
  ['markdown-sqlite', sqliteTicketIndexFactory],
])('index %s', (_id, factory) => {
  it('rend les mêmes tickets que la lecture directe', async () => {
    await createTicket({ root, prefix: 'KEEL', title: 'Premier', now: FIXED_NOW });
    await createTicket({ root, prefix: 'KEEL', title: 'Second', now: FIXED_NOW });

    const index = factory.create(root);
    try {
      expect((await index.list()).map((ticket) => ticket.id)).toEqual(['KEEL-001', 'KEEL-002']);
      expect((await index.get('KEEL-002'))?.title).toBe('Second');
      expect(await index.get('KEEL-404')).toBeNull();
    } finally {
      index.close();
    }
  });

  it('voit une modification faite hors de son dos', async () => {
    const created = await createTicket({ root, prefix: 'KEEL', title: 'Premier', now: FIXED_NOW });

    const index = factory.create(root);
    try {
      expect((await index.get(created.id))?.status).toBe('backlog');

      // Édition à la main, sans passer par Keel : le fichier reste la source de vérité.
      const path = join(root, created.path);
      const contents = await readFile(path, 'utf8');
      await writeFile(path, contents.replace('status: backlog', 'status: done'), 'utf8');

      expect((await index.get(created.id))?.status).toBe('done');
    } finally {
      index.close();
    }
  });

  it('voit une suppression', async () => {
    const created = await createTicket({ root, prefix: 'KEEL', title: 'Premier', now: FIXED_NOW });

    const index = factory.create(root);
    try {
      expect(await index.list()).toHaveLength(1);
      await rm(join(root, created.path));
      expect(await index.list()).toHaveLength(0);
    } finally {
      index.close();
    }
  });
});
