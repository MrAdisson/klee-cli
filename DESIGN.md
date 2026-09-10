# DESIGN.md — Conventions design, produit & UX

> Complément de `TECHNICAL.md`. Ce document définit *comment* les maquettes, le design system et les docs produit doivent être structurés, pas seulement où ils vivent. À lire avant de générer quoi que ce soit dans `design-system/`, `mockups/` ou `docs/design`, `docs/product`.

---

## 1. Principe

Une maquette validée dans `mockups/` doit contenir **100% de l'information UI nécessaire** à l'implémentation. Le passage vers le vrai code (React/Vue/Angular) ne doit jamais impliquer de décision de design non prise en amont — uniquement de la transcription HTML/CSS → composants.

Corollaire : si un agent qui implémente une feature doit "inventer" une couleur, un espacement ou un comportement non spécifié dans la maquette, c'est que la maquette est incomplète — pas que l'agent doit improviser.

---

## 2. Design tokens

Les tokens vivent dans `design-system/` (cf `TECHNICAL.md` §3), pas dans `mockups/` : ils sont consommés à l'identique par les mockups et par les apps de production, donc ne peuvent pas être la propriété d'un seul des deux.

- `design-system/tokens.json` — source unique, format **W3C Design Tokens (DTCG)**, standard stabilisé fin 2025 et déjà supporté par Style Dictionary, Tokens Studio et Figma. Ne pas inventer un schéma JSON maison : chaque token est un objet `$value`/`$type`/`$description`, ce qui garantit l'interopérabilité avec l'outillage externe dès le premier jour.
  ```json
  {
    "color-primary": { "$value": "#3b82f6", "$type": "color", "$description": "Couleur de marque principale" },
    "space-md": { "$value": { "value": 16, "unit": "px" }, "$type": "dimension" }
  }
  ```
- `design-system/dist/css/tokens.css` — custom properties CSS **générées** à partir de `tokens.json` (jamais éditées à la main), importées par `mockups/` et par `apps/web`.

**Catégories minimales à couvrir dès la Phase 1 :**
- Couleurs (avec variantes sémantiques : `--color-primary`, `--color-error`, pas seulement des valeurs brutes)
- Typographie (famille, échelle de tailles, poids)
- Espacement (échelle cohérente, ex. base 4 ou 8)
- Rayons de bordure, ombres

**Règle de nommage :** sémantique avant tout (`--color-text-primary`, pas `--color-gray-900`) pour que changer une valeur ne casse pas la signification.

**Primitifs et sémantique (ADR 0020, ADR 0021) :** le groupe `color` de `tokens.json` porte deux niveaux, dans le même fichier. `primitive.color.*` porte les valeurs brutes, nommées par **rôle** (`gray`, `white`, `accent`, `danger`, `success`) et jamais par teinte perçue (jamais `blue` ni `violet`) — c'est ce qui permet à un starter de choisir n'importe quelle couleur pour `accent` sans casser les alias qui le consomment. C'est la seule partie qui varie d'un projet à l'autre selon le starter retenu à l'init (`klee init` propose désormais un vrai choix : six starters au catalogue, cf `token-starters.ts`). Tout le reste (`color.text.*`, `color.primary.*`, etc.) référence un primitif par alias DTCG plutôt qu'une valeur littérale : `{ "$value": "{primitive.color.accent.600}" }`. Un token hors du groupe `primitive` ne porte jamais de valeur littérale. `font`, `space`, `radius` et `shadow` restent à valeur littérale : seule la couleur a aujourd'hui plusieurs starters.

