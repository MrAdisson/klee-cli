# AGENTS.md — tickets/

> Ticketing in-repo de klee. Un ticket = un fichier markdown versionné, préfixe `KLEE-`.

Le format est arrêté depuis la phase 2 et documenté dans
[`docs/decisions/0008-format-des-tickets.md`](../docs/decisions/0008-format-des-tickets.md).
Il est partagé par tous les projets Klee : le modifier ici change la convention de tout le monde.

## Format

```markdown
---
id: KLEE-001
title: Titre court et actionnable
status: backlog
assignee: null
created: 2026-09-09
updated: 2026-09-09
depends_on: []
related_mockups: []
related_docs: []
authored_by: human
---

Description libre.

## Critères d'acceptation

\`\`\`gherkin
Scénario: ...
\`\`\`
```

## Conventions

- **Dossier plat.** Le statut vit dans le frontmatter, jamais dans l'arborescence : déplacer
  un ticket ne doit pas produire un renommage git.
- **Statuts imposés** : `backlog` → `ready-for-dev` → `in-progress` → `in-review` → `done`.
  `ready-for-dev` est la cible du webhook « maquette validée » de la phase 4 — ce n'est pas
  une étiquette décorative.
- **Critères d'acceptation en Gherkin**, dans un bloc de code du corps. Un ticket peut n'en
  avoir aucun : tous ne s'y prêtent pas, et en exiger produirait des scénarios de façade.
- **`depends_on` est un vrai graphe**, pas un statut déguisé : c'est ce qui permet à un agent
  de savoir s'il risque une collision avec un autre agent.
- **`authored_by: agent`** pour un ticket produit par un agent (`klee ticket create --agent`).
- **Un lien déclaré d'un seul côté suffit** : une maquette qui déclare `related_tickets`
  apparaît dans le voisinage du ticket sans que celui-ci la mentionne (ADR 0010). Rien à
  synchroniser entre les deux frontmatters.
- Le fichier reste la source de vérité : l'éditer à la main est légitime, et l'index s'en
  aperçoit.

## Quand faire transiter un ticket

Les statuts décrivent un cycle, mais un cycle ne dit pas **à quel moment** on avance dedans.
Sans ce point-là, un agent implémente une fonctionnalité, la vérifie, rend la main — et laisse
le ticket là où il l'a trouvé. Le code avance, le board ment.

Chaque transition est donc adossée à un fait vérifiable, jamais à une intention :

| Transition                      | Le fait qui l'autorise                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backlog` → `ready-for-dev`     | Les critères d'acceptation sont écrits. Un `Scénario: à écrire` n'en est pas un : le ticket n'est pas prenable tant qu'on ne sait pas le finir.     |
| `ready-for-dev` → `in-progress` | **Avant** la première ligne de code, pas après. C'est le seul signal qui permet à un autre agent de voir la collision venir plutôt que de la subir. |
| `in-progress` → `in-review`     | Le code est écrit, `pnpm run verify` et `klee links check` passent. C'est l'état dans lequel un agent rend la main.                                 |
| `in-review` → `done`            | **Un humain a revu.** Un agent ne pose jamais `done` lui-même : à ce stade la seule information qui compte est celle qu'il n'a pas.                 |

Corollaire : `in-review` n'est pas un statut d'attente à rattraper. C'est la fin normale du
travail d'un agent sur un ticket, et un ticket qui y séjourne ne signale aucun oubli.

## Périmètre d'édition pour un agent

**Autorisé**

- Créer un ticket, le faire transiter selon le tableau ci-dessus, compléter ses critères
  d'acceptation.
- Éditer un ticket à la main.
- Ajouter un lien vers une maquette ou une doc **existante**.

**Interdit**

- Poser `done` : ce statut atteste d'une revue humaine, qu'un agent ne peut pas constater.
- Modifier `id` après création : c'est l'arête sur laquelle tout le reste pointe.
- Supprimer un ticket : un ticket abandonné se porte en revue avec la raison, et c'est la revue
  qui le clôt — l'historique de décision se perd autrement.
- Écrire une donnée personnelle ou un secret dans un ticket.
- Inventer un lien vers une maquette ou une doc qui n'existe pas — `klee links check` le
  refuse désormais mécaniquement, avec un code de sortie non nul.

## Outils

```bash
klee ticket create "Titre"   # --status --assignee --depends-on --mockup --doc --agent
klee ticket list             # --status --assignee --json
klee ticket move KLEE-001 in-progress
klee ticket show KLEE-001    # affiche aussi ce qui pointe vers le ticket
klee board                   # kanban local, sans terminal ; chaque identifiant est cliquable
klee links show KLEE-001     # voisinage dans le graphe
klee links check             # aucun lien cassé — à passer avant de rendre la main
```

## Références

- `AGENTS.md` (racine) — schéma d'identifiants.
- `docs/technical/cli-klee.md` — référence complète de la CLI.
- `docs/technical/graphe-de-tracabilite.md` — arêtes, mentions, vérification.
