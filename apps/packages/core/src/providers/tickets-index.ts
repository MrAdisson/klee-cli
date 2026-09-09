import { markdownTicketIndexFactory } from '../tickets/markdown-index.js';
import { sqliteTicketIndexFactory } from '../tickets/sqlite-index.js';
import type { Provider } from './types.js';

/**
 * Indexation du dashboard de tickets (TECHNICAL.md §6). Les fichiers markdown restent la
 * source de vérité dans les deux cas : l'index n'est qu'un cache reconstructible.
 *
 * Le défaut retenu s'écarte du brief (cf ADR 0008) : `markdown-only`, parce qu'un index
 * apporte d'abord de l'état à invalider, et seulement ensuite de la vitesse.
 */
export const ticketsIndexProviders: readonly Provider[] = [
  {
    id: 'markdown-only',
    point: 'tickets-index',
    label: 'Markdown seul (parsing à la volée)',
    description: 'Défaut. Zéro dépendance, aucun cache à invalider, toujours cohérent.',
    files: () => [],
    ticketIndex: markdownTicketIndexFactory,
  },
  {
    id: 'markdown-sqlite',
    point: 'tickets-index',
    label: 'Markdown + index SQLite',
    description:
      'Index local reconstructible (node:sqlite), invalidé par mtime et taille. Utile sur un gros corpus.',
    files: () => [],
    ticketIndex: sqliteTicketIndexFactory,
  },
];
