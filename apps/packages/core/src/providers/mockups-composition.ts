import { declarativeProvider } from './declarative.js';
import type { Provider } from './types.js';

/**
 * Composition des mockups (TECHNICAL.md §4, DESIGN.md §3). Aucun copier-coller de markup
 * entre pages : une page inclut un composant, elle ne le réécrit jamais.
 */
export const mockupsCompositionProviders: readonly Provider[] = [
  declarativeProvider({
    id: 'eleventy',
    point: 'mockups-composition',
    label: 'Eleventy',
    description: 'Défaut. Includes résolus au build/serve, sortie HTML/CSS pur.',
  }),
  declarativeProvider({
    id: 'web-components',
    point: 'mockups-composition',
    label: 'Web Components',
    description: 'Composants réutilisables au runtime, sans étape de build.',
  }),
];
