import { jsonContents, textContents } from '../scaffold/format.js';
import type { ScaffoldContext, ScaffoldDependency, ScaffoldFile } from '../scaffold/types.js';
import type { Provider } from './types.js';

/**
 * Pipeline de transformation des tokens (TECHNICAL.md §3). Le *format* des tokens, lui,
 * n'est pas un point provider : le standard W3C DTCG est imposé sans alternative
 * (DESIGN.md §2), car c'est un point d'interopérabilité externe.
 *
 * Le pipeline appartient au projet généré, pas à klee : `design-system/` a son propre
 * `package.json` et son script `build`. `klee tokens build` ne fait que le lancer, et le
 * projet reste parfaitement utilisable sans klee installé.
 */

const STYLE_DICTIONARY_VERSION = '^5.5.3';
const TERRAZZO_VERSION = '^2.7.1';

const MANIFEST_PATH = 'design-system/package.json';

function targets(context: ScaffoldContext): readonly string[] {
  return context.config.designSystem?.targets ?? ['css'];
}

function manifest(context: ScaffoldContext, origin: string, buildCommand: string): ScaffoldFile {
  return {
    path: MANIFEST_PATH,
    origin,
    contents: jsonContents({
      name: `@${context.config.name}/design-system`,
      version: '0.0.0',
      private: true,
      type: 'module',
      // `dist/` est généré : il est exposé mais jamais édité ni versionné (§3).
      exports: { './css': './dist/css/tokens.css' },
      scripts: {
        build: buildCommand,
        'tokens:build': buildCommand,
      },
    }),
  };
}

const styleDictionary: Provider = {
  id: 'style-dictionary',
  point: 'tokens-pipeline',
  label: 'Style Dictionary',
  description: 'Défaut. Le plus mature, tous formats de plateforme y compris natif.',
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'provider:tokens-pipeline/style-dictionary';
    const active = targets(context);

    const platforms: string[] = [
      `    css: {
      transformGroup: 'css',
      buildPath: 'dist/css/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: { outputReferences: true },
        },
      ],
    },`,
    ];

    if (active.includes('js')) {
      platforms.push(`    js: {
      transformGroup: 'js',
      buildPath: 'dist/js/',
      files: [{ destination: 'tokens.ts', format: 'javascript/es6' }],
    },`);
    }

    if (active.includes('tailwind')) {
      platforms.push(`    tailwind: {
      transformGroup: 'js',
      buildPath: 'dist/tailwind/',
      files: [{ destination: 'theme.js', format: 'klee/tailwind-theme' }],
    },`);
    }

    const tailwindFormat = active.includes('tailwind')
      ? `
// Style Dictionary n'a pas de format Tailwind natif : on projette les tokens dans la forme
// attendue par \`theme.extend\`, en conservant les groupes de premier niveau.
StyleDictionary.registerFormat({
  name: 'klee/tailwind-theme',
  format({ dictionary }) {
    const theme = {};
    for (const token of dictionary.allTokens) {
      const [group, ...rest] = token.path;
      theme[group] ??= {};
      theme[group][rest.join('-')] = token.$value ?? token.value;
    }
    return \`export default \${JSON.stringify(theme, null, 2)};\\n\`;
  },
});
`
      : '';

    return [
      manifest(context, origin, 'style-dictionary build --config style-dictionary.config.mjs'),
      {
        path: 'design-system/style-dictionary.config.mjs',
        origin,
        contents: textContents(`import StyleDictionary from 'style-dictionary';
${tailwindFormat}
/**
 * Pipeline DTCG → cibles de build. Généré par \`klee init\` ; ce fichier vous appartient,
 * adaptez-le. En revanche \`dist/\` est produit par ce pipeline et ne s'édite jamais à la main.
 */
export default {
  source: ['tokens.json'],
  platforms: {
${platforms.join('\n')}
  },
};
`),
      },
    ];
  },
  dependencies(): ScaffoldDependency[] {
    return [
      {
        name: 'style-dictionary',
        version: STYLE_DICTIONARY_VERSION,
        dev: true,
        target: MANIFEST_PATH,
        origin: 'provider:tokens-pipeline/style-dictionary',
      },
    ];
  },
};

const terrazzo: Provider = {
  id: 'terrazzo',
  point: 'tokens-pipeline',
  label: 'Terrazzo',
  description: 'Natif DTCG, plugin Tailwind v4 dédié — plus direct si Tailwind est la cible.',
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'provider:tokens-pipeline/terrazzo';
    const active = targets(context);

    const imports = [`import css from '@terrazzo/plugin-css';`];
    const plugins = [`    css({ filename: 'css/tokens.css' })`];

    if (active.includes('js')) {
      imports.push(`import js from '@terrazzo/plugin-js';`);
      plugins.push(`    js({ js: 'js/tokens.js', ts: 'js/tokens.d.ts' })`);
    }
    if (active.includes('tailwind')) {
      imports.push(`import tailwind from '@terrazzo/plugin-tailwind';`);
      plugins.push(`    tailwind({ filename: 'tailwind/theme.css' })`);
    }

    return [
      manifest(context, origin, 'tz build'),
      {
        path: 'design-system/terrazzo.config.js',
        origin,
        contents: textContents(`import { defineConfig } from '@terrazzo/cli';
${imports.join('\n')}

/**
 * Pipeline DTCG → cibles de build. Généré par \`klee init\` ; ce fichier vous appartient.
 * \`dist/\` est produit par ce pipeline et ne s'édite jamais à la main.
 */
export default defineConfig({
  tokens: ['./tokens.json'],
  outDir: './dist/',
  plugins: [
${plugins.join(',\n')},
  ],
});
`),
      },
    ];
  },
  dependencies(context: ScaffoldContext): ScaffoldDependency[] {
    const origin = 'provider:tokens-pipeline/terrazzo';
    const active = targets(context);
    const packages = ['@terrazzo/cli', '@terrazzo/plugin-css'];
    if (active.includes('js')) packages.push('@terrazzo/plugin-js');
    if (active.includes('tailwind')) packages.push('@terrazzo/plugin-tailwind');

    return packages.map((name) => ({
      name,
      version: TERRAZZO_VERSION,
      dev: true,
      target: MANIFEST_PATH,
      origin,
    }));
  },
};

export const tokensPipelineProviders: readonly Provider[] = [styleDictionary, terrazzo];
