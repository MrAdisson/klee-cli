import { spawn } from 'node:child_process';

import { KeelError } from '@keel/core';

/**
 * Lance un sous-processus en lui laissant le terminal. Keel délègue au gestionnaire de
 * paquets du projet plutôt que d'embarquer le sien : un binaire manquant est donc une erreur
 * d'environnement à expliquer, pas un crash.
 */
export function spawnInherit(
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        reject(
          new KeelError(`« ${command} » est introuvable.`, {
            code: 'PACKAGE_MANAGER_MISSING',
            hint: `Installez-le, ou lancez la commande à la main depuis ${cwd}.`,
            cause: error,
          }),
        );
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      resolve(code ?? 0);
    });
  });
}
