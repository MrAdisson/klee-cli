# AGENTS.md — design-system/ — tokens, socle partagé

> Source unique des design tokens, consommée à l'identique par les maquettes (prototypage) et par les apps (production). N'appartient à aucun des deux : c'est pourquoi il vit à la racine.

## Conventions

- `tokens.json` est la source unique, au format W3C DTCG (`$value` / `$type` / `$description`). Ce format est imposé sans alternative : c’est un point d’interopérabilité externe (Figma, Style Dictionary, Tokens Studio).
- `dist/` est **généré** par Style Dictionary et n'est jamais édité à la main. Cibles actives : css.
- Sens de la dépendance imposé : `mockups/` et `apps/` importent `design-system/dist/`, jamais l’inverse.
- Nommage sémantique avant tout (`--color-text-primary`, pas `--color-gray-900`) : changer une valeur ne doit pas casser la signification.
- Un changement de token est un ticket, jamais une édition silencieuse — il déclenche une régression visuelle sur les pages qui l’utilisent.

## Périmètre d'édition pour un agent

**Autorisé**

- Ajouter ou modifier un token dans `tokens.json`, avec sa `$description`.
- Ajuster la configuration du pipeline de transformation.

**Interdit**

- Éditer quoi que ce soit dans `design-system/dist/`.
- Introduire une dépendance de `design-system/` vers `mockups/` ou `apps/`.
- Ajouter un token purement descriptif (`--blue-500`) sans token sémantique correspondant.

Les secrets ne vivent jamais ici : uniquement dans un mécanisme de secrets dédié, hors du
champ de lecture par défaut d'un agent.

## Références

- DESIGN.md §2 — design tokens.
- `mockups/AGENTS.md`.