**Gouvernance :**
- Toute modification d'un token déclenche une régression visuelle automatique sur les pages qui l'utilisent (cf `TECHNICAL.md` §7 et §13 pour l'outil par défaut).
- Versionner les tokens comme du code : un changement de token = un ticket, jamais une édition silencieuse.

---

## 3. Convention des maquettes HTML/CSS

**Anatomie d'une page ou d'un composant :**
```
mockups/pages/dashboard.html
mockups/pages/dashboard.meta.yml
```

Le fichier `.meta.yml` associé porte les métadonnées de traçabilité (voir `TECHNICAL.md` §7 pour le schéma complet) :
```yaml
id: MOCK-042
ticket: PROJ-123
status: draft | validated | implemented
implemented_in: null
```

**Règles de construction :**
- HTML sémantique (pas de `<div>` à outrance) — ça facilite la transcription vers des composants accessibles.
- CSS via les tokens uniquement (aucune valeur brute type `color: #3b82f6` en dur dans une maquette — toujours `var(--color-primary)`).
- Navigation entre pages via de simples liens `<a>`, pour simuler le parcours sans framework.
- JS autorisé seulement pour illustrer un comportement UI local (ouverture d'un menu, tab) — jamais de logique métier, jamais d'appel réseau.
- Chaque composant doit documenter ses **états** (default, hover, disabled, loading, erreur) dans la même page ou une page dédiée `components/button/button.html` — un état non maquetté est un état qui sera improvisé en implémentation.
- **Aucun copier-coller de markup entre pages.** Une page ne réécrit jamais le HTML d'un composant : elle l'inclut via le système de composition défini en `TECHNICAL.md` §13 (défaut Eleventy, includes résolus au moment du serve). Copier-coller un composant recrée exactement le problème de dérive qu'on essaie d'éliminer.
- **Catalogue auto-généré** : le cockpit local génère automatiquement une page d'index listant chaque composant et ses états déclarés (à partir des `.meta.yml`) — jamais maintenue à la main, pour ne jamais désynchroniser la liste de la réalité des fichiers.

---

## 4. Docs produit & design (`docs/product`, `docs/design`)

Catégories à prévoir :
- **Personas / utilisateurs cibles**
- **Flows utilisateurs** (parcours, pas écran par écran — la maquette couvre déjà l'écran)
- **Specs fonctionnelles** par feature, liées à un ticket
- **UX writing / copy** (`docs/i18n-copy/`) — ton, vocabulaire, règles de traduction. Traité à part du reste du design car c'est un contenu qui change indépendamment des tokens ou du HTML.
- **Accessibilité** : exigences WCAG explicites par composant (contraste, navigation clavier, taille de cible tactile) — à documenter une fois, référencer partout plutôt que réécrire à chaque maquette.

Chaque doc porte le même frontmatter minimal que défini dans `TECHNICAL.md` (`id`, `related_tickets`, `related_mockups`).

---

## 5. UX du cockpit local lui-même

Le "studio" local (`TECHNICAL.md` §9) est un produit à part entière, pas un outil interne négligeable — c'est la porte d'entrée pour les profils non-techniques (PM, design). Il doit respecter les mêmes standards qu'un vrai produit :
- Utilisable **sans jamais toucher un terminal** pour créer/déplacer un ticket ou consulter une maquette.
- Kanban lisible en un coup d'œil, pas juste une liste de fichiers markdown bruts.
- La navigation entre maquettes doit ressembler à une navigation de site réelle (liens cliquables, pas une liste de fichiers `.html` à ouvrir un par un).
- Les liens croisés (ticket → maquette → doc) doivent être cliquables partout où l'ID apparaît, jamais du texte brut à chercher manuellement.

C'est le principal facteur d'adoption : si les designers et PM doivent apprendre du markdown et du git pour l'utiliser, l'outil ne sera adopté que par les devs, et le projet perd sa raison d'être ("everything lives in the codebase" implique que *tout le monde* y vit, pas seulement les devs).

---

## 6. Accessibilité (exigence transverse)

- Niveau cible : WCAG 2.1 AA minimum sur les mockups comme sur le cockpit lui-même.
- Contraste, navigation clavier et taille des cibles tactiles à valider **au stade maquette**, pas après implémentation — c'est tout l'intérêt de figer l'UI en amont.
- **Vérification automatisée** : chaque mockup HTML statique est passé au crible d'axe-core (contraste, ARIA, structure sémantique) par le cockpit local avant qu'un statut `validated` puisse être posé — l'exigence WCAG cesse d'être déclarative pour devenir un gate mécanique.

---

## Trajectoire design (chronologique, alignée sur les phases de `TECHNICAL.md`)

- **Dès la Phase 1 technique** (tokens + première page) : socle de tokens sémantiques stabilisé, un seul thème, maquettes écrites/générées à la main ou via un agent externe puis déposées ici.
- **Une fois le socle de tokens stabilisé** : ouverture au multi-thème (dark mode, marque blanche) — les tokens sémantiques rendent ce changement possible sans retoucher les maquettes existantes.
- **À partir de la Phase 4 technique** (cockpit en place) : génération assistée de maquettes brouillon par un agent directement depuis le cockpit, toujours validées manuellement avant passage en `status: validated`.
- **En parallèle de la Phase 5 technique** (interopérabilité) : automatisation de la traduction dans `docs/i18n-copy/` — la structure est prête depuis la Phase 1, seule l'automatisation vient après.
