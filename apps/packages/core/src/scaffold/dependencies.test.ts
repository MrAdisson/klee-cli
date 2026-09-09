import { describe, expect, it } from 'vitest';

import { mergeDependencies } from './dependencies.js';
import type { ScaffoldDependency, ScaffoldFile } from './types.js';

const manifest: ScaffoldFile = {
  path: 'package.json',
  origin: 'provider:workspace/pnpm-turborepo',
  contents: '{\n  "name": "demo",\n  "scripts": {}\n}\n',
};

function dependency(overrides: Partial<ScaffoldDependency> = {}): ScaffoldDependency {
  return {
    name: 'turbo',
    version: '^2.0.0',
    dev: true,
    target: 'package.json',
    origin: 'test',
    ...overrides,
  };
}

function parse(files: readonly ScaffoldFile[], path: string): Record<string, unknown> {
  const file = files.find((candidate) => candidate.path === path);
  if (file === undefined) throw new Error(`${path} absent du plan`);
  return JSON.parse(file.contents) as Record<string, unknown>;
}

describe('mergeDependencies', () => {
  it('fusionne dans le package.json ciblé, en séparant dev et runtime', () => {
    const files = mergeDependencies(
      [manifest],
      [dependency(), dependency({ name: 'zod', version: '^4.0.0', dev: false })],
    );

    expect(parse(files, 'package.json')).toMatchObject({
      name: 'demo',
      dependencies: { zod: '^4.0.0' },
      devDependencies: { turbo: '^2.0.0' },
    });
  });

  it('trie les dépendances, comme le ferait un gestionnaire de paquets', () => {
    const files = mergeDependencies(
      [manifest],
      [dependency({ name: 'yaml' }), dependency({ name: '@11ty/eleventy' })],
    );

    expect(Object.keys(parse(files, 'package.json')['devDependencies'] as object)).toEqual([
      '@11ty/eleventy',
      'yaml',
    ]);
  });

  it('laisse intacts les fichiers non ciblés', () => {
    const other: ScaffoldFile = { path: 'README.md', contents: '# demo\n', origin: 'module:root' };
    const files = mergeDependencies([manifest, other], [dependency()]);

    expect(files.find((file) => file.path === 'README.md')).toEqual(other);
  });

  it('refuse une dépendance dont le package.json cible n’est pas généré', () => {
    expect(() =>
      mergeDependencies([manifest], [dependency({ target: 'mockups/package.json' })]),
    ).toThrow(/absent du plan/);
  });

  it('refuse deux versions incompatibles du même paquet', () => {
    expect(() =>
      mergeDependencies([manifest], [dependency(), dependency({ version: '^3.0.0' })]),
    ).toThrow(/Versions incompatibles/);
  });

  it('accepte la même version déclarée deux fois', () => {
    const files = mergeDependencies([manifest], [dependency(), dependency()]);
    expect(parse(files, 'package.json')['devDependencies']).toEqual({ turbo: '^2.0.0' });
  });
});
