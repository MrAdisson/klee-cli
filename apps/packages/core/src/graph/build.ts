import { ENTITY_KINDS, extractIds, parseId, type EntityKind } from '../ids.js';
import { readTickets } from '../tickets/store.js';
import type { Ticket } from '../tickets/schema.js';
import { readDocs, type DocFile } from './docs.js';
import { mockupTickets, readMockups, type MockupFile } from './mockups.js';
import type { GraphEdge, GraphNode, TraceGraph } from './schema.js';

/**
 * Construction du graphe de traçabilité (TECHNICAL.md §7).
 *
 * Rien n'est mis en cache et rien n'est écrit : le graphe est recalculé à la lecture, à
 * partir des fichiers qui font foi. C'est la même position que pour l'index de tickets
 * (ADR 0008) — un état dérivé qu'on stocke est un état qu'il faut invalider.
 */

export interface BuildTraceGraphOptions {
  readonly root: string;
  /** Préfixe de tickets du projet : sans lui, `ACME-7` n'est que du texte (ADR 0003). */
  readonly ticketPrefix: string;
  /**
   * Tickets déjà lus, pour ne pas relire ce que l'index configuré vient de fournir.
   * Absent, le graphe les lit lui-même depuis `tickets/`.
   */
  readonly tickets?: readonly Ticket[];
}

export async function buildTraceGraph(options: BuildTraceGraphOptions): Promise<TraceGraph> {
  const [tickets, { docs, untracked }, mockups] = await Promise.all([
    options.tickets === undefined ? readTickets(options.root) : Promise.resolve(options.tickets),
    readDocs(options.root),
    readMockups(options.root),
  ]);

  const nodes = [...ticketNodes(tickets), ...mockupNodes(mockups), ...docNodes(docs)];
  const declared = new EdgeSet();

  for (const ticket of tickets) {
    for (const dependency of ticket.depends_on) {
      declared.add('depends-on', ticket.id, dependency, ticket.path);
    }
    for (const target of [...ticket.related_mockups, ...ticket.related_docs]) {
      declared.add('related', ticket.id, target, ticket.path);
    }
  }

  for (const doc of docs) {
    const { frontmatter } = doc;
    for (const target of [
      ...frontmatter.related_tickets,
      ...frontmatter.related_mockups,
      ...frontmatter.related_docs,
    ]) {
      declared.add('related', frontmatter.id, target, doc.path);
    }
  }

  for (const mockup of mockups) {
    for (const target of [...mockupTickets(mockup.meta), ...mockup.meta.related_docs]) {
      declared.add('related', mockup.meta.id, target, mockup.path);
    }
  }

  const edges = declared.edges();
  const mentions = collectMentions({ tickets, docs, declared, ticketPrefix: options.ticketPrefix });

  return { nodes: sortNodes(nodes), edges, mentions, untracked };
}

/**
 * Une arête `related` déclarée d'un côté vaut des deux : c'est ce qui évite d'exiger que
 * les deux frontmatters se répondent. Exiger la symétrie aurait créé une synchronisation à
 * tenir, soit précisément la dérive que le projet existe pour supprimer (ADR 0010).
 */
class EdgeSet {
  readonly #edges = new Map<string, { edge: GraphEdge; sources: Set<string> }>();

  add(kind: GraphEdge['kind'], from: string, to: string, source: string): void {
    const key = edgeKey(kind, from, to);
    const existing = this.#edges.get(key);
    if (existing !== undefined) {
      existing.sources.add(source);
      return;
    }
    this.#edges.set(key, { edge: { from, to, kind, sources: [] }, sources: new Set([source]) });
  }

  /** Un lien déjà déclaré, dans un sens ou dans l'autre, n'est pas une mention. */
  has(from: string, to: string): boolean {
    return (
      this.#edges.has(edgeKey('related', from, to)) ||
      this.#edges.has(edgeKey('depends-on', from, to)) ||
      this.#edges.has(edgeKey('depends-on', to, from))
    );
  }

