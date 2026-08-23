# AXM Living City Simulator Branch

Status: `EXPERIMENTAL`

This repository is the standalone AXM Living City simulation branch. It is a
sibling of the Workshop, Mirror, and the AXM Factual Star Adventure Simulator.
The Workshop does not own its runtime, state, rules, history, or release path.

## Runtime boundary

The authoritative simulation is the deterministic module sequence from
`src/core.js` through `src/presence.js`. Those modules can run under Node
without a DOM. The branch-owned runtime under `runtime/` makes that capability
explicit and adds new-file-only filesystem saves.

The existing HTML application remains a useful local client, but it is not the
simulation boundary. Browser `localStorage` is one persistence adapter, not the
canonical owner of state. Portable serialized worlds remain the interchange
format.

## Current surfaces

- `node runtime/cli.js new --seed AXM-LIVING-CITY-001 --out headless-saves/day-1.json`
- `node runtime/cli.js inspect --in headless-saves/day-1.json`
- `node runtime/cli.js step --in headless-saves/day-1.json --minutes 60 --out headless-saves/hour-1.json`
- `node runtime/cli.js observe --in headless-saves/hour-1.json --days 7 --out headless-saves/week-1.json`
- `index.html` or the standalone HTML for the optional browser client

Save commands refuse to overwrite an existing file. This preserves explicit
state ancestry instead of silently replacing a prior checkpoint.

## Honest limits

- The headless runtime is local and single-process; it is not yet a persistent
  service, multiplayer authority, or distributed simulation host.
- The existing browser client still uses browser-local autosave when launched
  directly.
- Native desktop rendering and non-browser graphical clients are not included.
- Runtime usefulness and browser behavior require their own verification; a
  static intake or Node test is not `CANON` authority.
