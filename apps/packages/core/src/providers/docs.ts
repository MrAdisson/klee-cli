import { declarativeProvider } from './declarative.js';
import type { Provider } from './types.js';

/** Générateur de site docs-as-code (TECHNICAL.md §5), intégré au cockpit, pas en silo. */
export const docsProviders: readonly Provider[] = [
  declarativeProvider({
    id: 'docusaurus',
    point: 'docs',
    label: 'Docusaurus',
    description: 'Défaut. Le plus complet : versioning, i18n, recherche, écosystème mature.',
  }),
  declarativeProvider({
    id: 'vitepress',
    point: 'docs',
    label: 'VitePress',
    description: 'Plus léger et plus rapide, configuration minimale.',
  }),
  declarativeProvider({
    id: 'starlight',
    point: 'docs',
    label: 'Starlight (Astro)',
    description: 'Accessible et performant par défaut, bon pour de la doc à forte structure.',
  }),
];
