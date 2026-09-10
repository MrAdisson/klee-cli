---
id: KLEE-012
title: Rendre klee publiable sur npm
status: done
assignee: null
created: 2026-09-09
updated: 2026-09-10
depends_on: []
related_mockups: []
related_docs: []
authored_by: agent
---

Klee ne peut pas être installé par quelqu'un d'autre : les deux paquets sont `private: true`,
sans licence, sans `files`, sans `engines`. Ce ticket est le lot qui rend l'installation
possible — délibérément séparé du reste, parce que publier n'est pas un effet de bord du
polish.

## Ce qui bloque aujourd'hui

| Constat (vérifié le 2026-09-09)                                 | Où                                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| `private: true`                                                 | `apps/cli/package.json`, `apps/packages/core/package.json` |
| Aucune licence déclarée, aucun fichier `LICENSE`                | les deux paquets, et la racine                             |
| Aucun `files` : le paquet embarquerait les sources et les tests | les deux paquets                                           |
| Aucun `engines` sur les paquets publiés                         | la racine en déclare, eux non                              |
| `@klee/core` est en `workspace:*`                               | dépendance de `@klee/cli`                                  |

Deux bonnes nouvelles : `dist/` ne contient **aucun fichier non-JS**, tout le scaffolding
étant inline dans le code — il n'y a donc pas de gabarit à embarquer ni à oublier. Et la
CLI ne dépend que de trois paquets publics, plus `@klee/core`.

## À trancher avant de commencer

Ce ticket reste en `backlog` tant que ces deux points ne sont pas décidés : sans eux, on ne
sait pas le finir.

**1. Le nom.** `klee` est **déjà pris sur npm** — version 0.0.3, publiée en 2022, et ce paquet
installe lui aussi un binaire nommé `klee`. Le scope `@klee` semblait libre au 2026-09-09,
mais un 404 sur un paquet ne prouve pas que l'organisation l'est ; à reconfirmer.

À savoir pour décider : **le nom du paquet npm n'est pas le nom de la commande.** Un paquet
`@quelquechose/klee` peut parfaitement installer un binaire `klee`. L'ADR 0009 (« un seul nom :
Klee, projet comme commande ») porte sur la commande, et reste donc tenable sous un scope. Si
le choix retenu s'en écarte, il mérite un ADR qui supersède le 0009.

**2. Le sort de `@klee/core`.** Publier deux paquets, ou n'en publier qu'un ?

Ma recommandation : **un seul paquet**, `core` étant empaqueté avec la CLI plutôt que publié
à part. Publier `@klee/core`, c'est promettre une API publique à des tiers alors que le
domaine doit encore bouger librement. La séparation domaine/interface est une discipline
interne (elle a servi au studio, au gate, à la recherche) ; ce n'est pas un engagement de
compatibilité. Le coût : un bundler à ajouter au build, là où publier les deux ne coûte rien
aujourd'hui mais engage pour la suite.

## Hors périmètre

La complétion ne fonctionne pas derrière `npx klee` : le shell complète `npx`, pas `klee`.
Ça ne se contourne pas, ça se documente — et c'est déjà fait dans `docs/technical/cli-klee.md`.

## Critères d'acceptation

```gherkin
Scénario: le paquet s'installe depuis une archive, hors du dépôt
  Étant donné une archive produite par npm pack
  Quand on l'installe globalement dans un environnement vierge
  Alors la commande klee répond à klee --version
  Et klee init --yes scaffolde un projet complet

Scénario: le paquet n'embarque que ce qui sert à l'exécuter
  Étant donné l'archive publiable
  Quand on liste son contenu
  Alors elle contient dist/, le README et la licence
  Et elle ne contient ni sources TypeScript, ni tests, ni configuration de build

Scénario: la licence est déclarée et présente
  Étant donné les paquets publiés
  Quand on lit leur manifeste
  Alors chacun déclare un champ license
  Et le fichier LICENSE correspondant est présent dans l'archive

Scénario: la version de Node exigée est annoncée
  Étant donné un environnement dont la version de Node est inférieure à celle attendue
  Quand on installe le paquet
  Alors le gestionnaire de paquets le refuse ou l'annonce, plutôt que d'échouer à l'exécution

Scénario: aucune dépendance de workspace ne fuit dans le paquet publié
  Étant donné le manifeste du paquet publiable
  Quand on lit ses dépendances
  Alors aucune ne porte la portée workspace:

Scénario: publier reste une décision explicite
  Étant donné le dépôt
  Quand une intégration continue s'exécute
  Alors rien n'est publié sans une action délibérée
```
