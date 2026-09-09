import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Version lue dans le package.json plutôt que recopiée dans le code : une version en dur
 * finit toujours par mentir après une release.
 */
export function readCliVersion(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'),
  );

  if (
    typeof manifest === 'object' &&
    manifest !== null &&
    'version' in manifest &&
    typeof (manifest as { version: unknown }).version === 'string'
  ) {
    return (manifest as { version: string }).version;
  }
  return '0.0.0';
}
