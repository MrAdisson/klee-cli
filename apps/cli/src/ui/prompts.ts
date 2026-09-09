import { cancel, confirm, isCancel, multiselect, select, text } from '@clack/prompts';
import {
  MODULES,
  OPTIONAL_MODULE_IDS,
  PROJECT_NAME_PATTERN,
  PROVIDER_POINT_DEFINITIONS,
  REQUIRED_TOKEN_TARGET,
  TOKEN_TARGETS,
  isValidIdPrefix,
  type ModuleId,
  type ProviderPoint,
  type ProviderRegistry,
  type TokenTarget,
} from '@klee/core';

/**
 * Mode interactif (TECHNICAL.md §13) : d'abord les modules, puis — pour chaque module
 * retenu seulement — les questions de provider applicables.
 */

function ensure<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Interrompu — aucun fichier écrit.');
    process.exit(130);
  }
  // `isCancel` ne restreint que le cas symbole ; TypeScript ne peut pas soustraire
  // `symbol` d'un générique, d'où l'assertion.
  return value as T;
}

export async function askInstallDependencies(command: string): Promise<boolean> {
  return ensure(
    await confirm({
      message: `Installer les dépendances maintenant (${command}) ?`,
      initialValue: true,
    }),
  );
}

export async function askTargetDirectory(): Promise<string> {
  return ensure(
    await text({
      message: 'Où scaffolder le projet ? (`.` pour le dossier courant)',
      initialValue: '.',
      validate: (value) =>
        value !== undefined && value.trim() !== '' ? undefined : 'Indiquez un chemin.',
    }),
  );
}

export async function askProjectName(initialValue: string): Promise<string> {
  return ensure(
    await text({
      message: 'Nom du projet',
      initialValue,
      validate: (value) =>
        value !== undefined && PROJECT_NAME_PATTERN.test(value)
          ? undefined
          : 'Minuscules, chiffres, tirets, points ou underscores ; doit commencer par une lettre ou un chiffre.',
    }),
  );
}

export async function askIdPrefix(initialValue: string): Promise<string> {
  return ensure(
    await text({
      message: 'Préfixe des identifiants de tickets (ex. PROJ-123)',
      initialValue,
      validate: (value) =>
        value !== undefined && isValidIdPrefix(value)
          ? undefined
          : '2 à 10 caractères, majuscules et chiffres, commençant par une lettre.',
    }),
  );
}

export async function askOptionalModules(initialValues: readonly ModuleId[]): Promise<ModuleId[]> {
  return ensure(
    await multiselect<ModuleId>({
      message: 'Quels modules inclure ? (le socle est toujours présent)',
      options: OPTIONAL_MODULE_IDS.map((id) => ({
        value: id,
        label: MODULES[id].label,
        hint: MODULES[id].hint,
      })),
      initialValues: [...initialValues],
      required: false,
    }),
  );
}

/**
 * `proposed` : le défaut que le preset suggère pour ce point. Il ne fait que présélectionner
 * la réponse — la liste complète reste offerte (ADR 0012).
 */
export async function askProvider(
  point: ProviderPoint,
  registry: ProviderRegistry,
  proposed?: string,
): Promise<string> {
  const definition = PROVIDER_POINT_DEFINITIONS[point];
  const providers = registry.list(point);

  return ensure(
    await select<string>({
      message: `${definition.question} ${definition.reference}`,
      initialValue: proposed ?? definition.defaultProvider,
      options: providers.map((provider) => ({
        value: provider.id,
        label: provider.label,
        hint: provider.description,
      })),
    }),
  );
}

export async function askTokenTargets(): Promise<TokenTarget[]> {
  const selected = ensure(
    await multiselect<TokenTarget>({
      message: 'Cibles de build des design tokens (TECHNICAL.md §3)',
      options: TOKEN_TARGETS.map((target) => ({
        value: target,
        label: target,
        hint:
          target === REQUIRED_TOKEN_TARGET
            ? 'socle universel, toujours généré'
            : target === 'js'
              ? 'constantes JS/TS, si apps/ en a besoin'
              : 'thème Tailwind v4, si le stack front l’utilise',
      })),
      initialValues: [REQUIRED_TOKEN_TARGET],
      required: false,
    }),
  );

  return selected;
}
