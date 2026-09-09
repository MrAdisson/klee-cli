import { createServer } from 'node:http';

import { KleeError } from '@klee/core';

/**
 * Attribution des ports pour les serveurs locaux de klee.
 *
 * Deux projets Klee ouverts en parallèle, c'est le cas ordinaire — pas le cas limite. Or les
 * serveurs se comportent tous mal sur un port déjà pris : Docusaurus pose une question et
 * abandonne quand personne ne peut répondre, Eleventy **annonce l'URL du port occupé** puis
 * meurt, et un serveur écrit par nous rendait une trace de pile.
 *
 * D'où deux règles, et une seule différence entre elles :
 *
 * - **Un port demandé explicitement** (`--port`) est honoré ou refusé. Quelqu'un qui nomme un
 *   port a une raison ; le déplacer en douce trahirait cette raison.
 * - **Un port par défaut** est une préférence, pas une exigence : s'il est pris, on en prend
 *   un autre — et on le **dit**. Le danger n'a jamais été de changer de port, c'est de
 *   changer sans le dire, et de laisser croire qu'on regarde son propre projet.
 */

export interface ResolvedPort {
  readonly port: number;
  /** Vrai quand le port par défaut était pris et qu'on a dû en choisir un autre. */
  readonly moved: boolean;
}

/**
 * Résout le port d'un serveur que klee lance lui-même.
 *
 * @param requested port nommé par l'utilisateur, ou `undefined` pour le défaut.
 */
export async function resolvePort(
  requested: number | undefined,
  fallback: number,
  label: string,
): Promise<ResolvedPort> {
  if (requested !== undefined) {
    if (await isFree(requested)) return { port: requested, moved: false };
    throw new KleeError(`Le port ${String(requested)} est déjà pris.`, {
      code: 'PORT_IN_USE',
      hint: `Un autre ${label} tourne peut-être déjà, ou un autre projet. Choisissez un autre port.`,
    });
  }

  if (await isFree(fallback)) return { port: fallback, moved: false };
  return { port: await freePort(), moved: true };
}

/** Un port que le système vient de nous attribuer : personne d'autre ne l'occupe. */
export async function freePort(): Promise<number> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = await ephemeral();
    // Le port rendu par le système est libre sur l'interface sondée ; on vérifie qu'il l'est
    // aussi sur l'autre, faute de quoi on aurait déplacé le problème plutôt que de le régler.
    if (await isFree(candidate)) return candidate;
  }
  throw new KleeError('Aucun port libre trouvé.', {
    code: 'PORT_NONE_FREE',
    hint: 'Beaucoup de serveurs tournent — arrêtez-en un, ou nommez un port avec --port.',
  });
}

function ephemeral(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => {
        resolve(port);
      });
    });
  });
}

/**
 * Teste un port en s'y liant réellement, **des deux façons** dont un serveur peut le prendre.
 *
 * Ce n'est pas une précaution théorique : mesuré sur macOS, chaque sonde seule rate
 * exactement le cas que l'autre attrape.
 *
 * | Détenteur | Sonde `127.0.0.1` | Sonde joker |
 * | --------- | ----------------- | ----------- |
 * | `127.0.0.1` (notre board, notre studio) | voit occupé | **croit libre** |
 * | `*` (Eleventy, Docusaurus)              | **croit libre** | voit occupé |
 *
 * Avec la seule sonde de boucle locale, klee lançait un second serveur de maquettes en le
 * croyant sur 8080 : c'est Eleventy qui glissait sur 8081, en silence — précisément ce que ce
 * module existe pour empêcher.
 */
export async function isFree(port: number): Promise<boolean> {
  return (await bindable(port, LOOPBACK)) && (await bindable(port, undefined));
}

const LOOPBACK = '127.0.0.1';

/** `host` à `undefined` lie le joker, comme le font les serveurs que klee lance. */
function bindable(port: number, host: string | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => {
      resolve(false);
    });
    const listening = (): void => {
      probe.close(() => {
        resolve(true);
      });
    };
    if (host === undefined) probe.listen(port, listening);
    else probe.listen(port, host, listening);
  });
}

/** Lit un `--port` de la ligne de commande, ou explique pourquoi il n'en est pas un. */
export function parsePortOption(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new KleeError(`« ${value} » n'est pas un port valide.`, {
      code: 'PORT_INVALID',
      hint: 'Un entier entre 1 et 65535.',
    });
  }
  return port;
}
