/**
 * Découpe d'un fichier markdown en frontmatter et corps.
 *
 * Partagé par les tickets et par les documents : les deux portent le même dispositif —
 * un bloc `---` pour ce qu'une machine doit lire, du markdown pour ce qu'un humain doit
 * comprendre (TECHNICAL.md §5, §6).
 */

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface SplitDocument {
  /** Contenu YAML brut du bloc, sans les délimiteurs. */
  readonly frontmatter: string;
  readonly body: string;
}

/** `null` si le fichier n'ouvre pas sur un bloc `---` : il n'a pas de frontmatter. */
export function splitFrontmatter(contents: string): SplitDocument | null {
  const match = FRONTMATTER.exec(contents);
  if (match === null || match[1] === undefined) return null;
  return { frontmatter: match[1], body: contents.slice(match[0].length) };
}

/**
 * Titre lisible d'un document : le champ `title` s'il existe, sinon le premier titre de
 * niveau 1 du corps. Une doc n'a pas à répéter son titre dans son frontmatter pour être
 * nommée correctement dans le graphe.
 */
export function headingTitle(body: string): string | null {
  const match = /^#\s+(.+?)\s*$/m.exec(body);
  return match?.[1] ?? null;
}
