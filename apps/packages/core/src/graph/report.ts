import { ENTITY_KINDS, type EntityKind } from '../ids.js';
import { textContents } from '../scaffold/format.js';
import { neighbours, otherEnd } from './check.js';
import type { GraphNode, TraceGraph } from './schema.js';

/**
 * Rendu du graphe en markdown, pour `docs/_generated/` (TECHNICAL.md §5).
 *
 * C'est le seul contenu de `docs/` que Klee produit lui-même : une *vue* du graphe, pas un
 * document du projet. Il n'a donc pas d'identifiant — s'en donner un le ferait entrer dans
 * le graphe qu'il décrit, et chaque régénération ajouterait ses propres arêtes.
 *
 * Aucune date n'y figure volontairement : un horodatage ferait bouger le fichier à chaque
 * exécution, et un fichier généré qui produit un diff sans qu'aucune source ait changé
 * finit par être régénéré au hasard des commits, puis ignoré.
 */

export const GRAPH_REPORT_PATH = 'docs/_generated/tracabilite.md';

const KIND_TITLES: Readonly<Record<EntityKind, string>> = {
  ticket: 'Tickets',
  mockup: 'Maquettes',
  doc: 'Documents',
};

export function renderGraphReport(graph: TraceGraph): string {
  const sections = ENTITY_KINDS.map((kind) => renderKind(graph, kind)).filter(
    (section) => section !== null,
  );

  return textContents(`---
title: Traçabilité
sidebar_label: Traçabilité
---

# Traçabilité

> Page générée par \`klee links report\`. Ne pas l'éditer : elle est réécrite à chaque
> exécution, et la source de vérité reste les fichiers de \`tickets/\`, \`docs/\` et
> \`mockups/\`.

${graph.nodes.length === 0 ? '_Aucun artefact identifié pour le moment._' : sections.join('\n\n')}
${renderOrphans(graph)}`);
}

function renderKind(graph: TraceGraph, kind: EntityKind): string | null {
  const nodes = graph.nodes.filter((node) => node.kind === kind);
  if (nodes.length === 0) return null;

  const rows = nodes.map((node) => {
    const links = neighbours(graph, node.id)
      .declared.map((edge) => otherEnd(edge, node.id))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return `| ${node.id} | ${escapeCell(node.title)} | ${node.status ?? '—'} | ${
      links.length === 0 ? '—' : links.join(', ')
    } | \`${node.path}\` |`;
  });

  return `## ${KIND_TITLES[kind]}

| Identifiant | Titre | Statut | Liens | Fichier |
| --- | --- | --- | --- | --- |
${rows.join('\n')}`;
}

/**
 * Un artefact sans aucun lien n'est pas fautif — mais c'est exactement ce que le graphe
 * existe pour rendre visible : une maquette que rien ne réclame, une doc que rien ne cite.
 */
function renderOrphans(graph: TraceGraph): string {
  const linked = new Set(graph.edges.flatMap((edge) => [edge.from, edge.to]));
  const orphans = graph.nodes.filter((node) => !linked.has(node.id));
  if (orphans.length === 0) return '';

  return `\n\n## Sans lien déclaré

${orphans.map((node) => `- ${node.id} — ${escapeCell(node.title)}`).join('\n')}`;
}

/** Le pipe est le seul caractère qui casse une cellule de tableau markdown. */
function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

/** Nœuds d'une nature donnée, dans l'ordre du graphe. */
export function nodesOfKind(graph: TraceGraph, kind: EntityKind): GraphNode[] {
  return graph.nodes.filter((node) => node.kind === kind);
}
