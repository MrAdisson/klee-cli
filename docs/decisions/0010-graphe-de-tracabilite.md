---
id: DOC-012
related_tickets: [KLEE-001]
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0010 — Le graphe de traçabilité : arêtes, mentions, vérification

## Contexte

Le différenciant annoncé du projet est le graphe qui relie un ticket à une maquette, une
maquette au composant qui l'implémente, un ticket à la doc concernée (`TECHNICAL.md` §7).
L'ADR 0003 a fixé la forme des identifiants et `extractIds` existe depuis la phase 0, testée.

Elle n'avait jamais lu un fichier réel. Le graphe restait une convention écrite dans des
`AGENTS.md`, sans personne pour la vérifier.

Restaient à trancher : quelles déclarations font une arête, ce qu'est un identifiant
rencontré dans du texte, comment les deux sens d'un lien se résolvent, et ce qu'une
vérification a le droit de refuser.

## Décisions

### Un seul vocabulaire d'arête, pour les trois natures d'artefact

`related_tickets`, `related_mockups`, `related_docs` — dans le frontmatter d'un ticket, dans
celui d'une doc, et dans le `.meta.yml` d'une maquette.

C'est un écart à la lettre de `TECHNICAL.md` §4, qui écrit `ticket: PROJ-123` au singulier.
Trois artefacts avaient jusqu'ici trois conventions : `depends_on` / `related_*` pour un
ticket, `related_tickets` / `related_mockups` pour une doc, `ticket` scalaire pour une
maquette. Tout lecteur du graphe aurait porté un cas particulier par type de fichier, à vie,
et en aurait oublié un.

§13 tranche dans ce sens : « pour tout le reste — schéma d'ID, format de frontmatter §7,
topologie — une seule convention est imposée, la cohérence transverse prime sur la
flexibilité, car ces points structurent le graphe de traçabilité ».

`ticket:` reste **lu** comme un alias, pour ne pas casser les projets scaffoldés en phase 1.
Il n'est plus écrit.

### Une arête déclarée d'un côté vaut des deux

`related_docs: [DOC-018]` dans un ticket et `related_tickets: [PROJ-123]` dans la doc
décrivent **la même arête**. Le graphe la compte une fois, en mémorisant les fichiers qui la
déclarent.

Aucune symétrie n'est exigée. C'était l'autre option — demander aux deux extrémités de se
répondre, et signaler l'asymétrie — et elle a été écartée : elle aurait créé une
synchronisation à tenir entre deux fichiers, c'est-à-dire exactement la dérive que ce projet
existe pour supprimer. Déclarer un lien à un seul endroit doit suffire ; le déclarer aux deux
ne doit rien coûter.

`depends_on` fait exception et reste **orienté** : « A dépend de B » n'est pas « B dépend de
A », et le board a besoin de la différence pour dire ce qui bloque quoi.

### Une mention n'est pas une arête, et le code n'est pas de la prose

Un identifiant croisé dans du texte libre est une **mention** : elle rend le texte cliquable
(`DESIGN.md` §5) et signale un lien qu'on a peut-être oublié de déclarer. Elle n'engage
personne et ne fait échouer aucune vérification.

Les identifiants situés dans un bloc de code ou entre backticks sont **ignorés**. Ce n'est pas
un raffinement : branchée telle quelle sur ce dépôt, l'extraction a produit six mentions, dont
six faux positifs — les exemples pédagogiques des ADR (`KLEE-123`, `MOCK-042`), des
identifiants qui n'existent pas et n'ont aucune raison d'exister. Un identifiant écrit dans du
code est un échantillon, une commande ou un extrait de fichier.

### `implemented_in` n'est pas une arête

À l'autre bout il y a un chemin de fichier, pas un identifiant. C'est une propriété de la
maquette. La comparer au code réel est la détection de dérive de la phase 4 (§7), et n'a rien
à faire dans une vérification de liens.

### Aucun index, aucun cache

Le graphe est recalculé à chaque lecture, à partir des fichiers qui font foi. C'est la
position de l'ADR 0008 pour les tickets, appliquée telle quelle : un état dérivé qu'on stocke
est un état qu'il faut invalider. Les tickets passent par l'index configuré quand il y en a
un ; docs et maquettes se lisent directement.

### Ce que `klee links check` refuse, et ce qu'il signale

| Cas                                                               | Gravité       |
| ----------------------------------------------------------------- | ------------- |
| Une arête déclarée pointe vers un artefact inexistant             | erreur        |
| Deux fichiers revendiquent le même identifiant                    | erreur        |
| `depends_on` vise autre chose qu'un ticket                        | erreur        |
| Un fichier porte un identifiant qui ne correspond pas à sa nature | erreur        |
| Une mention pointe vers un artefact inexistant                    | avertissement |
| Une doc de `docs/` n'a pas d'`id`                                 | avertissement |

Une erreur donne un code de sortie non nul : la commande est utilisable en CI. Les
avertissements ne bloquent rien — citer un ticket archivé dans une phrase ne doit pas casser
une construction.

### `docs/_generated/` est une vue du graphe, pas un membre du graphe

La page produite par `klee links report` n'a **pas** d'identifiant, et le lecteur du graphe
écarte le dossier. S'en donner un ferait entrer le rapport dans le graphe qu'il décrit, et
chaque régénération y ajouterait ses propres arêtes.

Elle est **versionnée**, contrairement à `design-system/dist/` : un diff qui montre une arête
apparue ou disparue est un signal de revue, là qu'une feuille CSS générée n'est lue par
personne. Elle ne porte donc **aucun horodatage** — un fichier généré qui produit un diff sans
qu'aucune source ait changé finit par être régénéré au hasard des commits, puis ignoré.

### `klee init` sème un premier ticket

Le scaffolding écrivait `ticket: PROJ-001` dans les `.meta.yml` des maquettes sans créer aucun
ticket. La sortie de `klee init` contenait donc deux liens cassés, alors que le
`tickets/AGENTS.md` qu'elle génère interdit noir sur blanc d'inventer un lien vers ce qui
n'existe pas. Le premier `klee links check` d'un projet neuf aurait échoué sur Klee lui-même.

Le ticket semé rend la référence résolvable et donne la seule chose qu'une convention écrite
ne donne jamais : un exemple complet, que `klee links` affiche à la première commande.

## Conséquences

- Les identifiants deviennent vérifiables mécaniquement : `klee links check` est utilisable en
  CI, et `tickets/AGENTS.md` cesse d'énoncer une règle que rien n'appliquait.
- Le board rend cliquable chaque identifiant qu'il affiche (`/links/<id>`) : suivre le graphe
  ne demande plus de terminal, ce qui était la condition d'adoption de `DESIGN.md` §5.
- `klee ticket show` affiche ce qui pointe vers un ticket sans que son frontmatter le sache.
- Les projets scaffoldés en phase 1 continuent d'être lus grâce à l'alias `ticket:`. Ils
  gagnent le vocabulaire commun dès qu'on réécrit leurs `.meta.yml`, sans urgence.
- Le graphe se recalcule intégralement à chaque appel. C'est tenable sur des corpus de
  quelques milliers de fichiers ; au-delà, ce sera un provider, pas une exception.
