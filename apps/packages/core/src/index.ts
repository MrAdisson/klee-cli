/**
 * @klee/core — domaine de Klee.
 *
 * Ce package ne parle ni de terminal ni de prompts : il décrit ce qu'*est* un projet Klee
 * (modules, providers, configuration, arborescence générée). La CLI `klee` et, plus tard,
 * le cockpit local en sont deux consommateurs interchangeables.
 */

export {
  CORE_MODULE_IDS,
  MODULES,
  MODULE_IDS,
  OPTIONAL_MODULE_IDS,
  hasDesignSystem,
  isModuleId,
  type ModuleDefinition,
  type ModuleId,
  type ModuleSelection,
} from './modules.js';

export {
  DEFAULT_PRESET_ID,
  PRESETS,
  PRESET_IDS,
  isPresetId,
  moduleSelectionFromOptional,
  moduleSelectionFromPreset,
  providerDefaultsFromPreset,
  type PresetDefinition,
  type PresetId,
} from './presets.js';

export {
  DEFAULT_TICKET_PREFIX,
  DOC_PREFIX,
  ENTITY_KINDS,
  ID_NUMBER_PADDING,
  ID_PREFIX_PATTERN,
  MOCKUP_PREFIX,
  extractIds,
  formatId,
  isValidIdPrefix,
  parseId,
  type EntityId,
  type EntityKind,
} from './ids.js';

export { headingTitle, splitFrontmatter, type SplitDocument } from './frontmatter.js';

export { indexableText } from './search/indexable.js';

export {
  foldForSearch,
  searchDocuments,
  type SearchDocument,
  type SearchHit,
} from './search/search.js';

export {
  isGated,
  judgeA11y,
  type A11yFinding,
  type A11yReport,
  type A11ySeverity,
  type A11yViolation,
  type AppliedExemption,
  type InvalidExemption,
  type JudgeA11yInput,
} from './a11y/verdict.js';

export {
  DOCS_DIRNAME,
  EDGE_KINDS,
  GRAPH_ISSUE_CODES,
  GRAPH_REPORT_PATH,
  MOCKUPS_DIRNAME,
  MOCKUP_STATUSES,
  buildTraceGraph,
  checkTraceGraph,
  docFrontmatterSchema,
  docsDir,
  hasErrors,
  kindOf,
  listDocFiles,
  listMockupMetaFiles,
  mockupMetaSchema,
  mockupTickets,
  mockupsDir,
  neighbours,
  nodesOfKind,
  otherEnd,
  parseDoc,
  parseMockupMeta,
  readDocs,
  readMockups,
  renderGraphReport,
  updateMockupStatus,
  type BuildTraceGraphOptions,
  type DocFile,
  type DocFrontmatter,
  type EdgeKind,
  type GraphEdge,
  type GraphIssue,
  type GraphIssueCode,
  type GraphIssueSeverity,
  type GraphNode,
  type MockupFile,
  type MockupMeta,
  type MockupStatus,
  type ReadDocsResult,
  type TraceGraph,
} from './graph/index.js';

export {
  ConfigError,
  KleeError,
  ScaffoldConflictError,
  UnknownProviderError,
  isKleeError,
} from './errors.js';

export {
  PROVIDER_POINTS,
  PROVIDER_POINT_DEFINITIONS,
  PROVIDER_POINT_LIST,
  ProviderRegistry,
  declarativeProvider,
  dependencyOverrideDecisions,
  installScriptDecisions,
  isProviderPoint,
  providerPointsForModule,
  providerRegistry,
  type Provider,
  type ProviderPoint,
  type ProviderPointDefinition,
} from './providers/index.js';

export {
  CONFIG_FILENAME,
  CONFIG_VERSION,
  PROJECT_NAME_PATTERN,
  REQUIRED_TOKEN_TARGET,
  TOKEN_TARGETS,
  projectConfigSchema,
  type ProjectConfig,
  type TokenTarget,
} from './config/schema.js';

export {
  DEFAULT_TOKEN_STARTER_ID,
  TOKEN_STARTERS,
  findTokenStarter,
  resolveTokenStarter,
  resolveTokenValue,
  type TokenDocument,
  type TokenStarter,
} from './token-starters.js';

export {
  createProjectConfig,
  defaultProviderSelection,
  type CreateProjectConfigInput,
} from './config/defaults.js';

export { configPath, findProjectRoot, readProjectConfig, writeProjectConfig } from './config/io.js';

export { validateProjectConfig } from './config/validate.js';

export { buildScaffoldPlan, type BuildScaffoldPlanOptions } from './scaffold/plan.js';

export {
  applyScaffoldPlan,
  type AppliedFile,
  type ApplyScaffoldOptions,
  type ApplyScaffoldResult,
  type FileOutcome,
} from './scaffold/apply.js';

export type {
  ScaffoldContext,
  ScaffoldFile,
  ScaffoldGenerator,
  ScaffoldPlan,
} from './scaffold/types.js';

export {
  ACCEPTANCE_HEADING,
  DEFAULT_TICKET_STATUS,
  TICKETS_DIRNAME,
  TICKET_STATUSES,
  createTicket,
  extractAcceptance,
  isTicketStatus,
  listTicketFiles,
  moveTicket,
  newTicketBody,
  nextTicketId,
  parseTicket,
  readTicket,
  readTickets,
  renameTicketFile,
  updateTicket,
  serializeTicket,
  ticketFileName,
  ticketFrontmatterSchema,
  ticketsDir,
  type CreateTicketInput,
  type Ticket,
  type TicketFrontmatter,
  type TicketStatus,
} from './tickets/index.js';

export type { TicketIndex, TicketIndexFactory } from './tickets/ticket-index.js';
