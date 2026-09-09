import { foldForSearch, type SearchHit } from '@klee/core';

import { escapeHtml } from '../board/render.js';
import type { TabId } from './targets.js';

/**
 * Coquille du studio (TECHNICAL.md §9, DESIGN.md §5).
 *
 * Elle ne rend aucun contenu : chaque onglet est le serveur qui lui appartient, affiché
 * dans un cadre. Ce qui appartient en propre au studio est la barre d'onglets, et plus tard
 * la recherche transverse — c'est-à-dire ce qu'aucun des trois serveurs ne peut porter seul.
 *
 * Comme le board, elle fonctionne **sans JavaScript** : un onglet est un lien, une sélection
 * est un rechargement de page. Un cockpit qui exigerait du JS pour changer d'onglet serait
 * plus fragile sans être plus utile.
 */

export interface StudioTab {
  readonly id: TabId;
  readonly label: string;
  /** URL du serveur de l'onglet, ou `null` s'il n'a pas pu démarrer. */
  readonly url: string | null;
  /** Ce qui a empêché l'onglet de démarrer, à montrer plutôt qu'à taire. */
  readonly failure?: string;
}

export interface StudioViewModel {
  readonly projectName: string;
  readonly tabs: readonly StudioTab[];
  readonly active: TabId;
  /** Chemin ouvert dans l'onglet actif — un deep link, sinon la racine du serveur. */
  readonly at: string;
  readonly notice?: string;
  /** Terme cherché, pour le garder dans le champ après une recherche. */
  readonly query?: string;
}

export function renderStudio(view: StudioViewModel): string {
  const active = view.tabs.find((tab) => tab.id === view.active);

  return shell(
    view.projectName,
    view.tabs,
    '',
    `${view.notice === undefined ? '' : `<p class="flash" role="status">${escapeHtml(view.notice)}</p>`}

${renderPanel(active, view.at)}`,
    { active: view.active, openAlone: active?.url ?? null },
  );
}

/**
 * Coquille commune au cadre et à la page de résultats : mêmes onglets, même champ de
 * recherche. Deux en-têtes différents feraient de la recherche un ailleurs, alors qu'elle est
 * une vue du studio comme les autres.
 */
function shell(
  projectName: string,
  tabs: readonly StudioTab[],
  query: string,
  body: string,
  options: { active?: TabId; openAlone?: string | null } = {},
): string {
  const nav = tabs
    .map((tab) => {
      const current = tab.id === options.active;
      // `aria-current` plutôt qu'un `role="tab"` : ce sont de vrais liens qui rechargent la
      // page, et annoncer un motif d'onglets sans son comportement clavier serait mentir au
      // lecteur d'écran (DESIGN.md §6).
      return `<a class="tab${current ? ' current' : ''}"${current ? ' aria-current="page"' : ''} href="/?tab=${tab.id}">${escapeHtml(tab.label)}${tab.url === null ? ' <span class="down" title="serveur indisponible">hors service</span>' : ''}</a>`;
    })
    .join('\n      ');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(projectName)} — studio</title>
<style>${STYLES}</style>
</head>
<body>
<header class="bar">
  <strong>${escapeHtml(projectName)}</strong>
  <nav class="tabs" aria-label="Sections du studio">
      ${nav}
  </nav>
  <form class="search" method="get" action="/search" role="search">
    <label class="sr-only" for="q">Rechercher dans le projet</label>
    <input id="q" name="q" type="search" placeholder="Rechercher…" value="${escapeHtml(query)}">
    <button type="submit">Chercher</button>
  </form>
  <span class="spacer"></span>
  ${options.openAlone === null || options.openAlone === undefined ? '' : `<a class="ext" href="${escapeHtml(options.openAlone)}" target="_blank" rel="noreferrer">Ouvrir seul ↗</a>`}
</header>

${body}
</body>
</html>
`;
}

function renderPanel(tab: StudioTab | undefined, at: string): string {
  if (tab === undefined) {
    return `<main class="empty"><p>Aucun onglet à afficher pour ce projet.</p></main>`;
  }

  if (tab.url === null) {
    return `<main class="empty">
  <h1>${escapeHtml(tab.label)} n'a pas démarré</h1>
  <p class="why">${escapeHtml(tab.failure ?? 'Raison inconnue.')}</p>
  <p>Les autres onglets restent utilisables : le studio agrège des serveurs indépendants,
  et n'en dépend pas pour fonctionner.</p>
