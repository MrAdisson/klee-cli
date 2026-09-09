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

/**
 * Premier document d'une section.
 *
 * Il n'est pas décoratif : une section de site docs-as-code sans aucun document ne se
 * construit pas, et un dossier vide ne dit rien de ce qu'on attend qu'on y écrive. Les
 * identifiants sont fixes par section — ils ne se décalent pas selon les modules retenus,
 * sinon `DOC-003` désignerait autre chose d'un projet à l'autre.
 */
function starterDoc(options: {
  readonly path: string;
  readonly origin: string;
  readonly id: string;
  readonly title: string;
  readonly body: string;
}): ScaffoldFile {
  return {
    path: options.path,
    origin: options.origin,
    contents: textContents(`${frontmatter({
      id: options.id,
      title: options.title,
      related_tickets: '[]',
      related_mockups: '[]',
    })}

# ${options.title}

${options.body}`),
  };
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
      starterDoc({
        path: 'docs/technical/index.md',
        origin,
        id: formatId(DOC_PREFIX, 2),
        title: 'Documentation technique',
        body: `Cette section explique comment **${context.config.name}** est construit : architecture,
conventions de développement, dépendances importantes et procédures utiles pour contribuer.

## À documenter en premier

- **Architecture** : principaux modules, services et flux de données.
- **Développement local** : prérequis, installation et commandes courantes.
- **Tests et livraison** : vérifications à lancer avant une revue et processus de déploiement.
- **Intégrations** : services externes, contrats et limites à connaître.

Commencez par remplacer cette liste par les décisions et conventions propres au projet. Cette
documentation est écrite par l'équipe et reste la référence quand le code ne suffit pas à
expliquer un choix.

Les identifiants cités dans le texte (\`${context.config.idPrefix}-xxx\`, \`${MOCKUP_PREFIX}-xxx\`,
\`${DOC_PREFIX}-xxx\`) peuvent relier cette documentation aux tickets, maquettes et autres
documents. \`klee links check\` vérifie qu'une arête déclarée pointe vers un artefact existant.`,
      }),
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

# 0001 — Structure du dépôt

## Contexte

${context.config.name} rassemble son code, sa documentation et ses artefacts de suivi dans
un même dépôt. Cette décision donne à l'équipe un endroit unique pour comprendre un changement
et conserver le contexte qui l'accompagne.

## Décision

Les éléments suivants vivent dans le dépôt et sont versionnés ensemble :

- le code applicatif et les bibliothèques dans les dossiers du projet ;
- la documentation authored dans \`docs/\` ;
- les tickets dans \`tickets/\` ;
- ${context.config.modules.mockups ? 'les maquettes dans `mockups/` ;' : 'les artefacts de design lorsqu’ils sont retenus ;'}
- les fichiers de configuration et les scripts nécessaires pour reproduire les vérifications.

Les conventions d'organisation propres au projet seront ajoutées ici au fil des décisions.

## Conséquences

- Un changement transverse peut être relu avec son code, sa documentation et son ticket.
- L'historique git conserve les décisions et permet de revenir à l'état exact utilisé pour une
  livraison.
- Les fichiers du dépôt ne remplacent pas les systèmes d'exécution ou de déploiement : ils en
  décrivent la configuration reproductible.
- Les secrets et les données personnelles restent hors du dépôt.
`),
      },
    ];
  },
};

export const docsProductGenerator: ScaffoldGenerator = {
  files(): ScaffoldFile[] {
    const origin = 'module:docs-product';

    return [
      starterDoc({
        path: 'docs/product/index.md',
        origin,
        id: formatId(DOC_PREFIX, 3),
        title: 'Documentation produit',
        body: `Personas, flows utilisateurs et specs fonctionnelles du projet.

Un flow décrit un parcours de bout en bout ; l'écran, lui, est déjà couvert par la maquette.
Une spec fonctionnelle se rattache au ticket qui la porte et à la maquette qui la montre.`,
      }),
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
      starterDoc({
        path: 'docs/i18n-copy/index.md',
        origin,
        id: formatId(DOC_PREFIX, 4),
        title: 'UX writing et traductions',
        body: `Textes d'interface, ton, vocabulaire et règles de traduction du projet.

Traité à part du reste du design parce que le copy change indépendamment des tokens et du
HTML. Une chaîne d'interface est identifiée par une clé stable, jamais par son contenu.`,
      }),
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
          references: ['`docs/AGENTS.md`.', '`docs/technical/index.md` — conventions du projet.'],
        }),
      },
    ];
  },
};
