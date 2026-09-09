import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { ConfigError } from '../errors.js';
import { formatIssues } from '../config/issues.js';
import { splitFrontmatter } from '../frontmatter.js';
import { textContents } from '../scaffold/format.js';
import {
  ACCEPTANCE_HEADING,
  ticketFrontmatterSchema,
  type Ticket,
  type TicketFrontmatter,
} from './schema.js';

/**
 * Lecture et écriture d'un ticket. Le fichier markdown reste la source de vérité : rien ici
 * ne met en cache, ne réordonne ni n'enrichit silencieusement — un ticket relu puis réécrit
 * doit produire le même fichier, sinon le diff git devient illisible.
 */

const GHERKIN_BLOCK = /```gherkin\r?\n([\s\S]*?)```/g;

/** Ordre d'écriture du frontmatter : identité, état, puis arêtes du graphe. */
const KEY_ORDER: readonly (keyof TicketFrontmatter)[] = [
  'id',
  'title',
  'status',
  'assignee',
  'created',
  'updated',
  'depends_on',
  'related_mockups',
  'related_docs',
  'authored_by',
];

export function parseTicket(path: string, contents: string): Ticket {
  const split = splitFrontmatter(contents);
  if (split === null) {
    throw new ConfigError(`${path} n'a pas de frontmatter : ce n'est pas un ticket.`, {
      code: 'TICKET_MALFORMED',
      hint: 'Un ticket commence par un bloc `---` contenant au moins `id`, `title` et `status`.',
    });
  }

  let raw: unknown;
  try {
    raw = parseYaml(split.frontmatter);
  } catch (cause) {
    throw new ConfigError(`${path} : frontmatter YAML invalide.`, {
      code: 'TICKET_MALFORMED',
      cause,
    });
  }

  const parsed = ticketFrontmatterSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigError(
      `${path} ne respecte pas le format de ticket :\n${formatIssues(parsed.error.issues)}`,
      {
        code: 'TICKET_INVALID',
      },
    );
  }

  const { body } = split;
  return { ...parsed.data, path, body, acceptance: extractAcceptance(body) };
}

export function serializeTicket(ticket: TicketFrontmatter, body: string): string {
  const ordered: Record<string, unknown> = {};
  for (const key of KEY_ORDER) {
    ordered[key] = ticket[key];
  }

  const frontmatter = stringifyYaml(ordered, { lineWidth: 0 }).trimEnd();
  return `---\n${frontmatter}\n---\n\n${body.replace(/^\n+/, '').trimEnd()}\n`;
}

/**
 * Les critères d'acceptation vivent dans des blocs ```gherkin du corps, pas dans le
 * frontmatter (ADR 0008) : l'objectif du brief est qu'ils soient exécutables, donc
 * extractibles — pas qu'ils soient du YAML.
 */
export function extractAcceptance(body: string): string {
  const blocks: string[] = [];
  for (const match of body.matchAll(GHERKIN_BLOCK)) {
    if (match[1] !== undefined) blocks.push(match[1].trimEnd());
  }
  return blocks.join('\n\n');
}

/** Corps d'un ticket neuf : une amorce, pas un formulaire à remplir aveuglément. */
export function newTicketBody(description?: string): string {
  return textContents(`${description ?? '_À décrire._'}

## ${ACCEPTANCE_HEADING}

\`\`\`gherkin
Scénario: à écrire
  Étant donné un contexte
  Quand une action a lieu
  Alors un résultat vérifiable est observable
\`\`\``);
}
