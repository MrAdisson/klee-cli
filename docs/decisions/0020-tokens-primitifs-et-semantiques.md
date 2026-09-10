---
id: DOC-023
related_tickets: [KLEE-014]
related_mockups: []
status: accepted
date: 2026-09-10
---

# 0020 — Tokens primitifs et sémantiques, dans le même `tokens.json`

## Contexte

DESIGN.md §2 impose un nommage sémantique (`color.text.primary`, jamais `color.blue.600`) :
changer une valeur ne doit pas casser la signification. Mais `tokens.ts` écrivait la valeur
littérale directement dans le token sémantique — `color.primary.default.$value = "#2563eb"`.
Aucune séparation entre la valeur brute et le rôle qu'elle joue.

Ça bloquait une idée discutée avec l'utilisateur : proposer, un jour, plusieurs jeux de
couleurs de départ à `klee init` (maison, ou repris d'un système existant). Sans séparation,
il n'y a rien à substituer — un starter alternatif obligerait à réécrire tous les rôles à la
main, ce que la même palette pourrait faire d'un coup si les rôles s'y référaient par alias.

C'est le schéma standard de l'industrie des design tokens (« primitive/reference tokens » vs
« semantic/system tokens ») : Material Design 3 (`ref` vs `sys`), Adobe Spectrum (_global_ vs
_alias_), Atlassian Design System. Même les systèmes exposés par échelle (Radix Colors,
Tailwind) recommandent explicitement de bâtir cette couche sémantique par-dessus plutôt que
de consommer l'échelle brute dans le produit.

## Décisions

### Deux groupes, un seul fichier

`tokens.json` reste l'unique fichier de `design-system/` — **aucune ligne d'arborescence de
TECHNICAL.md §3 ne change**. Il porte désormais deux groupes :

- `primitive` : les valeurs brutes, nommées par échelle (`primitive.color.gray.900`).
- Tout le reste (`color`, `font`, `space`, `radius`, `shadow`) : la forme sémantique, fixe,
  qui référence `primitive.*` par alias DTCG — `$value: "{primitive.color.gray.900}"` — au
  lieu d'une valeur littérale.

Un fichier séparé (`primitives.json`) a été envisagé puis écarté : il aurait fallu que
Style Dictionary et Terrazzo résolvent des alias inter-fichiers, une hypothèse non vérifiée,
pour un bénéfice nul — un seul fichier suffit à rendre le starter substituable, puisque la
substitution se fait à la génération (`klee init`), pas à l'exécution du pipeline.

Vérifié en pratique : Style Dictionary (le défaut) résout l'alias et **préserve la chaîne**
côté CSS plutôt que de l'aplatir (`outputReferences: true`, déjà configuré) —
`--color-primary-default: var(--primitive-color-blue-600);`. Aucune valeur résolue ne change
par rapport à l'ancien `DEFAULT_TOKENS` littéral (`tokens.test.ts` le vérifie token par
token).

### Portée limitée à `color`

Seul le groupe `color` reçoit un niveau primitif. `font`, `space`, `radius`, `shadow`
restent des tokens sémantiques à valeur littérale : un starter est un choix de palette, pas
un système typographique ou un rythme d'espacement — DESIGN.md ne promet rien de tel, et
étendre le primitif à ces groupes sans starter alternatif qui en aurait besoin serait de
l'abstraction sans usage.

### Un registre de starters, un seul starter pour l'instant

Le groupe `primitive` d'un projet vient d'un `TokenStarter` (`token-starters.ts`), résolu par
id au moment du scaffolding. `klee-default` est l'unique starter enregistré aujourd'hui —
c'est un renommage par échelle de l'ancien `DEFAULT_TOKENS`, aucune valeur ne change.

**`klee init` ne pose aucune question sur le starter.** TECHNICAL.md §13 n'accorde le
traitement « point de choix » qu'à partir de deux alternatives réellement solides sans
gagnant technique évident — en dessous, la question serait un faux choix. Le mécanisme
(registre, résolution stricte par id, validation de la config) est prêt à en accueillir un
second sans modifier autre chose que `token-starters.ts` — même promesse qu'un provider
(ADR 0012) — mais exposer le choix côté CLI est un ticket séparé, qui suivra l'ajout d'un
second starter, pas ce ticket-ci.

`project.config.json` porte tout de même `designSystem.tokenStarter` dès aujourd'hui (défaut
`"klee-default"`), validé contre le registre : une config qui référence un starter inconnu
est refusée avec la liste des starters disponibles — même discipline que les providers
(`validate.ts`).

### Un gate de contraste, pas seulement une promesse en commentaire

L'ancien commentaire de `tokens.ts` affirmait le respect AA des paires texte/surface sans
rien qui le vérifie mécaniquement. `checkStarterContrast` (dans `tokens.ts`, aux côtés de
`buildTokens`) mesure le ratio de contraste WCAG 2.1 réel des tokens résolus d'un starter,
pour une liste fixe de paires (`SEMANTIC_CONTRAST_PAIRS`) — indépendant d'axe-core et d'un
navigateur, donc exécutable sans maquette rendue. `token-starters.test.ts` fait tourner ce
gate pour chaque starter du registre : un futur starter qui échouerait n'entrerait pas dans
le catalogue.

## Conséquences

- DESIGN.md §2 est amendé (pas réécrit) pour documenter la distinction primitif/sémantique et
  l'usage de l'alias DTCG.
- `TECHNICAL.md` n'a besoin d'aucune modification : la forme du fichier `tokens.json` qu'il
  décrit ne change pas.
- `mockups/AGENTS.md` généré interdit désormais explicitement d'utiliser un token
  `primitive.*` directement dans une maquette — toujours passer par son alias sémantique.
- Le provider `tokens-pipeline: terrazzo` échoue aujourd'hui sur les couleurs hexadécimales
  en chaîne (`lint:core/valid-color`), y compris sur un token `shadow` non touché par cet
  ADR — un problème préexistant, indépendant de cette décision, qui mérite son propre ticket.
- Aucune commande n'est retirée ; `DEFAULT_TOKENS` disparaît au profit de `buildTokens(starterId)`,
  son seul appelant (`scaffold/modules/mockups.ts`) mis à jour en conséquence.
