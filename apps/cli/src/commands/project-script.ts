import { join } from 'node:path';

import {
  KleeError,
  MODULES,
  providerRegistry,
  type ModuleId,
  type ProjectConfig,
  type ProviderPoint,
} from '@klee/core';

import { parsePortOption, resolvePort } from '../ports.js';
import { info, warn, write } from '../ui/output.js';
import { directoryExists, fileExists } from '../fs.js';
import { loadProject } from '../project.js';
import { spawnInherit } from '../spawn.js';

/**
 * Lance un script du projet généré, avec le gestionnaire de paquets que son provider
 * `workspace` a déclaré.
 *
 * Klee n'embarque ni Style Dictionary ni Eleventy : c'est le projet qui possède son
 * outillage. `klee tokens build` est un raccourci, jamais un passage obligé — le projet
 * reste entièrement utilisable sans klee installé.
 */
export interface RunProjectScriptOptions {
  /** Dossier du package qui porte le script, relatif à la racine du projet. */
  readonly directory: string;
  readonly script: string;
  /**
   * Module dont dépend ce script : absent, la commande n'a pas de sens. Facultatif pour un
   * script qui ne dépend d'aucun module optionnel — le site de documentation, par exemple,
   * dont le dossier appartient au socle.
   */
  readonly requiresModule?: ModuleId;
  /**
   * Construit les tokens au préalable s'ils manquent. Servir des maquettes sans tokens
   * produit des pages sans style et un 404 difficile à relier à sa cause : c'est un
   * prérequis, pas une étape à mémoriser.
   */
  readonly ensureTokens?: boolean;
  /**
   * Point de provider dont le serveur de développement est lancé, quand ce script en est un.
   *
   * Le port vient alors du provider (`devServer.defaultPort`) et cède s'il est déjà pris —
   * deux projets Klee ouverts en parallèle est le cas ordinaire. Sans cela, Docusaurus
   * abandonne et Eleventy annonce l'URL d'un port occupé avant de mourir.
   */
  readonly servesFrom?: ProviderPoint;
  /** Port demandé explicitement : honoré ou refusé, jamais déplacé en silence. */
  readonly port?: string;
}

const TOKENS_OUTPUT = 'design-system/dist/css/tokens.css';

export async function runProjectScript(options: RunProjectScriptOptions): Promise<void> {
  const { root, config } = await loadProject();

  const required = options.requiresModule;
  if (required !== undefined && !config.modules[required]) {
    throw new KleeError(
      `Le module « ${MODULES[required].label} » n'est pas retenu dans ce projet.`,
      {
        code: 'MODULE_ABSENT',
        hint: `Ajoutez-le avec \`klee module add ${required}\`.`,
      },
    );
  }

  const workspace = providerRegistry.resolve('workspace', config.providers.workspace);
  if (workspace.workspace === undefined) {
    throw new KleeError(
      `Le provider workspace « ${workspace.label} » ne déclare pas de commande d'exécution.`,
      { code: 'PROVIDER_NO_COMMANDS' },
    );
  }

  const cwd = join(root, options.directory);
  if (!(await directoryExists(cwd))) {
    throw new KleeError(`${options.directory}/ est absent de ce projet.`, {
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
        throw new KleeError('Le build des tokens a échoué : les maquettes seraient sans style.', {
          code: 'TOKENS_BUILD_FAILED',
          hint: 'Vérifiez `design-system/` — les dépendances sont-elles installées ?',
        });
      }
      write();
    }
  }

  const [command, ...prefix] = workspace.workspace.run;
  if (command === undefined) {
    throw new KleeError('Commande d’exécution vide déclarée par le provider workspace.', {
      code: 'PROVIDER_NO_COMMANDS',
    });
  }
  const args = [...prefix, options.script, ...(await portArgs(config, options))];

  info(`${command} ${args.join(' ')} (dans ${options.directory}/)`);
  write();

  const code = await spawnInherit(command, args, cwd);
  if (code !== 0) {
    process.exitCode = code;
  }
}

/**
 * Les arguments de port à ajouter au script, quand celui-ci lance un serveur.
 *
 * C'est le provider qui déclare le drapeau et le port par défaut : le studio et les
 * commandes autonomes s'appuient sur la même déclaration (ADR 0016).
 */
async function portArgs(
  config: ProjectConfig,
  options: RunProjectScriptOptions,
): Promise<string[]> {
  const point = options.servesFrom;
  if (point === undefined) return [];

  const devServer = providerRegistry.resolve(point, config.providers[point]).devServer;
  if (devServer === undefined) return [];

  const { port, moved } = await resolvePort(
    parsePortOption(options.port),
    devServer.defaultPort,
    'serveur',
  );
  if (moved) {
    warn(`Le port ${String(devServer.defaultPort)} était pris — le serveur prend ${String(port)}.`);
  }
  // Sans `--` : pnpm 12 avale le séparateur et le drapeau n'atteint jamais le script.
  return [devServer.portFlag, String(port)];
}
