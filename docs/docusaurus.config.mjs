// @ts-check

/**
 * Site de documentation de klee (TECHNICAL.md §5).
 *
 * **Une seule** instance de `plugin-content-docs`, enracinée sur `docs/`. Docusaurus ne
 * résout les liens relatifs de fichier à fichier qu'à l'intérieur d'une instance : en
 * découper une par section casserait `[…](../decisions/0002-….md)`, un lien qui, lui,
 * fonctionne sur une forge. Les sections sont donc des catégories de sommaire.
 *
 * `markdown.format: 'detect'` fait lire les `.md` en CommonMark et réserve MDX aux
 * `.mdx`. Sans ça, une doc qui contient `<Composant>` ou une accolade en prose casse la
 * construction du site — une documentation ne doit pas devenir illisible pour du JSX
 * qu'elle n'utilise pas.
 *
 * @type {import('@docusaurus/types').Config}
 */
const config = {
  title: 'klee',
  tagline: 'Everything lives in the codebase.',
  url: 'http://localhost:3000',
  baseUrl: '/',

  // Un lien interne cassé est une erreur de construction : c'est le même engagement que
  // `klee links check` pour les identifiants, appliqué aux liens de fichier à fichier.
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
          routeBasePath: '/',
          sidebarPath: './sidebars.mjs',
          // Ce qui n'est pas de la documentation : contexte d'agent, machinerie du site,
          // sorties de construction. Le défaut de Docusaurus écarterait aussi tout dossier
          // commençant par « _ », donc `_generated/` — que §5 impose de publier.
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
      title: 'klee',
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
        'Documentation versionnée avec le code. Les identifiants KLEE-xxx, MOCK-xxx et DOC-xxx sont les arêtes du graphe de traçabilité.',
    },
  },
};

export default config;
