import { stat } from 'node:fs/promises';
import { dirname, join, parse, resolve } from 'node:path';

export async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Remonte l'arborescence à la recherche d'un `.git`. Scaffolder à l'intérieur d'un dépôt
 * existant est un cas légitime — ajouter Keel à un projet en cours — et `git init` n'aurait
 * alors rien à y faire.
 *
 * `.git` peut être un fichier (worktree, submodule) autant qu'un dossier.
 */
export async function isInsideGitRepository(from: string): Promise<boolean> {
  let current = resolve(from);
  const { root } = parse(current);

  for (;;) {
    try {
      await stat(join(current, '.git'));
      return true;
    } catch {
      if (current === root) return false;
      current = dirname(current);
    }
  }
}
