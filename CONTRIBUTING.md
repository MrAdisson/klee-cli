# Contribuer à Keel

## Prérequis

- Node ≥ 22.12 (le dépôt cible la version de `.nvmrc`)
- pnpm ≥ 10 (`corepack enable` suffit)

```bash
pnpm install
pnpm run build
```

## Avant chaque PR

```bash
pnpm run verify
```

Cette commande enchaîne format, lint, typecheck et tests. La CI ne fait rien de plus : ce qui
passe en local passe en CI.

## Ordre des phases

`TECHNICAL.md` définit une roadmap en phases, et cet ordre est contraignant : **chaque phase
se lance une fois la précédente validée par un humain.** Une PR qui anticipe une phase
ultérieure sera refusée même si le code est bon — ce n'est pas une liste de « nice to have »,
c'est l'ordre d'implémentation réel du projet.

## Où va quoi

| Vous ajoutez…                                 | …ça va ici                           |
| --------------------------------------------- | ------------------------------------ |
| Une règle de domaine, un module, un provider  | `apps/packages/core/`                |
| Une commande, une question, du rendu terminal | `apps/cli/`                          |
| Une décision structurante                     | un nouvel ADR dans `docs/decisions/` |
| De la référence technique                     | `docs/technical/`                    |

Rien de tout cela ne va dans `TECHNICAL.md` ou `DESIGN.md` : ce sont les entrées du projet,
pas ses sorties. Ils ne se modifient que sur décision explicite, et sont exclus de Prettier
pour cette raison.

## Ajouter un provider

C'est le chemin le plus fréquent, et il doit rester trivial :

1. Créer le fichier du point concerné dans `apps/packages/core/src/providers/`
   (ou ajouter une entrée au fichier existant du point).
2. Implémenter l'interface `Provider` — ou `declarativeProvider` si la génération de fichiers
   relève d'une phase ultérieure.
3. L'enregistrer dans `apps/packages/core/src/providers/index.ts`.

Rien d'autre. Si l'ajout vous oblige à toucher la CLI, la configuration ou les générateurs de
modules, signalez-le : c'est un défaut de conception à corriger, pas à contourner.

## Ajouter un module

Un module optionnel de plus est une décision structurante : il change ce que `klee init`
demande à tous les utilisateurs. Ouvrez un ADR avant d'écrire le code. Rappel du critère
(`TECHNICAL.md` §13) : un module ne mérite le traitement « optionnel » que si des projets
légitimes n'en ont simplement pas l'usage.

Techniquement, il faut toucher `modules.ts`, le schéma de configuration, un générateur dans
`scaffold/modules/` et son enregistrement — la duplication est volontaire et surveillée par le
typage (`satisfies Record<ModuleId, …>`), pour qu'un module ajouté à moitié ne compile pas.

## Style

- Les commentaires expliquent **pourquoi**, jamais **quoi**. Un commentaire qui paraphrase la
  ligne suivante sera supprimé en revue.
- Une erreur attendue est une `KeelError` avec un `code` et, si possible, un `hint`.
- Un générateur de scaffolding retourne des fichiers, il n'en écrit aucun.
- Les tests portent sur le plan et sur le comportement observable, pas sur les détails
  d'implémentation.

## Commits

Un commit référence le ticket qui le motive (`KEEL-123`) dès que le ticketing est en place
(phase 2).
