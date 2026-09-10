# @klee-dev/cli

## 0.2.2

### Patch Changes

- 406275c: Rewrite the npm README: what Klee actually does today (tickets, mockups with an accessibility gate, docs, the traceability graph, the `klee studio` cockpit), the real command list, presets, and token starters — instead of a three-line install note.

## 0.2.1

### Patch Changes

- 071a0b8: Give ticket creation its own page on the board (`/tickets/new`) instead of a permanent block under the kanban, and regenerate `docs/_generated/tracabilite.md` automatically whenever a ticket or mockup status changes through the board.

## 0.2.0

### Minor Changes

- e707b8a: Add token starters for klee init (8 built-in color/typography/spacing/radius/shadow combinations, chosen interactively or via --token-starter), a klee tokens set-starter command to switch starters on an existing project, and klee links report --check for CI.
