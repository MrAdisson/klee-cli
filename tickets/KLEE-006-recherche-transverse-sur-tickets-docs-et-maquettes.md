---
id: KLEE-006
title: Recherche transverse sur tickets, docs et maquettes
status: in-review
assignee: null
created: 2026-09-09
updated: 2026-09-09
depends_on: []
related_mockups: []
related_docs: []
authored_by: human
---

Une seule recherche sur les trois natures de nœud du graphe, avec deep links par identifiant.

`TECHNICAL.md` §9 la place dans le cockpit, et c'est le seul endroit où elle a un sens : le
board ne connaît que les tickets, Docusaurus que les documents, Eleventy que les maquettes.
Chercher les trois d'un coup est précisément ce qu'aucun des trois serveurs ne peut porter
seul — le commentaire d'en-tête du studio l'annonçait déjà comme ce qui lui appartient en
propre.

Elle doit trouver **sur le contenu**, pas seulement sur les titres : chercher « accessibilité »
doit ramener l'ADR qui en parle, même si le mot n'est pas dans son titre. Et elle doit trouver
un identifiant, parce que c'est ainsi qu'on suit une arête quand on ne se souvient plus de
quel côté elle a été déclarée.

Comme le reste du studio, elle fonctionne **sans JavaScript** : un formulaire GET, une page de
résultats. Et en français : chercher « accessibilite » sans accent doit trouver
« accessibilité », sans quoi la recherche est inutilisable au clavier pressé.

## Critères d'acceptation

```gherkin
Scénario: une seule recherche couvre les trois natures d'artefact
  Étant donné un projet dont les modules tickets, docs et mockups sont retenus
  Quand on cherche un terme présent dans un ticket, un document et une maquette
  Alors les résultats des trois natures apparaissent, groupés et distingués

Scénario: la recherche porte sur le contenu, pas seulement sur les titres
  Étant donné un document dont le titre ne contient pas le mot cherché
  Et dont le corps le contient
  Quand on lance la recherche
  Alors le document est trouvé
  Et un extrait montre le passage qui correspond

Scénario: un identifiant se cherche comme un mot
  Étant donné une maquette MOCK-001 citée par un ticket
  Quand on cherche MOCK-001
  Alors la maquette elle-même et le ticket qui la cite sont tous deux trouvés

Scénario: le vocabulaire du format ne pollue pas les résultats
  Étant donné des tickets qui déclarent tous un champ related_mockups
  Quand on cherche « mock »
  Alors les tickets qui n'en parlent que par ce champ ne sont pas trouvés
  Et un ticket qui déclare MOCK-001 dans ce champ reste trouvé en cherchant MOCK-001

Scénario: la recherche ignore les accents et la casse
  Étant donné un document contenant « accessibilité »
  Quand on cherche « ACCESSIBILITE »
  Alors le document est trouvé

Scénario: ce qui porte le terme dans son titre passe devant
  Étant donné un artefact dont le titre contient le terme
  Et un autre qui ne le contient que dans son corps
  Quand on lance la recherche
  Alors le premier est classé avant le second

Scénario: chaque résultat mène à l'artefact réel
  Étant donné une liste de résultats
  Quand on suit celui d'une maquette
  Alors la maquette s'ouvre dans son onglet, à sa page

Scénario: une recherche sans résultat le dit
  Étant donné un terme absent du projet
  Quand on lance la recherche
  Alors la page le dit, sans laisser croire à une erreur

Scénario: la recherche fonctionne sans JavaScript
  Étant donné un navigateur sans JavaScript
  Quand on soumet le formulaire de recherche
  Alors la page de résultats s'affiche
```
