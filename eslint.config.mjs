import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      // Sortie et cache du site de documentation : du JavaScript produit par Docusaurus,
      // qui n'a pas à passer les règles écrites pour le code de ce dépôt.
      'docs/build/**',
      'docs/.docusaurus/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Le JavaScript de configuration du dépôt (Eleventy, Style Dictionary, Docusaurus)
    // s'exécute sous Node : sans ses globales, `no-undef` signale `URL` ou `process` comme
    // indéfinis. Les fichiers `.ts` n'en ont pas besoin — @types/node les leur donne.
    files: ['**/*.mjs', '**/*.cjs', '**/*.js'],
    languageOptions: { globals: globals.nodeBuiltin },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['error'] }],
    },
  },
  {
    // La CLI écrit sur stdout : c'est sa raison d'être.
    files: ['apps/cli/src/ui/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
);
