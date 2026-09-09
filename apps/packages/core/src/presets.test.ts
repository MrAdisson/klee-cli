import { describe, expect, it } from 'vitest';

import { CORE_MODULE_IDS } from './modules.js';
import { PRESET_IDS, moduleSelectionFromPreset } from './presets.js';

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
