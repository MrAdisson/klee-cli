import {
  contrastRatio,
  resolveTokenStarter,
  resolveTokenValue,
  type TokenStarter,
  type TokenDocument,
} from '../../token-starters.js';

/**
 * Socle de tokens au format W3C DTCG (DESIGN.md §2).
 *
 * Deux niveaux, dans le même fichier `tokens.json` (ADR 0020, ADR 0022) :
 *
 * - **`primitive`** : les valeurs de couleur brutes, nommées par rôle
 *   (`primitive.color.accent.600`). Fourni par le starter choisi (`token-starters.ts`).
 * - **Tout le reste** (`color`, `font`, `space`, `radius`, `shadow`) : la forme sémantique,
 *   fixe. `color` référence `primitive.color.*` par alias DTCG (`$value: "{primitive...}"`),
 *   jamais une valeur littérale — c'est ce qui rend un starter substituable sans casser un
 *   mockup qui consomme `--color-text-primary`.
 *
 * `font`/`space`/`radius`/`shadow` varient aussi par starter (ADR 0022), mais en valeur
 * directe plutôt que par alias : contrairement à la couleur, aucun de ces rôles n'est
 * réutilisé sous deux noms sémantiques différents — l'indirection n'apporterait rien.
 *
 * Les paires d'usage listées dans `SEMANTIC_CONTRAST_PAIRS` (texte sur surface, texte
 * inverse sur primaire/danger/succès) respectent WCAG 2.1 AA pour tout starter du registre,
 * et aucune taille de police ne descend sous `MIN_READABLE_FONT_SIZE` — la personnalité
 * visuelle d'un starter ne doit jamais coûter la lisibilité (DESIGN.md §6).
 */

function px(value: number): { value: number; unit: string } {
  return { value, unit: 'px' };
}

function alias(path: string, description: string): { $value: string; $description: string } {
  return { $value: `{${path}}`, $description: description };
}

function colorTokens(): TokenDocument {
  return {
    $type: 'color',
    text: {
      primary: alias('primitive.color.gray.900', 'Texte principal sur une surface claire.'),
      muted: alias('primitive.color.gray.600', 'Texte secondaire : métadonnées, aides.'),
      inverse: alias('primitive.color.white', 'Texte posé sur un fond plein et saturé.'),
    },
    surface: {
      page: alias('primitive.color.gray.50', 'Fond de page.'),
      raised: alias('primitive.color.white', 'Surface en avant : carte, panneau, champ.'),
      sunken: alias(
        'primitive.color.gray.100',
        'Surface en retrait : zone désactivée, fond de section.',
      ),
    },
    border: {
      default: alias('primitive.color.gray.300', 'Bordure neutre.'),
      strong: alias('primitive.color.gray.400', 'Bordure appuyée : survol, élément actif.'),
      focus: alias('primitive.color.accent.600', 'Anneau de focus clavier — jamais supprimé.'),
    },
    primary: {
      default: alias('primitive.color.accent.600', 'Action principale.'),
      hover: alias('primitive.color.accent.700', 'Action principale survolée.'),
      active: alias('primitive.color.accent.800', 'Action principale enfoncée.'),
      disabled: alias('primitive.color.accent.300', 'Action principale indisponible.'),
    },
    danger: {
      default: alias('primitive.color.danger.700', 'Erreur, action destructrice.'),
      surface: alias('primitive.color.danger.50', 'Fond de message d’erreur.'),
    },
    success: {
      default: alias('primitive.color.success.700', 'Confirmation, état valide.'),
      surface: alias('primitive.color.success.50', 'Fond de message de succès.'),
    },
  };
}

function fontTokens(font: TokenStarter['font']): TokenDocument {
  return {
    family: {
      $type: 'fontFamily',
      sans: { $value: [...font.sansFamily], $description: 'Famille d’interface par défaut.' },
      mono: {
        $value: [...font.monoFamily],
        $description: 'Code, identifiants, valeurs techniques.',
      },
    },
    size: {
      $type: 'dimension',
      sm: { $value: px(font.size.sm), $description: 'Métadonnée, légende.' },
      md: { $value: px(font.size.md), $description: 'Texte courant.' },
      lg: { $value: px(font.size.lg), $description: 'Sous-titre.' },
      xl: { $value: px(font.size.xl), $description: 'Titre de page.' },
    },
    weight: {
      $type: 'fontWeight',
      regular: { $value: font.weight.regular, $description: 'Texte courant.' },
      medium: { $value: font.weight.medium, $description: 'Libellé, accentuation légère.' },
      bold: { $value: font.weight.bold, $description: 'Titre.' },
    },
  };
}

