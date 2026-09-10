# Klee CLI

Klee is a convention-and-tooling layer that keeps tickets, mockups, docs and code in one
repository, cross-linked and checked instead of scattered across separate SaaS tools. It isn't
a replacement for Jira, Figma or Docusaurus — it's the traceability graph that's usually missing
between them, plus the scaffolding that makes that graph possible from the first commit.

Everything a project needs lives in the codebase: no structuring artifact (a mockup, a ticket, a
decision) lives only in an external tool.

## Install

```bash
npm install --global @klee-dev/cli
```

Requires Node.js 22.12 or newer. The package installs a single `klee` binary.

## Quick start

```bash
klee init my-project
cd my-project
klee studio
```

`klee init` asks a few questions (or takes `--yes` for sane defaults), scaffolds the project —
tickets, design tokens, mockups, docs, depending on what you keep — and writes a first
traceability report. `klee studio` opens a local cockpit in the browser: a kanban board for
tickets, the docs site, and the mockups, behind one address, with every `KLEE-xxx` / `MOCK-xxx`
/ `DOC-xxx` identifier clickable across all three.

## What a project looks like

- **Tickets** (`tickets/*.md`) — plain markdown, a real backlog with statuses, dependencies and
  Gherkin acceptance criteria, readable and writable without ever opening a terminal.
- **Mockups** (`mockups/*.html`) — static HTML/CSS pages built on shared design tokens, with a
  `draft → validated → implemented` lifecycle. Validation is gated on an automated WCAG 2.1 AA
  accessibility check, not just a status flag.
- **Docs** (`docs/`) — authored technical and product documentation, plus a generated
  traceability view nothing else needs to touch by hand.
- **The graph** — every ticket, mockup and doc that declares an ID can reference the others
  (`related_tickets`, `related_mockups`, `related_docs`). A link declared on one side is visible
  from the other. `klee links check` refuses any link to an artifact that doesn't exist.

## Commands

| Command           | What it does                                                          |
| ----------------- | --------------------------------------------------------------------- |
| `klee init`       | Scaffolds a new project — modules, providers, design tokens.          |
| `klee module`     | Adds, removes or lists a project's optional modules.                  |
| `klee ticket`     | Creates, lists, shows and moves tickets.                              |
| `klee board`      | A local kanban for tickets — create and move them without a terminal. |
| `klee mockups`    | Serves the mockups site locally, checks accessibility, builds it.     |
| `klee tokens`     | Builds the design tokens pipeline, switches between token starters.   |
| `klee docs`       | Generates, serves and builds the documentation site.                  |
| `klee links`      | Inspects the traceability graph, checks it, regenerates its report.   |
| `klee studio`     | One cockpit for the board, docs and mockups behind a single origin.   |
| `klee completion` | Shell completion, for any of the above.                               |

Every command takes `--help`; most support `--json` or `--dry-run` where it makes sense for
scripting or agents.

## Presets

`klee init` offers three starting points — none of them exclusive, every module stays
addable or removable later with `klee module add`/`remove`:

- **`full-product`** — every module: interface mockups, API contracts, product docs.
- **`api-service`** — a service exposing an API: contracts, no mockups.
- **`internal-lib`** — a library with neither mockups, contracts, nor product docs; markdown
  docs by default rather than a full documentation site.

Design tokens ship with eight built-in starters (color, typography, spacing, radius, shadow),
each gated on contrast and minimum readable font size — `klee init --token-starter <id>` or
`klee tokens set-starter <id>` on an already-scaffolded project.

## License

[Klee Source-Available License](./LICENSE) — free for personal, educational and internal use;
see the license file for the exact terms.

## Learn more

The full architecture, conventions and design decisions live in the
[klee-cli repository](https://github.com/MrAdisson/klee-cli).
