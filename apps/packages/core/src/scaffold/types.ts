import type { ProjectConfig } from '../config/schema.js';
import type { ProviderRegistry } from '../providers/registry.js';

/** Contexte transmis à chaque générateur (module ou provider). */
export interface ScaffoldContext {
  readonly config: ProjectConfig;
  /** Horloge injectée : un plan doit être reproductible à date fixée (tests, diffs). */
  readonly now: Date;
  /** Registre résolvant les providers — injecté plutôt qu'importé, pour rester testable. */
  readonly registry: ProviderRegistry;
}

/**
 * Un fichier à écrire, décrit sans effet de bord : c'est ce qui rend le plan
 * inspectable (`--dry-run`), testable, et la détection de conflit possible avant
 * la moindre écriture.
 */
export interface ScaffoldFile {
  /** Chemin POSIX relatif à la racine du projet. */
  readonly path: string;
  readonly contents: string;
  /** Ce qui a produit le fichier : `module:tickets`, `provider:workspace/pnpm-turborepo`. */
  readonly origin: string;
}

export interface ScaffoldPlan {
  readonly files: readonly ScaffoldFile[];
}

/** Générateur de fichiers : implémenté par les modules comme par les providers. */
export interface ScaffoldGenerator {
  files(context: ScaffoldContext): ScaffoldFile[];
}
