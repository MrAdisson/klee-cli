import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { formatIssues } from '../config/issues.js';
import { ConfigError } from '../errors.js';
import { mockupMetaSchema, type MockupMeta } from './schema.js';

/**
 * Lecture des métadonnées de maquettes (`mockups/**\/*.meta.yml`, TECHNICAL.md §4).
 *
 * Une maquette n'a pas de frontmatter : ses métadonnées vivent dans un fichier voisin,
 * parce que le HTML de la maquette doit rester servable tel quel par un navigateur.
 */

export const MOCKUPS_DIRNAME = 'mockups';

const META_FILE = /\.meta\.ya?ml$/;
const SKIPPED_DIRS = new Set(['node_modules', '_site', 'dist']);

export interface MockupFile {
  /** Chemin POSIX du `.meta.yml`, relatif à la racine du projet. */
  readonly path: string;
  readonly meta: MockupMeta;
  readonly title: string;
  /** Maquette décrite, si le fichier HTML voisin existe par convention de nommage. */
  readonly document: string;
}

export function mockupsDir(root: string): string {
  return join(root, MOCKUPS_DIRNAME);
}

export async function listMockupMetaFiles(root: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(mockupsDir(root), { recursive: true });
  } catch {
    return [];
  }

  return entries
    .map((entry) => entry.split(/[\\/]/))
    .filter((segments) => {
      const name = segments.at(-1);
      if (name === undefined || !META_FILE.test(name)) return false;
      return !segments.slice(0, -1).some((segment) => SKIPPED_DIRS.has(segment));
    })
    .map((segments) => `${MOCKUPS_DIRNAME}/${segments.join('/')}`)
    .sort();
}

export async function readMockups(root: string): Promise<MockupFile[]> {
  const files = await listMockupMetaFiles(root);
  return Promise.all(
    files.map(async (path) => parseMockupMeta(path, await readFile(join(root, path), 'utf8'))),
  );
}

export function parseMockupMeta(path: string, contents: string): MockupFile {
  let raw: unknown;
  try {
    raw = parseYaml(contents);
  } catch (cause) {
    throw new ConfigError(`${path} : YAML invalide.`, { code: 'MOCKUP_MALFORMED', cause });
  }

  const parsed = mockupMetaSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigError(
      `${path} ne respecte pas le format de métadonnées de maquette :\n${formatIssues(parsed.error.issues)}`,
      {
        code: 'MOCKUP_INVALID',
        hint: 'Une maquette porte au minimum `id: MOCK-xxx` (TECHNICAL.md §4).',
      },
    );
  }

  return {
    path,
    meta: parsed.data,
    title: parsed.data.title ?? path,
    document: path.replace(META_FILE, '.html'),
  };
}

/**
 * Tickets liés à une maquette. `ticket:` au singulier est la forme générée en phase 1 et
 * décrite par TECHNICAL.md §4 ; elle reste lue, mais n'est plus écrite (ADR 0010).
 */
export function mockupTickets(meta: MockupMeta): string[] {
  const tickets = [...meta.related_tickets];
  if (typeof meta.ticket === 'string' && !tickets.includes(meta.ticket)) {
    tickets.push(meta.ticket);
  }
  return tickets;
}
