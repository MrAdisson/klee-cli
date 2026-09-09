---
id: DOC-003
related_tickets: []
related_mockups: []
status: accepted
date: 2026-09-08
---

# 0003 — Schéma d'identifiants partagé

## Contexte

Le différenciant de Klee est le graphe qui relie un commit à un ticket, un ticket à une
maquette, une maquette au composant qui l'implémente. Ce graphe n'existe que si les
identifiants sont reconnaissables mécaniquement, dans du markdown, du YAML, du HTML et des
messages de commit — c'est-à-dire dans des formats qui n'ont aucune notion de référence.

## Décision

Un identifiant est `<PREFIX>-<numéro>`, avec trois natures d'entité :

| Nature               | Préfixe                       | Exemple              |
| -------------------- | ----------------------------- | -------------------- |
| Ticket               | propre au projet (`idPrefix`) | `KLEE-123`, `ACME-7` |
| Maquette / composant | `MOCK` (fixe)                 | `MOCK-042`           |
| Document             | `DOC` (fixe)                  | `DOC-018`            |

- Le préfixe respecte `^[A-Z][A-Z0-9]{1,9}$`, le numéro fait 1 à 6 chiffres, complété à trois
  chiffres à la génération (`MOCK-042`).
- **`MOCK` et `DOC` sont fixes** et ne sont pas configurables : ce sont des natures d'entité du
  modèle, pas des noms de projet.
- **Le préfixe de tickets est propre au projet.** C'est la seule concession, et elle est
  délibérée : il porte le nom de l'équipe ou du produit, et doit pouvoir coïncider avec une clé
  Jira existante lors d'une migration progressive (`TECHNICAL.md` §12). Un projet qui
  importerait ses tickets depuis Jira sans pouvoir conserver ses clés perdrait l'historique de
  toutes ses références.

Corollaire assumé : `ACME-7` n'est un identifiant que dans un projet dont `idPrefix` vaut
`ACME`. Ailleurs, ce n'est pas un identifiant inconnu, c'est du texte. `parseId` et
`extractIds` prennent donc le préfixe du projet en paramètre.

## Conséquences

- L'extraction d'identifiants dans du texte libre (`extractIds`) devient fiable : elle
  n'attrape ni `HTTP-404`, ni un nom de branche, ni un numéro de version.
- Les liens croisés cliquables du cockpit (phase 4, `DESIGN.md` §5) reposent sur cette seule
  fonction : partout où un identifiant apparaît, il devient un lien, sans annotation manuelle.
- Le schéma n'est pas un point de provider : il ne varie pas d'un projet à l'autre. Le faire
  varier reviendrait à rendre le graphe illisible d'un projet à l'autre — exactement ce que le
  projet cherche à éviter.
