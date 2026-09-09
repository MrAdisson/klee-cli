import { join } from 'node:path';

import {
  KleeError,
  applyScaffoldPlan,
  buildScaffoldPlan,
  providerRegistry,
  type Provider,
} from '@klee/core';

import { refreshGraphReport } from './links.js';
import { fileExists } from '../fs.js';
import { loadProject, type Project } from '../project.js';
import { info, heading, reportApply, write } from '../ui/output.js';
import { runProjectScript } from './project-script.js';

/**
 * `klee docs …` — site de documentation (TECHNICAL.md §5).
 *
 * Comme pour les maquettes, Klee n'embarque pas le générateur : `docs/` a son propre
 * `package.json`, et la CLI ne fait que lancer son script avec le gestionnaire de paquets
 * déclaré par le provider `workspace` (ADR 0006).
 */

const MANIFEST = 'docs/package.json';

function docsProvider(project: Project): Provider {
  return providerRegistry.resolve('docs', project.config.providers.docs);
}

/**
 * Génère les fichiers du site.
 *
 * C'est le chemin de mise à niveau d'un projet scaffoldé avant que le provider `docs` ne
 * produise quoi que ce soit : le point `docs` n'est rattaché à aucun module, donc
 * `klee module add` ne peut pas l'atteindre.
 */
export interface DocsServeOptions {
  readonly port?: string;
}

export interface DocsInitOptions {
  readonly dryRun?: boolean;
  readonly force?: boolean;
}

export async function runDocsInit(options: DocsInitOptions): Promise<void> {
  const project = await loadProject();
  const provider = docsProvider(project);

  const plan = buildScaffoldPlan({
    config: project.config,
    includeRoot: false,
    modules: [],
    providerPoints: ['docs'],
  });

  if (plan.files.length === 0) {
    throw new KleeError(`Le provider de docs « ${provider.label} » ne génère aucun site.`, {
      code: 'PROVIDER_NO_FILES',
      hint: 'Changez `providers.docs` dans project.config.json pour en obtenir un.',
    });
  }

  const result = await applyScaffoldPlan(plan, {
    root: project.root,
    dryRun: options.dryRun ?? false,
    onConflict: options.force === true ? 'overwrite' : 'fail',
  });

  heading(`Site de documentation — ${provider.label}`);
  write();
  reportApply(result);

  if (options.dryRun !== true) {
    write();
    info('Installez les dépendances déclarées, puis `klee docs serve`.');
    write();
  }
}

export async function runDocsServe(options: DocsServeOptions = {}): Promise<void> {
  await runDocsScript('dev', options.port);
}

export async function runDocsBuild(): Promise<void> {
  await runDocsScript('build');
}

/**
 * La vue générée du graphe est régénérée avant de servir ou de construire : le site
 * publierait sinon un `docs/_generated/` périmé, c'est-à-dire une page qui affirme un état
 * du graphe que les fichiers ne disent plus.
 */
async function runDocsScript(script: string, port?: string): Promise<void> {
  const project = await loadProject();

  if (!(await fileExists(join(project.root, MANIFEST)))) {
    const provider = docsProvider(project);
    // Distinguer « pas encore généré » de « ce provider ne génère rien » : renvoyer vers
    // `klee docs init` quand celui-ci échouerait à son tour n'aide personne.
    const generates = buildScaffoldPlan({
      config: project.config,
      includeRoot: false,
      modules: [],
      providerPoints: ['docs'],
    }).files.length;

    throw new KleeError(
      generates === 0
        ? `Le provider de docs « ${provider.label} » ne génère aucun site : les fichiers de docs/ se lisent tels quels.`
        : `${MANIFEST} est absent : ce projet n'a pas de site de documentation généré.`,
      {
        code: 'DOCS_SITE_MISSING',
        hint:
          generates === 0
            ? 'Changez `providers.docs` dans project.config.json pour en obtenir un.'
            : 'Lancez `klee docs init`.',
      },
    );
  }

  await refreshGraphReport(project);
  await runProjectScript({
    directory: 'docs',
    script,
    // Seul `dev` sert : une construction n'ouvre aucun port.
    ...(script === 'dev'
      ? { servesFrom: 'docs' as const, ...(port === undefined ? {} : { port }) }
      : {}),
  });
}
