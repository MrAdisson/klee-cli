import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TOKEN_STARTER_ID,
  TOKEN_STARTERS,
  resolveTokenValue,
} from '../../token-starters.js';
import {
  CONTRAST_MIN_AA,
  SEMANTIC_CONTRAST_PAIRS,
  buildTokens,
  checkStarterContrast,
} from './tokens.js';

/** Les valeurs de l'ancien DEFAULT_TOKENS littéral (ADR 0020) — le renommage en primitifs
 * ne doit changer aucune couleur résolue. */
const PRE_ADR_0020_RESOLVED_COLORS: Readonly<Record<string, string>> = {
  'color.text.primary': '#111827',
  'color.text.muted': '#4b5563',
  'color.text.inverse': '#ffffff',
  'color.surface.page': '#f9fafb',
  'color.surface.raised': '#ffffff',
  'color.surface.sunken': '#f3f4f6',
  'color.border.default': '#d1d5db',
  'color.border.strong': '#9ca3af',
  'color.border.focus': '#2563eb',
  'color.primary.default': '#2563eb',
  'color.primary.hover': '#1d4ed8',
  'color.primary.active': '#1e40af',
  'color.primary.disabled': '#93b4f8',
  'color.danger.default': '#b91c1c',
  'color.danger.surface': '#fef2f2',
  'color.success.default': '#15803d',
  'color.success.surface': '#f0fdf4',
};

describe('buildTokens', () => {
  const doc = buildTokens(DEFAULT_TOKEN_STARTER_ID);

  it('ne change aucune valeur résolue par rapport à l’ancien DEFAULT_TOKENS littéral', () => {
    for (const [path, expected] of Object.entries(PRE_ADR_0020_RESOLVED_COLORS)) {
      expect(resolveTokenValue(doc, path)).toBe(expected);
    }
  });

  it('n’écrit jamais de valeur littérale hors du groupe `primitive`', () => {
    const color = (doc as { color: unknown }).color;
    assertNoLiteralValue(color, ['color']);
  });

  it('jette pour un starter inconnu, avant même d’écrire un fichier', () => {
    expect(() => buildTokens('inconnu')).toThrow(
      /starter de tokens inconnu|Starter de tokens inconnu/,
    );
  });
});

describe('checkStarterContrast', () => {
  it.each(TOKEN_STARTERS.map((starter) => starter.id))(
    'le starter "%s" respecte le contraste AA sur toutes les paires documentées',
    (starterId) => {
      const results = checkStarterContrast(starterId);
      expect(results).toHaveLength(SEMANTIC_CONTRAST_PAIRS.length);
      for (const result of results) {
        expect(result.ratio, result.label).toBeGreaterThanOrEqual(CONTRAST_MIN_AA);
        expect(result.passes, result.label).toBe(true);
      }
    },
  );
});

/** Un `$value` sous un chemin `color.*` (hors alias `{...}`) serait une régression : la
 * règle DESIGN.md §2 veut que seul `primitive` porte des valeurs littérales. */
function assertNoLiteralValue(node: unknown, path: readonly string[]): void {
  if (node === null || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;

  if (typeof record['$value'] === 'string') {
    expect(record['$value'], path.join('.')).toMatch(/^\{.+\}$/);
    return;
  }
  if (record['$value'] !== undefined) {
    // Valeur non-couleur (dimension, liste de familles…) : hors périmètre de ce ticket.
    return;
  }

  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('$')) continue;
    assertNoLiteralValue(value, [...path, key]);
  }
}
