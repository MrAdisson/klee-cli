---
id: DOC-005
title: Référence de la CLI klee
related_tickets: []
related_mockups: []
---

# Référence de la CLI `klee`

État : **phases 0 à 4** (cockpit). Seules les commandes ci-dessous existent. `klee studio`
n'absorbe rien : il agrège les serveurs existants, qui restent utilisables seuls (ADR 0014).
La recherche transverse et les webhooks internes restent à venir dans la phase 4.

```
klee [-v | --version] [-h | --help] <commande>
```

## `klee init [directory]`

Crée la structure d'un projet Klee dans `directory` (défaut : le dossier courant).

| Option                 | Effet                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `--name <name>`        | Nom du projet. Défaut : le nom du dossier, normalisé en nom de package npm.                          |
| `--id-prefix <prefix>` | Préfixe des identifiants de tickets. Défaut : `PROJ`.                                                |
| `--preset <preset>`    | `full-product` \| `api-service` \| `internal-lib`. Fixe les modules, et peut _proposer_ un provider. |
| `--provider <p>=<id>`  | Impose un provider, répétable. Passe avant le preset (ADR 0012).                                     |
| `-y`, `--yes`          | Aucune question : preset `full-product` (ou celui demandé) et providers par défaut.                  |
| `--dry-run`            | Affiche le plan exact sans rien écrire.                                                              |
| `--force`              | Écrase les fichiers existants dont le contenu diffère.                                               |

**Mode interactif** (défaut) — dans l'ordre : dossier cible (si l'argument n'a pas été donné),
nom, préfixe d'identifiants, puis, comme l'impose `TECHNICAL.md` §13, **les modules**, puis,
pour chaque module retenu seulement, ses questions de provider, et enfin les cibles de build
des tokens si `mockups` est retenu.

Le dossier est demandé **avant** le nom, et le nom en découle par défaut : c'est le dossier qui
décide où atterrissent les fichiers. Déduire l'inverse — créer un dossier à partir du nom saisi —
ferait muter l'arborescence au gré d'une réponse, ce qu'aucun usage scriptable ne pourrait
prévoir. Pour scaffolder dans un sous-dossier, l'argument suffit : `klee init tutu` crée et
remplit `./tutu/`, en nommant le projet `tutu`.

**Mode non interactif** (`--yes`) — indispensable pour la CI et pour un agent qui scaffolde
sans supervision. Sans terminal et sans `--yes`, la commande échoue explicitement plutôt que
de deviner.

**Résolution d'un provider**, du plus fort au plus faible : `--provider` ou la réponse donnée
en interactif, puis la proposition du preset, puis le défaut du point. `internal-lib` propose
ainsi `docs=markdown-only` — une bibliothèque interne n'a pas à installer React pour trois ADR
(ADR 0012). Le mode interactif présélectionne cette proposition sans masquer les autres choix.

```bash
klee init                                   # interactif
klee init --yes                             # full-product, tous les défauts
klee init ./mon-api --yes --preset api-service --id-prefix ACME
klee init ./ma-lib --yes --preset internal-lib          # documentation en markdown, pas de site
klee init ./ma-lib --yes --provider docs=docusaurus     # …sauf si on en veut un
klee init --yes --dry-run                   # inspecter le plan avant d'écrire
```

### Ce que `init` fait après avoir écrit les fichiers

1. **`git init`**, sauf `--no-git` — et seulement si l'on n'est pas déjà dans un dépôt : ajouter
   Klee à un projet existant est un cas légitime. La commande s'arrête là : **aucun commit
   automatique**, le premier commit d'un dépôt est une décision.
2. **Installation des dépendances** — faite d'office avec `--install`, proposée en mode
   interactif, jamais silencieuse en `--yes` : le réseau ne doit pas être sollicité par
   surprise (ADR 0006).
3. **Premier build des tokens**, si les dépendances viennent d'être installées et que le module
   `mockups` est retenu. Sans lui, les maquettes se servent sans aucune valeur de token — des
   pages muettes dont la cause est difficile à relier. Contrairement à l'installation, ce build
   est local, déterministe et produit un artefact ignoré par git : rien qui justifie de le
   refuser par défaut.

