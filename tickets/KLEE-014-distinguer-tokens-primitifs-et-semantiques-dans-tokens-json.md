---
id: KLEE-014
title: Distinguer tokens primitifs et sémantiques dans tokens.json
status: done
assignee: null
created: 2026-09-10
updated: 2026-09-10
depends_on: []
related_mockups: []
related_docs: []
authored_by: agent
---

DESIGN.md §2 impose un nommage sémantique (`color.text.primary`, jamais `color.blue.600`), mais `tokens.ts` écrit aujourd'hui la valeur littérale directement dans le token sémantique — aucune séparation entre la valeur brute et son rôle. Ça bloque toute idée de proposer plusieurs jeux de couleurs de départ à l'init (cf discussion) : il n'y a rien à substituer. Ce ticket introduit un niveau de primitifs (groupe `primitive`) référencé par alias DTCG (`$value: "{primitive.color.gray.900}"`) depuis les tokens sémantiques existants, dans le même `tokens.json` (aucun fichier ajouté, aucune ligne d'arborescence à changer dans TECHNICAL.md). Le jeu de primitifs devient un "starter" choisi par un registre côté klee — un seul starter (`klee-default`) existe pour l'instant : DESIGN.md/TECHNICAL.md §13 exige au moins deux alternatives solides pour justifier une question posée à l'utilisateur, donc `klee init` ne propose pas encore de choix, il applique le seul starter existant. Le mécanisme est prêt à en accueillir un second sans toucher au reste (même promesse qu'un provider, ADR 0012), ce qui sera un ticket séparé.

## Critères d'acceptation

```gherkin
Scénario: le tokens.json généré n'a aucune régression de valeur
  Étant donné un `klee init` avec le module mockups retenu
  Quand `design-system/tokens.json` est généré
  Alors chaque token sémantique, une fois son alias résolu, vaut exactement
    la même couleur que l'ancien DEFAULT_TOKENS littéral

Scénario: un token sémantique ne porte jamais de valeur littérale
  Étant donné le groupe `color` de `tokens.json` (hors groupe `primitive`)
  Quand on lit le `$value` de chacun de ses tokens
  Alors c'est une référence `{primitive....}`, jamais un code couleur en dur

Scénario: le pipeline de build résout les alias sans changement de config
  Étant donné `design-system/tokens.json` avec ses alias
  Quand `klee tokens build` s'exécute (Style Dictionary ou Terrazzo)
  Alors `dist/css/tokens.css` contient les mêmes valeurs finales qu'avant ce ticket

Scénario: le catalogue de starters n'expose pas un faux choix
  Étant donné qu'un seul starter (`klee-default`) est enregistré
  Quand `klee init` s'exécute, interactif ou `--yes`
  Alors aucune question n'est posée sur le starter de tokens
  Et `project.config.json` porte quand même `designSystem.tokenStarter: "klee-default"`

Scénario: une configuration référençant un starter inconnu est refusée
  Étant donné un `project.config.json` avec `designSystem.tokenStarter: "inconnu"`
  Quand la configuration est validée
  Alors une erreur nomme les starters disponibles

Scénario: le gate de contraste protège tout starter, présent ou futur
  Étant donné les paires texte/surface documentées comme vérifiées AA
  Quand les tokens résolus d'un starter du registre sont mesurés
  Alors chaque paire atteint au moins le ratio de contraste WCAG 2.1 AA requis
```
