---
id: DOC-019
related_tickets: [KLEE-005]
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0016 — Le studio encadre les serveurs plutôt que de les proxifier

## Contexte

L'ADR 0014 a posé que le studio **agrège** les serveurs existants sans les remplacer, et a
laissé une question ouverte : par quel transport ? Reverse-proxy HTTP sous une origine unique,
ou cadre (`iframe`) par onglet.

Le proxy est le plus attirant sur le papier : une seule origine, de vrais deep links, une URL
qui décrit ce qu'on regarde. La question a donc été instruite sur les serveurs réels.

**Ce que les deux serveurs émettent :**

```
Docusaurus : src="/runtime~main.js"  src="/main.js"  href="/styles.css"
Eleventy   : href="/base.css"  src="/.11ty/reload-client.js"  href="/design-system/css/tokens.css"
```

Tous ces chemins sont **absolus depuis la racine**. Monter ces serveurs sous `/docs/` et
`/mockups/` les casserait tous — sauf à leur imposer un préfixe, `baseUrl` chez Docusaurus et
`pathPrefix` chez Eleventy.

C'est là que le proxy se disqualifie : ce préfixe vit dans les fichiers de configuration
**générés dans le projet de l'utilisateur**. Il faudrait donc que chaque projet configure ses
serveurs pour le studio, que chaque provider apporte son mécanisme de préfixe, et que les
projets déjà scaffoldés régénèrent leur configuration. Autrement dit : rendre les serveurs
dépendants du studio, exactement ce que l'ADR 0014 refuse — « les commandes individuelles
restent de premier rang ».

Vérification faite, aucun des deux serveurs n'émet `X-Frame-Options` ni
`Content-Security-Policy: frame-ancestors` : rien ne s'oppose au cadre.

## Décisions

### Chaque onglet est un cadre vers le serveur, sur son origine

Le studio sert une coquille — barre d'onglets et résolution des liens — et rien d'autre. Le
contenu vient de chaque serveur, sur son port. Aucune configuration n'est demandée aux
serveurs agrégés : ils ne savent pas que le studio existe.

Le prix est assumé : la barre d'adresse montre l'URL du studio, pas celle de la page cadrée,
et le studio ne peut pas lire la navigation interne d'un cadre d'une autre origine. Pour un
outil de poste de travail, c'est un coût inférieur à celui d'une configuration couplée.

### Le studio assigne les ports, il ne les subit pas

Chaque serveur enfant reçoit un port que le studio vient d'obtenir du système. La raison est
mesurée, pas théorique :

| Serveur    | Sur un port déjà pris                                                              |
| ---------- | ---------------------------------------------------------------------------------- |
| Docusaurus | **s'arrête** — il propose un autre port, et sans terminal pour répondre, abandonne |
| Eleventy   | **glisse en silence** sur le port suivant                                          |

Les deux comportements sont mauvais pour un cockpit, et le second est le pire : on croit
regarder son propre serveur. Un développeur qui a n'importe quoi sur le port 3000 — la
situation ordinaire — verrait sinon son onglet Docs mort.

La connaissance du drapeau vit chez le provider (`Provider.devServer`), pas dans le studio :
c'est le provider qui sait quel serveur il installe. Même règle que `installScripts` en
ADR 0012. Un provider qui n'apporte aucun serveur — `markdown-only` — n'a pas d'onglet.

### Un port nommé est honoré ou refusé ; un port par défaut cède, à voix haute

La même règle vaut pour `klee board`, `klee docs serve`, `klee mockups serve` et
`klee studio` — deux projets Klee ouverts en parallèle est le cas ordinaire, pas le cas
limite.

- **Port nommé** (`--port`) : honoré s'il est libre, refusé sinon. Quelqu'un qui nomme un
  port a une raison ; le déplacer en douce trahirait cette raison.
- **Port par défaut** : une préférence, pas une exigence. S'il est pris, klee en prend un
  autre — et **le dit**.

Le danger n'a jamais été de changer de port : c'est de changer **sans le dire**, et de
laisser croire qu'on regarde son propre projet. C'est le glissement silencieux d'Eleventy,
pas le glissement lui-même, qui est le défaut.

Le port du studio s'ouvre **avant** de démarrer quoi que ce soit : échouer en dernier
laissait tourner un Docusaurus que plus personne n'arrêtait.

### Un port se teste des deux façons dont il peut être pris

