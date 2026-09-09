import {
  KeelError,
  findProjectRoot,
  providerRegistry,
  readProjectConfig,
  type ProjectConfig,
  type TicketIndex,
} from '@keel/core';

/** Projet Keel résolu depuis le dossier courant, avec sa configuration validée. */
export interface Project {
  readonly root: string;
  readonly config: ProjectConfig;
}

export async function loadProject(): Promise<Project> {
  const root = await findProjectRoot(process.cwd());
  if (root === null) {
    throw new KeelError('Aucun projet Keel trouvé depuis le dossier courant.', {
      code: 'PROJECT_NOT_FOUND',
      hint: 'Lancez `klee init` pour en créer un.',
    });
  }
  return { root, config: await readProjectConfig(root) };
}

/**
 * Résout l'index de tickets déclaré par la configuration. C'est la factory du §13 appliquée
 * à du comportement plutôt qu'à des fichiers : la CLI ignore si elle lit du markdown ou du
 * SQLite.
 */
export function openTicketIndex(project: Project): TicketIndex {
  const provider = providerRegistry.resolve(
    'tickets-index',
    project.config.providers['tickets-index'],
  );
  if (provider.ticketIndex === undefined) {
    throw new KeelError(
      `Le provider d'indexation « ${provider.label} » ne sait pas lire les tickets.`,
      { code: 'PROVIDER_NO_INDEX' },
    );
  }
  return provider.ticketIndex.create(project.root);
}
