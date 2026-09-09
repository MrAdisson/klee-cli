---
id: DOC-006
related_tickets: []
related_mockups: []
status: proposed
date: 2026-09-09
---

# 0005 — Ticketing : intégrer Backlog.md, ou système maison ?

> **Statut : proposé.** À trancher au démarrage de la phase 2. Cet ADR consigne l'analyse pour
> que la décision se prenne sur des faits plutôt que sur une impression, et liste les points du
> brief qui méritent d'être rediscutés à ce moment-là.

## Contexte

`TECHNICAL.md` §6 pose l'orientation sans la trancher : « inspiration directe : outils
markdown-natifs existants (type Backlog.md) — ne pas réinventer le format, s'en inspirer
fortement ». Reste à décider ce que « s'en inspirer » veut dire concrètement.

État de Backlog.md au moment de l'analyse (septembre 2026) :

- MIT, TypeScript, runtime Bun (compatible Node), distribué sur npm / Homebrew / Nix.
- Tâches en markdown, préfixe d'ID configurable, critères d'acceptation **en checklists dans
  le corps**, Definition of Done, dépendances, milestones, commentaires attribués.
- Kanban en terminal **et** interface web locale avec drag & drop, édition, synchro temps réel.
- Recherche floue sur tâches, docs **et** décisions.
- Serveur MCP pour Claude Code, Codex, Gemini CLI, Kiro.
- Stockage dans `backlog/`, configuration propre (`backlog.config.yml`), gestion de la
  cohérence cross-branch.
- **CLI uniquement : aucune API librairie documentée.**

C'est un produit mature, sensiblement plus riche que ce que la phase 2 prévoit.

## Le bon critère de décision

Le besoin exprimé est « un système de ticketing intégré et efficace », pas « la parité
fonctionnelle avec Backlog.md ». Cette nuance change la décision. Traduit en contraintes
vérifiables :

1. **Un seul serveur local** (`klee studio`, §9) et **un seul fichier de configuration**
   (`project.config.json`, §13).
2. **Accès programmatique direct** aux tickets — ni sous-processus, ni parsing de sortie
   standard.
3. **Le graphe dans le frontmatter natif** : `related_mockups`, `related_docs`,
   `implemented_in` sont des champs de premier ordre, pas des métadonnées ajoutées après coup.
4. **Aucune étape d'export** pour qu'un agent lise un ticket.

## Options envisagées

**A. Déléguer le ticketing à la CLI Backlog.md.**

**B. Système maison intégral, format compris.**

**C. Système maison adoptant le format de fichier de Backlog.md comme contrat sur disque.**

## Décision proposée : B, avec les partis pris de Backlog.md

### Pourquoi pas A

1. **Pas d'API librairie.** Le cockpit (§9) doit lire les tickets programmatiquement pour
   construire le graphe et la recherche transverse. Un `spawn` + parsing de stdout réintroduit
   exactement l'étape d'export que le projet existe pour supprimer. Contrainte 2 violée.
2. **Double source de configuration** : `backlog.config.yml` face à `project.config.json`.
   Deux configurations peuvent diverger, et divergeront. Contrainte 1 violée.
3. **Le graphe vit dans le frontmatter.** Une CLI tierce qui réécrit ces fichiers n'a aucune
   obligation de préserver des champs qu'elle ne connaît pas. Fonder le différenciant du projet
   sur des données qu'un autre outil peut effacer n'est pas défendable. Contrainte 3 violée.
4. **Surface d'interface en double.** Backlog.md embarque son propre serveur web kanban ; le §9
   exige « une seule commande, une seule app locale » avec deep links entre onglets. Soit deux
   serveurs — ce que le §9 refuse — soit n'utiliser qu'une fraction de ce qu'on a intégré.
5. **Chevauchement de périmètre** : sa recherche couvre déjà tâches, docs et décisions.
   L'adopter, c'est aussi adopter son modèle de documentation.

### Pourquoi pas C non plus

C'était la recommandation initiale de cet ADR ; la relecture de `TECHNICAL.md` §11 l'invalide.

