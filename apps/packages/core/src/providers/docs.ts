import type { ModuleId } from '../modules.js';
import { jsonContents, textContents } from '../scaffold/format.js';
import type { ScaffoldContext, ScaffoldDependency, ScaffoldFile } from '../scaffold/types.js';
import { declarativeProvider } from './declarative.js';
import type { Provider } from './types.js';

/**
 * Générateur de site docs-as-code (TECHNICAL.md §5), intégré au cockpit, pas en silo.
 *
 * Le site ne réorganise rien : il sert `docs/` tel qu'il est versionné, par **une seule**
 * instance de `plugin-content-docs` enracinée sur le dossier.
 *
 * Une instance par module aurait mieux collé à l'axe 1 de §13, et c'est ce qui avait été
 * écrit d'abord — mais Docusaurus ne résout les liens relatifs de fichier à fichier qu'à
 * l'intérieur d'une même instance. Un ADR cité depuis `technical/` par
 * `../decisions/0002-….md` — un lien qui fonctionne sur une forge — cassait la
 * construction. Le seul contournement aurait été d'écrire des chemins de site absolus,
 * c'est-à-dire de faire choisir à chaque document entre être lisible en fichier et être
 * lisible dans le site. Le principe « everything lives in the codebase » tranche : le
 * fichier d'abord.
 *
 * Les sections restent visibles — ce sont les catégories de la barre latérale, nommées par
 * un `_category_.json`, et `_generated/` y est isolé comme l'exige la distinction
 * *authored* / *générée* de §5.
 */

const DOCUSAURUS_VERSION = '3.10.2';
const REACT_VERSION = '19.2.8';
const MDX_REACT_VERSION = '3.1.1';

const MANIFEST_PATH = 'docs/package.json';

/** Sections du site : un module de documentation, un dossier, une catégorie de sommaire. */
interface DocsSection {
  readonly module: ModuleId;
  readonly directory: string;
  readonly label: string;
  readonly position: number;
}

const SECTIONS: readonly DocsSection[] = [
  {
    module: 'docs-technical',
    directory: 'technical',
    label: 'Documentation technique',
    position: 1,
  },
  { module: 'docs-decisions', directory: 'decisions', label: 'Décisions (ADR)', position: 2 },
  { module: 'docs-product', directory: 'product', label: 'Produit', position: 3 },
  {
    module: 'docs-i18n-copy',
    directory: 'i18n-copy',
    label: 'UX writing et traductions',
    position: 4,
  },
];

/**
 * Section du contenu généré. Elle n'appartient à aucun module : elle existe dès que le site
 * existe, parce que le graphe, lui, existe toujours (TECHNICAL.md §7).
 */
const GENERATED_SECTION = {
  directory: '_generated',
  label: 'Généré par Klee',
  position: 9,
} as const;

/**
 * La documentation prend la racine du site, et sa page d'accueil est `docs/index.md` —
 * un document markdown ordinaire, pas une page du plugin `pages`.
 *
 * Ce dernier n'accepte que du MDX en pratique : une page `.md` n'expose pas les métadonnées
 * qu'attend le thème, et une page `.mdx` fait échouer la compilation, y compris réduite à
 * trois lignes. Klee n'a aucun besoin de JSX dans sa documentation — le supprimer du
 * dispositif coûte moins cher que de le faire marcher, et évite d'imposer MDX à tous les
 * projets scaffoldés.
 */
const DOCS_ROUTE = '/';

/**
 * La vue du graphe n'est **pas** produite ici : son contenu appartient à `klee links
 * report`, qui l'écrit après le scaffolding. Le scaffolder n'en poserait qu'un brouillon,
 * que la première régénération ferait diverger — et tout `klee docs init` ultérieur
 * échouerait alors sur un conflit de fichier parfaitement légitime.
 */

function activeSections(context: ScaffoldContext): DocsSection[] {
  return SECTIONS.filter((section) => context.config.modules[section.module]);
}

