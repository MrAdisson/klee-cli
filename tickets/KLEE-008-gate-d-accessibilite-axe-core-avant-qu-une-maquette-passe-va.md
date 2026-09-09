---
id: KLEE-008
title: "Gate d'accessibilité : axe-core avant qu'une maquette passe validated"
status: ready-for-dev
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

Scénario: le résultat est exploitable en CI
  Étant donné un dépôt dont une maquette validée est conforme et une autre non
  Quand on lance la vérification
  Alors le rapport liste les deux, et seule la seconde motive le code de sortie
```
