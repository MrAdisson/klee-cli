import { join } from 'node:path';

import { KeelError, MODULES, providerRegistry, type ModuleId } from '@keel/core';

import { info, write } from '../ui/output.js';
import { directoryExists, fileExists } from '../fs.js';
import { loadProject } from '../project.js';
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
  /**
   * Construit les tokens au préalable s'ils manquent. Servir des maquettes sans tokens
   * produit des pages sans style et un 404 difficile à relier à sa cause : c'est un
   * prérequis, pas une étape à mémoriser.
   */
  readonly ensureTokens?: boolean;
}

const TOKENS_OUTPUT = 'design-system/dist/css/tokens.css';

export async function runProjectScript(options: RunProjectScriptOptions): Promise<void> {
  const { root, config } = await loadProject();

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

  const [runner, ...runPrefix] = workspace.workspace.run;

  if (options.ensureTokens === true && runner !== undefined) {
    if (!(await fileExists(join(root, TOKENS_OUTPUT)))) {
      info(`${TOKENS_OUTPUT} absent — construction des tokens au préalable.`);
      write();
      const code = await spawnInherit(runner, [...runPrefix, 'build'], join(root, 'design-system'));
      if (code !== 0) {
        throw new KeelError('Le build des tokens a échoué : les maquettes seraient sans style.', {
          code: 'TOKENS_BUILD_FAILED',
          hint: 'Vérifiez `design-system/` — les dépendances sont-elles installées ?',
        });
      }
      write();
    }
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
