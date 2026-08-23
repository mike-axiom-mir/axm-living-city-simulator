# Steward Report — LC-V120 Object-Use Affordances

Date: 2026-08-23

Status: **REVIEW / NOT CANON**

Base: `codex/living-city-simulator-intake-v0.11.3`

Review branch: `steward/lc-v120-object-use-affordances`

## Why this pass exists

The v0.11.3 package already has truthful completed-action feedback and playable room browsing. The existing next-build queue identifies the first v0.12.0 step as mapping persistent objects to bounded actions and valid room/use positions before adding authoritative in-progress scene state.

This pass implements that first seam without rewriting the world schema, executing new gameplay, granting new authority, or turning visual observation into a reward channel.

## Added

- `src/object_use.js`
  - separate deterministic affordance projection: `axm.living-city.object-use-affordances/v0.12.0-draft`
  - maps existing persistent furniture to existing activities
  - derives object footprint cells and deterministic adjacent approach cells from the room graph
  - exposes bathroom shower use from existing water + waste utility state without inventing a fixture
  - keeps whole-room cleaning as a room-zone context rather than fabricating an object
  - carries object identity, ownership mode, condition, usage, room, habitat revision, and evidence
  - reports permission hints but deliberately does **not** resolve or grant permission
  - declares `noExecutionAuthority: true` and `noReward: true`
- `tests/object_use_affordances_test.js`
  - real bed -> grounded sleep affordance
  - bathroom utility -> shower without invented object
  - deterministic and read-only projection
  - other-owned personal object -> permission required hint
  - object/use cells stay inside the authoritative room graph
  - unknown room -> no projection
- browser load order now includes `src/object_use.js`
- standalone build recipe now includes `src/object_use.js`
- `npm test` now includes the focused affordance test, plus `npm run test:object-use`

## Intentionally not done

- no active scene state yet
- no action interception or execution through the new projection
- no autonomous resident object-use yet
- no final permission resolver yet
- no interruption model yet
- no visible/compressed scene parity yet
- no new animation driven by this projection yet
- no world-schema migration
- no update to sealed intake receipts/checksums
- no generated standalone artifact regeneration in this chat runtime
- no release, promotion, merge, or CANON decision

These remain later merge-gated stages rather than being silently collapsed into this first pass.

## Verification truth

The source and tests were written on the review branch, but this chat runtime did not have a checked-out repository runner. Therefore the required commands are **NOT CLAIMED AS RUN** here.

Before merge, run from a checkout of this review branch:

```text
node tests/headless_runtime_intake_test.js
npm run test:object-use
npm test
node tools/verify_local_intake.js
python3 tools/build_standalone.py
```

The existing intake checksum receipt describes the sealed v0.11.3 source package. This review branch intentionally changes source, so do not rewrite old sealed evidence to make it appear unchanged. Record fresh review/build evidence separately after the commands actually run.

Browser render/click verification remains a separate check and must not be inferred from Node tests.

## Steward assessment

This is a bounded Stage-1 implementation of `LC-V120-LIVED-ROOMS`: it makes object-use spatially grounded and inspectable while preserving the existing one-life, autonomy, privacy, deterministic replay, no-hidden-reward, no-object-loss, and review-before-canon direction.
