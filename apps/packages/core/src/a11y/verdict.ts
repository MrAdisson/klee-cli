import type { MockupFile } from '../graph/mockups.js';
import type { MockupStatus } from '../graph/schema.js';

/**
 * Verdict d'accessibilité (ADR 0018, DESIGN.md §6).
 *
 * Ce module ne connaît ni navigateur ni axe-core : il reçoit des violations déjà constatées
 * et décide ce qu'elles valent. C'est ce qui rend la règle testable sans télécharger un
 * navigateur, et ce qui permettra d'en changer sans réécrire la décision.
 */

/** Statuts par lesquels une maquette affirme être prête — donc tenue à l'exigence. */
const GATED_STATUSES: readonly MockupStatus[] = ['validated', 'implemented'];

export function isGated(status: MockupStatus): boolean {
  return GATED_STATUSES.includes(status);
}

/** Une violation constatée sur le rendu d'une maquette, normalisée depuis le moteur. */
export interface A11yViolation {
  readonly mockupId: string;
  /** Identifiant de règle axe-core, ex. `color-contrast`. */
  readonly rule: string;
  readonly help: string;
  readonly impact: string | null;
  /** Sélecteur de l'élément fautif. */
  readonly target: string;
}

export type A11ySeverity = 'error' | 'warning';

export interface A11yFinding extends A11yViolation {
  readonly path: string;
  readonly status: MockupStatus;
  readonly severity: A11ySeverity;
}

export interface AppliedExemption {
  readonly mockupId: string;
  readonly rule: string;
  readonly reason: string;
  /** `false` quand la règle écartée n'était pas enfreinte : la dérogation ne sert plus. */
  readonly used: boolean;
}

export interface InvalidExemption {
  readonly mockupId: string;
  readonly path: string;
  readonly rule: string;
  readonly severity: A11ySeverity;
}

export interface A11yReport {
  readonly findings: readonly A11yFinding[];
  readonly exemptions: readonly AppliedExemption[];
  readonly invalidExemptions: readonly InvalidExemption[];
  /** Nombre de maquettes tenues à l'exigence, pour distinguer « tout va bien » de « rien à voir ». */
  readonly gatedCount: number;
  readonly failed: boolean;
}

export interface JudgeA11yInput {
  readonly mockups: readonly MockupFile[];
  readonly violations: readonly A11yViolation[];
}

export function judgeA11y({ mockups, violations }: JudgeA11yInput): A11yReport {
  const findings: A11yFinding[] = [];
  const exemptions: AppliedExemption[] = [];
  const invalidExemptions: InvalidExemption[] = [];
  let gatedCount = 0;

  for (const mockup of mockups) {
    const { status } = mockup.meta;
    const gated = isGated(status);
    if (gated) gatedCount += 1;

    const severity: A11ySeverity = gated ? 'error' : 'warning';
    const own = violations.filter((violation) => violation.mockupId === mockup.meta.id);
    const excused = new Map<string, string>();

    for (const exemption of mockup.meta.a11y_exemptions) {
      const reason = exemption.reason?.trim() ?? '';
      // Une exemption muette est fautive par elle-même, violation ou non : elle prétend
      // couvrir une règle sans transmettre la décision qui la justifie (ADR 0018).
      if (reason.length === 0) {
        invalidExemptions.push({
          mockupId: mockup.meta.id,
          path: mockup.path,
          rule: exemption.rule,
          severity,
        });
        continue;
      }
      excused.set(exemption.rule, reason);
    }

    for (const [rule, reason] of excused) {
      exemptions.push({
        mockupId: mockup.meta.id,
        rule,
        reason,
        used: own.some((violation) => violation.rule === rule),
      });
    }

    for (const violation of own) {
      if (excused.has(violation.rule)) continue;
      findings.push({ ...violation, path: mockup.path, status, severity });
    }
  }

  const failed =
    findings.some((finding) => finding.severity === 'error') ||
    invalidExemptions.some((exemption) => exemption.severity === 'error');

  return { findings, exemptions, invalidExemptions, gatedCount, failed };
}
