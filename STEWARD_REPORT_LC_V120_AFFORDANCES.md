# Steward Report — LC-V120 Object-Use Affordances

Date: 2026-08-23

Status: **REVIEW / NOT CANON**

Base: `codex/living-city-simulator-intake-v0.11.3`

Review branch: `steward/lc-v120-object-use-affordances`

## Why this pass exists

The v0.11.3 package already has truthful completed-action feedback and playable room browsing. The existing next-build queue identifies the first v0.12.0 step as mapping persistent objects to bounded actions and valid room/use positions before adding authoritative in-progress scene state.

This steward branch implements and hardens that first seam without rewriting the world schema, executing new gameplay, granting new authority, or turning visual observation into a reward channel.

## Added — grounding layer

- `src/object_use.js`
  - separate deterministic affordance projection: `axm.living-city.object-use-affordances/v0.12.0-draft`
  - maps existing persistent furniture to existing activities
  - derives object footprint cells and deterministic adjacent approach cells from the room graph
  - exposes bathroom shower use from existing water + waste utility state without inventing a fixture
  - keeps whole-room cleaning as a room-zone context rather than fabricating an object
  - carries object identity, ownership mode, condition, usage, room, habitat revision, and evidence
  - reports object permission hints but deliberately does **not** resolve or grant permission
  - declares `noExecutionAuthority: true` and `noReward: true`
- `tests/object_use_affordances_test.js`
  - real bed -> grounded sleep affordance
  - bathroom utility -> shower without invented object
  - deterministic and read-only projection
  - other-owned personal object -> permission required hint
  - object/use cells stay inside the authoritative room graph
  - unknown room -> no projection

## Added — steward hardening layer

- `src/object_use_audit.js`
  - separate read-only audit projection: `axm.living-city.object-use-audit/v0.12.0-draft`
  - rechecks candidate object-use positions against the structural reachability graph
  - filters conceptual object use into spatially grounded affordances versus blocked candidates
  - distinguishes exact persistent-object positioning from coarser reachable room-zone utility positioning
  - room-level utilities use reachable room evidence without fabricating an exact free standing cell
  - reads existing room permission snapshots as evidence without refreshing, rewriting, or treating them as final authority
  - keeps object permission hints and room-permission evidence separate
  - marks permission resolution as deferred and explicitly grants no authority
  - checks its own before/after serialized world state to prove the audit stayed read-only
- `tests/object_use_audit_test.js`
  - sleeping-object approaches must be structurally reachable
  - bathroom utility remains honestly room-zone based rather than pretending an exact fixture exists
  - room permission snapshots remain evidence, not authority
  - audit output is deterministic and read-only
  - audited approaches stay inside the room and structural reachability graph
  - unknown room -> no audit

## Runtime / verification integration

- browser load order includes `src/object_use.js` and `src/object_use_audit.js`
- standalone build recipe includes both modules
- headless runtime loader requires both `ObjectUse` and `ObjectUseAudit`
- headless intake test checks both projections and their read-only behavior without `window`, `document`, or `localStorage`
- `npm test` includes both focused object-use suites
- dedicated commands exist:
  - `npm run test:object-use`
  - `npm run test:object-use-audit`
- `.github/workflows/review-tests.yml` adds a bounded review CI gate for steward/codex branches and pull requests:
  - headless boundary test
  - object-use affordance test
  - object-use audit test
  - focused simulation suite
  - standalone build smoke

## Verification receipt

The first CI execution did useful work rather than being hidden: headless checks and the base affordance suite passed, but the new audit test failed because a coarse bathroom utility was incorrectly being required to have an unoccupied exact standing cell. The audit model was repaired so room-level utility/zone evidence means **the room is structurally reachable**, while persistent-object use still requires an exact reachable approach position.

GitHub Actions review run **#6** then completed successfully on the repaired source (`c0fa8470ae8c17f2926497afdc7232d6ac33cd1f`):

- headless runtime intake: **17/17 checks passed**
- object-use affordances: **6/6 passed**
- object-use reachability/permission audit: **6/6 passed**
- full focused simulation suite: **224/224 tests passed** across the existing and new focused suites
- standalone one-file build smoke: **PASS**, generated HTML size **1,429,508 bytes**

No browser render/click PASS is inferred from those Node/build results. That remains a separate verification class.

The existing intake checksum receipt describes the sealed v0.11.3 source package. This review branch intentionally changes source, so old sealed checksums were not rewritten to manufacture a passing receipt.

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
- no generated standalone artifact committed from this chat runtime
- no release, promotion, merge, or CANON decision

These remain later merge-gated stages rather than being silently collapsed into this first pass.

## Steward assessment

This remains a bounded Stage-1 implementation of `LC-V120-LIVED-ROOMS`, but it is materially stronger than the first draft: object-use is now conceptually grounded, structurally reachability-audited, permission-evidence-aware, headless-capable, self-checking for read-only behavior, and backed by an independent green CI receipt. The branch still preserves the existing one-life, autonomy, privacy, deterministic replay, no-hidden-reward, no-object-loss, and review-before-canon direction.
