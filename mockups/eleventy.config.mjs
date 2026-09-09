import { parse } from 'yaml';

/**
 * Serveur de navigation des maquettes. Généré par `klee init`.
 *
 * Deux responsabilités : résoudre les includes de composants (pour qu'aucune page ne
 * duplique du markup) et exposer les tokens générés, pour qu'une maquette ne puisse pas
 * écrire une valeur en dur même par accident.
 */
export default function (eleventyConfig) {
  // Les `.meta.yml` alimentent le catalogue : ils sont lus comme données, pas publiés.
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
