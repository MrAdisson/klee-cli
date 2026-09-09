/**
 * Socle de tokens au format W3C DTCG (DESIGN.md §2).
 *
 * Deux règles gouvernent ce fichier :
 *
 * - **Sémantique avant tout.** `color.text.primary`, jamais `color.gray.900` : changer une
 *   valeur ne doit pas casser la signification. Un token qui décrit sa valeur plutôt que son
 *   rôle oblige à modifier tous ses usages le jour où la marque change.
 * - **Couverture minimale de la phase 1** : couleurs sémantiques, typographie (famille,
 *   échelle, poids), espacement sur une base de 4, rayons et ombres.
 *
 * Les valeurs de couleur retenues respectent WCAG 2.1 AA sur leurs paires d'usage prévues
 * (texte sur surface, texte inverse sur primaire) — l'accessibilité se valide au stade
 * maquette, pas après implémentation (DESIGN.md §6).
 */

/** Un token DTCG : `$value` obligatoire, `$type` héritable du groupe, `$description` attendue. */
type TokenDocument = Record<string, unknown>;

function px(value: number): { value: number; unit: string } {
  return { value, unit: 'px' };
}

export const DEFAULT_TOKENS: TokenDocument = {
  color: {
    $type: 'color',
    text: {
      primary: { $value: '#111827', $description: 'Texte principal sur une surface claire.' },
      muted: { $value: '#4b5563', $description: 'Texte secondaire : métadonnées, aides.' },
      inverse: { $value: '#ffffff', $description: 'Texte posé sur un fond plein et saturé.' },
    },
    surface: {
      page: { $value: '#f9fafb', $description: 'Fond de page.' },
      raised: { $value: '#ffffff', $description: 'Surface en avant : carte, panneau, champ.' },
      sunken: {
        $value: '#f3f4f6',
        $description: 'Surface en retrait : zone désactivée, fond de section.',
      },
    },
    border: {
      default: { $value: '#d1d5db', $description: 'Bordure neutre.' },
      strong: { $value: '#9ca3af', $description: 'Bordure appuyée : survol, élément actif.' },
      focus: { $value: '#2563eb', $description: 'Anneau de focus clavier — jamais supprimé.' },
    },
    primary: {
      default: { $value: '#2563eb', $description: 'Action principale.' },
      hover: { $value: '#1d4ed8', $description: 'Action principale survolée.' },
      active: { $value: '#1e40af', $description: 'Action principale enfoncée.' },
      disabled: { $value: '#93b4f8', $description: 'Action principale indisponible.' },
    },
    danger: {
      default: { $value: '#b91c1c', $description: 'Erreur, action destructrice.' },
      surface: { $value: '#fef2f2', $description: 'Fond de message d’erreur.' },
    },
    success: {
      default: { $value: '#15803d', $description: 'Confirmation, état valide.' },
      surface: { $value: '#f0fdf4', $description: 'Fond de message de succès.' },
    },
  },
  font: {
    family: {
      $type: 'fontFamily',
      sans: {
        $value: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        $description: 'Famille d’interface par défaut.',
      },
      mono: {
        $value: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        $description: 'Code, identifiants, valeurs techniques.',
      },
    },
    size: {
      $type: 'dimension',
      sm: { $value: px(13), $description: 'Métadonnée, légende.' },
      md: { $value: px(15), $description: 'Texte courant.' },
      lg: { $value: px(19), $description: 'Sous-titre.' },
      xl: { $value: px(25), $description: 'Titre de page.' },
    },
    weight: {
      $type: 'fontWeight',
      regular: { $value: 400, $description: 'Texte courant.' },
      medium: { $value: 500, $description: 'Libellé, accentuation légère.' },
      bold: { $value: 700, $description: 'Titre.' },
    },
  },
  space: {
    $type: 'dimension',
    $description: 'Échelle d’espacement en base 4.',
    xs: { $value: px(4) },
    sm: { $value: px(8) },
    md: { $value: px(16) },
    lg: { $value: px(24) },
    xl: { $value: px(40) },
  },
  radius: {
    $type: 'dimension',
    sm: { $value: px(4), $description: 'Champ, bouton.' },
    md: { $value: px(8), $description: 'Carte, panneau.' },
    full: { $value: px(9999), $description: 'Pastille, avatar.' },
  },
  shadow: {
    $type: 'shadow',
    sm: {
      $value: { color: '#0f172a1a', offsetX: px(0), offsetY: px(1), blur: px(2), spread: px(0) },
      $description: 'Élévation discrète : bouton, champ.',
    },
    md: {
      $value: { color: '#0f172a26', offsetX: px(0), offsetY: px(4), blur: px(12), spread: px(0) },
      $description: 'Élévation marquée : carte, popover.',
    },
  },
};
