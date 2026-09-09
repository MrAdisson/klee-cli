import type { Provider } from './types.js';

/**
 * Provider dont le choix est enregistré dès `klee init` (TECHNICAL.md §13) mais dont la
 * génération de fichiers arrive à la phase indiquée par son point (`scaffoldingPhase`).
 *
 * Ce n'est pas un bouche-trou : le choix doit être posé tôt parce que d'autres artefacts
 * y font référence (AGENTS.md, ADR, docs), alors que les fichiers du provider n'ont de
 * sens qu'une fois le module réellement implémenté.
 */
export function declarativeProvider(spec: Omit<Provider, 'files'>): Provider {
  return { ...spec, files: () => [] };
}
