# AGENTS.md — mockups/ — source de vérité visuelle

> Toute l'information UI est figée ici _avant_ l'implémentation. Le passage vers React/Vue/Angular doit être une transcription, jamais une décision de design.

## Conventions

- HTML sémantique — une maquette en `<div>` produit un composant inaccessible.
- Aucune valeur brute : les couleurs, espacements et rayons passent par `var(--…)` depuis `design-system/dist/css/tokens.css`.
- Chaque page ou composant a un `.meta.yml` : `id: MOCK-xxx`, `status: draft | validated | implemented`, `related_tickets`, `related_docs`, `implemented_in`.
- Le vocabulaire des liens est le même partout — `related_tickets`, `related_mockups`, `related_docs` : un identifiant cité doit exister, `klee links check` le vérifie.
- Chaque composant documente ses états (default, hover, disabled, loading, erreur) : un état non maquetté est un état qui sera improvisé en implémentation.
- Aucun copier-coller de markup entre pages : une page inclut un composant via Eleventy, elle ne le réécrit jamais.
- Les `.html` sont rendus en **Nunjucks** (et non en Liquid, le défaut d’Eleventy) : cf `docs/decisions/0007-langage-de-template-des-maquettes.md`.
- Un composant s’écrit comme une **macro** (`{% macro %}` / `{% from … import %}`), jamais comme un include qui lit des variables posées par la page : la portée reste isolée et les paramètres explicites.
- JS uniquement pour illustrer un comportement UI local (menu, onglet) — jamais de logique métier, jamais d’appel réseau.
- Navigation entre pages par de simples liens `<a>`, pour simuler le parcours sans framework.
- Accessibilité WCAG 2.1 AA vérifiée au stade maquette ; la régression visuelle est assurée par Playwright (toHaveScreenshot).

## Périmètre d'édition pour un agent

**Autorisé**

- Créer et modifier des pages et composants HTML/CSS.
- Mettre à jour un `.meta.yml` (statut, lien vers le ticket, composant implémenté).

**Interdit**

- Écrire une valeur de couleur, d’espacement ou de typographie en dur.
- Dupliquer le markup d’un composant existant.
- Passer une maquette en `status: validated` sans que les vérifications d’accessibilité soient au vert.

Les secrets ne vivent jamais ici : uniquement dans un mécanisme de secrets dédié, hors du
champ de lecture par défaut d'un agent.

## Références

- DESIGN.md — conventions design, produit et UX.
- `design-system/AGENTS.md` — tokens consommés par ces maquettes.
