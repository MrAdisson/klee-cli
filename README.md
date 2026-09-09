# Klee

> Everything lives in the codebase.

Klee est une **couche de convention et de glue tooling** qui relie tickets, maquettes,
documentation et code dans un seul monorepo — versionnés, lisibles par un humain, exploitables
directement par un agent, sans étape d'export.

Sa CLI s'appelle **`klee`**.

Klee ne remplace ni Jira, ni Figma, ni Docusaurus. Ces briques existent déjà et fonctionnent.
Ce qui manque, c'est le **graphe de traçabilité** entre elles :

```
commit / PR  →  ticket (PROJ-123)
ticket       →  maquette (MOCK-042)
maquette     →  composant réellement implémenté (apps/web/.../Button.tsx)
ticket       →  document produit (DOC-018)
```

---

## État du projet

**Phases 0 à 3 livrées.**

- **Phase 0** — squelette du monorepo, schéma d'identifiants, architecture modules/providers,
  `klee init` avec mode interactif, `--yes` et presets.
- **Phase 1** — `design-system/` (tokens W3C DTCG et pipeline de transformation) et
  `mockups/` (un composant, une page, un catalogue auto-généré) avec leur serveur de
  navigation local. Les modules déclarent désormais leurs dépendances.

- **Phase 2** — `tickets/` : format markdown à frontmatter, CLI `create/list/move/show`,
  kanban local (`klee board`) utilisable sans terminal, et deux providers d'indexation.

- **Phase 3** — le **graphe de traçabilité** : un vocabulaire de lien unique pour les trois
  natures d'artefact, des arêtes résolues dans les deux sens, `klee links check` qui refuse
  tout lien cassé, et le site **docs-as-code** que ce dépôt sert désormais lui-même.

Les phases suivantes (cockpit unifié, interopérabilité, observabilité) sont décrites
dans [`TECHNICAL.md`](TECHNICAL.md) et se lancent dans l'ordre, chacune après validation
humaine de la précédente.

---

## Démarrage

```bash
pnpm install
pnpm run build

node apps/cli/dist/bin/klee.js --help
```

Scaffolder un projet :

```bash
# interactif : modules, puis providers des modules retenus
node apps/cli/dist/bin/klee.js init ./mon-projet

# non interactif, pour la CI ou un agent
node apps/cli/dist/bin/klee.js init ./mon-api --yes --preset api-service
```

Puis, dans un projet qui a retenu les maquettes :

```bash
pnpm install          # ou `klee init --install` dès le départ
klee tokens build     # design-system/tokens.json → dist/css/tokens.css
klee mockups serve    # navigation locale des maquettes
```

Et pour les tickets, dans n'importe quel projet :

```bash
klee ticket create "Mettre en place le pipeline de tokens"
klee ticket list
klee board            # kanban local, sans terminal pour créer et déplacer
```

Le graphe qui relie tout ça, et la documentation qui le publie :

```bash
klee links            # tickets ↔ maquettes ↔ docs, par nature d'artefact
klee links show DOC-014
klee links check      # sort en 1 sur un lien déclaré vers un artefact inexistant
klee docs serve       # le site de documentation, sur http://localhost:3000
```

Presets disponibles :

| Preset                               | Modules optionnels retenus               | Site de docs proposé  |
| ------------------------------------ | ---------------------------------------- | --------------------- |
| `full-product` _(défaut de `--yes`)_ | maquettes, contracts, docs produit, i18n | Docusaurus            |
| `api-service`                        | contracts                                | Docusaurus            |
| `internal-lib`                       | aucun                                    | aucun — markdown seul |

Un preset _propose_ ce défaut, il ne l'impose pas : `--provider docs=docusaurus` passe avant,
et le mode interactif se contente de présélectionner (ADR 0012).

Le socle — `apps/`, `tickets/`, `docs/technical/`, `docs/decisions/` — est toujours présent :
c'est lui qui porte le graphe.

---

## Structure du dépôt

```
apps/cli/              # @klee/cli — la CLI klee : arguments, questions, rendu terminal
apps/packages/core/    # @klee/core — le domaine : modules, providers, config, scaffolding
docs/technical/        # référence technique
docs/decisions/        # ADR
docs/_generated/       # vue du graphe, écrite par `klee links report`
tickets/               # tickets markdown (format posé en phase 2)
TECHNICAL.md           # brief d'architecture — source de vérité
DESIGN.md              # conventions design, produit et UX — source de vérité
project.config.json    # klee se décrit lui-même comme un projet Klee
```

La frontière entre `core` et `cli` est structurante : `core` ne parle ni de terminal ni de
prompts, pour que le cockpit local de la phase 4 puisse le réutiliser sans le réécrire.

---

## Développement

```bash
pnpm run verify   # format + lint + typecheck + test — à passer avant toute PR
pnpm run test
pnpm run build
```

Avant de contribuer : [`AGENTS.md`](AGENTS.md) pour les conventions et le périmètre d'édition,
[`CONTRIBUTING.md`](CONTRIBUTING.md) pour le flux de travail.

## Documentation

`klee docs serve` sert tout ce qui suit sur `http://localhost:3000`.

- [Référence de la CLI `klee`](docs/technical/cli-klee.md)
- [Graphe de traçabilité](docs/technical/graphe-de-tracabilite.md)
- [Schéma de `project.config.json`](docs/technical/project-config.md)
- [Décisions d'architecture](docs/decisions/)
