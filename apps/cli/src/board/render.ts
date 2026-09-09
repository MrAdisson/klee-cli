import {
  ENTITY_KINDS,
  MOCKUP_STATUSES,
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
  /** Maquettes liées depuis leur propre fichier de métadonnées. */
  readonly mockupsByTicket?: Readonly<Record<string, readonly string[]>>;
  readonly message?: string;
  /** URL du studio quand le board y est intégré ; absent quand il est servi seul. */
  readonly studioUrl?: string;
}

export function renderBoard(view: BoardViewModel): string {
  const done = new Set(view.tickets.filter((t) => t.status === 'done').map((t) => t.id));
  const idLink = makeIdLink(view.studioUrl, view.idPrefix);

  const columns = TICKET_STATUSES.map((status) => {
    const tickets = view.tickets.filter((ticket) => ticket.status === status);
    return `<section class="column" aria-labelledby="col-${status}">
      <h2 id="col-${status}">${STATUS_LABELS[status]} <span class="count">${String(tickets.length)}</span></h2>
      ${tickets.map((ticket) => renderCard(ticket, done, idLink, view.mockupsByTicket?.[ticket.id] ?? [])).join('\n') || '<p class="empty">Rien ici.</p>'}
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
for (const form of document.querySelectorAll('form.mockup-status')) {
  form.addEventListener('submit', () => {
    form.setAttribute('aria-busy', 'true');
    const button = form.querySelector('button');
    if (button !== null) {
      button.disabled = true;
      button.textContent = 'Vérification…';
    }
  });
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
 * - **board seul** : la page du ticket (`/tickets/<id>`), qui porte son contenu *et* son
 *   voisinage ; pour une maquette ou un document, dont le board ne détient pas le contenu,
 *   sa fiche dans le graphe (`/links/<id>`) ;
 * - **board dans le studio** : la même fiche locale, pour que le sens d'un identifiant ne
 *   dépende pas de l'endroit où il est cliqué. Les aperçus réels portent un libellé distinct.
 */
function makeIdLink(studioUrl: string | undefined, idPrefix?: string): IdLinker {
  return (id: string, className = 'chip'): string => {
    const safe = escapeHtml(id);
    const path =
      idPrefix !== undefined && id.startsWith(`${idPrefix}-`)
        ? `/tickets/${encodeURIComponent(id)}`
        : `/links/${encodeURIComponent(id)}`;
    return `<a class="${className}" href="${path}">${safe}</a>`;
  };
}

function renderCard(
  ticket: Ticket,
  done: ReadonlySet<string>,
  idLink: IdLinker,
  reverseMockups: readonly string[],
): string {
  const blockers = ticket.depends_on.filter((id) => !done.has(id));
  const mockups = [...new Set([...ticket.related_mockups, ...reverseMockups])];
  const chips = [...mockups, ...ticket.related_docs].map((id) => idLink(id)).join('');

  return `<article class="card${blockers.length > 0 ? ' card--blocked' : ''}">
    <div class="card__head">
      ${idLink(ticket.id, 'card__id')}
      ${ticket.authored_by === 'agent' ? '<span class="chip chip--agent">agent</span>' : ''}
    </div>
    <p class="card__title"><a class="card__open" href="/tickets/${encodeURIComponent(ticket.id)}">${escapeHtml(ticket.title)}</a></p>
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
  readonly idPrefix: string;
  readonly graph: TraceGraph;
  /** Identifiant demandé. `null` pour la vue d'ensemble. */
  readonly focus: string | null;
  /** URL du studio quand le board y est intégré ; absent quand il est servi seul. */
  readonly studioUrl?: string;
  readonly message?: string;
  readonly messageKind?: 'success' | 'error';
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
  const idLink = makeIdLink(view.studioUrl, view.idPrefix);
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
      : renderNeighbourhood(graph, node, idLink, view.studioUrl);

  const notice =
    view.message === undefined
      ? ''
      : `<p class="flash flash--${view.messageKind ?? 'success'}" role="alert">${escapeHtml(view.message)}</p>`;
  return page(view.projectName, `${notice}${body}`);
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

/**
 * Voisinage d'un nœud : les arêtes déclarées **des deux côtés** et les mentions en texte
 * libre. Déclarer un lien d'un seul côté suffit (ADR 0010), donc lire le frontmatter du
 * ticket ne montrerait que la moitié du graphe.
 */
function edgeRows(graph: TraceGraph, node: GraphNode, idLink: IdLinker): string {
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

  return `<h3>Liens déclarés</h3>
    ${around.declared.length === 0 ? '<p class="empty">Aucun.</p>' : `<ul class="links">${around.declared.map(row).join('')}</ul>`}

    ${around.mentions.length === 0 ? '' : `<h3>Mentions dans le texte</h3><ul class="links">${around.mentions.map(row).join('')}</ul>`}`;
}

/** Le même voisinage, rendu dans la page du ticket plutôt que dans une page séparée. */
function renderTicketLinks(graph: TraceGraph, node: GraphNode, idLink: IdLinker): string {
  return `<section class="ticket__links">${edgeRows(graph, node, idLink)}
    <p class="dim"><a href="/links">Tout le graphe</a></p>
  </section>`;
}

function renderNeighbourhood(
  graph: TraceGraph,
  node: GraphNode,
  idLink: IdLinker,
  studioUrl: string | undefined,
): string {
  return `<section class="new">
    <h2>${escapeHtml(node.id)} — ${escapeHtml(node.title)}</h2>
    <p class="dim">${KIND_LABELS[node.kind]}${node.status === null ? '' : ` · ${escapeHtml(node.status)}`} · <code>${escapeHtml(node.path)}</code></p>
    ${node.implementedIn === null ? '' : `<p class="dim">Implémenté dans <code>${escapeHtml(node.implementedIn)}</code></p>`}

    ${edgeRows(graph, node, idLink)}

    ${node.kind === 'mockup' ? renderMockupStatus(node, studioUrl) : ''}
    ${node.kind === 'doc' ? renderDocPreview(node, studioUrl) : ''}

    <p><a href="/links">Tout le graphe</a> · <a href="/">Retour au board</a></p>
  </section>`;
}

function renderDocPreview(node: GraphNode, studioUrl: string | undefined): string {
  if (studioUrl === undefined) return '';
  return `<p><a href="${escapeHtml(`${studioUrl.replace(/\/$/, '')}/go/${encodeURIComponent(node.id)}`)}" target="_top">Ouvrir le document ↗</a></p>`;
}

function renderMockupStatus(node: GraphNode, studioUrl: string | undefined): string {
  const preview =
    studioUrl === undefined
      ? ''
      : `<p><a href="${escapeHtml(`${studioUrl.replace(/\/$/, '')}/go/${encodeURIComponent(node.id)}`)}" target="_top">Aperçu de la maquette ↗</a></p>`;
  return `<section class="status-edit">
    <h3>Statut de la maquette</h3>
    ${preview}
    <form class="mockup-status" method="post" action="/mockups/${encodeURIComponent(node.id)}/status">
      <label for="mockup-status">Statut</label>
      <select id="mockup-status" name="status">
        ${MOCKUP_STATUSES.map((status) => `<option value="${status}"${status === node.status ? ' selected' : ''}>${status}</option>`).join('')}
      </select>
      <button type="submit">Enregistrer</button>
    </form>
    <p class="dim">Le passage à <code>validated</code> ou <code>implemented</code> lance le gate d’accessibilité.</p>
  </section>`;
}

/** Coquille commune au board et à la vue du graphe : même barre, même feuille de style. */
export interface TicketViewModel {
  readonly projectName: string;
  readonly ticket: Ticket;
  readonly idPrefix: string;
  /** Le graphe, pour montrer le voisinage réel plutôt que le seul frontmatter. */
  readonly graph: TraceGraph;
  readonly studioUrl?: string;
  readonly message?: string;
}

/**
 * Page d'un ticket. Le board savait le créer, le déplacer et montrer son voisinage — pas le
 * lire. Or une description écrite depuis le board devait pouvoir s'y relire, et les critères
 * d'acceptation sont la partie la plus utile d'un ticket (ADR 0008).
 *
 * Sans JavaScript, comme le reste du board : une page, pas un dépliant.
 */
export function renderTicket(view: TicketViewModel): string {
  const idLink = makeIdLink(view.studioUrl, view.idPrefix);
  const { ticket } = view;

  const meta = [
    ['Statut', STATUS_LABELS[ticket.status]],
    ['Assigné', ticket.assignee ?? '—'],
    ['Créé', ticket.created],
    ['Modifié', ticket.updated],
    ['Auteur', ticket.authored_by === 'agent' ? 'agent' : 'humain'],
  ]
    .map(
      ([label, value]) => `<div><dt>${label ?? ''}</dt><dd>${escapeHtml(value ?? '')}</dd></div>`,
    )
    .join('');

  const node = view.graph.nodes.find((candidate) => candidate.id === ticket.id);

  return page(
    view.projectName,
    `<section class="ticket">
  <p class="dim"><a href="/">← Board</a></p>
  <h1><span class="ticket__id">${escapeHtml(ticket.id)}</span> ${escapeHtml(ticket.title)}</h1>

  ${view.message === undefined ? '' : `<p class="flash" role="status">${escapeHtml(view.message)}</p>`}

  <dl class="meta">${meta}</dl>

  <form method="post" action="/tickets/${encodeURIComponent(ticket.id)}/move" data-auto>
    <label for="move">Statut</label>
    <select id="move" name="status">
      ${TICKET_STATUSES.map(
        (status) =>
          `<option value="${status}"${status === ticket.status ? ' selected' : ''}>${STATUS_LABELS[status]}</option>`,
      ).join('')}
    </select>
    <button type="submit">Déplacer</button>
  </form>

  <details class="ticket-edit">
    <summary>Modifier la fiche</summary>
    <form method="post" action="/tickets/${encodeURIComponent(ticket.id)}/edit">
      <label for="edit-title">Titre</label>
      <input id="edit-title" name="title" value="${escapeHtml(ticket.title)}" required maxlength="200">
      <label for="edit-assignee">Assigné (facultatif)</label>
      <input id="edit-assignee" name="assignee" value="${escapeHtml(ticket.assignee ?? '')}">
      <label for="edit-body">Description et critères d’acceptation</label>
      <textarea id="edit-body" name="body" rows="18">${escapeHtml(ticket.body)}</textarea>
      <button type="submit">Enregistrer les modifications</button>
    </form>
  </details>

  <article class="body">${renderTicketBody(ticket.body, idLink)}</article>

  ${node === undefined ? '' : renderTicketLinks(view.graph, node, idLink)}

  <p class="dim">Source : <code>${escapeHtml(ticket.path)}</code></p>
</section>`,
    ticket.id,
  );
}

/**
 * Rendu markdown minimal : titres, paragraphes et blocs de code. Assez pour lire un ticket,
 * et sans dépendance — le board doit démarrer dans n'importe quel projet sans rien installer.
 *
 * Les identifiants ne sont liés **que hors des blocs de code** : un ADR qui illustre le schéma
 * avec `KLEE-123` donne un exemple, il ne référence rien (ADR 0010).
 */
/** Ligne de séparation d'un tableau markdown : `| --- | :---: |`. */
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/;

function renderTicketBody(markdown: string, idLink: IdLinker): string {
  const out: string[] = [];
  let fence: string[] | null = null;
  let paragraph: string[] = [];
  let list: string[] = [];
  let table: string[] = [];

  const flush = (): void => {
    if (paragraph.length === 0) return;
    out.push(`<p>${renderInline(paragraph.join(' '), idLink)}</p>`);
    paragraph = [];
  };

  const flushList = (): void => {
    if (list.length === 0) return;
    out.push(`<ul>${list.map((item) => `<li>${renderInline(item, idLink)}</li>`).join('')}</ul>`);
    list = [];
  };

  const flushTable = (): void => {
    const buffered = table;
    table = [];
    if (buffered.length < 2) return;
    const rows = buffered
      .filter((line) => !TABLE_SEPARATOR.test(line))
      .map((line) =>
        line
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim()),
      );
    const [head, ...body] = rows;
    if (head === undefined) return;
    out.push(
      `<table><thead><tr>${head.map((cell) => `<th>${renderInline(cell, idLink)}</th>`).join('')}</tr></thead>`,
    );
    out.push(
      `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell, idLink)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
    );
    table = [];
  };

  const closeFence = (): void => {
    out.push(`<pre><code>${escapeHtml((fence ?? []).join('\n'))}</code></pre>`);
    fence = null;
  };

  const lines = markdown.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.startsWith('```')) {
      flushList();
      flushTable();
      if (fence === null) {
        flush();
        fence = [];
      } else closeFence();
      continue;
    }
    if (fence !== null) {
      fence.push(line);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading !== null) {
      flush();
      flushList();
      flushTable();
      out.push(`<h2>${renderInline(heading[2] ?? '', idLink)}</h2>`);
      continue;
    }
    const trimmed = line.trim();
    if (trimmed === '') {
      flush();
      flushList();
      flushTable();
    } else if (/^\s*[-*]\s+/.test(line)) {
      flush();
      flushTable();
      list.push(trimmed.replace(/^[-*]\s+/, ''));
    } else if (
      trimmed.includes('|') &&
      // Un tableau ne s'ouvre que si la ligne suivante est sa ligne de séparation : sans ce
      // regard en avant, une phrase contenant un « | » ouvrait un tableau d'une seule ligne,
      // que le vidage jetait ensuite en silence. Une ligne de prose ne doit jamais disparaître.
      (table.length > 0 || TABLE_SEPARATOR.test(lines[index + 1] ?? ''))
    ) {
      flush();
      flushList();
      table.push(trimmed);
    } else {
      flushList();
      flushTable();
      paragraph.push(trimmed);
    }
  }

  flush();
  flushList();
  flushTable();
  // Un bloc jamais refermé : mieux vaut le montrer que perdre la fin du ticket.
  if (fence !== null) closeFence();

  return out.join('\n');
}

const ID_IN_TEXT = /\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b/g;

function linkifyIds(escaped: string, idLink: IdLinker): string {
  return escaped.replace(ID_IN_TEXT, (id) => idLink(id, 'chip'));
}

/**
 * Markdown en ligne : code, emphases et identifiants.
 *
 * Le texte est découpé sur les segments entre accents graves plutôt que remplacé par des
 * jetons : ce qui est du code ne peut alors ni être emphasé, ni voir ses identifiants
 * transformés en liens (ADR 0010), et aucune séquence du ticket ne peut entrer en collision
 * avec un marqueur interne.
 */
function renderInline(value: string, idLink: IdLinker): string {
  return escapeHtml(value)
    .split(/(`[^`]+`)/g)
    .map((segment) =>
      segment.startsWith('`') && segment.endsWith('`') && segment.length > 1
        ? `<code>${segment.slice(1, -1)}</code>`
        : linkifyIds(
            segment
              .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
              .replace(/\*([^*]+)\*/g, '<em>$1</em>'),
            idLink,
          ),
    )
    .join('');
}

function page(projectName: string, body: string, section = 'graphe'): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(projectName)} — ${escapeHtml(section)}</title>
<style>${STYLES}</style>
</head>
<body>
<header class="bar">
  <strong>${escapeHtml(projectName)}</strong>
  <a class="dim" href="/">Board</a>
  <a class="dim" href="/links">Graphe</a>
</header>
${body}
<script>
for (const form of document.querySelectorAll('form.mockup-status')) {
  form.addEventListener('submit', () => {
    form.setAttribute('aria-busy', 'true');
    const button = form.querySelector('button');
    if (button !== null) {
      button.disabled = true;
      button.textContent = 'Vérification…';
    }
  });
}
</script>
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
.flash--error { background: #fef2f2; color: var(--danger); border-color: #b91c1c55; }
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
.card__open { color: inherit; text-decoration: none; }
.card__open:hover { text-decoration: underline; }

.ticket { max-width: 52rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
.ticket h1 { font-size: 1.35rem; line-height: 1.35; margin: 0.4rem 0 1rem; }
.ticket__id { margin-right: 0.4rem; }
.ticket .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 0.6rem 1rem; margin: 0 0 1.4rem; }
.ticket .meta dt { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em;
  color: var(--muted); }
.ticket .meta dd { margin: 0.15rem 0 0; }
.ticket .body { margin-top: 1.6rem; }
.ticket .body h2 { font-size: 1rem; margin: 1.6rem 0 0.5rem; }
.ticket .body p { margin: 0 0 0.8rem; line-height: 1.6; }
.ticket .body pre { background: var(--raised); border: 1px solid var(--border); border-radius: 6px;
  padding: 0.8rem 1rem; overflow-x: auto; }
.ticket .body pre code { font-size: 13px; line-height: 1.5; white-space: pre; }
.ticket-edit { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border); }
.ticket-edit summary { cursor: pointer; font-weight: 600; }
.ticket-edit form { display: grid; gap: 4px; margin-top: 1rem; }
.ticket-edit label { color: var(--muted); font-size: 13px; margin-top: 8px; }
.ticket-edit textarea { resize: vertical; font-family: ui-monospace, SFMono-Regular, monospace; }
.ticket-edit button { justify-self: start; margin-top: 8px; }
.blocked { color: var(--danger); font-size: 13px; margin: 4px 0; }
.chips { margin: 6px 0 0; display: flex; gap: 4px; flex-wrap: wrap; }
.chip { font-size: 11px; padding: 1px 6px; border-radius: 999px;
  background: #f3f4f6; color: var(--muted); }
.chip--agent { background: #eef2ff; color: #3730a3; }
.card form { display: flex; gap: 6px; margin-top: 10px; }
.mockup-status button:disabled { cursor: wait; opacity: .7; }
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
