import {
  OPTIONAL_MODULE_IDS,
  PRESET_IDS,
  TICKET_STATUSES,
  buildTraceGraph,
  findProjectRoot,
  readProjectConfig,
  type EntityKind,
} from '@klee/core';
import type { Command, Option } from 'commander';

/**
 * Candidats de complétion (`klee __complete`).
 *
 * L'arbre des commandes n'est jamais redécrit ici : il est lu dans Commander, donc une
 * commande ajoutée dans `program.ts` se complète sans que ce fichier bouge. Seules les
 * **valeurs** d'arguments sont déclarées ci-dessous, puisqu'elles viennent du domaine.
 *
 * Compléter les identifiants n'est pas un confort : `KLEE-xxx`, `MOCK-xxx` et `DOC-xxx` sont
 * les arêtes du graphe. Les proposer supprime la faute de frappe que `klee links check` ne
 * peut que constater après coup.
 */

/** Shells pour lesquels `klee completion` sait émettre un script. */
export const SHELL_IDS = ['bash', 'zsh', 'fish'] as const;

export type ShellId = (typeof SHELL_IDS)[number];

export function isShellId(value: string): value is ShellId {
  return (SHELL_IDS as readonly string[]).includes(value);
}

interface CompletionContext {
  /** Racine du projet, ou `null` hors d'un projet Klee — la complétion reste utile. */
  readonly root: string | null;
}

type Source = (context: CompletionContext) => Promise<readonly string[]>;

const constant =
  (values: readonly string[]): Source =>
  () =>
    Promise.resolve(values);

const entityIds =
  (kind?: EntityKind): Source =>
  async ({ root }) => {
    if (root === null) return [];
    const { idPrefix } = await readProjectConfig(root);
    const graph = await buildTraceGraph({ root, ticketPrefix: idPrefix });
    return graph.nodes.filter((node) => kind === undefined || node.kind === kind).map((n) => n.id);
  };

/** Modules optionnels selon qu'ils sont déjà retenus ou non : `add` et `remove` s'excluent. */
const optionalModules =
  (enabled: boolean): Source =>
  async ({ root }) => {
    if (root === null) return OPTIONAL_MODULE_IDS;
    const config = await readProjectConfig(root);
    return OPTIONAL_MODULE_IDS.filter((id) => config.modules[id] === enabled);
  };

const ticketIds = entityIds('ticket');
const statuses = constant(TICKET_STATUSES);

/** Valeurs des arguments positionnels, par chemin de commande puis par position. */
const ARGUMENT_SOURCES: Readonly<Record<string, readonly Source[]>> = {
  'ticket move': [ticketIds, statuses],
  'ticket show': [ticketIds],
  'links show': [entityIds()],
  'module add': [optionalModules(false)],
  'module remove': [optionalModules(true)],
  completion: [constant(SHELL_IDS)],
  'completion install': [constant(SHELL_IDS)],
};

/** Valeurs des options qui en attendent une, par `<chemin de commande> <option longue>`. */
const OPTION_SOURCES: Readonly<Record<string, Source>> = {
  'ticket create --status': statuses,
  'ticket list --status': statuses,
  'init --preset': constant(PRESET_IDS),
};

export async function completionCandidates(
  program: Command,
  words: readonly string[],
): Promise<readonly string[]> {
  const current = words.length === 0 ? '' : (words[words.length - 1] ?? '');
  const before = words.slice(0, -1);
  const { command, rest } = resolveCommand(program, before);
  const path = commandPath(command);

  const candidates = await candidatesFor(command, path, rest, current);
  return candidates.filter((value) => value.startsWith(current));
}

async function candidatesFor(
  command: Command,
  path: string,
  rest: readonly string[],
  current: string,
): Promise<readonly string[]> {
  const context: CompletionContext = { root: await projectRoot() };

  // Une option attend une valeur : c'est elle qu'on complète, rien d'autre.
  const last = rest[rest.length - 1];
  const pending = last === undefined ? undefined : pendingOptionValue(command, last);
  if (pending !== undefined) {
    return await read(OPTION_SOURCES[`${path} ${pending}`], context);
  }

  if (current.startsWith('-')) {
    return command.options.filter((option) => !option.hidden).map((option) => option.long ?? '');
  }

  const subcommands = command.commands
    .filter((child) => !isHidden(child))
    .map((child) => child.name());

  const source = ARGUMENT_SOURCES[path]?.[positionalIndex(command, rest)];
  return [...subcommands, ...(await read(source, context))];
}

async function read(source: Source | undefined, context: CompletionContext): Promise<string[]> {
  if (source === undefined) return [];
  try {
    return [...(await source(context))];
  } catch {
    // Une complétion ne diagnostique pas : un projet illisible rend la main en silence
    // plutôt que de polluer le terminal pendant que l'utilisateur tape.
    return [];
  }
}

async function projectRoot(): Promise<string | null> {
  try {
    return await findProjectRoot(process.cwd());
  } catch {
    return null;
  }
}

function resolveCommand(
  program: Command,
  words: readonly string[],
): { command: Command; rest: readonly string[] } {
  let command = program;
  let index = 0;

  while (index < words.length) {
    const word = words[index] ?? '';
    const child = command.commands.find(
      (candidate) => candidate.name() === word || candidate.aliases().includes(word),
    );
    if (child === undefined) break;
    command = child;
    index += 1;
  }

  return { command, rest: words.slice(index) };
}

function commandPath(command: Command): string {
  const parts: string[] = [];
  for (let node: Command | null = command; node?.parent != null; node = node.parent) {
    parts.unshift(node.name());
  }
  return parts.join(' ');
}

/** Nom long de l'option dont la valeur reste à saisir, si le dernier mot en est une. */
function pendingOptionValue(command: Command, word: string): string | undefined {
  if (!word.startsWith('-') || word.includes('=')) return undefined;
  const option = findOption(command, word);
  return option !== undefined && takesValue(option) ? (option.long ?? undefined) : undefined;
}

function positionalIndex(command: Command, rest: readonly string[]): number {
  let count = 0;

  for (let index = 0; index < rest.length; index += 1) {
    const word = rest[index] ?? '';
    if (!word.startsWith('-')) {
      count += 1;
      continue;
    }
    if (word.includes('=')) continue;
    const option = findOption(command, word);
    if (option !== undefined && takesValue(option)) index += 1;
  }

  return count;
}

function findOption(command: Command, flag: string): Option | undefined {
  return command.options.find((option) => option.long === flag || option.short === flag);
}

function takesValue(option: Option): boolean {
  return option.required || option.optional;
}

function isHidden(command: Command): boolean {
  return (command as unknown as { _hidden?: boolean })._hidden === true;
}
