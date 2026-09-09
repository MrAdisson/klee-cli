import type { GraphNode } from '@klee/core';

/**
 * D'un identifiant du graphe vers l'endroit du studio qui le montre (TECHNICAL.md §9 —
 * « deep links cliquables d'un onglet à l'autre via le schéma d'ID commun »).
 *
 * Les chemins publics sont **déduits**, jamais déclarés : c'est le générateur du site ou des
 * maquettes qui décide de ses URL, et lui demander de les écrire quelque part créerait une
 * copie à maintenir — la dérive que ce projet cherche justement à éviter.
 *
 * Une déduction se trompe, en revanche. Le serveur du studio vérifie donc chaque cible par
 * une requête avant de l'ouvrir, et retombe sur l'accueil de l'onglet quand elle ne répond
 * pas : c'est la règle « vérifier, pas supposer » appliquée à une convention d'URL qui ne
 * nous appartient pas.
 */

export type TabId = 'board' | 'docs' | 'mockups';

export interface DeepLink {
  readonly tab: TabId;
  /** Chemin dans le serveur de l'onglet, toujours absolu. */
  readonly path: string;
}

export function deepLinkFor(node: GraphNode): DeepLink | null {
  switch (node.kind) {
    case 'ticket':
      // Le board sait déjà afficher le voisinage d'un identifiant : rien à déduire.
      return { tab: 'board', path: `/links/${encodeURIComponent(node.id)}` };
    case 'doc':
      return { tab: 'docs', path: docPath(node) };
    case 'mockup':
      return { tab: 'mockups', path: mockupPath(node) };
    default:
      return null;
  }
}

/**
 * Docusaurus prend le `id:` du frontmatter comme slug du document, et le dossier comme
 * section : `docs/decisions/0013-x.md` porte `id: DOC-016` et se sert en `/decisions/DOC-016/`.
 */
function docPath(node: GraphNode): string {
  const section = node.path
    .replace(/^docs\//, '')
    .split('/')
    .slice(0, -1)
    .filter((part) => part !== '')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return section === ''
    ? `/${encodeURIComponent(node.id)}/`
    : `/${section}/${encodeURIComponent(node.id)}/`;
}

/**
 * Eleventy sert un fichier comme un dossier, et **replie** `foo/foo.html` sur `foo/` — d'où
 * `components/button/button.html` en `/components/button/`.
 */
function mockupPath(node: GraphNode): string {
  const parts = node.path
    .replace(/^mockups\//, '')
    // Le nœud porte le chemin du `.meta.yml`, pas celui de la page : c'est le fichier de
    // métadonnées qui déclare l'identifiant. Retirer la seule dernière extension laisserait
    // un « button.meta » qui ne correspond à aucune URL.
    .replace(/\.meta\.ya?ml$/, '')
    .replace(/\.[^./]+$/, '')
    .split('/')
    .filter((part) => part !== '');

  const last = parts.at(-1);
  const previous = parts.at(-2);
  const segments = last !== undefined && last === previous ? parts.slice(0, -1) : parts;

  return segments.length === 0 ? '/' : `/${segments.map(encodeURIComponent).join('/')}/`;
}

/**
 * Un chemin venu d'une requête ne doit jamais pouvoir désigner autre chose qu'une page de
 * l'onglet : sans ce filtre, `?at=https://exemple.test` ferait du studio un cadre à afficher
 * n'importe quel site, sur une page que l'utilisateur croit locale.
 */
export function safeInnerPath(value: string | null): string | null {
  if (value === null || value === '') return null;
  // `//exemple.test` est une URL absolue déguisée ; `\` en est la variante que les
  // navigateurs normalisent en `/`.
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  // Espaces et caractères de contrôle : de quoi fermer l'attribut et en ouvrir un autre.
  // Comparé par code plutôt que par expression régulière, qui ne pourrait porter ces
  // caractères qu’en les rendant invisibles dans la source.
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x20 || code === 0x7f) return null;
  }
  return value;
}
