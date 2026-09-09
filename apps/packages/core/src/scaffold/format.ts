/** Helpers de rendu partagés par tous les générateurs. */

/** JSON indenté 2 espaces avec newline finale — cohérent avec .editorconfig et Prettier. */
export function jsonContents(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Garantit exactement une newline finale (les templates littéraux en oublient souvent). */
export function textContents(value: string): string {
  return `${value.replace(/\s+$/, '')}\n`;
}
