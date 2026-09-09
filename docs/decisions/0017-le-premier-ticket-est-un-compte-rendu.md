---
id: DOC-020
related_tickets: []
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0017 — Le premier ticket d'un projet est un compte rendu, pas une tâche

## Contexte

`klee init` écrivait un premier ticket en `backlog` : « Transcrire la maquette de connexion en
composant ». Trois raisons l'avaient mis là — donner un exemple d'arête résolvable, éviter que
le `.meta.yml` des maquettes ne référence un ticket inexistant, et faire échouer le premier
`klee links check` sur la sortie de `klee init`.

Le résultat était pourtant un mensonge sur l'état du projet : **le board d'un projet neuf
affichait du travail en attente que personne n'avait décidé**. Un lecteur — et c'est
précisément une PM ou une designer que le board vise — hérite d'un engagement qui n'existe
pas, arbitré par le scaffolder plutôt que par l'équipe.

Le même défaut se retrouvait dans les maquettes générées : leur `related_tickets` pointait
d'office vers ce ticket, fabriquant une arête que personne n'avait voulue.

## Décisions

### Le ticket `<prefixe>-001` consigne l'initialisation

Titre : `<nom du projet> — initialisation du projet`. Statut : **`done`**, dès sa création.
C'est un fait acquis, pas une intention — et le board d'un projet neuf n'affiche donc rien
dans les colonnes de travail.

Il porte ce qu'aucun autre fichier ne dit sous cette forme : les modules retenus et leurs
libellés, les providers choisis point par point, le schéma d'identifiants. `project.config.json`
en porte les identifiants, pas les raisons ; et il changera au fil du projet sans garder trace
de son point de départ. Le ticket, lui, reste — c'est ce que `tickets/AGENTS.md` appelle
« préserver l'historique de décision ».

Il n'a **pas** de bloc `gherkin` : poser des critères d'acceptation sur un fait déjà acquis
n'aurait aucun sens, et laisser le gabarit à compléter en inviterait le remplissage.

Son arête vers `DOC-001` — l'ADR de topologie — garde ce que l'ancien ticket apportait de
légitime : un graphe non vide et résolvable dès la première commande.

### Une maquette générée ne déclare aucun ticket

`related_tickets: []`. Une maquette d'exemple n'est liée à aucun travail décidé ; l'y relier
d'office fabrique une arête que personne n'a voulue et fait croire à un engagement là où il
n'y a qu'un gabarit.

C'est sans conséquence sur `klee links check` : une liste vide ne pointe nulle part, et seul
un lien **déclaré** vers un artefact inexistant fait échouer la commande (ADR 0010).

## Conséquences

- Le board d'un projet neuf montre une seule carte, en `done`. Le premier ticket de travail
  est écrit par l'équipe, ce qui est le seul endroit où il peut légitimement naître.
- Un projet scaffoldé avant ce changement garde son ancien ticket : rien ne le réécrit, et
  `--refresh-root` ne touche pas à `tickets/` (ADR 0013).
- Le libellé d'un module contenant déjà ses chemins, le README généré et ce ticket cessent de
  les répéter — « `apps/` — apps/ — code applicatif » devient « apps/ — code applicatif ».
- Reste ouvert : le ticket porte `authored_by: human`, faute d'une valeur qui dirait « écrit
  par l'outil ». C'est le geste de l'humain qui lance `klee init` qui le crée, mais le champ
  ne distingue pour l'instant que l'agent de l'humain (TECHNICAL.md §7).
