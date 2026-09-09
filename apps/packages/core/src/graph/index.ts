export {
  EDGE_KINDS,
  MOCKUP_STATUSES,
  docFrontmatterSchema,
  mockupMetaSchema,
  type DocFrontmatter,
  type EdgeKind,
  type GraphEdge,
  type GraphNode,
  type MockupMeta,
  type MockupStatus,
  type TraceGraph,
} from './schema.js';

export {
  DOCS_DIRNAME,
  docsDir,
  listDocFiles,
  parseDoc,
  readDocs,
  type DocFile,
  type ReadDocsResult,
} from './docs.js';

export {
  MOCKUPS_DIRNAME,
  listMockupMetaFiles,
  mockupTickets,
  mockupsDir,
  parseMockupMeta,
  readMockups,
  updateMockupStatus,
  type MockupFile,
} from './mockups.js';

export { buildTraceGraph, kindOf, type BuildTraceGraphOptions } from './build.js';

export {
  GRAPH_ISSUE_CODES,
  checkTraceGraph,
  hasErrors,
  neighbours,
  otherEnd,
  type GraphIssue,
  type GraphIssueCode,
  type GraphIssueSeverity,
} from './check.js';

export { GRAPH_REPORT_PATH, nodesOfKind, renderGraphReport } from './report.js';
