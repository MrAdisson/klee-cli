import { PRESET_IDS } from '@keel/core';
import { Command } from 'commander';

import { runInit, type InitOptions } from './commands/init.js';
import {
  runModuleAdd,
  runModuleList,
  runModuleRemove,
  type ModuleCommandOptions,
} from './commands/module.js';
import { readCliVersion } from './version.js';

/**
 * Surface de la CLI. `createProgram` ne fait que câbler : chaque commande vit dans son
 * propre module et ne connaît ni Commander ni le terminal.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('klee')
    .description(
      'Keel — everything lives in the codebase. Scaffolde et fait évoluer un projet dont les tickets, maquettes, docs et code partagent un seul dépôt.',
    )
    .version(readCliVersion(), '-v, --version')
    .showHelpAfterError();

  program
    .command('init')
    .description('Crée la structure d’un projet Keel (modules et providers).')
    .argument('[directory]', 'dossier cible', '.')
    .option('--name <name>', 'nom du projet (défaut : nom du dossier)')
    .option('--id-prefix <prefix>', 'préfixe des identifiants de tickets (défaut : PROJ)')
    .option('--preset <preset>', `preset de modules : ${PRESET_IDS.join(' | ')}`)
    .option('-y, --yes', 'aucune question : preset full-product et providers par défaut')
    .option('--dry-run', 'affiche le plan sans rien écrire')
    .option('--force', 'écrase les fichiers existants qui diffèrent')
    .action(async (directory: string | undefined, options: InitOptions) => {
      await runInit(directory, options);
    });

  const moduleCommand = program
    .command('module')
    .description('Ajoute, retire ou liste les modules du projet.');

  moduleCommand
    .command('list')
    .description('Liste les modules et leur état.')
    .action(async () => {
      await runModuleList();
    });

  moduleCommand
    .command('add')
    .description('Active un module optionnel et génère ses fichiers.')
    .argument('<module>', 'identifiant du module')
    .option('--dry-run', 'affiche le plan sans rien écrire')
    .option('--refresh-root', 'régénère aussi les fichiers de racine')
    .action(async (moduleName: string, options: ModuleCommandOptions) => {
      await runModuleAdd(moduleName, options);
    });

  moduleCommand
    .command('remove')
    .description('Désactive un module optionnel (sans supprimer ses fichiers).')
    .argument('<module>', 'identifiant du module')
    .option('--dry-run', 'n’écrit pas la configuration')
    .option('--refresh-root', 'régénère aussi les fichiers de racine')
    .action(async (moduleName: string, options: ModuleCommandOptions) => {
      await runModuleRemove(moduleName, options);
    });

  return program;
}
