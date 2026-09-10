---
id: DOC-026
related_tickets: [KLEE-017]
related_mockups: []
status: accepted
date: 2026-09-10
---

# 0023 — Changer de starter sans repasser par tout le scaffolding

## Contexte

Avec huit starters au catalogue (ADR 0021), essayer d'en changer sur un projet déjà
scaffoldé n'avait qu'un chemin : `klee init --force --token-starter <id>`. Cette commande
réapplique **tout** le plan de scaffold (mockups, docs, tickets...), pas seulement
`design-system/` — inoffensif sur un dossier jetable, risqué sur un vrai projet où d'autres
fichiers ont pu diverger de leur version scaffoldée.

`design-system/tokens.json` est par ailleurs un fichier que `design-system/AGENTS.md`
autorise explicitement à modifier à la main. L'écraser sans prévenir romprait la même
garantie que l'ADR 0013 protège pour le reste du scaffolding.

## Décisions

### Une commande dédiée, un seul fichier

`klee tokens set-starter <id>` régénère uniquement `design-system/tokens.json` (via
`buildTokens`, la même fonction que le scaffolding initial) et met à jour
`designSystem.tokenStarter` dans `project.config.json`. Rien d'autre dans le projet n'est
touché.

### Écraser un fichier éditable ne se fait jamais en silence

Contrairement aux commandes qui ne font que proposer un défaut modifiable (`askProvider`,
`askTokenStarter`), celle-ci demande une confirmation explicite (`initialValue: false`,
volontairement) avant d'écraser — parce qu'elle détruit potentiellement une édition manuelle
légitime, pas juste une préférence. `--yes` la contourne pour l'usage scriptable ; en son
absence et hors TTY, la commande échoue plutôt que de deviner.

### Le starter courant est toujours affiché avant de demander confirmation

`Actuel` / `Demandé` s'affichent avant toute question — personne ne devrait confirmer un
remplacement sans voir ce qu'il remplace.

## Conséquences

- `buildTokens` et `jsonContents` deviennent publics dans `@klee/core` — jusqu'ici internes
  au scaffolding, ils servaient un seul appelant (`scaffold/modules/mockups.ts`).
- L'autocomplétion (`completion/candidates.ts`) connaît les ids de starters, aux deux
  endroits où ils s'utilisent (`tokens set-starter <id>` et `init --token-starter`).
- Précédent posé pour d'éventuelles futures commandes de "changement ciblé" (changer de
  provider après coup, par exemple) : régénérer un seul module via sa fonction de
  scaffolding, jamais tout le plan, et toujours confirmer avant d'écraser un fichier que
  l'utilisateur a le droit d'éditer.
