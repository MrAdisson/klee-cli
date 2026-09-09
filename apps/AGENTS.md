# AGENTS.md — apps/

> Code applicatif de keel. Deux packages aujourd'hui ; la séparation entre eux est la
> décision structurante à respecter.

## Packages

| Package                        | Rôle                                                                  | Ne doit **jamais** contenir                                               |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/core` (`@keel/core`) | Le domaine : modules, providers, configuration, moteur de scaffolding | Terminal, prompts, couleurs, `console.*`, dépendance à Commander ou Clack |
| `cli` (`@keel/cli`)            | La CLI `klee` : arguments, questions, rendu terminal                  | Logique de domaine — elle appartient à `core`                             |

Cette frontière n'est pas cosmétique : le cockpit local de la phase 4 (`klee studio`) sera un
troisième consommateur de `@keel/core`. Toute règle métier écrite dans `cli/` devra alors être
soit dupliquée, soit déplacée — c'est-à-dire réécrite deux fois.

## Conventions

- ESM strict, TypeScript, imports relatifs avec extension `.js` (résolution `nodenext`).
- Les tests vivent à côté du code : `src/**/*.test.ts`. Ils sont exclus du build et exécutés
  par Vitest depuis `src` uniquement.
- Une erreur attendue (config invalide, module inconnu) est une `KeelError` avec un `code` et,
  si possible, un `hint`. Une erreur inattendue est un bug : elle garde sa stack.
- Un générateur de scaffolding **retourne** des fichiers, il n'en écrit aucun. Seul
  `applyScaffoldPlan` touche au disque.
- Toute sortie utilisateur passe par `apps/cli/src/ui/output.ts` (ESLint interdit `console`
  ailleurs).

## Périmètre d'édition pour un agent

**Autorisé**

- Créer et modifier le code, les tests et la configuration de build des deux packages.
- Ajouter un provider (fichier dédié + enregistrement dans le registre).
- Ajouter une commande CLI (module dédié dans `cli/src/commands/` + câblage dans `program.ts`).

**Interdit**

- Faire dépendre `@keel/core` de `@keel/cli`, dans un sens comme dans l'autre autre que
  `cli → core`.
- Appeler `process.exit()` ailleurs que dans la couche `ui/` (les commandes retournent, elles
  ne terminent pas le processus).
- Ajouter une dépendance runtime sans justification écrite dans la PR.

## Références

- `AGENTS.md` (racine) — conventions générales.
- `docs/technical/cli-klee.md` — surface de la CLI.
