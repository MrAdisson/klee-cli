import { agentsDoc } from '../agents-doc.js';
import { textContents } from '../format.js';
import type { ScaffoldContext, ScaffoldFile, ScaffoldGenerator } from '../types.js';

/** `contracts/` — schémas d'API et modèle de domaine (TECHNICAL.md §8). */
export const contractsGenerator: ScaffoldGenerator = {
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'module:contracts';
    const provider = context.registry.resolve('contracts', context.config.providers.contracts);

    return [
      {
        path: 'contracts/AGENTS.md',
        origin,
        contents: agentsDoc({
          title: 'contracts/ — contrats d’interface et domaine',
          role: `Contrat d'interface au format ${provider.label}, plus le glossaire métier partagé. Sert à ce qu'un agent travaillant côté front n'ait pas besoin du contexte backend complet.`,
          conventions: [
            `Le schéma \`${provider.id}/\` est la source de vérité de l'interface : le code s'y conforme, il ne le documente pas après coup.`,
            '`domain/` porte le glossaire métier : chaque agent part de la même compréhension du domaine plutôt que de la réinventer à chaque ticket.',
            'Un changement de contrat non rétrocompatible est une décision : il passe par un ADR.',
          ],
          allowed: [
            'Faire évoluer le schéma d’interface en accord avec le ticket qui le motive.',
            'Enrichir le glossaire de domaine.',
          ],
          forbidden: [
            'Modifier le contrat pour l’aligner sur une implémentation qui a dérivé : corriger l’implémentation.',
            'Y faire figurer une URL de production, un jeton ou un identifiant de client.',
          ],
          references: ['`AGENTS.md` (racine).', '`docs/decisions/` — ADR.'],
        }),
      },
      { path: `contracts/${provider.id}/.gitkeep`, origin, contents: textContents('') },
      { path: 'contracts/domain/.gitkeep', origin, contents: textContents('') },
    ];
  },
};
