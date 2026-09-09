import { MODULE_IDS } from '../modules.js';
import { MODULE_GENERATORS } from '../scaffold/modules/index.js';
import type { ScaffoldContext, ScaffoldGenerator } from '../scaffold/types.js';
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
 * Tout ce qui peut déclarer : les providers retenus, et les modules retenus.
 *
 * Un module apporte lui aussi des dépendances — le gate d'accessibilité du module `mockups`
 * amène Playwright, dont le script d'installation télécharge un navigateur (ADR 0018). Le
 * faire déclarer par un provider qui n'en est pas la cause aurait rendu cette exigence
 * tributaire d'un choix qui n'a rien à voir avec elle.
 */
function declarants(context: ScaffoldContext): (Provider | ScaffoldGenerator)[] {
  const modules = MODULE_IDS.filter((id) => context.config.modules[id]).map(
    (id) => MODULE_GENERATORS[id],
  );
  return [...retainedProviders(context), ...modules];
}

/** Nom lisible d'un déclarant, pour dire qui contredit qui. */
function nameOf(declarant: Provider | ScaffoldGenerator): string {
  return 'id' in declarant ? declarant.id : 'un module';
}

/**
 * Deux providers qui tranchent différemment la même chose : personne ne peut arbitrer ça
 * silencieusement, et le faire au hasard de l'ordre des points serait pire.
 */
function merge<T>(
  context: ScaffoldContext,
  what: string,
  pick: (declarant: Provider | ScaffoldGenerator) => Readonly<Record<string, T>> | undefined,
): Record<string, T> {
  const merged: Record<string, T> = {};
  const origins = new Map<string, string>();

  for (const declarant of declarants(context)) {
    for (const [key, value] of Object.entries(pick(declarant) ?? {})) {
      const previous = origins.get(key);
      if (previous !== undefined && merged[key] !== value) {
        throw new Error(
          `Décisions contradictoires sur ${what} de ${key} : ` +
            `${previous} et ${nameOf(declarant)} ne sont pas d'accord.`,
        );
      }
      merged[key] = value;
      origins.set(key, nameOf(declarant));
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
  // Réservé aux providers : corriger un arbre transitif suppose de connaître l'outil qu'on
  // apporte, ce qui est le propre d'un provider et non d'un module.
  return merge<string>(context, 'la version imposée', (declarant) =>
    'dependencyOverrides' in declarant ? declarant.dependencyOverrides : undefined,
  );
}
