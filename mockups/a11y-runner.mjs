// Généré par klee (ADR 0018) — audite les maquettes servies et rend ses constats en JSON.
// Entrée  (stdin)  : { "pages": [{ "id": "MOCK-001", "url": "http://…" }] }
// Sortie (stdout)  : { "violations": [{ "mockupId", "rule", "help", "impact", "target" }] }
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

// WCAG 2.1 AA, le niveau qu'exige DESIGN.md §6 — ni plus strict, ni plus laxiste.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function readInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return JSON.parse(raw);
}

const { pages } = await readInput();
const browser = await chromium.launch();
// Contexte explicite : axe-core injecte son script dans les frames de la page, ce que
// Playwright refuse sur le contexte implicite de `browser.newPage()`.
const context = await browser.newContext();
const violations = [];

try {
  for (const entry of pages) {
    const page = await context.newPage();
    try {
      // Le contraste se juge sur des styles calculés : la page doit être vraiment chargée.
      await page.goto(entry.url, { waitUntil: 'load' });
      const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      for (const violation of result.violations) {
        for (const node of violation.nodes) {
          violations.push({
            mockupId: entry.id,
            rule: violation.id,
            help: violation.help,
            impact: violation.impact ?? null,
            target: node.target.join(' '),
          });
        }
      }
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

process.stdout.write(JSON.stringify({ violations }));
