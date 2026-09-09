import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { formatIssues } from '../config/issues.js';
import { ConfigError } from '../errors.js';
import { headingTitle, splitFrontmatter } from '../frontmatter.js';
import { docFrontmatterSchema, type DocFrontmatter } from './schema.js';

/**
 * Lecture des documents de `docs/` (TECHNICAL.md §5).
 *
 * Le frontmatter est ce qui rend une doc visible du graphe : sans `id`, rien ne peut la
 * référencer. Une doc sans identifiant n'est donc pas une erreur de lecture — c'est un
 * fichier qu'on rapporte à part, pour qu'il soit corrigé plutôt qu'ignoré.
 */

export const DOCS_DIRNAME = 'docs';

const MARKDOWN = /\.mdx?$/;

/**
 * Dossiers écartés de la lecture.
 *
 * `_generated/` en fait partie : ce qu'on y écrit est une *vue* du graphe, produite à
 * partir de lui. L'y réinjecter comme nœud ferait du rapport une source, et chaque
 * régénération ajouterait ses propres arêtes aux précédentes.
 */
const SKIPPED_DIRS = new Set(['node_modules', 'build', '.docusaurus', '_generated']);

/** `AGENTS.md` est du contexte d'agent, pas un document du projet : il n'a pas d'identifiant. */
const SKIPPED_FILES = new Set(['AGENTS.md']);

/**
 * Fichiers de la racine de `docs/` qui relèvent du site, pas de la documentation : la page
 * d'accueil qu'engendre le provider docs-as-code. Un document du projet vit dans une
 * section (`technical/`, `decisions/`…), pas à la racine.
 */
const SKIPPED_ROOT_FILES = new Set(['index.md', 'index.mdx']);

export interface DocFile {
  /** Chemin POSIX relatif à la racine du projet. */
  readonly path: string;
  readonly frontmatter: DocFrontmatter;
  readonly title: string;
  readonly body: string;
}

export interface ReadDocsResult {
  readonly docs: readonly DocFile[];
  /** Fichiers markdown de `docs/` dépourvus de frontmatter `id`. */
  readonly untracked: readonly string[];
}

export function docsDir(root: string): string {
  return join(root, DOCS_DIRNAME);
}

export async function listDocFiles(root: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(docsDir(root), { recursive: true });
  } catch {
    return [];
  }

  return entries
    .map((entry) => entry.split(/[\\/]/))
    .filter((segments) => {
      const name = segments.at(-1);
      if (name === undefined || !MARKDOWN.test(name) || SKIPPED_FILES.has(name)) return false;
      if (segments.length === 1 && SKIPPED_ROOT_FILES.has(name)) return false;
      return !segments.slice(0, -1).some((segment) => SKIPPED_DIRS.has(segment));
    })
    .map((segments) => `${DOCS_DIRNAME}/${segments.join('/')}`)
    .sort();
}

export async function readDocs(root: string): Promise<ReadDocsResult> {
  const docs: DocFile[] = [];
  const untracked: string[] = [];

  for (const path of await listDocFiles(root)) {
    const contents = await readFile(join(root, path), 'utf8');
    const doc = parseDoc(path, contents);
    if (doc === null) untracked.push(path);
    else docs.push(doc);
  }

  return { docs, untracked };
}

/**
 * `null` quand le fichier n'a pas de frontmatter du tout : c'est le cas d'une page libre,
 * signalé sans faire échouer la lecture. Un frontmatter *présent mais invalide*, lui, est
 * une erreur : quelqu'un a voulu décrire une arête et s'y est pris de travers.
 */
export function parseDoc(path: string, contents: string): DocFile | null {
  const split = splitFrontmatter(contents);
  if (split === null) return null;

  let raw: unknown;
  try {
    raw = parseYaml(split.frontmatter);
  } catch (cause) {
    throw new ConfigError(`${path} : frontmatter YAML invalide.`, { code: 'DOC_MALFORMED', cause });
  }

  if (raw === null || typeof raw !== 'object' || !('id' in raw)) return null;

  const parsed = docFrontmatterSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigError(
      `${path} ne respecte pas le frontmatter de document :\n${formatIssues(parsed.error.issues)}`,
      {
        code: 'DOC_INVALID',
        hint: 'Un document porte au minimum `id: DOC-xxx` (TECHNICAL.md §5).',
      },
    );
  }

  return {
    path,
    frontmatter: parsed.data,
    title: parsed.data.title ?? headingTitle(split.body) ?? path,
    body: split.body,
  };
}
