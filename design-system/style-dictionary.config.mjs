/**
 * Pipeline DTCG → cibles de build. Généré par `klee init` ; ce fichier vous appartient,
 * adaptez-le. En revanche `dist/` est produit par ce pipeline et ne s'édite jamais à la main.
 */
export default {
  source: ['tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'dist/css/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: { outputReferences: true },
        },
      ],
    },
  },
};
