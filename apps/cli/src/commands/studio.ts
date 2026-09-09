import { join } from 'node:path';

import { KleeError, providerRegistry, type ProviderPoint } from '@klee/core';

import { startBoardServer } from '../board/server.js';
import { directoryExists } from '../fs.js';
import { loadProject, type Project } from '../project.js';
import { openInBrowser } from '../browser.js';
import { freePort, parsePortOption, resolvePort } from '../ports.js';
import { startChildServer, type RunningChild } from '../studio/children.js';
import { startStudioServer } from '../studio/server.js';
import type { StudioTab } from '../studio/render.js';
import { heading, info, success, warn, write } from '../ui/output.js';

export interface StudioOptions {
  readonly port?: string;
  /** `--no-open` : Commander pose `open: false`. */
  readonly open?: boolean;
}

const DEFAULT_PORT = 4300;

/**
 * `klee studio` — le cockpit unifié de la phase 4 (TECHNICAL.md §9).
 *
 * Il **agrège** les serveurs existants, il ne les remplace pas (ADR 0014) : `klee board`,
 * `klee docs serve` et `klee mockups serve` restent utilisables seuls, et le studio ne fait
 * que les lancer ensemble derrière une entrée unique.
 *
 * Un onglet n'existe que si son module est retenu (§13) : un projet sans `mockups` n'a pas
 * d'onglet Maquettes — pas un onglet vide.
 */
export async function runStudio(options: StudioOptions): Promise<void> {
  const project = await loadProject();
  const requested = parsePortOption(options.port);
  const { port, moved } = await resolvePort(requested, DEFAULT_PORT, 'studio');

  heading('klee studio');

  // Le port du studio s'ouvre **avant** tout le reste. Le faire en dernier, c'est découvrir
  // qu'il est pris après avoir démarré Docusaurus — et laisser ces serveurs orphelins, sans
  // plus personne pour les arrêter. Le studio ne glisse pas de port, à la différence de ses
  // enfants : son URL doit rester la même d'une session à l'autre.
  let tabs: readonly StudioTab[] = [];
  const studio = await startStudioServer({ project, port, tabs: () => tabs });

  const children: RunningChild[] = [];
  // Le board est à nous : pas de sous-processus, pas de port à deviner. On le sert dans le
  // studio même, sur un port éphémère puisque personne n'a à le connaître.
  let board: Awaited<ReturnType<typeof startBoardServer>> | undefined;

  const stopAll = async (): Promise<void> => {
    await Promise.allSettled([
      studio.close(),
      board?.close(),
      ...children.map((child) => child.stop()),
    ]);
  };

  try {
    // Le board reçoit l'URL du studio : ses identifiants deviennent des liens qui
    // changent d'onglet, au lieu de rester enfermés dans le cadre.
    board = await startBoardServer({ project, port: 0, studioUrl: studio.url });
    tabs = [
      { id: 'board', label: 'Board', url: board.url },
      ...(await startTab(project, 'docs', 'Docs', children)),
      ...(await startTab(project, 'mockups', 'Maquettes', children)),
    ];
  } catch (error) {
    // Tout ce qui a démarré s'arrête : un échec ne doit jamais laisser un serveur derrière.
    await stopAll();
    throw error;
  }

  write();
  success(`Studio servi sur ${studio.url}`);
  if (moved) warn(`Le port ${String(DEFAULT_PORT)} était pris — le studio a pris ${String(port)}.`);
  for (const tab of tabs) {
    if (tab.url === null) warn(`${tab.label} — indisponible : ${tab.failure ?? 'raison inconnue'}`);
    else info(`${tab.label} — ${tab.url}`);
  }
  write();
  info(
    'Chaque serveur reste utilisable seul : `klee board`, `klee docs serve`, `klee mockups serve`.',
  );
  info('`/go/<ID>` ouvre n’importe quel identifiant dans le bon onglet.');
  write();
  info('Ctrl+C pour arrêter.');
  write();

  // C'est le studio qu'on a demandé, c'est donc le studio qui s'ouvre — pas la
  // documentation, que Docusaurus ouvrait de son côté avant qu'on le fasse taire.
  if (options.open !== false) openInBrowser(studio.url);

  await new Promise<void>((resolve) => {
    let stopping = false;
    const stop = (): void => {
      if (stopping) return;
      stopping = true;
      write();
      info('Arrêt des serveurs…');
      void stopAll().then(() => {
        resolve();
      });
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}

/**
 * Démarre l'onglet d'un module, ou n'en produit aucun.
 *
 * Un serveur qui ne démarre pas ne fait pas échouer le studio : les trois surfaces sont
 * indépendantes, et perdre les maquettes ne doit pas coûter le board. L'échec est montré
 * dans l'onglet plutôt que tu.
 */
async function startTab(
  project: Project,
  id: 'docs' | 'mockups',
  label: string,
  children: RunningChild[],
): Promise<StudioTab[]> {
  const spec = await specFor(project, id, label);
  if (spec === null) return [];

  info(`Démarrage de ${label}…`);
  try {
    const child = await startChildServer(spec);
    children.push(child);
    return [{ id, label, url: child.url }];
  } catch (error) {
    return [
      {
        id,
        label,
        url: null,
        failure: error instanceof Error ? error.message : String(error),
      },
    ];
  }
}

async function specFor(
  project: Project,
  id: 'docs' | 'mockups',
  label: string,
): Promise<{
  id: string;
  label: string;
  command: string;
  args: string[];
  cwd: string;
} | null> {
  if (id === 'mockups' && !project.config.modules.mockups) return null;

  // C'est le provider qui déclare s'il apporte un serveur, et comment lui imposer un port.
  // `markdown-only` (ADR 0011) n'en apporte aucun : il n'y a alors pas d'onglet Docs, plutôt
  // qu'un cadre vide.
  const point: ProviderPoint = id === 'docs' ? 'docs' : 'mockups-composition';
  const provider = providerRegistry.resolve(point, project.config.providers[point]);
  const devServer = provider.devServer;
  if (devServer === undefined) return null;

  const directory = id === 'docs' ? 'docs' : 'mockups';
  const cwd = join(project.root, directory);
  if (!(await directoryExists(cwd))) return null;

  const workspace = providerRegistry.resolve('workspace', project.config.providers.workspace);
  const run = workspace.workspace?.run;
  const [command, ...prefix] = run ?? [];
  if (command === undefined) {
    throw new KleeError(
      `Le provider workspace « ${workspace.label} » ne déclare pas de commande d'exécution.`,
      { code: 'PROVIDER_NO_COMMANDS' },
    );
  }

  // Un port libre choisi par nous, plutôt que le défaut du serveur : sur le port par défaut,
  // n'importe quel outil déjà lancé fait tomber l'onglet — Docusaurus s'arrête, Eleventy
  // glisse ailleurs sans le dire.
  //
  // Les arguments suivent directement le nom du script : pnpm 12 **avale** un `--`
  // séparateur, et le drapeau n'atteint alors jamais le serveur. Vérifié dans les deux
  // formes — c'est le genre de détail qu'une lecture ne tranche pas.
  const port = await freePort();
  return {
    id,
    label,
    command,
    args: [
      ...prefix,
      devServer.script,
      devServer.portFlag,
      String(port),
      // Ce que le provider demande quand son serveur est intégré plutôt que lancé seul :
      // pour Docusaurus, ne pas ouvrir de navigateur.
      ...(devServer.embedArgs ?? []),
    ],
    cwd,
  };
}
