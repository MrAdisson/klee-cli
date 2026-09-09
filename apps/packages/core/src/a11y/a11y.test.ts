import { describe, expect, it } from 'vitest';

import type { MockupFile } from '../graph/mockups.js';
import type { A11yExemption, MockupStatus } from '../graph/schema.js';
import { judgeA11y, type A11yViolation } from './verdict.js';

/** Les scénarios de KLEE-008, sans navigateur : le verdict ne dépend que de ce qu'on lui donne. */

function mockup(
  id: string,
  status: MockupStatus,
  exemptions: readonly A11yExemption[] = [],
): MockupFile {
  return {
    path: `mockups/pages/${id.toLowerCase()}.meta.yml`,
    document: `mockups/pages/${id.toLowerCase()}.html`,
    title: id,
    meta: {
      id,
      status,
      related_tickets: [],
      related_docs: [],
      a11y_exemptions: [...exemptions],
    } as MockupFile['meta'],
  };
}

function violation(mockupId: string, rule: string): A11yViolation {
  return {
    mockupId,
    rule,
    help: `${rule} doit être respectée`,
    impact: 'serious',
    target: 'button.primary',
  };
}

describe('judgeA11y — ce que le statut engage', () => {
  it('fait échouer une maquette validée, en nommant la règle et l’élément', () => {
    const report = judgeA11y({
      mockups: [mockup('MOCK-001', 'validated')],
      violations: [violation('MOCK-001', 'color-contrast')],
    });

    expect(report.failed).toBe(true);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      rule: 'color-contrast',
      target: 'button.primary',
      path: 'mockups/pages/mock-001.meta.yml',
      severity: 'error',
    });
  });

  it('laisse un brouillon libre : la violation est un avertissement', () => {
    const report = judgeA11y({
      mockups: [mockup('MOCK-002', 'draft')],
      violations: [violation('MOCK-002', 'color-contrast')],
    });

    expect(report.failed).toBe(false);
    expect(report.findings[0]?.severity).toBe('warning');
    expect(report.gatedCount).toBe(0);
  });

  it('tient une maquette implémentée à la même exigence qu’une maquette validée', () => {
    const report = judgeA11y({
      mockups: [mockup('MOCK-003', 'implemented')],
      violations: [violation('MOCK-003', 'image-alt')],
    });

    expect(report.failed).toBe(true);
    expect(report.gatedCount).toBe(1);
  });

  it('ne signale rien quand les maquettes tenues sont conformes', () => {
    const report = judgeA11y({
      mockups: [mockup('MOCK-004', 'validated')],
      violations: [],
    });

    expect(report.failed).toBe(false);
    expect(report.findings).toEqual([]);
    expect(report.gatedCount).toBe(1);
  });
});

describe('judgeA11y — dérogations', () => {
  const excused = [{ rule: 'color-contrast', reason: 'Charte partenaire imposée.' }];

  it('laisse passer une exemption motivée, et la garde visible', () => {
    const report = judgeA11y({
      mockups: [mockup('MOCK-005', 'validated', excused)],
      violations: [violation('MOCK-005', 'color-contrast')],
    });

    expect(report.failed).toBe(false);
    expect(report.findings).toEqual([]);
    expect(report.exemptions).toEqual([
      {
        mockupId: 'MOCK-005',
        rule: 'color-contrast',
        reason: 'Charte partenaire imposée.',
        used: true,
      },
    ]);
  });

  it('refuse une exemption muette, sans la confondre avec la règle qu’elle écarte', () => {
    const report = judgeA11y({
      mockups: [mockup('MOCK-006', 'validated', [{ rule: 'color-contrast' }])],
      violations: [],
    });

    expect(report.failed).toBe(true);
    expect(report.findings).toEqual([]);
    expect(report.invalidExemptions).toEqual([
      {
        mockupId: 'MOCK-006',
        path: 'mockups/pages/mock-006.meta.yml',
        rule: 'color-contrast',
        severity: 'error',
      },
    ]);
  });

  it('traite une raison vide comme une raison absente', () => {
    const report = judgeA11y({
      mockups: [mockup('MOCK-007', 'validated', [{ rule: 'image-alt', reason: '   ' }])],
      violations: [],
    });

    expect(report.invalidExemptions).toHaveLength(1);
  });

  it('ne couvre que la règle nommée', () => {
    const report = judgeA11y({
      mockups: [mockup('MOCK-008', 'validated', excused)],
      violations: [violation('MOCK-008', 'color-contrast'), violation('MOCK-008', 'image-alt')],
    });

    expect(report.failed).toBe(true);
    expect(report.findings.map((finding) => finding.rule)).toEqual(['image-alt']);
  });

  it('marque une dérogation devenue inutile plutôt que de la taire', () => {
    const report = judgeA11y({
      mockups: [mockup('MOCK-009', 'validated', excused)],
      violations: [],
    });

    expect(report.failed).toBe(false);
    expect(report.exemptions[0]?.used).toBe(false);
  });

  it('ne fait pas échouer une exemption muette sur un brouillon', () => {
    const report = judgeA11y({
      mockups: [mockup('MOCK-010', 'draft', [{ rule: 'color-contrast' }])],
      violations: [],
    });

    expect(report.failed).toBe(false);
    expect(report.invalidExemptions[0]?.severity).toBe('warning');
  });
});

describe('judgeA11y — rapport d’ensemble', () => {
  it('liste les deux maquettes, mais une seule motive l’échec', () => {
    const report = judgeA11y({
      mockups: [mockup('MOCK-011', 'validated'), mockup('MOCK-012', 'draft')],
      violations: [violation('MOCK-011', 'color-contrast'), violation('MOCK-012', 'image-alt')],
    });

    expect(report.failed).toBe(true);
    expect(report.findings).toHaveLength(2);
    expect(report.findings.filter((finding) => finding.severity === 'error')).toHaveLength(1);
  });
});
