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
- **`klee links check` aussi.** Un identifiant cité dans un frontmatter doit exister ; la
  commande sort en 1 sinon. C'est la règle que `tickets/AGENTS.md` énonçait sans que rien ne
  l'applique jusqu'à la phase 3.
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
- `docs/package.json` ne déclare **pas** `"type": "module"`, contrairement à tous les autres
  packages générés : le bundle serveur de Docusaurus est du CommonJS. L'y remettre fait échouer
  la construction sur `require.resolveWeak is not a function`, message qui ne mentionne ni le
  fichier ni la cause. Les configurations sont en `.mjs`, donc restent en ESM.
- Le plugin `pages` de Docusaurus est désactivé : une page `.md` n'expose pas les métadonnées
  du thème, une page `.mdx` fait échouer la compilation. La page d'accueil est un document.
- Un seul `plugin-content-docs` : Docusaurus ne résout les liens relatifs de fichier à fichier
  qu'à l'intérieur d'une instance. Le découper par section casse `[…](../decisions/….md)`.
- `pnpm install` échoue si un script de post-installation n'est pas tranché dans
  `pnpm-workspace.yaml`. La clé est `allowBuilds` (une table nom → booléen) en pnpm 12, pas
  `ignoredBuiltDependencies` : pnpm réécrit lui-même le fichier avec la bonne forme si on se
  trompe, ce qui est le moyen le plus rapide de la retrouver.
- Même piège que les serveurs de maquettes, version docs : un `docusaurus serve` oublié sur un
  port garde la main, et on relit un build précédent en croyant tester le nouveau. Les codes
  200 sont alors parfaitement trompeurs. `pkill -f "docusaurus serve"`.
- Le bloc `overrides` de `pnpm-workspace.yaml` corrige ce que l'arbre de Docusaurus traîne
  (ADR 0012). Il est **daté** : à relire à chaque montée de version, et à alléger dès que
  l'amont a repris la correction. Ne jamais y ajouter une ligne sans portée (`paquet@<version`)
  — un override inconditionnel survit à sa raison d'être et bloque une mise à jour.
- Tester si un port est libre demande **deux** liaisons : `127.0.0.1` et le joker. Un
  détenteur sur `127.0.0.1` est invisible à la sonde joker, un détenteur sur `*` (Eleventy,
  Docusaurus) est invisible à la sonde de boucle locale — sur macOS, `SO_REUSEADDR` laisse
  passer l'autre. Une seule sonde donne un faux « libre » et rouvre le glissement silencieux.
- Docusaurus ouvre un navigateur à son démarrage. Un serveur lancé pour le compte d'une autre
  commande doit recevoir `--no-open` (`Provider.devServer.embedArgs`), sinon `klee studio`
  ouvre la documentation au lieu du studio.
- `pnpm run <script> -- --flag` : pnpm 12 **avale** le `--`, et le drapeau n'atteint jamais le
  script. Passer les arguments directement (`pnpm run dev --port 4310`). Invisible à la
  lecture : les deux formes se ressemblent, une seule marche.
- Sur un port occupé, Docusaurus **s'arrête** (il pose une question, et sans terminal pour y
  répondre il abandonne) là où Eleventy **glisse** sur le port suivant sans rien dire. Le
  studio leur impose donc un port libre, déclaré par `Provider.devServer` (ADR 0016).
- Tuer `pnpm run dev` ne tue pas le serveur : pnpm n'est qu'un intermédiaire. Lancer les
  enfants en `detached` et signaler le **groupe** (`process.kill(-pid)`), sinon on laisse
  exactement le serveur oublié décrit plus haut.
- Une regex ANSI sans le caractère ESC ampute aussi les crochets légitimes : `[11ty] Server`
  devient `y] Server`. Le motif commence par `\u001b`, jamais par `\[` seul.
- Le nœud de graphe d'une maquette porte le chemin de son `.meta.yml`, pas celui de la page.
  Toute déduction d'URL doit retirer `.meta.yml` en entier.
- Les fichiers qu'un `klee module add` dépose dans **ce** dépôt ne passent ni `prettier --check`
  ni `eslint` : ils sont écrits pour des projets qui n'ont ni l'un ni l'autre. Après une
  activation de module, lancer `pnpm run format` puis relire ce que le lint signale — une
  erreur peut venir du template (donc à corriger dans le provider) ou de notre config (donc à
  corriger ici). L'import mort de `style-dictionary.config.mjs` était du premier type.
- `--refresh-root` ne réécrit plus les fichiers de racine modifiés depuis (ADR 0013) : il les
  signale `≠` et les laisse. Avant ce correctif, il les écrasait sans prévenir.
- Un override de version ne se juge pas à la lecture : le vérifier en installant, en
  construisant **et** en lançant le serveur de développement. `uuid` et `qs` ne vivent que
  dans `webpack-dev-server`, donc un `build` réussi ne prouve rien à leur sujet.

## Périmètre d'édition pour un agent

**Autorisé**

- Ajouter ici des notes de contexte durables : vocabulaire, pièges, conventions implicites
  rendues explicites.

**Interdit**

- Y stocker un état volatile (todo de session, brouillon d'analyse).
- Y dupliquer un contenu déjà présent dans un `AGENTS.md` local — préférer un renvoi.
