---
id: DOC-009
related_tickets: []
related_mockups: []
status: accepted
date: 2026-09-09
---

# 0007 — Nunjucks comme langage de template des maquettes

## Contexte

Le provider `eleventy` du point « composition des mockups » doit résoudre les includes de
composants : `TECHNICAL.md` §4 et `DESIGN.md` §3 interdisent tout copier-coller de markup entre
pages. Eleventy accepte plusieurs langages de template et rend les fichiers `.html` en
**Liquid** par défaut.

Ce choix n'avait pas été tranché : les premières maquettes ont été écrites en Nunjucks par
réflexe, le build a échoué sur le défaut Liquid, et le langage a été forcé pour faire passer le
build. Une décision par inertie — précisément ce que ce projet existe pour rendre impossible.
Cet ADR la reprend à froid.

## Ce qui n'est pas décidé ici

Le langage de template **n'est pas un point provider**, et ne doit pas le devenir. `TECHNICAL.md`
§13 le dit : « pour tout le reste, une seule convention est imposée — la cohérence transverse
prime sur la flexibilité ». Le rendre configurable obligerait à maintenir deux variantes de
chaque maquette d'exemple pour une différence de syntaxe, et des maquettes lues et éditées par
des agents gagnent davantage à être uniformes d'un projet à l'autre qu'à être configurables.

## Décision

**Nunjucks**, déclaré explicitement dans la configuration Eleventy générée
(`htmlTemplateEngine: 'njk'`).

Les composants sont écrits comme des **macros**, pas comme de simples includes :

```njk
{% macro button(label, variant='primary', disabled=false) %} … {% endmacro %}
```

puis, dans une page : `{% from "components/button.njk" import button %}` et
`{{ button('Se connecter', type='submit') }}`.

### Pourquoi Nunjucks plutôt que Liquid

L'arbitrage est serré et Liquid avait deux arguments sérieux : c'est le défaut d'Eleventy —
suivre le défaut d'un outil sans raison de s'en écarter n'est jamais gratuit — et son
`{% render 'button', label: 'x' %}` offre nativement une portée isolée avec paramètres nommés.

Nunjucks l'emporte sur trois points :

1. **Les macros sont importables.** Un fichier peut exporter plusieurs macros liées, qu'une page
   compose. C'est exactement la forme d'une bibliothèque de composants, là où Liquid impose un
   fichier par partiel.
2. **Marge de manœuvre** : héritage de templates (`extends` / `block`) quand les maquettes
   dépasseront la mise en page unique d'aujourd'hui.
3. **Familiarité** : la syntaxe Jinja2 est largement plus répandue, ce qui compte pour des
   fichiers destinés à être édités aussi bien par des humains que par des agents.

### Pourquoi des macros et pas `set` + `include`

C'est le point qui a réellement motivé cet ADR. Un include qui lit des variables posées par la
page laisse l'état d'un appel contaminer le suivant : la première version de la maquette du
bouton devait _remettre_ `variant` à sa valeur par défaut après avoir affiché la variante
secondaire. Une maquette ne doit pas tendre ce genre de piège à qui l'édite — la macro isole la
portée et rend les paramètres explicites.

## Conséquences

- Une ligne de configuration à porter dans le provider Eleventy, et un écart assumé au défaut
  de l'outil : quiconque lit la documentation d'Eleventy doit savoir que les `.html` de ce
  projet sont en Nunjucks. C'est écrit dans `mockups/AGENTS.md`.
- Le provider `web-components` n'est pas concerné : il ne passe par aucun langage de template,
  la composition est résolue par le navigateur au runtime. C'est même sa raison d'être.
- Si les maquettes devaient un jour être publiées telles quelles à des tiers, l'isolation de
  Liquid redeviendrait un argument. Ce n'est pas leur usage : elles sont servies en local.
