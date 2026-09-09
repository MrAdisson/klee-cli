import { DOC_PREFIX, MOCKUP_PREFIX, formatId } from '../../ids.js';
import { serializeTicket, newTicketBody } from '../../tickets/format.js';
import {
  ACCEPTANCE_HEADING,
  TICKET_STATUSES,
  ticketFileName,
  type TicketFrontmatter,
} from '../../tickets/schema.js';
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
      seedTicket(context, origin),
    ];
  },
};

/**
 * Premier ticket du projet.
 *
 * Il n'est pas là pour faire joli : sans lui, le `.meta.yml` que génère le module `mockups`
 * référencerait un ticket inexistant, et le premier `klee links check` d'un projet neuf
 * échouerait sur la sortie de `klee init` — alors que `tickets/AGENTS.md` interdit
 * précisément d'inventer un lien vers ce qui n'existe pas.
 *
 * Il donne aussi la seule chose qu'une convention écrite ne donne jamais : un exemple
 * complet et résolvable, que `klee links` affiche dès la première commande.
 */
function seedTicket(context: ScaffoldContext, origin: string): ScaffoldFile {
  const prefix = context.config.idPrefix;
  const id = formatId(prefix, 1);
  const today = context.now.toISOString().slice(0, 10);
  const withMockups = context.config.modules.mockups;

  const title = withMockups
    ? 'Transcrire la maquette de connexion en composant'
    : 'Décrire le premier lot de travail';

  const frontmatter: TicketFrontmatter = {
    id,
    title,
    status: 'backlog',
    assignee: null,
    created: today,
    updated: today,
    depends_on: [],
    // MOCK-002 est la page de connexion générée par le provider de composition.
    related_mockups: withMockups ? [formatId(MOCKUP_PREFIX, 2)] : [],
    // DOC-001 est l'ADR de topologie, généré par le module `docs-decisions` du socle.
    related_docs: [formatId(DOC_PREFIX, 1)],
    authored_by: 'human',
  };

  const description = withMockups
    ? `Ce ticket est l'exemple qu'écrit \`klee init\` : il montre à quoi ressemble une arête du graphe.

La maquette ${formatId(MOCKUP_PREFIX, 2)} fait foi pour l'UI (DESIGN.md §1) : la transcrire ne doit demander
aucune décision de design. Une fois le composant écrit, renseignez \`implemented_in\` dans
\`mockups/pages/login.meta.yml\` et passez la maquette en \`status: implemented\`.

\`klee links show ${id}\` affiche ses liens ; \`klee links check\` vérifie qu'ils pointent quelque part.`
    : `Ce ticket est l'exemple qu'écrit \`klee init\` : il montre à quoi ressemble une arête du graphe.

Remplacez-le par le premier lot réel du projet. \`klee links show ${id}\` affiche ses liens ;
\`klee links check\` vérifie qu'ils pointent quelque part.`;

  return {
    path: `tickets/${ticketFileName(id, title)}`,
    origin,
    contents: serializeTicket(frontmatter, newTicketBody(description)),
  };
}
