import { MOCKUP_PREFIX } from '../../ids.js';
import { agentsDoc } from '../agents-doc.js';
import { textContents } from '../format.js';
import type { ScaffoldContext, ScaffoldFile, ScaffoldGenerator } from '../types.js';

/** `apps/` — code applicatif (TECHNICAL.md §2). Monorepo classique, rien à inventer. */
export const appsGenerator: ScaffoldGenerator = {
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'module:apps';
    const withMockups = context.config.modules.mockups;

    return [
      {
        path: 'apps/AGENTS.md',
        origin,
        contents: agentsDoc({
          title: 'apps/ — code applicatif',
          role: "Applications et librairies partagées du monorepo. C'est la brique la plus standard du système : les conventions du langage et du framework priment.",
          conventions: [
            'Une application par dossier (`apps/web`, `apps/api`), les librairies partagées dans `apps/packages/`.',
            'Chaque commit ou PR référence le ticket qui le motive.',
            ...(withMockups
              ? [
                  `Tout composant UI qui transcrit une maquette référence le chemin de sa maquette source (commentaire d'en-tête ou métadonnée) : c'est ce lien qui rend la détection de dérive possible.`,
                  `Transcrire une maquette n'est pas la réinterpréter : une décision de design absente de la maquette ${MOCKUP_PREFIX}-xxx se règle dans la maquette, pas ici.`,
                ]
              : []),
          ],
          allowed: [
            'Créer et modifier le code applicatif, ses tests et sa configuration de build.',
            'Ajouter une dépendance justifiée par un ticket.',
          ],
          forbidden: [
            'Committer une valeur de design en dur alors qu’un token existe.',
            'Committer un secret, une clé d’API ou une donnée client.',
            ...(withMockups
              ? ['Diverger d’une maquette `status: implemented` sans mettre à jour la maquette.']
              : []),
          ],
          references: [
            '`AGENTS.md` (racine) — vue d’ensemble.',
            ...(withMockups ? ['`mockups/AGENTS.md` — source de vérité visuelle.'] : []),
          ],
        }),
      },
      {
        path: 'apps/packages/.gitkeep',
        origin,
        contents: textContents(''),
      },
    ];
  },
};
