# AGENTS.md — klee (racine)

> Point d'entrée pour tout agent ou contributeur qui arrive sur ce dépôt.

## Ce qu'est ce projet

**Klee** est une couche de convention et de glue tooling qui relie tickets, maquettes, docs et
code dans un seul monorepo. Sa CLI s'appelle **`klee`**.

Klee n'est pas un remplaçant de Jira, Figma ou Docusaurus : c'est le **graphe de traçabilité**
qui manque entre eux, plus le scaffolding qui rend ce graphe possible dès le premier commit.

Principe fondateur : **everything lives in the codebase.** Aucun artefact structurant
(maquette, ticket, décision, doc produit) ne vit uniquement dans un outil SaaS externe.

## État d'avancement

| Phase | Contenu                                                                    | État          |
| ----- | -------------------------------------------------------------------------- | ------------- |
| 0     | Squelette monorepo, schéma d'ID, modules/providers, `klee init`            | ✅            |
| 1     | `design-system/` (tokens DTCG + pipeline), `mockups/` + serveur local      | ✅            |
| 2     | `tickets/` : format, CLI, `klee board`, deux index                         | ✅            |
| 3     | Liens croisés entre identifiants + docs-as-code (Docusaurus)               | ✅            |
| 4     | Cockpit `klee studio`, recherche transverse, détection de dérive, webhooks | ⬅ **suivant** |
| 5–7   | Interopérabilité, observabilité, environnements                            |               |

La roadmap complète est en fin de `TECHNICAL.md`. **Chaque phase se lance après validation
humaine de la précédente** — n'anticipez pas.

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
apps/cli/              # @klee/cli — la CLI `klee` (interaction terminal uniquement)
apps/packages/core/    # @klee/core — le domaine : modules, providers, config, scaffolding
docs/technical/        # documentation technique authored
docs/decisions/        # ADR numérotés
docs/_generated/       # vue du graphe, produite par `klee links report` — jamais éditée
docs/                  # aussi le site Docusaurus du dépôt (`klee docs serve`)
tickets/               # tickets markdown (format posé en phase 2)
project.config.json    # klee se décrit lui-même comme un projet Klee (dogfooding)
```

## Conventions

- **Identifiants partagés** : `KLEE-xxx` (ticket), `MOCK-xxx` (maquette), `DOC-xxx` (document).
  Les référencer exactement : ce sont des arêtes du graphe, pas de la prose. `klee links check`
  refuse tout lien déclaré vers un artefact inexistant — le passer avant de rendre la main.
- **Un seul vocabulaire de lien** : `related_tickets`, `related_mockups`, `related_docs`, dans
  les trois natures de fichier. Déclarer une arête d'un seul côté suffit : elle se voit des
  deux (ADR 0010). Rien à synchroniser.
- **Séparation domaine / interface** : `@klee/core` ne parle ni de terminal, ni de prompts, ni
  de couleurs. Toute écriture sur stdout passe par `apps/cli/src/ui/`. C'est ce qui permettra
  au cockpit de la phase 4 de réutiliser le domaine sans le réécrire.
- **Un provider s'ajoute sans toucher au reste** : implémenter l'interface `Provider`, puis
  l'enregistrer dans `apps/packages/core/src/providers/index.ts`. Si un ajout de provider
  oblige à modifier autre chose, c'est le design qui est en cause, pas le provider. Ce qu'il
  apporte, il le déclare : ses dépendances, et ses scripts de post-installation
  (`installScripts`) — jamais en allant écrire dans le fichier d'un autre (ADR 0012).
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
pnpm run build        # tsc --build sur les deux packages, puis le site de documentation
pnpm run verify       # format + lint + typecheck + test — à passer avant toute PR
node apps/cli/dist/bin/klee.js --help

klee links check      # aucun lien croisé cassé — à passer aussi
klee docs serve       # la documentation du dépôt, sur http://localhost:3000
```

## Décisions déjà prises

Douze ADR dans `docs/decisions/`. Les lire avant de rouvrir un sujet qu'ils couvrent :

| ADR  | Sujet                                                                           |
| ---- | ------------------------------------------------------------------------------- |
| 0001 | Monorepo unique, ownership par chemin                                           |
| 0002 | Deux axes : modules (présence) et providers (implémentation)                    |
| 0003 | Schéma d'identifiants — `MOCK`/`DOC` fixes, préfixe de tickets propre au projet |
| 0004 | Outillage du dépôt, et pourquoi TypeScript reste en 6.x                         |
| 0005 | Ticketing maison plutôt que Backlog.md intégré                                  |
| 0006 | Les modules déclarent leurs dépendances, ils ne les installent pas              |
| 0007 | Nunjucks en macros pour les maquettes                                           |
| 0008 | Format des tickets — Gherkin dans le corps, statuts imposés                     |
| 0009 | Un seul nom : Klee, projet comme commande                                       |
| 0010 | Le graphe de traçabilité — arêtes, mentions, ce que `links check` refuse        |
| 0011 | Site docs-as-code — Docusaurus, en une seule instance                           |

## Références

- `.agents/AGENTS.md` — contexte de travail partagé des agents.
- `docs/technical/cli-klee.md` — référence de la CLI.
- `docs/technical/project-config.md` — schéma de `project.config.json`.
- `docs/technical/graphe-de-tracabilite.md` — nœuds, arêtes, mentions, vérification.
