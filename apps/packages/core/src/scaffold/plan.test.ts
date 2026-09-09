import { describe, expect, it } from 'vitest';

import { createProjectConfig, defaultProviderSelection } from '../config/defaults.js';
import type { ProjectConfig } from '../config/schema.js';
import { moduleSelectionFromPreset } from '../presets.js';
import type { PresetId } from '../presets.js';
import { buildScaffoldPlan } from './plan.js';

const FIXED_NOW = new Date('2026-01-15T00:00:00.000Z');

/** Ce que produit réellement `klee init --preset <preset> --yes`, providers compris. */
function configFor(preset: PresetId): ProjectConfig {
  return createProjectConfig({
    name: 'demo',
    modules: moduleSelectionFromPreset(preset),
    providers: defaultProviderSelection(preset),
  });
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
      modules: ['tickets'],
      includeRoot: false,
      includeProviders: false,
    });
    expect(plan.files.map((file) => file.path)).toEqual([
      'tickets/AGENTS.md',
      'tickets/PROJ-001-demo-initialisation-du-projet.md',
    ]);
  });

  it('refuse de planifier `mockups` sans ses providers : ses dépendances seraient orphelines', () => {
    // Le module apporte Playwright pour le gate d'accessibilité (ADR 0018), mais c'est le
    // provider de composition qui possède `mockups/package.json`. Les séparer produirait des
    // dépendances déclarées vers un manifeste absent — mieux vaut le refus que le silence.
    expect(() =>
      buildScaffoldPlan({
        config: configFor('full-product'),
        now: FIXED_NOW,
        modules: ['mockups'],
        includeRoot: false,
        includeProviders: false,
      }),
    ).toThrow(/mockups\/package\.json/);
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
    expect(lib.files.some((file) => file.path.startsWith('design-system/'))).toBe(false);
    expect(lib.files.some((file) => file.path.startsWith('mockups/'))).toBe(false);
  });

  /**
   * Le point `docs` appartient au socle : avec Docusaurus, même une bibliothèque interne
   * embarquerait React. `internal-lib` propose donc `markdown-only` (ADR 0012).
   */
  it('n’impose aucun site de documentation à une bibliothèque interne', () => {
    const lib = buildScaffoldPlan({ config: configFor('internal-lib'), now: FIXED_NOW });

    expect(lib.dependencies.map((d) => d.name)).toEqual(['turbo']);
    expect(lib.files.some((file) => file.path === 'docs/package.json')).toBe(false);
    // Le contenu, lui, reste : le socle est la documentation, pas son site.
    expect(lib.files.some((file) => file.path === 'docs/technical/index.md')).toBe(true);
  });

  it('mais la proposition du preset reste une proposition', () => {
    const config = configFor('internal-lib');
    const withSite = buildScaffoldPlan({
      config: { ...config, providers: { ...config.providers, docs: 'docusaurus' } },
      now: FIXED_NOW,
    });

    expect(withSite.files.some((file) => file.path === 'docs/package.json')).toBe(true);
  });

  /**
   * La décision vient du provider qui apporte la dépendance, pas d'une liste tenue dans le
   * provider `workspace` : c'est ce qui permet d'ajouter un provider sans toucher à un autre
   * (ADR 0012). Sans ce bloc, `pnpm install` échoue sur un projet neuf.
   */
  it('inscrit les scripts de post-installation déclarés par les providers retenus', () => {
    const workspaceFile = (preset: PresetId): string => {
      const plan = buildScaffoldPlan({ config: configFor(preset), now: FIXED_NOW });
      return plan.files.find((file) => file.path === 'pnpm-workspace.yaml')?.contents ?? '';
    };

    expect(workspaceFile('full-product')).toContain('core-js: false');
    // Aucun provider retenu n'en déclare : pas de bloc du tout, pas un bloc vide.
    expect(workspaceFile('internal-lib')).not.toContain('allowBuilds');
  });

  /**
   * Un scaffolding ne doit pas livrer un projet qui avertit dès sa première installation.
   * Les portées sont conservées : l'override s'efface de lui-même quand l'amont bouge.
   */
  it('impose les versions que les providers retenus déclarent, portée comprise', () => {
    const workspaceFile = (preset: PresetId): string => {
      const plan = buildScaffoldPlan({ config: configFor(preset), now: FIXED_NOW });
      return plan.files.find((file) => file.path === 'pnpm-workspace.yaml')?.contents ?? '';
    };

    expect(workspaceFile('full-product')).toContain('uuid@<11.1.1: ^11.1.1');
    expect(workspaceFile('internal-lib')).not.toContain('overrides:');
  });

  /** npm ne connaît pas la forme `paquet@portée` : la portée tombe, l'override reste. */
  it('traduit les versions imposées pour un workspace npm', () => {
    const config = configFor('full-product');
    const plan = buildScaffoldPlan({
      config: { ...config, providers: { ...config.providers, workspace: 'nx' } },
      now: FIXED_NOW,
    });

    const manifest = plan.files.find((file) => file.path === 'package.json')?.contents ?? '{}';
    expect(JSON.parse(manifest).overrides).toMatchObject({ uuid: '^11.1.1' });
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

/**
 * Le premier ticket d'un projet neuf.
 *
 * Un board qui affiche du travail en attente dès l'init ment sur l'état du projet : personne
 * n'a décidé ce travail. Ce ticket consigne ce que l'init a retenu, et rien d'autre.
 */
describe('ticket d’initialisation', () => {
  function seed(preset: PresetId): string {
    const plan = buildScaffoldPlan({ config: configFor(preset), now: FIXED_NOW });
    return (
      plan.files.find(
        (file) =>
          file.path.startsWith('tickets/') &&
          file.path.endsWith('.md') &&
          !file.path.endsWith('AGENTS.md'),
      )?.contents ?? ''
    );
  }

  it('est un compte rendu terminé, pas une tâche en attente', () => {
    const ticket = seed('full-product');
    expect(ticket).toContain('status: done');
    expect(ticket).toContain('initialisation du projet');
    // Aucun gabarit de critères d'acceptation : on ne pose pas de conditions sur un fait acquis.
    expect(ticket).not.toContain('```gherkin');
  });

  it('consigne les modules et providers réellement retenus', () => {
    const complet = seed('full-product');
    const librairie = seed('internal-lib');

    expect(complet).toContain('Eleventy');
    // `internal-lib` ne retient pas les maquettes : leur provider n'a pas à figurer.
    expect(librairie).not.toContain('Eleventy');
    expect(librairie).toContain('tickets/ — ticketing markdown-native');
    // Le libellé porte déjà les chemins : les répéter donnait « apps/ — apps/ — … ».
    expect(librairie).not.toContain('`apps/` — apps/');
  });

  it('relie le projet à son ADR de topologie, pour un graphe non vide dès l’init', () => {
    expect(seed('full-product')).toContain('DOC-001');
  });

  it('ne fabrique aucune arête vers une maquette que personne n’a demandée', () => {
    const plan = buildScaffoldPlan({ config: configFor('full-product'), now: FIXED_NOW });
    const meta = plan.files.find((file) => file.path.endsWith('login.meta.yml'))?.contents ?? '';
    expect(meta).toContain('related_tickets: []');
  });
});
