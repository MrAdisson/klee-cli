---
id: DOC-002
related_tickets: []
related_mockups: []
status: accepted
date: 2026-09-08
---

# 0002 — Deux axes de configuration : modules et providers

## Contexte

Tous les projets n'ont pas besoin de tout Keel. Un service headless n'a pas de maquettes ; une
librairie interne n'expose pas de contrat d'API. Et parmi les choix techniques qui restent,
certains n'ont pas de gagnant évident : Docusaurus ou VitePress, Style Dictionary ou Terrazzo.

Le risque, en mélangeant ces deux questions, est de produire une CLI qui pose vingt questions
sans que l'utilisateur sache lesquelles engagent la structure du projet et lesquelles sont
réversibles.

## Décision

Deux axes explicitement distincts, tels que définis par `TECHNICAL.md` §13.

**Axe 1 — présence d'un module.** Un booléen par module dans `project.config.json`. Un module
non retenu ne génère **aucun** fichier, aucune dépendance, aucune section de cockpit. Les
modules du socle (`apps`, `tickets`, `docs-technical`, `docs-decisions`) ne sont jamais
optionnels : ce sont eux qui portent le graphe de traçabilité.

**Axe 2 — provider d'un module retenu.** Chaque point configurable est un `Provider`
implémentant une interface commune, résolu par une factory (`ProviderRegistry`) à partir de la
configuration. Un point n'est proposé que si le module dont il dépend est retenu.

Trois règles d'arbitrage en découlent :

1. Un point ne mérite le traitement « provider » que s'il existe **au moins deux** solutions
   réellement solides. Un point à une seule option est une convention déguisée en
   configuration — un test le vérifie mécaniquement (`registry.test.ts`).
2. Un module ne mérite le traitement « optionnel » que si des projets légitimes n'en ont
   simplement pas l'usage.
3. Pour tout le reste — schéma d'identifiants, format de frontmatter, topologie du dépôt — une
   seule convention est imposée. La cohérence transverse prime sur la flexibilité : ces
   points-là structurent le graphe et ne peuvent pas varier d'un projet à l'autre sans casser
   le liant.

`design-system/` échappe à l'axe 1 en tant que question : il suit exactement la condition de
`mockups/`. Un projet sans interface n'a besoin ni de l'un ni de l'autre, et poser deux fois
la même question ne produit que des configurations incohérentes.

## Conséquences

- Ajouter un provider consiste à écrire son fichier et à l'enregistrer dans
  `providers/index.ts`. Rien d'autre dans la base de code ne change. Si un ajout de provider
  oblige à toucher ailleurs, c'est un défaut de conception à corriger, pas à contourner.
- Un provider dont la génération de fichiers n'est pas encore implémentée est déclaré via
  `declarativeProvider` : le choix est enregistré dès `klee init`, la génération arrive à sa
  phase. Ce n'est pas un bouche-trou — le choix doit être posé tôt parce que les `AGENTS.md`
  générés le citent.
- `project.config.json` reste éditable à la main ; `validateProjectConfig` refuse toute
  configuration incohérente (module socle désactivé, provider inexistant, `designSystem` sans
  `mockups`).
- Le coût : deux notions à comprendre plutôt qu'une. Il est compensé par la lisibilité de la
  question posée à l'utilisateur — « ce module me sert-il ? » n'est pas « quel outil ? ».
