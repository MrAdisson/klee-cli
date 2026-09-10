import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  KleeError,
  MODULES,
  buildTokens,
  jsonContents,
  resolveTokenStarter,
  writeProjectConfig,
} from '@klee/core';

import { field, heading, info, success, write } from '../ui/output.js';
import { askOverwriteTokens } from '../ui/prompts.js';
import { loadProject } from '../project.js';
import { runProjectScript } from './project-script.js';

export interface TokensSetStarterOptions {
  readonly yes?: boolean;
  readonly dryRun?: boolean;
}

const TOKENS_PATH = 'design-system/tokens.json';

/**
 * `klee tokens set-starter <id>` — change de starter sur un projet déjà scaffoldé, sans
 * repasser par tout le plan d'init (ADR 0023).
 *
 * `design-system/tokens.json` est un fichier que `design-system/AGENTS.md` autorise à
 * éditer à la main : l'écraser sans demander casserait exactement ce que ADR 0013 protège
 * ailleurs dans le scaffolding. D'où la confirmation, jamais contournée sauf `--yes`
 * explicite — cohérent avec le reste de la CLI (`init`, qui refuse aussi le silence en
 * mode interactif).
 */
export async function runTokensSetStarter(
  starterId: string,
  options: TokensSetStarterOptions,
): Promise<void> {
  const { root, config } = await loadProject();

  if (!config.modules.mockups || config.designSystem === undefined) {
    throw new KleeError(`Le module « ${MODULES.mockups.label} » n'est pas retenu dans ce projet.`, {
      code: 'MODULE_ABSENT',
      hint: 'Ajoutez-le avec `klee module add mockups`.',
    });
  }

  // Résolution stricte tout de suite : mieux vaut échouer avant de demander une
  // confirmation pour rien.
  const starter = resolveTokenStarter(starterId);

  heading('klee tokens set-starter');
  field('Actuel', config.designSystem.tokenStarter);
  field('Demandé', `${starter.id} — ${starter.label}`);
  write();

  if (config.designSystem.tokenStarter === starter.id) {
    info('Déjà sur ce starter — rien à faire.');
    return;
  }

  if (options.dryRun === true) {
    info(
      `${TOKENS_PATH} serait remplacé, ainsi que designSystem.tokenStarter dans project.config.json.`,
    );
    return;
  }

  if (options.yes !== true) {
    if (process.stdin.isTTY !== true) {
      throw new KleeError('Confirmation requise avant d’écraser des tokens existants.', {
        code: 'NOT_A_TTY',
        hint: 'Ajoutez --yes pour un usage scriptable.',
      });
    }
    const confirmed = await askOverwriteTokens(starter.id);
    if (!confirmed) {
      info('Annulé — rien n’a été modifié.');
      return;
    }
  }

  await writeFile(join(root, TOKENS_PATH), jsonContents(buildTokens(starter.id)), 'utf8');
  await writeProjectConfig(root, {
    ...config,
    designSystem: { ...config.designSystem, tokenStarter: starter.id },
  });

  success(`${TOKENS_PATH} remplacé par le starter "${starter.id}".`);
  write();

  await runProjectScript({
    directory: 'design-system',
    script: 'build',
    requiresModule: 'mockups',
  });
}
