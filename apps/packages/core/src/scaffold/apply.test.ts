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
  dependencies: [],
  installCommand: null,
};

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'klee-apply-'));
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

    const result = await applyScaffoldPlan(plan, { root, onConflict: 'overwrite' });

    expect(result.files[0]?.outcome).toBe('overwritten');
    await expect(readFile(join(root, 'README.md'), 'utf8')).resolves.toBe('# demo\n');
  });

  // Classe de bug : `module add --refresh-root` imposait `force`, et a écrasé en silence des
  // fichiers de racine rédigés à la main (AGENTS.md, README.md). Le mode `skip` est la
  // réponse — laisser intact ce qui a divergé, écrire quand même ce qui manque (ADR 0013).
  describe('onConflict: skip', () => {
    it('laisse intact un fichier modifié depuis, et écrit quand même ce qui manque', async () => {
      await applyScaffoldPlan(plan, { root });
      const authored = '# rédigé à la main, surtout ne pas perdre\n';
      await writeFile(join(root, 'README.md'), authored, 'utf8');
      await rm(join(root, 'docs/AGENTS.md'));

      const result = await applyScaffoldPlan(plan, { root, onConflict: 'skip' });

      expect(result.files.map((file) => file.outcome)).toEqual(['skipped', 'created']);
      await expect(readFile(join(root, 'README.md'), 'utf8')).resolves.toBe(authored);
      await expect(readFile(join(root, 'docs/AGENTS.md'), 'utf8')).resolves.toBe('docs\n');
    });

    it('n’échoue pas quand tout a divergé', async () => {
      await applyScaffoldPlan(plan, { root });
      await writeFile(join(root, 'README.md'), 'a\n', 'utf8');
      await writeFile(join(root, 'docs/AGENTS.md'), 'b\n', 'utf8');

      const result = await applyScaffoldPlan(plan, { root, onConflict: 'skip' });

      expect(result.files.every((file) => file.outcome === 'skipped')).toBe(true);
      await expect(readFile(join(root, 'README.md'), 'utf8')).resolves.toBe('a\n');
    });

    it('n’écrit rien en dry-run', async () => {
      await applyScaffoldPlan(plan, { root });
      await rm(join(root, 'docs/AGENTS.md'));

      await applyScaffoldPlan(plan, { root, onConflict: 'skip', dryRun: true });

      await expect(readFile(join(root, 'docs/AGENTS.md'), 'utf8')).rejects.toThrow();
    });
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
      dependencies: [],
      installCommand: null,
    };
    await expect(applyScaffoldPlan(escaping, { root })).rejects.toThrow(/hors de la racine/);
  });
});
