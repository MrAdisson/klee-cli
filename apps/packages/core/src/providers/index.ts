import { contractsProviders } from './contracts.js';
import { docsProviders } from './docs.js';
import { mockupsCompositionProviders } from './mockups-composition.js';
import { ProviderRegistry } from './registry.js';
import { ticketsIndexProviders } from './tickets-index.js';
import { tokensPipelineProviders } from './tokens-pipeline.js';
import { visualRegressionProviders } from './visual-regression.js';
import { workspaceProviders } from './workspace.js';

/**
 * Registre par défaut. Ajouter un provider = créer son fichier et l'ajouter ici ;
 * rien d'autre dans la base de code n'a à changer (TECHNICAL.md §13).
 */
export const providerRegistry = new ProviderRegistry([
  ...workspaceProviders,
  ...docsProviders,
  ...contractsProviders,
  ...ticketsIndexProviders,
  ...mockupsCompositionProviders,
  ...visualRegressionProviders,
  ...tokensPipelineProviders,
]);

export { ProviderRegistry } from './registry.js';
export { declarativeProvider } from './declarative.js';
export { PROVIDER_POINT_DEFINITIONS, PROVIDER_POINT_LIST } from './points.js';
export {
  PROVIDER_POINTS,
  isProviderPoint,
  type Provider,
  type ProviderPoint,
  type ProviderPointDefinition,
} from './types.js';
