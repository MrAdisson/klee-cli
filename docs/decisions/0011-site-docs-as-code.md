---
id: DOC-013
related_tickets: [KLEE-002]
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0011 — Site docs-as-code : Docusaurus, en une seule instance

## Contexte

`TECHNICAL.md` §5 veut `docs/` servi par un générateur de site docs-as-code, et §13 en fait un
point de provider dont le défaut est Docusaurus. Le choix était enregistré depuis la phase 0 :
`project.config.json` de ce dépôt annonce `"docs": "docusaurus"` depuis le premier commit.

Rien ne l'exécutait. C'est précisément la faute que `.agents/AGENTS.md` documente depuis la
phase 1 — « ne jamais livrer une configuration qu'on n'a pas exécutée » — appliquée à une
configuration qui n'existait même pas.

## Décisions

### Le site vit dans `docs/`, comme membre du workspace

`docs/package.json`, `docs/docusaurus.config.mjs`, `docs/sidebars.mjs`. C'est la convention
déjà posée par `design-system/` et `mockups/`, qui portent chacun le leur : Klee n'embarque
pas l'outil, le projet le possède (ADR 0006). `docs/build/` et `docs/.docusaurus/` sont
ignorés par git.

`TECHNICAL.md` et `DESIGN.md` ne sont **pas** servis. Ils vivent à la racine par décision,
sont exclus de Prettier, et appartiennent à leur auteur. Les copier ou les symlinker dans
`docs/` recréerait la dérive qu'on combat.

### Une seule instance de `plugin-content-docs`, enracinée sur `docs/`

La première version en déclarait une par module de documentation : une instance `technical`,
une `decisions`, une `product`. C'était plus fidèle à l'axe 1 de §13 — un module non retenu ne
produit ni route ni entrée de navigation.

Elle a été abandonnée après avoir cassé la construction sur les ADR réels. Docusaurus ne
résout les liens relatifs de fichier à fichier qu'**à l'intérieur d'une même instance** :
`docs/technical/project-config.md` cite `../decisions/0002-modules-et-providers.md`, un lien
qui fonctionne sur une forge, et le site le déclarait cassé. Le seul contournement aurait été
d'écrire des chemins de site absolus — c'est-à-dire de faire choisir chaque document entre
être lisible en fichier et être lisible dans le site.

« Everything lives in the codebase » tranche : le fichier d'abord. Les sections sont donc des
catégories du sommaire, nommées par un `_category_.json`, et `_generated/` y est isolé comme
l'exige la distinction _authored_ / _générée_ de §5.

### Le champ `id` du frontmatter est celui de Docusaurus, et c'est voulu

`id: DOC-018` — imposé par §5 — est aussi le champ qui, chez Docusaurus, détermine
l'identifiant du document et sa route. La collision est réelle et elle a été conservée : l'URL
d'une doc devient `/decisions/DOC-010` plutôt que `/decisions/0008-format-des-tickets`.

C'est un lien profond mécanique, dérivable d'un identifiant sans table de correspondance —
exactement ce dont le cockpit de la phase 4 a besoin (`DESIGN.md` §5). Les liens relatifs
entre fichiers continuent de fonctionner : Docusaurus les résout vers l'URL réelle du
document cible.

### Pas de MDX

`markdown.format: 'detect'` fait lire les `.md` en CommonMark. Sans ça, une doc contenant
`<Composant>` ou une accolade en prose casse la construction du site — une documentation ne
doit pas devenir illisible pour du JSX qu'elle n'utilise pas.

Le plugin `pages` est désactivé et la page d'accueil est un document markdown ordinaire
(`docs/index.md`, `slug: /`). Le plugin n'accepte en pratique que du MDX : une page `.md`
n'expose pas les métadonnées qu'attend le thème, et une page `.mdx` fait échouer la
compilation — y compris réduite à trois lignes. Klee n'a aucun besoin de JSX dans sa
documentation.

### `docs/package.json` ne déclare pas `"type": "module"`

Contrairement à tous les autres packages générés. Le bundle serveur que produit Docusaurus est
du CommonJS : déclarer le package en ESM le fait charger comme un module ES, et la
construction échoue sur un `require.resolveWeak is not a function` que rien ne relie à sa
cause. Les deux fichiers de configuration portent l'extension `.mjs` et restent donc en ESM.

### Un provider `markdown-only`, pour ne pas imposer React au socle

Le point `docs` n'est rattaché à aucun module optionnel : il s'applique à tout projet. Sans
sortie, `klee init --preset internal-lib` — une petite bibliothèque interne dont les quelques
ADR se lisent parfaitement sur une forge — aurait embarqué React et la chaîne de construction
de Docusaurus.

`markdown-only` ne génère rien. Ce n'est pas un provider concurrent au sens de §13, c'est une
sortie ; le défaut reste Docusaurus, comme l'annonce le tableau de §13. C'est le même
raisonnement qu'à l'ADR 0008 pour l'index de tickets : l'outillage se justifie par le corpus,
il ne s'impose pas par le socle.

### `klee docs init` est le chemin de mise à niveau

Le point `docs` ne dépend d'aucun module, donc `klee module add` ne peut pas l'atteindre : un
projet scaffoldé aux phases 0 à 2 n'aurait jamais obtenu son site. `klee docs init` génère les
fichiers du provider retenu, avec la même détection de conflit que `klee init`.

La vue du graphe n'en fait **pas** partie : son contenu appartient à `klee links report`, que
`klee init` appelle après le scaffolding. Le scaffolder n'en poserait qu'un brouillon, que la
première régénération ferait diverger — et tout `klee docs init` ultérieur échouerait alors
sur un conflit parfaitement légitime.

### Les scripts de post-installation sont tranchés dans `pnpm-workspace.yaml`

pnpm refuse d'ignorer un script de post-installation en silence : sans déclaration,
`pnpm install` **échoue** sur un projet neuf, parce que Docusaurus tire `core-js`. La clé
`allowBuilds` liste les scripts connus et la décision prise pour chacun. Un script nouveau
fera échouer l'installation de la même façon, et c'est voulu — exécuter du code à
l'installation reste une décision humaine.

## Conséquences

- Ce dépôt sert sa propre documentation : `klee docs serve`. La configuration ne peut plus
  mentir, puisque `pnpm build` la réexécute.
- Le coût est porté par les contributeurs de ce dépôt et par les projets qui gardent le
  provider : React entre dans leur `node_modules`, jamais dans l'arbre de dépendances de la
  CLI publiée.
- La distinction _authored_ / _générée_ de §5 cesse d'être déclarative : `_generated/` existe,
  est isolé dans le sommaire, et son contenu est produit par une commande.
- `onBrokenLinks: 'throw'` fait de tout lien interne cassé une erreur de construction. C'est le
  même engagement que `klee links check` pour les identifiants, appliqué aux liens de fichier
  à fichier — et c'est lui qui a révélé la limite des instances multiples.
