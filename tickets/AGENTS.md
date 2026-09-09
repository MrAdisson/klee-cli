# AGENTS.md — tickets/

> Ticketing in-repo de keel. Un ticket = un fichier markdown versionné, préfixe `KEEL-`.

## État actuel

Le **format de fichier et la CLI de gestion (`klee ticket create|list|move`) sont livrés en
phase 2** de la roadmap (`TECHNICAL.md`). Ce dossier est en place et déclaré dans
`project.config.json`, mais la convention de frontmatter n'est pas encore figée.

Ne pas inventer ce format en avance : il sera partagé par tous les projets Keel, et un format
posé à la hâte ici deviendrait la contrainte de tout le monde. La décision se prendra en
phase 2, avec un ADR.

## Conventions prévues (cf `TECHNICAL.md` §6 et §11)

- Un fichier par ticket, nommé d'après son identifiant : `KEEL-001-titre-court.md`.
- Frontmatter structuré : `id`, `title`, `status`, `assignee`, `depends_on`,
  `related_mockups`, `related_docs`.
- Critères d'acceptation en Gherkin **dans le frontmatter**, pas en prose libre : ils doivent
  rester exécutables.
- `depends_on` porte un vrai graphe de dépendances, pas seulement un statut — c'est ce qui
  permet à un agent de savoir s'il risque une collision avec un autre agent.

## Périmètre d'édition pour un agent

**Autorisé**

- Créer un ticket, mettre à jour son statut, compléter ses critères d'acceptation
  (une fois le format arrêté en phase 2).

**Interdit**

- Figer le format de frontmatter avant la phase 2 et son ADR.
- Supprimer un ticket : le clore, pour préserver l'historique de décision.
- Écrire une donnée personnelle ou un secret dans un ticket.

## Références

- `AGENTS.md` (racine) — schéma d'identifiants.
- `TECHNICAL.md` §6 — ticketing.
