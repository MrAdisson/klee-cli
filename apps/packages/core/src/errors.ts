/**
 * Erreurs du domaine. Elles portent un `code` stable et, quand c'est possible, un `hint`
 * actionnable : la CLI les rend telles quelles, sans stack trace, parce qu'une erreur de
 * configuration n'est pas un bug mais une réponse à corriger.
 */

export interface KeelErrorOptions {
  readonly code: string;
  readonly hint?: string;
  readonly cause?: unknown;
}

export class KeelError extends Error {
  readonly code: string;
  readonly hint: string | undefined;

  constructor(message: string, options: KeelErrorOptions) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'KeelError';
    this.code = options.code;
    this.hint = options.hint;
  }
}

export class ConfigError extends KeelError {
  constructor(message: string, options: Omit<KeelErrorOptions, 'code'> & { code?: string } = {}) {
    super(message, { ...options, code: options.code ?? 'CONFIG_INVALID' });
    this.name = 'ConfigError';
  }
}

export class UnknownProviderError extends KeelError {
  constructor(point: string, id: string, available: readonly string[]) {
    super(`Provider inconnu pour le point « ${point} » : "${id}".`, {
      code: 'PROVIDER_UNKNOWN',
      hint: `Providers disponibles : ${available.join(', ')}.`,
    });
    this.name = 'UnknownProviderError';
  }
}

export class ScaffoldConflictError extends KeelError {
  readonly conflicts: readonly string[];

  constructor(conflicts: readonly string[]) {
    super(
      `${String(conflicts.length)} fichier(s) existent déjà avec un contenu différent : ${conflicts.join(', ')}.`,
      {
        code: 'SCAFFOLD_CONFLICT',
        hint: 'Relancez avec --force pour les écraser, ou déplacez-les au préalable.',
      },
    );
    this.name = 'ScaffoldConflictError';
    this.conflicts = conflicts;
  }
}

export function isKeelError(value: unknown): value is KeelError {
  return value instanceof KeelError;
}
