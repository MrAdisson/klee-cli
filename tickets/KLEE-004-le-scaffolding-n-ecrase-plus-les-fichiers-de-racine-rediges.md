---
id: KLEE-004
title: Le scaffolding n'écrase plus les fichiers de racine rédigés
status: done
assignee: null
created: 2026-09-09
updated: 2026-09-09
depends_on: []
related_mockups: []
related_docs: []
authored_by: human
---

`module add --refresh-root` imposait force et a détruit du contenu humain. Un troisième comportement de conflit — laisser tel quel — devient le défaut.

## Critères d'acceptation

```gherkin
Scénario: à écrire
  Étant donné un contexte
  Quand une action a lieu
  Alors un résultat vérifiable est observable
```
