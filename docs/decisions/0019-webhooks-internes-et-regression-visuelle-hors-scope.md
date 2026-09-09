---
id: DOC-022
related_tickets: [KLEE-007]
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0019 — Les webhooks internes et la régression visuelle sortent du périmètre

## Contexte

`TECHNICAL.md` §7 inscrit en phase 4 trois « webhooks internes (événements locaux, pas de
service externe requis) » :

> - Une maquette passe en `validated` → le ticket lié passe en `ready-for-dev`.
> - Un ticket dev est fermé sans qu'aucun fichier de `docs/` n'ait été touché → flag « doc
>   potentiellement obsolète ».
> - Un token de `design-system/tokens.json` change → régénère `design-system/dist/` puis
>   déclenche une régression visuelle sur les pages `mockups/` qui l'utilisent.

Le mot « webhook » suppose un événement qu'on intercepte. Klee n'a pas de processus qui
tourne en fond, et deux des trois changements naissent d'un éditeur de texte : on modifie un
`.meta.yml`, on modifie `tokens.json`. Il n'y a rien à accrocher.

Depuis, un point d'interception est pourtant apparu : `POST /mockups/<id>/status` fait passer
une maquette en `validated` après avoir exécuté le gate d'accessibilité (ADR 0018). Il existe
donc désormais un endroit où klee **sait** qu'une maquette vient d'être validée.

Cet endroit n'est pas exhaustif, et c'est ce qui tranche la question : éditer le `.meta.yml`
à la main reste licite et reste invisible. Une réaction branchée sur le seul chemin outillé
se déclencherait selon la façon dont on a changé le statut, pas selon ce qui a changé. Un
automatisme qui s'applique une fois sur deux est pire que pas d'automatisme : on cesse de
vérifier ce qu'on croit garanti.

## Décisions

### Les trois règles ne sont pas implémentées

Chacune pour une raison qui lui est propre.

**Maquette validée → ticket prenable.** Ce que la règle apporterait, ce n'est pas la
garantie — le gate de l'ADR 0018 la donne déjà, et mieux : il refuse la validation avant
qu'elle soit écrite. Ce qu'elle ajouterait, c'est **une transition de ticket décidée par une
machine**. Or `tickets/AGENTS.md` vient d'adosser chaque transition à un fait vérifiable, et
le fait qui autorise `ready-for-dev` n'est pas l'état des maquettes : ce sont les critères
d'acceptation écrits. Une maquette validée ne rend pas un ticket prenable si personne n'a dit
ce qu'il faut faire.

**Ticket fermé sans doc touchée → doc potentiellement obsolète.** L'ADR 0015 a déjà instruit
ce raisonnement pour la dérive et l'a rejeté : comparer les calendriers détecte l'activité,
pas le problème. Un ticket fermé sur une correction de faute de frappe crierait pour rien, et
un signal qui crie pour rien finit ignoré. La version pauvre mais honnête — « ce ticket `done`
ne déclare aucune doc » — n'apprend rien que `klee links` ne montre déjà.

**Token modifié → régénérer puis régression visuelle.** La régénération est déjà tenue,
autrement et mieux : `klee mockups serve` construit les tokens à la volée, `klee mockups
check` construit avant d'auditer, et la tâche `dev` dépend du `build` des paquets amont.
Reste la régression visuelle, qui n'existe pas.

### La régression visuelle sort du périmètre

Le point de provider `visual-regression` **reste déclaratif** : il nomme Playwright,
BackstopJS et Percy, et n'exécute rien. Ce n'est pas un oubli, c'est le périmètre.

Une régression visuelle utile suppose des images de référence versionnées, un seuil de
tolérance, une revue humaine des écarts et une façon d'accepter un changement voulu. C'est un
produit en soi, pas un webhook. En livrer une approximation coûterait la confiance dans les
autres signaux de klee — le même raisonnement qu'à l'ADR 0015, et il s'applique ici avec plus
de force encore puisque le sujet y avait déjà été renvoyé.

Playwright est désormais réellement installé par le module `mockups` (ADR 0018) : le jour où
la régression visuelle sera reprise, l'outil sera là. Rien n'oblige à la faire maintenant.

## Conséquences

- **KLEE-007 est clos sans implémentation.** Il n'est pas abandonné faute de temps : aucune
  des trois règles ne tient la promesse écrite au §7, et deux d'entre elles avaient déjà été
  écartées par ailleurs sans qu'on le remarque.
- La phase 4 se termine sur deux objets livrés — le cockpit (KLEE-005) et la recherche
  transverse (KLEE-006) — plus deux chantiers écartés par décision : la dérive (ADR 0015) et
  les webhooks avec la régression visuelle (celui-ci).
- Cet ADR **amende** `TECHNICAL.md` §7 sans le réécrire, comme l'ADR 0015 : le brief reste
  l'entrée du projet, et la trace de ce qui a été retiré vaut mieux qu'un paragraphe effacé.
- **`ready-for-dev` reste, et n'est plus justifié par ce webhook.** Le statut était présenté
  partout comme « la cible du webhook maquette validée » ; il tient désormais par
  lui-même — c'est le statut qui atteste que les critères d'acceptation sont écrits et que le
  ticket est prenable (`tickets/AGENTS.md`). Sa raison d'être a changé de source, et elle est
  meilleure : elle décrit ce que le statut garantit, au lieu d'annoncer ce qu'il déclencherait.
  Les textes qui citaient le webhook sont corrigés en conséquence.
- Aucune commande n'est retirée : rien n'avait été livré sur le sujet.
