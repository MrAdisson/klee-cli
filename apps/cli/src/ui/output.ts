import type { AppliedFile, ApplyScaffoldResult, Ticket } from '@klee/core';
import pc from 'picocolors';

/**
 * Sortie terminal. Tout ce qui écrit sur stdout passe par ici : le reste de la CLI
 * retourne des données, ce qui le rend testable sans capturer la console.
 */

export function write(line = ''): void {
  console.log(line);
}

export function heading(text: string): void {
  write();
  write(pc.bold(text));
}

export function field(label: string, value: string): void {
  write(`  ${pc.dim(label.padEnd(12))}${value}`);
}

export function info(text: string): void {
  write(`  ${pc.dim(text)}`);
}

export function success(text: string): void {
  write(`  ${pc.green('✔')} ${text}`);
}

export function warn(text: string): void {
  write(`  ${pc.yellow('!')} ${text}`);
}

const OUTCOME_MARKS = {
  created: pc.green('+'),
  overwritten: pc.yellow('~'),
  unchanged: pc.dim('='),
  conflict: pc.red('!'),
} as const;

export function fileLine(file: AppliedFile): void {
  const mark = OUTCOME_MARKS[file.outcome];
  const suffix = file.outcome === 'unchanged' ? pc.dim(' (inchangé)') : '';
  write(`  ${mark} ${file.path}${suffix}`);
}

export function reportApply(result: ApplyScaffoldResult): void {
  for (const file of result.files) {
    fileLine(file);
  }

  const created = result.files.filter((file) => file.outcome === 'created').length;
  const overwritten = result.files.filter((file) => file.outcome === 'overwritten').length;
  const unchanged = result.files.filter((file) => file.outcome === 'unchanged').length;

  write();
  const parts = [`${String(created)} créé(s)`];
  if (overwritten > 0) parts.push(`${String(overwritten)} écrasé(s)`);
  if (unchanged > 0) parts.push(`${String(unchanged)} inchangé(s)`);

  if (result.dryRun) {
    write(`  ${pc.cyan('dry-run')} ${parts.join(', ')} — rien n'a été écrit.`);
  } else {
    success(`${parts.join(', ')} dans ${result.root}`);
  }
}

export function reportError(message: string, hint?: string): void {
  console.error();
  console.error(`  ${pc.red('✖')} ${message}`);
  if (hint !== undefined) {
    console.error(`    ${pc.dim(hint)}`);
  }
  console.error();
}

export function ticketRow(ticket: Ticket): void {
  const id = pc.cyan(ticket.id.padEnd(10));
  const assignee = ticket.assignee === null ? '' : pc.dim(` @${ticket.assignee}`);
  const blocked = ticket.depends_on.length > 0 ? pc.dim(` ⟵ ${ticket.depends_on.join(', ')}`) : '';
  write(`    ${id} ${ticket.title}${assignee}${blocked}`);
}
