---
id: DOC-014
title: Graphe de traçabilité
related_tickets: [KLEE-001]
related_mockups: []
---

# Graphe de traçabilité

Le graphe relie les trois natures d'artefact d'un projet Klee — ticket, maquette, document —
et rend leurs références vérifiables. C'est ce qui distingue Klee d'un ticketing markdown, d'un
dossier de maquettes et d'un site de docs installés côte à côte.

Les décisions qui le fondent sont dans [`0003-schema-identifiants.md`](../decisions/0003-schema-identifiants.md)
pour les identifiants, et dans [`0010-graphe-de-tracabilite.md`](../decisions/0010-graphe-de-tracabilite.md)
pour les arêtes.

## Ce qui fait un nœud

| Nature   | Fichier lu                 | Identifiant    |
| -------- | -------------------------- | -------------- |
| Ticket   | `tickets/<PREFIX>-xxx*.md` | `<PREFIX>-xxx` |
| Maquette | `mockups/**/*.meta.yml`    | `MOCK-xxx`     |
| Document | `docs/**/*.md`             | `DOC-xxx`      |

Sont écartés : les `AGENTS.md` (contexte d'agent, pas documentation), la racine de `docs/`
(page d'accueil du site), et `docs/_generated/` — qui est une _vue_ du graphe, pas un membre.

Une doc sans `id` n'est pas une erreur de lecture : elle est signalée à part, parce que rien
ne peut la référencer.

## Ce qui fait une arête

Un seul vocabulaire, dans les trois natures de fichier :

```yaml
related_tickets: [KLEE-012]
related_mockups: [MOCK-042]
related_docs: [DOC-018]
depends_on: [KLEE-011] # tickets uniquement, et orienté
```

**Une arête déclarée d'un côté vaut des deux.** Un ticket qui déclare `related_docs: [DOC-018]`
est lié à cette doc, que la doc le déclare ou non ; si les deux le déclarent, c'est la même
arête, pas deux. Il n'y a donc aucune symétrie à maintenir.

`depends_on` fait exception : « A dépend de B » n'est pas « B dépend de A ».

`implemented_in`, dans le `.meta.yml` d'une maquette, n'est pas une arête — à l'autre bout il
y a un chemin de fichier, pas un identifiant. Sa comparaison au code réel est la détection de
dérive de la phase 4.

## Mentions

Un identifiant croisé dans le **texte** d'un ticket ou d'une doc est une _mention_. Elle rend
le texte cliquable et signale un lien peut-être oublié ; elle n'engage rien.

Les identifiants situés dans un bloc de code ou entre backticks sont ignorés : un identifiant
écrit dans du code est un échantillon, pas une référence.

## Commandes

```bash
klee links              # tout le graphe, par nature d'artefact
klee links --json       # la même chose, pour un agent ou un script
klee links show DOC-018 # voisinage d'un identifiant, dans les deux sens
klee links check        # vérifie que tout lien déclaré mène quelque part
klee links report       # (ré)écrit docs/_generated/tracabilite.md
```

`klee links check` sort en `1` dès qu'il trouve une **erreur** : arête déclarée vers un
artefact inexistant, identifiant revendiqué deux fois, `depends_on` vers autre chose qu'un
ticket, fichier dont l'identifiant ne correspond pas à sa nature. Les **avertissements** —
mention vers un artefact inexistant, doc sans `id` — n'affectent pas le code de sortie.

C'est la commande à mettre en CI.

## Dans le board

`klee board` rend chaque identifiant cliquable : `/links/<id>` affiche le voisinage d'un
artefact, dans les deux sens, avec les fichiers qui déclarent chaque arête. Suivre le graphe
ne demande pas de terminal — c'est la condition d'adoption posée par `DESIGN.md` §5.

## Dans le site de documentation

`klee links report` écrit `docs/_generated/tracabilite.md`, publié par le site sous la
catégorie « Généré par Klee ». `klee docs serve` et `klee docs build` la régénèrent au
préalable : une vue présente mais périmée serait pire qu'absente.

Le fichier est versionné. Un diff qui montre une arête apparue ou disparue est un signal de
revue.
