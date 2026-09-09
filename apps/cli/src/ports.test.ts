import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { KleeError } from '@klee/core';

import { freePort, isFree, parsePortOption, resolvePort } from './ports.js';

/**
 * Deux projets Klee ouverts en parallèle est le cas ordinaire, pas le cas limite : ces tests
 * décrivent ce que klee fait d'un port déjà pris.
 */

let occupied: Server | undefined;

afterEach(async () => {
  const server = occupied;
  occupied = undefined;
  if (server !== undefined) {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }
});

async function occupy(): Promise<number> {
  const port = await freePort();
  occupied = createServer();
  await new Promise<void>((resolve) => {
    occupied?.listen(port, '127.0.0.1', resolve);
  });
  return port;
}

describe('resolvePort', () => {
  it('garde le port par défaut quand il est libre', async () => {
    const port = await freePort();
    await expect(resolvePort(undefined, port, 'board')).resolves.toEqual({ port, moved: false });
  });

  /**
   * Le danger n'a jamais été de changer de port : c'est de changer sans le dire, et de
   * laisser croire qu'on regarde son propre projet. `moved` est ce qui permet de le dire.
   */
  it('cède un port par défaut occupé, et le signale', async () => {
    const taken = await occupy();
    const resolved = await resolvePort(undefined, taken, 'board');

    expect(resolved.moved).toBe(true);
    expect(resolved.port).not.toBe(taken);
    await expect(isFree(resolved.port)).resolves.toBe(true);
  });

  it('honore un port demandé explicitement quand il est libre', async () => {
    const port = await freePort();
    await expect(resolvePort(port, 9999, 'board')).resolves.toEqual({ port, moved: false });
  });

  // Quelqu'un qui nomme un port a une raison ; le déplacer en douce trahirait cette raison.
  it('refuse un port demandé explicitement mais occupé, sans en choisir un autre', async () => {
    const taken = await occupy();
    await expect(resolvePort(taken, 4321, 'board')).rejects.toBeInstanceOf(KleeError);
  });
});

describe('parsePortOption', () => {
  it('rend undefined quand aucun port n’est demandé', () => {
    expect(parsePortOption(undefined)).toBeUndefined();
  });

  it('lit un port valide', () => {
    expect(parsePortOption('4321')).toBe(4321);
  });

  it('refuse ce qui n’est pas un port, plutôt que de retomber sur un défaut', () => {
    for (const value of ['abc', '0', '-1', '70000', '']) {
      expect(() => parsePortOption(value)).toThrow(KleeError);
    }
  });
});
