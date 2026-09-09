import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProgram } from '../program.js';
import { runCli } from '../run.js';
import { completionCandidates } from './candidates.js';
import { detectShell, installCompletion, resolveInstallTarget } from './install.js';
import { completionFile, completionScript } from './scripts.js';

/**
 * La complétion est lue par un shell : elle doit rendre des lignes exploitables, et surtout
 * ne jamais échouer — une tabulation qui lève une erreur abîme la ligne de commande.
 */

const complete = (...words: string[]): Promise<readonly string[]> =>
  completionCandidates(createProgram(), words);

describe('completionCandidates — arbre des commandes', () => {
  it('propose les commandes de premier niveau sur un mot vide', async () => {
    const candidates = await complete('');
    expect(candidates).toContain('ticket');
    expect(candidates).toContain('studio');
    expect(candidates).toContain('completion');
  });

  it('filtre sur le préfixe déjà tapé', async () => {
    expect(await complete('tic')).toEqual(['ticket']);
  });

  it('descend dans les sous-commandes', async () => {
    expect(await complete('ticket', '')).toEqual(['create', 'list', 'move', 'show']);
  });

  it('propose les options quand le mot commence par un tiret', async () => {
    const candidates = await complete('ticket', 'list', '--');
    expect(candidates).toContain('--status');
    expect(candidates).toContain('--json');
  });

  it('complète la valeur attendue par une option, et rien d’autre', async () => {
    expect(await complete('ticket', 'list', '--status', '')).toEqual([
      'backlog',
      'ready-for-dev',
      'in-progress',
      'in-review',
      'done',
    ]);
  });

  it('mêle la sous-commande et les shells sous `klee completion`', async () => {
    expect(await complete('completion', '')).toEqual(['install', 'bash', 'zsh', 'fish']);
    expect(await complete('completion', 'install', '')).toEqual(['bash', 'zsh', 'fish']);
  });
});

describe('completionCandidates — valeurs du domaine', () => {
  let root: string;
  let previous: string;

  beforeEach(async () => {
    previous = process.cwd();
    root = await mkdtemp(join(tmpdir(), 'klee-completion-'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runCli(['node', 'klee', 'init', root, '--yes', '--name', 'demo', '--id-prefix', 'ACME']);
    process.chdir(root);
  });

  afterEach(async () => {
    process.chdir(previous);
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it('propose les identifiants réels des tickets, pas un format à deviner', async () => {
    // `init` a déjà posé son compte rendu (ADR 0017) : le ticket créé ici est le second.
    await runCli(['node', 'klee', 'ticket', 'create', 'Premier']);
    expect(await complete('ticket', 'move', '')).toEqual(['ACME-001', 'ACME-002']);
  });

  it('respecte le préfixe d’identifiants propre au projet', async () => {
    expect(await complete('ticket', 'show', 'ACME-')).toEqual(['ACME-001']);
  });

  it('propose les statuts une fois l’identifiant donné', async () => {
    expect(await complete('ticket', 'move', 'ACME-001', '')).toContain('in-review');
  });

  it('ne propose rien à `module add` quand le projet a déjà tous les modules', async () => {
    expect(await complete('module', 'add', '')).toEqual([]);
  });

  it('ne propose à `module remove` que les modules retenus', async () => {
    const candidates = await complete('module', 'remove', '');
    expect(candidates).toContain('mockups');
    expect(candidates).toContain('contracts');
  });
});

describe('completionCandidates — hors projet', () => {
  it('rend une liste vide au lieu d’échouer', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'klee-vide-'));
    const previous = process.cwd();
    process.chdir(empty);
    try {
      expect(await complete('ticket', 'move', '')).toEqual([]);
      expect(await complete('')).toContain('init');
    } finally {
      process.chdir(previous);
      await rm(empty, { recursive: true, force: true });
    }
  });
});

describe('installation', () => {
  let home: string;
  let previousHome: string | undefined;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'klee-home-'));
    previousHome = process.env['HOME'];
    process.env['HOME'] = home;
  });

  afterEach(async () => {
    if (previousHome === undefined) delete process.env['HOME'];
    else process.env['HOME'] = previousHome;
    await rm(home, { recursive: true, force: true });
  });

  it('déduit le shell de $SHELL, et rend `null` sur un shell inconnu', () => {
    expect(detectShell({ SHELL: '/bin/zsh' })).toBe('zsh');
    expect(detectShell({ SHELL: '/usr/local/bin/fish' })).toBe('fish');
    expect(detectShell({ SHELL: '/bin/tcsh' })).toBeNull();
    expect(detectShell({})).toBeNull();
  });

  it('vise l’emplacement que fish charge de lui-même', async () => {
    const target = await resolveInstallTarget('fish');
    expect(target.path).toBe(join(home, '.config/fish/completions/klee.fish'));
    expect(target.followUp).toBeNull();
  });

  it('écrit le fichier, et le shell y trouve un script exploitable', async () => {
    const result = await installCompletion('fish', false);
    expect(result.written).toBe(true);
    await expect(readFile(result.path, 'utf8')).resolves.toContain('klee __complete');
  });

  it('n’écrit rien en --dry-run tout en nommant la cible', async () => {
    const result = await installCompletion('fish', true);
    expect(result.written).toBe(false);
    await expect(readFile(result.path, 'utf8')).rejects.toThrow();
  });
});

describe('completionScript', () => {
  it('distingue le script à évaluer du fichier autoloadé par zsh', () => {
    // Le fichier de `$fpath` est autoloadé par sa marque `#compdef` ; y laisser le `compdef`
    // de la version `eval` serait une erreur au chargement.
    expect(completionFile('zsh').startsWith('#compdef klee')).toBe(true);
    expect(completionFile('zsh')).not.toContain('compdef _klee_complete');
    expect(completionScript('zsh')).toContain('compdef _klee_complete klee');
  });

  it.each(['bash', 'zsh', 'fish'] as const)('rappelle `__complete` en %s', (shell) => {
    expect(completionScript(shell)).toContain('klee __complete');
  });

  it('ne grave aucune liste de commandes dans le script', () => {
    expect(completionScript('bash')).not.toContain('ticket');
  });
});
