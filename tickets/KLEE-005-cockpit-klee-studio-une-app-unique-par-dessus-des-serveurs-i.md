---
id: KLEE-005
title: 'Cockpit klee studio : une app unique par-dessus des serveurs indépendants'
status: in-review
assignee: null
created: 2026-09-09
updated: 2026-09-09
depends_on: []
related_mockups: []
related_docs:
  - DOC-017
  - DOC-019
authored_by: human
---

Onglets Board, Docs et Mockups sous une entrée unique, sans fusionner les serveurs, qui restent utilisables seuls.

## Critères d'acceptation

```gherkin
Scénario: les trois surfaces sont servies derrière une entrée unique
  Étant donné un projet dont les modules tickets, docs et mockups sont retenus
  Quand on lance klee studio
  Alors chaque onglet répond 200 depuis la page du studio

Scénario: un serveur tiers sur le port par défaut ne tue aucun onglet
  Étant donné un autre serveur déjà lancé sur le port 3000
  Quand on lance klee studio
  Alors l'onglet Docs démarre quand même, sur un port assigné

Scénario: un onglet en panne n'emporte pas les autres
  Étant donné un serveur agrégé qui ne démarre pas
  Quand on ouvre son onglet
  Alors la raison de l'échec est affichée
  Et les autres onglets restent utilisables

Scénario: un identifiant s'ouvre à sa page, dans le bon onglet
  Étant donné une maquette MOCK-001 et un document DOC-017
  Quand on demande /go/MOCK-001 puis /go/DOC-017
  Alors chacun ouvre son onglet à sa page, vérifiée avant redirection

Scénario: un module non retenu n'a pas d'onglet
  Étant donné un projet sans le module mockups
  Quand on lance klee studio
  Alors aucun onglet Maquettes n'est proposé

Scénario: l'arrêt ne laisse aucun serveur derrière
  Étant donné un studio en cours d'exécution
  Quand on l'interrompt
  Alors aucun processus de serveur agrégé ne survit

Scénario: le port du studio ne glisse pas en silence
  Étant donné le port 4300 déjà occupé
  Quand on lance klee studio
  Alors la commande échoue en nommant le port, sans rien avoir démarré
```
