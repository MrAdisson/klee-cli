/**
 * Rend les erreurs de validation lisibles en terminal : `modules.mockups : attendu un booléen`.
 * Typé structurellement plutôt que sur les types internes de Zod, pour ne pas coupler la
 * présentation des erreurs à une version de la librairie de validation.
 */
export interface ValidationIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

export function formatIssues(issues: readonly ValidationIssue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.map(String).join('.');
      return `  - ${path === '' ? '(racine)' : path} : ${issue.message}`;
    })
    .join('\n');
}
