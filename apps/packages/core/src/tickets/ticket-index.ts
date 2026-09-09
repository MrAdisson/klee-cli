import type { Ticket } from './schema.js';

/**
 * Lecture des tickets (TECHNICAL.md §6, point provider `tickets-index`).
 *
 * Un index n'est **jamais** une source de vérité : les fichiers markdown le restent, et tout
 * index doit pouvoir être supprimé puis reconstruit sans perte. C'est la condition pour que
 * le dépôt reste lisible et modifiable sans passer par Klee.
 */
export interface TicketIndex {
  list(): Promise<Ticket[]>;
  get(id: string): Promise<Ticket | null>;
  /** Libère les ressources éventuelles (connexion, descripteur). */
  close(): void;
}

export interface TicketIndexFactory {
  /** `root` est la racine du projet, pas le dossier `tickets/`. */
  create(root: string): TicketIndex;
}
