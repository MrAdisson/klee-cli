import { KleeError } from './errors.js';

/**
 * Catalogue des starters (ADR 0020, ADR 0021, ADR 0022, DESIGN.md §2).
 *
 * Un starter fournit le groupe `primitive.color` **et** une personnalité de typo,
 * d'espacement, de rayons et d'ombres (`font`/`space`/`radius`/`shadow`) : c'est tout ce qui
 * varie d'un projet à l'autre. La forme sémantique (`color.text.primary`, `space.md`,
 * `radius.sm`…) et sa liste de rôles restent fixes et vivent dans `scaffold/modules/tokens.ts`
 * — changer de starter ne casse jamais un mockup qui consomme un rôle sémantique.
 *
 * Huit starters, tous vérifiés par `checkStarterContrast` (couleur) et par
 * `MIN_READABLE_FONT_SIZE` (typo) avant d'entrer au catalogue — la personnalité visuelle ne
 * doit jamais coûter la lisibilité. Les couleurs de `klee-default` sont reprises de la
 * palette Tailwind CSS v3 (MIT) ; tout le reste (couleur des sept autres starters, et la
 * typo/l'espacement/les rayons/les ombres des huit) est une composition propre à klee —
 * `klee-navy` et `klee-teal` reprennent des teintes standards, volontairement sans surprise,
 * plutôt qu'une identité originale.
 */

/** Un document DTCG : `$value` obligatoire, `$type` héritable du groupe. */
export type TokenDocument = Record<string, unknown>;

/** En dessous, un texte cesse d'être confortablement lisible (DESIGN.md §6). */
export const MIN_READABLE_FONT_SIZE = 13;

export interface FontBundle {
  readonly sansFamily: readonly string[];
  readonly monoFamily: readonly string[];
  readonly size: {
    readonly sm: number;
    readonly md: number;
    readonly lg: number;
    readonly xl: number;
  };
  readonly weight: { readonly regular: number; readonly medium: number; readonly bold: number };
}

export interface SpaceBundle {
  readonly xs: number;
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
}

export interface RadiusBundle {
  readonly sm: number;
  readonly md: number;
  readonly full: number;
}

export interface ShadowStep {
  readonly color: string;
  readonly offsetY: number;
  readonly blur: number;
}

export interface ShadowBundle {
  readonly sm: ShadowStep;
  readonly md: ShadowStep;
}

export interface TokenStarter {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Licence de la source, si les valeurs sont reprises d'un système existant. */
  readonly license?: string;
  /** Uniquement le groupe `color` : `{ color: { $type: 'color', ... } }`. */
  readonly primitives: TokenDocument;
  readonly font: FontBundle;
  readonly space: SpaceBundle;
  readonly radius: RadiusBundle;
  readonly shadow: ShadowBundle;
}

function hex(value: string, description?: string): { $value: string; $description?: string } {
  return description === undefined
    ? { $value: value }
    : { $value: value, $description: description };
}

interface GrayScaleInput {
  readonly 50: string;
  readonly 100: string;
  readonly 300: string;
  readonly 400: string;
  readonly 600: string;
  readonly 900: string;
}

interface FourStepScaleInput {
  readonly 300: string;
  readonly 600: string;
  readonly 700: string;
  readonly 800: string;
}

interface TwoStepScaleInput {
  readonly 50: string;
  readonly 700: string;
}

/**
 * Assemble le groupe `primitive.color` d'un starter. Les clés sont des **rôles**
 * (`accent`, `danger`, `success`), jamais des noms de teinte perçue : la forme sémantique
 * (`scaffold/modules/tokens.ts`) référence toujours `primitive.color.accent.*`, quelle que
 * soit la couleur que ce rôle porte pour un starter donné — c'est ce qui permet à un starter
 * de choisir n'importe quelle teinte sans jamais toucher aux alias qui le consomment.
 */
function starterPrimitives(input: {
  readonly gray: GrayScaleInput;
  readonly accent: FourStepScaleInput;
  readonly danger: TwoStepScaleInput;
  readonly success: TwoStepScaleInput;
}): TokenDocument {
  return {
    color: {
      $type: 'color',
      white: hex('#ffffff'),
      gray: {
        50: hex(input.gray[50]),
        100: hex(input.gray[100]),
        300: hex(input.gray[300]),
        400: hex(input.gray[400]),
        600: hex(input.gray[600]),
        900: hex(input.gray[900]),
      },
      accent: {
        300: hex(input.accent[300]),
        600: hex(input.accent[600]),
        700: hex(input.accent[700]),
        800: hex(input.accent[800]),
      },
      danger: { 50: hex(input.danger[50]), 700: hex(input.danger[700]) },
      success: { 50: hex(input.success[50]), 700: hex(input.success[700]) },
    },
  };
}

