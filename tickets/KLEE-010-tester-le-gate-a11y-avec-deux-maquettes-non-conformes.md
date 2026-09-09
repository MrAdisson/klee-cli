---
id: KLEE-010
title: Tester le gate a11y avec deux maquettes non conformes
status: in-review
assignee: null
created: 2026-09-09
updated: 2026-09-09
depends_on: []
related_mockups:
  - MOCK-003
  - MOCK-004
related_docs: []
authored_by: agent
---

Deux maquettes volontairement non conformes servent à tester le retour du gate d'accessibilité depuis le board : MOCK-003 viole image-alt et MOCK-004 viole label.

## Critères d'acceptation

```gherkin
Scénario: le gate refuse MOCK-003 pour une image sans alternative
  Étant donné MOCK-003 en status: draft
  Quand je choisis validated depuis la fiche du ticket
  Alors le message cite la règle image-alt
  Et MOCK-003 reste en status: draft

Scénario: le gate refuse MOCK-004 pour un bouton sans nom accessible
  Étant donné MOCK-004 en status: draft
  Quand je choisis validated depuis la fiche du ticket
  Alors le message cite la règle button-name
  Et MOCK-004 reste en status: draft
```
