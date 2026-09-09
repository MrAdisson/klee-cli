import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readProjectConfig } from '@keel/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runCli } from './run.js';

/** Test de bout en bout de la CLI : elle rend un code de sortie, elle ne tue pas le process. */

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'keel-cli-'));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

function cli(...args: string[]): Promise<number> {
  return runCli(['node', 'klee', ...args]);
}

describe('klee init', () => {
  it('scaffolde un projet complet avec --yes', async () => {
    expect(await cli('init', root, '--yes', '--name', 'demo', '--id-prefix', 'ACME')).toBe(0);

    const config = await readProjectConfig(root);
    expect(config.name).toBe('demo');
    expect(config.idPrefix).toBe('ACME');
    expect(config.modules.mockups).toBe(true);
  });

  it('respecte le preset demandé', async () => {
    expect(await cli('init', root, '--yes', '--preset', 'api-service')).toBe(0);

    const config = await readProjectConfig(root);
    expect(config.modules.contracts).toBe(true);
    expect(config.modules.mockups).toBe(false);
  });

  it('n’écrit rien en --dry-run', async () => {
    expect(await cli('init', root, '--yes', '--dry-run')).toBe(0);
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it('refuse de réinitialiser un projet existant', async () => {
    expect(await cli('init', root, '--yes')).toBe(0);
    expect(await cli('init', root, '--yes')).toBe(1);
  });

  it('échoue proprement sur un preset inconnu', async () => {
    expect(await cli('init', root, '--yes', '--preset', 'nimporte-quoi')).toBe(1);
  });
});

describe('klee module', () => {
  it('refuse d’ajouter un module socle', async () => {
    expect(await cli('module', 'add', 'tickets')).toBe(1);
  });

  it('refuse un module inconnu', async () => {
    expect(await cli('module', 'add', 'blockchain')).toBe(1);
  });
});