const docusaurus: Provider = {
  id: 'docusaurus',
  point: 'docs',
  label: 'Docusaurus',
  description: 'Défaut. Le plus complet : versioning, i18n, recherche, écosystème mature.',

  // `core-js` arrive dans les dépendances de Docusaurus et son script de post-installation
  // n'affiche qu'un message de financement : rien à exécuter.
  installScripts: { 'core-js': false },

  /**
   * Ce que l'arbre de Docusaurus 3.10.2 traîne et que l'amont n'a pas encore repris. Sans
   * ces trois lignes, `pnpm install` sur un projet neuf signale un paquet déprécié et
   * `pnpm audit` remonte cinq avis — un scaffolding ne doit pas livrer ça.
   *
   * Les portées font que chaque override s'efface de lui-même dès que l'amont passe au-delà.
   *
   * - `uuid` : via sockjs → webpack-dev-server ; déprécié en 8.x, et avis GHSA sur < 11.1.1.
   * - `qs` : via express → webpack-dev-server ; deux avis de déni de service.
   * - `serialize-javascript` : via copy-webpack-plugin ; RCE et déni de service.
   *
   * Reste `image-size` (deux avis de déni de service), qu'aucune version publiée ne corrige :
   * on ne peut pas imposer ce qui n'existe pas. Ses parseurs ne lisent que les images du
   * projet lui-même, à la construction.
   */
  dependencyOverrides: {
    'uuid@<11.1.1': '^11.1.1',
    'qs@<6.16.0': '^6.16.0',
    'serialize-javascript@<7.0.5': '^7.0.5',
  },

  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'provider:docs/docusaurus';
    const sections = [...activeSections(context), GENERATED_SECTION];

    return [
      {
        path: MANIFEST_PATH,
        origin,
        contents: jsonContents({
          name: `@${context.config.name}/docs`,
          version: '0.0.0',
          private: true,
          // Pas de `"type": "module"`, contrairement aux autres packages générés : le bundle
          // serveur que Docusaurus produit est du CommonJS. Déclarer le package en ESM le
          // fait charger comme un module ES et la construction échoue sur un
          // `require.resolveWeak is not a function` que rien ne relie à sa cause. Les deux
          // fichiers de configuration portent l'extension `.mjs`, donc restent en ESM.
          scripts: {
            dev: 'docusaurus start',
            build: 'docusaurus build',
            serve: 'docusaurus serve',
            clean: 'docusaurus clear',
          },
        }),
      },
      {
        path: 'docs/docusaurus.config.mjs',
        origin,
        contents: docusaurusConfig(context),
      },
      {
        path: 'docs/sidebars.mjs',
        origin,
        contents: textContents(`/**
 * Un sommaire unique, qui suit l'arborescence de \`docs/\`. Les sections sont les dossiers,
 * nommés par leur \`_category_.json\`.
 *
 * Maintenir un sommaire à la main désynchronise le jour où quelqu'un ajoute un fichier sans
 * y penser — soit exactement ce que ce projet cherche à éliminer.
 *
 * @type {import('@docusaurus/plugin-content-docs').SidebarsConfig}
 */
export default {
  sidebar: [{ type: 'autogenerated', dirName: '.' }],
};`),
      },
      ...sections.map((section) => categoryFile(section, origin)),
      {
        path: 'docs/index.md',
        origin,
        contents: landingPage(context),
      },
      {
        path: 'docs/src/css/custom.css',
        origin,
        contents: textContents(`/* Feuille de style du site de documentation.
 *
 * Volontairement vide : la charte visuelle du site n'est pas une décision de la phase 3.
 * Le jour où elle en devient une, elle consommera les mêmes tokens que les maquettes et
 * les apps (design-system/dist/css/tokens.css), jamais des valeurs recopiées ici.
 */`),
      },
    ];
  },

  dependencies(): ScaffoldDependency[] {
    const origin = 'provider:docs/docusaurus';
    const dependency = (name: string, version: string): ScaffoldDependency => ({
      name,
      version,
      dev: false,
      target: MANIFEST_PATH,
      origin,
    });

    return [
      dependency('@docusaurus/core', DOCUSAURUS_VERSION),
      dependency('@docusaurus/preset-classic', DOCUSAURUS_VERSION),
      dependency('@mdx-js/react', MDX_REACT_VERSION),
      dependency('react', REACT_VERSION),
      dependency('react-dom', REACT_VERSION),
    ];
  },
};

/**
 * Nom de la catégorie de sommaire d'un dossier. Sans ce fichier, Docusaurus affiche le nom
 * du dossier tel quel (`i18n-copy`, `_generated`) — lisible par un développeur, pas par la
 * PM ou la designer à qui le site s'adresse aussi (DESIGN.md §5).
 */
function categoryFile(
  section: Pick<DocsSection, 'directory' | 'label' | 'position'>,
  origin: string,
): ScaffoldFile {
  return {
    path: `docs/${section.directory}/_category_.json`,
    origin,
    contents: jsonContents({
      label: section.label,
      position: section.position,
      collapsed: false,
    }),
  };
}

