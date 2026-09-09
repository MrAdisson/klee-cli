import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

import { ScaffoldConflictError } from '../errors.js';
import type { ScaffoldPlan } from './types.js';

export interface ApplyScaffoldOptions {
  /** Racine du projet cible. */
  readonly root: string;
  /** N'écrit rien : sert à afficher le résultat exact d'une exécution réelle. */
  readonly dryRun?: boolean;
  /**
   * Que faire d'un fichier existant dont le contenu diffère du plan.
   *
   * - `fail` (défaut) : refuser le plan entier. Le bon réflexe pour un scaffolding initial,
   *   où un fichier divergent signale qu'on écrit dans un projet qu'on croyait vide.
   * - `overwrite` : écraser. Ne doit jamais être un défaut : à ce stade le contenu écrasé
   *   peut être le travail d'un humain, et rien ne le distingue d'un fichier généré.
   * - `skip` : laisser le fichier tel quel, écrire les autres, et le signaler. C'est le seul
   *   comportement acceptable pour une régénération partielle (`module add --refresh-root`),
   *   qui vise à ajouter ce qui manque, pas à reprendre la main sur ce qui existe.
   */
  readonly onConflict?: ConflictBehaviour;
}

export type ConflictBehaviour = 'fail' | 'overwrite' | 'skip';

export type FileOutcome = 'created' | 'unchanged' | 'overwritten' | 'conflict' | 'skipped';

export interface AppliedFile {
  readonly path: string;
  readonly origin: string;
  readonly outcome: FileOutcome;
}

export interface ApplyScaffoldResult {
  readonly root: string;
  readonly dryRun: boolean;
  readonly files: readonly AppliedFile[];
}

/**
 * Écrit un plan sur le disque en deux temps : on classe d'abord tous les fichiers, puis on
 * n'écrit que si rien ne bloque. Un scaffolding à moitié appliqué est pire qu'un
 * scaffolding refusé — il laisse un projet dans un état que personne n'a décidé.
 */
export async function applyScaffoldPlan(
  plan: ScaffoldPlan,
  options: ApplyScaffoldOptions,
): Promise<ApplyScaffoldResult> {
  const root = resolve(options.root);
  const dryRun = options.dryRun ?? false;
  const onConflict = options.onConflict ?? 'fail';

  const classified: AppliedFile[] = [];
  const outcomes = new Map<string, FileOutcome>();

  for (const file of plan.files) {
    const absolute = resolveInsideRoot(root, file.path);
    const existing = await readIfExists(absolute);
    const outcome: FileOutcome =
      existing === null
        ? 'created'
        : existing === file.contents
          ? 'unchanged'
          : onConflict === 'overwrite'
            ? 'overwritten'
            : onConflict === 'skip'
              ? 'skipped'
              : 'conflict';
    classified.push({ path: file.path, origin: file.origin, outcome });
    outcomes.set(file.path, outcome);
  }

  const conflicts = classified.filter((file) => file.outcome === 'conflict');
  if (conflicts.length > 0) {
    throw new ScaffoldConflictError(conflicts.map((file) => file.path));
  }

  if (!dryRun) {
    for (const file of plan.files) {
      const outcome = outcomes.get(file.path);
      // Un fichier inchangé n'a rien à recevoir ; un fichier ignoré appartient à son auteur.
      if (outcome === 'unchanged' || outcome === 'skipped') continue;

      const absolute = resolveInsideRoot(root, file.path);
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, file.contents, 'utf8');
    }
  }

  return { root, dryRun, files: classified };
}

/** Aucun plan ne doit pouvoir écrire hors de la racine du projet. */
function resolveInsideRoot(root: string, relativePath: string): string {
  const absolute = resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(root + sep)) {
    throw new Error(`Chemin hors de la racine du projet : ${relativePath}`);
  }
  return absolute;
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
