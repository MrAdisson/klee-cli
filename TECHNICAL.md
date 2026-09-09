# TECHNICAL.md — Architecture du projet

> Ce document est un **brief de scaffolding**. Il est écrit pour être lu par un agent IA (Claude Code ou équivalent) chargé de générer la structure initiale du repo. Il doit être lu conjointement avec `DESIGN.md`.
>
> Principe fondateur : **Everything lives in the codebase.** Aucun artefact structurant du projet (maquette, ticket, décision, doc produit) ne doit vivre uniquement dans un outil SaaS externe. Tout est versionné, lisible par un humain et exploitable directement par un agent sans étape d'export.
>
> **Topologie : monorepo unique.** Un seul historique git pour tout le projet (`apps/`, `design-system/`, `mockups/`, `docs/`, `tickets/`, `contracts/`). L'ownership par équipe se gère par chemin (type `CODEOWNERS`), jamais par repo séparé. Décision documentée dans `docs/decisions/0001-repo-topology.md`.

---

## 1. Vue d'ensemble de l'arborescence

```
my-project/
├── apps/                    # code applicatif (monorepo classique) — socle
│   ├── web/
│   ├── api/
│   └── packages/            # libs partagées entre apps
├── design-system/           # tokens DTCG + pipeline de build — socle, suit mockups/ (cf §3, §13)
├── mockups/                # UI figée en HTML/CSS — module optionnel (cf §13)
│   ├── components/
│   └── pages/
├── docs/                      # socle : technical/ + decisions/ — optionnel : product/, i18n-copy/ (cf §13)
│   ├── technical/
│   ├── design/
│   ├── product/               # optionnel
│   ├── decisions/            # ADR — socle
│   └── i18n-copy/             # optionnel
├── tickets/                   # ticketing markdown-native — socle
│   └── (généré/géré par la CLI, cf §6)
├── contracts/                 # schémas d'API — module optionnel (cf §13)
│   ├── openapi/
│   └── domain/                # glossaire métier, modèle de domaine
├── .agents/                    # contexte pour agents IA (cf §5)
│   └── AGENTS.md
├── AGENTS.md                   # racine : vue d'ensemble pour tout agent qui arrive
└── package.json / turbo.json / pnpm-workspace.yaml
```

> Un module non retenu à l'init ne génère aucun fichier, aucune dépendance, aucune section dans le cockpit — voir §13 pour la logique de sélection.

Chaque sous-dossier principal possède son propre `AGENTS.md` local qui explique son rôle, ses conventions et ce qu'un agent a le droit d'y modifier (cf §10 Sécurité).

---

## 2. `apps/` — code applicatif

- Monorepo classique. Orchestrateur de build **configurable via provider (§13)** — défaut **pnpm workspaces + Turborepo**, alternative Nx si besoin de graphes de tâches plus riches.
- Rien de spécifique à inventer ici : c'est la brique la plus standard du système.
- Convention obligatoire : chaque composant UI qui "transcrit" une maquette doit référencer le chemin de la maquette source dans un commentaire ou un fichier de métadonnées (cf §7, détection de dérive).

---

## 3. `design-system/` — source des tokens, partagée par `mockups/` et `apps/`

Les tokens ne sont pas une propriété des mockups : ce sont un socle consommé à l'identique par les mockups (prototypage) et par les apps (production). Les faire vivre dans `mockups/tokens/` créerait soit une dépendance de production vers un dossier de prototypage, soit une duplication silencieuse des valeurs — exactement le genre de drift que ce projet cherche à éliminer ailleurs.

```
design-system/
├── tokens.json              # source unique, format W3C DTCG (cf DESIGN.md §2)
├── style-dictionary.config.mjs   # ou terrazzo.config.js selon le provider (§13)
└── dist/                      # généré, jamais édité à la main
    ├── css/tokens.css          # socle universel, toujours généré
    ├── js/tokens.ts             # constantes JS/TS, si apps/ en a besoin
    └── tailwind/theme.js        # thème Tailwind v4, si le stack front l'utilise
```

