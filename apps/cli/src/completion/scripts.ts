import type { ShellId } from './candidates.js';

/**
 * Scripts de complétion, un par shell.
 *
 * Chacun ne fait qu'une chose : rappeler `klee __complete` avec les mots déjà tapés, le
 * dernier étant le mot en cours (souvent vide). Aucune liste de commandes n'est gravée dans
 * le script — c'est ce qui lui évite de mentir après un `klee` mis à jour, sans que
 * l'utilisateur ait à réinstaller quoi que ce soit.
 */

// `IFS` reste local à \`read\` : le poser globalement ferait fusionner les mots du contexte
// en un seul argument, et la complétion repartirait de la racine à chaque fois.
const BASH = `# klee — complétion bash
_klee_complete() {
  local line
  local -a context=( "\${COMP_WORDS[@]:1:COMP_CWORD-1}" )
  COMPREPLY=()
  while IFS= read -r line; do
    COMPREPLY+=( "$line" )
  done < <(klee __complete "\${context[@]}" "\${COMP_WORDS[COMP_CWORD]}" 2>/dev/null)
}
complete -o default -F _klee_complete klee
`;

const ZSH = `# klee — complétion zsh
_klee_complete() {
  local -a candidates context
  context=( "\${(@)words[2,$((CURRENT-1))]}" )
  candidates=( \${(f)"$(klee __complete "\${(@)context}" "\${words[CURRENT]}" 2>/dev/null)"} )
  compadd -a candidates
}
compdef _klee_complete klee
`;

const FISH = `# klee — complétion fish
function __klee_complete
    set -l tokens (commandline -opc)
    klee __complete $tokens[2..-1] (commandline -ct) 2>/dev/null
end
complete -c klee -f -a '(__klee_complete)'
`;

/**
 * Variante zsh pour un fichier posé dans `$fpath` : zsh l'autoload par la marque `#compdef`,
 * et le corps *est* la fonction. Le `compdef` explicite de la version `eval` y serait une
 * erreur — d'où deux formes du même script plutôt qu'une seule tordue pour servir les deux.
 */
const ZSH_FPATH = `#compdef klee
local -a candidates context
context=( "\${(@)words[2,$((CURRENT-1))]}" )
candidates=( \${(f)"$(klee __complete "\${(@)context}" "\${words[CURRENT]}" 2>/dev/null)"} )
compadd -a candidates
`;

const SCRIPTS: Readonly<Record<ShellId, string>> = { bash: BASH, zsh: ZSH, fish: FISH };

/** Script à charger par `eval` depuis la configuration du shell. */
export function completionScript(shell: ShellId): string {
  return SCRIPTS[shell];
}

/** Contenu du fichier déposé par `klee completion install`, que le shell charge seul. */
export function completionFile(shell: ShellId): string {
  return shell === 'zsh' ? ZSH_FPATH : SCRIPTS[shell];
}

/** Où poser le script pour qu'il survive au prochain terminal, selon le shell. */
export function installHint(shell: ShellId): string {
  switch (shell) {
    case 'bash':
      return 'eval "$(klee completion bash)" dans ~/.bashrc';
    case 'zsh':
      return 'eval "$(klee completion zsh)" dans ~/.zshrc, après compinit';
    case 'fish':
      return 'klee completion fish > ~/.config/fish/completions/klee.fish';
  }
}
