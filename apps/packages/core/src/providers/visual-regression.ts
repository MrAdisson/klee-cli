import { declarativeProvider } from './declarative.js';
import type { Provider } from './types.js';

/**
 * Régression visuelle sur les mockups (TECHNICAL.md §4). Déclenchée notamment par tout
 * changement de token (§7) : c'est ce qui rend la gouvernance des tokens mécanique.
 */
export const visualRegressionProviders: readonly Provider[] = [
  declarativeProvider({
    id: 'playwright',
    point: 'visual-regression',
    label: 'Playwright (toHaveScreenshot)',
    description: 'Défaut. Local, gratuit, déjà présent si le projet fait du test E2E.',
  }),
  declarativeProvider({
    id: 'backstopjs',
    point: 'visual-regression',
    label: 'BackstopJS',
    description: 'Spécialisé régression visuelle, rapports HTML détaillés.',
  }),
  declarativeProvider({
    id: 'percy',
    point: 'visual-regression',
    label: 'Percy / Chromatic',
    description: 'Cloud payant : revue visuelle collaborative et historique hébergé.',
  }),
];
