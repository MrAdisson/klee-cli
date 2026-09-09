import { startBoardServer } from '../board/server.js';
import { parsePortOption, resolvePort } from '../ports.js';
import { loadProject } from '../project.js';
import { heading, info, success, warn, write } from '../ui/output.js';

export interface BoardOptions {
  readonly port?: string;
}

const DEFAULT_PORT = 4321;

/**
 * `klee board` — kanban local des tickets.
 *
 * En phase 4, ce board deviendra l'onglet Board du cockpit unifié (`klee studio`), aux côtés
 * des docs et des maquettes, avec la recherche transverse et les liens croisés. Le servir dès
 * maintenant à part est le « dashboard local basique » de la phase 2 (TECHNICAL.md §6).
 */
export async function runBoard(options: BoardOptions): Promise<void> {
  const project = await loadProject();
  // Deux projets Klee ouverts en parallèle est le cas ordinaire : le port par défaut cède,
  // et le dit. Un port nommé explicitement, lui, est honoré ou refusé.
  const { port, moved } = await resolvePort(parsePortOption(options.port), DEFAULT_PORT, 'board');

  const board = await startBoardServer({ project, port });

  heading('klee board');
  success(`Board servi sur ${board.url}`);
  if (moved) warn(`Le port ${String(DEFAULT_PORT)} était pris — le board a pris ${String(port)}.`);
  info('Créer et déplacer un ticket ne demande aucun terminal.');
  info('Les fichiers de `tickets/` restent la source de vérité : éditez-les librement.');
  write();
  info('Ctrl+C pour arrêter.');
  write();

  await new Promise<void>((resolve) => {
    const stop = (): void => {
      void board.close().then(resolve);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}
