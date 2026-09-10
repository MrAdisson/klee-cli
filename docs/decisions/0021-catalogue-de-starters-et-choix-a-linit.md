---
id: DOC-024
related_tickets: [KLEE-015]
related_mockups: []
status: accepted
date: 2026-09-10
---

# 0021 — Cinq starters de plus, et le choix arrive enfin à `klee init`

## Contexte

ADR 0020 posait le mécanisme (registre, alias DTCG, gate de contraste) mais s'arrêtait
volontairement à un seul starter : TECHNICAL.md §13 n'accorde le statut de point de choix
qu'à partir de deux alternatives réellement solides, en dessous la question serait un faux
choix. Ce ticket franchit ce seuil.

En écrivant les nouveaux starters, un défaut de conception d'ADR 0020 est apparu avant même
d'être testé : la forme sémantique référençait les primitifs par **teinte perçue**
(`primitive.color.blue.600`, `.red.700`, `.green.700`). Un starter dont l'accent est violet
n'a pas de groupe `blue` — ses alias auraient pointé dans le vide pour tout starter qui ne
s'appelle pas `klee-default`.

## Décisions

### Les primitifs sont nommés par rôle, jamais par teinte

Le groupe `primitive.color` d'un starter porte désormais `gray`, `white`, `accent`,
`danger`, `success` — jamais `blue`, `indigo` ou `violet`. La forme sémantique
(`scaffold/modules/tokens.ts`) référence toujours `primitive.color.accent.600`, quelle que
soit la couleur que ce rôle porte pour un starter donné. C'est ce qui rend un starter
substituable sans jamais toucher aux alias qui le consomment — la promesse même d'ADR 0020,
qui restait fausse tant qu'elle n'était vérifiée que sur un seul starter.

### Cinq starters, chacun vérifié par le gate avant d'entrer au catalogue

| Starter        | Rôle `accent`                       | `danger` / `success`                    | Ton                       |
| -------------- | ----------------------------------- | --------------------------------------- | ------------------------- |
| `klee-default` | bleu (palette Tailwind CSS v3, MIT) | rouge / vert                            | neutre, défaut historique |
| `klee-slate`   | indigo                              | rose / sarcelle                         | SaaS posé                 |
| `klee-warm`    | ambre                               | rouge / vert                            | accueillant, éditorial    |
| `klee-forest`  | vert forêt                          | rouge / sarcelle (distinct de l'accent) | nature, croissance        |
| `klee-violet`  | violet                              | rouge / vert                            | créatif, grand public     |
| `klee-mono`    | quasi-noir, sans teinte             | rouge / vert (seule couleur du starter) | minimal, éditorial        |

Aucune valeur n'est reprise verbatim d'un système nommé au-delà de `klee-default` (déjà
présent avant cet ADR, dont l'origine Tailwind CSS v3/MIT est documentée a posteriori dans
`token-starters.ts`). Les cinq autres sont des compositions propres à klee : une tentative de
vérifier des valeurs Tailwind v4 / Radix Colors s'est heurtée à deux obstacles concrets — la
palette Tailwind v4 est désormais définie en OKLCH, pas en hex, et une conversion non vérifiée
aurait été pire qu'une composition originale ; la documentation Radix Colors consultée ne
donnait ni licence ni sémantique de palier de façon exploitable sans plus de recherche. Rien
n'empêche un starter sourcé plus tard, à condition de vérifier ses valeurs plutôt que de les
deviner.

Chaque starter est vérifié par `checkStarterContrast` (ADR 0020) avant d'être accepté ici :
`klee-warm` et `klee-forest` ont chacun nécessité un ajustement (le palier 600 de leur accent,
utilisé par `primary.default` et `border.focus`, ne passait pas AA avec du texte blanc au
premier jet) — la preuve que le gate attrape ce qu'il est censé attraper, pas seulement en
théorie.

### `klee init` pose enfin la question

Une question interactive (`askTokenStarter`), posée uniquement si le module `mockups` est
retenu — même condition que `askTokenTargets`. Un flag `--token-starter <id>` pour l'usage
scriptable/`--yes`, résolu strictement : un id inconnu échoue avant d'écrire quoi que ce soit,
même message d'erreur que la validation de config (ADR 0020).

## Conséquences

- `TOKEN_STARTERS` passe de 1 à 6 ; le test qui figeait volontairement le catalogue à 1
  élément (ADR 0020) est remplacé par un test qui exige au moins 2 — condition inverse,
  documentant que le seuil de §13 est maintenant franchi.
- Aucune commande existante ne change de comportement par défaut : `klee-default` reste le
  défaut de `--yes` et de la question interactive.
- Le mécanisme reste ouvert : ajouter un septième starter n'oblige à modifier que
  `token-starters.ts` (même promesse qu'un provider, ADR 0012) — ni la forme sémantique, ni
  la CLI, ni le gate n'ont à bouger.
