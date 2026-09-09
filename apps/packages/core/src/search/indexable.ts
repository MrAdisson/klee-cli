import { parse as parseYaml } from 'yaml';

import { splitFrontmatter } from '../frontmatter.js';

/**
 * Texte réellement cherchable d'un artefact.
 *
 * Un fichier n'est pas cherchable tel quel : son frontmatter porte le **vocabulaire du
 * format** — `related_mockups`, `authored_by`, `depends_on` — que personne n'a écrit pour
 * être lu. Indexer ces clés faisait remonter les trente-sept artefacts du dépôt sur le mot
 * « mock », puisque chaque ticket et chaque document déclarent `related_mockups`.
 *
 * Les **valeurs**, elles, sont du contenu : `MOCK-001` dans `related_mockups` est
 * précisément l'arête qu'on cherche quand on ne se souvient plus de quel côté elle a été
 * déclarée. On garde donc les valeurs et on jette les clés.
 */

const META_FILE = /\.meta\.ya?ml$/;

export function indexableText(path: string, contents: string): string {
  if (META_FILE.test(path)) return yamlValues(contents);

  const split = splitFrontmatter(contents);
  if (split === null) return contents;
  return `${yamlValues(split.frontmatter)}\n${split.body}`;
}

/** Toutes les valeurs scalaires d'un document YAML, aplaties ; les clés sont écartées. */
function yamlValues(source: string): string {
  let parsed: unknown;
  try {
    parsed = parseYaml(source);
  } catch {
    // YAML illisible : mieux vaut chercher dans le texte brut que ne rien chercher du tout.
    return source;
  }

  const values: string[] = [];
  collect(parsed, values);
  return values.join(' ');
}

function collect(value: unknown, into: string[]): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) collect(item, into);
    return;
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value)) collect(item, into);
    return;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    into.push(String(value));
  }
}
