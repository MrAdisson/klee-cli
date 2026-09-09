import { KleeError } from '@klee/core';
import type { Command } from 'commander';

import {
  SHELL_IDS,
  completionCandidates,
  isShellId,
  type ShellId,
} from '../completion/candidates.js';
import { detectShell, installCompletion } from '../completion/install.js';
import { completionScript, installHint } from '../completion/scripts.js';
import { field, heading, info, success, warn, write } from '../ui/output.js';

/**
 * `klee completion <shell>` émet le script à charger dans le shell ; `klee __complete` est le
 * point d'entrée que ce script rappelle à chaque tabulation. Les deux écrivent sur stdout sans
 * décor : leur sortie est lue par un shell, pas par un humain.
 */

export function runCompletion(shell: string | undefined): void {
  const target = resolveShell(shell);
  write(completionScript(target));
  write(`# ${installHint(target)}`);
}

/** Le shell nommé, sinon celui de `$SHELL` — deviner en silence vaudrait mieux que d'exiger. */
function resolveShell(shell: string | undefined): ShellId {
  const target = shell ?? detectShell();
  if (target === null || target === undefined) {
    throw new KleeError('Impossible de déduire votre shell depuis $SHELL.', {
      code: 'UNKNOWN_SHELL',
      hint: `Nommez-le : klee completion <${SHELL_IDS.join(' | ')}>.`,
    });
  }
  if (!isShellId(target)) {
    throw new KleeError(`Shell inconnu : « ${target} ».`, {
      code: 'UNKNOWN_SHELL',
      hint: `Shells reconnus : ${SHELL_IDS.join(', ')}.`,
    });
  }
  return target;
}

export interface CompletionInstallOptions {
  readonly dryRun?: boolean;
}

export async function runCompletionInstall(
  shell: string | undefined,
  options: CompletionInstallOptions,
): Promise<void> {
  const result = await installCompletion(resolveShell(shell), options.dryRun === true);

  heading(`Complétion ${result.shell}`);
  field('Fichier', result.path);
  write();

  if (result.written) {
    success('Script installé — il sera actif dans vos prochains terminaux.');
  } else {
    info('Rien n’a été écrit (--dry-run).');
  }

  if (result.followUp !== null) {
    warn(`Une étape reste à votre charge : ${result.followUp}.`);
  }
  info(`Pour cette session : eval "$(klee completion ${result.shell})"`);
  info('Pour désinstaller : supprimez le fichier ci-dessus.');
  write();
}

export async function runCompleteHidden(program: Command, words: readonly string[]): Promise<void> {
  const candidates = await completionCandidates(program, words);
  for (const candidate of candidates) {
    write(candidate);
  }
}
