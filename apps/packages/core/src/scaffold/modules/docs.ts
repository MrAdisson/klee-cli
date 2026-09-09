import { DOC_PREFIX, MOCKUP_PREFIX, formatId } from '../../ids.js';
import { agentsDoc } from '../agents-doc.js';
import { textContents } from '../format.js';
import type { ScaffoldContext, ScaffoldFile, ScaffoldGenerator } from '../types.js';

/** `docs/` — technical, design, product, decisions (TECHNICAL.md §5). */

function isoDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Frontmatter minimal commun à toute doc (TECHNICAL.md §5). Le graphe de traçabilité
 * dépend de sa présence : une doc sans `id` est une doc que rien ne peut référencer.
 */
function frontmatter(fields: Record<string, string>): string {
  return ['---', ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`), '---'].join(
    '\n',
  );
}

export const docsTechnicalGenerator: ScaffoldGenerator = {
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'module:docs-technical';
    const docsProvider = context.registry.resolve('docs', context.config.providers.docs);

    return [
      {
        path: 'docs/AGENTS.md',
        origin,
        contents: agentsDoc({
          title: 'docs/ — documentation',
          role: "Deux natures de documentation à ne jamais confondre : l'*authored* (l'intention, le pourquoi, écrite par des humains et des agents) et la *générée* (l'état réel du code à l'instant T, produite par un pipeline).",
          conventions: [
            '`docs/technical/`, `docs/design/`, `docs/product/` sont *authored*. `docs/_generated/` est produit automatiquement et n’est jamais édité à la main.',
            `Chaque document porte un frontmatter minimal : \`id: ${DOC_PREFIX}-xxx\`, \`related_tickets\`, \`related_mockups\`.`,
            `Les identifiants cités dans le corps du texte (\`${context.config.idPrefix}-xxx\`, \`${MOCKUP_PREFIX}-xxx\`) sont des liens du graphe : les écrire exactement.`,
            `Site de documentation servi par ${docsProvider.label}, intégré au cockpit local et non en silo séparé.`,
          ],
          allowed: ['Créer et mettre à jour une doc *authored*.', 'Corriger un lien croisé cassé.'],
          forbidden: [
            'Éditer quoi que ce soit dans `docs/_generated/`.',
            'Écrire un secret ou une donnée client dans une doc.',
            'Créer une doc sans `id` : elle serait invisible du graphe de traçabilité.',
          ],
          references: ['`AGENTS.md` (racine).', '`docs/decisions/` — ADR.'],
        }),
      },
      {
        path: 'docs/technical/.gitkeep',
        origin,
        contents: textContents(''),
      },
    ];
  },
};

export const docsDecisionsGenerator: ScaffoldGenerator = {
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'module:docs-decisions';

    return [
      {
        path: 'docs/decisions/0001-repo-topology.md',
        origin,
        contents: textContents(`${frontmatter({
          id: formatId(DOC_PREFIX, 1),
          related_tickets: '[]',
          related_mockups: '[]',
          status: 'accepted',
          date: isoDate(context.now),
        })}

# 0001 — Topologie du dépôt : monorepo unique

## Contexte

Le projet doit relier des artefacts de natures très différentes — code applicatif,
maquettes, documentation, tickets, contrats d'API. Ces artefacts se référencent
mutuellement par identifiant, et la valeur du dispositif tient entièrement à ce que ces
références restent résolvables.

Deux topologies étaient envisageables : un dépôt par domaine (code / design / docs), ou un
dépôt unique.

## Décision

**Un seul historique git pour tout le projet** : \`apps/\`, \`design-system/\`, \`mockups/\`,
\`docs/\`, \`tickets/\`, \`contracts/\`.

L'ownership par équipe se gère **par chemin** (fichier type \`CODEOWNERS\`), jamais par dépôt
séparé.

## Conséquences

- Un changement transverse (un token qui bouge, une maquette validée, le ticket qui la suit)
  tient dans un seul commit atomique et une seule revue.
- Un agent dispose du contexte complet sans avoir à cloner ni synchroniser plusieurs dépôts.
- Les liens croisés par identifiant sont vérifiables mécaniquement, puisque les deux
  extrémités du lien sont toujours présentes dans l'arbre de travail.
- En contrepartie, le dépôt grossit et les droits d'accès sont moins cloisonnés : c'est
  précisément pourquoi chaque dossier déclare son périmètre d'édition dans son \`AGENTS.md\`,
  et pourquoi aucun secret ne vit dans le dépôt.
`),
      },
    ];
  },
};

export const docsProductGenerator: ScaffoldGenerator = {
  files(): ScaffoldFile[] {
    const origin = 'module:docs-product';

    return [
      {
        path: 'docs/product/AGENTS.md',
        origin,
        contents: agentsDoc({
          title: 'docs/product/ — documentation produit',
          role: "Personas, flows utilisateurs et specs fonctionnelles. Décrit le parcours et l'intention, pas l'écran : l'écran est déjà couvert par la maquette.",
          conventions: [
            'Un flow décrit un parcours de bout en bout, pas une succession d’écrans.',
            'Une spec fonctionnelle est rattachée à un ticket et à la maquette concernée.',
            'Les exigences d’accessibilité sont documentées une fois et référencées partout, jamais réécrites à chaque doc.',
          ],
          allowed: ['Créer et mettre à jour personas, flows et specs.'],
          forbidden: [
            'Y décrire une décision d’implémentation : elle appartient à `docs/technical/` ou à un ADR.',
            'Y placer une donnée utilisateur réelle : les personas sont des archétypes, pas des personnes.',
          ],
          references: ['`docs/AGENTS.md`.'],
        }),
      },
    ];
  },
};

export const docsI18nCopyGenerator: ScaffoldGenerator = {
  files(): ScaffoldFile[] {
    const origin = 'module:docs-i18n-copy';

    return [
      {
        path: 'docs/i18n-copy/AGENTS.md',
        origin,
        contents: agentsDoc({
          title: 'docs/i18n-copy/ — UX writing et traductions',
          role: "Textes d'interface, ton, vocabulaire et règles de traduction. Traité à part du reste du design parce que le copy change indépendamment des tokens et du HTML.",
          conventions: [
            'Le texte source fait autorité ; une traduction ne corrige jamais silencieusement le sens de la source.',
            'Le vocabulaire métier vient du glossaire de domaine : ne pas introduire de synonyme concurrent.',
            'Une chaîne d’interface est identifiée par une clé stable, jamais par son contenu.',
          ],
          allowed: ['Ajouter et corriger des chaînes, du ton, des règles de traduction.'],
          forbidden: [
            'Coder en dur un texte dans une maquette ou un composant alors qu’il devrait vivre ici.',
          ],
          references: ['`docs/AGENTS.md`.', 'DESIGN.md §4 — UX writing.'],
        }),
      },
    ];
  },
};
