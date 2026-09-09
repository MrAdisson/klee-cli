/**
 * @keel/core — domaine de Keel.
 *
 * Ce package ne parle ni de terminal ni de prompts : il décrit ce qu'*est* un projet Keel
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

export {
  ConfigError,
  KeelError,
  ScaffoldConflictError,
  UnknownProviderError,
  isKeelError,
} from './errors.js';

export {
  PROVIDER_POINTS,
  PROVIDER_POINT_DEFINITIONS,
  PROVIDER_POINT_LIST,
  ProviderRegistry,
  declarativeProvider,
  isProviderPoint,
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
