import { spawn, type ChildProcess } from 'node:child_process';

import { KleeError } from '@klee/core';

/**
 * Cycle de vie des serveurs de développement que le studio agrège (ADR 0014).
 *
 * Le studio ne remplace ni Docusaurus ni Eleventy : il les lance tels quels et les affiche.
 * Chacun garde son processus, son rechargement à chaud et son port — c'est ce qui permet à
 * `klee docs serve` et `klee mockups serve` de rester utilisables seuls.
 *
 * **Le port n'est jamais supposé, toujours lu.** Eleventy comme Docusaurus glissent
 * silencieusement sur le port suivant quand le leur est pris ; un studio qui supposerait
 * 3000 afficherait un serveur lancé par quelqu'un d'autre en croyant montrer le sien. On
 * attend donc que l'enfant annonce son URL sur sa sortie, et c'est cette URL qui fait foi.
 */

export interface ChildServerSpec {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

export interface RunningChild {
  readonly id: string;
  readonly label: string;
  /** L'URL que le serveur a lui-même annoncée. */
  readonly url: string;
  stop(): Promise<void>;
}

/** Ce qu'un enfant écrit quand il est prêt : « Server at http://localhost:8080/ ». */
const ANNOUNCED_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d{2,5}\/?/;

/**
 * Les deux serveurs colorent leur sortie ; les séquences ANSI cassent la reconnaissance.
 *
 * Le caractère d'échappement fait partie du motif : sans lui, `[11ty]` en début de ligne
 * est pris pour une séquence de couleur et amputé.
 */
const ESC = String.fromCharCode(27);
const ANSI = new RegExp(`${ESC}\\[[0-9;]*[A-Za-z]`, 'g');

const DEFAULT_TIMEOUT_MS = 90_000;

export interface StartChildOptions {
  readonly timeoutMs?: number;
  /** Reçoit chaque ligne de l'enfant, pour la journaliser sans la mêler à la sortie du studio. */
  readonly onLine?: (line: string) => void;
}

export function startChildServer(
  spec: ChildServerSpec,
  options: StartChildOptions = {},
): Promise<RunningChild> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<RunningChild>((resolve, reject) => {
    // `detached` crée un groupe de processus : `pnpm run dev` n'est qu'un intermédiaire, et
    // ne tuer que lui laisserait Eleventy ou Docusaurus vivants sur leur port. C'est très
    // exactement le serveur oublié que `.agents/AGENTS.md` décrit.
    const child: ChildProcess = spawn(spec.command, [...spec.args], {
      cwd: spec.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      shell: process.platform === 'win32',
    });

    let settled = false;
    let buffer = '';
    // Un enfant qui meurt emporte la seule explication utile : on la garde pour la montrer.
    const recent: string[] = [];

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      void stopChild(child);
      reject(
        new KleeError(`« ${spec.label} » n'a pas annoncé d'URL en ${String(timeoutMs / 1000)} s.`, {
          code: 'STUDIO_CHILD_TIMEOUT',
          hint: `Lancez la commande à la main depuis ${spec.cwd} pour voir ce qu'elle dit.`,
        }),
      );
    }, timeoutMs);

    const settle = (url: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        id: spec.id,
        label: spec.label,
        url: url.endsWith('/') ? url : `${url}/`,
        stop: () => stopChild(child),
      });
    };

    const read = (chunk: Buffer): void => {
      const text = chunk.toString('utf8').replace(ANSI, '');
      for (const line of text.split('\n')) {
        if (line.trim() === '') continue;
        options.onLine?.(line.trimEnd());
        recent.push(line.trim());
        if (recent.length > 8) recent.shift();
      }
      if (settled) return;
      buffer += text;
      const match = ANNOUNCED_URL.exec(buffer);
      if (match !== null) settle(match[0]);
    };

    child.stdout?.on('data', read);
    child.stderr?.on('data', read);

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        error.code === 'ENOENT'
          ? new KleeError(`« ${spec.command} » est introuvable.`, {
              code: 'PACKAGE_MANAGER_MISSING',
              hint: `Installez-le, ou lancez « ${spec.label} » à la main depuis ${spec.cwd}.`,
              cause: error,
            })
          : error,
      );
    });

    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new KleeError(
          `« ${spec.label} » s'est arrêté (code ${String(code ?? 0)}) : ${lastMeaningful(recent)}`,
          {
            code: 'STUDIO_CHILD_FAILED',
            hint: `Lancez la commande à la main depuis ${spec.cwd} pour voir ce qu'elle dit.`,
          },
        ),
      );
    });
  });
}

/** La dernière ligne qui ressemble à une explication, plutôt qu'un « code 0 » muet. */
function lastMeaningful(lines: readonly string[]): string {
  const blamed = [...lines].reverse().find((line) => /error|erreur|already|EADDRINUSE/i.test(line));
  return blamed ?? lines.at(-1) ?? 'aucune sortie.';
}

/** Arrête le groupe de processus, puis n'insiste pas plus de deux secondes. */
function stopChild(child: ChildProcess): Promise<void> {
  return new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) {
      resolve();
      return;
    }

    const done = (): void => {
      clearTimeout(timer);
      resolve();
    };
    child.once('exit', done);

    signal(child, 'SIGTERM');
    const timer = setTimeout(() => {
      signal(child, 'SIGKILL');
      resolve();
    }, 2000);
  });
}

function signal(child: ChildProcess, name: NodeJS.Signals): void {
  try {
    if (process.platform !== 'win32' && child.pid !== undefined) {
      process.kill(-child.pid, name);
    } else {
      child.kill(name);
    }
  } catch {
    // L'enfant est déjà mort, ou son groupe n'existe plus : il n'y a rien à réparer.
  }
}
