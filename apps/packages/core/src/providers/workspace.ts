import { jsonContents, textContents } from '../scaffold/format.js';
import type { ScaffoldContext, ScaffoldDependency, ScaffoldFile } from '../scaffold/types.js';
import { dependencyOverrideDecisions, installScriptDecisions } from './declarations.js';
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
const WORKSPACE_GLOBS = ['apps/*', 'apps/packages/*', 'design-system', 'docs', 'mockups'];

/**
 * Bloc `allowBuilds` de pnpm : la décision prise pour chaque script de post-installation
 * qu'apportent les providers retenus.
 *
 * Rien n'est écrit en dur ici — la liste vient des providers eux-mêmes (ADR 0012). Un script
 * qu'aucun d'eux ne déclare fera échouer `pnpm install`, et c'est voulu : exécuter du code à
 * l'installation reste une décision humaine.
 */
function allowBuildsBlock(context: ScaffoldContext): string[] {
  const decisions = Object.entries(installScriptDecisions(context));
  if (decisions.length === 0) return [];

  return [
    '',
    '# Scripts de post-installation apportés par les providers retenus, tranchés',
    '# explicitement. pnpm refuse d’en ignorer un en silence : un script nouveau fera',
    '# échouer l’installation, et c’est voulu.',
    'allowBuilds:',
    ...decisions.map(([name, allowed]) => `  ${name}: ${String(allowed)}`),
  ];
}

/**
 * Versions imposées dans l'arbre transitif, déclarées par les providers retenus.
 *
 * Les portées (`uuid@<11.1.1`) sont conservées telles quelles : l'override cesse d'agir de
 * lui-même dès que l'amont passe au-delà, au lieu de survivre à sa raison d'être.
 */
function overridesBlock(context: ScaffoldContext): string[] {
  const overrides = Object.entries(dependencyOverrideDecisions(context));
  if (overrides.length === 0) return [];

  return [
    '',
    '# Versions imposées dans l’arbre transitif : ce que des dépendances profondes traînent',
    '# et que leur auteur n’a pas encore corrigé. À retirer quand l’amont aura bougé.',
    'overrides:',
    ...overrides.map(([target, version]) => `  ${target}: ${version}`),
  ];
}

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
            ...allowBuildsBlock(context),
            ...overridesBlock(context),
          ].join('\n'),
        ),
      },
      {
        path: 'turbo.json',
        origin,
        contents: jsonContents({
          $schema: 'https://turborepo.com/schema.json',
          tasks: {
            // `build/**` : sortie du site de documentation, à côté de `dist/**` que
            // produisent les packages. Un output non déclaré fait mettre en cache un
            // résultat vide, et la tâche « réussit » sans rien produire.
            build: { dependsOn: ['^build'], outputs: ['dist/**', 'build/**'] },
            test: { dependsOn: ['^build'] },
            lint: {},
            // Tâche longue : ni cache, ni attente de terminaison. `dependsOn` garantit que
            // les tokens sont construits avant que les maquettes ne soient servies.
            dev: { cache: false, persistent: true, dependsOn: ['^build'] },
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

/**
 * Équivalent npm des overrides. npm ne connaît pas la forme `paquet@portée` : la portée est
 * donc retirée, ce qui rend l'override inconditionnel. C'est plus large que sous pnpm, et
 * c'est le mieux que npm permette — à surveiller lors d'une montée de version de l'amont.
 */
function npmOverrides(context: ScaffoldContext): { overrides?: Record<string, string> } {
  const overrides = Object.entries(dependencyOverrideDecisions(context));
  if (overrides.length === 0) return {};

  return {
    overrides: Object.fromEntries(
      overrides.map(([target, version]) => [
        target.split('@<')[0]?.split('@>')[0] ?? target,
        version,
      ]),
    ),
  };
}

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
          ...npmOverrides(context),
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
            dev: { dependsOn: ['^build'] },
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
