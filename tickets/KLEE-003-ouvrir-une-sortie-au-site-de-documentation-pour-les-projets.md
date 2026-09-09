---
id: KLEE-003
title: Ouvrir une sortie au site de documentation pour les projets légers
status: done
assignee: null
created: 2026-09-09
updated: 2026-09-09
depends_on:
  - KLEE-002
related_mockups: []
related_docs:
  - DOC-013
  - DOC-015
authored_by: human
---

Le point `docs` appartient au socle : sans provider `markdown-only`, une bibliothèque interne embarquerait React.

La question ouverte — un preset a-t-il le droit de fixer un provider, ce que TECHNICAL.md §13
lui refusait — est tranchée par l'ADR 0012 : il peut le **proposer**, jamais l'imposer.
`--provider <point>=<id>` rend la proposition réfutable y compris sans terminal.

## Critères d'acceptation

```gherkin
Scénario: une bibliothèque interne n'embarque pas React
  Étant donné klee init --preset internal-lib --yes
  Quand on calcule son plan de scaffolding
  Alors turbo est la seule dépendance déclarée
  Et docs/technical/ contient tout de même sa documentation

Scénario: la proposition du preset reste réfutable sans terminal
  Étant donné klee init --preset internal-lib --provider docs=docusaurus --yes
  Quand on calcule son plan de scaffolding
  Alors le site de documentation est généré

Scénario: un provider inconnu est refusé avant toute écriture
  Étant donné --provider docs=inconnu
  Quand on lance klee init
  Alors la commande échoue en listant les providers disponibles
  Et aucun fichier n'a été écrit
```