function landingPage(context: ScaffoldContext): string {
  const sections = activeSections(context);

  return textContents(`---
title: Documentation
sidebar_label: Accueil
sidebar_position: 0
slug: /
---

# ${context.config.name}

> Everything lives in the codebase.

${sections.map((section) => `- **${section.label}** — \`docs/${section.directory}/\``).join('\n')}
- **${GENERATED_SECTION.label}** — \`docs/${GENERATED_SECTION.directory}/\`, vue du graphe de traçabilité, réécrite par \`klee links report\`.

Les identifiants \`${context.config.idPrefix}-xxx\` (ticket), \`MOCK-xxx\` (maquette) et
\`DOC-xxx\` (document) sont les arêtes du graphe : \`klee links check\` vérifie qu'aucune ne
pointe dans le vide.`);
}

function docusaurusConfig(context: ScaffoldContext): string {
  return textContents(`// @ts-check

/**
 * Site de documentation de ${context.config.name} (TECHNICAL.md §5).
 *
 * **Une seule** instance de \`plugin-content-docs\`, enracinée sur \`docs/\`. Docusaurus ne
 * résout les liens relatifs de fichier à fichier qu'à l'intérieur d'une instance : en
 * découper une par section casserait \`[…](../decisions/0002-….md)\`, un lien qui, lui,
 * fonctionne sur une forge. Les sections sont donc des catégories de sommaire.
 *
 * \`markdown.format: 'detect'\` fait lire les \`.md\` en CommonMark et réserve MDX aux
 * \`.mdx\`. Sans ça, une doc qui contient \`<Composant>\` ou une accolade en prose casse la
 * construction du site — une documentation ne doit pas devenir illisible pour du JSX
 * qu'elle n'utilise pas.
 *
 * @type {import('@docusaurus/types').Config}
 */
const config = {
  title: '${context.config.name}',
  tagline: 'Everything lives in the codebase.',
  url: 'http://localhost:3000',
  baseUrl: '/',

  // Un lien interne cassé est une erreur de construction : c'est le même engagement que
  // \`klee links check\` pour les identifiants, appliqué aux liens de fichier à fichier.
  onBrokenLinks: 'throw',

  i18n: { defaultLocale: 'fr', locales: ['fr'] },

  markdown: {
    format: 'detect',
    hooks: { onBrokenMarkdownLinks: 'warn' },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: '.',
          routeBasePath: '${DOCS_ROUTE}',
          sidebarPath: './sidebars.mjs',
          // Ce qui n'est pas de la documentation : contexte d'agent, machinerie du site,
          // sorties de construction. Le défaut de Docusaurus écarterait aussi tout dossier
          // commençant par « _ », donc \`_generated/\` — que §5 impose de publier.
          exclude: ['**/AGENTS.md', '**/node_modules/**', 'build/**', 'src/**'],
        },
        blog: false,
        // Aucune page hors documentation : la page d'accueil est un document.
        pages: false,
        theme: { customCss: './src/css/custom.css' },
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: '${context.config.name}',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'sidebar',
          position: 'left',
          label: 'Documentation',
        },
      ],
    },
    footer: {
      style: 'dark',
      copyright:
        'Documentation versionnée avec le code. Les identifiants ${context.config.idPrefix}-xxx, MOCK-xxx et DOC-xxx sont les arêtes du graphe de traçabilité.',
    },
  },
};

export default config;`);
}

/**
 * Pas de site du tout.
 *
 * Le point `docs` appartient au socle : sans cette option, *tout* projet Klee embarquerait
 * React et la chaîne de construction de Docusaurus, y compris une petite bibliothèque
 * interne dont les quelques ADR se lisent parfaitement sur une forge. C'est le même
 * raisonnement qu'à l'ADR 0008 pour l'index de tickets — l'outillage doit être justifié par
 * le corpus, pas imposé par le socle.
 *
 * Ce n'est pas un provider concurrent au sens de §13, c'est une sortie : le défaut reste
 * Docusaurus, comme l'annonce le tableau de §13.
 */
const markdownOnly = declarativeProvider({
  id: 'markdown-only',
  point: 'docs',
  label: 'Markdown seul',
  description: 'Aucun site généré : les fichiers de `docs/` se lisent tels quels.',
});

export const docsProviders: readonly Provider[] = [
  docusaurus,
  markdownOnly,
  declarativeProvider({
    id: 'vitepress',
    point: 'docs',
    label: 'VitePress',
    description: 'Plus léger et plus rapide, configuration minimale.',
  }),
  declarativeProvider({
    id: 'starlight',
    point: 'docs',
    label: 'Starlight (Astro)',
    description: 'Accessible et performant par défaut, bon pour de la doc à forte structure.',
  }),
];