  edges(): GraphEdge[] {
    return [...this.#edges.values()]
      .map(({ edge, sources }) => ({ ...edge, sources: [...sources].sort() }))
      .sort(compareEdges);
  }
}

/** `depends-on` est orienté : « A dépend de B » n'est pas « B dépend de A ». */
function edgeKey(kind: GraphEdge['kind'], from: string, to: string): string {
  if (kind === 'depends-on') return `depends-on ${from} ${to}`;
  const [a, b] = from <= to ? [from, to] : [to, from];
  return `${kind} ${a} ${b}`;
}

interface MentionInput {
  readonly tickets: readonly Ticket[];
  readonly docs: readonly DocFile[];
  readonly declared: EdgeSet;
  readonly ticketPrefix: string;
}

/**
 * Identifiants croisés dans du texte libre. Une mention n'est pas un engagement : elle
 * rend le texte cliquable (DESIGN.md §5) et signale un lien qu'on a peut-être oublié de
 * déclarer, sans jamais faire échouer une vérification.
 */
function collectMentions(input: MentionInput): GraphEdge[] {
  const mentions = new EdgeSet();

  const scan = (from: string, text: string, source: string): void => {
    for (const found of extractIds(prose(text), input.ticketPrefix)) {
      if (found.raw === from) continue;
      if (input.declared.has(from, found.raw)) continue;
      mentions.add('mention', from, found.raw, source);
    }
  };

  for (const ticket of input.tickets) scan(ticket.id, ticket.body, ticket.path);
  for (const doc of input.docs) scan(doc.frontmatter.id, doc.body, doc.path);

  return mentions.edges();
}

const FENCE = /^\s*(```|~~~)/;
const INLINE_CODE = /`+[^`\n]*`+/g;

/**
 * Le texte d'un document, débarrassé de son code.
 *
 * Un identifiant écrit dans un bloc de code ou entre backticks est un échantillon, une
 * commande ou un extrait de fichier — pas une référence. Les ADR de ce dépôt en donnent
 * l'exemple : ils illustrent le schéma avec `KLEE-123` et `MOCK-042`, deux identifiants qui
 * n'existent pas et qui n'ont aucune raison d'exister. Les compter produirait un
 * avertissement par exemple pédagogique, et rendrait cliquable ce qui ne mène nulle part.
 */
function prose(markdown: string): string {
  const lines: string[] = [];
  let fence: string | null = null;

  for (const line of markdown.split('\n')) {
    const marker = FENCE.exec(line)?.[1];
    if (fence === null && marker !== undefined) {
      fence = marker;
      continue;
    }
    if (fence !== null) {
      if (marker === fence) fence = null;
      continue;
    }
    lines.push(line.replace(INLINE_CODE, ' '));
  }

  return lines.join('\n');
}

function ticketNodes(tickets: readonly Ticket[]): GraphNode[] {
  return tickets.map((ticket) => ({
    id: ticket.id,
    kind: 'ticket' as const,
    title: ticket.title,
    path: ticket.path,
    status: ticket.status,
    implementedIn: null,
  }));
}

function mockupNodes(mockups: readonly MockupFile[]): GraphNode[] {
  return mockups.map((mockup) => ({
    id: mockup.meta.id,
    kind: 'mockup' as const,
    title: mockup.title,
    path: mockup.path,
    status: mockup.meta.status,
    implementedIn: mockup.meta.implemented_in ?? null,
  }));
}

function docNodes(docs: readonly DocFile[]): GraphNode[] {
  return docs.map((doc) => ({
    id: doc.frontmatter.id,
    kind: 'doc' as const,
    title: doc.title,
    path: doc.path,
    status: null,
    implementedIn: null,
  }));
}

/** Ordre stable : par nature d'entité, puis par numéro. */
function sortNodes(nodes: readonly GraphNode[]): GraphNode[] {
  return [...nodes].sort((a, b) => {
    const byKind = ENTITY_KINDS.indexOf(a.kind) - ENTITY_KINDS.indexOf(b.kind);
    return byKind === 0 ? compareIds(a.id, b.id) : byKind;
  });
}

function compareEdges(a: GraphEdge, b: GraphEdge): number {
  return compareIds(a.from, b.from) || compareIds(a.to, b.to) || a.kind.localeCompare(b.kind);
}

function compareIds(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Nature d'un identifiant, telle que le projet la reconnaît. `null` si ce n'en est pas un. */
export function kindOf(id: string, ticketPrefix: string): EntityKind | null {
  return parseId(id, ticketPrefix)?.kind ?? null;
}
