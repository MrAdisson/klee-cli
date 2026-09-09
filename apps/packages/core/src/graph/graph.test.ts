import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ConfigError } from '../errors.js';
import { buildTraceGraph } from './build.js';
import { checkTraceGraph, hasErrors, neighbours, otherEnd } from './check.js';
import { parseDoc } from './docs.js';
import { mockupTickets, parseMockupMeta } from './mockups.js';
import { renderGraphReport } from './report.js';
import type { TraceGraph } from './schema.js';

const PREFIX = 'KLEE';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'klee-graph-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function write(path: string, contents: string): Promise<void> {
  const absolute = join(root, path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, contents, 'utf8');
}

async function ticket(
  id: string,
  fields: Partial<Record<string, unknown>> = {},
  body = 'Corps.',
): Promise<void> {
  const frontmatter = {
    id,
    title: `Ticket ${id}`,
    status: 'backlog',
    assignee: null,
    created: '2026-09-09',
    updated: '2026-09-09',
    depends_on: [],
    related_mockups: [],
    related_docs: [],
    authored_by: 'human',
    ...fields,
  };

  const yaml = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');
  await write(`tickets/${id}-titre.md`, `---\n${yaml}\n---\n\n${body}\n`);
}

function graphOf(root_: string): Promise<TraceGraph> {
  return buildTraceGraph({ root: root_, ticketPrefix: PREFIX });
}

describe('lecture des documents', () => {
  it('lit le frontmatter et prend le titre du premier titre de niveau 1', () => {
    const doc = parseDoc(
      'docs/technical/x.md',
      '---\nid: DOC-005\nrelated_tickets: [KLEE-001]\n---\n\n# Référence de la CLI\n\nTexte.\n',
    );

    expect(doc?.frontmatter.id).toBe('DOC-005');
    expect(doc?.frontmatter.related_tickets).toEqual(['KLEE-001']);
    expect(doc?.title).toBe('Référence de la CLI');
  });

  it('tolère les champs que pose un générateur de site docs-as-code', () => {
    const doc = parseDoc(
      'docs/technical/x.md',
      '---\nid: DOC-005\nsidebar_position: 3\ntags: [cli]\nslug: /cli\n---\n\n# Titre\n',
    );
    expect(doc?.frontmatter.id).toBe('DOC-005');
  });

  it('accepte un identifiant scalaire là où une liste est attendue', () => {
    const doc = parseDoc('docs/x.md', '---\nid: DOC-005\nrelated_tickets: KLEE-001\n---\n\n# T\n');
    expect(doc?.frontmatter.related_tickets).toEqual(['KLEE-001']);
  });

  it('rend `null` pour un fichier sans frontmatter plutôt que d’échouer', () => {
    expect(parseDoc('docs/libre.md', '# Une page libre\n')).toBeNull();
  });

  it('refuse un frontmatter présent mais faux — quelqu’un a voulu décrire une arête', () => {
    expect(() => parseDoc('docs/x.md', '---\nid: KLEE-001\n---\n\n# T\n')).toThrow(ConfigError);
  });
});

describe('lecture des maquettes', () => {
  it('lit `ticket:` au singulier comme alias de `related_tickets` (ADR 0010)', () => {
    const mockup = parseMockupMeta(
      'mockups/pages/login.meta.yml',
      'id: MOCK-002\ntitle: Connexion\nticket: KLEE-001\nstatus: draft\nimplemented_in: null\n',
    );

    expect(mockupTickets(mockup.meta)).toEqual(['KLEE-001']);
    expect(mockup.document).toBe('mockups/pages/login.html');
  });

  it('ne dédouble pas un ticket déclaré sous les deux formes', () => {
    const mockup = parseMockupMeta(
      'mockups/pages/login.meta.yml',
      'id: MOCK-002\nticket: KLEE-001\nrelated_tickets: [KLEE-001]\n',
    );
    expect(mockupTickets(mockup.meta)).toEqual(['KLEE-001']);
  });
});

