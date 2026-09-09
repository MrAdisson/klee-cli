import type { Provider } from './types.js';

/**
 * Provider dont le choix est enregistré dès `klee init` (TECHNICAL.md §13) mais qui ne
 * génère aucun fichier — soit parce que la phase indiquée par son point
 * (`scaffoldingPhase`) n'est pas atteinte, soit parce qu'il n'a rien à générer par nature,
 * comme le provider `markdown-only` du point `docs`.
 *
 * Ce n'est pas un bouche-trou : le choix doit être posé tôt parce que d'autres artefacts
 * y font référence (AGENTS.md, ADR, docs), alors que les fichiers du provider n'ont de
 * sens qu'une fois le module réellement implémenté.
 */
export function declarativeProvider(spec: Omit<Provider, 'files'>): Provider {
  return { ...spec, files: () => [] };
}
