---
id: DOC-025
related_tickets: [KLEE-016]
related_mockups: []
status: accepted
date: 2026-09-10
---

# 0022 — Un starter porte une personnalité complète, pas seulement une couleur

## Contexte

ADR 0020/0021 posaient un mécanisme de starter qui ne faisait varier que `primitive.color`.
Retour direct de l'utilisateur en le voyant en pratique : ça ressemble à un habillage de
couleur sur un même squelette, pas à des design systems distincts — chaque starter gardait
exactement la même typo, le même rythme d'espacement, les mêmes rayons et les mêmes ombres.

C'est aussi posé comme le prérequis d'une vision plus large, pas construite ici : proposer un
jour des bibliothèques de composants optionnelles (dans l'esprit du composant Bouton déjà
scaffoldé sous `mockups/`), qui changeraient d'apparence selon le design system auquel elles
sont attachées. Un starter qui ne varie qu'en couleur ne porte pas assez de personnalité pour
qu'un composant attaché ait un rendu vraiment distinct.

## Décisions

### `font`, `space`, `radius`, `shadow` varient désormais par starter

Chaque `TokenStarter` porte un `font`/`space`/`radius`/`shadow` en plus de `primitives`
(couleur). `klee-default` garde exactement les valeurs qu'il avait avant ce ticket — aucun
projet déjà scaffoldé n'est concerné, et c'est la personnalité de référence. Les cinq autres
starters reçoivent chacun une combinaison cohérente : `klee-slate` plus dense et anguleux
(SaaS), `klee-warm` plus généreux et arrondi (accueillant), `klee-forest` aux coins organiques
et à l'ombre douce, `klee-violet` aux titres marqués et à l'ombre teintée par l'accent (glow),
`klee-mono` compact, presque droit, à l'ombre à peine perceptible.

### Valeur directe, pas d'alias — contrairement à la couleur

`font.size.md`, `space.md`, `radius.sm`, `shadow.sm` portent une valeur littérale par
starter, sans passer par un groupe `primitive.*`. La couleur a besoin d'un niveau primitif
parce qu'une même valeur (`accent.600`) est réutilisée sous plusieurs rôles sémantiques
(`primary.default` et `border.focus`) — aucun rôle de `font`/`space`/`radius`/`shadow` n'est
partagé de cette façon. Ajouter l'indirection ici serait de l'abstraction sans bénéfice.

### La lisibilité est un gate, pas une intention

`MIN_READABLE_FONT_SIZE` (13px) est vérifié mécaniquement pour chaque starter du registre
(`token-starters.test.ts`), au même titre que le contraste couleur (ADR 0020) : la
personnalité visuelle ne doit jamais coûter la lisibilité.

### Le jugement visuel ne se remplace pas par un test

"Est-ce que ça a l'air pro" ne se calcule pas comme un ratio de contraste. Le critère
d'acceptation correspondant (KLEE-016) demande une relecture humaine des maquettes bouton et
connexion servies avec chaque starter (`klee mockups serve`), pas une assertion automatisée —
contrairement au reste du ticket, qui est mécaniquement vérifié.

## Conséquences

- Aucune régression sur `klee-default` : mêmes tailles, mêmes espacements, mêmes rayons,
  mêmes ombres qu'avant ce ticket.
- Le mécanisme reste ouvert à un septième starter sans toucher à autre chose que
  `token-starters.ts` (même promesse que pour la couleur, ADR 0021).
- Hors périmètre, explicitement noté dans KLEE-016 : aucune bibliothèque de composants,
  aucun import de design system externe, aucune décision sur un vocabulaire de variables CSS
  compatible avec une lib tierce — ces chantiers restent à ouvrir séparément, le jour où ils
  démarrent réellement.
