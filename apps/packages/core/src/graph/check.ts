import { parseId } from '../ids.js';
import type { GraphEdge, GraphNode, TraceGraph } from './schema.js';

/**
 * Vérification du graphe de traçabilité.
 *
 * Ce qui est vérifié ici, ce sont les liens : un identifiant cité existe-t-il, désigne-t-il
 * la bonne nature d'entité, est-il unique. La comparaison d'une maquette `implemented`
 * avec le composant qu'elle référence est un autre sujet — la détection de dérive de la
 * phase 4 (TECHNICAL.md §7) — et n'a pas sa place ici.
 */

export const GRAPH_ISSUE_CODES = [
  'DUPLICATE_ID',
  'DANGLING_EDGE',
  'KIND_MISMATCH',
  'DANGLING_MENTION',
  'DOC_WITHOUT_ID',
] as const;

export type GraphIssueCode = (typeof GRAPH_ISSUE_CODES)[number];

/**
 * Une arête déclarée est un engagement : la voir pointer dans le vide est une erreur.
 * Une mention est une observation faite dans du texte libre : elle avertit, elle ne
 * condamne pas — sinon citer un ticket archivé dans une phrase deviendrait interdit.
 */
export type GraphIssueSeverity = 'error' | 'warning';

export interface GraphIssue {
  readonly code: GraphIssueCode;
  readonly severity: GraphIssueSeverity;
  readonly message: string;
  /** Fichiers concernés, pour aller corriger sans chercher. */
  readonly sources: readonly string[];
}

const KIND_LABELS = {
  ticket: 'ticket',
  mockup: 'maquette',
  doc: 'document',
} as const;

export function checkTraceGraph(graph: TraceGraph, ticketPrefix: string): GraphIssue[] {
  const issues: GraphIssue[] = [
    ...duplicateIds(graph.nodes),
    ...misplacedIds(graph.nodes, ticketPrefix),
  ];

  const known = new Map(graph.nodes.map((node) => [node.id, node]));

  for (const edge of graph.edges) {
    for (const id of [edge.from, edge.to]) {
      if (known.has(id)) continue;
      issues.push({
        code: 'DANGLING_EDGE',
        severity: 'error',
        message: `${edge.from} déclare un lien vers ${edge.to}, qui n'existe pas${
          parseId(id, ticketPrefix) === null
            ? ` (« ${id} » n'est même pas un identifiant de ce projet)`
            : ''
        }.`,
        sources: edge.sources,
      });
    }

    if (edge.kind === 'depends-on') {
      const target = known.get(edge.to);
      if (target !== undefined && target.kind !== 'ticket') {
        issues.push({
          code: 'KIND_MISMATCH',
          severity: 'error',
          message: `${edge.from} dépend de ${edge.to}, qui est ${article(target)}. Un ticket ne dépend que d'un ticket ; un lien d'association s'écrit \`related_mockups\` ou \`related_docs\`.`,
          sources: edge.sources,
        });
      }
    }
  }

  for (const mention of graph.mentions) {
    if (known.has(mention.to)) continue;
    issues.push({
      code: 'DANGLING_MENTION',
      severity: 'warning',
      message: `${mention.from} cite ${mention.to}, qui n'existe pas.`,
      sources: mention.sources,
    });
  }

  for (const path of graph.untracked) {
    issues.push({
      code: 'DOC_WITHOUT_ID',
      severity: 'warning',
      message: `${path} n'a pas d'identifiant : rien ne peut le référencer.`,
      sources: [path],
    });
  }

  return issues;
}

export function hasErrors(issues: readonly GraphIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

/**
 * Deux fichiers qui revendiquent le même identifiant rendent toute arête vers lui
 * ambiguë. C'est le seul défaut du graphe qu'aucune convention de lecture ne rattrape.
 */
function duplicateIds(nodes: readonly GraphNode[]): GraphIssue[] {
  const byId = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const bucket = byId.get(node.id);
    if (bucket === undefined) byId.set(node.id, [node]);
    else bucket.push(node);
  }

  return [...byId.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([id, group]) => ({
      code: 'DUPLICATE_ID' as const,
      severity: 'error' as const,
      message: `${id} est revendiqué par ${String(group.length)} fichiers.`,
      sources: group.map((node) => node.path).sort(),
    }));
}

/** Un ticket qui s'appelle `MOCK-001`, ou une doc rangée sous un préfixe de ticket. */
function misplacedIds(nodes: readonly GraphNode[], ticketPrefix: string): GraphIssue[] {
  return nodes
    .filter((node) => parseId(node.id, ticketPrefix)?.kind !== node.kind)
    .map((node) => ({
      code: 'KIND_MISMATCH' as const,
      severity: 'error' as const,
      message: `${node.path} porte l'identifiant ${node.id}, qui ne désigne pas ${article(node)} dans ce projet.`,
      sources: [node.path],
    }));
}

function article(node: Pick<GraphNode, 'kind'>): string {
  return node.kind === 'mockup' ? 'une maquette' : `un ${KIND_LABELS[node.kind]}`;
}

/** Voisins d'un identifiant, arêtes déclarées et mentions confondues, dans les deux sens. */
export function neighbours(
  graph: TraceGraph,
  id: string,
): { declared: GraphEdge[]; mentions: GraphEdge[] } {
  const touches = (edge: GraphEdge): boolean => edge.from === id || edge.to === id;
  return {
    declared: graph.edges.filter(touches),
    mentions: graph.mentions.filter(touches),
  };
}

/** L'autre extrémité d'une arête, vue depuis `id`. */
export function otherEnd(edge: GraphEdge, id: string): string {
  return edge.from === id ? edge.to : edge.from;
}
