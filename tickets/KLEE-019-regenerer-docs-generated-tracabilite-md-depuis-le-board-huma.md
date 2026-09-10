---
id: KLEE-019
title: Régénérer docs/_generated/tracabilite.md depuis le board humain
status: done
assignee: null
created: 2026-09-10
updated: 2026-09-10
depends_on: []
related_mockups: []
related_docs: []
authored_by: agent
---

Le rapport de traçabilité (docs/_generated/tracabilite.md) inclut le statut de chaque ticket, mais rien ne le régénérait quand un humain changeait ce statut depuis le board : la désynchronisation la plus fréquente en pratique — passer un ticket de in-review à done — laissait le rapport périmé jusqu'à un klee links report manuel, oublié plus d'une fois. Le board appelle maintenant refreshGraphReport (déjà utilisée par klee init et klee docs serve) après création, édition et déplacement d'un ticket, et après validation d'une maquette. L'édition à la main d'un fichier markdown de ticket reste invisible pour ce mécanisme, mais links:report:check en CI rattrape ce cas rare.

## Critères d'acceptation

```gherkin
Scénario: déplacer un ticket depuis le board régénère le rapport
  Étant donné un ticket créé, sans rapport de traçabilité encore généré
  Quand on déplace ce ticket vers un autre statut depuis le board
  Alors docs/_generated/tracabilite.md existe et porte le nouveau statut

Scénario: créer un ticket depuis le board tient le rapport à jour
  Étant donné le board affiché
  Quand on crée un ticket depuis le formulaire
  Alors docs/_generated/tracabilite.md liste ce ticket

Scénario: éditer la fiche d'un ticket depuis le board tient le rapport à jour
  Étant donné un ticket existant
  Quand on modifie son titre depuis sa page détail
  Alors docs/_generated/tracabilite.md reflète le nouveau titre

Scénario: valider une maquette depuis le board tient le rapport à jour
  Étant donné une maquette en draft, conforme au gate d'accessibilité
  Quand on la fait passer à validated depuis le board
  Alors docs/_generated/tracabilite.md porte son nouveau statut

Scénario: l'édition à la main d'un ticket reste hors du mécanisme
  Étant donné un ticket dont le fichier markdown est édité directement, hors du board
  Alors rien ne régénère automatiquement le rapport
  Et klee links report --check le signale au prochain passage de pnpm run verify
```
