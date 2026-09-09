# AGENTS.md — docs/

> Documentation de klee. Deux natures à ne jamais confondre : _authored_ (l'intention, le
> pourquoi) et _générée_ (l'état réel du code à l'instant T).

## Organisation

| Dossier       | Nature   | Contenu                                                                  |
| ------------- | -------- | ------------------------------------------------------------------------ |
| `technical/`  | authored | Référence technique : CLI, format de configuration, architecture interne |
| `decisions/`  | authored | ADR numérotés — ce qui a été tranché et pourquoi                         |
| `_generated/` | générée  | _(à venir, phase 3)_ — jamais édité à la main                            |

## Conventions

- Chaque document porte le frontmatter minimal du projet :
  ```yaml
  id: DOC-018
  related_tickets: []
  related_mockups: []
  ```
  Une doc sans `id` est une doc que rien ne peut référencer : elle est invisible du graphe.
- Les ADR sont numérotés en continu (`0001-`, `0002-`…) et **ne se réécrivent pas**. Une
  décision qui change fait l'objet d'un nouvel ADR qui supersède explicitement l'ancien.
- Un ADR répond à trois questions, dans cet ordre : quel était le contexte, qu'a-t-on décidé,
  qu'est-ce que ça coûte. Un ADR sans section « conséquences » cache son prix.
- Le site docs-as-code (Docusaurus, cf `project.config.json`) arrive en phase 3.

## Périmètre d'édition pour un agent

**Autorisé**

- Créer et mettre à jour une doc _authored_.
- Ajouter un ADR pour une décision réellement prise.
- Corriger un lien croisé cassé.

**Interdit**

- Réécrire un ADR déjà accepté.
- Créer une doc sans frontmatter.
- Écrire un secret ou une donnée personnelle dans une doc.

## Références

- `AGENTS.md` (racine).
- `TECHNICAL.md` §5 — natures de documentation.
