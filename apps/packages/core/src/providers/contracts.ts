import { declarativeProvider } from './declarative.js';
import type { Provider } from './types.js';

/**
 * Format de contrat d'API (TECHNICAL.md §8) : source de vérité pour qu'un agent côté
 * front n'ait pas besoin du contexte backend complet.
 */
export const contractsProviders: readonly Provider[] = [
  declarativeProvider({
    id: 'openapi',
    point: 'contracts',
    label: 'OpenAPI',
    description: 'Défaut. Outillage le plus large pour des API HTTP/REST.',
  }),
  declarativeProvider({
    id: 'graphql',
    point: 'contracts',
    label: 'GraphQL',
    description: 'Schéma typé unique, pertinent si les clients composent leurs requêtes.',
  }),
  declarativeProvider({
    id: 'protobuf',
    point: 'contracts',
    label: 'Protobuf',
    description: 'Contrats binaires pour communications inter-services (gRPC).',
  }),
];
