import type { ScaffoldContext } from '../scaffold/types.js';
import { PROVIDER_POINT_DEFINITIONS } from './points.js';
import { PROVIDER_POINTS, type Provider } from './types.js';

/**
 * Ce que les providers retenus déclarent apporter au projet, au-delà de leurs fichiers et de
 * leurs dépendances (ADR 0012).
 *
 * Le provider qui *apporte* une dépendance sait ce qu'elle traîne ; le provider `workspace`
 * *possède* le fichier où la décision s'écrit. Ces fonctions font la jonction dans le bon
 * sens : le second interroge, aucun des deux ne connaît l'autre. Ajouter un provider ne
 * demande donc de toucher à rien d'autre que lui.
 */

/** Providers effectivement retenus : un point dont le module est absent ne compte pas. */
function retainedProviders(context: ScaffoldContext): Provider[] {
  return PROVIDER_POINTS.filter((point) => {
    const requires = PROVIDER_POINT_DEFINITIONS[point].requiresModule;
    return requires === null || context.config.modules[requires];
  }).map((point) => context.registry.resolve(point, context.config.providers[point]));
}

/**
 * Deux providers qui tranchent différemment la même chose : personne ne peut arbitrer ça
 * silencieusement, et le faire au hasard de l'ordre des points serait pire.
 */
function merge<T>(
  context: ScaffoldContext,
  what: string,
  pick: (provider: Provider) => Readonly<Record<string, T>> | undefined,
): Record<string, T> {
  const merged: Record<string, T> = {};
  const origins = new Map<string, string>();

  for (const provider of retainedProviders(context)) {
    for (const [key, value] of Object.entries(pick(provider) ?? {})) {
      const previous = origins.get(key);
      if (previous !== undefined && merged[key] !== value) {
        throw new Error(
          `Décisions contradictoires sur ${what} de ${key} : ` +
            `${previous} et ${provider.id} ne sont pas d'accord.`,
        );
      }
      merged[key] = value;
      origins.set(key, provider.id);
    }
  }

  return Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Scripts de post-installation, et la décision prise pour chacun.
 *
 * Le gestionnaire de paquets refuse d'exécuter un tel script sans permission explicite, et
 * refuse aussi de l'ignorer en silence : sans décision, `pnpm install` échoue.
 */
export function installScriptDecisions(context: ScaffoldContext): Record<string, boolean> {
  return merge<boolean>(context, "le script d'installation", (provider) => provider.installScripts);
}

/**
 * Versions imposées dans l'arbre transitif d'un provider.
 *
 * Sert à corriger ce qu'une dépendance profonde traîne et que son auteur n'a pas encore
 * corrigé — un avis de sécurité, un paquet déprécié. Un scaffolding ne doit pas livrer un
 * projet qui avertit dès sa première installation.
 */
export function dependencyOverrideDecisions(context: ScaffoldContext): Record<string, string> {
  return merge<string>(context, 'la version imposée', (provider) => provider.dependencyOverrides);
}
