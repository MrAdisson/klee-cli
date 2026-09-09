import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join } from 'node:path';

import {
  KleeError,
  judgeA11y,
  providerRegistry,
  readMockups,
  type A11yReport,
  type A11yViolation,
  type MockupFile,
  type MockupStatus,
} from '@klee/core';

import { loadProject, type Project } from '../project.js';
import { mockupPath } from '../studio/targets.js';
import { spawnInherit } from '../spawn.js';
import { field, heading, info, success, warn, write } from '../ui/output.js';

/**
 * `klee mockups check` — le gate d'accessibilité (ADR 0018, DESIGN.md §6).
 *
 * La CLI orchestre, elle ne juge pas : elle construit les maquettes, les sert, fait tourner
 * l'auditeur du projet — qui seul porte le navigateur — puis confie les constats au domaine.
 * Le verdict lui revient déjà fait, et elle n'a plus qu'à le rendre lisible.
 */

const RUNNER = 'a11y-runner.mjs';

export interface MockupsCheckOptions {
  /** N'échoue pas sur les violations : sert à voir l'état des lieux sans bloquer. */
  readonly report?: boolean;
}

export async function runMockupsCheck(options: MockupsCheckOptions): Promise<void> {
  const project = await loadProject();

  if (!project.config.modules.mockups) {
    info('Ce projet n’a pas de maquettes : rien à vérifier.');
    write();
    return;
  }

  const mockups = await readMockups(project.root);
  if (mockups.length === 0) {
    info('Aucune maquette trouvée dans mockups/.');
    write();
    return;
  }

  const report = await checkMockups(project);
  render(report);

  if (report.failed && options.report !== true) {
    process.exitCode = 1;
  }
}

export async function checkMockups(
  project: Project,
  statusOverrides: Readonly<Record<string, MockupStatus>> = {},
): Promise<A11yReport> {
  const mockups = await readMockups(project.root);
  const effective = mockups.map((mockup) => {
    const status = statusOverrides[mockup.meta.id];
    return status === undefined ? mockup : { ...mockup, meta: { ...mockup.meta, status } };
  });
  const mockupsRoot = join(project.root, 'mockups');
  await buildMockups(project, mockupsRoot);
  const server = await serveStatic(join(mockupsRoot, 'dist'));
  let violations: readonly A11yViolation[];
  try {
    violations = await audit(mockupsRoot, pagesFor(effective, server.origin));
  } finally {
    await server.close();
  }
  return judgeA11y({ mockups: effective, violations });
}

function pagesFor(
  mockups: readonly MockupFile[],
  origin: string,
): readonly { id: string; url: string }[] {
  return mockups.map((mockup) => ({
    id: mockup.meta.id,
    url: `${origin}${mockupPath(mockup)}`,
  }));
}

async function buildMockups(project: Project, cwd: string): Promise<void> {
  const { workspace } = providerRegistry.resolve(
    'workspace',
    project.config.providers['workspace'],
  );
  if (workspace === undefined) {
    throw new KleeError('Le provider de workspace ne sait pas lancer de script.', {
      code: 'PROVIDER_NO_WORKSPACE',
    });
  }

  // L'audit porte sur le rendu : une macro Nunjucks non construite n'a pas de contraste.
  info('Construction des maquettes…');
  const [command, ...prefix] = workspace.run;
  const code = await spawnInherit(command ?? 'pnpm', [...prefix, 'build'], cwd);
  if (code !== 0) {
    throw new KleeError('La construction des maquettes a échoué.', {
      code: 'MOCKUPS_BUILD_FAILED',
      hint: `Relancez-la depuis ${cwd} pour voir le détail.`,
    });
  }
}

/**
 * Sert `mockups/dist/` le temps de l'audit. Ouvrir les pages en `file://` casserait les
 * feuilles de style, dont les chemins sont absolus — et sans styles, le contraste ne veut
 * plus rien dire. Le port est laissé au système : ce serveur ne vit que quelques secondes.
 */
async function serveStatic(root: string): Promise<{ origin: string; close: () => Promise<void> }> {
  const server: Server = createServer((request, response) => {
    void (async () => {
      const path = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/');
      const file = path.endsWith('/') ? join(root, path, 'index.html') : join(root, path);
      try {
        const contents = await readFile(file);
        response.writeHead(200, { 'content-type': mimeOf(file) });
        response.end(contents);
      } catch {
        response.writeHead(404).end('introuvable');
      }
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new KleeError('Le serveur de vérification n’a pas pu démarrer.', {
      code: 'A11Y_SERVER_FAILED',
    });
  }

  return {
    origin: `http://127.0.0.1:${String(address.port)}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

function mimeOf(file: string): string {
  return MIME[extname(file)] ?? 'application/octet-stream';
}

/** Lance l'auditeur du projet et lui passe les pages à visiter. */
async function audit(
  cwd: string,
  pages: readonly { id: string; url: string }[],
): Promise<readonly A11yViolation[]> {
  const child = spawn(process.execPath, [join(cwd, RUNNER)], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let out = '';
  let err = '';
  child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString()));
  child.stdin.end(JSON.stringify({ pages }));

  const code = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });

  if (code !== 0) {
    throw new KleeError('L’auditeur d’accessibilité a échoué.', {
      code: 'A11Y_RUNNER_FAILED',
      hint: err.trim().split('\n').slice(-3).join('\n') || 'Aucune sortie d’erreur.',
    });
  }

  const parsed = JSON.parse(out) as { violations?: A11yViolation[] };
  return parsed.violations ?? [];
}

function render(report: A11yReport): void {
  write();
  heading('Accessibilité des maquettes');
  field('Sous gate', `${String(report.gatedCount)} validée(s) ou implémentée(s)`);
  write();

  for (const finding of report.findings) {
    const line = `${finding.mockupId}  ${finding.rule} — ${finding.target}`;
    if (finding.severity === 'error') warn(line);
    else info(`${line} (${finding.status})`);
  }

  for (const exemption of report.invalidExemptions) {
    const line = `${exemption.mockupId}  ${exemption.rule} : dérogation sans raison`;
    if (exemption.severity === 'error') warn(line);
    else info(line);
  }

  // Affichées même quand tout passe : une dérogation qu'on n'affiche plus n'est plus une
  // décision, c'est un oubli qui dort (ADR 0018).
  for (const exemption of report.exemptions) {
    info(
      `· ${exemption.mockupId}  ${exemption.rule} écartée — ${exemption.reason}` +
        (exemption.used ? '' : ' (règle non enfreinte : dérogation devenue inutile)'),
    );
  }

  write();
  if (report.failed) {
    warn('Des maquettes validées ne respectent pas WCAG 2.1 AA.');
  } else {
    success('Toutes les maquettes validées respectent WCAG 2.1 AA.');
  }
  write();
}
