import { jsonContents, textContents } from '../scaffold/format.js';
import type { ScaffoldContext, ScaffoldDependency, ScaffoldFile } from '../scaffold/types.js';
import type { Provider } from './types.js';

/**
 * Composition des mockups (TECHNICAL.md §4, DESIGN.md §3).
 *
 * Règle non négociable, quel que soit le provider : **aucun copier-coller de markup entre
 * pages**. Une page inclut un composant, elle ne le réécrit jamais — c'est exactement le
 * mécanisme de dérive que le projet cherche à éliminer.
 *
 * Le provider fournit donc à la fois le mécanisme d'inclusion, le serveur local, et un
 * composant + une page d'exemple qui démontrent l'un et l'autre.
 */

const ELEVENTY_VERSION = '^3.1.6';
const YAML_VERSION = '^2.9.0';
const MANIFEST_PATH = 'mockups/package.json';

const BASE_CSS = textContents(`/*
 * Feuille de style des maquettes. Aucune valeur brute : tout passe par les tokens générés
 * dans design-system/dist/css/tokens.css. Une couleur en dur ici est un bug.
 */

body {
  margin: 0;
  background: var(--color-surface-page);
  color: var(--color-text-primary);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-md);
}

.mockup-bar {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border-default);
  font-size: var(--font-size-sm);
}

.mockup-bar__id {
  margin-left: auto;
  font-family: var(--font-family-mono);
  color: var(--color-text-muted);
}

.mockup-main {
  padding: var(--space-xl);
  max-width: 60rem;
  margin: 0 auto;
}

h1 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
}

h2 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
}

/* --- Bouton ------------------------------------------------------------- */

.btn {
  font: inherit;
  font-weight: var(--font-weight-medium);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.btn:focus-visible {
  /* L'anneau de focus ne se supprime jamais : navigation clavier, WCAG 2.1 AA. */
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

.btn--primary {
  background: var(--color-primary-default);
  color: var(--color-text-inverse);
}

.btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn--primary:active:not(:disabled) {
  background: var(--color-primary-active);
}

.btn--secondary {
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  border-color: var(--color-border-default);
}

.btn:disabled {
  background: var(--color-primary-disabled);
  color: var(--color-text-inverse);
  cursor: not-allowed;
  box-shadow: none;
}

/* Un bouton en attente reste actif : WCAG s'y applique, contrairement à un bouton
   désactivé. L'atténuer en opacité ferait tomber le contraste sous AA — l'attente se
   signale donc par le curseur et une teinte plus soutenue, jamais en délavant le texte. */
.btn[aria-busy='true'] {
  cursor: progress;
}

.btn--primary[aria-busy='true'] {
  background: var(--color-primary-active);
}

/* --- Catalogue ---------------------------------------------------------- */

.catalogue {
  list-style: none;
  padding: 0;
  display: grid;
  gap: var(--space-md);
}

.catalogue li {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.states {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
  padding: 0;
  margin: var(--space-sm) 0 0;
  list-style: none;
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.demo-row {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: var(--space-lg);
}

/* --- Formulaire --------------------------------------------------------- */

.field {
  display: grid;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.field input {
  font: inherit;
  padding: var(--space-sm);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}

.field input:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 1px;
}
`);

function mockupsManifest(
  context: ScaffoldContext,
  origin: string,
  scripts: Record<string, string>,
): ScaffoldFile {
  return {
    path: MANIFEST_PATH,
    origin,
    contents: jsonContents({
      name: `@${context.config.name}/mockups`,
      version: '0.0.0',
      private: true,
      type: 'module',
      scripts,
    }),
  };
}

/**
 * Métadonnées de traçabilité communes aux deux providers (TECHNICAL.md §7).
 *
 * Le vocabulaire d'arête est celui des tickets et des docs — `related_tickets`,
 * `related_docs` — et non le `ticket:` scalaire de §4 : trois formats pour la même notion
 * obligeaient chaque lecteur du graphe à porter un cas particulier par type de fichier
 * (ADR 0010). L'ancienne forme reste lue, pour les projets scaffoldés avant ce changement.
 */
