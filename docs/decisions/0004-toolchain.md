---
id: DOC-004
related_tickets: []
related_mockups: []
status: accepted
date: 2026-09-08
---

# 0004 — Outillage du dépôt klee

## Contexte

Klee scaffolde des projets ; il doit donc être exemplaire sur son propre outillage. Les choix
ci-dessous concernent **le dépôt klee lui-même**, pas les projets qu'il génère — ceux-là
choisissent leur orchestrateur via le provider `workspace`.

## Décision

| Point              | Choix                                                          | Motif                                                                                                                              |
| ------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Runtime            | Node ≥ 22.12, ESM strict                                       | LTS, `import.meta.dirname` disponible                                                                                              |
| Langage            | TypeScript, `strict` + `noUncheckedIndexedAccess`              | Un outil de scaffolding manipule des chemins et des enregistrements indexés : c'est exactement là que l'index non vérifié fait mal |
| Version TypeScript | **6.0.3, volontairement pas 7.x**                              | voir ci-dessous                                                                                                                    |
| Packages           | pnpm workspaces + Turborepo                                    | Cohérent avec le provider par défaut que klee recommande                                                                           |
| Build              | `tsc --build` avec project references                          | Deux packages, une dépendance : un bundler n'apporterait rien                                                                      |
| Tests              | Vitest, tests colocalisés `src/**/*.test.ts`                   | Pas de configuration de chemins à maintenir                                                                                        |
| Validation         | Zod                                                            | La configuration est lue depuis un fichier éditable à la main : elle doit être validée, pas supposée                               |
| CLI                | Commander (arguments) + Clack (questions) + picocolors         | Chacun fait une chose                                                                                                              |
| Qualité            | ESLint (flat config) + Prettier, agrégés par `pnpm run verify` | Une seule commande à passer avant une PR                                                                                           |

### Sur TypeScript 6 plutôt que 7

TypeScript 7.0 (compilateur natif) est la version stable au moment de cette décision, et le
projet a d'abord été écrit avec. Elle a été abandonnée pour une raison précise :
**typescript-eslint 8.70 refuse explicitement de démarrer sur l'API TS 7** (suivi dans
typescript-eslint#10940). Le choix se posait ainsi :

- TS 7 **sans lint TypeScript** — inacceptable pour un projet qui prétend à la rigueur ;
- TS 7 pour le build **plus** une installation TS 6 en parallèle pour ESLint — deux
  compilateurs, deux versions de la même API, pour un gain de vitesse de compilation invisible
  sur deux packages de cette taille ;
- **TS 6.0.3 partout** — dernière version stable de la lignée classique, sémantique identique,
  lint pleinement fonctionnel.

Le troisième a été retenu. La migration vers TS 7 est un ticket à ouvrir dès que
typescript-eslint le supporte ; rien dans le code n'en dépend.

### Sur `TECHNICAL.md` et `DESIGN.md`

Ces deux fichiers sont exclus de Prettier (`.prettierignore`). Ce sont les **entrées** du
projet, écrites par un humain : leur mise en forme lui appartient. Les laisser dans le champ
du formateur revenait à réécrire silencieusement le brief à chaque `pnpm run format`.

## Conséquences

- `pnpm run verify` (format, lint, typecheck, test) est la porte d'entrée unique de la CI comme
  du poste local. La CI ne fait rien de plus que ce qu'un contributeur peut lancer.
- Les tests sont exclus du build (`tsconfig.json`) mais typés par un `tsconfig.test.json`
  dédié : `dist/` ne contient que du code de production, sans perdre le typage des tests.
- Le pinning est exact (`save-exact=true`) : un scaffolder qui produirait des résultats
  différents selon la résolution de ses propres dépendances serait un mauvais scaffolder.
