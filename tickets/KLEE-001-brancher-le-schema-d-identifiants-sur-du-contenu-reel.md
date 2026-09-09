---
id: KLEE-001
title: Brancher le schéma d'identifiants sur du contenu réel
status: done
assignee: null
created: 2026-09-09
updated: 2026-09-09
depends_on: []
related_mockups: []
related_docs:
  - DOC-012
  - DOC-014
authored_by: human
---

Le graphe de traçabilité : lecture des tickets, des docs et des .meta.yml, résolution des arêtes dans les deux sens, mentions, et vérification par `klee links check`. Rend cliquable chaque identifiant du board.

## Critères d'acceptation

```gherkin
Scénario: un lien déclaré d'un seul côté se voit des deux
  Étant donné un ticket qui déclare related_docs: [DOC-018]
  Et une doc DOC-018 qui ne déclare rien
  Quand on demande le voisinage de DOC-018
  Alors le ticket y apparaît

Scénario: un lien déclaré vers un artefact inexistant est refusé
  Étant donné une maquette qui déclare related_tickets: [KLEE-404]
  Quand on lance klee links check
  Alors la commande sort en 1 et nomme le fichier fautif

Scénario: un identifiant écrit dans du code n'est pas une référence
  Étant donné une doc qui illustre le schéma avec `KLEE-123` entre backticks
  Quand on construit le graphe
  Alors aucune mention n'est relevée
```
