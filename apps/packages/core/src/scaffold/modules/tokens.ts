import {
  contrastRatio,
  resolveTokenStarter,
  resolveTokenValue,
  type TokenDocument,
} from '../../token-starters.js';

/**
 * Socle de tokens au format W3C DTCG (DESIGN.md §2).
 *
 * Deux niveaux, dans le même fichier `tokens.json` (ADR 0020) :
 *
 * - **`primitive`** : les valeurs brutes, nommées par échelle (`primitive.color.gray.900`).
 *   Fourni par le starter choisi (`token-starters.ts`) — c'est la seule partie qui varie
 *   d'un projet à l'autre.
 * - **Tout le reste** (`color`, `font`, `space`, `radius`, `shadow`) : la forme sémantique,
 *   fixe. `color` référence `primitive.color.*` par alias DTCG (`$value: "{primitive...}"`),
 *   jamais une valeur littérale — c'est ce qui rend un starter substituable sans casser un
 *   mockup qui consomme `--color-text-primary`.
 *
 * **Couverture minimale de la phase 1** : couleurs sémantiques, typographie (famille,
 * échelle, poids), espacement sur une base de 4, rayons et ombres.
 *
 * Les paires d'usage listées dans `token-starters.test.ts` (texte sur surface, texte
 * inverse sur primaire/danger/succès) respectent WCAG 2.1 AA pour tout starter du registre
 * — l'accessibilité se valide au stade maquette, pas après implémentation (DESIGN.md §6).
 */

function px(value: number): { value: number; unit: string } {
  return { value, unit: 'px' };
}

function alias(path: string, description: string): { $value: string; $description: string } {
  return { $value: `{${path}}`, $description: description };
}

function semanticTokens(): TokenDocument {
  return {
    color: {
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
        focus: alias('primitive.color.blue.600', 'Anneau de focus clavier — jamais supprimé.'),
      },
      primary: {
        default: alias('primitive.color.blue.600', 'Action principale.'),
        hover: alias('primitive.color.blue.700', 'Action principale survolée.'),
        active: alias('primitive.color.blue.800', 'Action principale enfoncée.'),
        disabled: alias('primitive.color.blue.300', 'Action principale indisponible.'),
      },
      danger: {
        default: alias('primitive.color.red.700', 'Erreur, action destructrice.'),
        surface: alias('primitive.color.red.50', 'Fond de message d’erreur.'),
      },
      success: {
        default: alias('primitive.color.green.700', 'Confirmation, état valide.'),
        surface: alias('primitive.color.green.50', 'Fond de message de succès.'),
      },
    },
    font: {
      family: {
        $type: 'fontFamily',
        sans: {
          $value: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
          $description: 'Famille d’interface par défaut.',
        },
        mono: {
          $value: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
          $description: 'Code, identifiants, valeurs techniques.',
        },
      },
      size: {
        $type: 'dimension',
        sm: { $value: px(13), $description: 'Métadonnée, légende.' },
        md: { $value: px(15), $description: 'Texte courant.' },
        lg: { $value: px(19), $description: 'Sous-titre.' },
        xl: { $value: px(25), $description: 'Titre de page.' },
      },
      weight: {
        $type: 'fontWeight',
        regular: { $value: 400, $description: 'Texte courant.' },
        medium: { $value: 500, $description: 'Libellé, accentuation légère.' },
        bold: { $value: 700, $description: 'Titre.' },
      },
    },
    space: {
      $type: 'dimension',
      $description: 'Échelle d’espacement en base 4.',
      xs: { $value: px(4) },
      sm: { $value: px(8) },
      md: { $value: px(16) },
      lg: { $value: px(24) },
      xl: { $value: px(40) },
    },
    radius: {
      $type: 'dimension',
      sm: { $value: px(4), $description: 'Champ, bouton.' },
      md: { $value: px(8), $description: 'Carte, panneau.' },
      full: { $value: px(9999), $description: 'Pastille, avatar.' },
    },
    shadow: {
      $type: 'shadow',
      sm: {
        $value: { color: '#0f172a1a', offsetX: px(0), offsetY: px(1), blur: px(2), spread: px(0) },
        $description: 'Élévation discrète : bouton, champ.',
      },
      md: {
        $value: { color: '#0f172a26', offsetX: px(0), offsetY: px(4), blur: px(12), spread: px(0) },
        $description: 'Élévation marquée : carte, popover.',
      },
    },
  };
}

/** Compose `tokens.json` : le groupe `primitive` du starter + la forme sémantique fixe. */
export function buildTokens(starterId: string): TokenDocument {
  const starter = resolveTokenStarter(starterId);
  return { primitive: starter.primitives, ...semanticTokens() };
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
