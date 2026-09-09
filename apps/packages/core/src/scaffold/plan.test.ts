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
      'design-system/tokens.json',
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

describe('phase 1 — design system et maquettes', () => {
  const plan = buildScaffoldPlan({ config: configFor('full-product'), now: FIXED_NOW });
  const paths = plan.files.map((file) => file.path);

  it('génère les tokens DTCG et le pipeline de transformation', () => {
    expect(paths).toContain('design-system/tokens.json');
    expect(paths).toContain('design-system/style-dictionary.config.mjs');
    expect(paths).toContain('design-system/package.json');
  });

  it('génère un composant, une page et le serveur de navigation', () => {
    expect(paths).toEqual(
      expect.arrayContaining([
        'mockups/eleventy.config.mjs',
        'mockups/_includes/components/button.njk',
        'mockups/components/button/button.html',
        'mockups/components/button/button.meta.yml',
        'mockups/pages/login.html',
      ]),
    );
  });

  it('déclare les dépendances dans le package.json de chaque dossier', () => {
    const byTarget = new Map(plan.dependencies.map((d) => [d.name, d.target]));
    expect(byTarget.get('style-dictionary')).toBe('design-system/package.json');
    expect(byTarget.get('@11ty/eleventy')).toBe('mockups/package.json');
    expect(byTarget.get('turbo')).toBe('package.json');
  });

  it('expose la commande d’installation du provider workspace', () => {
    expect(plan.installCommand).toEqual(['pnpm', 'install']);
  });

  it('n’écrit aucune valeur de couleur en dur dans les maquettes', () => {
    // DESIGN.md §2 : une maquette passe par les tokens, jamais par une valeur brute.
    for (const file of plan.files) {
      if (!file.path.startsWith('mockups/') || !file.path.endsWith('.css')) continue;
      expect(file.contents).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it('ne génère ni tokens ni maquettes quand le module est absent', () => {
    const lib = buildScaffoldPlan({ config: configFor('internal-lib'), now: FIXED_NOW });
    expect(lib.dependencies.map((d) => d.name)).toEqual(['turbo']);
    expect(lib.files.some((file) => file.path.startsWith('design-system/'))).toBe(false);
  });
});

describe('assets des maquettes', () => {
  /**
   * Eleventy ne publie que ce qu'il sait rendre : un asset non déclaré en passthrough
   * n'atteint jamais le navigateur. Le HTML reste correct, seul le style disparaît — un bug
   * silencieux qu'aucune vérification de statut HTTP sur la page ne détecte.
   */
  function passthroughPatterns(config: string): string[] {
    return [...config.matchAll(/addPassthroughCopy\('([^']+)'\)/g)].map((match) => match[1] ?? '');
  }

  function matches(pattern: string, path: string): boolean {
    const source = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\{([^}]+)\}/g, (_all, group: string) => `(${group.split(',').join('|')})`)
      .replace(/\*\*\//g, '(.*/)?')
      .replace(/(?<!\.)\*/g, '[^/]*');
    return new RegExp(`^${source}$`).test(path);
  }

  it('déclare en passthrough chaque asset généré sous mockups/', () => {
    const plan = buildScaffoldPlan({ config: configFor('full-product'), now: FIXED_NOW });
    const config = plan.files.find((file) => file.path === 'mockups/eleventy.config.mjs')?.contents;
    expect(config).toBeDefined();

    const patterns = passthroughPatterns(config ?? '');
    const assets = plan.files
      .map((file) => file.path)
      .filter((path) => path.startsWith('mockups/') && /\.(css|js|svg|png|woff2)$/.test(path))
      // Les fichiers de configuration et de données ne sont pas publiés.
      .filter((path) => !path.startsWith('mockups/_') && !path.endsWith('.config.mjs'));

    expect(assets.length).toBeGreaterThan(0);
    for (const asset of assets) {
      const relative = asset.slice('mockups/'.length);
      expect(
        patterns.some((pattern) => matches(pattern, relative)),
        `${relative} n'est couvert par aucun addPassthroughCopy : il sortira en 404.`,
      ).toBe(true);
    }
  });
});
