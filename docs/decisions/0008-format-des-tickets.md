---
id: DOC-010
related_tickets: []
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0008 — Format des tickets

## Contexte

`TECHNICAL.md` §6 fixe le principe — un ticket est un fichier markdown à frontmatter
structuré — et §11 ajoute que les critères d'acceptation doivent être en Gherkin « directement
dans le frontmatter du ticket plutôt qu'en prose libre, pour être exécutables ». Restaient à
trancher : la forme exacte du frontmatter, l'emplacement du Gherkin, le jeu de statuts,
l'organisation des fichiers et l'allocation des identifiants.

Ce format sera hérité par tout projet Keel. C'est la décision la plus permanente de la phase 2.

## Décisions

### Le Gherkin vit dans le corps, pas dans le frontmatter

Un bloc ` ```gherkin ` sous un titre stable (« Critères d'acceptation »), extrait
mécaniquement par `extractAcceptance`.

C'est un écart délibéré à la lettre de §11, mais pas à son intention : l'objectif énoncé est
que les critères soient **exécutables**, donc extractibles par une machine. Un bloc de code
clôturé l'est exactement autant qu'un scalaire YAML, et il reste lisible, éditable et
colorisé — dans un éditeur, dans une revue de PR, et dans le formulaire du board. Le Gherkin
est du texte multi-ligne à indentation signifiante ; l'enfermer dans du YAML le rend pénible à
écrire pour un humain sans rien apporter à la machine.

Un ticket peut n'avoir aucun critère : tous ne s'y prêtent pas, et en exiger n'aurait produit
que des scénarios de façade.

### Statuts imposés, non configurables

`backlog` → `ready-for-dev` → `in-progress` → `in-review` → `done`.

`ready-for-dev` n'est pas décoratif : c'est la cible du webhook « une maquette passe en
`validated` » (§7). Un workflow variable d'un projet à l'autre rendrait ces automatismes
inécrivables, et les colonnes du board incomparables. C'est un cas d'application directe de la
règle de §13 : la cohérence transverse prime là où le graphe est en jeu.

### Dossier plat, statut dans le frontmatter

`tickets/PROJ-001-titre-court.md`, sans sous-dossier par statut.

Ranger les tickets par statut ferait de chaque transition un renommage git : l'historique d'un
ticket deviendrait une suite de déplacements, et un `git log` par fichier cesserait de suivre
sa vie. Le statut est une donnée, pas un emplacement.

Le nom de fichier commence par l'identifiant — il trie naturellement et se retrouve à vue. Le
slug du titre n'est là que pour la lisibilité humaine ; c'est l'`id` du frontmatter qui fait foi.

### Allocation des identifiants : `max + 1`

Le fichier lui-même est la réservation.

Limite connue et assumée : deux agents qui créent un ticket en parallèle sur deux branches
obtiennent le même numéro, et git ne signalera aucun conflit puisque les fichiers diffèrent.
Une renumérotation est sans perte tant que le ticket n'est pas référencé ailleurs. Une
réservation plus forte (verrou, plage par agent, suffixe de branche) coûterait de l'état ou de
la coordination pour un problème qui ne s'est pas encore manifesté — à revoir si l'usage réel
le fait apparaître.

### `markdown-only` par défaut, `markdown-sqlite` disponible

Écart au défaut annoncé par §6, et les deux providers sont réellement implémentés.

Quelques milliers de tickets markdown se parsent en bien moins d'une seconde. Un index
apporte d'abord de l'état — une invalidation à écrire, un fichier à ignorer, une péremption
au changement de branche — et seulement ensuite de la vitesse. Le défaut va donc à l'absence
d'index, et l'index SQLite reste à un mot de configuration près pour les corpus qui le
justifient.

L'implémentation SQLite invalide par `mtime` + taille **par fichier**, ce qui la rend correcte
après un `git checkout` qui réécrit tout — un cache horodaté globalement ne le serait pas.

## Conséquences

- Un provider n'est plus seulement un générateur de fichiers : `tickets-index` porte du
  comportement (`Provider.ticketIndex`). Le pattern de §13 s'applique aussi à l'exécution, tant
  que ce comportement reste derrière une interface commune.
- Les écritures (`create`, `move`) ne passent jamais par l'index : elles écrivent le fichier.
  Supprimer `.keel/` ne perd donc jamais rien.
- Le board et la CLI lisent par la même interface : aucun des deux ne sait s'il lit du markdown
  ou du SQLite.
- Un ticket reste éditable à la main dans n'importe quel éditeur, et l'index s'en aperçoit — un
  test le vérifie pour les deux providers.
