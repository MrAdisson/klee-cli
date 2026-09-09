import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  ENTITY_KINDS,
  GRAPH_REPORT_PATH,
  KleeError,
  buildTraceGraph,
  checkTraceGraph,
  hasErrors,
  neighbours,
  otherEnd,
  renderGraphReport,
  type EntityKind,
  type GraphEdge,
  type GraphIssue,
  type GraphNode,
  type TraceGraph,
} from '@klee/core';

import { loadProject, openTicketIndex, type Project } from '../project.js';
import { readFileIfExists } from '../fs.js';
import { field, heading, info, success, warn, write } from '../ui/output.js';

/**
 * `klee links …` — le graphe de traçabilité (TECHNICAL.md §7).
 *
 * C'est la commande qui rend le graphe observable avant que le cockpit de la phase 4 ne le
 * rende cliquable. Elle ne construit aucun état : le graphe est recalculé à chaque appel à
 * partir des fichiers.
 */

const KIND_TITLES: Readonly<Record<EntityKind, string>> = {
  ticket: 'Tickets',
  mockup: 'Maquettes',
  doc: 'Documents',
};

async function graphOf(project: Project): Promise<TraceGraph> {
  // Les tickets passent par l'index configuré ; docs et maquettes n'en ont pas besoin,
  // ce sont des corpus de quelques dizaines de fichiers.
  const index = openTicketIndex(project);
  try {
    return await buildTraceGraph({
      root: project.root,
      ticketPrefix: project.config.idPrefix,
      tickets: await index.list(),
    });
  } finally {
    index.close();
  }
}

export interface LinksListOptions {
  readonly json?: boolean;
}

export async function runLinksList(options: LinksListOptions): Promise<void> {
  const project = await loadProject();
  const graph = await graphOf(project);

  if (options.json === true) {
    write(JSON.stringify(graph, null, 2));
    return;
  }

  heading(`Graphe de traçabilité — ${project.config.name}`);

  if (graph.nodes.length === 0) {
    write();
    info('Aucun artefact identifié. Créez un ticket ou donnez un `id` à une doc.');
    write();
    return;
  }

  for (const kind of ENTITY_KINDS) {
    const nodes = graph.nodes.filter((node) => node.kind === kind);
    if (nodes.length === 0) continue;

    write();
    write(`  ${KIND_TITLES[kind]} (${String(nodes.length)})`);
    for (const node of nodes) {
      const links = neighbours(graph, node.id)
        .declared.map((edge) => otherEnd(edge, node.id))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      write(
        `    ${node.id.padEnd(10)} ${node.title}${links.length === 0 ? '' : `  → ${links.join(', ')}`}`,
      );
    }
  }

  write();
  field('Arêtes', String(graph.edges.length));
  field('Mentions', String(graph.mentions.length));
  reportIssues(checkTraceGraph(graph, project.config.idPrefix), { verbose: false });
  write();
}

export async function runLinksShow(id: string): Promise<void> {
  const project = await loadProject();
  const graph = await graphOf(project);
  const wanted = id.toUpperCase();

  const node = graph.nodes.find((candidate) => candidate.id === wanted);
  if (node === undefined) {
    throw new KleeError(`Aucun artefact ne porte l'identifiant ${wanted}.`, {
      code: 'NODE_NOT_FOUND',
      hint: 'Listez le graphe avec `klee links`.',
    });
  }

  heading(`${node.id} — ${node.title}`);
  field('Nature', KIND_TITLES[node.kind].replace(/s$/, '').toLowerCase());
  field('Fichier', node.path);
  if (node.status !== null) field('Statut', node.status);
  if (node.implementedIn !== null) field('Implémenté', node.implementedIn);

  const around = neighbours(graph, node.id);
  const byId = new Map(graph.nodes.map((candidate) => [candidate.id, candidate]));

  write();
  write('  Liens déclarés');
  if (around.declared.length === 0) {
    info('  aucun.');
  } else {
    for (const edge of around.declared) {
      write(`    ${describeEdge(edge, node.id, byId)}`);
    }
  }

  if (around.mentions.length > 0) {
    write();
    write('  Mentions dans le texte');
    for (const edge of around.mentions) {
      write(`    ${describeEdge(edge, node.id, byId)}`);
    }
  }

  write();
}

export async function runLinksCheck(): Promise<void> {
  const project = await loadProject();
  const graph = await graphOf(project);
  const issues = checkTraceGraph(graph, project.config.idPrefix);

  heading(`Vérification du graphe — ${project.config.name}`);
  write();
  field('Artefacts', String(graph.nodes.length));
  field('Arêtes', String(graph.edges.length));

  if (issues.length === 0) {
    write();
    success('Aucun lien cassé.');
    write();
    return;
  }

  reportIssues(issues, { verbose: true });
  write();

  if (hasErrors(issues)) {
    process.exitCode = 1;
  }
}

export interface LinksReportOptions {
  readonly dryRun?: boolean;
}

/**
 * Écrit la vue markdown du graphe dans `docs/_generated/`. C'est le seul contenu de `docs/`
 * que Klee produit : la distinction *authored* / *générée* de TECHNICAL.md §5 cesse d'être
 * déclarative le jour où le second dossier existe vraiment.
 */
export async function runLinksReport(options: LinksReportOptions): Promise<void> {
  const project = await loadProject();
  const contents = renderGraphReport(await graphOf(project));
  const target = join(project.root, GRAPH_REPORT_PATH);

  heading('Vue générée du graphe');
  write();

  if (options.dryRun === true) {
    field('Cible', GRAPH_REPORT_PATH);
    write();
    write(contents);
    return;
  }

  const existing = await readFileIfExists(target);
  if (existing === contents) {
    field('Cible', GRAPH_REPORT_PATH);
    write();
    info('Inchangé.');
    write();
    return;
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents, 'utf8');

  field('Cible', GRAPH_REPORT_PATH);
  write();
  success(existing === null ? 'Créé.' : 'Mis à jour.');
  write();
}

/**
 * Régénère la vue avant de servir ou de construire le site de docs.
 *
 * Toujours, pas seulement si le fichier manque : un `docs/_generated/` présent mais périmé
 * est pire qu'absent — il affirme un état du graphe que les fichiers ne disent plus.
 */
export async function refreshGraphReport(project: Project): Promise<void> {
  const target = join(project.root, GRAPH_REPORT_PATH);
  const contents = renderGraphReport(await graphOf(project));
  if ((await readFileIfExists(target)) === contents) return;

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents, 'utf8');
  info(`${GRAPH_REPORT_PATH} régénéré.`);
}

function describeEdge(edge: GraphEdge, from: string, byId: ReadonlyMap<string, GraphNode>): string {
  const target = otherEnd(edge, from);
  const title = byId.get(target)?.title ?? '(inexistant)';
  const relation =
    edge.kind === 'depends-on'
      ? edge.from === from
        ? 'dépend de '
        : 'bloque    '
      : edge.kind === 'mention'
        ? 'cite      '
        : 'lié à     ';
  return `${relation} ${target.padEnd(10)} ${title}`;
}

function reportIssues(issues: readonly GraphIssue[], options: { verbose: boolean }): void {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  if (!options.verbose) {
    if (errors.length > 0) {
      warn(`${String(errors.length)} lien(s) cassé(s) — \`klee links check\` pour le détail.`);
    }
    return;
  }

  for (const group of [errors, warnings]) {
    for (const issue of group) {
      write();
      if (issue.severity === 'error') warn(issue.message);
      else info(issue.message);
      info(`  ${issue.sources.join(', ')}`);
    }
  }
}
