import { DOC_PREFIX, MOCKUP_PREFIX } from '../../ids.js';
import { agentsDoc } from '../agents-doc.js';
import type { ScaffoldContext, ScaffoldFile, ScaffoldGenerator } from '../types.js';

/** `tickets/` — ticketing in-repo (TECHNICAL.md §6). */
export const ticketsGenerator: ScaffoldGenerator = {
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'module:tickets';
    const prefix = context.config.idPrefix;

    return [
      {
        path: 'tickets/AGENTS.md',
        origin,
        contents: agentsDoc({
          title: 'tickets/ — ticketing markdown-native',
          role: `Un ticket = un fichier markdown versionné. C'est le point d'ancrage du graphe de traçabilité : le ticket est ce qui relie une intention à une maquette, une doc et du code.`,
          conventions: [
            `Un fichier par ticket, nommé d'après son identifiant : \`${prefix}-001-titre-court.md\`.`,
            'Frontmatter structuré : `id`, `title`, `status`, `assignee`, `depends_on`, `related_mockups`, `related_docs`.',
            'Critères d’acceptation en Gherkin dans le frontmatter plutôt qu’en prose libre, pour rester exécutables.',
            `Les maquettes et docs concernées sont référencées explicitement (\`${MOCKUP_PREFIX}-xxx\`, \`${DOC_PREFIX}-xxx\`), jamais décrites de mémoire.`,
            '`depends_on` porte un vrai graphe de dépendances, pas seulement un statut : c’est ce qui permet à un agent de savoir s’il risque une collision avec un autre agent.',
          ],
          allowed: [
            'Créer un ticket, mettre à jour son statut, compléter ses critères d’acceptation.',
            'Ajouter un lien vers une maquette ou une doc existante.',
          ],
          forbidden: [
            'Écrire une donnée client, un identifiant personnel ou un secret dans un ticket.',
            'Supprimer un ticket : le clore, pour préserver l’historique de décision.',
            'Inventer un lien vers une maquette ou une doc qui n’existe pas.',
          ],
          references: [
            '`AGENTS.md` (racine) — schéma d’identifiants.',
            'La CLI de gestion (`klee ticket create|list|move`) et le dashboard kanban arrivent en phase 2.',
          ],
        }),
      },
    ];
  },
};
