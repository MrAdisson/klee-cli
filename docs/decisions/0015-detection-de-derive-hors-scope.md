---
id: DOC-018
related_tickets: []
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0015 — La détection de dérive maquette / composant sort du périmètre

## Contexte

`TECHNICAL.md` §7 inscrit en phase 4 :

> **Détection de dérive :** un check (CLI ou CI) compare périodiquement une maquette
> `status: implemented` avec le composant qu'elle référence, pour détecter quand
> l'implémentation réelle a divergé silencieusement de la maquette source de vérité.

Le graphe pose déjà la moitié du chemin : `GraphNode.implementedIn` porte le chemin du
composant, renseigné par `implemented_in` dans le `.meta.yml` d'une maquette. Ce n'est pas une
arête — à l'autre bout il y a un fichier, pas un identifiant.

Reste la question que le brief ne tranche pas : **comparer, comment ?**

Trois mécanismes ont été instruits.

**Comparer les contenus.** Une maquette est du HTML produit par Eleventy ; le composant est du
JSX, du Vue ou du Svelte. Il n'existe pas de correspondance vérifiable entre les deux sans un
rendu réel des deux côtés, puis une comparaison sémantique de ce rendu. C'est un projet en soi,
et tout résultat approché produirait du faux positif en continu.

**Empreinter le fichier cible.** Enregistrer un hash du composant au moment où `implemented`
est posé, signaler quand il bouge. C'est faisable, mais ça introduit de l'état à maintenir et
ça se déclenche sur un passage de Prettier ou un renommage de variable — un signal qui crie
pour des changements sans rapport avec l'apparence finit par être ignoré, et un signal ignoré
est pire que pas de signal.

**Comparer les calendriers.** Déduire de l'historique git quel côté a bougé après l'autre, et
le rapporter comme un fait sans le juger. Honnête et bon marché, mais ça ne détecte pas la
dérive : ça détecte l'activité. Un composant refactorisé sans changement visuel serait signalé,
un composant dont on a changé la couleur en modifiant aussi la maquette ne le serait pas.

Aucun des trois ne répond réellement à la question posée. Les deux derniers y répondent à côté,
avec assez de vraisemblance pour qu'on croie le problème traité.

## Décision

**La détection de dérive n'est pas implémentée, et n'est planifiée dans aucune phase.**

Ce n'est pas un report faute de temps : c'est le constat qu'aucun mécanisme instruit ne tient
la promesse écrite au §7, et qu'en livrer un approché coûterait la confiance dans tous les
autres signaux de klee.

La voie qui reste crédible passe par la **régression visuelle**, dont le point de provider
existe déjà (`visual-regression`, défaut Playwright) et qui est aujourd'hui déclaratif. Comparer
deux rendus est le seul terrain où « la maquette et l'implémentation ont divergé » a un sens
mécanique — et c'est ce que fait un outil de régression visuelle, avec des seuils, des
références versionnées et une revue humaine des écarts. Le sujet reviendra par là, avec cet
outillage, ou ne reviendra pas.

Le champ `implemented_in` **reste** : il documente le lien maquette → composant, il est déjà
lu par le graphe et rendu dans `docs/_generated/`. Il n'était pas justifié par la seule
détection de dérive.

## Conséquences

- La phase 4 se réduit à trois objets : le cockpit (KLEE-005), la recherche transverse
  (KLEE-006) et les webhooks internes (KLEE-007).
- Cet ADR **amende** `TECHNICAL.md` §7 sans le réécrire — le brief reste l'entrée du projet, et
  la trace de ce qui a été retiré vaut mieux qu'un paragraphe effacé.
- Le commentaire de `GraphNode.implementedIn` renvoyait à « la détection de dérive, en phase
  4 » : il renvoie désormais ici.
- Aucune commande n'est retirée : rien n'avait été livré sur le sujet.
- La troisième règle de webhook du §7 — un token qui change déclenche une régression visuelle
  sur les maquettes concernées — reste dans le périmètre de KLEE-007 et se heurtera au même
  provider déclaratif. C'est là que la question se reposera concrètement.
