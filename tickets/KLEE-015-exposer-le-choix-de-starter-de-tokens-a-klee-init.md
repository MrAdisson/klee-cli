---
id: KLEE-015
title: Exposer le choix de starter de tokens à klee init
status: in-review
assignee: null
created: 2026-09-10
updated: 2026-09-10
depends_on:
  - KLEE-014
related_mockups: []
related_docs: []
authored_by: agent
---

ADR 0020 a posé le mécanisme (registre, alias par rôle) mais a délibérément renoncé à poser la question à l'init : un seul starter ne justifie pas un choix (TECHNICAL.md §13). Ce ticket ajoute cinq starters supplémentaires (klee-slate, klee-warm, klee-forest, klee-violet, klee-mono — chacun vérifié par le gate de contraste), renomme les primitifs par rôle (accent/danger/success) plutôt que par teinte pour que l'alias sémantique reste valable quel que soit le starter, et expose enfin le choix : question interactive à klee init (si mockups retenu) et flag --token-starter pour l'usage scriptable/--yes.

**Mise à jour post-revue** : deux starters supplémentaires ajoutés au catalogue à la demande de l'utilisateur — `klee-navy` et `klee-teal`, volontairement "sans surprise" (teintes standards de type corporate/SaaS classique) plutôt qu'une composition originale, pour ceux qui préfèrent démarrer sur un terrain visuellement familier. Le catalogue compte désormais huit starters. Même mécanisme, même gate, rien d'autre ne change.

## Critères d'acceptation

```gherkin
Scénario: au moins deux starters justifient enfin la question
  Étant donné le registre de starters
  Quand on le liste
  Alors il contient au moins deux starters aux ids distincts

Scénario: tout starter du registre passe le gate de contraste
  Étant donné chaque starter enregistré
  Quand `checkStarterContrast` mesure ses paires sémantiques
  Alors chaque paire atteint le ratio AA requis

Scénario: klee init pose la question seulement si mockups est retenu
  Étant donné un `klee init` interactif
  Quand le module mockups est retenu
  Alors une question propose tous les starters du registre, klee-default présélectionné
  Et aucune question de starter n'est posée si mockups n'est pas retenu

Scénario: --token-starter fonctionne sans terminal
  Étant donné `klee init --yes --token-starter klee-slate`
  Quand le projet est scaffoldé
  Alors project.config.json porte `designSystem.tokenStarter: "klee-slate"`
  Et design-system/tokens.json résout ses alias vers les primitifs klee-slate

Scénario: un id de starter inconnu échoue avant d'écrire quoi que ce soit
  Étant donné `klee init --yes --token-starter inconnu`
  Quand la commande s'exécute
  Alors elle échoue avec la liste des starters disponibles
  Et aucun fichier n'est écrit

Scénario: changer de starter ne casse aucun alias sémantique
  Étant donné n'importe quel starter du registre
  Quand `design-system/tokens.json` est généré puis construit par le pipeline retenu
  Alors chaque token sémantique se résout vers une couleur valide, sans référence brisée
```
