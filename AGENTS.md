# Builder instructions

This repository is the standalone branch for the AXM Living City Simulator.

## Preserve the simulator boundary

- Keep authoritative simulation rules and serialized world state independent
  from every UI, renderer, storage adapter, and host application.
- Treat the browser application as an optional client. Browser APIs,
  `localStorage`, DOM state, and canvas pixels may not become the only way to
  run, save, inspect, or verify the simulation.
- Keep the headless Node runtime dependency-free and capable of loading the
  authoritative modules without `window`, `document`, or browser storage.
- Preserve deterministic replay, scoped authority, privacy boundaries,
  migration honesty, and diagnostic-only validation.
- Do not rewrite sealed source history, generated examples, prior test
  evidence, or package checksums as a substitute for changing source.
- Keep normal local operation free of mandatory Workshop, Mirror, cloud,
  account, model, API, analytics, or network dependencies.
- Declare missing verification capability; never manufacture a passing
  receipt.

## Repository boundary

This simulator is a sibling of the Workshop, Mirror, and the AXM Factual Star
Adventure Simulator. It is not a Workshop world, plugin, or Foundation organ.
Any future bridge must be optional, reviewed, and non-authoritative.

## Required verification

After an intentional source or runtime change:

1. Run `node tests/headless_runtime_intake_test.js`.
2. Run `npm test`.
3. Re-run the source checksum verifier recorded in `.axm-intake/INTAKE_RECEIPT.json`.
4. Treat browser render/click verification as a separate check; never infer it
   from Node tests.

Work on a review branch. Do not push directly to `main`, promote, release, or
label anything `CANON` without Mike Tobi's explicit merge decision.
