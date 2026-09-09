import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { SHELL_IDS, isShellId, type ShellId } from './candidates.js';
import { completionFile } from './scripts.js';

/**
 * Installation du script de complétion (`klee completion install`).
 *
 * npm n'a aucun mécanisme de distribution de complétion — contrairement à Homebrew ou apt,
 * rien n'est déposé à l'installation dans un dossier que le shell lirait. Un `postinstall`
 * qui écrirait dans la configuration de l'utilisateur serait à la fois cassé
 * (`--ignore-scripts`) et intrusif. L'installation est donc une commande **explicite**, sur
 * le modèle de `pnpm install-completion`.
 *
 * Elle écrit hors du projet : c'est précisément pourquoi elle n'est jamais déclenchée par
 * `klee init`, qui garantit de n'écrire que sous sa racine.
 */

const run = promisify(execFile);

export interface InstallTarget {
  /** Fichier à écrire, à l'emplacement que le shell charge de lui-même. */
  readonly path: string;
  /** Ce qu'il reste à faire pour que le shell le trouve, ou `null` s'il le trouve seul. */
  readonly followUp: string | null;
}

export interface InstallResult extends InstallTarget {
  readonly shell: ShellId;
  /** `false` en `--dry-run` : la cible est résolue, rien n'est écrit. */
  readonly written: boolean;
}

/** Shell de l'utilisateur d'après `$SHELL`, si klee sait lui parler. */
export function detectShell(env: NodeJS.ProcessEnv = process.env): ShellId | null {
  const shell = env['SHELL'];
  if (shell === undefined || shell.length === 0) return null;
  const name = basename(shell);
  return isShellId(name) ? name : null;
}

export async function resolveInstallTarget(shell: ShellId): Promise<InstallTarget> {
  switch (shell) {
    case 'zsh':
      return await zshTarget();
    case 'bash':
      return {
        path: join(homedir(), '.local', 'share', 'bash-completion', 'completions', 'klee'),
        followUp: 'requiert bash-completion (brew install bash-completion@2)',
      };
    case 'fish':
      return {
        path: join(homedir(), '.config', 'fish', 'completions', 'klee.fish'),
        followUp: null,
      };
  }
}

export async function installCompletion(shell: ShellId, dryRun: boolean): Promise<InstallResult> {
  const target = await resolveInstallTarget(shell);
  if (dryRun) return { ...target, shell, written: false };

  await mkdir(dirname(target.path), { recursive: true });
  await writeFile(target.path, completionFile(shell), 'utf8');
  return { ...target, shell, written: true };
}

export const SUPPORTED_SHELLS = SHELL_IDS;

/**
 * Premier dossier de `$fpath` où zsh charge les complétions tierces. On ne retient que les
 * `site-functions` : `$fpath` contient aussi les dossiers d'autres outils (Docker en pose
 * un), où déposer notre fichier serait s'inviter chez quelqu'un.
 */
async function zshTarget(): Promise<InstallTarget> {
  for (const dir of await zshFpath()) {
    if (dir.endsWith('site-functions') && (await writable(dir))) {
      return { path: join(dir, '_klee'), followUp: null };
    }
  }

  const fallback = join(homedir(), '.zsh', 'completions');
  return {
    path: join(fallback, '_klee'),
    followUp: `ajoutez « fpath=(${fallback} $fpath) » à ~/.zshrc, avant compinit`,
  };
}

async function zshFpath(): Promise<readonly string[]> {
  try {
    const { stdout } = await run('zsh', ['-c', 'print -l $fpath']);
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

async function writable(dir: string): Promise<boolean> {
  try {
    await access(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
