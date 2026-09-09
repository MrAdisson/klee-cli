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

/**
 * Une dépendance qu'un module retenu apporte au projet généré (TECHNICAL.md §13 :
 * « un module non retenu ne génère aucun fichier, **aucune dépendance** »).
 *
 * Elle est *déclarée*, pas installée : le plan la fusionne dans le `package.json` cible, et
 * l'installation reste une étape explicite (`klee init --install`). Un scaffolding qui
 * télécharge le réseau sans qu'on le lui demande n'est plus inspectable en `--dry-run`.
 */
export interface ScaffoldDependency {
  readonly name: string;
  /** Version épinglée par le provider — pas de résolution surprise entre deux exécutions. */
  readonly version: string;
  readonly dev: boolean;
  /** `package.json` qui la reçoit, chemin POSIX relatif à la racine. */
  readonly target: string;
  readonly origin: string;
}

export interface ScaffoldPlan {
  readonly files: readonly ScaffoldFile[];
  readonly dependencies: readonly ScaffoldDependency[];
  /** Commande d'installation déclarée par le provider `workspace`, si le module `apps` est retenu. */
  readonly installCommand: readonly string[] | null;
}

/**
 * Générateur : implémenté par les modules comme par les providers. `files` est obligatoire,
 * `dependencies` ne l'est que pour ceux qui en apportent réellement.
 */
export interface ScaffoldGenerator {
  files(context: ScaffoldContext): ScaffoldFile[];
  dependencies?(context: ScaffoldContext): ScaffoldDependency[];
  /**
   * Scripts de post-installation qu'apportent les dépendances déclarées ici, et la décision
   * prise pour chacun (ADR 0012). Porté par le générateur plutôt que par le seul provider :
   * un module qui apporte une dépendance à post-installation doit pouvoir la trancher sans
   * la faire porter à un provider qui n'en est pas la cause.
   */
  readonly installScripts?: Readonly<Record<string, boolean>>;
}
