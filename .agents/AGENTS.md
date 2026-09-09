# AGENTS.md — Contexte partagé des agents

> Contexte commun à tous les agents intervenant sur klee. Le `AGENTS.md` de la racine dit
> _quoi_ ; celui-ci dit _comment travailler_.

## Vocabulaire du domaine

| Terme                   | Sens précis dans ce projet                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Module**              | Axe 1 de configuration : un pan du projet, présent ou absent (`mockups`, `contracts`…). Un module absent ne génère **rien** — ni fichier, ni dépendance, ni section de cockpit. |
| **Socle**               | Modules jamais optionnels (`apps`, `tickets`, `docs-technical`, `docs-decisions`) : ce sont eux qui portent le graphe de traçabilité.                                           |
| **Provider**            | Axe 2 : l'implémentation retenue pour un point configurable d'un module retenu (Docusaurus vs VitePress…).                                                                      |
| **Point (de provider)** | L'emplacement configurable lui-même (`workspace`, `docs`, `tokens-pipeline`…).                                                                                                  |
| **Plan de scaffolding** | La liste des fichiers à écrire, calculée sans toucher au disque.                                                                                                                |
| **Preset**              | Un raccourci sur l'axe 1 uniquement : il fixe des modules, jamais des providers.                                                                                                |

Ne pas introduire de synonyme concurrent : « feature » pour module, « adapter » pour provider,
« template » pour générateur brouillent le code autant que les discussions.

## Règles de travail

- **Lire avant d'écrire.** `TECHNICAL.md` tranche la plupart des questions d'architecture.
  Une décision qui semble à prendre y est souvent déjà prise.
- **Ce qui n'est pas spécifié ne s'invente pas.** Si l'implémentation d'un ticket exige un
  choix non couvert par le brief ou par un ADR, le bon geste est d'ouvrir la question, pas de
  trancher silencieusement dans le code.
- **Respecter la phase courante.** Un provider dont la phase de scaffolding n'est pas atteinte
  est un `declarativeProvider` : il enregistre un choix, il ne génère rien. C'est volontaire.
- **Toute nouvelle règle structurante devient un ADR**, pas un commentaire enfoui.
- **`pnpm run verify` avant de rendre la main.** Format, lint, typecheck et tests.
- **Ne jamais committer ni stager.** Le mainteneur relit et committe lui-même : laissez
  l'arbre de travail propre et résumez ce qui a changé.

## Vérifier, pas supposer

Une leçon payée cash en phase 1 : les maquettes ont été livrées **sans aucune feuille de
style**, et la vérification ne l'a pas vu. La page répondait 200, la classe attendue était
dans le HTML — mais `base.css` sortait en 404, parce qu'Eleventy ne publie que ce qu'il sait
_rendre_.

Ce qu'il faut en retenir, au-delà du cas :

- **Tester ce que l'utilisateur obtient, pas ce que le code produit.** Un scaffolder se vérifie
  en générant un projet, en l'installant, en le construisant et en le servant réellement — pas
  en relisant le template.
- **Vérifier chaque ressource qu'une page demande**, pas seulement la page.
- **Ne jamais livrer une configuration qu'on n'a pas exécutée.** Les configs Style Dictionary et
  Eleventy ont toutes deux été fausses au premier jet, sur des détails invisibles à la lecture.
- **Transformer chaque bug trouvé en test qui couvre sa classe**, puis vérifier que le test
  échoue vraiment quand on retire le correctif.

## Pièges connus

- `dist/` contient du code compilé : Vitest est configuré pour ne lire que `src/**/*.test.ts`,
  et les tests sont exclus du build. Ne pas « simplifier » l'un sans l'autre.
- TypeScript est volontairement figé en 6.x tant que typescript-eslint ne supporte pas TS 7
  (cf `docs/decisions/0004-toolchain.md`). Ne pas remonter la version sans vérifier le lint.
- Les templates de scaffolding produisent du contenu destiné à **d'autres** projets : ce qui
  y est écrit devient la convention de quelqu'un d'autre. Les relire comme de la doc publiée.
- Déplacer le dossier du dépôt casse le symlink de `klee` : le refaire avec
  `ln -s <dépôt>/apps/cli/dist/bin/klee.js ~/Library/pnpm/bin/klee`.
- `klee` est installé par un symlink vers `apps/cli/dist/bin/klee.js` : une modification n'a
  d'effet qu'après compilation. Laissez `pnpm dev` tourner, sinon vous testez l'ancien binaire.
- Plusieurs serveurs de maquettes lancés en parallèle : Eleventy bascule **silencieusement** sur
  le port suivant. On croit tester un projet, on en regarde un autre. `pkill -f eleventy`.
- Un provider peut porter du comportement, pas seulement des fichiers (`Provider.ticketIndex`,
  `Provider.workspace`). Cette extension du §13 est délibérée — cf ADR 0008.

## Périmètre d'édition pour un agent

**Autorisé**

- Ajouter ici des notes de contexte durables : vocabulaire, pièges, conventions implicites
  rendues explicites.

**Interdit**

- Y stocker un état volatile (todo de session, brouillon d'analyse).
- Y dupliquer un contenu déjà présent dans un `AGENTS.md` local — préférer un renvoi.
