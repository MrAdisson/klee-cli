---
id: KLEE-011
title: Améliorer la documentation initiale du scaffolding
status: in-review
assignee: null
created: 2026-09-09
updated: 2026-09-09
depends_on: []
related_mockups: []
related_docs: []
authored_by: agent
---

Rendre le README et les premiers documents générés par klee init utiles dès la création d’un projet : contenu adapté aux modules retenus, parcours de démarrage, références locales et Markdown correctement rendu.

## Critères d'acceptation

```gherkin
Scénario: le README explique le projet dès klee init
  Étant donné un preset et ses modules retenus
  Quand klee init génère le README
  Alors il présente les premiers repères, commandes et modules du projet

Scénario: les documents initiaux sont propres au projet
  Étant donné un projet nouvellement scaffoldé
  Quand l’équipe ouvre sa documentation technique et ses règles de maquette
  Alors elle trouve des consignes locales et aucune référence obligatoire à la documentation interne de Klee

Scénario: les templates Markdown sont rendus comme du Markdown
  Étant donné un README ou une documentation générée
  Quand le fichier est ouvert dans un lecteur Markdown
  Alors ses titres, tableaux et listes ne sont pas affichés comme un bloc de code
```
