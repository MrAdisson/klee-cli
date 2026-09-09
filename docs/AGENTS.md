# AGENTS.md — docs/

> Documentation de klee. Deux natures à ne jamais confondre : _authored_ (l'intention, le
> pourquoi) et _générée_ (l'état réel du code à l'instant T).

## Organisation

| Dossier       | Nature   | Contenu                                                                  |
| ------------- | -------- | ------------------------------------------------------------------------ |
| `technical/`  | authored | Référence technique : CLI, format de configuration, architecture interne |
| `decisions/`  | authored | ADR numérotés — ce qui a été tranché et pourquoi                         |
| `_generated/` | générée  | Vue du graphe, écrite par `klee links report` — jamais éditée à la main  |

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
- Un identifiant cité dans le **texte** est une mention ; un identifiant listé dans
  `related_tickets` / `related_mockups` / `related_docs` est une **arête déclarée**, et
  `klee links check` exige qu'elle mène quelque part. Déclarer d'un seul côté suffit.
- Un identifiant écrit entre backticks ou dans un bloc de code n'est **pas** une référence :
  c'est un échantillon, et il est ignoré du graphe. C'est ce qui permet aux ADR d'illustrer le
  schéma avec `KLEE-123` sans polluer la vérification.
- Le site docs-as-code est servi par `klee docs serve`. `docs/` porte donc aussi
  `package.json`, `docusaurus.config.mjs`, `sidebars.mjs`, `index.md` et `src/` : ce sont des
  fichiers de site, pas de la documentation (cf ADR 0011).
- Les liens entre documents s'écrivent en **relatif de fichier à fichier**
  (`../decisions/0008-….md`) : ils fonctionnent sur une forge comme dans le site. Un lien
  cassé fait échouer `klee docs build`.

## Périmètre d'édition pour un agent

**Autorisé**

- Créer et mettre à jour une doc _authored_.
- Ajouter un ADR pour une décision réellement prise.
- Corriger un lien croisé cassé.

**Interdit**

- Éditer `_generated/` à la main : le fichier est réécrit à chaque `klee links report`.
- Réécrire un ADR déjà accepté.
- Créer une doc sans frontmatter.
- Écrire un secret ou une donnée personnelle dans une doc.

## Références

- `AGENTS.md` (racine).
- `TECHNICAL.md` §5 — natures de documentation.
