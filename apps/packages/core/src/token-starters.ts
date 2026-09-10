import { KleeError } from './errors.js';

/**
 * Catalogue des starters de primitifs de couleur (ADR 0020, DESIGN.md §2).
 *
 * Un starter ne fournit que le groupe `primitive.color` : c'est la seule partie de
 * `tokens.json` qui varie d'un projet à l'autre. Le reste — la forme sémantique
 * (`color.text.primary`, `color.primary.default`…) et sa liste de rôles — est fixe et vit
 * dans `scaffold/modules/tokens.ts`, pour que changer de starter ne casse jamais un mockup
 * ou un composant qui consomme les rôles sémantiques.
 *
 * Un seul starter est enregistré pour l'instant. §13 (TECHNICAL.md) n'accorde le statut de
 * point de choix qu'à partir de deux alternatives réellement solides — en dessous, poser la
 * question serait un faux choix. Le mécanisme est prêt à en accueillir un second sans
 * modifier autre chose que ce fichier (même promesse qu'un provider, ADR 0012) ; exposer le
 * choix côté CLI est le ticket qui suivra l'ajout d'un second starter.
 */

/** Un document DTCG : `$value` obligatoire, `$type` héritable du groupe. */
export type TokenDocument = Record<string, unknown>;

export interface TokenStarter {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Licence de la source, si les valeurs sont reprises d'un système existant. */
  readonly license?: string;
  /** Uniquement le groupe `color` : `{ color: { $type: 'color', ... } }`. */
  readonly primitives: TokenDocument;
}

function hex(value: string, description?: string): { $value: string; $description?: string } {
  return description === undefined
    ? { $value: value }
    : { $value: value, $description: description };
}

/**
 * Reprend exactement les valeurs de l'ancien `DEFAULT_TOKENS` littéral, renommées par
 * échelle plutôt que par rôle — c'est la définition même d'un primitif. Aucune valeur
 * résolue ne change : c'est un renommage, pas une nouvelle palette.
 */
const KLEE_DEFAULT_PRIMITIVES: TokenDocument = {
  color: {
    $type: 'color',
    white: hex('#ffffff', 'Blanc pur.'),
    gray: {
      50: hex('#f9fafb', 'Le plus clair de l’échelle neutre.'),
      100: hex('#f3f4f6'),
      300: hex('#d1d5db'),
      400: hex('#9ca3af'),
      600: hex('#4b5563'),
      900: hex('#111827', 'Le plus sombre de l’échelle neutre.'),
    },
    blue: {
      300: hex('#93b4f8'),
      600: hex('#2563eb'),
      700: hex('#1d4ed8'),
      800: hex('#1e40af'),
    },
    red: {
      50: hex('#fef2f2'),
      700: hex('#b91c1c'),
    },
    green: {
      50: hex('#f0fdf4'),
      700: hex('#15803d'),
    },
  },
};

export const DEFAULT_TOKEN_STARTER_ID = 'klee-default';

export const TOKEN_STARTERS: readonly TokenStarter[] = [
  {
    id: DEFAULT_TOKEN_STARTER_ID,
    label: 'Klee (défaut)',
    description: 'Échelle neutre + bleu, calibrée AA sur les paires texte/surface du gate.',
    primitives: KLEE_DEFAULT_PRIMITIVES,
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
