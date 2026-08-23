# Steward Report — LC-V120 Object-Use Affordances + Item Expansion

Date: 2026-08-23

Status: **REVIEW / NOT CANON**

Base: `codex/living-city-simulator-intake-v0.11.3`

Review branch: `steward/lc-v120-object-use-affordances`

## Why this pass exists

The v0.11.3 package already has truthful completed-action feedback and playable room browsing. The existing next-build queue identifies the first v0.12.0 step as mapping persistent objects to bounded actions and valid room/use positions before adding authoritative in-progress scene state.

This steward branch implements and hardens that seam while also expanding the small starter object catalogue. It does not rewrite the world schema, silently replace existing objects, execute new gameplay authority, or turn visual observation into a reward channel.

## Grounding + audit foundation

- `src/object_use.js` maps persistent furniture and room utility state to bounded existing activities.
- `src/object_use_audit.js` rechecks exact object approaches against structural reachability and keeps room-permission evidence advisory rather than authoritative.
- exact object use and coarse room-zone use remain distinguishable.
- blocked candidates are reported rather than guessed through.
- object identity, ownership hints, room evidence, no-reward and no-execution-authority boundaries remain explicit.
- browser, standalone and headless runtimes all load the same object-use foundation.

## 60-item catalogue expansion

The original 24-item starter catalogue is preserved and extended with 36 additional objects for **60 total catalogue items**.

New variety includes:

- seats: patched armchair, reading chair, loveseat sofa, modular sofa, kitchen chair
- sleep: double bed, bunk bed, futon bed, reclaimed bed
- work/hobby: writing desk, drawing desk, sewing table, maker workbench
- electronics/activity: refurbished laptop, compact computer, TV screen, record player, handheld game system
- lights: desk, paper-shade, clip and industrial floor lamps
- storage: book shelf, metal shelf, wall shelf, drawer crate
- surfaces: coffee, dining and side tables
- decor: large and hanging plants, woven rug, photo wall print
- food/kitchen: mini kitchen unit, induction stove, mini fridge

The expansion keeps the existing category model rather than creating a schema migration. Prices and stats intentionally overlap: cheap/secondhand, compact, expressive, durable and premium objects have different strengths rather than forming one universal best-item ladder.

New obvious functional objects join the precise object-use grammar:

- refurbished laptop / compact computer / handheld game system -> existing PC-play grounding where appropriate
- refurbished laptop / compact computer -> existing study grounding
- refurbished laptop / compact computer / record player -> existing creative-time grounding
- maker workbench -> existing repair-practice grounding

No new reward path is introduced.

Existing saves and starter rooms are **not silently repopulated** with the new catalogue. Existing object IDs and histories stay intact; the added items become available through the normal catalogue/runtime paths and can be used by future systems without rewriting old world state.

## Steward correction: visual classifier tweak rejected

After the green item-expansion run, a follow-up attempt was made to classify additional item IDs inside the older Living View visual grammar. Cross-checking immediately showed this was unsafe: the legacy visual quick-action grammar treats any `screen` broadly, so classifying a TV or handheld game device as a generic screen could accidentally present it as a study or creative computer.

That follow-up edit also touched a large source file through a replacement path that was not sufficiently narrow. Rather than keep or manually reconstruct it, the branch restores the **exact previously verified `src/visuals.js` blob** by its Git object SHA. The rejected visual-classifier experiment is not part of the intended result.

Functional meaning for the new items therefore stays in the more precise `ObjectUse` extension instead of broadening the old visual classifier.

## Verification

Review CI is part of this branch. It first exposed and helped repair an audit-modeling bug rather than hiding it.

Verified item-expansion source run: **Living City review tests #26** on `6ed793942f3d21e34529b905f1e600599b168433`.

PASS:

- headless runtime intake: **17/17 checks**
- expanded catalogue: **6/6 tests**
- object-use affordances: **6/6 tests**
- object-use reachability/permission audit: **6/6 tests**
- complete focused simulation suite: **230/230 tests**
- standalone one-file build smoke: **PASS**
- verified generated standalone size: **1,445,280 bytes**

A documentation-only report commit then passed the same branch-head CI gates before the rejected visual-classifier experiment. After the exact visual blob restore, require the final branch-head CI receipt before merge; do not infer it from the earlier green run.

Browser render/click verification remains a separate check and is not inferred from Node/build checks.

## Intentionally not done

- no active scene state yet
- no action interception or execution through the projection
- no autonomous resident object-use yet
- no final permission resolver yet
- no interruption model yet
- no visible/compressed scene parity yet
- no scene-driven animation yet
- no world-schema migration
- no automatic replacement or injection of objects into existing saves
- no broad legacy visual-classifier expansion for the new item types
- no rewrite of sealed v0.11.3 intake checksums
- no release, promotion, merge, or CANON decision

## Steward assessment

This remains a bounded review branch, but its floor is stronger: object-use is conceptually grounded, structurally audited, permission-evidence-aware and headless-capable, while the Build & Home catalogue now has substantially more room for different homes and personalities. The one-life, autonomy, privacy, deterministic replay, no-hidden-reward, no-object-loss, and review-before-canon direction remains preserved.
