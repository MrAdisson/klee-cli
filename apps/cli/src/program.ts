import { PRESET_IDS, TICKET_STATUSES } from '@klee/core';
import { Command } from 'commander';

import { runInit, type InitOptions } from './commands/init.js';
import {
  runModuleAdd,
  runModuleList,
  runModuleRemove,
  type ModuleCommandOptions,
} from './commands/module.js';
import { runBoard, type BoardOptions } from './commands/board.js';
import {
  runLinksCheck,
  runLinksList,
  runLinksReport,
  runLinksShow,
  type LinksListOptions,
  type LinksReportOptions,
} from './commands/links.js';
import { runDocsBuild, runDocsInit, runDocsServe, type DocsInitOptions } from './commands/docs.js';
import { runProjectScript } from './commands/project-script.js';
import {
  runTicketCreate,
  runTicketList,
  runTicketMove,
  runTicketShow,
  type TicketCreateOptions,
  type TicketListOptions,
} from './commands/ticket.js';
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
      'Klee — everything lives in the codebase. Scaffolde et fait évoluer un projet dont les tickets, maquettes, docs et code partagent un seul dépôt.',
    )
    .version(readCliVersion(), '-v, --version')
    .showHelpAfterError();

  program
    .command('init')
    .description('Crée la structure d’un projet Klee (modules et providers).')
    .argument('[directory]', 'dossier cible (défaut : le dossier courant)')
    .option('--name <name>', 'nom du projet (défaut : nom du dossier)')
    .option('--id-prefix <prefix>', 'préfixe des identifiants de tickets (défaut : PROJ)')
    .option('--preset <preset>', `preset de modules : ${PRESET_IDS.join(' | ')}`)
    .option(
      '--provider <point=id...>',
      'impose un provider, ex. --provider docs=markdown-only (passe avant le preset)',
    )
    .option('-y, --yes', 'aucune question : preset full-product et providers par défaut')
    .option('--dry-run', 'affiche le plan sans rien écrire')
    .option('--force', 'écrase les fichiers existants qui diffèrent')
    .option('--install', 'installe les dépendances déclarées après le scaffolding')
    .option('--no-git', 'n’initialise pas de dépôt git')
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
    .option('--install', 'installe les dépendances que le module ajoute')
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

  program
    .command('board')
    .description('Ouvre le kanban local des tickets (créer et déplacer sans terminal).')
    .option('--port <port>', 'port d’écoute (défaut : 4321)')
    .action(async (options: BoardOptions) => {
      await runBoard(options);
    });

  const ticketCommand = program
    .command('ticket')
    .description('Crée, liste et fait transiter les tickets.');

  ticketCommand
    .command('create')
    .description('Crée un ticket markdown et lui alloue un identifiant.')
    .argument('<title>', 'titre du ticket')
    .option('--status <status>', `statut initial : ${TICKET_STATUSES.join(' | ')}`)
    .option('--assignee <who>', 'personne ou agent assigné')
    .option('--depends-on <ids...>', 'tickets dont celui-ci dépend')
    .option('--mockup <ids...>', 'maquettes liées (MOCK-xxx)')
    .option('--doc <ids...>', 'documents liés (DOC-xxx)')
    .option('--description <text>', 'description initiale')
    .option('--agent', 'marque le ticket comme produit par un agent')
    .action(async (title: string, options: TicketCreateOptions) => {
      await runTicketCreate(title, options);
    });

  ticketCommand
    .command('list')
    .description('Liste les tickets, groupés par statut.')
    .option('--status <status>', 'ne garder qu’un statut')
    .option('--assignee <who>', 'ne garder qu’un assigné')
    .option('--json', 'sortie JSON, pour un agent ou un script')
    .action(async (options: TicketListOptions) => {
      await runTicketList(options);
    });

  ticketCommand
    .command('move')
    .description('Fait transiter un ticket vers un autre statut.')
    .argument('<id>', 'identifiant du ticket')
    .argument('<status>', `nouveau statut : ${TICKET_STATUSES.join(' | ')}`)
    .action(async (id: string, status: string) => {
      await runTicketMove(id, status);
    });

  ticketCommand
    .command('show')
    .description('Affiche un ticket et ses liens.')
    .argument('<id>', 'identifiant du ticket')
    .action(async (id: string) => {
      await runTicketShow(id);
    });

  const linksCommand = program
    .command('links')
    .description('Graphe de traçabilité : liens croisés entre tickets, maquettes et docs.')
    .option('--json', 'sortie JSON, pour un agent ou un script')
    .action(async (options: LinksListOptions) => {
      await runLinksList(options);
    });

  linksCommand
    .command('show')
    .description('Affiche le voisinage d’un identifiant.')
    .argument('<id>', 'identifiant : ticket, MOCK-xxx ou DOC-xxx')
    .action(async (id: string) => {
      await runLinksShow(id);
    });

  linksCommand
    .command('check')
    .description('Vérifie que tout lien déclaré pointe vers un artefact existant.')
    .action(async () => {
      await runLinksCheck();
    });

  linksCommand
    .command('report')
    .description('Régénère la vue du graphe dans docs/_generated/.')
    .option('--dry-run', 'affiche le contenu sans l’écrire')
    .action(async (options: LinksReportOptions) => {
      await runLinksReport(options);
    });

  const docsCommand = program
    .command('docs')
    .description('Site de documentation (docs/), servi par le provider retenu.');

  docsCommand
    .command('init')
    .description('Génère les fichiers du site de documentation.')
    .option('--dry-run', 'affiche le plan sans rien écrire')
    .option('--force', 'écrase les fichiers existants qui diffèrent')
    .action(async (options: DocsInitOptions) => {
      await runDocsInit(options);
    });

  docsCommand
    .command('serve')
    .description('Sert la documentation en local, avec rechargement à chaud.')
    .action(async () => {
      await runDocsServe();
    });

  docsCommand
    .command('build')
    .description('Construit la version statique du site de documentation.')
    .action(async () => {
      await runDocsBuild();
    });

  const tokensCommand = program
    .command('tokens')
    .description('Pipeline des design tokens (design-system/).');

  tokensCommand
    .command('build')
    .description('Régénère design-system/dist/ à partir de tokens.json.')
    .action(async () => {
      await runProjectScript({
        directory: 'design-system',
        script: 'build',
        requiresModule: 'mockups',
      });
    });

  const mockupsCommand = program
    .command('mockups')
    .description('Serveur de navigation des maquettes (mockups/).');

  mockupsCommand
    .command('serve')
    .description('Sert les maquettes en local, avec navigation entre les pages.')
    .action(async () => {
      await runProjectScript({
        directory: 'mockups',
        script: 'dev',
        requiresModule: 'mockups',
        ensureTokens: true,
      });
    });

  mockupsCommand
    .command('build')
    .description('Construit la version statique des maquettes.')
    .action(async () => {
      await runProjectScript({
        directory: 'mockups',
        script: 'build',
        requiresModule: 'mockups',
        ensureTokens: true,
      });
    });

  return program;
}
