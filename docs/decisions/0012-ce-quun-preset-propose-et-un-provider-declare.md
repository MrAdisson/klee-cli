---
id: DOC-015
related_tickets: [KLEE-003]
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0012 — Ce qu'un preset propose, ce qu'un provider déclare

## Contexte

L'architecture à deux axes (`TECHNICAL.md` §13) répartit les décisions : un **module** est
présent ou absent, un **provider** dit avec quoi un point est réalisé. La phase 3 a fait
apparaître deux endroits où une décision se trouvait mal placée.

**Premier cas.** Le point `docs` n'est rattaché à aucun module optionnel : il s'applique à
tous les projets, et son défaut est Docusaurus. `klee init --preset internal-lib --yes` — une
bibliothèque interne, sans maquettes ni contrats — installait donc React et toute la chaîne de
construction d'un site : **1128 paquets** pour trois ADR qui se lisent très bien sur une forge.
Le provider `markdown-only` (ADR 0011) offre la sortie, mais elle était inatteignable dans ce
scénario : §13 n'accorde au preset que l'axe 1, « il fixe des modules, jamais des providers ».

**Deuxième cas.** pnpm refuse d'exécuter le script de post-installation d'une dépendance sans
permission explicite, et refuse aussi de l'ignorer en silence : sans décision écrite dans
`pnpm-workspace.yaml`, `pnpm install` **échoue**. Or celui qui sait que `core-js` arrive est le
provider Docusaurus ; celui qui possède `pnpm-workspace.yaml` est le provider pnpm + Turborepo.
La liste avait été posée en constante chez le second — c'est-à-dire qu'un provider portait une
connaissance sur un autre, et qu'ajouter un troisième provider apportant un script aurait forcé
à modifier un fichier sans rapport. Exactement ce que l'`AGENTS.md` de ce dépôt proscrit :
« si un ajout de provider oblige à modifier autre chose, c'est le design qui est en cause ».

**Troisième cas.** Une fois le site en place, `pnpm install` sur un projet neuf signalait un
paquet déprécié (`uuid@8.3.2`, quatre niveaux sous Docusaurus) et `pnpm audit` remontait sept
avis de sécurité, tous transitifs. Livrer un scaffolding qui avertit dès sa première commande
est un mauvais accueil, et la connaissance de ce qu'il faut corriger appartient là encore au
provider qui apporte l'arbre.

## Décisions

### Un preset peut _proposer_ un défaut de provider, jamais l'imposer

`PresetDefinition.providerDefaults` déclare, pour les points que le choix de modules ne suffit
pas à trancher, le défaut qui convient à ce genre de projet. `internal-lib` propose
`docs: markdown-only`.

L'ordre de priorité est explicite, du plus fort au plus faible :

1. `--provider <point>=<id>` en ligne de commande, ou la réponse donnée en mode interactif ;
2. la proposition du preset ;
3. le défaut du point (`PROVIDER_POINT_DEFINITIONS`).

C'est un écart assumé à la lettre de §13. Son intention y survit : la règle existe pour que la
CLI ne **confonde** pas les deux axes — elle demande les modules, puis les providers des
modules retenus — pas pour empêcher un preset d'avoir un point de départ sensé. Un preset
décrit un genre de projet ; prétendre qu'un genre de projet n'emporte aucune conséquence sur
l'outillage est une fiction que le cas `internal-lib` a suffi à démentir.

La proposition ne contraint jamais : le mode interactif la **présélectionne** en offrant la
liste complète, et `--provider` la remplace y compris sans terminal. Sans cette option, l'écart
aurait été réel — un projet en CI se serait retrouvé enfermé dans le choix du preset.

### Un provider déclare les scripts de post-installation qu'il apporte

`Provider.installScripts` associe à chaque paquet la décision prise : `true` pour l'exécuter,
`false` pour ne pas l'exécuter. Docusaurus déclare `{ 'core-js': false }`.

Le provider `workspace` interroge le registre pour les points retenus et écrit le résultat dans
son propre fichier. Le sens de la dépendance est le bon : celui qui possède le fichier demande,
celui qui apporte la dépendance répond, et aucun des deux ne connaît l'autre. C'est la même
extension que l'ADR 0008 avait faite avec `Provider.ticketIndex` — un provider peut porter du
comportement, tant qu'il reste derrière une interface commune.

