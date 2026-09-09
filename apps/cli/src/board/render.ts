import {
  ENTITY_KINDS,
  TICKET_STATUSES,
  neighbours,
  otherEnd,
  type EntityKind,
  type GraphEdge,
  type GraphNode,
  type Ticket,
  type TicketStatus,
  type TraceGraph,
} from '@klee/core';

/**
 * Rendu du board. Volontairement du HTML serveur, sans framework ni étape de build : le
 * dashboard doit pouvoir démarrer dans n'importe quel projet, sans rien installer.
 *
 * Il fonctionne **sans JavaScript** — chaque action est un formulaire. Le JS n'ajoute que le
 * confort (soumission automatique du sélecteur). C'est aussi ce qui le rend accessible au
 * clavier par construction, là où un glisser-déposer aurait exigé un équivalent clavier
 * explicite (DESIGN.md §5, §6).
 */

const STATUS_LABELS: Readonly<Record<TicketStatus, string>> = {
  backlog: 'Backlog',
  'ready-for-dev': 'Prêt pour dev',
  'in-progress': 'En cours',
  'in-review': 'En revue',
  done: 'Terminé',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface BoardViewModel {
  readonly projectName: string;
  readonly idPrefix: string;
  readonly tickets: readonly Ticket[];
  readonly message?: string;
  /** URL du studio quand le board y est intégré ; absent quand il est servi seul. */
  readonly studioUrl?: string;
}

export function renderBoard(view: BoardViewModel): string {
  const done = new Set(view.tickets.filter((t) => t.status === 'done').map((t) => t.id));
  const idLink = makeIdLink(view.studioUrl);

  const columns = TICKET_STATUSES.map((status) => {
    const tickets = view.tickets.filter((ticket) => ticket.status === status);
    return `<section class="column" aria-labelledby="col-${status}">
      <h2 id="col-${status}">${STATUS_LABELS[status]} <span class="count">${String(tickets.length)}</span></h2>
      ${tickets.map((ticket) => renderCard(ticket, done, idLink)).join('\n') || '<p class="empty">Rien ici.</p>'}
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(view.projectName)} — board</title>
<style>${STYLES}</style>
</head>
<body>
<header class="bar">
  <strong>${escapeHtml(view.projectName)}</strong>
  <span class="dim">${String(view.tickets.length)} ticket(s)</span>
  <a class="dim" href="/links">Graphe</a>
  <a class="dim" href="#nouveau">Nouveau ticket</a>
</header>

${view.message === undefined ? '' : `<p class="flash" role="status">${escapeHtml(view.message)}</p>`}

<main class="board">${columns}</main>

<section class="new" id="nouveau">
  <h2>Nouveau ticket</h2>
  <form method="post" action="/tickets">
    <label for="title">Titre</label>
    <input id="title" name="title" required maxlength="200" autocomplete="off">

    <label for="status">Statut</label>
    <select id="status" name="status">
      ${TICKET_STATUSES.map((status) => `<option value="${status}">${STATUS_LABELS[status]}</option>`).join('')}
    </select>

    <label for="assignee">Assigné (facultatif)</label>
    <input id="assignee" name="assignee" autocomplete="off">

    <label for="description">Description (facultatif)</label>
    <textarea id="description" name="description" rows="3"></textarea>

    <button type="submit">Créer le ticket</button>
  </form>
  <p class="dim">Le fichier markdown est écrit dans <code>tickets/</code> : c'est lui la source de vérité.</p>
</section>

<script>
// Confort seul : sans JS, le bouton « Déplacer » reste visible et fonctionne.
for (const form of document.querySelectorAll('form[data-auto]')) {
  form.querySelector('button').hidden = true;
  form.querySelector('select').addEventListener('change', () => { form.submit(); });
}
</script>
</body>
</html>
`;
}

type IdLinker = (id: string, className?: string) => string;

/**
 * Un identifiant est toujours cliquable, partout où il apparaît (DESIGN.md §5). C'est la
 * seule façon qu'a une PM ou une designer de suivre le graphe sans terminal — et donc la
 * condition d'adoption de l'outil hors de l'équipe de développement.
 *
 * Où il mène dépend de l'endroit d'où on clique :
 *
 * - **board seul** : sa fiche dans le graphe (`/links/<id>`), le seul endroit que le board
 *   sache montrer ;
 * - **board dans le studio** : `/go/<id>`, qui ouvre l'onglet où l'artefact vit vraiment.
 *   Cliquer sur `MOCK-002` affiche alors **la maquette**, pas une fiche qui la décrit.
 *
 * `target="_top"` fait sortir du cadre : sans lui, le studio s'afficherait dans son propre
 * onglet Board, en poupées russes.
 */
function makeIdLink(studioUrl: string | undefined): IdLinker {
  return (id: string, className = 'chip'): string => {
    const safe = escapeHtml(id);
    if (studioUrl === undefined) {
      return `<a class="${className}" href="/links/${encodeURIComponent(id)}">${safe}</a>`;
    }
    const target = `${studioUrl.replace(/\/$/, '')}/go/${encodeURIComponent(id)}`;
    return `<a class="${className}" target="_top" href="${escapeHtml(target)}">${safe}</a>`;
  };
}

function renderCard(ticket: Ticket, done: ReadonlySet<string>, idLink: IdLinker): string {
  const blockers = ticket.depends_on.filter((id) => !done.has(id));
  const chips = [...ticket.related_mockups, ...ticket.related_docs]
    .map((id) => idLink(id))
    .join('');

  return `<article class="card${blockers.length > 0 ? ' card--blocked' : ''}">
    <div class="card__head">
      ${idLink(ticket.id, 'card__id')}
      ${ticket.authored_by === 'agent' ? '<span class="chip chip--agent">agent</span>' : ''}
    </div>
    <p class="card__title">${escapeHtml(ticket.title)}</p>
    ${ticket.assignee === null ? '' : `<p class="dim">@${escapeHtml(ticket.assignee)}</p>`}
    ${blockers.length > 0 ? `<p class="blocked">En attente de ${blockers.map((id) => idLink(id, 'blocked__link')).join(', ')}</p>` : ''}
    ${chips === '' ? '' : `<p class="chips">${chips}</p>`}
    <form method="post" action="/tickets/${encodeURIComponent(ticket.id)}/move" data-auto>
      <label class="sr-only" for="move-${ticket.id}">Statut de ${escapeHtml(ticket.id)}</label>
      <select id="move-${ticket.id}" name="status">
        ${TICKET_STATUSES.map(
          (status) =>
            `<option value="${status}"${status === ticket.status ? ' selected' : ''}>${STATUS_LABELS[status]}</option>`,
        ).join('')}
      </select>
      <button type="submit">Déplacer</button>
    </form>
  </article>`;
}

const KIND_LABELS: Readonly<Record<EntityKind, string>> = {
  ticket: 'Ticket',
  mockup: 'Maquette',
  doc: 'Document',
};

export interface LinksViewModel {
  readonly projectName: string;
  readonly graph: TraceGraph;
  /** Identifiant demandé. `null` pour la vue d'ensemble. */
  readonly focus: string | null;
  /** URL du studio quand le board y est intégré ; absent quand il est servi seul. */
  readonly studioUrl?: string;
}

/**
 * Vue du graphe de traçabilité, servie par le board.
 *
 * Elle n'ajoute aucune donnée : elle rend cliquable ce que `klee links` affiche en terminal,
 * pour les profils qui n'en ouvriront jamais un (DESIGN.md §5). Le cockpit unifié de la
 * phase 4 l'absorbera comme il absorbera le board.
 */
export function renderLinks(view: LinksViewModel): string {
  const { graph } = view;
  const idLink = makeIdLink(view.studioUrl);
  const node = view.focus === null ? undefined : graph.nodes.find((n) => n.id === view.focus);

  if (view.focus !== null && node === undefined) {
    return page(
      view.projectName,
      `<section class="new"><h2>${escapeHtml(view.focus)}</h2>
      <p>Aucun artefact ne porte cet identifiant.</p>
      <p class="dim">Un lien déclaré vers un artefact inexistant est signalé par <code>klee links check</code>.</p>
      <p><a href="/links">Voir tout le graphe</a></p></section>`,
    );
  }

  const body =
    node === undefined
      ? renderGraphOverview(graph, idLink)
      : renderNeighbourhood(graph, node, idLink);

  return page(view.projectName, body);
}

function renderGraphOverview(graph: TraceGraph, idLink: IdLinker): string {
  const sections = ENTITY_KINDS.map((kind) => {
    const nodes = graph.nodes.filter((n) => n.kind === kind);
    if (nodes.length === 0) return '';
    return `<section class="column">
      <h2>${KIND_LABELS[kind]}s <span class="count">${String(nodes.length)}</span></h2>
      ${nodes.map((n) => renderNodeCard(graph, n, idLink)).join('')}
    </section>`;
  }).join('');

  return `<main class="board">${sections || '<p class="empty">Aucun artefact identifié.</p>'}</main>`;
}

function renderNodeCard(graph: TraceGraph, node: GraphNode, idLink: IdLinker): string {
  const links = neighbours(graph, node.id)
    .declared.map((edge) => idLink(otherEnd(edge, node.id)))
    .join('');

  return `<article class="card">
    <div class="card__head">${idLink(node.id, 'card__id')}</div>
    <p class="card__title">${escapeHtml(node.title)}</p>
    ${node.status === null ? '' : `<p class="dim">${escapeHtml(node.status)}</p>`}
    ${links === '' ? '' : `<p class="chips">${links}</p>`}
  </article>`;
}

function renderNeighbourhood(graph: TraceGraph, node: GraphNode, idLink: IdLinker): string {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const around = neighbours(graph, node.id);

  const row = (edge: GraphEdge): string => {
    const target = otherEnd(edge, node.id);
    const relation =
      edge.kind === 'depends-on'
        ? edge.from === node.id
          ? 'dépend de'
          : 'bloque'
        : edge.kind === 'mention'
          ? 'cite'
          : 'lié à';
    return `<li><span class="dim">${relation}</span> ${idLink(target)}
      ${escapeHtml(byId.get(target)?.title ?? 'artefact inexistant')}
      <span class="dim">${edge.sources.map(escapeHtml).join(', ')}</span></li>`;
  };

  return `<section class="new">
    <h2>${escapeHtml(node.id)} — ${escapeHtml(node.title)}</h2>
    <p class="dim">${KIND_LABELS[node.kind]}${node.status === null ? '' : ` · ${escapeHtml(node.status)}`} · <code>${escapeHtml(node.path)}</code></p>
    ${node.implementedIn === null ? '' : `<p class="dim">Implémenté dans <code>${escapeHtml(node.implementedIn)}</code></p>`}

    <h3>Liens déclarés</h3>
    ${around.declared.length === 0 ? '<p class="empty">Aucun.</p>' : `<ul class="links">${around.declared.map(row).join('')}</ul>`}

    ${around.mentions.length === 0 ? '' : `<h3>Mentions dans le texte</h3><ul class="links">${around.mentions.map(row).join('')}</ul>`}

    <p><a href="/links">Tout le graphe</a> · <a href="/">Retour au board</a></p>
  </section>`;
}

/** Coquille commune au board et à la vue du graphe : même barre, même feuille de style. */
function page(projectName: string, body: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(projectName)} — graphe</title>
<style>${STYLES}</style>
</head>
<body>
<header class="bar">
  <strong>${escapeHtml(projectName)}</strong>
  <a class="dim" href="/">Board</a>
  <a class="dim" href="/links">Graphe</a>
</header>
${body}
</body>
</html>
`;
}

/**
 * Palette choisie pour respecter WCAG 2.1 AA sur ses paires d'usage. Le board est un produit
 * à part entière, pas un outil interne négligeable (DESIGN.md §5).
 */
const STYLES = `
:root {
  --text: #111827; --muted: #4b5563; --page: #f9fafb; --raised: #ffffff;
  --border: #d1d5db; --focus: #2563eb; --danger: #b91c1c; --accent: #2563eb;
  --radius: 8px; --space: 16px;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--text);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color: var(--accent); }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.dim { color: var(--muted); font-size: 13px; }
.bar { display: flex; gap: var(--space); align-items: center; padding: 12px var(--space);
  background: var(--raised); border-bottom: 1px solid var(--border); position: sticky; top: 0; }
.flash { margin: var(--space); padding: 12px; border-radius: var(--radius);
  background: #f0fdf4; color: #15803d; border: 1px solid #15803d33; }
.board { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space); padding: var(--space); align-items: start; }
.column { background: transparent; }
.column h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em;
  color: var(--muted); margin: 0 0 8px; }
.count { color: var(--muted); font-weight: 400; }
.empty { color: var(--muted); font-size: 13px; }
.card { background: var(--raised); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 12px; margin-bottom: 8px; box-shadow: 0 1px 2px #0f172a14; }
.card--blocked { border-left: 3px solid var(--danger); }
.card__head { display: flex; align-items: center; gap: 8px; }
.card__head code { font-size: 12px; color: var(--muted); }
.card__title { margin: 6px 0; font-weight: 500; }
.blocked { color: var(--danger); font-size: 13px; margin: 4px 0; }
.chips { margin: 6px 0 0; display: flex; gap: 4px; flex-wrap: wrap; }
.chip { font-size: 11px; padding: 1px 6px; border-radius: 999px;
  background: #f3f4f6; color: var(--muted); }
.chip--agent { background: #eef2ff; color: #3730a3; }
.card form { display: flex; gap: 6px; margin-top: 10px; }
select, input, textarea, button { font: inherit; border-radius: 4px;
  border: 1px solid var(--border); padding: 4px 6px; background: var(--raised); color: var(--text); }
.card select { flex: 1; font-size: 13px; }
button { background: var(--accent); color: #fff; border-color: transparent;
  cursor: pointer; font-weight: 500; padding: 5px 10px; }
.new { max-width: 40rem; margin: 0 var(--space) var(--space); padding: var(--space);
  background: var(--raised); border: 1px solid var(--border); border-radius: var(--radius); }
.new h2 { margin-top: 0; font-size: 17px; }
.new form { display: grid; gap: 4px; }
.new label { font-size: 13px; color: var(--muted); margin-top: 8px; }
.new button { margin-top: var(--space); justify-self: start; padding: 8px 16px; }
.new h3 { font-size: 14px; margin: var(--space) 0 4px; }
.card__id { font-size: 12px; color: var(--muted); font-family: ui-monospace, SFMono-Regular, monospace; }
a.chip { text-decoration: none; }
a.chip:hover, .card__id:hover, .blocked__link:hover { text-decoration: underline; }
.blocked__link { color: var(--danger); }
.links { list-style: none; padding: 0; margin: 0; }
.links li { padding: 4px 0; border-bottom: 1px solid var(--border); }
`;
