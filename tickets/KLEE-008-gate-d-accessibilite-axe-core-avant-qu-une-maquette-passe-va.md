---
id: KLEE-008
title: "Gate d'accessibilité : axe-core avant qu'une maquette passe validated"
status: done
assignee: null
created: 2026-09-09
updated: 2026-09-09
depends_on: []
related_mockups: []
related_docs: []
authored_by: agent
---

`DESIGN.md` §6 demande que l'accessibilité « cesse d'être déclarative pour devenir un gate
mécanique » : aucune maquette ne devrait porter `status: validated` sans avoir passé
axe-core. Rien ne le vérifie aujourd'hui — `axe` n'apparaît nulle part dans le dépôt.

Ce n'est pas seulement une exigence non tenue, c'est une **affirmation fausse** : le
scaffolding a longtemps écrit dans l'`AGENTS.md` de chaque projet généré que WCAG 2.1 AA
était « vérifiée au stade maquette ». La phrase a été corrigée pour dire la vérité ; ce
ticket est ce qui permettra de la réaffirmer.

Enjeu au-delà de l'accessibilité : `validated` est la cible du webhook « maquette validée →
ticket `ready-for-dev` » (KLEE-007). Tant que ce statut n'est qu'un mot tapé à la main,
automatiser une transition de ticket dessus reviendrait à propager une déclaration en la
faisant passer pour un fait.

**Point dur à instruire :** axe-core sous jsdom ne sait pas juger le contraste, faute de
layout et de styles calculés — or le contraste est nommé explicitement par `DESIGN.md` §6.
Un vrai navigateur est donc probablement nécessaire, ce qui rejoint le provider Playwright
déjà retenu pour la régression visuelle. À trancher, avec un ADR si le choix engage.

Le gate ne peut pas intercepter la pose du statut : `status: validated` s'écrit en éditant
un `.meta.yml` à la main, jamais par une commande. Il prend donc la forme d'une vérification
à la demande, sur le modèle de `klee links check` : elle constate, et refuse.

## Sévérité, et pourquoi elle ne se configure pas

**Bloquant sur `validated` et `implemented`, rien du tout sur `draft`.** La sévérité n'est
pas un réglage de projet : `TECHNICAL.md` §13 réserve la configuration aux points où deux
solutions se valent, et impose une convention unique partout ailleurs, « la cohérence
transverse prime sur la flexibilité ».

Ce qui rend la contrainte supportable n'est pas un interrupteur, c'est le statut lui-même.
`draft` est libre : un projet qui explore n'est jamais bloqué. Le gate ne mord qu'au moment
où quelqu'un **affirme** que la maquette est prête — et `DESIGN.md` §1 dit ce que cette
affirmation engage : la maquette contient alors 100 % de l'information nécessaire, sans que
celui qui implémente ait rien à inventer. `validated` est un contrat, pas une étape.

## Exemptions : motivées, jamais muettes

Une maquette peut écarter une règle précise, à condition d'écrire pourquoi. Une exemption
sans raison est refusée comme la violation qu'elle couvre.

Ce n'est pas une soupape concédée au gate, c'est le §1 appliqué : sans elle, un contraste
faible dans une maquette validée est indiscernable d'un oubli, et celui qui implémente
improvise — exactement ce que le principe interdit. La raison écrite lui dit que la
dérogation est une décision, pas une négligence.

Elles doivent rester **visibles** : listées par la vérification même quand tout passe. Une
dérogation enterrée dans un YAML que personne ne relit redevient un vœu pieux, et
l'ADR 0015 a déjà tranché qu'un signal qu'on n'entend plus est pire que pas de signal.

## Critères d'acceptation

```gherkin
Scénario: une maquette validée qui viole une règle AA fait échouer la vérification
  Étant donné une maquette en status: validated dont un texte n'atteint pas le contraste AA
  Quand on lance la vérification d'accessibilité
  Alors elle sort en code non nul
  Et elle nomme la règle enfreinte, le fichier et l'élément fautif

Scénario: le contraste est réellement évalué, pas seulement le balisage
  Étant donné une maquette dont la seule violation est un contraste insuffisant
  Quand on lance la vérification
  Alors cette violation est signalée
  # Ce scénario disqualifie une exécution sous jsdom, qui ne calcule aucun style.

Scénario: une maquette en brouillon n'est pas tenue à l'exigence
  Étant donné une maquette en status: draft qui viole une règle AA
  Quand on lance la vérification
  Alors elle sort en code 0
  Et la violation est rapportée comme un avertissement, pas comme une erreur

Scénario: une maquette implémentée reste tenue
  Étant donné une maquette en status: implemented qui viole une règle AA
  Quand on lance la vérification
  Alors elle sort en code non nul

Scénario: la vérification porte sur le rendu, pas sur la source
  Étant donné une maquette dont le markup provient d'une macro Nunjucks
  Quand on lance la vérification sans avoir construit les maquettes au préalable
  Alors les maquettes sont construites avant d'être auditées

Scénario: un projet sans maquettes n'a rien à vérifier
  Étant donné un projet dont le module mockups n'est pas retenu
  Quand on lance la vérification
  Alors elle le dit et sort en code 0, sans exiger aucune dépendance

Scénario: une exemption motivée laisse passer la maquette
  Étant donné une maquette validated qui écarte color-contrast avec une raison écrite
  Quand on lance la vérification
  Alors elle sort en code 0
  Et l'exemption est listée dans le rapport, avec sa raison

Scénario: une exemption sans raison ne vaut rien
  Étant donné une maquette validated qui écarte color-contrast sans raison
  Quand on lance la vérification
  Alors elle sort en code non nul
  Et le message dit que c'est la raison manquante qui est en cause, pas la règle

Scénario: une exemption ne couvre que la règle qu'elle nomme
  Étant donné une maquette validated qui écarte color-contrast avec une raison
  Et qui viole aussi image-alt
  Quand on lance la vérification
  Alors elle sort en code non nul pour image-alt seulement

Scénario: le résultat est exploitable en CI
  Étant donné un dépôt dont une maquette validée est conforme et une autre non
  Quand on lance la vérification
  Alors le rapport liste les deux, et seule la seconde motive le code de sortie
```
