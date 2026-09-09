import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';

/**
 * Catalogue auto-généré (DESIGN.md §3) : la liste des composants et de leurs états déclarés
 * est dérivée des `.meta.yml`, jamais maintenue à la main. Une liste écrite à la main finit
 * toujours par mentir sur le contenu réel du dossier.
 */
export default async function catalogue() {
  const root = new URL('../components/', import.meta.url).pathname;
  const entries = await readdir(root, { withFileTypes: true });
  const components = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = join(root, entry.name, `${entry.name}.meta.yml`);
    try {
      const meta = parse(await readFile(metaPath, 'utf8'));
      components.push({ ...meta, slug: entry.name, url: `/components/${entry.name}/` });
    } catch {
      // Un composant sans .meta.yml est invisible du graphe de traçabilité : on le signale
      // dans le catalogue plutôt que de le masquer.
      components.push({ slug: entry.name, url: `/components/${entry.name}/`, missingMeta: true });
    }
  }

  return components.sort((a, b) => a.slug.localeCompare(b.slug));
}
