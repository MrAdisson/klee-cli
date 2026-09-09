import { spawn } from 'node:child_process';

/**
 * Ouverture du navigateur sur une URL locale.
 *
 * C'est la commande lancée par l'utilisateur qui décide d'ouvrir une fenêtre, jamais un
 * serveur qu'elle a démarré en arrière-plan. Sans cette règle, `klee studio` ouvrait la
 * **documentation** — parce que Docusaurus ouvre un navigateur au démarrage — au lieu du
 * cockpit qu'on venait de demander.
 */

/** Aucune erreur ne remonte : ne pas ouvrir de fenêtre n'a jamais empêché de servir. */
export function openInBrowser(url: string): void {
  const [command, ...args] =
    process.platform === 'darwin'
      ? ['open', url]
      : process.platform === 'win32'
        ? ['cmd', '/c', 'start', '', url]
        : ['xdg-open', url];

  if (command === undefined) return;

  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {
      // Pas de navigateur, pas d'environnement graphique, commande absente : l'URL est
      // affichée dans le terminal de toute façon.
    });
    child.unref();
  } catch {
    // Idem : l'ouverture est un confort, pas une étape du démarrage.
  }
}
