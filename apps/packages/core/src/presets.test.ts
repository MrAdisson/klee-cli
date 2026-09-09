import { describe, expect, it } from 'vitest';

import { defaultProviderSelection } from './config/defaults.js';
import { CORE_MODULE_IDS } from './modules.js';
import { PRESET_IDS, moduleSelectionFromPreset, providerDefaultsFromPreset } from './presets.js';
import { PROVIDER_POINT_DEFINITIONS } from './providers/points.js';

describe('presets', () => {
  it.each(PRESET_IDS)('le preset %s retient tout le socle', (presetId) => {
    const modules = moduleSelectionFromPreset(presetId);
    for (const id of CORE_MODULE_IDS) {
      expect(modules[id]).toBe(true);
    }
  });

  it('full-product retient tous les modules optionnels', () => {
    const modules = moduleSelectionFromPreset('full-product');
    expect(modules.mockups).toBe(true);
    expect(modules.contracts).toBe(true);
    expect(modules['docs-product']).toBe(true);
    expect(modules['docs-i18n-copy']).toBe(true);
  });

  it('api-service inclut contracts mais pas les maquettes', () => {
    const modules = moduleSelectionFromPreset('api-service');
    expect(modules.contracts).toBe(true);
    expect(modules.mockups).toBe(false);
  });

  it('internal-lib ne retient aucun module optionnel', () => {
    const modules = moduleSelectionFromPreset('internal-lib');
    expect(modules.mockups).toBe(false);
    expect(modules.contracts).toBe(false);
    expect(modules['docs-product']).toBe(false);
  });
});

/**
 * Un preset peut proposer un défaut de provider, jamais l'imposer (ADR 0012). C'est un écart
 * assumé à la lettre de TECHNICAL.md §13, qui n'accordait au preset que l'axe 1.
 */
describe('défauts de provider proposés par un preset', () => {
  it('internal-lib propose markdown-only pour éviter un site à une bibliothèque', () => {
    expect(providerDefaultsFromPreset('internal-lib').docs).toBe('markdown-only');
    expect(defaultProviderSelection('internal-lib').docs).toBe('markdown-only');
  });

  it('les autres presets gardent le défaut du point', () => {
    for (const preset of ['full-product', 'api-service'] as const) {
      expect(defaultProviderSelection(preset).docs).toBe(
        PROVIDER_POINT_DEFINITIONS.docs.defaultProvider,
      );
    }
  });

  it('un preset ne propose jamais un provider inconnu du point', () => {
    for (const preset of PRESET_IDS) {
      for (const [point, id] of Object.entries(providerDefaultsFromPreset(preset))) {
        expect(typeof id).toBe('string');
        expect(
          PROVIDER_POINT_DEFINITIONS[point as keyof typeof PROVIDER_POINT_DEFINITIONS],
        ).toBeDefined();
      }
    }
  });
});