Le brief impose les **critères d'acceptation en Gherkin dans le frontmatter**, quand
Backlog.md les place en checklists dans le corps du document. Le désaccord porte donc
précisément sur le champ que notre brief spécifie le plus finement. S'ajoutent
`related_mockups`, `related_docs`, `implemented_in`, et un statut `ready-for-dev` piloté par un
webhook interne (§7) : leur schéma ne couvre rien de tout cela.

Adopter leur format verbatim reviendrait donc soit à trahir §11, soit à étendre leur schéma au
point qu'il n'est plus le leur — c'est-à-dire à payer le coût de la compatibilité sans en
obtenir le bénéfice.

### Ce que l'on reprend quand même

Les **partis pris**, qui sont bons et éprouvés :

- un fichier markdown par ticket, frontmatter structuré + corps libre ;
- préfixe d'identifiant configurable par projet (déjà acté, ADR 0003) ;
- git comme unique stockage, aucun serveur requis pour que la CLI fonctionne ;
- la CLI et l'interface opèrent sur les mêmes fichiers, sans base de vérité intermédiaire.

L'interopérabilité passe par le **pont d'import/export de la phase 5** (§12, déjà prévu pour
Jira et GitHub Issues), qui est sa vraie place. La licence MIT autorise par ailleurs la reprise
de portions d'implémentation là où elles sont bonnes — notamment sur la cohérence cross-branch.

## Conséquences assumées

**Ce que nous n'aurons pas en fin de phase 2**, alors que Backlog.md l'offre : milestones,
commentaires, templates de Definition of Done, drag & drop, recherche floue, résolution
cross-branch, archivage, intégration éditeur.

**Ce que Backlog.md ne peut structurellement pas offrir** : ticket ↔ maquette ↔ token ↔
composant implémenté, détection de dérive, webhooks internes (maquette `validated` → ticket
`ready-for-dev`), un cockpit unique où les trois onglets partagent le même schéma d'ID. Une
carte de ticket qui affiche sa maquette et le composant qui l'implémente est hors de portée de
leur modèle.

Chercher la parité serait le mauvais objectif : dépenser la phase 2 à rattraper un outil
gratuit sur son terrain, au lieu de construire le liant qui n'existe nulle part ailleurs.

## Points du brief à rediscuter au démarrage de la phase 2

Ces points ne remettent pas en cause la décision ci-dessus ; ils demandent un arbitrage
explicite plutôt qu'une application mécanique.

**1. L'index SQLite comme défaut (§6) semble prématuré.** Quelques milliers de tickets markdown
se parsent en bien moins d'une seconde. L'index apporte en échange une invalidation de cache,
une péremption au changement de branche, un fichier à ignorer et un état qui peut mentir.
Proposition : `markdown-only` par défaut en phase 2, bascule du défaut vers SQLite quand un
corpus réel le justifie — le pattern provider existe pour rendre ce basculement indolore.

**2. Le Gherkin dans le frontmatter (§11) atteint son objectif par un chemin coûteux.**
L'objectif réel est l'exécutabilité, donc l'extraction mécanique. Un bloc ` ```gherkin ` dans le
corps, sous un titre stable, est tout aussi extractible et nettement plus agréable à écrire, à
relire et à éditer dans un formulaire. À arbitrer explicitement.

**3. « Utilisable sans jamais toucher un terminal » (DESIGN.md §5) cache la vraie difficulté.**
Un dashboard qui _écrit_ des tickets doit gérer la concurrence au niveau git : deux cartes
déplacées en parallèle, un changement de branche, un rebase. Cadrage réaliste pour la phase 2 :
lecture et changement de statut, mono-utilisateur local, fichier comme seule vérité, watcher
pour la fraîcheur. L'édition concurrente relève de la phase 4.

**4. L'allocation des identifiants n'est couverte nulle part.** Deux agents qui créent un ticket
en parallèle prennent tous les deux `KEEL-042` ; sur des branches distinctes, git ne signalera
même pas de conflit. Une stratégie doit être décidée en phase 2 (scan `max+1`, réservation,
suffixe de branche…). C'est le point où étudier la solution cross-branch de Backlog.md
rapportera le plus.

## Risque principal à surveiller

Si l'écart fonctionnel devient le motif de non-adoption par les équipes, l'analyse est à
refaire — mais la bonne réponse serait alors probablement de contribuer une API librairie à
Backlog.md, pas de le réimplémenter.
