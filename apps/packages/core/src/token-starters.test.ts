import { describe, expect, it } from 'vitest';

import { KleeError } from './errors.js';
import {
  DEFAULT_TOKEN_STARTER_ID,
  MIN_READABLE_FONT_SIZE,
  TOKEN_STARTERS,
  contrastRatio,
  findTokenStarter,
  resolveTokenStarter,
  resolveTokenValue,
} from './token-starters.js';

describe('TOKEN_STARTERS', () => {
  it('enregistre klee-default comme starter par défaut', () => {
    expect(findTokenStarter(DEFAULT_TOKEN_STARTER_ID)?.id).toBe(DEFAULT_TOKEN_STARTER_ID);
  });

  it('retourne undefined pour un id inconnu, jette pour resolveTokenStarter', () => {
    expect(findTokenStarter('inconnu')).toBeUndefined();
    expect(() => {
      resolveTokenStarter('inconnu');
    }).toThrow(KleeError);
  });
});

describe('resolveTokenValue', () => {
  const doc = {
    primitive: { color: { gray: { 900: { $value: '#111827' } } } },
    color: {
      text: { primary: { $value: '{primitive.color.gray.900}' } },
      // Chaîne d'alias : un token sémantique qui référence un autre token sémantique.
      heading: { $value: '{color.text.primary}' },
    },
  };

  it('résout une référence directe vers un primitif', () => {
    expect(resolveTokenValue(doc, 'color.text.primary')).toBe('#111827');
  });

  it('suit une chaîne d’alias jusqu’à la valeur littérale', () => {
    expect(resolveTokenValue(doc, 'color.heading')).toBe('#111827');
  });

  it('jette sur un chemin sans $value', () => {
    expect(() => {
      resolveTokenValue(doc, 'primitive.color.gray');
    }).toThrow(KleeError);
  });

  it('jette sur un alias circulaire', () => {
    const circular = { a: { $value: '{b}' }, b: { $value: '{a}' } };
    expect(() => {
      resolveTokenValue(circular, 'a');
    }).toThrow(/circulaire/);
  });
});

describe('contrastRatio', () => {
  it('vaut 21:1 entre noir et blanc', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('vaut 1:1 pour une couleur contre elle-même', () => {
    expect(contrastRatio('#2563eb', '#2563eb')).toBeCloseTo(1, 5);
  });

  it('est symétrique', () => {
    expect(contrastRatio('#111827', '#f9fafb')).toBeCloseTo(
      contrastRatio('#f9fafb', '#111827'),
      10,
    );
  });

  it('jette sur une couleur qui n’est pas un #rrggbb', () => {
    expect(() => {
      contrastRatio('blue', '#ffffff');
    }).toThrow(KleeError);
  });
});

describe('registre', () => {
  it('a au moins deux starters — condition posée par §13 pour justifier une question à l’init', () => {
    // ADR 0020 : en dessous de deux alternatives, poser la question serait un faux choix.
    // ADR 0021 en ajoute cinq justement pour franchir ce seuil.
    expect(TOKEN_STARTERS.length).toBeGreaterThanOrEqual(2);
  });

  it('n’a que des id uniques', () => {
    const ids = TOKEN_STARTERS.map((starter) => starter.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(TOKEN_STARTERS.map((starter) => starter.id))(
    'le starter "%s" ne descend jamais sous la taille de police minimale lisible',
    (id) => {
      const starter = resolveTokenStarter(id);
      for (const size of Object.values(starter.font.size)) {
        expect(size).toBeGreaterThanOrEqual(MIN_READABLE_FONT_SIZE);
      }
    },
  );

  it.each(TOKEN_STARTERS.map((starter) => starter.id))(
    'le starter "%s" a une échelle de tailles strictement croissante',
    (id) => {
      const { sm, md, lg, xl } = resolveTokenStarter(id).font.size;
      expect(sm).toBeLessThan(md);
      expect(md).toBeLessThan(lg);
      expect(lg).toBeLessThan(xl);
    },
  );
});
