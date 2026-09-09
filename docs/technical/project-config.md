---
id: DOC-007
related_tickets: []
related_mockups: []
---

# `project.config.json` — schéma de configuration

Fichier racine de tout projet Keel. Il porte les deux axes de configuration décrits par
`TECHNICAL.md` §13 et l'ADR [0002](../decisions/0002-modules-et-providers.md) : quels modules
sont présents, et quelle implémentation est retenue pour chaque point configurable.

Il est éditable à la main. Toute lecture le valide : une configuration incohérente échoue à
l'ouverture plutôt que de produire un scaffolding surprenant.

## Exemple complet

```json
{
  "version": 1,
  "name": "mon-projet",
  "idPrefix": "PROJ",
  "modules": {
    "apps": true,
    "tickets": true,
    "docs-technical": true,
    "docs-decisions": true,
    "mockups": true,
    "contracts": false,
    "docs-product": true,
    "docs-i18n-copy": false
  },
  "providers": {
    "workspace": "pnpm-turborepo",
    "docs": "docusaurus",
    "contracts": "openapi",
    "tickets-index": "markdown-sqlite",
    "mockups-composition": "eleventy",
    "visual-regression": "playwright",
    "tokens-pipeline": "style-dictionary"
  },
  "designSystem": {
    "targets": ["css"]
  }
}
```

## Champs

| Champ                  | Type              | Règle                                                                                                                      |
| ---------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `version`              | `1`               | Version du schéma.                                                                                                         |
| `name`                 | string            | Doit être utilisable tel quel comme nom de package npm : `^[a-z0-9][a-z0-9._-]{0,213}$`.                                   |
| `idPrefix`             | string            | Préfixe des identifiants de tickets : `^[A-Z][A-Z0-9]{1,9}$`. Voir l'ADR [0003](../decisions/0003-schema-identifiants.md). |
| `modules`              | objet de booléens | Une clé par module, toutes obligatoires.                                                                                   |
| `providers`            | objet de chaînes  | Une clé par point configurable, toutes obligatoires.                                                                       |
| `designSystem.targets` | tableau           | `css` \| `js` \| `tailwind`, au moins un.                                                                                  |

Le fichier est en mode strict : une clé inconnue est une erreur, pas un champ ignoré.

## Modules

| Clé              | Nature    | Chemins générés              |
| ---------------- | --------- | ---------------------------- |
| `apps`           | socle     | `apps/`                      |
| `tickets`        | socle     | `tickets/`                   |
| `docs-technical` | socle     | `docs/technical/`            |
| `docs-decisions` | socle     | `docs/decisions/`            |
| `mockups`        | optionnel | `mockups/`, `design-system/` |
| `contracts`      | optionnel | `contracts/`                 |
| `docs-product`   | optionnel | `docs/product/`              |
| `docs-i18n-copy` | optionnel | `docs/i18n-copy/`            |

Un module à `false` ne génère aucun fichier, aucune dépendance, aucune section de cockpit.

## Providers

| Point                 | Dépend du module | Valeurs                                | Défaut             | Génération |
| --------------------- | ---------------- | -------------------------------------- | ------------------ | ---------- |
| `workspace`           | `apps`           | `pnpm-turborepo`, `nx`                 | `pnpm-turborepo`   | ✅ livré   |
| `docs`                | — (socle)        | `docusaurus`, `vitepress`, `starlight` | `docusaurus`       | phase 3    |
| `contracts`           | `contracts`      | `openapi`, `graphql`, `protobuf`       | `openapi`          | phase 3    |
| `tickets-index`       | `tickets`        | `markdown-sqlite`, `markdown-only`     | `markdown-sqlite`  | phase 2    |
| `mockups-composition` | `mockups`        | `eleventy`, `web-components`           | `eleventy`         | ✅ livré   |
| `visual-regression`   | `mockups`        | `playwright`, `backstopjs`, `percy`    | `playwright`       | phase 1    |
| `tokens-pipeline`     | `mockups`        | `style-dictionary`, `terrazzo`         | `style-dictionary` | ✅ livré   |

La colonne « génération » indique la phase à laquelle le provider produit réellement des
fichiers. Avant cette phase, le choix est enregistré et cité dans les `AGENTS.md` générés, mais
ne produit rien : c'est délibéré (ADR 0002).

Les valeurs sont toujours renseignées pour **tous** les points, même ceux dont le module est
absent : la configuration reste complète et cohérente si le module est ajouté plus tard par
`klee module add`.

## Invariants vérifiés à chaque lecture

1. Tous les modules du socle sont à `true`.
2. Chaque provider référencé existe dans le registre.
3. `designSystem` est présent **si et seulement si** `modules.mockups` est `true` —
   `design-system/` suit exactement la condition de `mockups/` (`TECHNICAL.md` §3).
4. `designSystem.targets` contient `css`, socle universel qui fonctionne avec n'importe quel
   stack et ne peut pas être retiré.

Une violation lève une erreur `CONFIG_INVALID` listant tous les problèmes d'un coup, pas
seulement le premier.

## Format des tokens

Le format des design tokens n'est volontairement **pas** configurable : le standard W3C DTCG
est imposé sans alternative (`DESIGN.md` §2). C'est un point d'interopérabilité externe
(Figma, Style Dictionary, Tokens Studio) où dévier du standard coûterait plus cher que la
flexibilité n'apporterait.
