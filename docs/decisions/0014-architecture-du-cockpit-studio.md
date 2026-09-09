---
id: DOC-017
related_tickets: [KLEE-005, KLEE-006]
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0014 — Le studio agrège des serveurs, il ne les remplace pas

## Contexte

`TECHNICAL.md` §9 demande pour la phase 4 « **une seule commande, une seule app locale**,
plutôt que trois serveurs séparés », avec quatre entrées : Board, Docs, Mockups et une
recherche transverse.

Or les trois serveurs existants ne sont pas trois implémentations d'une même chose :

| Serveur              | Nature                       | Ce qu'il apporte                            |
| -------------------- | ---------------------------- | ------------------------------------------- |
| `klee board`         | serveur HTTP écrit à la main | rendu des tickets, mutations POST           |
| `klee docs serve`    | Docusaurus                   | rechargement à chaud, MDX, recherche, thème |
| `klee mockups serve` | Eleventy                     | includes Nunjucks, watch, composition       |

Les fusionner en un seul processus voudrait dire réimplémenter le dev-server de Docusaurus et
celui d'Eleventy. Ce serait détruire les phases 1 et 3 pour satisfaire la lettre d'une phrase.

À l'inverse, il existe des raisons légitimes de vouloir un serveur **seul** : publier la
documentation d'une bibliothèque sans embarquer un cockpit, servir les maquettes à un designer,
construire les docs en CI. Un studio qui serait le seul chemin d'accès rendrait ces cas plus
difficiles qu'aujourd'hui.

## Décisions

### Le studio est un agrégateur, pas un remplaçant

`klee studio` démarre un serveur propre qui **monte** les autres derrière une origine unique,
chacun gardant son processus et son rechargement à chaud. L'utilisateur voit une application ;
l'implémentation reste trois serveurs, plus une coquille qui les relie.

C'est un écart assumé à la lettre du §9 — il y aura bien plusieurs processus. Son intention y
survit intégralement : ce que §9 refuse, c'est que l'utilisateur ait à connaître trois ports,
trois commandes et trois onglets sans passerelle entre eux. Un seul point d'entrée y répond.

### Les commandes individuelles restent de premier rang

`klee board`, `klee docs serve` et `klee mockups serve` **ne sont pas dépréciés** et ne
deviennent pas des détails d'implémentation du studio. Chacun reste documenté, utilisable et
testé seul.

Cette contrainte est structurante et vaut d'être écrite, parce que la pente naturelle d'un
cockpit est de devenir obligatoire : le jour où le board ne s'ouvrirait plus qu'à travers le
studio, un projet qui n'a que des tickets paierait le coût de Docusaurus et d'Eleventy pour
les afficher. C'est exactement ce que l'ADR 0012 a corrigé sur le point `docs`, et la même
erreur se rejouerait ici.

### Un onglet n'existe que si son module est retenu

`TECHNICAL.md` §13 : « un module non retenu ne génère aucun fichier, aucune dépendance, aucune
section dans le cockpit ». Un projet sans `mockups` n'a pas d'onglet Mockups — pas un onglet
vide, pas un onglet grisé. Le studio lit `project.config.json` comme le reste de la CLI.

### Le studio ne détient aucun état

Comme le board (`apps/cli/src/board/`), il n'a ni base, ni session, ni cache d'écriture : les
fichiers markdown restent la source de vérité, et deux onglets ouverts voient la même chose.
Il écoute sur la boucle locale, sans authentification — c'est un outil de poste de travail.

### Le domaine reste ignorant de l'interface

`@klee/core` ne connaît pas le studio, comme il ne connaît pas le terminal. Ce que le studio
consomme — le graphe, les tickets, la configuration — existe déjà et n'a pas à être adapté
pour lui. Si l'écriture du studio oblige à modifier le domaine, c'est un signal à instruire,
pas une adaptation à faire.

## Conséquences

- La question du transport reste ouverte, et sera tranchée à l'implémentation : reverse-proxy
  HTTP vers les serveurs enfants, ou iframes par onglet. Le premier donne une origine unique
  et de vrais deep links ; le second est plus simple mais isole mal la navigation. Rien dans
  cet ADR ne dépend du choix.
- `klee studio` doit savoir démarrer et arrêter les processus enfants proprement, y compris
  quand un module est absent — un serveur de maquettes qu'on ne lance pas est le cas normal,
  pas une erreur.
- Les pièges déjà connus de `.agents/AGENTS.md` s'appliquent en plus grand : Eleventy et
  Docusaurus glissent **silencieusement** sur le port suivant quand le leur est pris. Un
  studio qui suppose les ports au lieu de les lire relira un serveur précédent en croyant
  tester le sien.
- La recherche transverse (KLEE-006) est la seule fonction qui n'appartient à aucun des trois
  serveurs : elle est propre au studio, et s'appuie sur le graphe de traçabilité (ADR 0010).
- `DESIGN.md` §5 et §6 s'appliquent au studio comme à un produit : utilisable sans terminal,
  identifiants cliquables partout, WCAG 2.1 AA. Ce n'est pas un outil interne négligeable.
