---
id: DOC-008
related_tickets: []
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0006 — Les modules déclarent leurs dépendances, ils ne les installent pas

## Contexte

`TECHNICAL.md` §13 pose la règle par la négative : « un module non retenu ne génère aucun
fichier, **aucune dépendance**, aucune section dans le cockpit ». Un module retenu apporte donc
les siennes — mais le brief ne dit pas _comment_.

La question s'est posée concrètement en phase 1 : le module `mockups` a besoin de Style
Dictionary et d'Eleventy. Jusque-là, `klee init` produisait un `package.json` qui référençait
`turbo` dans ses scripts sans jamais le déclarer en dépendance. Le projet généré ne
fonctionnait pas tel quel.

## Décision

Un générateur — module comme provider — peut retourner des **dépendances déclarées**
(`ScaffoldDependency`) en plus de ses fichiers. Le plan les fusionne dans le `package.json`
qu'elles ciblent, avant toute écriture.

**Le scaffolding n'exécute jamais le gestionnaire de paquets de sa propre initiative.**
L'installation est une étape explicite : `klee init --install`, ou la commande que la CLI
affiche à la fin.

Trois raisons, dans cet ordre :

1. **La garantie « tout ou rien » repose sur un plan calculé avant écriture.** Lancer un
   gestionnaire de paquets est un effet de bord hors plan, non réversible, qui peut échouer à
   mi-course — exactement ce que la détection de conflit en amont existe pour éviter.
2. **`--dry-run` doit rester fidèle.** Un dry-run qui télécharge deux cents mégaoctets n'est
   plus un dry-run.
3. **Scaffolder doit rester possible sans réseau** : registre d'entreprise, CI hors ligne,
   agent non supervisé, poste derrière un proxy. Séparer déclaration et installation rend le
   premier temps toujours disponible.

**Corollaire sur le placement.** Chaque dossier possède son `package.json` et ses scripts :
`design-system/package.json` porte Style Dictionary et son script `build`,
`mockups/package.json` porte Eleventy et son script `serve`. Le projet généré possède son
outillage ; `klee tokens build` et `klee mockups serve` ne font que lancer ces scripts avec le
bon répertoire de travail. Un projet Keel reste entièrement utilisable **sans klee installé** —
c'est la différence entre une convention et une dépendance.

**Corollaire sur le gestionnaire de paquets.** Seuls les providers du point `workspace`
déclarent les commandes (`install`, `run`) : ce sont les seuls à savoir si le projet s'installe
avec pnpm ou npm. Keel n'en embarque aucun.

## Conséquences

- Les versions sont **épinglées par le provider**, pas laissées à la résolution : deux
  exécutions de `klee init` à la même version de klee produisent le même `package.json`.
- Une dépendance dont le `package.json` cible n'est pas dans le plan lève une erreur : c'est un
  défaut de conception du provider, pas un cas à ignorer silencieusement.
- Deux providers qui déclarent des versions incompatibles du même paquet échouent, avec les
  deux origines nommées.
- Les entrées du fichier de workspace (`design-system`, `mockups`) sont listées
  **indépendamment des modules retenus** : pnpm comme npm tolèrent une entrée sans dossier, et
  cela supprime la possibilité qu'un `klee module add` laisse un fichier de workspace périmé.
- `klee module add` génère aussi les fichiers des providers rattachés au module ajouté. Sans
  cela, ajouter `mockups` produisait un dossier sans le pipeline qui le fait fonctionner —
  bug réel, découvert en testant la phase 1.

## Précision : le build des tokens n'est pas concerné

`klee init` construit les tokens juste après une installation réussie, et `klee mockups serve`
les construit s'ils manquent. Ce n'est pas une entorse à la décision ci-dessus.

Les trois raisons qui font refuser l'installation implicite — le réseau, la fidélité de
`--dry-run`, l'irréversibilité — ne s'appliquent à aucune d'elles : un build de tokens est
local, déterministe, rapide, et son produit est ignoré par git. Ce qui est refusé, c'est de
solliciter le réseau ou de modifier l'état hors du plan sans qu'on l'ait demandé — pas de
rendre utilisable ce qui vient d'être généré.

L'inverse a un coût réel et constaté : des maquettes servies sans tokens produisent des pages
sans style, et un `404` sur une feuille de style que rien ne relie à un build oublié.
