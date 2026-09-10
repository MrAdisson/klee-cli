---
id: KLEE-007
title: 'Webhooks internes : réactions locales aux transitions'
status: done
assignee: null
created: 2026-09-09
updated: 2026-09-10
depends_on:
  - KLEE-008
related_mockups: []
related_docs: []
authored_by: human
---

Les trois règles nommées par TECHNICAL.md §7, déclenchées localement, sans service externe.

## Écarté — voir ADR 0019

Ce ticket est **clos sans implémentation**. Aucune des trois règles ne tient la promesse du
§7, et deux d'entre elles avaient déjà été écartées ailleurs sans qu'on le remarque :

- **maquette validée → ticket prenable** : le gate de l'ADR 0018 donne déjà la garantie, et
  mieux — il refuse la validation avant qu'elle soit écrite. Ce que la règle ajouterait, c'est
  une transition de ticket décidée par une machine, alors que `ready-for-dev` atteste d'autre
  chose : que les critères d'acceptation sont écrits ;
- **ticket fermé sans doc touchée** : l'ADR 0015 a déjà rejeté ce raisonnement — comparer les
  calendriers détecte l'activité, pas le problème ;
- **token modifié → régénérer puis régression visuelle** : la régénération est déjà tenue
  autrement, et la régression visuelle sort du périmètre (ADR 0019).

Le mot « webhook » supposait un événement à intercepter. `POST /mockups/<id>/status` en offre
un depuis l'ADR 0018, mais il n'est pas exhaustif : éditer un `.meta.yml` à la main reste
licite et invisible. Un automatisme qui s'applique une fois sur deux est pire que pas
d'automatisme.

## Critères d'acceptation

Sans objet : le ticket est écarté, pas reporté.
