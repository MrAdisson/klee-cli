---
id: DOC-001
related_tickets: []
related_mockups: []
status: accepted
date: 2026-09-08
---

# 0001 — Topologie du dépôt : monorepo unique

## Contexte

Keel relie des artefacts de natures très différentes — code applicatif, maquettes,
documentation, tickets, contrats d'API — qui se référencent mutuellement par identifiant
(`KEEL-123` → `MOCK-042` → `apps/web/.../Button.tsx`). La valeur du dispositif tient
entièrement à ce que ces références restent résolvables.

Deux topologies étaient envisageables : un dépôt par domaine (code / design / docs), ou un
dépôt unique.

Le dépôt par domaine a un attrait réel : des droits d'accès plus fins, des historiques plus
courts, des équipes qui ne se marchent pas dessus. Mais il fait payer chaque lien croisé au
prix d'une synchronisation.

## Décision

**Un seul historique git pour tout le projet** : `apps/`, `design-system/`, `mockups/`,
`docs/`, `tickets/`, `contracts/`.

L'ownership par équipe se gère **par chemin** (fichier type `CODEOWNERS`), jamais par dépôt
séparé.

Cette décision vaut pour keel lui-même comme pour tout projet que `klee init` génère : elle
est reproduite dans l'ADR 0001 de chaque projet scaffoldé.

## Conséquences

- Un changement transverse — un token qui bouge, la maquette qui s'ajuste, le ticket qui suit —
  tient dans un seul commit atomique et une seule revue.
- Un agent dispose du contexte complet sans cloner ni synchroniser plusieurs dépôts. C'est la
  condition pratique du principe « everything lives in the codebase ».
- Les liens croisés par identifiant sont vérifiables mécaniquement (phase 4, détection de
  dérive), puisque les deux extrémités du lien sont toujours dans l'arbre de travail.
- En contrepartie : le dépôt grossit, et les droits d'accès sont moins cloisonnés. C'est
  précisément pourquoi chaque dossier déclare son périmètre d'édition dans son `AGENTS.md`
  (`TECHNICAL.md` §10) et pourquoi aucun secret ne vit dans le dépôt.
- Le jour où un domaine devra réellement être isolé (contrainte réglementaire, ouverture
  publique partielle), l'extraction restera possible via `git filter-repo` — au prix de la
  perte des liens croisés vers ce domaine. Ce coût est assumé, pas ignoré.
