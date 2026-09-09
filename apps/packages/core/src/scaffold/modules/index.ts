import type { ModuleId } from '../../modules.js';
import type { ScaffoldGenerator } from '../types.js';
import { appsGenerator } from './apps.js';
import { contractsGenerator } from './contracts.js';
import {
  docsDecisionsGenerator,
  docsI18nCopyGenerator,
  docsProductGenerator,
  docsTechnicalGenerator,
} from './docs.js';
import { mockupsGenerator } from './mockups.js';
import { ticketsGenerator } from './tickets.js';

/**
 * Un générateur par module. Un module non retenu n'apparaît jamais dans le plan : c'est
 * la garantie « aucun fichier, aucune dépendance, aucune section » de TECHNICAL.md §13.
 */
export const MODULE_GENERATORS: Readonly<Record<ModuleId, ScaffoldGenerator>> = {
  apps: appsGenerator,
  tickets: ticketsGenerator,
  'docs-technical': docsTechnicalGenerator,
  'docs-decisions': docsDecisionsGenerator,
  mockups: mockupsGenerator,
  contracts: contractsGenerator,
  'docs-product': docsProductGenerator,
  'docs-i18n-copy': docsI18nCopyGenerator,
};

export { rootGenerator } from './root.js';
