import { MOCKUP_PREFIX } from '../../ids.js';
import { agentsDoc } from '../agents-doc.js';
import { jsonContents } from '../format.js';
import type { ScaffoldContext, ScaffoldFile, ScaffoldGenerator } from '../types.js';
import { DEFAULT_TOKENS } from './tokens.js';

/**
 * `mockups/` — UI figée en HTML/CSS (TECHNICAL.md §4) et `design-system/` — tokens DTCG
 * (§3). Les deux vont ensemble : un projet sans interface n'a besoin ni de l'un ni de l'autre.
 */
export const mockupsGenerator: ScaffoldGenerator = {
  files(context: ScaffoldContext): ScaffoldFile[] {
    const origin = 'module:mockups';
    const { providers } = context.config;
    const { registry } = context;
    const composition = registry.resolve('mockups-composition', providers['mockups-composition']);
    const regression = registry.resolve('visual-regression', providers['visual-regression']);
    const pipeline = registry.resolve('tokens-pipeline', providers['tokens-pipeline']);
    const targets = context.config.designSystem?.targets ?? ['css'];

    return [
      {
        path: 'mockups/AGENTS.md',
        origin,
        contents: agentsDoc({
          title: 'mockups/ — source de vérité visuelle',
          role: "Toute l'information UI est figée ici *avant* l'implémentation. Le passage vers React/Vue/Angular doit être une transcription, jamais une décision de design.",
          conventions: [
            'HTML sémantique — une maquette en `<div>` produit un composant inaccessible.',
            'Aucune valeur brute : les couleurs, espacements et rayons passent par `var(--…)` depuis `design-system/dist/css/tokens.css`.',
            `Chaque page ou composant a un \`.meta.yml\` : \`id: ${MOCKUP_PREFIX}-xxx\`, \`ticket\`, \`status: draft | validated | implemented\`, \`implemented_in\`.`,
            'Chaque composant documente ses états (default, hover, disabled, loading, erreur) : un état non maquetté est un état qui sera improvisé en implémentation.',
            `Aucun copier-coller de markup entre pages : une page inclut un composant via ${composition.label}, elle ne le réécrit jamais.`,
            ...(composition.id === 'eleventy'
              ? [
                  'Les `.html` sont rendus en **Nunjucks** (et non en Liquid, le défaut d’Eleventy) : cf `docs/decisions/0007-langage-de-template-des-maquettes.md`.',
                  'Un composant s’écrit comme une **macro** (`{% macro %}` / `{% from … import %}`), jamais comme un include qui lit des variables posées par la page : la portée reste isolée et les paramètres explicites.',
                ]
              : []),
            'JS uniquement pour illustrer un comportement UI local (menu, onglet) — jamais de logique métier, jamais d’appel réseau.',
            'Navigation entre pages par de simples liens `<a>`, pour simuler le parcours sans framework.',
            `Accessibilité WCAG 2.1 AA vérifiée au stade maquette ; la régression visuelle est assurée par ${regression.label}.`,
          ],
          allowed: [
            'Créer et modifier des pages et composants HTML/CSS.',
            'Mettre à jour un `.meta.yml` (statut, lien vers le ticket, composant implémenté).',
          ],
          forbidden: [
            'Écrire une valeur de couleur, d’espacement ou de typographie en dur.',
            'Dupliquer le markup d’un composant existant.',
            'Passer une maquette en `status: validated` sans que les vérifications d’accessibilité soient au vert.',
          ],
          references: [
            'DESIGN.md — conventions design, produit et UX.',
            '`design-system/AGENTS.md` — tokens consommés par ces maquettes.',
          ],
        }),
      },
      {
        // Source unique des tokens. Le *format* DTCG est imposé sans alternative
        // (DESIGN.md §2) : il ne dépend donc pas du provider de pipeline, contrairement
        // à la configuration de transformation qui, elle, en dépend.
        path: 'design-system/tokens.json',
        origin,
        contents: jsonContents(DEFAULT_TOKENS),
      },
      {
        path: 'design-system/AGENTS.md',
        origin,
        contents: agentsDoc({
          title: 'design-system/ — tokens, socle partagé',
          role: "Source unique des design tokens, consommée à l'identique par les maquettes (prototypage) et par les apps (production). N'appartient à aucun des deux : c'est pourquoi il vit à la racine.",
          conventions: [
            '`tokens.json` est la source unique, au format W3C DTCG (`$value` / `$type` / `$description`). Ce format est imposé sans alternative : c’est un point d’interopérabilité externe (Figma, Style Dictionary, Tokens Studio).',
            `\`dist/\` est **généré** par ${pipeline.label} et n'est jamais édité à la main. Cibles actives : ${targets.join(', ')}.`,
            'Sens de la dépendance imposé : `mockups/` et `apps/` importent `design-system/dist/`, jamais l’inverse.',
            'Nommage sémantique avant tout (`--color-text-primary`, pas `--color-gray-900`) : changer une valeur ne doit pas casser la signification.',
            'Un changement de token est un ticket, jamais une édition silencieuse — il déclenche une régression visuelle sur les pages qui l’utilisent.',
          ],
          allowed: [
            'Ajouter ou modifier un token dans `tokens.json`, avec sa `$description`.',
            'Ajuster la configuration du pipeline de transformation.',
          ],
          forbidden: [
            'Éditer quoi que ce soit dans `design-system/dist/`.',
            'Introduire une dépendance de `design-system/` vers `mockups/` ou `apps/`.',
            'Ajouter un token purement descriptif (`--blue-500`) sans token sémantique correspondant.',
          ],
          references: ['DESIGN.md §2 — design tokens.', '`mockups/AGENTS.md`.'],
        }),
      },
    ];
  },
};
