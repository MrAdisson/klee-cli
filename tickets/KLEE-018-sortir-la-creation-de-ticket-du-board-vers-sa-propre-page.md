---
id: KLEE-018
title: Sortir la création de ticket du board vers sa propre page
status: done
assignee: null
created: 2026-09-10
updated: 2026-09-10
depends_on: []
related_mockups: []
related_docs: []
authored_by: agent
---

Le formulaire « Nouveau ticket » vivait en bloc permanent sous le kanban du board, atteint par une simple ancre (#nouveau) : il poussait toutes les colonnes vers le bas en continu, pour une action occasionnelle. Il vit maintenant sur sa propre page (GET /tickets/new), toujours sans JavaScript — une page de plus, pas un renoncement à la doctrine du board. Le board et les pages ticket/graphe n'affichent plus qu'un lien vers elle. En cas de titre vide, la redirection d'erreur ramène sur cette page plutôt que sur le board.

## Critères d'acceptation

```gherkin
Scénario: le board n'embarque plus le formulaire de création
  Étant donné le board affiché
  Alors aucun formulaire vers /tickets n'apparaît dans la page
  Et un lien vers /tickets/new est présent dans l'en-tête

Scénario: la page de création reste utilisable sans JavaScript
  Étant donné la page /tickets/new
  Alors elle contient un formulaire method="post" vers /tickets

Scénario: un titre vide ramène sur la page de création, avec le motif
  Étant donné le formulaire de /tickets/new soumis avec un titre vide
  Quand la création est refusée
  Alors la redirection pointe vers /tickets/new avec un message d'erreur
  Et ce message est visible sur la page rechargée

Scénario: la page de création reste accessible depuis les autres vues du board
  Étant donné la page d'un ticket ou la vue du graphe
  Alors un lien vers /tickets/new est présent dans l'en-tête
```