Sonder le port en s'y liant est le seul test qui vaille — mais une seule sonde ne suffit pas.
Mesuré sur macOS :

| Détenteur du port                 | Sonde `127.0.0.1` | Sonde joker     |
| --------------------------------- | ----------------- | --------------- |
| `127.0.0.1` — le board, le studio | voit occupé       | **croit libre** |
| `*` — Eleventy, Docusaurus        | **croit libre**   | voit occupé     |

Chaque sonde rate exactement le cas que l'autre attrape. Avec la seule sonde de boucle
locale, klee lançait un second serveur de maquettes en le croyant sur 8080, et c'est Eleventy
qui glissait sur 8081 — en silence, c'est-à-dire le défaut même que ce mécanisme existe pour
empêcher. Un port n'est donc libre que si **les deux** liaisons réussissent.

### Une commande ouvre le navigateur, un serveur qu'elle a lancé ne le fait jamais

`klee studio` ouvre le navigateur sur le studio (`--no-open` pour s'en passer). Les serveurs
qu'il démarre en arrière-plan reçoivent au contraire les arguments qui les en empêchent —
`Provider.devServer.embedArgs`, soit `--no-open` pour Docusaurus.

Sans cette distinction, `klee studio` ouvrait un onglet sur la **documentation** : Docusaurus
ouvre un navigateur à son démarrage, ce qui est le bon geste pour `klee docs serve` et le
mauvais quand il est lancé pour le compte d'un autre. La règle est celle du commanditaire :
c'est la commande que l'utilisateur a tapée qui décide d'ouvrir une fenêtre.

### Un identifiant mène à l'artefact, pas à sa fiche

Servi seul, le board ne sait montrer qu'une chose d'un `MOCK-002` : sa fiche dans le graphe.
C'est tout ce qu'il a. Intégré au studio, il peut faire mieux — et doit : cliquer sur une
maquette pour lire une description de la maquette est précisément ce que `DESIGN.md` §5
reproche aux « liens croisés qui restent du texte brut ».

Le studio passe donc son URL au board (`studioUrl`), qui rend alors ses identifiants vers
`/go/<id>` avec `target="_top"` — sortir du cadre, sans quoi le studio s'afficherait dans son
propre onglet Board. Servi seul, le board garde ses liens internes : la même page se rend
différemment selon l'endroit d'où on la lit, et aucune des deux formes n'est dégradée.

C'est ce qui fait la différence entre un cockpit et trois serveurs côte à côte.

### Une URL déduite est vérifiée avant d'être ouverte

`/go/<ID>` déduit la page d'un identifiant à partir du chemin de son fichier, puis **demande
la page** au serveur concerné avant d'y envoyer qui que ce soit. Les conventions d'URL de
Docusaurus et d'Eleventy ne nous appartiennent pas : les déduire est légitime, les supposer
justes ne l'est pas. Une déduction fausse retombe sur l'accueil de l'onglet, en le disant.

Ce garde-fou a servi le jour même : le nœud d'une maquette porte le chemin de son
`.meta.yml`, et la première déduction produisait `/components/button/button.meta/`.

## Conséquences

- `Provider.devServer` — `{ script, portFlag, defaultPort, embedArgs? }` — s'ajoute à
  l'interface. Un provider qui apporte un serveur de développement le déclare ; les autres
  n'ont rien à faire.
- `klee board`, `klee docs serve` et `klee mockups serve` acceptent `--port`. Avant, un port
  occupé produisait une trace de pile pour le board, une question sans réponse possible pour
  Docusaurus, et pour Eleventy **l'annonce d'une URL qu'il n'avait pas obtenue** avant de
  mourir.
- Les arguments passent **sans `--`** : pnpm 12 avale le séparateur, et le drapeau n'atteint
  jamais le serveur. Vérifié dans les deux formes ; c'est invisible à la lecture.
- Un onglet dont le serveur n'a pas démarré affiche la dernière ligne d'erreur de l'enfant,
  et les autres onglets continuent de fonctionner.
- L'arrêt tue le **groupe** de processus : `pnpm run dev` n'est qu'un intermédiaire, et ne
  tuer que lui laisserait le vrai serveur vivant sur son port.
- Le studio reste sans état, sans authentification, et n'écoute que la boucle locale.
- La recherche transverse (KLEE-006) s'appuiera sur le même résolveur `/go/<ID>`.
