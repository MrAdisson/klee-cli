---
id: KLEE-016
title: Élargir les starters à la typographie, l'espacement, les rayons et les ombres
status: in-review
assignee: null
created: 2026-09-10
updated: 2026-09-10
depends_on:
  - KLEE-015
related_mockups: []
related_docs: []
authored_by: agent
---

KLEE-014/015 n'ont fait varier que la couleur : un starter change d'accent mais garde exactement la même typo, le même rythme d'espacement, les mêmes rayons et ombres (scaffold/modules/tokens.ts, semanticTokens()). Résultat pointé par l'utilisateur : ça ressemble à un habillage de couleur, pas à un design system complet. Ce ticket étend le mécanisme de starter (registre, alias par rôle, gate) à font/space/radius/shadow, pour que chaque starter ait une vraie personnalité visuelle — pas seulement une teinte différente.

## Vision (pas ce ticket)

Objectif à terme, pour cadrer sans l'implémenter : des design systems complets et solides en starters est vu comme un bon point de départ pour proposer plus tard des bibliothèques de composants optionnelles — pas forcément shadcn, potentiellement des composants propres à klee (dans l'esprit du composant Bouton déjà scaffoldé), qui changeraient d'apparence selon le design system auquel ils sont attachés. Pour que ça tienne, la base (typo/espacement/rayons/ombres, pas seulement couleur) doit être solide avant d'y accrocher quoi que ce soit — d'où ce ticket.

## Hors périmètre de ce ticket

- Aucune bibliothèque de composants (klee ou tierce) : ni maintenant, ni planifiée dans ce lot.
- Aucun import/curation de valeurs d'un vrai design system externe (Material, Spectrum, Primer...) : ADR 0021 a déjà documenté pourquoi ce n'est pas trivial (formats non-DTCG, licences à vérifier) — chantier séparé, plus tard.
- Aucune décision sur le vocabulaire de variables CSS en vue d'une compatibilité avec une lib de composants externe (ex. les noms attendus par shadcn) — question d'architecture notée à part, pas tranchée ici.

## Critères d'acceptation

```gherkin
Scénario: un starter porte aussi une personnalité de typo, espacement, rayons et ombres
  Étant donné le registre de starters
  Quand on lit les primitifs d'un starter donné
  Alors il fournit ses propres valeurs de font/space/radius/shadow
  Et deux starters différents produisent des valeurs différentes sur au moins un de ces groupes

Scénario: la forme sémantique reste la seule chose fixe
  Étant donné n'importe quel starter du registre
  Quand `design-system/tokens.json` est généré
  Alors les rôles sémantiques (`font.size.md`, `space.md`, `radius.sm`, `shadow.sm`, etc.)
    sont inchangés d'un starter à l'autre — seule leur résolution vers un primitif varie

Scénario: la lisibilité reste vérifiée, pas seulement le contraste de couleur
  Étant donné l'échelle de tailles de police d'un starter
  Quand elle est comparée au minimum lisible déjà en vigueur (13px pour `font.size.sm`)
  Alors aucun starter ne descend en dessous

Scénario: le rendu est vérifié sur une vraie maquette, pas seulement sur les valeurs
  Étant donné les maquettes bouton et connexion existantes
  Quand elles sont servies avec chaque starter du registre (`klee mockups serve`)
  Alors une relecture visuelle confirme une personnalité distincte par starter
  (ce critère ne peut pas être automatisé comme le gate de contraste — revue humaine requise)

Scénario: le gate de contraste couleur existant continue de s'appliquer sans régression
  Étant donné l'extension à font/space/radius/shadow
  Quand `checkStarterContrast` s'exécute sur chaque starter
  Alors il continue de passer exactement comme avant ce ticket
```
