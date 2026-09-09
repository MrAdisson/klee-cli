import { startBoardServer } from '../board/server.js';
import { loadProject } from '../project.js';
import { heading, info, success, write } from '../ui/output.js';

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
  const port = parsePort(options.port);

  const board = await startBoardServer({ project, port });

  heading('klee board');
  success(`Board servi sur ${board.url}`);
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

function parsePort(value: string | undefined): number {
  if (value === undefined) return DEFAULT_PORT;
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
}