function metaYml(options: {
  readonly id: string;
  readonly title: string;
  readonly states?: readonly string[];
}): string {
  // `related_tickets` part **vide** : une maquette d'exemple n'est liée à aucun travail
  // décidé. La remplir d'office fabriquerait une arête que personne n'a voulue, et ferait
  // croire à un engagement là où il n'y a qu'un gabarit.
  return textContents(`id: ${options.id}
title: ${options.title}
status: draft
related_tickets: []
related_docs: []
implemented_in: null
${options.states === undefined ? '' : `states:\n${options.states.map((state) => `  - ${state}`).join('\n')}`}`);
}

const eleventy: Provider = {
  id: 'eleventy',
  // Eleventy, lui, glisse silencieusement sur le port suivant : plus insidieux encore, car
  // on croit alors regarder son propre serveur.
  devServer: { script: 'dev', portFlag: '--port', defaultPort: 8080 },
  point: 'mockups-composition',
  label: 'Eleventy',
  description:
    'Défaut. Includes résolus au build/serve, sortie HTML/CSS pur, rechargement à chaud.',
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'provider:mockups-composition/eleventy';

    return [
      mockupsManifest(context, origin, {
        dev: 'eleventy --serve',
        build: 'eleventy',
      }),
      {
        path: 'mockups/eleventy.config.mjs',
        origin,
        contents: textContents(`import { parse } from 'yaml';

/**
 * Serveur de navigation des maquettes. Généré par \`klee init\`.
 *
 * Deux responsabilités : résoudre les includes de composants (pour qu'aucune page ne
 * duplique du markup) et exposer les tokens générés, pour qu'une maquette ne puisse pas
 * écrire une valeur en dur même par accident.
 */
export default function (eleventyConfig) {
  // Les \`.meta.yml\` alimentent le catalogue : ils sont lus comme données, pas publiés.
  eleventyConfig.addDataExtension('yml', (contents) => parse(contents));

  // Sens de la dépendance imposé (§3) : mockups/ consomme design-system/dist/, jamais l'inverse.
  eleventyConfig.addPassthroughCopy({
    '../design-system/dist/css': 'design-system/css',
  });

  // Eleventy ne publie que ce qu'il sait *rendre* : une feuille de style n'est pas un
  // template, elle doit être copiée explicitement. Sans ces lignes, les pages sortent sans
  // style et le navigateur reçoit un 404 sur /base.css.
  // Ajoutez ici tout nouveau type d'asset (polices, images) au fil des maquettes.
  eleventyConfig.addPassthroughCopy('base.css');
  eleventyConfig.addPassthroughCopy('components/**/*.{css,js,svg,png,jpg,jpeg,webp,avif,woff2}');
  eleventyConfig.addPassthroughCopy('pages/**/*.{css,js,svg,png,jpg,jpeg,webp,avif,woff2}');

  eleventyConfig.setServerOptions({ showAllHosts: false });

  return {
    dir: {
      input: '.',
      includes: '_includes',
      data: '_data',
      output: 'dist',
    },
    // Eleventy rend le .html en Liquid par défaut ; les includes de composants sont écrits
    // en Nunjucks, plus adapté au passage de variables à un partiel.
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
    pathPrefix: '/',
  };
}
`),
      },
      {
        path: 'mockups/.eleventyignore',
        origin,
        contents: textContents(`node_modules
dist
README.md
AGENTS.md`),
      },
      {
        path: 'mockups/_data/catalogue.mjs',
        origin,
        contents: textContents(`import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';

/**
 * Catalogue auto-généré : la liste des composants et de leurs états déclarés
 * est dérivée des \`.meta.yml\`, jamais maintenue à la main. Une liste écrite à la main finit
 * toujours par mentir sur le contenu réel du dossier.
 */
export default async function catalogue() {
  const root = new URL('../components/', import.meta.url).pathname;
  const entries = await readdir(root, { withFileTypes: true });
  const components = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = join(root, entry.name, \`\${entry.name}.meta.yml\`);
    try {
      const meta = parse(await readFile(metaPath, 'utf8'));
      components.push({ ...meta, slug: entry.name, url: \`/components/\${entry.name}/\` });
    } catch {
      // Un composant sans .meta.yml est invisible du graphe de traçabilité : on le signale
      // dans le catalogue plutôt que de le masquer.
      components.push({ slug: entry.name, url: \`/components/\${entry.name}/\`, missingMeta: true });
    }
  }

  return components.sort((a, b) => a.slug.localeCompare(b.slug));
}
`),
      },
      {
        path: 'mockups/_includes/layout.njk',
        origin,
        contents: textContents(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{ title }}</title>
    <link rel="stylesheet" href="/design-system/css/tokens.css" />
    <link rel="stylesheet" href="/base.css" />
  </head>
  <body>
    <header class="mockup-bar">
      <a href="/">Catalogue</a>
      <a href="/pages/login/">Connexion</a>
      {% if id %}<span class="mockup-bar__id">{{ id }}</span>{% endif %}
    </header>
    <main class="mockup-main">{{ content | safe }}</main>
  </body>
</html>
`),
      },
      {
        path: 'mockups/_includes/components/button.njk',
        origin,
        contents: textContents(`{#
  Composant Bouton — source unique du markup.

  Écrit comme une macro et non comme un simple include : la portée est isolée et les
  paramètres sont explicites. Un include qui lit des variables posées par la page laisse
  l'état d'un appel contaminer le suivant — un piège pour qui édite la maquette.
#}
{% macro button(label, variant='primary', type='button', disabled=false, loading=false) %}
<button
  type="{{ type }}"
  class="btn btn--{{ variant }}"
  {% if disabled %}disabled{% endif %}
  {% if loading %}aria-busy="true"{% endif %}
>
  {{ label }}
</button>
{% endmacro %}
`),
      },
      { path: 'mockups/base.css', origin, contents: BASE_CSS },
      {
        path: 'mockups/index.html',
        origin,
        contents: textContents(`---
layout: layout.njk
title: Catalogue des composants
---

<h1>Catalogue des composants</h1>

<p>
  Cette page est générée à partir des fichiers <code>.meta.yml</code> — elle n'est jamais
  maintenue à la main, pour ne pas désynchroniser la liste de la réalité des fichiers.
</p>

<ul class="catalogue">
  {% for component in catalogue %}
    <li>
      <a href="{{ component.url }}"><strong>{{ component.title or component.slug }}</strong></a>
      {% if component.missingMeta %}
        <p>⚠ Aucun <code>.meta.yml</code> : ce composant est invisible du graphe de traçabilité.</p>
      {% else %}
        <p>{{ component.id }} · statut <code>{{ component.status }}</code> · ticket {{ component.ticket }}</p>
        <ul class="states">
          {% for state in component.states %}<li>{{ state }}</li>{% endfor %}
        </ul>
      {% endif %}
    </li>
  {% endfor %}
</ul>
`),
      },
      {
        path: 'mockups/components/button/button.html',
        origin,
        contents: textContents(`---
layout: layout.njk
title: Bouton
id: MOCK-001
---

<h1>Bouton</h1>

{% from "components/button.njk" import button %}

<p>
  Chaque état est maquetté : un état non maquetté est un état qui sera improvisé en
  implémentation. Le markup vient d'une macro unique — cette page ne le réécrit pas.
</p>

<h2>default</h2>
<div class="demo-row">
  {{ button('Valider') }}
  {{ button('Secondaire', variant='secondary') }}
</div>

<h2>hover · active</h2>
<div class="demo-row">
  {{ button('Survolez-moi') }}
  <span>Survol et enfoncement sont portés par le CSS, pas par un état séparé.</span>
</div>

<h2>disabled</h2>
<div class="demo-row">{{ button('Indisponible', disabled=true) }}</div>

<h2>loading</h2>
<div class="demo-row">
  {{ button('Envoi en cours', loading=true) }}
  <span><code>aria-busy</code> annonce l'attente aux lecteurs d'écran.</span>
</div>
`),
      },
      {
        path: 'mockups/components/button/button.meta.yml',
        origin,
        contents: metaYml({
          id: 'MOCK-001',
          title: 'Bouton',
          states: ['default', 'hover', 'active', 'disabled', 'loading'],
        }),
      },
      {
        path: 'mockups/pages/login.html',
        origin,
        contents: textContents(`---
layout: layout.njk
title: Connexion
id: MOCK-002
---

<h1>Connexion</h1>

{% from "components/button.njk" import button %}

<form>
  <div class="field">
    <label for="email">Adresse e-mail</label>
    <input id="email" name="email" type="email" autocomplete="email" required />
  </div>

  <div class="field">
    <label for="password">Mot de passe</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required />
  </div>

  <div class="demo-row">
    {{ button('Se connecter', type='submit') }}
    <a href="/">Retour au catalogue</a>
  </div>
</form>
`),
      },
      {
        path: 'mockups/pages/login.meta.yml',
        origin,
        contents: metaYml({
          id: 'MOCK-002',
          title: 'Connexion',
        }),
      },
    ];
  },
  dependencies(context: ScaffoldContext): ScaffoldDependency[] {
    const origin = 'provider:mockups-composition/eleventy';
    return [
      {
        name: '@11ty/eleventy',
        version: ELEVENTY_VERSION,
        dev: true,
        target: MANIFEST_PATH,
        origin,
      },
      { name: 'yaml', version: YAML_VERSION, dev: true, target: MANIFEST_PATH, origin },
      designSystemDependency(context, origin),
    ];
  },
};

/**
 * Les maquettes consomment `design-system/dist/` (§3). Déclarer la dépendance plutôt que de
 * se contenter du chemin relatif donne à l'orchestrateur l'arête dont il a besoin : sans elle,
 * `pnpm build` peut construire les maquettes avant que les tokens existent.
 */
function designSystemDependency(context: ScaffoldContext, origin: string): ScaffoldDependency {
  const workspace = context.registry.resolve('workspace', context.config.providers.workspace);
  return {
    name: `@${context.config.name}/design-system`,
    version: workspace.workspace?.dependencyRange ?? '*',
    dev: true,
    target: MANIFEST_PATH,
    origin,
  };
}

const webComponents: Provider = {
  id: 'web-components',
  point: 'mockups-composition',
  label: 'Web Components',
  description:
    'Composants réutilisables au runtime, aucune étape de build — mais pas de rechargement à chaud ni de catalogue généré.',
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'provider:mockups-composition/web-components';

    return [
      mockupsManifest(context, origin, {
        dev: 'node ./serve.mjs',
        build:
          'node --eval "console.log(\'Rien à construire : les maquettes sont déjà du HTML statique.\')"',
      }),
      {
        path: 'mockups/serve.mjs',
        origin,
        contents: textContents(`import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

/**
 * Serveur statique des maquettes. Volontairement minimal : avec des Web Components, il n'y a
 * rien à construire — le navigateur résout lui-même la composition au runtime.
 *
 * Les tokens sont servis depuis design-system/dist/ : le sens de la dépendance reste imposé
 * (mockups/ consomme design-system/, jamais l'inverse).
 */
const PORT = Number(process.env.PORT ?? 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
};

createServer(async (request, response) => {
  const url = new URL(request.url, \`http://localhost:\${PORT}\`);
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';

  // Les tokens vivent hors de mockups/ : on les expose sous un préfixe dédié.
  const root = path.startsWith('/design-system/')
    ? new URL('../', import.meta.url).pathname
    : new URL('./', import.meta.url).pathname;
  const target = join(root, normalize(path).replace(/^(\\.\\.[/\\\\])+/, ''));

  try {
    const body = await readFile(target);
    response.writeHead(200, { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(\`404 — \${path}\`);
  }
}).listen(PORT, () => {
  console.log(\`Maquettes servies sur http://localhost:\${PORT}\`);
});
`),
      },
      { path: 'mockups/base.css', origin, contents: BASE_CSS },
      {
        path: 'mockups/index.html',
        origin,
        contents: textContents(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Catalogue des composants</title>
    <link rel="stylesheet" href="/design-system/dist/css/tokens.css" />
    <link rel="stylesheet" href="/base.css" />
  </head>
  <body>
    <header class="mockup-bar"><a href="/">Catalogue</a></header>
    <main class="mockup-main">
      <h1>Catalogue des composants</h1>

      <p>
        Sans étape de build, ce catalogue est <strong>maintenu à la main</strong> : pensez à
        l'ajouter à chaque nouveau composant. C'est le compromis du provider Web Components ;
        le provider Eleventy le génère à partir des <code>.meta.yml</code>.
      </p>

      <ul class="catalogue">
        <li>
          <a href="/components/button/"><strong>Bouton</strong></a>
          <p>MOCK-001 · statut <code>draft</code></p>
          <ul class="states">
            <li>default</li>
            <li>hover</li>
            <li>active</li>
            <li>disabled</li>
            <li>loading</li>
          </ul>
        </li>
      </ul>
    </main>
  </body>
</html>
`),
      },
      {
        path: 'mockups/components/button/button.js',
        origin,
        contents: textContents(`/**
 * Composant Bouton — source unique du markup.
 * Toute page qui affiche un bouton instancie <ds-button> ; personne ne recopie ce HTML.
 */
class DsButton extends HTMLElement {
  connectedCallback() {
    const label = this.getAttribute('label') ?? '';
    const variant = this.getAttribute('variant') ?? 'primary';
    const disabled = this.hasAttribute('disabled');
    const loading = this.hasAttribute('loading');

    const button = document.createElement('button');
    button.type = this.getAttribute('type') ?? 'button';
    button.className = \`btn btn--\${variant}\`;
    button.textContent = label;
    if (disabled) button.disabled = true;
    if (loading) button.setAttribute('aria-busy', 'true');

    this.replaceChildren(button);
  }
}

customElements.define('ds-button', DsButton);
`),
      },
      {
        path: 'mockups/components/button/button.meta.yml',
        origin,
        contents: metaYml({
          id: 'MOCK-001',
          title: 'Bouton',
          states: ['default', 'hover', 'active', 'disabled', 'loading'],
        }),
      },
      {
        path: 'mockups/components/button/index.html',
        origin,
        contents: textContents(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bouton</title>
    <link rel="stylesheet" href="/design-system/dist/css/tokens.css" />
    <link rel="stylesheet" href="/base.css" />
    <script type="module" src="./button.js"></script>
  </head>
  <body>
    <header class="mockup-bar">
      <a href="/">Catalogue</a>
      <a href="/pages/login.html">Connexion</a>
      <span class="mockup-bar__id">MOCK-001</span>
    </header>
    <main class="mockup-main">
      <h1>Bouton</h1>

      <h2>default</h2>
      <div class="demo-row">
        <ds-button label="Valider"></ds-button>
        <ds-button label="Secondaire" variant="secondary"></ds-button>
      </div>

      <h2>disabled</h2>
      <div class="demo-row"><ds-button label="Indisponible" disabled></ds-button></div>

      <h2>loading</h2>
      <div class="demo-row"><ds-button label="Envoi en cours" loading></ds-button></div>
    </main>
  </body>
</html>
`),
      },
      {
        path: 'mockups/pages/login.html',
        origin,
        contents: textContents(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Connexion</title>
    <link rel="stylesheet" href="/design-system/dist/css/tokens.css" />
    <link rel="stylesheet" href="/base.css" />
    <script type="module" src="/components/button/button.js"></script>
  </head>
  <body>
    <header class="mockup-bar">
      <a href="/">Catalogue</a>
      <span class="mockup-bar__id">MOCK-002</span>
    </header>
    <main class="mockup-main">
      <h1>Connexion</h1>
      <form>
        <div class="field">
          <label for="email">Adresse e-mail</label>
          <input id="email" name="email" type="email" autocomplete="email" required />
        </div>
        <div class="field">
          <label for="password">Mot de passe</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
        </div>
        <div class="demo-row">
          <ds-button label="Se connecter" type="submit"></ds-button>
          <a href="/">Retour au catalogue</a>
        </div>
      </form>
    </main>
  </body>
</html>
`),
      },
      {
        path: 'mockups/pages/login.meta.yml',
        origin,
        contents: metaYml({
          id: 'MOCK-002',
          title: 'Connexion',
        }),
      },
    ];
  },
  dependencies(context: ScaffoldContext): ScaffoldDependency[] {
    return [designSystemDependency(context, 'provider:mockups-composition/web-components')];
  },
};

export const mockupsCompositionProviders: readonly Provider[] = [eleventy, webComponents];