function spaceTokens(space: TokenStarter['space']): TokenDocument {
  return {
    $type: 'dimension',
    $description: 'Échelle d’espacement.',
    xs: { $value: px(space.xs) },
    sm: { $value: px(space.sm) },
    md: { $value: px(space.md) },
    lg: { $value: px(space.lg) },
    xl: { $value: px(space.xl) },
  };
}

function radiusTokens(radius: TokenStarter['radius']): TokenDocument {
  return {
    $type: 'dimension',
    sm: { $value: px(radius.sm), $description: 'Champ, bouton.' },
    md: { $value: px(radius.md), $description: 'Carte, panneau.' },
    full: { $value: px(radius.full), $description: 'Pastille, avatar.' },
  };
}

function shadowTokens(shadow: TokenStarter['shadow']): TokenDocument {
  const step = (value: { color: string; offsetY: number; blur: number }) => ({
    color: value.color,
    offsetX: px(0),
    offsetY: px(value.offsetY),
    blur: px(value.blur),
    spread: px(0),
  });

  return {
    $type: 'shadow',
    sm: { $value: step(shadow.sm), $description: 'Élévation discrète : bouton, champ.' },
    md: { $value: step(shadow.md), $description: 'Élévation marquée : carte, popover.' },
  };
}

function semanticTokens(starter: TokenStarter): TokenDocument {
  return {
    color: colorTokens(),
    font: fontTokens(starter.font),
    space: spaceTokens(starter.space),
    radius: radiusTokens(starter.radius),
    shadow: shadowTokens(starter.shadow),
  };
}

/** Compose `tokens.json` : le groupe `primitive` de couleur du starter + sa forme sémantique. */
export function buildTokens(starterId: string): TokenDocument {
  const starter = resolveTokenStarter(starterId);
  return { primitive: starter.primitives, ...semanticTokens(starter) };
}

/** Seuil AA (texte normal) — WCAG 2.1, § 1.4.3. */
export const CONTRAST_MIN_AA = 4.5;

/**
 * Les paires que DESIGN.md §6 et le commentaire d'en-tête promettent vérifiées AA. Fixes,
 * comme la forme sémantique : un starter ne change que les couleurs qui s'y résolvent.
 */
export const SEMANTIC_CONTRAST_PAIRS: readonly {
  readonly fg: string;
  readonly bg: string;
  readonly label: string;
}[] = [
  { fg: 'color.text.primary', bg: 'color.surface.page', label: 'texte principal sur fond de page' },
  {
    fg: 'color.text.primary',
    bg: 'color.surface.raised',
    label: 'texte principal sur surface levée',
  },
  { fg: 'color.text.muted', bg: 'color.surface.page', label: 'texte atténué sur fond de page' },
  {
    fg: 'color.text.inverse',
    bg: 'color.primary.default',
    label: 'texte inverse sur action principale',
  },
  { fg: 'color.text.inverse', bg: 'color.danger.default', label: 'texte inverse sur erreur' },
  { fg: 'color.text.inverse', bg: 'color.success.default', label: 'texte inverse sur succès' },
];

export interface ContrastCheck {
  readonly label: string;
  readonly ratio: number;
  readonly passes: boolean;
}

/**
 * Le gate qui protège l'ajout d'un starter (présent ou futur) : mesure le contraste résolu
 * de chaque paire de `SEMANTIC_CONTRAST_PAIRS` pour ce starter, sans dépendre d'un navigateur
 * ni d'une maquette rendue.
 */
export function checkStarterContrast(starterId: string): ContrastCheck[] {
  const doc = buildTokens(starterId);
  return SEMANTIC_CONTRAST_PAIRS.map((pair) => {
    const ratio = contrastRatio(resolveTokenValue(doc, pair.fg), resolveTokenValue(doc, pair.bg));
    return { label: pair.label, ratio, passes: ratio >= CONTRAST_MIN_AA };
  });
}