Si l'installation n'a pas eu lieu, `klee mockups serve` construit les tokens à la volée
plutôt que de servir des pages sans style. Même garantie côté orchestrateur : la tâche `dev`
dépend du `build` des packages amont, donc `pnpm dev` à la racine est correct lui aussi.

### Garanties

- **Tout ou rien.** Les conflits sont détectés sur l'ensemble du plan _avant_ la première
  écriture. Un scaffolding à moitié appliqué laisserait le projet dans un état que personne
  n'a décidé.
- **Idempotence.** Un fichier déjà identique au plan est laissé tel quel et rapporté
  `inchangé` — relancer la commande ne produit pas de diff.
- **Refus par défaut.** Un fichier existant dont le contenu diffère provoque un échec avec la
  liste des chemins ; `--force` est un choix explicite, jamais un comportement implicite.
- **Aucune écriture hors racine.** Un chemin qui remonterait au-dessus de la racine du projet
  est rejeté.

## `klee module`

| Commande                      | Effet                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `klee module list`            | Liste les modules, leur état (actif / absent) et leur nature (socle / optionnel).    |
| `klee module add <module>`    | Active un module optionnel, met à jour `project.config.json` et génère ses fichiers. |
| `klee module remove <module>` | Désactive un module optionnel. **Ne supprime aucun fichier** — il les liste.         |

Options communes à `add` et `remove` : `--dry-run`, et `--refresh-root` pour régénérer les
fichiers de racine qui énumèrent les modules (`README.md`, `AGENTS.md`). `add` accepte en
plus `--install` : un module qui arrive apporte ses dépendances, et la commande les liste
systématiquement avec la commande d'installation à lancer (cf ADR 0006).

```bash
klee module add contracts
klee module add mockups --refresh-root
```

Un module du socle ne peut être ni ajouté ni retiré : la commande échoue en le disant.
Supprimer les fichiers d'un module retiré serait une décision, pas une commodité : `remove`
signale, il ne détruit pas.

`add` génère aussi les fichiers des providers rattachés au module : ajouter `mockups` installe
le pipeline de tokens et le serveur de maquettes, pas seulement le dossier.

## `klee links`

Graphe de traçabilité entre tickets, maquettes et documents
(cf [`graphe-de-tracabilite.md`](./graphe-de-tracabilite.md)).

| Commande               | Effet                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| `klee links`           | Tout le graphe, par nature d'artefact. `--json` pour un agent.           |
| `klee links show <id>` | Voisinage d'un identifiant, dans les deux sens, mentions comprises.      |
| `klee links check`     | Vérifie que tout lien déclaré mène à un artefact existant.               |
| `klee links report`    | (Ré)écrit `docs/_generated/tracabilite.md`. `--dry-run` pour l'afficher. |

`check` sort en `1` sur une **erreur** — arête déclarée dans le vide, identifiant revendiqué
deux fois, `depends_on` vers autre chose qu'un ticket, fichier dont l'identifiant ne
correspond pas à sa nature. Les **avertissements** — mention vers un artefact inexistant, doc
sans `id` — n'affectent pas le code de sortie. C'est la commande à mettre en CI.

Un identifiant déclaré d'un seul côté relie bien les deux artefacts : il n'y a aucune symétrie
de frontmatter à maintenir (ADR 0010).

## `klee docs`

| Commande          | Effet                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| `klee docs init`  | Génère les fichiers du site pour le provider retenu. `--dry-run`, `--force`. |
| `klee docs serve` | Sert la documentation en local, avec rechargement à chaud.                   |
| `klee docs build` | Construit la version statique.                                               |

`serve` et `build` régénèrent `docs/_generated/tracabilite.md` au préalable : une vue présente
mais périmée serait pire qu'absente.

`init` est le chemin de mise à niveau d'un projet scaffoldé avant la phase 3 : le point `docs`
n'est rattaché à aucun module, donc `klee module add` ne peut pas l'atteindre.

Le provider `markdown-only` ne génère aucun site — `klee docs serve` le dit alors clairement
plutôt que d'échouer sur un fichier manquant (ADR 0011).

