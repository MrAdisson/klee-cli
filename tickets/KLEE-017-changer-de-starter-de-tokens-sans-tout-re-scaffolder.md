---
id: KLEE-017
title: Changer de starter de tokens sans tout ré-scaffolder
status: done
assignee: null
created: 2026-09-10
updated: 2026-09-10
depends_on:
  - KLEE-015
related_mockups: []
related_docs: []
authored_by: agent
---

klee init --force --token-starter <id> est le seul chemin existant pour changer de starter sur un projet déjà scaffoldé — il réapplique tout le plan (mockups, docs, tickets), pas seulement design-system/. Ce ticket ajoute klee tokens set-starter <id> : régénère uniquement tokens.json via buildTokens, met à jour project.config.json, rien d'autre. design-system/tokens.json étant un fichier que design-system/AGENTS.md autorise à éditer à la main, l'écrasement demande toujours confirmation (--yes pour le scriptable, échec propre hors TTY sans --yes). Complétion (klee __complete) mise à jour pour les ids de starter, aux deux endroits où ils apparaissent.

## Critères d'acceptation

```gherkin
Scénario: aucune confirmation, aucun TTY — la commande échoue plutôt que de deviner
  Étant donné un environnement non interactif, sans --yes
  Quand `klee tokens set-starter <id>` s'exécute avec un starter différent de l'actuel
  Alors la commande échoue avec un message demandant --yes
  Et aucun fichier n'est modifié

Scénario: --dry-run n'écrit jamais rien
  Étant donné n'importe quel starter valide
  Quand `klee tokens set-starter <id> --dry-run` s'exécute
  Alors le plan est affiché
  Et ni tokens.json ni project.config.json ne changent

Scénario: --yes écrase et régénère
  Étant donné un projet déjà scaffoldé avec le starter A
  Quand `klee tokens set-starter B --yes` s'exécute
  Alors design-system/tokens.json résout ses alias vers les primitifs de B
  Et project.config.json porte `designSystem.tokenStarter: "B"`
  Et `design-system/dist/` est reconstruit

Scénario: un starter déjà actif ne redemande rien
  Étant donné un projet déjà sur le starter A
  Quand `klee tokens set-starter A` s'exécute
  Alors la commande l'indique et ne modifie rien, sans poser de question

Scénario: un id inconnu échoue avant toute confirmation
  Étant donné un id absent du registre
  Quand `klee tokens set-starter <id>` s'exécute
  Alors elle échoue avec la liste des starters disponibles
  Et aucune confirmation n'est demandée

Scénario: le module mockups est requis
  Étant donné un projet sans le module mockups
  Quand `klee tokens set-starter <id>` s'exécute
  Alors elle échoue en pointant vers `klee module add mockups`

Scénario: la complétion connaît les starters
  Étant donné `klee __complete tokens set-starter <partiel>`
  Quand on complète
  Alors les ids de starters qui correspondent sont proposés
  Et il en va de même pour `klee __complete init --token-starter <partiel>`
```
