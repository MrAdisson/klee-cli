import { DOC_PREFIX, MOCKUP_PREFIX, formatId } from '../../ids.js';
import { MODULES, MODULE_IDS } from '../../modules.js';
import { PROVIDER_POINT_DEFINITIONS } from '../../providers/points.js';
import { PROVIDER_POINTS } from '../../providers/types.js';
import { serializeTicket } from '../../tickets/format.js';
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
 * Premier ticket du projet : le **compte rendu de son initialisation**.
 *
 * Ce n'est pas une tâche. Un projet neuf dont le board affiche déjà du travail en attente
 * ment sur son état : personne n'a décidé ce travail, et le lecteur croit hériter d'un
 * engagement qui n'existe pas. Ce ticket est donc en `done` — un fait consigné, pas une
 * intention.
 *
 * Il consigne ce que l'init a réellement retenu (modules, providers, préfixe), ce qu'aucun
 * autre fichier ne dit sous cette forme : `project.config.json` porte des identifiants,
 * pas les raisons ni les libellés, et il changera au fil du projet sans garder trace de son
 * point de départ.
 *
 * Il rend enfin le graphe non vide dès la première commande : son arête vers l'ADR de
 * topologie donne un exemple résolvable que `klee links` affiche immédiatement.
 */
function seedTicket(context: ScaffoldContext, origin: string): ScaffoldFile {
  const { config } = context;
  const id = formatId(config.idPrefix, 1);
  const today = context.now.toISOString().slice(0, 10);
  const title = `${config.name} — initialisation du projet`;

  const modules = MODULE_IDS.filter((moduleId) => config.modules[moduleId]).map(
    (moduleId) => `- ${MODULES[moduleId].label}`,
  );

  const providers = PROVIDER_POINTS.filter((point) => {
    const requires = PROVIDER_POINT_DEFINITIONS[point].requiresModule;
    return requires === null || config.modules[requires];
  }).map((point) => {
    const provider = context.registry.resolve(point, config.providers[point]);
    return `| ${PROVIDER_POINT_DEFINITIONS[point].label} | ${provider.label} | \`${point}\` |`;
  });

  const frontmatter: TicketFrontmatter = {
    id,
    title,
    // Un compte rendu, pas une tâche : il appartient à l'historique dès sa création.
    status: 'done',
    assignee: null,
    created: today,
    updated: today,
    depends_on: [],
    related_mockups: [],
    // DOC-001 est l'ADR de topologie, généré par le module `docs-decisions` du socle.
    related_docs: [formatId(DOC_PREFIX, 1)],
    authored_by: 'human',
  };

  const description = `Compte rendu de \`klee init\` : ce que ce projet a retenu au départ.

Ce ticket est **terminé à sa création** — il consigne un fait, il ne demande rien. Le premier
travail réel du projet est un ticket que vous écrirez.

## Modules retenus

${modules.join('\n')}

Un module non retenu ne génère aucun fichier, aucune dépendance, aucune section du cockpit.
\`klee module add <module>\` en ajoute un après coup.

## Providers

| Point | Provider | Clé de config |
| --- | --- | --- |
${providers.join('\n')}

## Identifiants

| Préfixe | Entité |
| --- | --- |
| \`${config.idPrefix}-xxx\` | ticket |
| \`${MOCKUP_PREFIX}-xxx\` | maquette / composant |
| \`${DOC_PREFIX}-xxx\` | document |

La topologie du dépôt et ses raisons sont dans ${formatId(DOC_PREFIX, 1)}.
\`klee links show ${id}\` affiche ses liens ; \`klee links check\` vérifie qu'ils pointent
quelque part.`;

  return {
    path: `tickets/${ticketFileName(id, title)}`,
    origin,
    // Pas de bloc Gherkin : on ne pose pas de critères d'acceptation sur un fait déjà
    // acquis. Le gabarit à compléter appartient aux tickets que l'équipe écrira.
    contents: serializeTicket(frontmatter, `${description}\n`),
  };
}
