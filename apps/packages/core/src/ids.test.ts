import { describe, expect, it } from 'vitest';

import {
  DOC_PREFIX,
  MOCKUP_PREFIX,
  extractIds,
  formatId,
  isValidIdPrefix,
  parseId,
} from './ids.js';

describe('formatId', () => {
  it('complète le numéro sur trois chiffres', () => {
    expect(formatId(MOCKUP_PREFIX, 42)).toBe('MOCK-042');
    expect(formatId(DOC_PREFIX, 18)).toBe('DOC-018');
    expect(formatId('PROJ', 1234)).toBe('PROJ-1234');
  });

  it('refuse un préfixe qui ne respecte pas la convention', () => {
    expect(() => formatId('proj', 1)).toThrow(/Préfixe/);
    expect(() => formatId('P', 1)).toThrow(/Préfixe/);
  });
});

describe('parseId', () => {
  it('reconnaît les trois natures d’entité', () => {
    expect(parseId('PROJ-123', 'PROJ')?.kind).toBe('ticket');
    expect(parseId('MOCK-042', 'PROJ')?.kind).toBe('mockup');
    expect(parseId('DOC-018', 'PROJ')?.kind).toBe('doc');
  });

  it('tient compte du préfixe de tickets propre au projet', () => {
    expect(parseId('ACME-7', 'ACME')?.kind).toBe('ticket');
    // Le même identifiant n'a aucun sens dans un projet dont le préfixe diffère.
    expect(parseId('ACME-7', 'PROJ')).toBeNull();
  });

  it('rejette ce qui n’est pas un identifiant du projet', () => {
    expect(parseId('PROJ_123', 'PROJ')).toBeNull();
    expect(parseId('proj-123', 'PROJ')).toBeNull();
    expect(parseId('', 'PROJ')).toBeNull();
  });
});

describe('extractIds', () => {
  it('extrait les identifiants d’un texte libre, sans doublon et dans l’ordre', () => {
    const text = 'Le ticket PROJ-12 implémente MOCK-042 (voir DOC-018) et clôt PROJ-12.';
    expect(extractIds(text, 'PROJ').map((id) => id.raw)).toEqual([
      'PROJ-12',
      'MOCK-042',
      'DOC-018',
    ]);
  });

  it('ignore les jetons qui ressemblent à un identifiant sans en être un', () => {
    expect(extractIds('UNKNOWN-1 et HTTP-404', 'PROJ')).toEqual([]);
  });
});

describe('isValidIdPrefix', () => {
  it('accepte 2 à 10 caractères majuscules commençant par une lettre', () => {
    expect(isValidIdPrefix('PROJ')).toBe(true);
    expect(isValidIdPrefix('A1')).toBe(true);
    expect(isValidIdPrefix('A')).toBe(false);
    expect(isValidIdPrefix('1AB')).toBe(false);
    expect(isValidIdPrefix('TROPLONGPREFIXE')).toBe(false);
  });
});
