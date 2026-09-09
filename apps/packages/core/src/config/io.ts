import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, parse as parsePath, resolve } from 'node:path';

import { ConfigError } from '../errors.js';
import { jsonContents } from '../scaffold/format.js';
import { formatIssues } from './issues.js';
import { CONFIG_FILENAME, projectConfigSchema, type ProjectConfig } from './schema.js';
import { validateProjectConfig } from './validate.js';

export function configPath(root: string): string {
  return join(root, CONFIG_FILENAME);
}

/**
 * Remonte l'arborescence à la recherche de `project.config.json`. C'est ce qui permet
 * de lancer `klee` depuis n'importe quel sous-dossier du monorepo.
 */
export async function findProjectRoot(startDir: string): Promise<string | null> {
  let current = resolve(startDir);
  const { root } = parsePath(current);

  for (;;) {
    if (await fileExists(configPath(current))) {
      return current;
    }
    if (current === root) {
      return null;
    }
    current = dirname(current);
  }
}

export async function readProjectConfig(root: string): Promise<ProjectConfig> {
  const path = configPath(root);

  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (cause) {
    throw new ConfigError(`Aucun fichier ${CONFIG_FILENAME} lisible dans ${root}.`, {
      code: 'CONFIG_NOT_FOUND',
      hint: 'Lancez `klee init` pour créer le projet, ou placez-vous dans un projet Klee.',
      cause,
    });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    throw new ConfigError(`${path} n'est pas un JSON valide.`, { code: 'CONFIG_MALFORMED', cause });
  }

  const parsed = projectConfigSchema.safeParse(json);
  if (!parsed.success) {
    throw new ConfigError(
      `${path} ne respecte pas le schéma :\n${formatIssues(parsed.error.issues)}`,
    );
  }

  validateProjectConfig(parsed.data);
  return parsed.data;
}

export async function writeProjectConfig(root: string, config: ProjectConfig): Promise<void> {
  validateProjectConfig(config);
  await writeFile(configPath(root), jsonContents(config), 'utf8');
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
