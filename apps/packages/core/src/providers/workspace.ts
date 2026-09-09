import { hasDesignSystem } from '../modules.js';
import { jsonContents, textContents } from '../scaffold/format.js';
import type { ScaffoldContext, ScaffoldFile } from '../scaffold/types.js';
import type { Provider } from './types.js';

/**
 * Orchestrateur de monorepo (TECHNICAL.md §2). C'est la brique la plus standard du
 * système : rien à inventer, seulement à choisir.
 */

function workspaceGlobs(context: ScaffoldContext): string[] {
  const globs = ['apps/*', 'apps/packages/*'];
  if (hasDesignSystem(context.config.modules)) {
    // design-system/ est membre du workspace au même titre qu'un package, mais reste
    // physiquement à la racine : il n'appartient ni à mockups/ ni à apps/ (§3).
    globs.push('design-system');
  }
  return globs;
}

const pnpmTurborepo: Provider = {
  id: 'pnpm-turborepo',
  point: 'workspace',
  label: 'pnpm workspaces + Turborepo',
  description: 'Défaut. Installation rapide, cache de tâches simple, configuration minimale.',
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'provider:workspace/pnpm-turborepo';
    return [
      {
        path: 'package.json',
        origin,
        contents: jsonContents({
          name: context.config.name,
          version: '0.0.0',
          private: true,
          type: 'module',
          engines: { node: '>=22.12.0' },
          scripts: {
            build: 'turbo run build',
            test: 'turbo run test',
            lint: 'turbo run lint',
          },
        }),
      },
      {
        path: 'pnpm-workspace.yaml',
        origin,
        contents: textContents(
          [
            '# Membres du workspace — cf docs/decisions/0001-repo-topology.md',
            'packages:',
            ...workspaceGlobs(context).map((glob) => `  - ${glob}`),
          ].join('\n'),
        ),
      },
      {
        path: 'turbo.json',
        origin,
        contents: jsonContents({
          $schema: 'https://turborepo.com/schema.json',
          tasks: {
            build: { dependsOn: ['^build'], outputs: ['dist/**'] },
            test: { dependsOn: ['^build'] },
            lint: {},
          },
        }),
      },
    ];
  },
};

const nx: Provider = {
  id: 'nx',
  point: 'workspace',
  label: 'Nx',
  description: 'Graphes de tâches plus riches, générateurs et contraintes de dépendances.',
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'provider:workspace/nx';
    return [
      {
        path: 'package.json',
        origin,
        contents: jsonContents({
          name: context.config.name,
          version: '0.0.0',
          private: true,
          type: 'module',
          engines: { node: '>=22.12.0' },
          workspaces: workspaceGlobs(context),
          scripts: {
            build: 'nx run-many -t build',
            test: 'nx run-many -t test',
            lint: 'nx run-many -t lint',
          },
        }),
      },
      {
        path: 'nx.json',
        origin,
        contents: jsonContents({
          $schema: './node_modules/nx/schemas/nx-schema.json',
          targetDefaults: {
            build: { dependsOn: ['^build'], outputs: ['{projectRoot}/dist'] },
            test: { dependsOn: ['^build'] },
          },
        }),
      },
    ];
  },
};

export const workspaceProviders: readonly Provider[] = [pnpmTurborepo, nx];
