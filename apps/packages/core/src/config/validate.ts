import { ConfigError } from '../errors.js';
import { CORE_MODULE_IDS, MODULES } from '../modules.js';
import { providerRegistry } from '../providers/index.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { PROVIDER_POINTS } from '../providers/types.js';
import { TOKEN_STARTERS, findTokenStarter } from '../token-starters.js';
import { REQUIRED_TOKEN_TARGET, type ProjectConfig } from './schema.js';

/**
 * Invariants sémantiques d'une configuration (TECHNICAL.md §13). Séparés du schéma parce
 * qu'ils dépendent du registre de providers : une config peut être syntaxiquement valide
 * et référencer un provider qui n'existe pas.
 */
export function validateProjectConfig(
  config: ProjectConfig,
  registry: ProviderRegistry = providerRegistry,
): void {
  const problems: string[] = [];

  for (const id of CORE_MODULE_IDS) {
    if (!config.modules[id]) {
      problems.push(`le module socle « ${MODULES[id].label} » ne peut pas être désactivé`);
    }
  }

  for (const point of PROVIDER_POINTS) {
    const id = config.providers[point];
    if (registry.find(point, id) === undefined) {
      problems.push(
        `provider inconnu pour « ${point} » : "${id}" (disponibles : ${registry.ids(point).join(', ')})`,
      );
    }
  }

  if (config.modules.mockups) {
    if (config.designSystem === undefined) {
      problems.push('le module « mockups » impose une section `designSystem` (cf TECHNICAL.md §3)');
    } else {
      if (!config.designSystem.targets.includes(REQUIRED_TOKEN_TARGET)) {
        problems.push(
          `la cible de tokens « ${REQUIRED_TOKEN_TARGET} » est le socle universel et ne peut pas être retirée`,
        );
      }
      if (findTokenStarter(config.designSystem.tokenStarter) === undefined) {
        problems.push(
          `starter de tokens inconnu : "${config.designSystem.tokenStarter}" (disponibles : ${TOKEN_STARTERS.map((starter) => starter.id).join(', ')})`,
        );
      }
    }
  } else if (config.designSystem !== undefined) {
    problems.push(
      'section `designSystem` présente alors que le module « mockups » est absent : design-system/ suit exactement la condition de mockups/',
    );
  }

  if (problems.length > 0) {
    throw new ConfigError(`Configuration invalide :\n  - ${problems.join('\n  - ')}`, {
      hint: 'Corrigez project.config.json, ou régénérez-le avec `klee init`.',
    });
  }
}
