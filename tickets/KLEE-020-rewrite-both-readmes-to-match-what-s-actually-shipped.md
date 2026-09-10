---
id: KLEE-020
title: Rewrite both READMEs to match what's actually shipped
status: done
assignee: null
created: 2026-09-10
updated: 2026-09-10
depends_on: []
related_mockups: []
related_docs: []
authored_by: agent
---

The npm-facing README (apps/cli/README.md) was three lines: install instructions, nothing about tickets, mockups, the graph, or the studio. The repo root README was stale in a different way — frozen at 'phases 0 à 3 livrées', with no mention of klee studio, the mockup accessibility gate, token starters, or klee links report, all shipped in phase 4. Both are rewritten from the actual command surface (each subcommand's --help output, not aspirational docs): real command list, presets, token starters, the accessibility gate on mockup validation, and the exact license (Klee Source-Available, not MIT). Ships as a patch (0.2.2, changeset rich-planets-dance) since republishing is the only way to update what npm displays for an already-published package.

## Critères d'acceptation

```gherkin
Scénario: le README npm liste des commandes qui existent réellement
  Étant donné apps/cli/README.md
  Quand on compare sa table de commandes à `klee --help`
  Alors chaque commande listée existe, sans commande manquante ni inventée

Scénario: le README npm cite la vraie licence
  Étant donné apps/cli/README.md
  Alors sa section License nomme la licence réellement présente dans apps/cli/LICENSE

Scénario: le README racine reflète l'état de phase réel
  Étant donné README.md (racine)
  Alors il mentionne la phase 4 (klee studio, gate a11y, starters, links report)
  Et il ne s'arrête plus à « phases 0 à 3 livrées »

Scénario: le changeset associé publie une vraie mise à jour npm
  Étant donné le changeset rich-planets-dance en patch
  Quand la release est publiée
  Alors la page npm de @klee-dev/cli affiche le README à jour
```