## `klee tokens build`

Régénère `design-system/dist/` à partir de `design-system/tokens.json`.

## `klee mockups serve` · `klee mockups build`

Sert les maquettes en local avec navigation entre les pages, ou en produit la version statique.

### Ce que le projet généré sait faire sans klee

`klee init` produit un workspace autonome, avec ses commandes de racine :

| Commande                  | Effet                                                                            |
| ------------------------- | -------------------------------------------------------------------------------- |
| `pnpm install`            | Installe les dépendances déclarées                                               |
| `pnpm dev`                | Lance les tâches longues de chaque package — aujourd'hui le serveur de maquettes |
| `pnpm build`              | Construit tout, dans l'ordre : les tokens avant les maquettes qui les consomment |
| `pnpm test` · `pnpm lint` | Agrègent les tâches de chaque package                                            |

L'ordre de `build` n'est pas une convention d'écriture : `mockups/` déclare une dépendance de
workspace vers `design-system/`, et l'orchestrateur en déduit l'arête. Le `package.json` racine
épingle aussi le gestionnaire de paquets — Turborepo refuse de résoudre un workspace sans ce
champ.

Ces trois commandes **ne font que lancer les scripts du projet**, avec le gestionnaire de
paquets déclaré par son provider `workspace` et le bon répertoire de travail. Klee n'embarque
ni Style Dictionary ni Eleventy : `design-system/` et `mockups/` ont leur propre `package.json`.
Un projet Klee reste donc utilisable sans klee installé — `pnpm run build` depuis
`design-system/` fait exactement la même chose (cf ADR 0006).

Elles exigent que le module `mockups` soit retenu, et propagent le code de sortie du script.

## `klee ticket`

| Commande                         | Effet                                                 |
| -------------------------------- | ----------------------------------------------------- |
| `klee ticket create <titre>`     | Crée un ticket markdown et lui alloue un identifiant. |
| `klee ticket list`               | Liste les tickets, groupés par statut.                |
| `klee ticket move <id> <statut>` | Fait transiter un ticket.                             |
| `klee ticket show <id>`          | Affiche un ticket, ses liens et son corps.            |

Options de `create` : `--status`, `--assignee`, `--depends-on <ids...>`, `--mockup <ids...>`,
`--doc <ids...>`, `--description`, et `--agent` pour marquer la provenance (§7).
Options de `list` : `--status`, `--assignee`, `--json`.

Statuts : `backlog` → `ready-for-dev` → `in-progress` → `in-review` → `done`. Ils ne sont pas
configurables (cf ADR 0008).

`list` signale les tickets dont une dépendance n'est pas terminée : c'est ce qui évite qu'un
agent en prenne un en pensant pouvoir avancer.

## `klee board`

Kanban local des tickets, sur `http://127.0.0.1:4321` (`--port` pour en changer).

Créer et déplacer un ticket ne demande **aucun terminal** (DESIGN.md §5), et le board
fonctionne **sans JavaScript** : chaque action est un formulaire, ce qui le rend accessible au
clavier par construction. Il n'écoute que sur la boucle locale et n'a aucun état propre —
les fichiers de `tickets/` restent la source de vérité, éditables à la main pendant qu'il
tourne. `GET /api/tickets` expose la même liste en JSON, pour un agent ou un script.

Chaque identifiant affiché est cliquable : `/links` montre tout le graphe, `/links/<id>` le
voisinage d'un artefact avec les fichiers qui déclarent chaque arête.

Le board est aussi l'onglet Board de `klee studio`, et reste utilisable seul.

## `klee studio`

Cockpit unifié, sur `http://127.0.0.1:4300` (`--port` pour en changer) : le board, le site de
documentation et les maquettes derrière une entrée unique (TECHNICAL.md §9).

**Une seule application, plusieurs serveurs.** Le studio lance les serveurs existants et les
affiche dans des cadres, chacun sur son port et avec son rechargement à chaud. Il ne les
remplace pas et ne les reconfigure pas : `klee board`, `klee docs serve` et
`klee mockups serve` restent de premier rang, pour qui veut publier sa documentation sans
embarquer le cockpit (ADR 0014, ADR 0016).

