import { describe, expect, it } from 'vitest';

import { KleeError } from './errors.js';
import {
  DEFAULT_TOKEN_STARTER_ID,
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
  it('n’a qu’un starter pour l’instant — §13 exige deux alternatives pour justifier un choix', () => {
    // Documente la décision de ne pas exposer de question d'init tant qu'il n'y a pas de
    // second starter (ADR 0020) : ce test casse volontairement le jour où on en ajoute un,
    // pour rappeler qu'exposer le choix côté CLI devient alors légitime.
    expect(TOKEN_STARTERS).toHaveLength(1);
  });
});
