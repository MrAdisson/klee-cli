import { textContents } from './format.js';

/**
 * Chaque dossier principal possède son `AGENTS.md` local, qui déclare explicitement le
 * périmètre d'édition autorisé pour ce dossier (TECHNICAL.md §10). Passer par un
 * générateur commun garantit que ces fichiers ont tous la même structure : un agent qui
 * arrive dans un dossier inconnu sait toujours où lire ce qu'il a le droit de faire.
 */
export interface AgentsDocInput {
  readonly title: string;
  readonly role: string;
  readonly conventions: readonly string[];
  readonly allowed: readonly string[];
  readonly forbidden: readonly string[];
  readonly references: readonly string[];
}

export function agentsDoc(input: AgentsDocInput): string {
  const bullets = (items: readonly string[]): string =>
    items.length === 0 ? '- _(rien de spécifique)_' : items.map((item) => `- ${item}`).join('\n');

  return textContents(`# AGENTS.md — ${input.title}

> ${input.role}

## Conventions

${bullets(input.conventions)}

## Périmètre d'édition pour un agent

**Autorisé**

${bullets(input.allowed)}

**Interdit**

${bullets(input.forbidden)}

Les secrets ne vivent jamais ici : uniquement dans un mécanisme de secrets dédié, hors du
champ de lecture par défaut d'un agent.

## Références

${bullets(input.references)}
`);
}