**Un onglet n'existe que si son module est retenu.** Un projet sans `mockups` n'a pas
d'onglet Maquettes ; un projet dont le provider `docs` est `markdown-only` n'a pas d'onglet
Docs — pas un onglet vide. Un serveur qui ne démarre pas n'empêche pas les autres : son
onglet affiche la raison.

**Le studio ouvre le navigateur sur lui-même** (`--no-open` pour s'en passer), et fait taire
celui de Docusaurus : un serveur lancé en arrière-plan n'ouvre jamais de fenêtre.

**Les ports des serveurs agrégés sont assignés par le studio**, jamais laissés au hasard :
sur un port occupé, Docusaurus s'arrête et Eleventy annonce une URL qu'il n'a pas obtenue.

### `GET /go/<ID>`

Ouvre n'importe quel identifiant dans le bon onglet, à la bonne page :

| Identifiant | Onglet    | Page                                        |
| ----------- | --------- | ------------------------------------------- |
| `PROJ-123`  | Board     | le voisinage du ticket dans le graphe       |
| `DOC-018`   | Docs      | le document, à son emplacement dans le site |
| `MOCK-004`  | Maquettes | la page de la maquette                      |

La page est **vérifiée avant d'être ouverte** : une URL déduite qui ne répond pas fait
retomber sur l'accueil de l'onglet, en le disant plutôt qu'en affichant un cadre vide.

## Ports

Quatre commandes ouvrent un port : `board`, `docs serve`, `mockups serve` et `studio`. Toutes
suivent la même règle, parce que deux projets Klee ouverts en parallèle est le cas ordinaire.

| Cas                    | Comportement                            |
| ---------------------- | --------------------------------------- |
| `--port <n>` libre     | klee prend ce port                      |
| `--port <n>` occupé    | la commande échoue en nommant le port   |
| port par défaut libre  | klee prend ce port                      |
| port par défaut occupé | klee en prend un autre **et l'annonce** |

Un port nommé est honoré ou refusé : le déplacer trahirait la raison qu'on avait de le
nommer. Un port par défaut n'est qu'une préférence. Ce qui est proscrit dans tous les cas,
c'est de changer de port **sans le dire** — c'est ainsi qu'on finit par regarder le serveur
d'un autre projet en croyant regarder le sien.

Les ports par défaut des serveurs générés viennent du provider qui les apporte
(`devServer.defaultPort`), pas de klee : 3000 pour Docusaurus, 8080 pour Eleventy.

## Codes de sortie et erreurs

`0` en succès, `1` en erreur, `130` si l'utilisateur interrompt une question.

Une erreur attendue — configuration invalide, module inconnu, preset inconnu, conflit de
fichiers — est affichée avec un message et une piste de résolution, sans trace d'appel : ce
n'est pas un bug, c'est une réponse à corriger. Une erreur inattendue affiche sa stack.

| Code                                                       | Situation                                             |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `ALREADY_INITIALIZED`                                      | `project.config.json` existe déjà dans la cible       |
| `NOT_A_TTY`                                                | Mode interactif demandé hors terminal                 |
| `PRESET_UNKNOWN` / `MODULE_UNKNOWN` / `MODULE_CORE`        | Argument invalide                                     |
| `PROVIDER_OPTION_INVALID`                                  | `--provider` mal formé (attendu `<point>=<id>`)       |
| `PROVIDER_UNKNOWN`                                         | La configuration référence un provider non enregistré |
| `CONFIG_NOT_FOUND` / `CONFIG_MALFORMED` / `CONFIG_INVALID` | Problème de `project.config.json`                     |
| `SCAFFOLD_CONFLICT`                                        | Des fichiers existants diffèrent du plan              |
| `NODE_NOT_FOUND`                                           | `klee links show` sur un identifiant inconnu          |
| `DOCS_SITE_MISSING`                                        | `klee docs serve` sans site généré                    |
| `DOC_INVALID` / `MOCKUP_INVALID`                           | Frontmatter de doc ou `.meta.yml` mal formé           |
