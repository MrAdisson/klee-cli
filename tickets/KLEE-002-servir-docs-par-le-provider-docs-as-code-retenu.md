---
id: KLEE-002
title: Servir docs/ par le provider docs-as-code retenu
status: in-review
assignee: null
created: 2026-09-09
updated: 2026-09-09
depends_on: []
related_mockups: []
related_docs:
  - DOC-013
authored_by: human
---

Le provider `docs` cesse d'être déclaratif : il génère un site Docusaurus, servi par `klee docs serve`. Klee dogfoode le sien.

## Critères d'acceptation

```gherkin
Scénario: un projet neuf s'installe et sert sa documentation
  Étant donné un projet créé par klee init --yes
  Quand on lance pnpm install puis klee docs build
  Alors l'installation et la construction réussissent
  Et chaque page servie répond 200, feuilles de style comprises

Scénario: un lien interne cassé arrête la construction
  Étant donné un document qui cite un fichier inexistant
  Quand on lance klee docs build
  Alors la construction échoue en nommant le lien

Scénario: un projet scaffoldé avant la phase 3 obtient son site
  Étant donné un projet sans docs/package.json
  Quand on lance klee docs init
  Alors les fichiers du provider retenu sont générés
```
