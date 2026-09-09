import { readTicket, readTickets } from './store.js';
import type { Ticket } from './schema.js';
import type { TicketIndex, TicketIndexFactory } from './ticket-index.js';

/**
 * Index sans index : chaque lecture reparse les fichiers.
 *
 * C'est le défaut, et ce n'est pas un pis-aller. Quelques milliers de tickets se parsent en
 * bien moins d'une seconde, et l'absence d'état supprime d'un coup l'invalidation de cache,
 * la péremption au changement de branche et un fichier à ignorer. On paiera un index le jour
 * où un corpus réel le réclamera, pas par anticipation.
 */
class MarkdownTicketIndex implements TicketIndex {
  readonly #root: string;

  constructor(root: string) {
    this.#root = root;
  }

  list(): Promise<Ticket[]> {
    return readTickets(this.#root);
  }

  get(id: string): Promise<Ticket | null> {
    return readTicket(this.#root, id);
  }

  close(): void {
    // Rien à libérer : c'est tout l'intérêt.
  }
}

export const markdownTicketIndexFactory: TicketIndexFactory = {
  create: (root: string) => new MarkdownTicketIndex(root),
};
