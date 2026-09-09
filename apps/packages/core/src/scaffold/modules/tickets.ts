import { DOC_PREFIX, MOCKUP_PREFIX } from '../../ids.js';
import { ACCEPTANCE_HEADING, TICKET_STATUSES } from '../../tickets/schema.js';
import { agentsDoc } from '../agents-doc.js';
import type { ScaffoldContext, ScaffoldFile, ScaffoldGenerator } from '../types.js';

/** `tickets/` — ticketing in-repo (TECHNICAL.md §6). */
export const ticketsGenerator: ScaffoldGenerator = {
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'module:tickets';
    const prefix = context.config.idPrefix;
    const index = context.registry.resolve(
      'tickets-index',
      context.config.providers['tickets-index'],
    );

    return [
      {
        path: 'tickets/AGENTS.md',
        origin,
        contents: agentsDoc({
          title: 'tickets/ — ticketing markdown-native',
          role: `Un ticket = un fichier markdown versionné. C'est le point d'ancrage du graphe de traçabilité : le ticket relie une intention à une maquette, une doc et du code.`,
          conventions: [
            `Un fichier par ticket, nommé d'après son identifiant : \`${prefix}-001-titre-court.md\`. Le dossier est plat : le statut vit dans le frontmatter, pas dans l'arborescence — déplacer un ticket ne doit pas produire un renommage git.`,
            'Frontmatter structuré : `id`, `title`, `status`, `assignee`, `created`, `updated`, `depends_on`, `related_mockups`, `related_docs`, `authored_by`.',
            `Statuts : ${TICKET_STATUSES.join(' → ')}. Le workflow n'est pas configurable : \`ready-for-dev\` est la cible du webhook « une maquette passe en validated » (§7).`,
            `Critères d'acceptation en Gherkin, dans un bloc \`\`\`gherkin sous le titre « ${ACCEPTANCE_HEADING} » — extractibles donc exécutables, sans contorsionner le YAML (cf \`docs/decisions/0008-format-des-tickets.md\`).`,
            `Les maquettes et docs concernées sont référencées explicitement (\`${MOCKUP_PREFIX}-xxx\`, \`${DOC_PREFIX}-xxx\`), jamais décrites de mémoire.`,
            '`depends_on` porte un vrai graphe, pas seulement un statut : c’est ce qui permet à un agent de savoir s’il risque une collision avec un autre agent.',
            '`authored_by: agent` marque un ticket produit par un agent — la CLI le pose avec `--agent`.',
            `Lecture accélérée par ${index.label} ; l'index n'est qu'un cache reconstructible, jamais une source de vérité.`,
          ],
          allowed: [
            'Créer un ticket (`klee ticket create`, ou le board), changer son statut, compléter ses critères d’acceptation.',
            'Éditer un fichier de ticket à la main : c’est un fichier markdown ordinaire, et il reste la référence.',
            'Ajouter un lien vers une maquette ou une doc existante.',
          ],
          forbidden: [
            'Écrire une donnée client, un identifiant personnel ou un secret dans un ticket.',
            'Supprimer un ticket : le passer en `done`, pour préserver l’historique de décision.',
            'Inventer un lien vers une maquette ou une doc qui n’existe pas.',
            'Modifier `id` après création : c’est l’arête sur laquelle tout le reste pointe.',
          ],
          references: [
            '`AGENTS.md` (racine) — schéma d’identifiants.',
            '`klee ticket create|list|move|show`, et `klee board` pour le kanban local.',
          ],
        }),
      },
    ];
  },
};
