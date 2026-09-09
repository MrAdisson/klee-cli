# AGENTS.md — keel (racine)

> Point d'entrée pour tout agent ou contributeur qui arrive sur ce dépôt.

## Ce qu'est ce projet

**Keel** est une couche de convention et de glue tooling qui relie tickets, maquettes, docs et
code dans un seul monorepo. Sa CLI s'appelle **`klee`**.

Keel n'est pas un remplaçant de Jira, Figma ou Docusaurus : c'est le **graphe de traçabilité**
qui manque entre eux, plus le scaffolding qui rend ce graphe possible dès le premier commit.

Principe fondateur : **everything lives in the codebase.** Aucun artefact structurant
(maquette, ticket, décision, doc produit) ne vit uniquement dans un outil SaaS externe.

## Documents de cadrage

| Document          | Contenu                                                    | Statut                                                         |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| `TECHNICAL.md`    | Architecture cible, modules, providers, roadmap par phases | **Source de vérité — ne pas modifier sans décision explicite** |
| `DESIGN.md`       | Conventions design, produit et UX                          | **Source de vérité — idem**                                    |
| `docs/decisions/` | ADR : ce qui a été tranché, et pourquoi                    | Ajouter, jamais réécrire                                       |

Ces deux fichiers de racine sont le brief du projet. Ils sont exclus de Prettier
(`.prettierignore`) : leur mise en forme appartient à leur auteur.

## Arborescence

```
apps/cli/              # @keel/cli — la CLI `klee` (interaction terminal uniquement)
apps/packages/core/    # @keel/core — le domaine : modules, providers, config, scaffolding
docs/technical/        # documentation technique authored
docs/decisions/        # ADR numérotés
tickets/               # tickets markdown (format posé en phase 2)
project.config.json    # keel se décrit lui-même comme un projet Keel (dogfooding)
```

## Conventions

- **Identifiants partagés** : `KEEL-xxx` (ticket), `MOCK-xxx` (maquette), `DOC-xxx` (document).
  Les référencer exactement : ce sont des arêtes du graphe, pas de la prose.
- **Séparation domaine / interface** : `@keel/core` ne parle ni de terminal, ni de prompts, ni
  de couleurs. Toute écriture sur stdout passe par `apps/cli/src/ui/`. C'est ce qui permettra
  au cockpit de la phase 4 de réutiliser le domaine sans le réécrire.
- **Un provider s'ajoute sans toucher au reste** : implémenter l'interface `Provider`, puis
  l'enregistrer dans `apps/packages/core/src/providers/index.ts`. Si un ajout de provider
  oblige à modifier autre chose, c'est le design qui est en cause, pas le provider.
- **Le scaffolding est décrit, pas exécuté** : un générateur retourne des `ScaffoldFile`, il
  n'écrit jamais sur le disque. C'est ce qui rend `--dry-run` fidèle et les tests possibles
  sans effets de bord.
- **Phases** : la roadmap de `TECHNICAL.md` s'applique dans l'ordre. Chaque phase se lance une
  fois la précédente validée par un humain. N'anticipez pas une phase ultérieure.
- Chaque dossier principal porte son propre `AGENTS.md` : le lire avant d'y écrire.

## Périmètre d'édition pour un agent

**Autorisé**

- Lire l'ensemble du dépôt.
- Créer et modifier le code sous `apps/`, ses tests, sa configuration de build.
- Ajouter un ADR dans `docs/decisions/` et de la documentation dans `docs/technical/`.

**Interdit**

- Modifier `TECHNICAL.md` ou `DESIGN.md` sans demande explicite : ce sont les entrées du
  projet, pas ses sorties.
- Réécrire un ADR existant : un ADR se remplace par un nouveau qui le supersède.
- Implémenter une phase de la roadmap avant que la précédente ait été validée.
- Écrire un secret, une clé ou une donnée personnelle où que ce soit dans le dépôt.

## Commandes

```bash
pnpm install
pnpm run build        # tsc --build sur les deux packages
pnpm run verify       # format + lint + typecheck + test — à passer avant toute PR
node apps/cli/dist/bin/klee.js --help
```

## Références

- `.agents/AGENTS.md` — contexte de travail partagé des agents.
- `docs/technical/cli-klee.md` — référence de la CLI.
- `docs/technical/project-config.md` — schéma de `project.config.json`.
