import { DOC_PREFIX, MOCKUP_PREFIX } from '../../ids.js';
import { MODULE_IDS, MODULES, hasDesignSystem } from '../../modules.js';
import { PROVIDER_POINT_DEFINITIONS } from '../../providers/points.js';
import { PROVIDER_POINTS } from '../../providers/types.js';
import { agentsDoc } from '../agents-doc.js';
import { jsonContents, textContents } from '../format.js';
import type { ScaffoldContext, ScaffoldFile, ScaffoldGenerator } from '../types.js';

/** Fichiers de racine, générés quels que soient les modules retenus. */

function retainedModuleLines(context: ScaffoldContext): string[] {
  return MODULE_IDS.filter((id) => context.config.modules[id]).map(
    (id) => `- \`${MODULES[id].paths.join('`, `')}\` — ${MODULES[id].label}`,
  );
}

function providerLines(context: ScaffoldContext): string[] {
  return PROVIDER_POINTS.filter((point) => {
    const requires = PROVIDER_POINT_DEFINITIONS[point].requiresModule;
    return requires === null || context.config.modules[requires];
  }).map((point) => {
    const definition = PROVIDER_POINT_DEFINITIONS[point];
    const provider = context.registry.resolve(point, context.config.providers[point]);
    return `| ${definition.label} | ${provider.label} | \`${point}\` |`;
  });
}

export const rootGenerator: ScaffoldGenerator = {
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'module:root';
    const { config } = context;
    const ticketPrefix = config.idPrefix;

    return [
      {
        path: 'project.config.json',
        origin,
        contents: jsonContents(config),
      },
      {
        path: 'README.md',
        origin,
        contents: textContents(`# ${config.name}

Projet géré avec **Klee** : tickets, maquettes, docs et code vivent dans le même dépôt,
versionnés et exploitables directement par un humain comme par un agent.

## Modules retenus

${retainedModuleLines(context).join('\n')}

## Providers

| Point | Provider | Clé de config |
| --- | --- | --- |
${providerLines(context).join('\n')}

Tout est modifiable après coup : \`klee module add <module>\`, ou édition de
\`project.config.json\`. Rien n'impose de re-scaffolder.

## Identifiants

| Préfixe | Entité |
| --- | --- |
| \`${ticketPrefix}-xxx\` | ticket |
| \`${MOCKUP_PREFIX}-xxx\` | maquette / composant |
| \`${DOC_PREFIX}-xxx\` | document |

Ces identifiants sont le liant du projet : un commit référence un ticket, un ticket
référence une maquette et une doc, une maquette référence le composant qui l'implémente.

## Conventions

Chaque dossier principal porte un \`AGENTS.md\` qui décrit son rôle et ce qu'un agent a le
droit d'y modifier. Lisez celui du dossier avant d'y écrire.
`),
      },
      {
        path: 'AGENTS.md',
        origin,
        contents: agentsDoc({
          title: `${config.name} (racine)`,
          role: `Point d'entrée pour tout agent qui arrive sur ce dépôt. Everything lives in the codebase : aucun artefact structurant ne vit uniquement dans un outil externe.`,
          conventions: [
            `Identifiants partagés : \`${ticketPrefix}-xxx\` (ticket), \`${MOCKUP_PREFIX}-xxx\` (maquette), \`${DOC_PREFIX}-xxx\` (document). Référencez-les explicitement, jamais en prose approximative.`,
            'Chaque dossier principal a son propre `AGENTS.md` : lisez-le avant d’écrire dans ce dossier.',
            'Un fichier généré n’est jamais édité à la main — modifiez sa source et régénérez.',
            'Provenance : une modification produite par un agent doit rester distinguable d’une modification humaine (frontmatter `authored_by: agent|human` ou métadonnée de commit).',
            'La configuration du projet vit dans `project.config.json` (modules retenus et providers).',
          ],
          allowed: [
            'Lire l’ensemble du dépôt pour se constituer un contexte.',
            'Créer et modifier les fichiers des dossiers dont l’`AGENTS.md` local l’autorise.',
          ],
          forbidden: [
            'Modifier `project.config.json` sans passer par la CLI (`klee module add`) ou sans décision explicite.',
            'Introduire un artefact structurant (ticket, maquette, décision) hors du dépôt.',
            'Écrire un secret, une clé ou une donnée client dans `docs/`, `tickets/` ou `mockups/`.',
          ],
          references: [
            '`.agents/AGENTS.md` — contexte partagé et règles de travail des agents.',
            '`docs/decisions/` — décisions d’architecture (ADR).',
          ],
        }),
      },
      {
        path: '.agents/AGENTS.md',
        origin,
        contents: agentsDoc({
          title: 'Contexte partagé des agents',
          role: `Contexte commun à tous les agents intervenant sur ${config.name} : ce qu'il faut savoir avant d'ouvrir un ticket ou de toucher au code.`,
          conventions: [
            'Avant toute tâche : lire le ticket concerné, puis la maquette et les docs qu’il référence. Ne pas re-décider en aval ce qui a déjà été tranché en amont.',
            'Une information UI absente de la maquette est une maquette incomplète, pas une invitation à improviser.',
            'Signaler une collision potentielle : un ticket peut dépendre d’un autre ticket en cours de traitement par un autre agent.',
            'Chaque fichier produit doit pouvoir être rattaché à un identifiant du projet.',
          ],
          allowed: [
            'Ajouter ici des notes de contexte durables et partagées (glossaire, pièges connus, conventions implicites rendues explicites).',
          ],
          forbidden: [
            'Y stocker un état volatile (todo de session, brouillon) : ce dossier est du contexte, pas un cahier de brouillon.',
            'Y dupliquer ce qui est déjà écrit dans un `AGENTS.md` local — préférer un renvoi.',
          ],
          references: ['`AGENTS.md` (racine) — vue d’ensemble.'],
        }),
      },
      {
        path: '.gitignore',
        origin,
        contents: textContents(`node_modules/
dist/
build/
coverage/
.turbo/
*.tsbuildinfo

# Caches locaux de Klee (index de tickets…) — reconstructibles, jamais versionnés
.klee/

# Cache de construction du site de documentation
docs/.docusaurus/

# Les secrets ne vivent jamais dans le dépôt
.env
.env.*
!.env.example

.DS_Store
*.log
${hasDesignSystem(config.modules) ? '\n# Sorties générées du design system — régénérées par `klee tokens build`\ndesign-system/dist/\n' : ''}`),
      },
      {
        path: '.editorconfig',
        origin,
        contents: textContents(`root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
`),
      },
    ];
  },
};
