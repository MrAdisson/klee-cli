import { describe, expect, it } from 'vitest';

import { indexableText } from './indexable.js';
import { searchDocuments } from './search.js';

/**
 * Le frontmatter porte le vocabulaire du format, pas du contenu. L'indexer faisait remonter
 * tous les artefacts du dépôt sur « mock », puisque chacun déclare `related_mockups`.
 */

const TICKET = `---
id: KLEE-042
title: Un titre
status: backlog
related_mockups:
  - MOCK-001
authored_by: agent
---

Le corps parle de scaffolding.
`;

describe('indexableText', () => {
  it('écarte les clés du frontmatter et garde ses valeurs', () => {
    const text = indexableText('tickets/KLEE-042.md', TICKET);
    expect(text).not.toContain('related_mockups');
    expect(text).not.toContain('authored_by');
    expect(text).toContain('MOCK-001');
    expect(text).toContain('Un titre');
    expect(text).toContain('Le corps parle de scaffolding.');
  });

  it('indexe un `.meta.yml` par ses seules valeurs', () => {
    const text = indexableText('mockups/pages/login.meta.yml', 'id: MOCK-002\nstatus: validated\n');
    expect(text).not.toContain('status');
    expect(text).toContain('MOCK-002');
    expect(text).toContain('validated');
  });

  it('laisse intact un fichier sans frontmatter', () => {
    expect(indexableText('docs/x.md', '# Titre\n\nDu texte.')).toBe('# Titre\n\nDu texte.');
  });

  it('retombe sur le texte brut plutôt que de ne rien indexer', () => {
    const broken = '---\nid: [non fermé\n---\n\nCorps.';
    expect(indexableText('tickets/x.md', broken)).toContain('Corps.');
  });
});

describe('recherche après filtrage du frontmatter', () => {
  const documents = [
    {
      id: 'KLEE-042',
      kind: 'ticket' as const,
      title: 'Un titre',
      path: 'tickets/KLEE-042.md',
      text: indexableText('tickets/KLEE-042.md', TICKET),
    },
  ];

  it('ne remonte plus un ticket sur le nom d’un champ', () => {
    expect(searchDocuments(documents, 'related')).toEqual([]);
    expect(searchDocuments(documents, 'authored_by')).toEqual([]);
  });

  it('mais continue de trouver l’arête déclarée dans ce champ', () => {
    expect(searchDocuments(documents, 'MOCK-001')).toHaveLength(1);
  });
});
