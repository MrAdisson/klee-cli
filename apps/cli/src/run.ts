import { isKleeError } from '@klee/core';

import { createProgram } from './program.js';
import { reportError } from './ui/output.js';

/**
 * Point d'entrée testable : retourne un code de sortie au lieu de terminer le processus.
 *
 * Une erreur de domaine (configuration invalide, module inconnu, conflit de fichiers) est
 * rendue telle quelle, sans stack : ce n'est pas un bug, c'est une réponse à corriger.
 * Tout le reste est un bug, et mérite sa stack.
 */
export async function runCli(argv: readonly string[]): Promise<number> {
  try {
    await createProgram().parseAsync([...argv]);
    // Une commande qui délègue à un sous-processus propage son code de sortie.
    return typeof process.exitCode === 'number' ? process.exitCode : 0;
  } catch (error) {
    if (isKleeError(error)) {
      reportError(error.message, error.hint);
      return 1;
    }

    reportError(
      error instanceof Error ? error.message : String(error),
      'Erreur inattendue — merci de la signaler avec la trace ci-dessous.',
    );
    if (error instanceof Error && error.stack !== undefined) {
      console.error(error.stack);
    }
    return 1;
  }
}
