import { isKleeError } from '@klee/core';

import { runCompleteHidden } from './commands/completion.js';
import { createProgram } from './program.js';
import { reportError } from './ui/output.js';

/** Point d'entrée que les scripts de complétion rappellent à chaque tabulation. */
const COMPLETE_COMMAND = '__complete';

/**
 * Point d'entrée testable : retourne un code de sortie au lieu de terminer le processus.
 *
 * Une erreur de domaine (configuration invalide, module inconnu, conflit de fichiers) est
 * rendue telle quelle, sans stack : ce n'est pas un bug, c'est une réponse à corriger.
 * Tout le reste est un bug, et mérite sa stack.
 */
export async function runCli(argv: readonly string[]): Promise<number> {
  // La complétion court-circuite Commander : les mots à compléter sont du texte en cours de
  // frappe, dont `--statu` ou `-` — les livrer à un parseur d'options les ferait rejeter
  // alors que ce sont précisément les cas où l'utilisateur attend de l'aide.
  if (argv[2] === COMPLETE_COMMAND) {
    return await complete(argv.slice(3));
  }

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

/**
 * La complétion ne diagnostique jamais : hors d'un projet, ou sur un dépôt cassé, elle rend
 * une liste vide. Afficher une erreur pendant que l'utilisateur tape abîmerait sa ligne de
 * commande pour un service qu'il n'a pas demandé.
 */
async function complete(words: readonly string[]): Promise<number> {
  try {
    await runCompleteHidden(createProgram(), words);
  } catch {
    /* rien à dire : une tabulation sans réponse vaut mieux qu'une erreur en travers. */
  }
  return 0;
}
