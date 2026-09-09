import { describe, expect, it } from 'vitest';

import { ConfigError } from '../errors.js';
import { moduleSelectionFromPreset } from '../presets.js';
import { createProjectConfig, defaultProviderSelection } from './defaults.js';
import { validateProjectConfig } from './validate.js';
import type { ProjectConfig } from './schema.js';

function baseConfig(preset: 'full-product' | 'internal-lib' = 'full-product'): ProjectConfig {
  return createProjectConfig({ name: 'demo', modules: moduleSelectionFromPreset(preset) });
}

describe('createProjectConfig', () => {
  it('applique les providers par défaut et le préfixe PROJ', () => {
    const config = baseConfig();
    expect(config.idPrefix).toBe('PROJ');
    expect(config.providers).toEqual(defaultProviderSelection());
  });

  it('n’émet la section designSystem que si le module mockups est retenu', () => {
    expect(baseConfig('full-product').designSystem).toEqual({ targets: ['css'] });
    expect(baseConfig('internal-lib').designSystem).toBeUndefined();
  });

  it('force la cible css même si elle n’est pas demandée', () => {
    const config = createProjectConfig({
      name: 'demo',
      modules: moduleSelectionFromPreset('full-product'),
      tokenTargets: ['tailwind'],
    });
    expect(config.designSystem?.targets).toEqual(['css', 'tailwind']);
  });

  it('rejette un nom de projet inutilisable comme nom de package', () => {
    expect(() =>
      createProjectConfig({
        name: 'Mon Projet',
        modules: moduleSelectionFromPreset('internal-lib'),
      }),
    ).toThrow(ConfigError);
  });
});

describe('validateProjectConfig', () => {
  it('refuse la désactivation d’un module socle', () => {
    const config: ProjectConfig = {
      ...baseConfig(),
      modules: { ...baseConfig().modules, tickets: false },
    };
    expect(() => {
      validateProjectConfig(config);
    }).toThrow(/socle/);
  });

  it('refuse un provider absent du registre', () => {
    const config: ProjectConfig = {
      ...baseConfig(),
      providers: { ...baseConfig().providers, workspace: 'bazel' },
    };
    expect(() => {
      validateProjectConfig(config);
    }).toThrow(/provider inconnu/i);
  });

  it('refuse une section designSystem sans le module mockups', () => {
    const config: ProjectConfig = {
      ...baseConfig('internal-lib'),
      designSystem: { targets: ['css'] },
    };
    expect(() => {
      validateProjectConfig(config);
    }).toThrow(/designSystem/);
  });

  it('refuse le retrait de la cible css, socle universel', () => {
    const config: ProjectConfig = { ...baseConfig(), designSystem: { targets: ['tailwind'] } };
    expect(() => {
      validateProjectConfig(config);
    }).toThrow(/css/);
  });
});
