import { describe, expect, it } from 'vitest';

import { createProjectConfig } from '../config/defaults.js';
import type { ProjectConfig } from '../config/schema.js';
import { moduleSelectionFromPreset } from '../presets.js';
import type { PresetId } from '../presets.js';
import { buildScaffoldPlan } from './plan.js';

const FIXED_NOW = new Date('2026-01-15T00:00:00.000Z');

function configFor(preset: PresetId): ProjectConfig {
  return createProjectConfig({ name: 'demo', modules: moduleSelectionFromPreset(preset) });
}

function paths(preset: PresetId): string[] {
  return buildScaffoldPlan({ config: configFor(preset), now: FIXED_NOW }).files.map(
    (file) => file.path,
  );
}

describe('buildScaffoldPlan', () => {
  it('génère le socle quel que soit le preset', () => {
    for (const preset of ['full-product', 'api-service', 'internal-lib'] as const) {
      expect(paths(preset)).toEqual(
        expect.arrayContaining([
          'project.config.json',
          'AGENTS.md',
          '.agents/AGENTS.md',
          'apps/AGENTS.md',
          'tickets/AGENTS.md',
          'docs/AGENTS.md',
          'docs/decisions/0001-repo-topology.md',
        ]),
      );
    }
  });

  it('un module non retenu ne génère aucun fichier', () => {
    const lib = paths('internal-lib');
    expect(lib.some((path) => path.startsWith('mockups/'))).toBe(false);
    expect(lib.some((path) => path.startsWith('design-system/'))).toBe(false);
    expect(lib.some((path) => path.startsWith('contracts/'))).toBe(false);
    expect(lib.some((path) => path.startsWith('docs/product/'))).toBe(false);
  });

  it('mockups entraîne design-system, sans question séparée', () => {
    const full = paths('full-product');
    expect(full).toContain('mockups/AGENTS.md');
    expect(full).toContain('design-system/AGENTS.md');
  });

  it('nomme le dossier de contrats d’après le provider retenu', () => {
    const config = createProjectConfig({
      name: 'demo',
      modules: moduleSelectionFromPreset('api-service'),
      providers: { contracts: 'graphql' },
    });
    const plan = buildScaffoldPlan({ config, now: FIXED_NOW });
    expect(plan.files.map((file) => file.path)).toContain('contracts/graphql/.gitkeep');
  });

  it('est reproductible à date fixée', () => {
    const config = configFor('full-product');
    const first = buildScaffoldPlan({ config, now: FIXED_NOW });
    const second = buildScaffoldPlan({ config, now: FIXED_NOW });
    expect(second).toEqual(first);
  });

  it('permet de ne planifier qu’un module, sans racine ni providers', () => {
    const plan = buildScaffoldPlan({
      config: configFor('full-product'),
      now: FIXED_NOW,
      modules: ['mockups'],
      includeRoot: false,
      includeProviders: false,
    });
    expect(plan.files.map((file) => file.path)).toEqual([
      'mockups/AGENTS.md',
      'mockups/components/.gitkeep',
      'mockups/pages/.gitkeep',
      'design-system/AGENTS.md',
    ]);
  });

  it('attribue une origine traçable à chaque fichier', () => {
    for (const file of buildScaffoldPlan({ config: configFor('full-product'), now: FIXED_NOW })
      .files) {
      expect(file.origin).toMatch(/^(module|provider):/);
    }
  });
});
