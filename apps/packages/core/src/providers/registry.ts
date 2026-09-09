import { UnknownProviderError } from '../errors.js';
import type { Provider, ProviderPoint } from './types.js';

/**
 * Factory de providers (TECHNICAL.md §13). Le registre est la seule chose que doit
 * connaître un nouveau provider : ni la CLI, ni les modules, ni la config n'ont à changer.
 */
export class ProviderRegistry {
  readonly #byPoint = new Map<ProviderPoint, Map<string, Provider>>();

  constructor(providers: readonly Provider[] = []) {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  register(provider: Provider): this {
    let bucket = this.#byPoint.get(provider.point);
    if (bucket === undefined) {
      bucket = new Map<string, Provider>();
      this.#byPoint.set(provider.point, bucket);
    }
    if (bucket.has(provider.id)) {
      throw new Error(
        `Provider déjà enregistré pour le point « ${provider.point} » : "${provider.id}".`,
      );
    }
    bucket.set(provider.id, provider);
    return this;
  }

  find(point: ProviderPoint, id: string): Provider | undefined {
    return this.#byPoint.get(point)?.get(id);
  }

  /** Résolution stricte : une config qui référence un provider inconnu doit échouer tôt. */
  resolve(point: ProviderPoint, id: string): Provider {
    const provider = this.find(point, id);
    if (provider === undefined) {
      throw new UnknownProviderError(point, id, this.ids(point));
    }
    return provider;
  }

  list(point: ProviderPoint): Provider[] {
    return [...(this.#byPoint.get(point)?.values() ?? [])];
  }

  ids(point: ProviderPoint): string[] {
    return this.list(point).map((provider) => provider.id);
  }
}
