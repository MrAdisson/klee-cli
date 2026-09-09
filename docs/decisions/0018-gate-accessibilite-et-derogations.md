---
id: DOC-021
related_tickets: [KLEE-008]
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0018 — L'accessibilité est un gate sur `validated`, avec des dérogations motivées

## Contexte

`DESIGN.md` §6 demande que l'exigence WCAG « cesse d'être déclarative pour devenir un gate
mécanique » : chaque maquette passée au crible d'axe-core avant qu'un statut `validated`
puisse être posé.

Rien ne le vérifie. `axe` n'apparaissait nulle part dans le dépôt, et le point de provider
`visual-regression` est purement déclaratif — il nomme Playwright sans déclarer la moindre
dépendance. Pire, le scaffolding écrivait dans l'`AGENTS.md` de chaque projet généré que
l'accessibilité était « vérifiée au stade maquette » : une garantie affirmée et jamais rendue.

Avant d'implémenter, une objection a été posée : un gate obligatoire rend-il l'outil rigide ?
Un projet croulant sous les règles bloquantes n'avance plus, et la tentation est alors de
rendre la sévérité configurable — par projet, voire par ticket.

Trois questions à trancher : **sur quoi le gate mord**, **comment on y déroge**, et **avec
quel moteur**.

## Décisions

### Le gate porte sur le statut, et le statut n'est pas un réglage

Bloquant sur `validated` et `implemented`. Aucun effet sur `draft`, dont les violations sont
rapportées sans jamais faire échouer quoi que ce soit.

La sévérité **ne se configure pas**. `TECHNICAL.md` §13 réserve la configuration aux points
où deux solutions se valent réellement et impose une convention unique partout ailleurs, « la
cohérence transverse prime sur la flexibilité ». Un `a11y: off` n'aurait pas été un choix
d'architecture mais un interrupteur de confort, et un gate qu'on éteint le jour où il gêne ne
garantit rien le reste du temps.

Ce qui rend la contrainte vivable n'est pas un interrupteur : c'est `draft`. Un projet qui
explore n'est jamais bloqué, parce qu'il n'affirme rien. Le gate ne mord qu'au moment où
quelqu'un déclare la maquette prête — et `DESIGN.md` §1 dit ce que cette déclaration engage :
la maquette porte alors 100 % de l'information nécessaire, sans que celui qui implémente ait
à inventer une couleur ou un espacement. **`validated` est un contrat, pas une étape de
progression.** Le vérifier n'ajoute pas une exigence : il rend exigible celle qui était déjà
écrite.

Refusée pour la même raison, la sévérité par ticket : elle ferait dépendre la conformité d'une
maquette du ticket par lequel on l'a abordée, alors qu'une maquette est consommée par tous
ceux qui l'implémentent, longtemps après le ticket qui l'a fait naître.

### Une dérogation est motivée, portée par la maquette, et visible

Une maquette peut écarter une règle nommée, à condition d'écrire pourquoi. Une exemption sans
raison est refusée exactement comme la violation qu'elle prétend couvrir, et elle ne couvre
que la règle qu'elle nomme.

Ce n'est pas une soupape concédée à contrecœur : c'est le §1 appliqué. Sans elle, un contraste
faible dans une maquette validée est indiscernable d'un oubli — celui qui implémente ne sait
pas s'il doit le reproduire ou le corriger, donc il improvise, ce que le principe interdit.
La raison écrite transmet l'information manquante : la dérogation est une décision.

Les dérogations sont listées par la vérification **même quand tout passe**. Une exemption
qu'on n'affiche plus est un vœu pieux enterré dans un YAML, et l'ADR 0015 a déjà tranché qu'un
signal qu'on n'entend plus est pire que pas de signal.

### Le contraste impose un vrai navigateur

