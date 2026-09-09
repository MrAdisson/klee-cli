import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ScaffoldConflictError } from '../errors.js';
import { applyScaffoldPlan } from './apply.js';
import type { ScaffoldPlan } from './types.js';

const plan: ScaffoldPlan = {
  files: [
    { path: 'README.md', contents: '# demo\n', origin: 'module:root' },
    { path: 'docs/AGENTS.md', contents: 'docs\n', origin: 'module:docs-technical' },
  ],
};

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'keel-apply-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('applyScaffoldPlan', () => {
  it('crée les fichiers et les dossiers intermédiaires', async () => {
    const result = await applyScaffoldPlan(plan, { root });

    expect(result.files.map((file) => file.outcome)).toEqual(['created', 'created']);
    await expect(readFile(join(root, 'docs/AGENTS.md'), 'utf8')).resolves.toBe('docs\n');
  });

  it('ne réécrit pas un fichier déjà identique', async () => {
    await applyScaffoldPlan(plan, { root });
    const second = await applyScaffoldPlan(plan, { root });

    expect(second.files.every((file) => file.outcome === 'unchanged')).toBe(true);
  });

  it('refuse d’écraser un fichier modifié, et n’écrit rien du tout', async () => {
    await applyScaffoldPlan(plan, { root });
    await writeFile(join(root, 'README.md'), '# modifié à la main\n', 'utf8');
    await rm(join(root, 'docs/AGENTS.md'));

    await expect(applyScaffoldPlan(plan, { root })).rejects.toBeInstanceOf(ScaffoldConflictError);
    // Le fichier manquant n'a pas été recréé : un plan est appliqué entièrement ou pas du tout.
    await expect(readFile(join(root, 'docs/AGENTS.md'), 'utf8')).rejects.toThrow();
  });

  it('écrase sur --force', async () => {
    await applyScaffoldPlan(plan, { root });
    await writeFile(join(root, 'README.md'), '# modifié\n', 'utf8');

    const result = await applyScaffoldPlan(plan, { root, force: true });

    expect(result.files[0]?.outcome).toBe('overwritten');
    await expect(readFile(join(root, 'README.md'), 'utf8')).resolves.toBe('# demo\n');
  });

  it('n’écrit rien en dry-run mais rapporte le résultat attendu', async () => {
    const result = await applyScaffoldPlan(plan, { root, dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.files.every((file) => file.outcome === 'created')).toBe(true);
    await expect(readFile(join(root, 'README.md'), 'utf8')).rejects.toThrow();
  });

  it('refuse un chemin qui sortirait de la racine', async () => {
    const escaping: ScaffoldPlan = {
      files: [{ path: '../evade.md', contents: 'x\n', origin: 'test' }],
    };
    await expect(applyScaffoldPlan(escaping, { root })).rejects.toThrow(/hors de la racine/);
  });
});
