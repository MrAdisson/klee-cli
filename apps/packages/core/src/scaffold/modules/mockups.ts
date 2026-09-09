import { MOCKUP_PREFIX } from '../../ids.js';
import { agentsDoc } from '../agents-doc.js';
import { jsonContents } from '../format.js';
import type {
  ScaffoldContext,
  ScaffoldDependency,
  ScaffoldFile,
  ScaffoldGenerator,
} from '../types.js';
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
            `Chaque page ou composant a un \`.meta.yml\` : \`id: ${MOCKUP_PREFIX}-xxx\`, \`status: draft | validated | implemented\`, \`related_tickets\`, \`related_docs\`, \`implemented_in\`.`,
            'Le vocabulaire des liens est le même partout — `related_tickets`, `related_mockups`, `related_docs` : un identifiant cité doit exister, `klee links check` le vérifie.',
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
            `Accessibilité WCAG 2.1 AA vérifiée par \`klee mockups check\` : une maquette \`validated\` ou \`implemented\` qui enfreint une règle fait échouer la commande (ADR 0018). Une dérogation se déclare dans le \`.meta.yml\`, avec sa raison. La régression visuelle, elle, reste à brancher — ${regression.label} est retenu mais pas encore outillé.`,
          ],
          allowed: [
            'Créer et modifier des pages et composants HTML/CSS.',
            'Mettre à jour un `.meta.yml` (statut, lien vers le ticket, composant implémenté).',
          ],
          forbidden: [
            'Écrire une valeur de couleur, d’espacement ou de typographie en dur.',
            'Dupliquer le markup d’un composant existant.',
            'Passer une maquette en `status: validated` sans que `klee mockups check` soit au vert — ou en écartant une règle sans écrire pourquoi.',
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
            'Un changement de token est un ticket, jamais une édition silencieuse : il touche toutes les pages qui l’utilisent, et rien ne le rattrape encore automatiquement.',
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
      {
        path: A11Y_RUNNER_PATH,
        origin,
        contents: A11Y_RUNNER,
      },
    ];
  },

  dependencies(): ScaffoldDependency[] {
    const origin = 'module:mockups';
    return [
      { name: 'playwright', version: PLAYWRIGHT_VERSION, dev: true, target: MANIFEST_PATH, origin },
      {
        name: '@axe-core/playwright',
        version: AXE_PLAYWRIGHT_VERSION,
        dev: true,
        target: MANIFEST_PATH,
        origin,
      },
    ];
  },

  // Le script d'installation de Playwright télécharge le navigateur. L'autoriser ici est ce
  // qui fait arriver le gate avec les dépendances — au `pnpm install`, ou à la fin de
  // `klee init` si l'on a accepté l'installation — plutôt que par une étape oubliable.
  installScripts: { playwright: true },
};

const MANIFEST_PATH = 'mockups/package.json';
const A11Y_RUNNER_PATH = 'mockups/a11y-runner.mjs';
const PLAYWRIGHT_VERSION = '1.63.0';
const AXE_PLAYWRIGHT_VERSION = '4.13.0';

/**
 * Auditeur d'accessibilité (ADR 0018), exécuté par `klee mockups check`.
 *
 * Il vit dans le projet et non dans klee : c'est lui qui porte le navigateur, que la CLI ne
 * doit pas imposer aux projets sans maquettes. Il ne juge rien — il constate et rend du JSON,
 * le verdict appartient au domaine.
 */
const A11Y_RUNNER = `// Généré par klee (ADR 0018) — audite les maquettes servies et rend ses constats en JSON.
// Entrée  (stdin)  : { "pages": [{ "id": "MOCK-001", "url": "http://…" }] }
// Sortie (stdout)  : { "violations": [{ "mockupId", "rule", "help", "impact", "target" }] }
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

// WCAG 2.1 AA, le niveau qu'exige DESIGN.md §6 — ni plus strict, ni plus laxiste.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function readInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return JSON.parse(raw);
}

const { pages } = await readInput();
const browser = await chromium.launch();
// Contexte explicite : axe-core injecte son script dans les frames de la page, ce que
// Playwright refuse sur le contexte implicite de \`browser.newPage()\`.
const context = await browser.newContext();
const violations = [];

try {
  for (const entry of pages) {
    const page = await context.newPage();
    try {
      // Le contraste se juge sur des styles calculés : la page doit être vraiment chargée.
      await page.goto(entry.url, { waitUntil: 'load' });
      const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      for (const violation of result.violations) {
        for (const node of violation.nodes) {
          violations.push({
            mockupId: entry.id,
            rule: violation.id,
            help: violation.help,
            impact: violation.impact ?? null,
            target: node.target.join(' '),
          });
        }
      }
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

process.stdout.write(JSON.stringify({ violations }));
`;
