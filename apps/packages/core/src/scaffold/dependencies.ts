import { jsonContents } from './format.js';
import type { ScaffoldDependency, ScaffoldFile } from './types.js';

/**
 * Fusionne les dépendances déclarées dans les `package.json` du plan.
 *
 * La fusion se fait sur le plan, pas sur le disque : le `package.json` généré contient déjà
 * ses dépendances avant la moindre écriture, donc `--dry-run` en rend compte fidèlement et la
 * détection de conflit porte sur le fichier final.
 */
export function mergeDependencies(
  files: readonly ScaffoldFile[],
  dependencies: readonly ScaffoldDependency[],
): ScaffoldFile[] {
  if (dependencies.length === 0) {
    return [...files];
  }

  assertNoVersionConflict(dependencies);

  const byTarget = new Map<string, ScaffoldDependency[]>();
  for (const dependency of dependencies) {
    const bucket = byTarget.get(dependency.target);
    if (bucket === undefined) {
      byTarget.set(dependency.target, [dependency]);
    } else {
      bucket.push(dependency);
    }
  }

  const result = files.map((file) => {
    const targeted = byTarget.get(file.path);
    if (targeted === undefined) return file;
    byTarget.delete(file.path);
    return { ...file, contents: applyToManifest(file, targeted) };
  });

  // Une dépendance dont le package.json cible n'est pas généré n'a nulle part où atterrir :
  // c'est une erreur de conception du provider, pas un cas à ignorer silencieusement.
  const orphans = [...byTarget.entries()];
  if (orphans.length > 0) {
    const details = orphans
      .map(([target, deps]) => `${target} (demandé par ${deps.map((d) => d.origin).join(', ')})`)
      .join(' ; ');
    throw new Error(`Dépendances déclarées vers un package.json absent du plan : ${details}.`);
  }

  return result;
}

function applyToManifest(file: ScaffoldFile, dependencies: readonly ScaffoldDependency[]): string {
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(file.contents) as Record<string, unknown>;
  } catch (cause) {
    throw new Error(
      `${file.path} n'est pas un JSON valide : impossible d'y fusionner des dépendances.`,
      {
        cause,
      },
    );
  }

  const runtime = collect(dependencies, false);
  const dev = collect(dependencies, true);

  if (Object.keys(runtime).length > 0) {
    manifest['dependencies'] = sortKeys({
      ...asRecord(manifest['dependencies']),
      ...runtime,
    });
  }
  if (Object.keys(dev).length > 0) {
    manifest['devDependencies'] = sortKeys({
      ...asRecord(manifest['devDependencies']),
      ...dev,
    });
  }

  return jsonContents(manifest);
}

function collect(
  dependencies: readonly ScaffoldDependency[],
  dev: boolean,
): Record<string, string> {
  return Object.fromEntries(
    dependencies.filter((d) => d.dev === dev).map((d) => [d.name, d.version]),
  );
}

function asRecord(value: unknown): Record<string, string> {
  return typeof value === 'object' && value !== null ? (value as Record<string, string>) : {};
}

/** Les gestionnaires de paquets trient les dépendances : produire du non-trié crée du diff parasite. */
function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

function assertNoVersionConflict(dependencies: readonly ScaffoldDependency[]): void {
  const seen = new Map<string, ScaffoldDependency>();
  for (const dependency of dependencies) {
    const key = `${dependency.target}::${dependency.name}`;
    const previous = seen.get(key);
    if (previous !== undefined && previous.version !== dependency.version) {
      throw new Error(
        `Versions incompatibles pour ${dependency.name} dans ${dependency.target} : ` +
          `${previous.version} (${previous.origin}) puis ${dependency.version} (${dependency.origin}).`,
      );
    }
    seen.set(key, dependency);
  }
}
