import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { parseTicket } from './format.js';
import { listTicketFiles, ticketsDir, TICKETS_DIRNAME } from './store.js';
import { ticketFrontmatterSchema, type Ticket } from './schema.js';
import type { TicketIndex, TicketIndexFactory } from './ticket-index.js';

/**
 * Index SQLite local, reconstructible (TECHNICAL.md §6).
 *
 * L'invalidation se fait par `mtime` + taille de chaque fichier : un fichier inchangé n'est
 * jamais reparsé, un fichier modifié — y compris par un `git checkout` qui réécrit tout — l'est
 * systématiquement. C'est ce qui permet à l'index de survivre à un changement de branche sans
 * mentir, contrairement à un cache horodaté globalement.
 *
 * La base vit dans `.klee/` et n'est pas versionnée : la supprimer ne perd rien.
 */

const CACHE_DIRNAME = '.klee';
const DB_FILENAME = 'tickets.db';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tickets (
  path TEXT PRIMARY KEY,
  mtime_ms INTEGER NOT NULL,
  size INTEGER NOT NULL,
  id TEXT NOT NULL,
  frontmatter TEXT NOT NULL,
  body TEXT NOT NULL,
  acceptance TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tickets_id ON tickets (id);
`;

interface Row {
  readonly path: string;
  readonly id: string;
  readonly frontmatter: string;
  readonly body: string;
  readonly acceptance: string;
}

class SqliteTicketIndex implements TicketIndex {
  readonly #root: string;
  #db: DatabaseSync | undefined;

  constructor(root: string) {
    this.#root = root;
  }

  async list(): Promise<Ticket[]> {
    const db = this.#open();
    await this.#refresh(db);

    const rows = db.prepare('SELECT * FROM tickets ORDER BY id').all() as unknown as Row[];
    return rows.map((row) => hydrate(row)).sort((a, b) => compareIds(a.id, b.id));
  }

  async get(id: string): Promise<Ticket | null> {
    const db = this.#open();
    await this.#refresh(db);

    const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as unknown as
      Row | undefined;
    return row === undefined ? null : hydrate(row);
  }

  close(): void {
    this.#db?.close();
    this.#db = undefined;
  }

  #open(): DatabaseSync {
    if (this.#db === undefined) {
      const dir = join(this.#root, CACHE_DIRNAME);
      mkdirSync(dir, { recursive: true });
      this.#db = new DatabaseSync(join(dir, DB_FILENAME));
      this.#db.exec(SCHEMA);
    }
    return this.#db;
  }

  /** Réconcilie l'index avec le disque : ajouts, modifications et suppressions. */
  async #refresh(db: DatabaseSync): Promise<void> {
    const files = await listTicketFiles(this.#root);
    const known = new Map<string, { mtime_ms: number; size: number }>(
      (
        db.prepare('SELECT path, mtime_ms, size FROM tickets').all() as unknown as {
          path: string;
          mtime_ms: number;
          size: number;
        }[]
      ).map((row) => [row.path, { mtime_ms: row.mtime_ms, size: row.size }]),
    );

    const upsert = db.prepare(
      `INSERT INTO tickets (path, mtime_ms, size, id, frontmatter, body, acceptance)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         mtime_ms = excluded.mtime_ms, size = excluded.size, id = excluded.id,
         frontmatter = excluded.frontmatter, body = excluded.body,
         acceptance = excluded.acceptance`,
    );

    const seen = new Set<string>();

    for (const file of files) {
      const relative = `${TICKETS_DIRNAME}/${file}`;
      seen.add(relative);

      const stats = statSync(join(ticketsDir(this.#root), file));
      const previous = known.get(relative);
      if (
        previous !== undefined &&
        previous.mtime_ms === stats.mtimeMs &&
        previous.size === stats.size
      ) {
        continue;
      }

      const ticket = parseTicket(
        relative,
        readFileSync(join(ticketsDir(this.#root), file), 'utf8'),
      );
      const { path: _path, body, acceptance, ...frontmatter } = ticket;
      upsert.run(
        relative,
        Math.trunc(stats.mtimeMs),
        stats.size,
        ticket.id,
        JSON.stringify(frontmatter),
        body,
        acceptance,
      );
    }

    for (const path of known.keys()) {
      if (!seen.has(path)) {
        db.prepare('DELETE FROM tickets WHERE path = ?').run(path);
      }
    }
  }
}

function hydrate(row: Row): Ticket {
  // Le frontmatter est revalidé à la sortie de l'index : une base corrompue ou écrite par une
  // version antérieure ne doit pas produire un ticket au format invalide.
  const frontmatter = ticketFrontmatterSchema.parse(JSON.parse(row.frontmatter));
  return { ...frontmatter, path: row.path, body: row.body, acceptance: row.acceptance };
}

function compareIds(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

export const sqliteTicketIndexFactory: TicketIndexFactory = {
  create: (root: string) => new SqliteTicketIndex(root),
};