const NEUTRAL_GRAY: GrayScaleInput = {
  50: '#f9fafb',
  100: '#f3f4f6',
  300: '#d1d5db',
  400: '#9ca3af',
  600: '#4b5563',
  900: '#111827',
};

const RED_DANGER: TwoStepScaleInput = { 50: '#fef2f2', 700: '#b91c1c' };
const GREEN_SUCCESS: TwoStepScaleInput = { 50: '#f0fdf4', 700: '#15803d' };

/**
 * Reprend exactement les valeurs de l'ancien `DEFAULT_TOKENS` littéral — c'est un
 * renommage par rôle, pas une nouvelle palette : aucune valeur résolue ne change.
 */
const KLEE_DEFAULT_PRIMITIVES: TokenDocument = starterPrimitives({
  gray: NEUTRAL_GRAY,
  accent: { 300: '#93b4f8', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af' },
  danger: RED_DANGER,
  success: GREEN_SUCCESS,
});

const KLEE_SLATE_PRIMITIVES: TokenDocument = starterPrimitives({
  gray: {
    50: '#f8fafc',
    100: '#f1f5f9',
    300: '#cbd5e1',
    400: '#94a3b8',
    600: '#475569',
    900: '#0f172a',
  },
  accent: { 300: '#a5b4fc', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3' },
  danger: { 50: '#fff1f2', 700: '#be123c' },
  success: { 50: '#f0fdfa', 700: '#0f766e' },
});

const KLEE_WARM_PRIMITIVES: TokenDocument = starterPrimitives({
  gray: {
    50: '#fafaf9',
    100: '#f5f5f4',
    300: '#d6d3d1',
    400: '#a8a29e',
    600: '#57534e',
    900: '#1c1917',
  },
  // 600 doit rester lisible en fond avec du texte blanc (primary.default, border.focus) :
  // l'ambre franc (#d97706) n'y arrive pas seul, la teinte est décalée d'un cran.
  accent: { 300: '#fcd34d', 600: '#b45309', 700: '#92400e', 800: '#78350f' },
  danger: RED_DANGER,
  success: GREEN_SUCCESS,
});

const KLEE_FOREST_PRIMITIVES: TokenDocument = starterPrimitives({
  gray: NEUTRAL_GRAY,
  // Même contrainte que klee-warm : 600 doit porter du texte blanc lisible.
  accent: { 300: '#86efac', 600: '#15803d', 700: '#166534', 800: '#14532d' },
  danger: RED_DANGER,
  // Sarcelle, pas vert : le succès serait invisible s'il portait la même teinte que l'accent.
  success: { 50: '#ecfdf5', 700: '#0f766e' },
});

const KLEE_VIOLET_PRIMITIVES: TokenDocument = starterPrimitives({
  gray: NEUTRAL_GRAY,
  accent: { 300: '#c4b5fd', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6' },
  danger: RED_DANGER,
  success: GREEN_SUCCESS,
});

const KLEE_MONO_PRIMITIVES: TokenDocument = starterPrimitives({
  gray: {
    50: '#fafafa',
    100: '#f4f4f5',
    300: '#d4d4d8',
    400: '#a1a1aa',
    600: '#52525b',
    900: '#18181b',
  },
  // Quasi noir, pas bleu : seuls danger et succès restent en couleur, parce que
  // l'accessibilité en dépend (DESIGN.md §6) — le reste est délibérément sans teinte.
  accent: { 300: '#a1a1aa', 600: '#27272a', 700: '#18181b', 800: '#09090b' },
  danger: RED_DANGER,
  success: GREEN_SUCCESS,
});

/**
 * Les deux starters suivants sont volontairement "sans surprise" : teintes standards
 * (bleu marine, sarcelle) qu'on retrouve telles quelles dans une bonne partie des produits
 * B2B/SaaS actuels, plutôt qu'une composition originale — pour ceux qui veulent démarrer sur
 * un terrain visuellement familier, pas expérimenter une identité.
 */
const KLEE_NAVY_PRIMITIVES: TokenDocument = starterPrimitives({
  gray: NEUTRAL_GRAY,
  accent: { 300: '#93c5fd', 600: '#1e40af', 700: '#1e3a8a', 800: '#172554' },
  danger: RED_DANGER,
  success: GREEN_SUCCESS,
});

const KLEE_TEAL_PRIMITIVES: TokenDocument = starterPrimitives({
  gray: NEUTRAL_GRAY,
  // 600 doit rester lisible en fond avec du texte blanc, même contrainte que warm/forest :
  // la sarcelle franche (#0d9488) n'y arrive pas seule.
  accent: { 300: '#5eead4', 600: '#0f766e', 700: '#115e59', 800: '#134e4a' },
  danger: RED_DANGER,
  success: GREEN_SUCCESS,
});

const SANS_FAMILY = ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'];
const MONO_FAMILY = ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'];

/**
 * Personnalité par défaut — inchangée depuis avant ADR 0022 : c'est celle que tous les
 * projets scaffoldés avant ce ticket ont déjà reçue, aucune raison de la faire bouger.
 */
const KLEE_DEFAULT_FONT: FontBundle = {
  sansFamily: SANS_FAMILY,
  monoFamily: MONO_FAMILY,
  size: { sm: 13, md: 15, lg: 19, xl: 25 },
  weight: { regular: 400, medium: 500, bold: 700 },
};
const KLEE_DEFAULT_SPACE: SpaceBundle = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 };
const KLEE_DEFAULT_RADIUS: RadiusBundle = { sm: 4, md: 8, full: 9999 };
const KLEE_DEFAULT_SHADOW: ShadowBundle = {
  sm: { color: '#0f172a1a', offsetY: 1, blur: 2 },
  md: { color: '#0f172a26', offsetY: 4, blur: 12 },
};

/** SaaS posé : légèrement plus dense, coins nets, ombre plus définie que diffuse. */
const KLEE_SLATE_FONT: FontBundle = {
  sansFamily: SANS_FAMILY,
  monoFamily: MONO_FAMILY,
  size: { sm: 13, md: 14, lg: 18, xl: 24 },
  weight: { regular: 400, medium: 500, bold: 600 },
};
const KLEE_SLATE_SPACE: SpaceBundle = { xs: 4, sm: 8, md: 14, lg: 22, xl: 36 };
const KLEE_SLATE_RADIUS: RadiusBundle = { sm: 3, md: 6, full: 9999 };
const KLEE_SLATE_SHADOW: ShadowBundle = {
  sm: { color: '#0f172a1f', offsetY: 1, blur: 3 },
  md: { color: '#0f172a33', offsetY: 6, blur: 16 },
};

/** Accueillant, éditorial : plus généreux partout, coins arrondis, ombre diffuse. */
const KLEE_WARM_FONT: FontBundle = {
  sansFamily: SANS_FAMILY,
  monoFamily: MONO_FAMILY,
  size: { sm: 14, md: 16, lg: 20, xl: 27 },
  weight: { regular: 400, medium: 500, bold: 700 },
};
const KLEE_WARM_SPACE: SpaceBundle = { xs: 6, sm: 10, md: 20, lg: 32, xl: 48 };
const KLEE_WARM_RADIUS: RadiusBundle = { sm: 10, md: 16, full: 9999 };
const KLEE_WARM_SHADOW: ShadowBundle = {
  sm: { color: '#1c19171a', offsetY: 2, blur: 6 },
  md: { color: '#1c191733', offsetY: 8, blur: 20 },
};

/** Nature, croissance : cadence proche du défaut, coins organiques, ombre douce. */
const KLEE_FOREST_FONT: FontBundle = {
  sansFamily: SANS_FAMILY,
  monoFamily: MONO_FAMILY,
  size: { sm: 13, md: 15, lg: 19, xl: 25 },
  weight: { regular: 400, medium: 500, bold: 700 },
};
const KLEE_FOREST_SPACE: SpaceBundle = { xs: 5, sm: 9, md: 18, lg: 28, xl: 44 };
const KLEE_FOREST_RADIUS: RadiusBundle = { sm: 8, md: 14, full: 9999 };
const KLEE_FOREST_SHADOW: ShadowBundle = {
  sm: { color: '#1118271f', offsetY: 2, blur: 5 },
  md: { color: '#11182733', offsetY: 6, blur: 16 },
};

/** Créatif, grand public : titres expressifs, coins très arrondis, ombre teintée (glow). */
const KLEE_VIOLET_FONT: FontBundle = {
  sansFamily: SANS_FAMILY,
  monoFamily: MONO_FAMILY,
  size: { sm: 14, md: 16, lg: 21, xl: 28 },
  weight: { regular: 400, medium: 600, bold: 800 },
};
const KLEE_VIOLET_SPACE: SpaceBundle = KLEE_DEFAULT_SPACE;
const KLEE_VIOLET_RADIUS: RadiusBundle = { sm: 12, md: 20, full: 9999 };
// Ombre teintée par l'accent plutôt que par un neutre : la signature "glow" d'un starter
// créatif — la seule ombre du catalogue qui ne dérive pas du gris du starter.
const KLEE_VIOLET_SHADOW: ShadowBundle = {
  sm: { color: '#6d28d926', offsetY: 2, blur: 8 },
  md: { color: '#6d28d940', offsetY: 10, blur: 28 },
};

/** Minimal, éditorial : compact, coins presque droits, ombre à peine perceptible. */
const KLEE_MONO_FONT: FontBundle = {
  sansFamily: SANS_FAMILY,
  monoFamily: MONO_FAMILY,
  size: { sm: MIN_READABLE_FONT_SIZE, md: 14, lg: 17, xl: 22 },
  weight: { regular: 400, medium: 500, bold: 600 },
};
const KLEE_MONO_SPACE: SpaceBundle = { xs: 3, sm: 6, md: 12, lg: 18, xl: 28 };
const KLEE_MONO_RADIUS: RadiusBundle = { sm: 0, md: 2, full: 9999 };
const KLEE_MONO_SHADOW: ShadowBundle = {
  sm: { color: '#18181b0d', offsetY: 1, blur: 1 },
  md: { color: '#18181b14', offsetY: 2, blur: 4 },
};

export const DEFAULT_TOKEN_STARTER_ID = 'klee-default';

export const TOKEN_STARTERS: readonly TokenStarter[] = [
  {
    id: DEFAULT_TOKEN_STARTER_ID,
    label: 'Klee (défaut)',
    description: 'Gris neutre + bleu — calibré AA sur les paires texte/surface du gate.',
    license: 'Valeurs reprises de la palette Tailwind CSS v3 (MIT).',
    primitives: KLEE_DEFAULT_PRIMITIVES,
    font: KLEE_DEFAULT_FONT,
    space: KLEE_DEFAULT_SPACE,
    radius: KLEE_DEFAULT_RADIUS,
    shadow: KLEE_DEFAULT_SHADOW,
  },
  {
    id: 'klee-slate',
    label: 'Ardoise + indigo',
    description:
      'Gris ardoise (bleuté) + indigo en action principale, rose en erreur, sarcelle en succès. Ton SaaS plus posé : plus dense, coins nets.',
    primitives: KLEE_SLATE_PRIMITIVES,
    font: KLEE_SLATE_FONT,
    space: KLEE_SLATE_SPACE,
    radius: KLEE_SLATE_RADIUS,
    shadow: KLEE_SLATE_SHADOW,
  },
  {
    id: 'klee-warm',
    label: 'Pierre + ambre',
    description:
      'Gris chaud (pierre) + ambre en action principale. Ton accueillant : plus généreux, coins arrondis.',
    primitives: KLEE_WARM_PRIMITIVES,
    font: KLEE_WARM_FONT,
    space: KLEE_WARM_SPACE,
    radius: KLEE_WARM_RADIUS,
    shadow: KLEE_WARM_SHADOW,
  },
  {
    id: 'klee-forest',
    label: 'Neutre + forêt',
    description:
      'Gris neutre + vert forêt en action principale, succès distingué en sarcelle. Coins organiques, ombre douce.',
    primitives: KLEE_FOREST_PRIMITIVES,
    font: KLEE_FOREST_FONT,
    space: KLEE_FOREST_SPACE,
    radius: KLEE_FOREST_RADIUS,
    shadow: KLEE_FOREST_SHADOW,
  },
  {
    id: 'klee-violet',
    label: 'Neutre + violet',
    description:
      'Gris neutre + violet en action principale. Ton créatif : titres marqués, coins très arrondis, ombre teintée.',
    primitives: KLEE_VIOLET_PRIMITIVES,
    font: KLEE_VIOLET_FONT,
    space: KLEE_VIOLET_SPACE,
    radius: KLEE_VIOLET_RADIUS,
    shadow: KLEE_VIOLET_SHADOW,
  },
  {
    id: 'klee-mono',
    label: 'Monochrome',
    description:
      'Gris neutre + quasi-noir en action principale, aucune teinte hors des signaux danger/succès. Compact, coins presque droits, ombre à peine perceptible.',
    primitives: KLEE_MONO_PRIMITIVES,
    font: KLEE_MONO_FONT,
    space: KLEE_MONO_SPACE,
    radius: KLEE_MONO_RADIUS,
    shadow: KLEE_MONO_SHADOW,
  },
  {
    id: 'klee-navy',
    label: 'Marine (classique)',
    description:
      'Gris neutre + bleu marine — ton corporate volontairement sans surprise, proportions identiques au défaut.',
    primitives: KLEE_NAVY_PRIMITIVES,
    font: KLEE_DEFAULT_FONT,
    space: KLEE_DEFAULT_SPACE,
    radius: KLEE_DEFAULT_RADIUS,
    shadow: KLEE_DEFAULT_SHADOW,
  },
  {
    id: 'klee-teal',
    label: 'Sarcelle (classique)',
    description:
      'Gris neutre + sarcelle — ton produit SaaS/analytics répandu, proportions identiques au défaut.',
    primitives: KLEE_TEAL_PRIMITIVES,
    font: KLEE_DEFAULT_FONT,
    space: KLEE_DEFAULT_SPACE,
    radius: KLEE_DEFAULT_RADIUS,
    shadow: KLEE_DEFAULT_SHADOW,
  },
];

export function findTokenStarter(id: string): TokenStarter | undefined {
  return TOKEN_STARTERS.find((starter) => starter.id === id);
}

/** Résolution stricte : une config qui référence un starter inconnu doit échouer tôt. */
export function resolveTokenStarter(id: string): TokenStarter {
  const starter = findTokenStarter(id);
  if (starter === undefined) {
    throw new KleeError(`Starter de tokens inconnu : "${id}".`, {
      code: 'TOKEN_STARTER_UNKNOWN',
      hint: `Starters disponibles : ${TOKEN_STARTERS.map((candidate) => candidate.id).join(', ')}.`,
    });
  }
  return starter;
}

const ALIAS_PATTERN = /^\{([^{}]+)\}$/;

/**
 * Résout un alias DTCG (`{primitive.color.gray.900}`) jusqu'à sa valeur littérale, en
 * suivant des chaînes d'alias si besoin. Volontairement indépendant de Style Dictionary /
 * Terrazzo : c'est ce qui permet de vérifier la résolution (tests, gate de contraste) sans
 * dépendre du pipeline de build choisi par le projet généré.
 */
export function resolveTokenValue(doc: TokenDocument, path: string): string {
  const seen = new Set<string>();
  let current = path;

  for (;;) {
    if (seen.has(current)) {
      throw new KleeError(`Alias circulaire sur le chemin de tokens "${current}".`, {
        code: 'TOKEN_ALIAS_CYCLE',
      });
    }
    seen.add(current);

    const token = walk(doc, current);
    const value = (token as { $value?: unknown } | undefined)?.$value;
    if (typeof value !== 'string') {
      throw new KleeError(`Aucune valeur de token lisible au chemin "${current}".`, {
        code: 'TOKEN_PATH_INVALID',
      });
    }

    const alias = ALIAS_PATTERN.exec(value);
    if (alias === null) return value;
    const target = alias[1];
    if (target === undefined) return value;
    current = target;
  }
}

function walk(doc: TokenDocument, path: string): unknown {
  return path.split('.').reduce<unknown>((node, segment) => {
    if (node === null || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[segment];
  }, doc);
}

const HEX_COLOR_PATTERN = /^#([0-9a-f]{6})$/i;

function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hexColor: string): number {
  const match = HEX_COLOR_PATTERN.exec(hexColor);
  if (match === null) {
    throw new KleeError(`Couleur hexadécimale invalide (#rrggbb attendu) : "${hexColor}".`, {
      code: 'TOKEN_COLOR_INVALID',
    });
  }
  const digits = match[1];
  if (digits === undefined) {
    throw new KleeError(`Couleur hexadécimale invalide (#rrggbb attendu) : "${hexColor}".`, {
      code: 'TOKEN_COLOR_INVALID',
    });
  }
  const r = parseInt(digits.slice(0, 2), 16);
  const g = parseInt(digits.slice(2, 4), 16);
  const b = parseInt(digits.slice(4, 6), 16);
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/**
 * Ratio de contraste WCAG 2.1 entre deux couleurs opaques `#rrggbb`. Indépendant de
 * axe-core/Playwright (ADR 0018) : ceux-là jugent une page rendue, celui-ci juge un starter
 * avant même qu'une maquette existe — c'est le gate qui protège l'ajout d'un futur starter
 * (`scaffold/modules/tokens.ts` définit les paires vérifiées).
 */
export function contrastRatio(hexColorA: string, hexColorB: string): number {
  const luminanceA = relativeLuminance(hexColorA);
  const luminanceB = relativeLuminance(hexColorB);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}
