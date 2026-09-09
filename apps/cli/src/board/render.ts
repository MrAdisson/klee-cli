import { TICKET_STATUSES, type Ticket, type TicketStatus } from '@klee/core';

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
}

export function renderBoard(view: BoardViewModel): string {
  const done = new Set(view.tickets.filter((t) => t.status === 'done').map((t) => t.id));

  const columns = TICKET_STATUSES.map((status) => {
    const tickets = view.tickets.filter((ticket) => ticket.status === status);
    return `<section class="column" aria-labelledby="col-${status}">
      <h2 id="col-${status}">${STATUS_LABELS[status]} <span class="count">${String(tickets.length)}</span></h2>
      ${tickets.map((ticket) => renderCard(ticket, done)).join('\n') || '<p class="empty">Rien ici.</p>'}
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

function renderCard(ticket: Ticket, done: ReadonlySet<string>): string {
  const blockers = ticket.depends_on.filter((id) => !done.has(id));
  const chips = [
    ...ticket.related_mockups.map((id) => `<span class="chip">${escapeHtml(id)}</span>`),
    ...ticket.related_docs.map((id) => `<span class="chip">${escapeHtml(id)}</span>`),
  ].join('');

  return `<article class="card${blockers.length > 0 ? ' card--blocked' : ''}">
    <div class="card__head">
      <code>${escapeHtml(ticket.id)}</code>
      ${ticket.authored_by === 'agent' ? '<span class="chip chip--agent">agent</span>' : ''}
    </div>
    <p class="card__title">${escapeHtml(ticket.title)}</p>
    ${ticket.assignee === null ? '' : `<p class="dim">@${escapeHtml(ticket.assignee)}</p>`}
    ${blockers.length > 0 ? `<p class="blocked">En attente de ${blockers.map(escapeHtml).join(', ')}</p>` : ''}
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
`;
