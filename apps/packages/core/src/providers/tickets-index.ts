import { declarativeProvider } from './declarative.js';
import type { Provider } from './types.js';

/**
 * Indexation du dashboard de tickets (TECHNICAL.md §6). Les fichiers markdown restent
 * la source de vérité dans les deux cas : l'index n'est qu'un cache reconstructible.
 */
export const ticketsIndexProviders: readonly Provider[] = [
  declarativeProvider({
    id: 'markdown-sqlite',
    point: 'tickets-index',
    label: 'Markdown + index SQLite',
    description: 'Défaut. Recherche rapide même avec plusieurs milliers de tickets.',
  }),
  declarativeProvider({
    id: 'markdown-only',
    point: 'tickets-index',
    label: 'Markdown seul (parsing à la volée)',
    description: 'Zéro dépendance, index reconstruit à chaque lecture.',
  }),
];
