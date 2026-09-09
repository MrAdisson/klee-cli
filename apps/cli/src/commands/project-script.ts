import { join } from 'node:path';

import {
  KeelError,
  MODULES,
  findProjectRoot,
  providerRegistry,
  readProjectConfig,
  type ModuleId,
} from '@keel/core';

import { info, write } from '../ui/output.js';
import { directoryExists } from '../fs.js';
import { spawnInherit } from '../spawn.js';

/**
 * Lance un script du projet généré, avec le gestionnaire de paquets que son provider
 * `workspace` a déclaré.
 *
 * Keel n'embarque ni Style Dictionary ni Eleventy : c'est le projet qui possède son
 * outillage. `klee tokens build` est un raccourci, jamais un passage obligé — le projet
 * reste entièrement utilisable sans klee installé.
 */
export interface RunProjectScriptOptions {
  /** Dossier du package qui porte le script, relatif à la racine du projet. */
  readonly directory: string;
  readonly script: string;
  /** Module dont dépend ce script : absent, la commande n'a pas de sens. */
  readonly requiresModule: ModuleId;
}

export async function runProjectScript(options: RunProjectScriptOptions): Promise<void> {
  const root = await findProjectRoot(process.cwd());
  if (root === null) {
    throw new KeelError('Aucun projet Keel trouvé depuis le dossier courant.', {
      code: 'PROJECT_NOT_FOUND',
      hint: 'Lancez `klee init` pour en créer un.',
    });
  }

  const config = await readProjectConfig(root);

  if (!config.modules[options.requiresModule]) {
    throw new KeelError(
      `Le module « ${MODULES[options.requiresModule].label} » n'est pas retenu dans ce projet.`,
      {
        code: 'MODULE_ABSENT',
        hint: `Ajoutez-le avec \`klee module add ${options.requiresModule}\`.`,
      },
    );
  }

  const workspace = providerRegistry.resolve('workspace', config.providers.workspace);
  if (workspace.workspace === undefined) {
    throw new KeelError(
      `Le provider workspace « ${workspace.label} » ne déclare pas de commande d'exécution.`,
      { code: 'PROVIDER_NO_COMMANDS' },
    );
  }

  const cwd = join(root, options.directory);
  if (!(await directoryExists(cwd))) {
    throw new KeelError(`${options.directory}/ est absent de ce projet.`, {
      code: 'DIRECTORY_MISSING',
      hint: 'Le module est déclaré mais ses fichiers ne sont pas générés — `klee module add --refresh-root` ?',
    });
  }

  const [command, ...prefix] = workspace.workspace.run;
  if (command === undefined) {
    throw new KeelError('Commande d’exécution vide déclarée par le provider workspace.', {
      code: 'PROVIDER_NO_COMMANDS',
    });
  }
  const args = [...prefix, options.script];

  info(`${command} ${args.join(' ')} (dans ${options.directory}/)`);
  write();

  const code = await spawnInherit(command, args, cwd);
  if (code !== 0) {
    process.exitCode = code;
  }
}
