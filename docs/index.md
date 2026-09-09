---
title: Documentation
sidebar_label: Accueil
sidebar_position: 0
slug: /
---

# klee

> Everything lives in the codebase.

- **Documentation technique** — `docs/technical/`
- **Décisions (ADR)** — `docs/decisions/`
- **Généré par Klee** — `docs/_generated/`, vue du graphe de traçabilité, réécrite par `klee links report`.

Les identifiants `KLEE-xxx` (ticket), `MOCK-xxx` (maquette) et
`DOC-xxx` (document) sont les arêtes du graphe : `klee links check` vérifie qu'aucune ne
pointe dans le vide.
