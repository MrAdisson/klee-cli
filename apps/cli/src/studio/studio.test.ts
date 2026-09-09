import { describe, expect, it } from 'vitest';
import type { GraphNode } from '@klee/core';

import { renderStudio } from './render.js';
import { deepLinkFor, safeInnerPath } from './targets.js';

/**
 * Le studio agrège des serveurs qu'il ne contrôle pas : ce qui se teste ici est la partie
 * qui lui appartient en propre — la déduction des URL, le garde-fou sur `?at=`, et la
 * coquille. Le démarrage des enfants se vérifie en le lançant, pas en le simulant.
 */

function node(partial: Partial<GraphNode> & Pick<GraphNode, 'id' | 'kind' | 'path'>): GraphNode {
  return { title: partial.id, status: null, implementedIn: null, ...partial };
}

describe('deepLinkFor', () => {
  it('envoie un ticket sur sa page, qui porte contenu et voisinage', () => {
    const link = deepLinkFor(node({ id: 'KLEE-001', kind: 'ticket', path: 'tickets/KLEE-001.md' }));
    expect(link).toEqual({ tab: 'board', path: '/tickets/KLEE-001' });
  });

  it('déduit l’URL Docusaurus du dossier et de l’identifiant', () => {
    expect(
      deepLinkFor(node({ id: 'DOC-016', kind: 'doc', path: 'docs/decisions/0013-x.md' })),
    ).toEqual({ tab: 'docs', path: '/decisions/DOC-016/' });
    expect(
      deepLinkFor(node({ id: 'DOC-005', kind: 'doc', path: 'docs/technical/cli.md' })),
    ).toEqual({ tab: 'docs', path: '/technical/DOC-005/' });
  });

  /**
   * Classe de bug trouvée en lançant le studio : le nœud d'une maquette porte le chemin de
   * son `.meta.yml`, pas celui de la page. Ne retirer qu'une extension produisait
   * `/components/button/button.meta/`, une URL qui n'existe nulle part.
   */
  it('retire `.meta.yml` en entier, et replie `foo/foo` sur `foo`', () => {
    expect(
      deepLinkFor(
        node({ id: 'MOCK-001', kind: 'mockup', path: 'mockups/components/button/button.meta.yml' }),
      ),
    ).toEqual({ tab: 'mockups', path: '/components/button/' });
  });

  it('garde le nom du fichier quand il ne répète pas son dossier', () => {
    expect(
      deepLinkFor(node({ id: 'MOCK-002', kind: 'mockup', path: 'mockups/pages/login.meta.yml' })),
    ).toEqual({ tab: 'mockups', path: '/pages/login/' });
  });

  it('ouvre les documents index à la racine de leur section', () => {
    expect(
      deepLinkFor(node({ id: 'DOC-002', kind: 'doc', path: 'docs/technical/index.md' })),
    ).toEqual({ tab: 'docs', path: '/technical/' });
    expect(
      deepLinkFor(node({ id: 'DOC-003', kind: 'doc', path: 'docs/product/index.md' })),
    ).toEqual({ tab: 'docs', path: '/product/' });
  });
});

describe('safeInnerPath', () => {
  it('accepte un chemin local', () => {
    expect(safeInnerPath('/decisions/DOC-016/')).toBe('/decisions/DOC-016/');
    expect(safeInnerPath('/links/KLEE-001')).toBe('/links/KLEE-001');
  });

  // Sans ce filtre, le studio deviendrait un cadre à afficher n'importe quel site distant
  // sur une page que l'utilisateur croit locale.
  it('refuse tout ce qui pourrait désigner un autre site', () => {
    expect(safeInnerPath('https://exemple.test/')).toBeNull();
    expect(safeInnerPath('//exemple.test/')).toBeNull();
    expect(safeInnerPath('/\\exemple.test')).toBeNull();
    expect(safeInnerPath('/a b')).toBeNull();
    expect(safeInnerPath('/a\nb')).toBeNull();
    expect(safeInnerPath('')).toBeNull();
    expect(safeInnerPath(null)).toBeNull();
  });
});

describe('renderStudio', () => {
  const tabs = [
    { id: 'board' as const, label: 'Board', url: 'http://127.0.0.1:4000/' },
    { id: 'docs' as const, label: 'Docs', url: 'http://127.0.0.1:4001/' },
  ];

  it('marque l’onglet courant et compose la source du cadre', () => {
    const html = renderStudio({
      projectName: 'demo',
      tabs,
      active: 'docs',
      at: '/decisions/DOC-016/',
    });

    expect(html).toContain('aria-current="page" href="/?tab=docs"');
    expect(html).toContain('src="http://127.0.0.1:4001/decisions/DOC-016/"');
  });

  /** Perdre un serveur ne doit pas coûter les autres : l'onglet dit pourquoi, et c'est tout. */
  it('montre la raison d’un onglet qui n’a pas démarré, sans cadre', () => {
    const html = renderStudio({
      projectName: 'demo',
      tabs: [tabs[0]!, { id: 'docs', label: 'Docs', url: null, failure: 'port déjà pris' }],
      active: 'docs',
      at: '/',
    });

    expect(html).toContain('port déjà pris');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('hors service');
  });

  it('échappe le nom du projet plutôt que de l’injecter', () => {
    const html = renderStudio({
      projectName: '<script>alert(1)</script>',
      tabs,
      active: 'board',
      at: '/',
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
