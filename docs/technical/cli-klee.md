---
id: DOC-005
related_tickets: []
related_mockups: []
---

# Référence de la CLI `klee`

État : **phases 0 et 1**. Seules les commandes ci-dessous existent ; `klee ticket` arrive en
phase 2 et `klee studio` en phase 4 (`TECHNICAL.md`).

```
klee [-v | --version] [-h | --help] <commande>
```

## `klee init [directory]`

Crée la structure d'un projet Keel dans `directory` (défaut : le dossier courant).

| Option                 | Effet                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `--name <name>`        | Nom du projet. Défaut : le nom du dossier, normalisé en nom de package npm.             |
| `--id-prefix <prefix>` | Préfixe des identifiants de tickets. Défaut : `PROJ`.                                   |
| `--preset <preset>`    | `full-product` \| `api-service` \| `internal-lib`. Fixe les modules, pas les providers. |
| `-y`, `--yes`          | Aucune question : preset `full-product` (ou celui demandé) et providers par défaut.     |
| `--dry-run`            | Affiche le plan exact sans rien écrire.                                                 |
| `--force`              | Écrase les fichiers existants dont le contenu diffère.                                  |

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

```bash
klee init                                   # interactif
klee init --yes                             # full-product, tous les défauts
klee init ./mon-api --yes --preset api-service --id-prefix ACME
klee init --yes --dry-run                   # inspecter le plan avant d'écrire
```

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
paquets déclaré par son provider `workspace` et le bon répertoire de travail. Keel n'embarque
ni Style Dictionary ni Eleventy : `design-system/` et `mockups/` ont leur propre `package.json`.
Un projet Keel reste donc utilisable sans klee installé — `pnpm run build` depuis
`design-system/` fait exactement la même chose (cf ADR 0006).

Elles exigent que le module `mockups` soit retenu, et propagent le code de sortie du script.

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
| `PROVIDER_UNKNOWN`                                         | La configuration référence un provider non enregistré |
| `CONFIG_NOT_FOUND` / `CONFIG_MALFORMED` / `CONFIG_INVALID` | Problème de `project.config.json`                     |
| `SCAFFOLD_CONFLICT`                                        | Des fichiers existants diffèrent du plan              |
