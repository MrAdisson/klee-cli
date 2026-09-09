---
id: DOC-011
related_tickets: []
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0009 — Le projet s'appelle Klee, comme sa commande

## Contexte

Le projet a d'abord porté deux noms : **keel** pour le produit (la quille d'un navire — ce qui
tient la structure), **klee** pour la commande, par jeu de mots avec « CLI », qui se prononce
pareil.

À l'usage, l'auteur n'a jamais dit « keel » : il pense et parle du produit comme de **klee**.
L'écart n'était pas visible dans le code — packages `@keel/*`, binaire `klee` — mais il créait
une friction permanente entre ce qu'on dit et ce que le code affiche.

## Décision

**Un seul nom : Klee.** Projet, packages (`@klee/cli`, `@klee/core`), préfixe d'identifiants
(`KLEE-xxx`), dossier du dépôt et commande.

Le jeu de mots survit : « Klee » évoque toujours « CLI ». Il ne repose simplement plus sur
l'existence d'un second nom.

## Pourquoi maintenant

Le renommage a été fait au moment où il ne coûtait presque rien, et c'est ce qui a motivé de le
traiter immédiatement plutôt que de l'ajourner :

- aucun ticket `KEEL-xxx` n'existait encore — le préfixe a pu changer sans renuméroter quoi que
  ce soit, ni casser une référence croisée ;
- rien n'était publié sur un registre, donc aucun nom de package n'était figé ;
- aucune référence externe (documentation, dépôt distant, projet tiers scaffoldé) ne pointait
  vers l'ancien nom.

Chacun de ces trois points aurait cessé d'être vrai en quelques semaines d'usage réel. Un
renommage d'identité est de ceux qui deviennent rapidement plus coûteux à faire qu'à subir.

## Conséquences

- Le dépôt vit désormais dans `klee/`. Un lien symbolique vers `apps/cli/dist/bin/klee.js` doit
  être refait après un déplacement de dossier — c'est noté dans `.agents/AGENTS.md`.
- Le script `build` de `@klee/cli` repose le bit exécutable sur le binaire : `tsc` ne le
  préserve pas, et une reconstruction propre rendait la commande inutilisable.
- Les projets déjà scaffoldés avec l'ancienne version gardent `PROJ-xxx` par défaut : le préfixe
  d'un projet généré n'a jamais dépendu du nom de l'outil.
