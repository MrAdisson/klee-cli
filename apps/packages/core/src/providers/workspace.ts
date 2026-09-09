import { jsonContents, textContents } from '../scaffold/format.js';
import type { ScaffoldContext, ScaffoldDependency, ScaffoldFile } from '../scaffold/types.js';
import type { Provider } from './types.js';

/**
 * Orchestrateur de monorepo (TECHNICAL.md §2). C'est la brique la plus standard du
 * système : rien à inventer, seulement à choisir.
 */

const TURBO_VERSION = '^2.10.12';
// Corepack exige une version exacte : une plage est refusée. À remonter comme n'importe
// quelle autre dépendance épinglée.
const PNPM_VERSION = 'pnpm@12.3.4';
const NPM_VERSION = 'npm@11.19.0';
const NX_VERSION = '^23.2.0';

/**
 * Membres du workspace, listés indépendamment des modules retenus.
 *
 * pnpm comme npm tolèrent une entrée qui ne correspond à aucun dossier : lister
 * `design-system` et `mockups` en permanence évite que `klee module add mockups` laisse un
 * fichier de workspace périmé derrière lui. Un état de moins à synchroniser.
 */
const WORKSPACE_GLOBS = ['apps/*', 'apps/packages/*', 'design-system', 'mockups'];

/**
 * Scripts de racine volontairement génériques. Chaque dossier possède les siens
 * (`design-system/package.json`, `mockups/package.json`) : l'orchestrateur les agrège sans
 * avoir à connaître Style Dictionary ni Eleventy.
 */
function rootScripts(runner: 'turbo' | 'nx'): Record<string, string> {
  const many = runner === 'turbo' ? 'turbo run' : 'nx run-many -t';
  return {
    // `dev` agrège les tâches longues de chaque package : servir les maquettes aujourd'hui,
    // le cockpit demain. Une seule commande à retenir à la racine.
    dev: `${many} dev`,
    build: `${many} build`,
    test: `${many} test`,
    lint: `${many} lint`,
  };
}

const pnpmTurborepo: Provider = {
  id: 'pnpm-turborepo',
  point: 'workspace',
  label: 'pnpm workspaces + Turborepo',
  description: 'Défaut. Installation rapide, cache de tâches simple, configuration minimale.',
  workspace: {
    install: ['pnpm', 'install'],
    run: ['pnpm', 'run'],
    dependencyRange: 'workspace:*',
    packageManager: PNPM_VERSION,
  },
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
          // Turborepo refuse de résoudre le workspace sans ce champ.
          packageManager: PNPM_VERSION,
          engines: { node: '>=22.12.0' },
          scripts: rootScripts('turbo'),
        }),
      },
      {
        path: 'pnpm-workspace.yaml',
        origin,
        contents: textContents(
          [
            '# Membres du workspace — cf docs/decisions/0001-repo-topology.md',
            'packages:',
            ...WORKSPACE_GLOBS.map((glob) => `  - ${glob}`),
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
            // Tâche longue : ni cache, ni attente de terminaison.
            dev: { cache: false, persistent: true },
          },
        }),
      },
    ];
  },
  dependencies(): ScaffoldDependency[] {
    return [
      {
        name: 'turbo',
        version: TURBO_VERSION,
        dev: true,
        target: 'package.json',
        origin: 'provider:workspace/pnpm-turborepo',
      },
    ];
  },
};

const nx: Provider = {
  id: 'nx',
  point: 'workspace',
  label: 'Nx',
  description: 'Graphes de tâches plus riches, générateurs et contraintes de dépendances.',
  workspace: {
    install: ['npm', 'install'],
    run: ['npm', 'run'],
    dependencyRange: '*',
    packageManager: NPM_VERSION,
  },
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
          packageManager: NPM_VERSION,
          engines: { node: '>=22.12.0' },
          workspaces: WORKSPACE_GLOBS,
          scripts: rootScripts('nx'),
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
  dependencies(): ScaffoldDependency[] {
    return [
      {
        name: 'nx',
        version: NX_VERSION,
        dev: true,
        target: 'package.json',
        origin: 'provider:workspace/nx',
      },
    ];
  },
};

export const workspaceProviders: readonly Provider[] = [pnpmTurborepo, nx];
