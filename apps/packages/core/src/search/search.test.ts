import { describe, expect, it } from 'vitest';

import { foldForSearch, searchDocuments, type SearchDocument } from './search.js';

/** Les scénarios de KLEE-006, sans serveur : la recherche ne dépend que de ce qu'on lui donne. */

const documents: readonly SearchDocument[] = [
  {
    id: 'KLEE-001',
    kind: 'ticket',
    title: 'Brancher le schéma d’identifiants',
    path: 'tickets/KLEE-001.md',
    text: 'Ce ticket cite MOCK-001 et parle d’accessibilité dans son corps.',
  },
  {
    id: 'DOC-018',
    kind: 'doc',
    title: 'Détection de dérive hors scope',
    path: 'docs/decisions/0015-x.md',
    text: 'Un signal qui crie pour rien finit ignoré. Question d’accessibilité mise à part.',
  },
  {
    id: 'MOCK-001',
    kind: 'mockup',
    title: 'Bouton',
    path: 'mockups/components/button/button.meta.yml',
    text: 'status: validated',
  },
];

const ids = (query: string): string[] => searchDocuments(documents, query).map((hit) => hit.id);

describe('searchDocuments', () => {
  it('couvre les trois natures d’artefact en une seule recherche', () => {
    const kinds = new Set(searchDocuments(documents, 'MOCK-001').map((hit) => hit.kind));
    expect(kinds.has('ticket')).toBe(true);
    expect(kinds.has('mockup')).toBe(true);
  });

  it('cherche dans le corps, pas seulement dans les titres', () => {
    // Aucun de ces deux titres ne contient le mot : il n'est que dans le corps.
    expect(ids('accessibilité')).toEqual(['DOC-018', 'KLEE-001']);
  });

  it('rend un extrait du passage trouvé', () => {
    const [hit] = searchDocuments(documents, 'signal');
    expect(hit?.excerpt).toContain('signal qui crie pour rien');
  });

  it('trouve un identifiant, et l’artefact lui-même passe devant ce qui le cite', () => {
    expect(ids('MOCK-001')).toEqual(['MOCK-001', 'KLEE-001']);
  });

  it('ignore les accents et la casse', () => {
    expect(ids('ACCESSIBILITE')).toEqual(ids('accessibilité'));
    expect(ids('DERIVE')).toEqual(['DOC-018']);
  });

  it('classe le titre avant le corps', () => {
    expect(ids('bouton')).toEqual(['MOCK-001']);
    const both = searchDocuments(
      [
        { id: 'A-1', kind: 'ticket', title: 'Rien', path: 'a', text: 'gate' },
        { id: 'B-1', kind: 'ticket', title: 'Gate', path: 'b', text: 'rien' },
      ],
      'gate',
    );
    expect(both.map((hit) => hit.id)).toEqual(['B-1', 'A-1']);
  });

  it('ne rend rien sur une requête vide, plutôt que tout', () => {
    expect(searchDocuments(documents, '   ')).toEqual([]);
  });

  it('rend une liste vide quand le terme est absent', () => {
    expect(searchDocuments(documents, 'zzzinexistant')).toEqual([]);
  });

  it('marque l’extrait par des ellipses quand il coupe le texte', () => {
    const long = 'a'.repeat(200);
    const [hit] = searchDocuments(
      [{ id: 'C-1', kind: 'doc', title: 'Long', path: 'c', text: `${long} cible ${long}` }],
      'cible',
    );
    expect(hit?.excerpt?.startsWith('…')).toBe(true);
    expect(hit?.excerpt?.endsWith('…')).toBe(true);
  });

  it('reste déterministe à score égal', () => {
    const twice = [
      searchDocuments(documents, 'accessibilité'),
      searchDocuments(documents, 'accessibilité'),
    ];
    expect(twice[0]).toEqual(twice[1]);
  });
});

describe('foldForSearch', () => {
  /**
   * Les extraits sont découpés dans le texte d'origine à des positions trouvées dans le
   * texte replié : si le repli changeait la longueur, tout surlignage serait décalé. C'est
   * arrivé avec `\p{Diacritic}`, qui range l'accent grave parmi les diacritiques.
   */
  it('préserve la longueur, accents graves compris', () => {
    for (const sample of [
      'dérogation',
      "L'accessibilité est un gate sur `validated`",
      '``` gherkin ```',
      'ÉÀÇÙÎ öü',
      'sans rien de spécial',
    ]) {
      expect(foldForSearch(sample)).toHaveLength(sample.length);
    }
  });

  it('ne mange pas les accents graves du texte', () => {
    expect(foldForSearch('`code`')).toBe('`code`');
  });
});
