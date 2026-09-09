import type { EntityKind } from '../ids.js';

/**
 * Recherche transverse (TECHNICAL.md §9).
 *
 * Le domaine ne lit aucun fichier : il reçoit des documents déjà chargés et décide lesquels
 * correspondent, dans quel ordre, et quel passage montrer. C'est ce qui la rend testable sans
 * projet sur le disque, et indépendante de l'endroit d'où on l'appelle.
 *
 * Chercher les trois natures d'un coup est ce qu'aucun des trois serveurs agrégés par le
 * studio ne peut faire seul : le board ne connaît que les tickets, Docusaurus que les
 * documents, Eleventy que les maquettes.
 */

/** Un artefact indexable : le nœud du graphe, augmenté du texte de son fichier. */
export interface SearchDocument {
  readonly id: string;
  readonly kind: EntityKind;
  readonly title: string;
  readonly path: string;
  /** Contenu du fichier. Vide est licite : le titre et l'identifiant restent cherchables. */
  readonly text: string;
}

export interface SearchHit {
  readonly id: string;
  readonly kind: EntityKind;
  readonly title: string;
  readonly path: string;
  /** Passage du corps qui correspond, ou `null` quand seul le titre correspond. */
  readonly excerpt: string | null;
  /** Rang de correspondance ; sert au tri, pas à l'affichage. */
  readonly score: number;
}

/**
 * Repli des accents et de la casse.
 *
 * Sans lui, chercher « accessibilite » ne trouverait pas « accessibilité » — inutilisable
 * pour qui tape vite, et le projet est écrit en français.
 *
 * **La longueur est préservée**, et c'est un invariant : les extraits sont découpés dans le
 * texte d'origine à des positions trouvées dans le texte replié. La plage est donc celle des
 * seuls signes combinants (U+0300–U+036F), et surtout pas `\p{Diacritic}`, qui range
 * l'accent grave parmi les diacritiques et ferait disparaître tous les accents graves du
 * texte — nos documents en sont pleins.
 */
export function foldForSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const TITLE_SCORE = 100;
const ID_SCORE = 200;
const BODY_SCORE = 1;
const EXCERPT_RADIUS = 60;

export function searchDocuments(
  documents: readonly SearchDocument[],
  query: string,
): readonly SearchHit[] {
  const needle = foldForSearch(query.trim());
  if (needle === '') return [];

  const hits: SearchHit[] = [];

  for (const document of documents) {
    // L'identifiant passe devant tout : chercher `MOCK-001`, c'est vouloir la maquette
    // elle-même avant ce qui la cite.
    const inId = foldForSearch(document.id).includes(needle);
    const inTitle = foldForSearch(document.title).includes(needle);
    const body = foldForSearch(document.text);
    const at = body.indexOf(needle);

    if (!inId && !inTitle && at === -1) continue;

    const score =
      (inId ? ID_SCORE : 0) + (inTitle ? TITLE_SCORE : 0) + (at === -1 ? 0 : BODY_SCORE);

    hits.push({
      id: document.id,
      kind: document.kind,
      title: document.title,
      path: document.path,
      excerpt: at === -1 ? null : excerptAround(document.text, at, needle.length),
      score,
    });
  }

  // À score égal, l'ordre des identifiants : deux exécutions doivent rendre la même page.
  return hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/**
 * Passage autour de la correspondance. Les indices viennent du texte replié, qui a la même
 * longueur que l'original : le repli retire des diacritiques sans changer le nombre de
 * caractères, donc découper l'original aux mêmes bornes reste juste.
 */
function excerptAround(text: string, at: number, length: number): string {
  const start = Math.max(0, at - EXCERPT_RADIUS);
  const end = Math.min(text.length, at + length + EXCERPT_RADIUS);
  const slice = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${slice}${end < text.length ? '…' : ''}`;
}