describe('construction du graphe', () => {
  it('résout une arête déclarée d’un seul côté, dans les deux sens', async () => {
    await ticket('KLEE-001');
    await write('docs/technical/guide.md', '---\nid: DOC-005\nrelated_tickets: [KLEE-001]\n---\n');

    const graph = await graphOf(root);
    const around = neighbours(graph, 'KLEE-001');

    expect(around.declared).toHaveLength(1);
    expect(otherEnd(around.declared[0]!, 'KLEE-001')).toBe('DOC-005');
    expect(neighbours(graph, 'DOC-005').declared).toHaveLength(1);
  });

  it('ne compte qu’une arête quand les deux extrémités la déclarent', async () => {
    await ticket('KLEE-001', { related_docs: ['DOC-005'] });
    await write('docs/technical/guide.md', '---\nid: DOC-005\nrelated_tickets: [KLEE-001]\n---\n');

    const graph = await graphOf(root);

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]?.sources).toEqual([
      'docs/technical/guide.md',
      'tickets/KLEE-001-titre.md',
    ]);
  });

  it('garde `depends_on` orienté : dépendre n’est pas être dépendu', async () => {
    await ticket('KLEE-001', { depends_on: ['KLEE-002'] });
    await ticket('KLEE-002', { depends_on: ['KLEE-001'] });

    const graph = await graphOf(root);
    expect(graph.edges.filter((edge) => edge.kind === 'depends-on')).toHaveLength(2);
  });

  it('relève les identifiants du texte libre comme mentions, jamais comme arêtes', async () => {
    await ticket('KLEE-001', {}, 'Voir DOC-005 et le ticket KLEE-002.');
    await ticket('KLEE-002');
    await write('docs/technical/guide.md', '---\nid: DOC-005\n---\n');

    const graph = await graphOf(root);

    expect(graph.edges).toHaveLength(0);
    expect(graph.mentions.map((edge) => edge.to).sort()).toEqual(['DOC-005', 'KLEE-002']);
  });

  it('ignore les identifiants du code : un exemple n’est pas une référence', async () => {
    await ticket(
      'KLEE-001',
      {},
      'Le schéma s’illustre par `KLEE-123`.\n\n```\nticket: MOCK-042\n```\n\nMais DOC-005 est cité.',
    );
    await write('docs/technical/guide.md', '---\nid: DOC-005\n---\n\n# Guide\n');

    const graph = await graphOf(root);
    expect(graph.mentions.map((edge) => edge.to)).toEqual(['DOC-005']);
  });

  it('ne mentionne pas ce qui est déjà déclaré', async () => {
    await ticket('KLEE-001', { related_docs: ['DOC-005'] }, 'Voir DOC-005.');
    await write('docs/technical/guide.md', '---\nid: DOC-005\n---\n');

    const graph = await graphOf(root);
    expect(graph.mentions).toHaveLength(0);
  });

  it('ignore AGENTS.md et docs/_generated/ — contexte d’agent et vue du graphe', async () => {
    await write('docs/AGENTS.md', '# Contexte\n\nCite DOC-005.\n');
    await write('docs/_generated/tracabilite.md', '---\nid: DOC-999\n---\n\n# Vue\n');
    await write('docs/technical/guide.md', '---\nid: DOC-005\n---\n');

    const graph = await graphOf(root);
    expect(graph.nodes.map((node) => node.id)).toEqual(['DOC-005']);
    expect(graph.untracked).toEqual([]);
  });

  it('signale une doc sans identifiant sans faire échouer la lecture', async () => {
    await write('docs/technical/libre.md', '# Une page sans frontmatter\n');
    const graph = await graphOf(root);
    expect(graph.untracked).toEqual(['docs/technical/libre.md']);
  });

  it('ne connaît pas un identifiant dont le préfixe n’est pas celui du projet (ADR 0003)', async () => {
    await ticket('KLEE-001', {}, 'Migré depuis ACME-7.');
    const graph = await graphOf(root);
    expect(graph.mentions).toHaveLength(0);
  });
});

describe('vérification', () => {
  it('refuse une arête déclarée qui pointe dans le vide', async () => {
    await ticket('KLEE-001', { related_mockups: ['MOCK-042'] });

    const graph = await graphOf(root);
    const issues = checkTraceGraph(graph, PREFIX);

    expect(issues.map((issue) => issue.code)).toEqual(['DANGLING_EDGE']);
    expect(hasErrors(issues)).toBe(true);
    expect(issues[0]?.sources).toEqual(['tickets/KLEE-001-titre.md']);
  });

  it('avertit sans échouer sur une mention qui pointe dans le vide', async () => {
    await ticket('KLEE-001', {}, 'Voir DOC-404.');

    const issues = checkTraceGraph(await graphOf(root), PREFIX);

    expect(issues.map((issue) => issue.code)).toEqual(['DANGLING_MENTION']);
    expect(hasErrors(issues)).toBe(false);
  });

  it('refuse un identifiant revendiqué par deux fichiers', async () => {
    await write('docs/a.md', '---\nid: DOC-005\n---\n\n# A\n');
    await write('docs/b.md', '---\nid: DOC-005\n---\n\n# B\n');

    const issues = checkTraceGraph(await graphOf(root), PREFIX);

    expect(issues.map((issue) => issue.code)).toEqual(['DUPLICATE_ID']);
    expect(issues[0]?.sources).toEqual(['docs/a.md', 'docs/b.md']);
  });

  it('refuse `depends_on` vers autre chose qu’un ticket', async () => {
    await ticket('KLEE-001', { depends_on: ['MOCK-002'] });
    await write('mockups/pages/login.meta.yml', 'id: MOCK-002\ntitle: Connexion\n');

    const issues = checkTraceGraph(await graphOf(root), PREFIX);
    expect(issues.map((issue) => issue.code)).toEqual(['KIND_MISMATCH']);
  });

  it('refuse un fichier dont l’identifiant ne correspond pas à sa nature', async () => {
    await ticket('MOCK-001');

    const issues = checkTraceGraph(await graphOf(root), PREFIX);
    expect(issues.map((issue) => issue.code)).toContain('KIND_MISMATCH');
  });

  it('ne dit rien d’un graphe sain', async () => {
    await ticket('KLEE-001', { related_docs: ['DOC-005'] });
    await write('docs/technical/guide.md', '---\nid: DOC-005\n---\n\n# Guide\n');

    expect(checkTraceGraph(await graphOf(root), PREFIX)).toEqual([]);
  });
});

describe('rapport généré', () => {
  it('liste chaque nature, ses liens, et ce qui n’en a aucun', async () => {
    await ticket('KLEE-001', { related_docs: ['DOC-005'] });
    await ticket('KLEE-002');
    await write('docs/technical/guide.md', '---\nid: DOC-005\n---\n\n# Guide\n');

    const report = renderGraphReport(await graphOf(root));

    expect(report).toContain('| KLEE-001 | Ticket KLEE-001 | backlog | DOC-005 |');
    expect(report).toContain('## Sans lien déclaré');
    expect(report).toContain('- KLEE-002');
    expect(report).not.toContain('id: DOC-');
  });

  it('ne varie pas d’une exécution à l’autre — aucun horodatage', async () => {
    await ticket('KLEE-001');
    expect(renderGraphReport(await graphOf(root))).toBe(renderGraphReport(await graphOf(root)));
  });
});
