import { declarativeProvider } from './declarative.js';
import type { Provider } from './types.js';

/**
 * Pipeline de transformation des tokens (TECHNICAL.md §3). Le *format* des tokens, lui,
 * n'est pas un point provider : le standard W3C DTCG est imposé sans alternative
 * (DESIGN.md §2), car c'est un point d'interopérabilité externe.
 */
export const tokensPipelineProviders: readonly Provider[] = [
  declarativeProvider({
    id: 'style-dictionary',
    point: 'tokens-pipeline',
    label: 'Style Dictionary',
    description: 'Défaut. Le plus mature, tous formats de plateforme y compris natif.',
  }),
  declarativeProvider({
    id: 'terrazzo',
    point: 'tokens-pipeline',
    label: 'Terrazzo',
    description: 'Natif DTCG, plugin Tailwind v4 dédié — plus direct si Tailwind est la cible.',
  }),
];
