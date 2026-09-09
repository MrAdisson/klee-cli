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
}

export function renderStudio(view: StudioViewModel): string {
  const active = view.tabs.find((tab) => tab.id === view.active);

  const nav = view.tabs
    .map((tab) => {
      const current = tab.id === view.active;
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
<title>${escapeHtml(view.projectName)} — studio</title>
<style>${STYLES}</style>
</head>
<body>
<header class="bar">
  <strong>${escapeHtml(view.projectName)}</strong>
  <nav class="tabs" aria-label="Sections du studio">
      ${nav}
  </nav>
  <span class="spacer"></span>
  ${active?.url === null || active === undefined ? '' : `<a class="ext" href="${escapeHtml(active.url)}" target="_blank" rel="noreferrer">Ouvrir seul ↗</a>`}
</header>

${view.notice === undefined ? '' : `<p class="flash" role="status">${escapeHtml(view.notice)}</p>`}

${renderPanel(active, view.at)}
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
.empty { flex: 1; display: grid; place-content: center; text-align: center; gap: 0.5rem;
  padding: 2rem; max-width: 46rem; margin: 0 auto; }
.empty h1 { font-size: 1.2rem; margin: 0; }
.empty p { color: var(--dim); margin: 0; }
.why { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.85rem;
  color: var(--warn); }
`;
