import { describe, expect, it } from 'vitest';

import { UnknownProviderError } from '../errors.js';
import { PROVIDER_POINT_DEFINITIONS } from './points.js';
import { providerRegistry } from './index.js';
import { ProviderRegistry } from './registry.js';
import { PROVIDER_POINTS, type Provider } from './types.js';

const fake: Provider = {
  id: 'fake',
  point: 'workspace',
  label: 'Fake',
  description: 'Provider de test.',
  files: () => [],
};

describe('registre par défaut', () => {
  it.each(PROVIDER_POINTS)('le point %s propose au moins deux providers', (point) => {
    // Un point ne mérite le traitement « provider » que s'il existe au moins deux
    // solutions solides (TECHNICAL.md §13) : un point à une seule option est une
    // convention déguisée en configuration.
    expect(providerRegistry.list(point).length).toBeGreaterThanOrEqual(2);
  });

  it.each(PROVIDER_POINTS)('le défaut annoncé pour %s existe réellement', (point) => {
    const { defaultProvider } = PROVIDER_POINT_DEFINITIONS[point];
    expect(providerRegistry.find(point, defaultProvider)).toBeDefined();
  });
});

describe('ProviderRegistry', () => {
  it('résout un provider enregistré', () => {
    const registry = new ProviderRegistry([fake]);
    expect(registry.resolve('workspace', 'fake')).toBe(fake);
  });

  it('échoue explicitement sur un provider inconnu', () => {
    const registry = new ProviderRegistry([fake]);
    expect(() => registry.resolve('workspace', 'bazel')).toThrow(UnknownProviderError);
  });

  it('refuse deux providers de même identifiant sur un même point', () => {
    expect(() => new ProviderRegistry([fake, fake])).toThrow(/déjà enregistré/);
  });
});