</main>`;
  }

  const source = `${tab.url.replace(/\/$/, '')}${at}`;
  return `<iframe class="panel" src="${escapeHtml(source)}" title="${escapeHtml(tab.label)}"></iframe>`;
}

const STYLES = `
:root {
  color-scheme: light dark;
  --bg: #ffffff; --fg: #1a1a1a; --dim: #6b6b6b; --line: #e2e2e2; --accent: #2b5fd9;
  --bar: #fafafa; --warn: #b3401f;
}
@media (prefers-color-scheme: dark) {
  :root { --bg:#16181c; --fg:#e8e8e8; --dim:#9aa0a6; --line:#2c2f36; --accent:#7ea2ff;
    --bar:#1c1f24; --warn:#ff9270; }
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0; display: flex; flex-direction: column; background: var(--bg); color: var(--fg);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
.bar {
  display: flex; align-items: center; gap: 1rem; padding: 0 1rem; height: 3rem;
  background: var(--bar); border-bottom: 1px solid var(--line); flex: none;
}
.bar strong { font-size: 0.95rem; }
.spacer { flex: 1; }
.tabs { display: flex; gap: 0.25rem; }
.tab {
  color: var(--dim); text-decoration: none; padding: 0.35rem 0.7rem; border-radius: 6px;
  font-size: 0.9rem;
}
.tab:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--fg); }
.tab.current { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--fg); }
.tab:focus-visible, .ext:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.down { color: var(--warn); font-size: 0.75rem; }
.ext { color: var(--dim); font-size: 0.85rem; text-decoration: none; }
.ext:hover { color: var(--fg); text-decoration: underline; }
.flash {
  margin: 0; padding: 0.6rem 1rem; background: color-mix(in srgb, var(--warn) 14%, transparent);
  border-bottom: 1px solid var(--line); font-size: 0.9rem; flex: none;
}
.panel { flex: 1; width: 100%; border: 0; display: block; }
.search { display: flex; gap: 0.35rem; }
.search input {
  font: inherit; font-size: 0.9rem; padding: 0.3rem 0.6rem; border-radius: 6px;
  border: 1px solid var(--line); background: var(--bg); color: var(--fg); min-width: 14rem;
}
.search button {
  font: inherit; font-size: 0.85rem; padding: 0.3rem 0.7rem; border-radius: 6px;
  border: 1px solid var(--line); background: var(--bar); color: var(--fg); cursor: pointer;
}
.search input:focus-visible, .search button:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.results { flex: 1; overflow-y: auto; padding: 1.5rem 1rem 3rem; max-width: 52rem;
  margin: 0 auto; width: 100%; }
.results h1 { font-size: 1.15rem; margin: 0 0 1.2rem; }
.results h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--dim); margin: 1.6rem 0 0.6rem; }
.hit { padding: 0.6rem 0; border-top: 1px solid var(--line); }
.hit a { color: var(--accent); text-decoration: none; font-weight: 500; }
.hit a:hover { text-decoration: underline; }
.hit p { margin: 0.25rem 0 0; color: var(--dim); font-size: 0.9rem; }
.hit mark { background: color-mix(in srgb, var(--accent) 28%, transparent); color: inherit; }
.empty { flex: 1; display: grid; place-content: center; text-align: center; gap: 0.5rem;
  padding: 2rem; max-width: 46rem; margin: 0 auto; }
.empty h1 { font-size: 1.2rem; margin: 0; }
.empty p { color: var(--dim); margin: 0; }
.why { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.85rem;
  color: var(--warn); }
`;

const KIND_LABELS: Readonly<Record<SearchHit['kind'], string>> = {
  ticket: 'Tickets',
  doc: 'Documents',
  mockup: 'Maquettes',
};

export interface SearchViewModel {
  readonly projectName: string;
  readonly tabs: readonly StudioTab[];
  readonly query: string;
  readonly hits: readonly SearchHit[];
}

/**
 * Page de résultats. Chaque résultat mène à `/go/<id>` : le studio y retrouve l'onglet et la
 * page réelle de l'artefact, plutôt qu'une fiche qui le décrirait — c'est la maquette qu'on
 * veut voir, pas sa notice.
 */
export function renderSearch(view: SearchViewModel): string {
  // Les groupes suivent la pertinence, pas un ordre fixe : chercher `MOCK-001` doit montrer
  // la maquette avant les tickets qui la citent, sinon le classement du domaine est perdu
  // au moment de l'affichage.
  const groups = (Object.keys(KIND_LABELS) as SearchHit['kind'][])
    .map((kind) => ({ kind, hits: view.hits.filter((hit) => hit.kind === kind) }))
    .filter((group) => group.hits.length > 0)
    .sort((a, b) => (b.hits[0]?.score ?? 0) - (a.hits[0]?.score ?? 0));

  const body =
    view.query.trim() === ''
      ? '<p class="dim">Entrez un terme pour chercher dans les tickets, les documents et les maquettes.</p>'
      : groups.length === 0
        ? `<p class="dim">Aucun artefact ne contient « ${escapeHtml(view.query)} ». Rien d’autre à en conclure : la recherche a bien eu lieu.</p>`
        : groups
            .map(
              (group) => `<h2>${KIND_LABELS[group.kind]}</h2>
      ${group.hits.map((hit) => renderHit(hit, view.query)).join('\n')}`,
            )
            .join('\n');

  return shell(
    view.projectName,
    view.tabs,
    view.query,
    `<main class="results">
  <h1>${view.query.trim() === '' ? 'Recherche' : `${String(view.hits.length)} résultat(s) pour « ${escapeHtml(view.query)} »`}</h1>
  ${body}
</main>`,
  );
}

function renderHit(hit: SearchHit, query: string): string {
  return `<article class="hit">
    <a href="/go/${encodeURIComponent(hit.id)}">${escapeHtml(hit.id)} — ${escapeHtml(hit.title)}</a>
    ${hit.excerpt === null ? '' : `<p>${highlight(hit.excerpt, query)}</p>`}
    <p class="dim"><code>${escapeHtml(hit.path)}</code></p>
  </article>`;
}

/**
 * Met en évidence le terme dans l'extrait. La comparaison se fait sur le texte replié —
 * accents et casse retirés — mais la découpe porte sur l'original : le repli conserve la
 * longueur, donc les bornes restent valides et l'extrait s'affiche tel qu'il est écrit.
 */
function highlight(excerpt: string, query: string): string {
  const needle = foldForSearch(query.trim());
  if (needle === '') return escapeHtml(excerpt);

  const haystack = foldForSearch(excerpt);
  const out: string[] = [];
  let cursor = 0;

  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, cursor)) {
    out.push(escapeHtml(excerpt.slice(cursor, at)));
    out.push(`<mark>${escapeHtml(excerpt.slice(at, at + needle.length))}</mark>`);
    cursor = at + needle.length;
  }

  out.push(escapeHtml(excerpt.slice(cursor)));
  return out.join('');
}