Un script qu'aucun provider ne déclare fait échouer l'installation, et c'est voulu : exécuter
du code à l'installation reste une décision humaine.

### Un provider déclare les versions qu'il impose dans son arbre transitif

`Provider.dependencyOverrides`, écrit par le provider `workspace` dans le fichier qu'il
possède — `overrides:` de `pnpm-workspace.yaml`, ou `overrides` du `package.json` sous npm.

Docusaurus 3.10.2 en déclare trois, et **chacune porte sa portée** :

```yaml
uuid@<11.1.1: ^11.1.1 # déprécié en 8.x, et avis GHSA sous 11.1.1
qs@<6.16.0: ^6.16.0 # deux avis de déni de service
serialize-javascript@<7.0.5: ^7.0.5 # RCE et déni de service
```

La portée n'est pas un détail : un override inconditionnel survivrait à sa raison d'être et
finirait par empêcher une mise à jour légitime de l'amont. Écrit ainsi, il cesse d'agir de
lui-même dès que Docusaurus passe au-delà. npm ne connaissant pas cette forme, le provider nx
la retire — c'est plus large, et c'est le mieux que npm permette.

Ce qui reste : deux avis sur `image-size`, qu'**aucune version publiée ne corrige** — on ne
peut pas imposer ce qui n'existe pas. Ce sont des dénis de service dans des parseurs de
métadonnées, lus à la construction sur les images du projet lui-même : le modèle de menace est
vide pour un site de documentation local. C'est noté ici plutôt que masqué.

Les deux gestes — imposer une version, et ne pas prétendre corriger ce qui ne l'est pas —
relèvent de la même règle que le reste de cet ADR : la décision vit chez celui qui en a la
connaissance, et elle est écrite plutôt que subie.

### Le point `contracts` n'est planifié dans aucune phase

`ProviderPointDefinition.scaffoldingPhase` accepte désormais `null`. Le point `contracts`
portait `3`, un numéro posé au jugé en phase 0 : la roadmap de `TECHNICAL.md` ne situe la
génération de contrats dans aucune phase, et §8 repousse explicitement le sujet à « un usage
réel sur plusieurs projets, pas à figer maintenant par pure symétrie avec les tokens ».

Le champ n'est lu par aucun code — il documente. Lui faire affirmer une phase que le brief ne
prévoit pas est le seul défaut, et `null` le corrige sans en inventer une autre.

**Le module `contracts` ne change pas.** Il produit toujours `contracts/AGENTS.md` et
`contracts/domain/` : les conventions sont posées dès qu'on retient le module. C'est la
génération de schémas par le provider qui attend — vraisemblablement le moment où Klee
scaffoldera du code applicatif client/serveur, là où un contrat d'interface devient utile.

## Conséquences

- `klee init --preset internal-lib --yes` produit un projet à **une** dépendance (`turbo`), avec
  sa documentation en markdown et sans site. Le graphe et `docs/_generated/` fonctionnent
  quand même : ils ne dépendent pas du site.
- `klee init --provider docs=docusaurus --preset internal-lib` reste possible, et un projet
  existant change d'avis en éditant `project.config.json` puis en lançant `klee docs init`.
- Ajouter un provider qui apporte un script de post-installation ne demande de toucher qu'à ce
  provider. Un test le vérifie sur le fichier généré, dans les deux sens : présent quand un
  provider le déclare, absent — pas vide — quand aucun ne le fait.
- `scaffoldingPhase` devient `number | null`. Tout code qui l'afficherait devra traiter le cas ;
  aucun ne le lit aujourd'hui.
- Un projet neuf s'installe **sans un seul avertissement**, et `pnpm audit` n'y remonte plus que
  les deux avis `image-size` sans correctif. Vérifié en installant, en construisant le site et
  en lançant son serveur de développement — c'est là que vivent `uuid` et `qs`, et un override
  de version ne se juge pas à la lecture.
- Ces overrides sont une dette datée : ils décrivent l'état de l'arbre de Docusaurus 3.10.2 en
  septembre 2026. Les relire à chaque montée de version, et retirer ceux que l'amont a repris.
