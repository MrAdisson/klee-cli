---
id: DOC-016
related_tickets: [KLEE-004]
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0013 — Le scaffolding n'écrase pas ce qui a été rédigé

## Contexte

L'activation du module `mockups` sur ce dépôt même — `klee module add mockups --refresh-root`
— a **supprimé 345 lignes** de contenu rédigé : `AGENTS.md`, `.agents/AGENTS.md`, `README.md`
et `.gitignore` ont été remplacés par les templates génériques du scaffolder. La section
« Vérifier, pas supposer » et la quinzaine de pièges connus accumulés depuis la phase 0 ont
disparu en une commande, sans confirmation et sans diff préalable.

La cause n'est pas une fausse manœuvre. `refreshRootFiles` passait `force: true` **en dur** :

```ts
const result = await applyScaffoldPlan(plan, { root, dryRun, force: true });
```

Et ce `force` était nécessaire, parce que `applyScaffoldPlan` ne connaissait que deux
comportements face à un fichier existant qui diffère du plan : refuser le plan **entier**
(`ScaffoldConflictError`), ou tout écraser. Or `AGENTS.md` et `README.md` sont rédigés dès le
lendemain de l'init. Sans `force`, une régénération partielle aurait échoué systématiquement ;
avec lui, elle détruit. Le choix offert était entre inutilisable et destructeur.

Le vrai défaut est en amont des deux options : **le scaffolder traite ses fichiers de racine
comme sa sortie**, alors qu'ils sont en réalité _amorcés_ par lui puis possédés par un humain.
`AGENTS.md` n'est pas un artefact généré qu'on régénère — c'est un document rédigé dont klee a
écrit la première version.

## Décisions

### Un troisième comportement de conflit : `skip`

`ApplyScaffoldOptions.force: boolean` est remplacé par
`onConflict: 'fail' | 'overwrite' | 'skip'`, et `FileOutcome` gagne `'skipped'`.

| Mode            | Comportement                                         | Où                                 |
| --------------- | ---------------------------------------------------- | ---------------------------------- |
| `fail` (défaut) | refuse le plan entier                                | `klee init`, `klee docs init`      |
| `overwrite`     | écrase                                               | les mêmes, sur `--force` explicite |
| `skip`          | laisse le divergent, écrit ce qui manque, le signale | `module add --refresh-root`        |

Le défaut reste `fail` : pour un scaffolding **initial**, un fichier divergent signale qu'on
écrit dans un projet qu'on croyait vide, et tout arrêter est la bonne réaction.

`skip` est le seul comportement acceptable pour une régénération **partielle**, dont l'objet
est d'ajouter ce qui manque, jamais de reprendre la main sur ce qui existe.

### `--refresh-root` n'écrase plus rien sans demande explicite

Le mode devient `skip`, et `klee module add <module> --refresh-root --force` reste la porte de
sortie pour qui veut réellement reprendre les fichiers de racine. La différence tient en ce que
la destruction est devenue **une demande**, alors qu'elle était un effet de bord.

La sortie nomme ce qu'elle n'a pas touché plutôt que de le taire :

```
  ≠ AGENTS.md (modifié depuis — laissé tel quel)
  = .editorconfig (inchangé)

  0 créé(s), 5 laissé(s) tel(s) quel(s), 1 inchangé(s)
  `--force` pour reprendre aussi les fichiers modifiés depuis — ils seront écrasés.
```

Un fichier ignoré en silence serait une deuxième forme du même problème : l'utilisateur croirait
son `README.md` à jour alors qu'il ne l'est pas.

### La règle générale

**Aucune commande de klee n'écrase du contenu qu'un humain a pu écrire sans que l'écrasement
soit ce qui a été demandé.** Un fichier généré redevient la propriété de son projet dès qu'il
est modifié, et le scaffolder n'a aucun moyen de distinguer une modification humaine d'une
dérive — il doit donc supposer la première.

Cette règle vaut au-delà de `--refresh-root`, pour toute commande future qui régénérerait des
fichiers dans un projet déjà vivant.

## Conséquences

- `ApplyScaffoldOptions.force` disparaît. Les trois appelants passent `onConflict` : `init` et
  `docs init` traduisent leur flag `--force`, `module add --refresh-root` prend `skip`.
- `module add` et `module remove` acceptent `--force`, qui ne vaut qu'avec `--refresh-root`.
- Trois tests couvrent la classe de bug, et ont été vérifiés en **retirant** le correctif : ils
  échouent alors, ce qui est la seule preuve qu'ils protègent quelque chose.
- Le cas symétrique reste ouvert et non traité : klee ne sait toujours pas dire _ce qui aurait
  changé_ dans un fichier ignoré. Afficher ce diff serait le prolongement naturel, et n'est pas
  nécessaire pour que la commande cesse d'être dangereuse.
- Ce bug est une instance de ce que la phase 4 devait détecter entre maquette et composant : un
  artefact généré dont la copie humaine a divergé de sa source. Il s'est manifesté d'abord sur
  le scaffolder lui-même — cf ADR 0015 sur ce qui a été décidé du sujet.
