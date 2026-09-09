import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  buildTraceGraph,
  indexableText,
  searchDocuments,
  type SearchDocument,
  type SearchHit,
} from '@klee/core';

import type { Project } from '../project.js';

/**
 * Chargement des artefacts pour la recherche transverse (KLEE-006).
 *
 * Les nœuds du graphe donnent déjà l'identifiant, la nature, le titre et le chemin : il ne
 * manque que le texte, lu ici. Repasser par le graphe plutôt que de parcourir les dossiers
 * garantit que la recherche voit exactement ce que `klee links` voit — un artefact invisible
 * du graphe le serait aussi de la recherche, et ce serait alors le graphe qu'il faut corriger.
 */
export async function searchProject(
  project: Project,
  query: string,
): Promise<readonly SearchHit[]> {
  if (query.trim() === '') return [];

  const graph = await buildTraceGraph({
    root: project.root,
    ticketPrefix: project.config.idPrefix,
  });

  const documents = await Promise.all(
    graph.nodes.map(async (node): Promise<SearchDocument> => {
      // Un fichier illisible ne doit pas faire échouer la recherche entière : l'artefact
      // reste trouvable par son identifiant et son titre, qui viennent du graphe.
      const raw = await readFile(join(project.root, node.path), 'utf8').catch(() => '');
      return {
        id: node.id,
        kind: node.kind,
        title: node.title,
        path: node.path,
        // Les clés du frontmatter sont du vocabulaire de format, pas du contenu : les
        // indexer ferait remonter tous les tickets sur « mock ».
        text: indexableText(node.path, raw),
      };
    }),
  );

  return searchDocuments(documents, query);
}
