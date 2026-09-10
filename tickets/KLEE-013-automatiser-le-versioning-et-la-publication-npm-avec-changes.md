---
id: KLEE-013
title: Automatiser le versioning et la publication npm avec Changesets
status: in-review
assignee: null
created: 2026-09-10
updated: 2026-09-10
depends_on:
  - KLEE-012
related_mockups: []
related_docs: []
authored_by: agent
---

Klee publie désormais un changement de version et un changelog via Changesets plutôt qu'à la main : `.changeset/config.json` cadre la politique (paquet public `@klee-dev/cli` seul versionné, `@klee/core` ignoré), et `.github/workflows/release.yml` ouvre une PR de version après chaque push sur `main`, puis publie sur npm quand cette PR est mergée. Ce ticket documente rétroactivement ce travail (commits `setup Changesets for automated npm publishing` et `update permissions for release job in workflow`), resté sans ticket jusqu'ici — un oubli à rattraper, la CI de release en dépend au même titre que le reste.

## Critères d'acceptation

```gherkin
Scénario: déclarer un changement avant de merger
  Étant donné un changement dans apps/cli ou apps/packages/core
  Quand on exécute `pnpm changeset`
  Alors un fichier est ajouté sous `.changeset/`
  Et il décrit le paquet concerné et l'ampleur du changement

Scénario: la release n'ouvre qu'une PR de version, elle ne publie pas encore
  Étant donné des changesets en attente sur la branche main
  Quand le workflow Release s'exécute après un push sur main
  Alors une pull request "chore(release): version packages" est créée ou mise à jour
  Et rien n'est publié sur npm à cette étape

Scénario: merger la PR de version déclenche la publication
  Étant donné la pull request de version mergée sur main
  Quand le workflow Release s'exécute à nouveau
  Alors `@klee-dev/cli` est publié sur le registre npm public
  Et `@klee/core` n'est jamais publié séparément, ignoré par `.changeset/config.json`

Scénario: la CI vérifie le code avant toute version ou publication
  Étant donné le workflow Release
  Quand il s'exécute
  Alors `pnpm run verify` passe avant l'étape de version ou de publication
```
