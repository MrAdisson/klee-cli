---
title: Traçabilité
sidebar_label: Traçabilité
---

# Traçabilité

> Page générée par `klee links report`. Ne pas l'éditer : elle est réécrite à chaque
> exécution, et la source de vérité reste les fichiers de `tickets/`, `docs/` et
> `mockups/`.

## Tickets

| Identifiant | Titre | Statut | Liens | Fichier |
| --- | --- | --- | --- | --- |
| KLEE-001 | Brancher le schéma d'identifiants sur du contenu réel | done | DOC-012, DOC-014, MOCK-001, MOCK-002 | `tickets/KLEE-001-brancher-le-schema-d-identifiants-sur-du-contenu-reel.md` |
| KLEE-002 | Servir docs/ par le provider docs-as-code retenu | done | DOC-013, KLEE-003 | `tickets/KLEE-002-servir-docs-par-le-provider-docs-as-code-retenu.md` |
| KLEE-003 | Ouvrir une sortie au site de documentation pour les projets légers | done | DOC-013, DOC-015, KLEE-002 | `tickets/KLEE-003-ouvrir-une-sortie-au-site-de-documentation-pour-les-projets.md` |
| KLEE-004 | Le scaffolding n'écrase plus les fichiers de racine rédigés | done | DOC-016 | `tickets/KLEE-004-le-scaffolding-n-ecrase-plus-les-fichiers-de-racine-rediges.md` |
| KLEE-005 | Cockpit klee studio : une app unique par-dessus des serveurs indépendants | in-review | DOC-017, DOC-019 | `tickets/KLEE-005-cockpit-klee-studio-une-app-unique-par-dessus-des-serveurs-i.md` |
| KLEE-006 | Recherche transverse sur tickets, docs et maquettes | backlog | DOC-017 | `tickets/KLEE-006-recherche-transverse-sur-tickets-docs-et-maquettes.md` |
| KLEE-007 | Webhooks internes : réactions locales aux transitions | backlog | — | `tickets/KLEE-007-webhooks-internes-reactions-locales-aux-transitions.md` |

## Maquettes

| Identifiant | Titre | Statut | Liens | Fichier |
| --- | --- | --- | --- | --- |
| MOCK-001 | Bouton | draft | KLEE-001 | `mockups/components/button/button.meta.yml` |
| MOCK-002 | Connexion | draft | KLEE-001 | `mockups/pages/login.meta.yml` |

## Documents

| Identifiant | Titre | Statut | Liens | Fichier |
| --- | --- | --- | --- | --- |
| DOC-001 | 0001 — Topologie du dépôt : monorepo unique | — | — | `docs/decisions/0001-repo-topology.md` |
| DOC-002 | 0002 — Deux axes de configuration : modules et providers | — | — | `docs/decisions/0002-modules-et-providers.md` |
| DOC-003 | 0003 — Schéma d'identifiants partagé | — | — | `docs/decisions/0003-schema-identifiants.md` |
| DOC-004 | 0004 — Outillage du dépôt klee | — | — | `docs/decisions/0004-toolchain.md` |
| DOC-005 | Référence de la CLI klee | — | — | `docs/technical/cli-klee.md` |
| DOC-006 | 0005 — Ticketing : intégrer Backlog.md, ou système maison ? | — | — | `docs/decisions/0005-ticketing-backlog-md.md` |
| DOC-007 | `project.config.json` — schéma de configuration | — | — | `docs/technical/project-config.md` |
| DOC-008 | 0006 — Les modules déclarent leurs dépendances, ils ne les installent pas | — | — | `docs/decisions/0006-declaration-des-dependances.md` |
| DOC-009 | 0007 — Nunjucks comme langage de template des maquettes | — | — | `docs/decisions/0007-langage-de-template-des-maquettes.md` |
| DOC-010 | 0008 — Format des tickets | — | — | `docs/decisions/0008-format-des-tickets.md` |
| DOC-011 | 0009 — Le projet s'appelle Klee, comme sa commande | — | — | `docs/decisions/0009-nom-du-projet.md` |
| DOC-012 | 0010 — Le graphe de traçabilité : arêtes, mentions, vérification | — | KLEE-001 | `docs/decisions/0010-graphe-de-tracabilite.md` |
| DOC-013 | 0011 — Site docs-as-code : Docusaurus, en une seule instance | — | KLEE-002, KLEE-003 | `docs/decisions/0011-site-docs-as-code.md` |
| DOC-014 | Graphe de traçabilité | — | KLEE-001 | `docs/technical/graphe-de-tracabilite.md` |
| DOC-015 | 0012 — Ce qu'un preset propose, ce qu'un provider déclare | — | KLEE-003 | `docs/decisions/0012-ce-quun-preset-propose-et-un-provider-declare.md` |
| DOC-016 | 0013 — Le scaffolding n'écrase pas ce qui a été rédigé | — | KLEE-004 | `docs/decisions/0013-le-scaffolding-n-ecrase-pas-le-contenu-redige.md` |
| DOC-017 | 0014 — Le studio agrège des serveurs, il ne les remplace pas | — | KLEE-005, KLEE-006 | `docs/decisions/0014-architecture-du-cockpit-studio.md` |
| DOC-018 | 0015 — La détection de dérive maquette / composant sort du périmètre | — | — | `docs/decisions/0015-detection-de-derive-hors-scope.md` |
| DOC-019 | 0016 — Le studio encadre les serveurs plutôt que de les proxifier | — | KLEE-005 | `docs/decisions/0016-le-studio-encadre-plutot-que-de-proxifier.md` |
| DOC-020 | 0017 — Le premier ticket d'un projet est un compte rendu, pas une tâche | — | — | `docs/decisions/0017-le-premier-ticket-est-un-compte-rendu.md` |


## Sans lien déclaré

- KLEE-007 — Webhooks internes : réactions locales aux transitions
- DOC-001 — 0001 — Topologie du dépôt : monorepo unique
- DOC-002 — 0002 — Deux axes de configuration : modules et providers
- DOC-003 — 0003 — Schéma d'identifiants partagé
- DOC-004 — 0004 — Outillage du dépôt klee
- DOC-005 — Référence de la CLI klee
- DOC-006 — 0005 — Ticketing : intégrer Backlog.md, ou système maison ?
- DOC-007 — `project.config.json` — schéma de configuration
- DOC-008 — 0006 — Les modules déclarent leurs dépendances, ils ne les installent pas
- DOC-009 — 0007 — Nunjucks comme langage de template des maquettes
- DOC-010 — 0008 — Format des tickets
- DOC-011 — 0009 — Le projet s'appelle Klee, comme sa commande
- DOC-018 — 0015 — La détection de dérive maquette / composant sort du périmètre
- DOC-020 — 0017 — Le premier ticket d'un projet est un compte rendu, pas une tâche
