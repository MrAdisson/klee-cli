---
id: KLEE-009
title: Lire un ticket depuis le board, pas seulement le déplacer
status: in-review
assignee: null
created: 2026-09-09
updated: 2026-09-09
depends_on: []
related_mockups: []
related_docs: []
authored_by: agent
---

Le board sait créer un ticket, le déplacer et montrer son voisinage dans le graphe. Il ne sait
pas le **lire** : une carte porte l'identifiant, le titre, l'assigné et les liens, jamais la
description ni les critères d'acceptation.

L'information est pourtant déjà en main : `Ticket` porte `body` et `acceptance`, extraits à la
lecture. Le board les a et ne les rend nulle part.

Plus gênant, le formulaire de création du board propose un champ **Description**. On peut donc
écrire depuis le board une description que le board ne rendra jamais : l'information entre et
disparaît.

Enjeu d'adoption, pas de confort. `DESIGN.md` §5 pose que le cockpit doit être utilisable
« sans jamais toucher un terminal », et que c'est « le principal facteur d'adoption » : si un
PM doit ouvrir un fichier markdown pour lire un ticket, l'outil manque la cible qui le
justifie. Les critères d'acceptation, qu'ADR 0008 impose dans le corps, sont la partie la plus
utile d'un ticket — et la seule qu'on ne puisse pas voir.

Comme le reste du board, la vue doit fonctionner **sans JavaScript** : une page, pas un
dépliant. Un cockpit qui exigerait du JS pour lire un ticket serait plus fragile sans être
plus utile.

## Critères d'acceptation

```gherkin
Scénario: une carte mène au ticket qu'elle représente
  Étant donné un board affichant un ticket
  Quand on suit le lien de sa carte
  Alors la page du ticket s'ouvre, sans exiger de JavaScript

Scénario: la description écrite depuis le board est relisible depuis le board
  Étant donné un ticket créé depuis le board avec une description
  Quand on ouvre sa page
  Alors la description est affichée

Scénario: les critères d'acceptation sont lisibles tels qu'ils ont été écrits
  Étant donné un ticket dont le corps contient un bloc gherkin
  Quand on ouvre sa page
  Alors les scénarios sont rendus en préformaté, sans perdre leur indentation

Scénario: un ticket sans critères ne montre pas une section vide
  Étant donné un ticket dont le corps ne contient aucun bloc gherkin
  Quand on ouvre sa page
  Alors aucune section de critères d'acceptation n'est affichée

Scénario: les identifiants cités restent des arêtes cliquables
  Étant donné un ticket dont la description mentionne MOCK-001
  Quand on ouvre sa page
  Alors cet identifiant est un lien vers la maquette

Scénario: le statut se change depuis la page du ticket
  Étant donné la page d'un ticket en backlog
  Quand on choisit un autre statut et qu'on valide
  Alors le ticket change de statut, et la page le reflète

Scénario: un identifiant inconnu ne produit pas une page vide
  Étant donné un identifiant qui ne correspond à aucun ticket
  Quand on demande sa page
  Alors le board répond 404 en le disant
```
