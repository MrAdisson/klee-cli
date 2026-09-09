/**
 * Schéma d'identifiants partagé (TECHNICAL.md §7).
 *
 * C'est le socle du graphe de traçabilité : une seule convention imposée, jamais
 * configurable par module, sinon les liens croisés (ticket → maquette → doc → code)
 * cessent d'être résolvables d'un projet à l'autre.
 *
 *   <PREFIX>-<number>   ex. PROJ-123 (ticket), MOCK-042 (maquette), DOC-018 (document)
 *
 * Seul le préfixe des tickets est propre au projet (`idPrefix` dans project.config.json) :
 * il porte le nom de l'équipe ou du produit et doit pouvoir coïncider avec une clé Jira
 * existante lors d'une migration progressive (TECHNICAL.md §12). `MOCK` et `DOC` sont fixes.
 */

export const ENTITY_KINDS = ['ticket', 'mockup', 'doc'] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export const MOCKUP_PREFIX = 'MOCK';
export const DOC_PREFIX = 'DOC';
export const DEFAULT_TICKET_PREFIX = 'PROJ';

/** Préfixe : 2 à 10 caractères, majuscules et chiffres, commençant par une lettre. */
export const ID_PREFIX_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

const ID_PATTERN = /^([A-Z][A-Z0-9]{1,9})-(\d{1,6})$/;
const ID_SCAN_PATTERN = /\b([A-Z][A-Z0-9]{1,9})-(\d{1,6})\b/g;

/** Largeur de numérotation par défaut : MOCK-042, DOC-018. */
export const ID_NUMBER_PADDING = 3;

export interface EntityId {
  readonly kind: EntityKind;
  readonly prefix: string;
  readonly number: number;
  readonly raw: string;
}

export function isValidIdPrefix(prefix: string): boolean {
  return ID_PREFIX_PATTERN.test(prefix);
}

export function formatId(prefix: string, value: number, padding = ID_NUMBER_PADDING): string {
  if (!isValidIdPrefix(prefix)) {
    throw new Error(
      `Préfixe d'identifiant invalide : "${prefix}" (attendu : ${String(ID_PREFIX_PATTERN)})`,
    );
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Numéro d'identifiant invalide : ${String(value)}`);
  }
  return `${prefix}-${String(value).padStart(padding, '0')}`;
}

function kindForPrefix(prefix: string, ticketPrefix: string): EntityKind | null {
  if (prefix === MOCKUP_PREFIX) return 'mockup';
  if (prefix === DOC_PREFIX) return 'doc';
  if (prefix === ticketPrefix) return 'ticket';
  return null;
}

/** Analyse un identifiant isolé. Retourne `null` si la chaîne n'est pas un ID connu du projet. */
export function parseId(
  raw: string,
  ticketPrefix: string = DEFAULT_TICKET_PREFIX,
): EntityId | null {
  const match = ID_PATTERN.exec(raw.trim());
  if (!match) return null;

  const prefix = match[1];
  const digits = match[2];
  if (prefix === undefined || digits === undefined) return null;

  const kind = kindForPrefix(prefix, ticketPrefix);
  if (kind === null) return null;

  return { kind, prefix, number: Number.parseInt(digits, 10), raw: `${prefix}-${digits}` };
}

/**
 * Extrait tous les identifiants connus d'un texte libre, dans l'ordre d'apparition et
 * sans doublon. Base des liens croisés cliquables du cockpit (DESIGN.md §5).
 */
export function extractIds(text: string, ticketPrefix: string = DEFAULT_TICKET_PREFIX): EntityId[] {
  const found = new Map<string, EntityId>();
  for (const match of text.matchAll(ID_SCAN_PATTERN)) {
    const parsed = parseId(match[0], ticketPrefix);
    if (parsed && !found.has(parsed.raw)) {
      found.set(parsed.raw, parsed);
    }
  }
  return [...found.values()];
}