- **Sens de la dépendance imposé** : `mockups/` et `apps/` importent tous les deux `design-system/dist/`, jamais l'inverse.
- **Packaging** : membre du workspace pnpm au même titre que les packages sous `apps/packages/`, mais physiquement à la racine — pour bien marquer qu'il n'appartient à aucun des deux consommateurs.
- **Optionnalité** : suit exactement la même condition que `mockups/` (§13, axe 1), pas de question CLI séparée — un projet sans interface n'a besoin ni de l'un ni de l'autre.
- **Cibles de build (multi-sélection, pas un choix exclusif comme les providers du §13)** : `css` est toujours généré (socle universel, fonctionne avec n'importe quel stack), `js`/`ts` et `tailwind` sont des cibles activables indépendamment selon ce que `apps/` utilise réellement. Rien n'empêche d'activer les trois en même temps — ce n'est pas "l'un ou l'autre" comme le choix du moteur de transformation.
- **Nuance sur le moteur (§13)** : Style Dictionary reste le défaut (le plus mature, tous formats de plateforme y compris natif iOS/Android si besoin un jour) ; mais Terrazzo a un plugin Tailwind v4 dédié (`@terrazzo/plugin-tailwind`) plus direct si Tailwind est la cible principale — un critère concret pour trancher au cas par cas plutôt qu'un défaut aveugle.
- Build déclenché via `<cli> tokens build` ou automatiquement par le hook décrit en §7 : toute modification de `tokens.json` régénère `dist/`, puis déclenche la régression visuelle sur les pages de `mockups/` concernées.

---

## 4. `mockups/` — UI en HTML/CSS, source de vérité visuelle (module optionnel — cf §13)

Objectif : que toute l'information UI soit figée ici *avant* l'implémentation réelle, pour que le passage vers React/Vue/Angular ne soit qu'une transcription, jamais une décision de design.

```
mockups/
├── components/
│   ├── button/
│   │   ├── button.html
│   │   └── button.meta.yml
│   └── card/
├── pages/
│   ├── login.html         # <link rel="stylesheet" href="../../design-system/dist/css/tokens.css">
│   └── dashboard.html
└── DESIGN.md → voir /DESIGN.md à la racine
```

Les tokens ne sont plus locaux à ce dossier : chaque page/composant importe `design-system/dist/css/tokens.css` (cf §3) plutôt que de définir ses propres valeurs.

**Règles :**
- HTML/CSS statique. JS uniquement si strictement nécessaire pour illustrer un comportement (accordéon, tab) — jamais de logique métier ou d'appel réseau.
- Les pages se lient entre elles par de simples `<a href="./autre-page.html">` pour simuler la navigation.
- Chaque composant/page a un fichier `.meta.yml` en frontmatter-like avec un schéma commun (cf §7) :
  ```yaml
  id: MOCK-042
  ticket: PROJ-123
  status: draft | validated | implemented
  implemented_in: apps/web/src/components/Button.tsx   # rempli une fois implémenté
  ```
- Un **local dev server** sert `mockups/` en navigation statique (cf §9, cockpit local), avec rechargement à chaud, composition des composants via includes (§13) et génération automatique d'un catalogue de composants/états.

---

## 5. `docs/` — technical, design, product, decisions

Deux natures de documentation à ne jamais confondre visuellement dans l'outil :

| Type | Où | Qui l'écrit | Ce qu'elle décrit |
|---|---|---|---|
| **Authored** | `docs/technical`, `docs/design`, `docs/product` | humains + agents | l'intention, le "pourquoi" |
| **Générée** | `docs/_generated/` (jamais édité à la main) | pipeline auto (analyse du code) | l'état réel du code, le "quoi" à l'instant T |

- `docs/decisions/` : ADR (Architecture Decision Records), un fichier par décision, numéroté (`0001-...md`) — socle.
- `docs/product/` (optionnel — cf §13) : personas, flows utilisateurs, specs fonctionnelles.
- `docs/i18n-copy/` (optionnel — cf §13) : textes d'interface et traductions — traité comme une troisième nature, ni code ni design pur.
- Servi via un générateur de site docs-as-code, **configurable via provider (§13)** — défaut **Docusaurus**, alternatives VitePress/Starlight — intégré dans le cockpit local, pas en silo séparé.
- Chaque doc a un frontmatter minimal :
  ```yaml
  id: DOC-018
  related_tickets: [PROJ-123]
  related_mockups: [MOCK-042]
  ```

---

## 6. `tickets/` — ticketing in-repo

Inspiration directe : outils markdown-natifs existants (type Backlog.md) — ne pas réinventer le format, s'en inspirer fortement.

- Un ticket = un fichier markdown avec frontmatter structuré (id, titre, statut, assigné, dépendances, critères d'acceptation en Gherkin si pertinent).
- CLI pour créer/lister/faire transiter un ticket (`<cli> ticket create`, `<cli> ticket list`, `<cli> ticket move`).
- Dashboard local (serveur type "Prisma Studio") pour visualiser en kanban, en plus de la CLI — indispensable pour que les profils non-techniques (PM, design) adoptent l'outil sans terminal.
- Chaque ticket référence explicitement les maquettes et docs concernées (cf schéma commun §7).
- Graphe de dépendances entre tickets (pas juste un statut) : utile pour qu'un agent sache s'il risque d'entrer en collision avec un autre agent travaillant en parallèle.
- Indexation du dashboard **configurable via provider (§13)** — défaut fichiers markdown + index SQLite local pour une recherche rapide, alternative markdown seul (parsing à la volée) pour rester zero-dépendance.

---

## 7. La couche transverse (le vrai différenciant du projet)

C'est la partie qui n'existe dans aucun outil pris isolément (ticketing, design tokens, docs-as-code existent déjà séparément — voir Annexe A). La valeur du projet est **le graphe de traçabilité** qui les relie.

**Schéma d'identifiants partagé :**
- `PROJ-xxx` : ticket
- `MOCK-xxx` : maquette / composant
- `DOC-xxx` : document

**Traçabilité bidirectionnelle attendue :**
```
commit/PR → ticket (PROJ-123)
ticket → maquette (MOCK-042)
maquette → composant réellement implémenté (apps/web/.../Button.tsx)
ticket → doc produit concernée (DOC-018)
```

**Détection de dérive :** un check (CLI ou CI) compare périodiquement une maquette `status: implemented` avec le composant qu'elle référence, pour détecter quand l'implémentation réelle a divergé silencieusement de la maquette source de vérité.

**Webhooks internes (événements locaux, pas de service externe requis) :**
- Une maquette passe en `validated` → le ticket lié passe en `ready-for-dev`.
- Un ticket dev est fermé sans qu'aucun fichier de `docs/` n'ait été touché → flag "doc potentiellement obsolète".
- Un token de `design-system/tokens.json` change → régénère `design-system/dist/` puis déclenche une régression visuelle sur les pages `mockups/` qui l'utilisent.

**Provenance :** chaque fichier généré ou modifié par un agent devrait pouvoir être distingué d'une modification humaine (métadonnée de commit ou frontmatter `authored_by: agent|human`), pour faciliter la revue.

---

## 8. `contracts/` et modèle de domaine (module optionnel — cf §13)

- `contracts/` : format **configurable via provider (§13)** — défaut **OpenAPI**, alternatives GraphQL/Protobuf selon la stack. Sert de contrat d'interface, source de vérité pour qu'un agent travaillant côté front n'ait pas besoin du contexte backend complet.
- `contracts/domain/` : glossaire métier partagé, pour que chaque agent parte de la même compréhension du domaine plutôt que de la réinventer à chaque ticket.

> **Piste à explorer plus tard, pas pour cette phase :** étendre le principe "une source, plusieurs cibles générées" (comme pour les tokens en §3) à `contracts/` — un seul schéma qui génère à la fois un schéma Prisma/Drizzle et un contrat GraphQL/OpenAPI. Contrairement aux tokens, ce n'est pas une simple sérialisation : le schéma DB et le contrat API répondent à des besoins différents (une API expose souvent un sous-ensemble retravaillé du modèle, avec champs calculés, pagination, scoping par droits). Des combinaisons existent déjà pour des cas plus restreints (Prisma + Pothos pour générer du GraphQL depuis un schéma Prisma, Drizzle + drizzle-zod + zod-to-openapi vers OpenAPI), mais chacune impose un stack précis. À réévaluer avec un usage réel sur plusieurs projets, pas à figer maintenant par pure symétrie avec les tokens.

---

## 9. Le cockpit local ("studio")

Point d'entrée unique, cohérent avec le précepte "everything lives in the codebase" : **une seule commande, une seule app locale**, plutôt que trois serveurs séparés.

```
<cli> studio
```

Ouvre une app locale avec :
- Onglet **Board** (tickets, kanban)
- Onglet **Docs** (site docs-as-code, authored + générée clairement distinguées)
- Onglet **Mockups** (navigation statique des pages HTML/CSS)
- **Recherche transverse** unique sur les trois (tickets + docs + maquettes)
- **Deep links** cliquables d'un onglet à l'autre via le schéma d'ID commun (§7)

---

## 10. Sécurité & permissions par agent

- Des agents avec accès à tout le repo posent un risque (secrets, docs sensibles, données clients dans des tickets).
- Chaque `AGENTS.md` local doit déclarer explicitement le périmètre d'édition autorisé pour ce dossier.
- Les secrets ne vivent jamais dans `docs/`, `tickets/` ou `mockups/` — uniquement dans des mécanismes de secrets dédiés, hors du champ de lecture par défaut d'un agent.

---

## 11. Environnements & qualité

- Infra as code documentée, feature flags liés explicitement à un ticket (un agent doit savoir si une feature est derrière un flag).
- Preview éphémère par ticket si possible (déploiement de branche à la volée).
- Critères d'acceptation en BDD/Gherkin directement dans le frontmatter du ticket plutôt qu'en prose libre, pour être exécutables.

---

## 12. Interopérabilité (adoption progressive)

Pour ne pas forcer un big-bang d'adoption : prévoir des ponts d'import/export vers les outils existants (Figma → tokens, GitHub Issues/Jira → tickets) afin que les équipes puissent migrer progressivement plutôt que tout arrêter du jour au lendemain.

---

## 13. Pattern de configuration : modules optionnels & providers

Deux axes de configuration distincts, à ne pas confondre dans la CLI :

**Axe 1 — Présence d'un module.** Un projet n'a pas forcément besoin de tous les modules. Un module non retenu ne génère aucun fichier, aucune dépendance, aucune section dans le cockpit.

| Module | Statut | Pertinent si... |
|---|---|---|
| `apps/`, `tickets/`, `docs/technical`, `docs/decisions`, schéma d'ID / graphe de traçabilité | **Socle — jamais optionnel** | toujours : c'est ce qui fait tenir le liant du projet |
| `mockups/` | Optionnel | le projet a une interface propre à designer (pas un service headless, une lib, un CLI) |
| `contracts/` | Optionnel | le projet expose une API consommée par d'autres services/clients |
| `docs/product/` | Optionnel | il y a un enjeu produit/utilisateur, pas juste une lib interne |
| `docs/i18n-copy/` | Optionnel | le projet est multi-langue ou a un enjeu de ton/copy dédié |

**Axe 2 — Provider d'un module retenu.** Une fois un module inclus, quelle implémentation utiliser (cf tableau ci-dessous). Certains choix techniques ont plusieurs solutions solides, où la "meilleure" option dépend de la préférence de l'équipe plutôt que d'un critère technique tranchant — la CLI ne doit pas figer un choix unique en dur, elle doit le proposer avec une valeur par défaut sensée, via une architecture **factory/provider**.

**Comportement CLI attendu :**
- `<cli> init` demande d'abord les **modules** (question à choix multiples : "Quels modules inclure ?"), puis, pour chaque module retenu, les questions de **provider** applicables.
- Des **presets** évitent de répondre à toutes les questions à chaque fois : `--preset=full-product` (tous les modules), `--preset=api-service` (pas de maquettes, contracts inclus), `--preset=internal-lib` (ni maquettes ni contracts ni docs/product).
- `<cli> init --yes` sans preset explicite applique `full-product` avec tous les défauts de providers ci-dessous — indispensable pour un usage scriptable/CI, ou pour un agent qui scaffold sans supervision humaine continue.
- Chaque choix (module comme provider) reste modifiable après coup : `<cli> module add contracts`, ou édition du fichier de config racine (ex. `project.config.json`), sans tout re-scaffolder.

**Architecture technique suggérée :** chaque point configurable est un `Provider` implémentant une interface commune (ex. `DocsProvider`, `WorkspaceProvider`), résolu par une factory à partir du fichier de config. Ajouter un nouveau provider ne doit jamais nécessiter de toucher au reste du code — juste implémenter l'interface et l'enregistrer dans la factory. La présence/absence d'un module est un simple flag booléen dans ce même fichier de config, vérifié avant toute génération de fichier liée à ce module.

**Points de configuration identifiés comme candidats au pattern provider (liste vivante, à étendre au fil du projet) :**

| Point configurable | Providers envisageables | Défaut (`--yes`) | Détail |
|---|---|---|---|
| Générateur de site de docs | Docusaurus, VitePress, Starlight | Docusaurus | §5 |
| Orchestrateur de monorepo | pnpm workspaces + Turborepo, Nx | pnpm + Turborepo | §2 |
| Format de contrat d'API | OpenAPI, GraphQL, Protobuf | OpenAPI | §8 |
| Indexation du dashboard tickets | markdown + index SQLite, markdown seul | markdown + SQLite | §6 |
| Composition des mockups (includes) | Eleventy (includes au build/serve, sortie HTML/CSS pur), Web Components (composants réutilisables au runtime) | Eleventy | §4 |
| Régression visuelle sur les mockups | Playwright (`toHaveScreenshot`, local, gratuit), BackstopJS, Percy/Chromatic (cloud, payant) | Playwright | §4 |
| Pipeline de transformation des tokens (DTCG → CSS/JS) | Style Dictionary (mature, tous formats de plateforme), Terrazzo (natif DTCG, plugin Tailwind v4) | Style Dictionary | §3 |

> Le format des design tokens n'est volontairement **pas** dans ce tableau : le standard W3C DTCG (cf `DESIGN.md` §2) est imposé sans alternative, car c'est un point d'interopérabilité externe (Figma, Style Dictionary, Tokens Studio) où dévier du standard coûterait plus cher que la flexibilité n'apporterait.

> Un point ne mérite le traitement "provider" que s'il existe au moins deux solutions réellement solides sans gagnant technique évident. Un module ne mérite le traitement "optionnel" que si des projets légitimes n'en ont simplement pas l'usage. Pour tout le reste (schéma d'ID, format de frontmatter §7, topologie du repo) une seule convention est imposée — la cohérence transverse prime sur la flexibilité, car ces points-là structurent le graphe de traçabilité et ne peuvent pas varier d'un projet à l'autre sans casser le liant.

---

## Annexe A — Positionnement vs l'existant (ne pas réinventer)

| Besoin | Inspiration existante | Notre valeur ajoutée |
|---|---|---|
| Ticketing markdown-natif | outils type Backlog.md | lien natif vers mockups/docs |
| Design tokens pour agents | convention type DESIGN.md | tokens versionnés + régression visuelle |
| Génération de tâches depuis un PRD | outils type Task Master | tâches liées au graphe de traçabilité |
| Docs-as-code | Docusaurus / VitePress / Starlight | intégré au cockpit unique, pas en silo |

Le projet est positionné comme une **couche de convention + glue tooling** unifiant ces briques, pas comme un remplacement de chacune d'entre elles.

---

## Roadmap d'implémentation (chronologique, à suivre dans l'ordre par l'agent)

- **Phase 0** — squelette monorepo (`apps/`, config workspace), `AGENTS.md` racine, `docs/decisions/0001-repo-topology.md`, CLI `init` avec mode interactif + `--yes` + presets, sélection des modules et premiers providers (workspace, docs) (§13).
- **Phase 1** — `design-system/` (tokens DTCG + pipeline de build) et `mockups/` (un composant + une page d'exemple consommant les tokens) et son serveur de navigation local.
- **Phase 2** — `tickets/` : format de fichier, CLI minimale (create/list/move), dashboard local basique, provider d'indexation (§13).
- **Phase 3** — schéma d'ID commun + premiers liens croisés + docs-as-code (`docs/`) via le provider choisi en Phase 0.
- **Phase 4** — cockpit unifié (`studio`), recherche transverse, détection de dérive, webhooks internes.
- **Phase 5** — interopérabilité : ponts d'import/export Figma → tokens, GitHub Issues/Jira → tickets, pour permettre une migration progressive des équipes déjà en place sur d'autres outils.
- **Phase 6** — observabilité avancée : journal d'activité des agents (qui a fait quoi, sur quel ticket), tracking de coût, visualisation du graphe de dépendances entre tickets.
- **Phase 7** — automatisation environnements : previews éphémères par ticket, feature flags synchronisés automatiquement avec le statut des tickets.

Chaque phase se lance une fois la précédente validée par un humain — ce n'est pas une liste de "nice to have" hors scope, c'est l'ordre d'implémentation réel du projet.