axe-core sous jsdom ne sait pas juger un contraste : il n'y a ni layout, ni styles calculés,
ni superposition réelle. Or le contraste est la première chose que `DESIGN.md` §6 nomme.
Un audit qui l'omettrait passerait au vert sur le défaut d'accessibilité le plus courant, ce
qui est pire que pas d'audit.

Le moteur est donc **Playwright**, qui est aussi le défaut du point `visual-regression` — un
seul navigateur servira les deux usages plutôt que d'en installer deux.

### Le gate appartient au module, pas au point `visual-regression`

Le rattacher à ce point aurait paru économique, puisqu'il nomme déjà Playwright. Ce serait une
erreur : un projet qui choisit BackstopJS ou Percy perdrait le gate, alors que `DESIGN.md` §6
pose l'accessibilité comme une **exigence transverse**, sans alternative — là où la régression
visuelle est justement un choix à trois options. Faire dépendre une exigence non négociable
d'un choix négociable, c'est la rendre négociable par la bande.

Playwright et axe-core sont donc déclarés par le **module `mockups`** lui-même. Un projet qui
retient des maquettes a le gate, quel que soit son outil de régression visuelle.

### Le navigateur est déclaré par le projet, jamais embarqué par klee

Playwright et son Chromium pèsent plus de cent mégaoctets. Les ajouter aux dépendances de la
CLI les imposerait à tout utilisateur de klee, y compris à une bibliothèque interne sans la
moindre maquette.

Ils sont déclarés comme Eleventy l'est (ADR 0006, ADR 0012 : ce qu'on apporte, on le déclare,
on ne l'installe pas), et le téléchargement du navigateur passe par `installScripts` : c'est
le mécanisme déjà en place pour trancher explicitement les scripts de post-installation. Le
navigateur arrive donc avec les dépendances — au `pnpm install`, ou à la fin de `klee init`
si l'on a accepté l'installation — jamais par une étape séparée que personne ne pense à faire.

Un projet sans le module `mockups` n'a rien à installer et rien à vérifier.

### Le domaine décide, le projet exécute

| Où               | Responsabilité                                                              |
| ---------------- | --------------------------------------------------------------------------- |
| `@klee/core`     | quelles maquettes sont tenues, quelles dérogations s'appliquent, le verdict |
| projet scaffoldé | exécuter axe-core dans le navigateur sur les pages construites              |
| `@klee/cli`      | construire si besoin, appeler, rendre le rapport, porter le code de sortie  |

Le domaine ne connaît ni navigateur ni axe-core : il reçoit des violations et tranche. C'est
ce qui rend le verdict testable sans télécharger un navigateur, et ce qui permettra de changer
de moteur sans toucher à la règle.

## Conséquences

- Le `.meta.yml` d'une maquette gagne un champ de dérogations : le schéma du graphe évolue,
  et les projets déjà scaffoldés restent valides puisque l'absence du champ vaut « aucune ».
- La vérification est une commande, pas une interception : `validated` s'écrit en éditant un
  fichier, jamais par une commande, donc il n'y a rien à intercepter. Même forme que
  `klee links check` — elle constate et refuse, avec un code de sortie utilisable en CI.
- La phrase du scaffolding pourra redevenir affirmative pour les projets qui retiennent le
  module `mockups` — c'est ce ticket qui la rend vraie.
- La première règle de KLEE-007 devient honnête : faire transiter un ticket parce qu'une
  maquette est `validated` cesse de propager une déclaration pour propager un fait vérifié.
  C'est pourquoi KLEE-007 dépend désormais de KLEE-008.
- **Reste ouvert :** `DESIGN.md` §5 veut que designers et PM travaillent sans terminal, or ce
  sont eux qui corrigent un contraste. Un rapport qui ne parle qu'en ligne de commande sert
  les développeurs et manque sa cible. Rendre les violations visibles dans le studio, sur la
  maquette concernée, n'est pas dans le périmètre de KLEE-008 mais décidera probablement de
  l'adoption du gate.
