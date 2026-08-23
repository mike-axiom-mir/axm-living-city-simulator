# Action Report — AXM Living City Interior Feedback Steward Pass v0.11.3

## v0.11.3 result

The v0.11.2 room browser now gives the player a truthful, compact explanation of what the existing activity engine changed. New receipts are measured after successful ordinary completion; they do not apply money, need, skill, object, home, relationship, reward, or authority effects themselves. Focused objects also expose useful identity details and can be opened directly in Build & Home. Seven supported completed-action kinds now have visibly distinct motion.

### Steward classification

| Classification | Result |
|---|---|
| EXISTING | Complete v0.11.2 simulation, activity engine, privacy, authority, room graph, object identity, visual schemas, and motion choices preserved. |
| EXTEND | Optional observed-effect deltas, object detail, Build & Home bridge, action-specific animation, tests, receipts, and intake packaging. |
| ADAPT | Context suggestions now exclude implausible bathroom activities and allow a grounded basic home meal from a living-room/home context. |
| NEW | Factual **What actually changed** presentation card and selected-object feedback. |
| HOLD | Authoritative active object-use scenes, autonomous live scenes, interruption, visible/compressed scene parity, and continuous private-resident animation. |

### Truth path

```text
capture bounded before snapshot
→ existing AXM.Systems.performActivity
→ ordinary authoritative completion
→ compare bounded after snapshot
→ optional observedEffects on presentation receipt
→ factual card + completed echo, never current presence
```

`observedEffects.noAddedEffect` is true. The receipt scope is deliberately limited to the player and selected home context; autonomous background evolution remains attributable through the ordinary ledger rather than being falsely summarized by the card.

### Completed v0.11.3 evidence

- 212/212 focused tests.
- All ten long stress commands completed successfully, including 12 towns × 365 days and exact deterministic replays for every repeated-seed suite.
- Deterministic examples regenerated successfully.
- Seven completed-action pairs changed pixel hashes and were visibly inspected; the Still pair was identical.
- Every repeated-frame draw preserved exact authoritative world serialization.
- Temporary raw frames were deleted after inspection; digests remain in `tests/VISUAL_FRAME_DIGESTS_v0_11_3.json`.

### Honest limits

- `python3 tests/visual_presence_browser_test.py` stopped at missing Python Playwright, so live DOM, focus, and responsive behavior remain UNKNOWN.
- `python3 tools/validate_schemas.py` stopped at missing Python `jsonschema`; schemas were unchanged, and the earlier sealed 56/56 result is not promoted as a fresh run.
- v0.11.3 still has after-the-fact feedback, not authoritative active object-use scene state.

## v0.11.2 result

The v0.11.1 Living View was extended into a more playable interior surface without constructing a competing simulation. The player can browse the rooms of their current home, focus real persistent objects, and invoke a bounded set of contextual activities through the existing authoritative activity engine. A successful completion may create a clearly labeled visual echo; browsing and replay never claim current presence.

### Steward classification

| Classification | Result |
|---|---|
| EXISTING | Complete v0.11 simulation, v0.11.1 Living View, lawful presence, room graph, persistent objects, activity engine, privacy, and visual motion policies preserved. |
| EXTEND | Room browsing, object focus, contextual choices, room-purpose finishes, object motion, documentation, tests, and verification receipts. |
| ADAPT | New worlds open in Living View/Room mode; v0.11.1 saves receive only absent presentation defaults. |
| NEW | Success-only completed-moment visual receipt and explicitly after-the-fact echo. |
| HOLD | Authoritative active object-use scene state, autonomous scenes, interruption, visible/compressed action parity, continuous private-resident animation, and routine scoring. |

### Truth path

```text
real room/object context
→ existing AXM.Systems.performActivity
→ ordinary authoritative completion
→ optional no-reward visual receipt
→ completed echo, not current presence
```

The contextual route has exact gameplay parity with the ordinary activity route. It does not duplicate need, time, skill, money, relationship, object, reward, or authority effects.

### Completed v0.11.2 evidence

- 212/212 focused tests, including 9/9 visual-boundary and 9/9 playable-interior tests.
- 12 towns × 365 days reproduced with zero validation failures.
- 8 adult-household worlds × 180 days reproduced twice exactly with 105 proposals and no object loss.
- 8 lived-building worlds × 180 days reproduced twice exactly: 41,413 movements, 3,624 stair uses, and zero replay failures.
- Room, Building, Street, and completed-moment frame pairs changed pixels across timestamps.
- Still-mode frames were byte-identical; every draw preserved exact world serialization.
- Raw verification frames were deleted after inspection; hashes remain in `tests/VISUAL_FRAME_DIGESTS_v0_11_2.json`.

### Honest visual limit

Python Playwright was unavailable in this runtime. The updated browser harness is included, but live DOM layout, keyboard focus, and responsive behavior are not called passed. Canvas motion, object focus, completed-echo distinction, Still stability, and state isolation are supported by repeated raster evidence.

## v0.11.1 result

The sealed v0.11 city was extended rather than reconstructed. The authoritative `axm.living-city-sim.world/v0.11.0` schema remains intact. A new `AXM.Visuals` presentation organ and eighteenth **Living View** now derive low-graphic animated Room, Building, and Street frames from the existing room graph, persistent furniture, building shells, exterior identity, public route evidence, time of day, and lawful player/co-presence state.

The animation has no state-return path. It does not advance time, consume needs, create object-use records, widen authority, reveal a private room, improve a relationship, or reward watching.

### Steward classification

| Classification | Result |
|---|---|
| EXISTING | Complete v0.11 simulation, presence, routes, shells, objects, privacy, tests, and roadmap preserved. |
| EXTEND | UI source order, standalone builder, motion settings, documentation, and verification evidence. |
| ADAPT | v0.11.0 saves receive only patch version plus visual UI defaults. |
| NEW | `src/visuals.js`, Living View, three visual grammars, Full/Gentle/Still motion, visual tests and receipts. |
| HOLD | Authoritative object-use scenes, action animation, continuous resident animation, 3D rigs, weather, and crowds. |

### Completed v0.11.1 evidence

- 203/203 focused tests, including 9/9 new visual boundary and markup tests.
- 12 towns × 365 days reproduced with zero validation failures.
- 8 household worlds × 180 days reproduced with exact replay and no object loss.
- 8 lived-building worlds × 180 days reproduced twice exactly: 41,413 movements and 3,624 stair uses.
- Room, Building, and Street frame pairs changed pixels across timestamps.
- Still-mode frames were byte-identical.
- Scene derivation preserved the simulation RNG; raster drawing preserved exact world serialization.
- Raw verification frames were deleted after inspection; hashes remain in `tests/VISUAL_FRAME_DIGESTS_v0_11_1.json`.

### Honest visual limit

This environment had no Chromium executable and no Python Playwright package. The new browser harness is included, but live browser layout, focus, and responsive behavior for the eighteenth view are not called passed. Completed raster evidence is called passed; the browser-specific seam remains explicit.

## Inherited v0.11 implementation report

## Result

v0.11 is implemented as a real extension of the v0.10 Building Shells package. The existing street, shell, storey, stair, unit, habitat, autonomy, family, community, project, and economy systems remain active. A new deterministic `AXM.Presence` organ now connects those spatial layers through lawful arrival, departure, indoor routes, privacy-bounded presence, and refusal-safe ordinary encounters.

The branch runs offline as modular source and as one bundled HTML file.

## Active interpretation of the idea

The goal was not to create a resident-tracking dashboard or a minute-by-minute animation tax. The goal was to let buildings feel inhabited while preserving casual realism:

- the player may watch movement when it is interesting;
- the player may compress movement when it is not;
- autonomous residents remain people rather than units;
- exact private room state is not exposed remotely;
- a landing overlap may offer a small encounter but never demand a greeting;
- presence never creates wider authority.

## What was built

### Current presence foundation

The world now retains one current presence snapshot for the player and every autonomous resident. Validation checks complete person coverage, lawful place/building/storey/room references, privacy coarsening, and forbidden authority flags.

### Lawful street-to-room continuity

Street travel ends at a real threshold. Entry is a separate access decision and route. Upper-floor routes traverse the existing Courtyard Walk-up stair link. Leaving a building completes the reverse route before a queued street journey begins.

### Indoor movement modes

Arrival, departure, and room movement support visible, compressed, and schedule-scale modes. Partial visible routes can be compressed without changing the remaining route, time, stair use, destination, or authority result.

### Privacy-aware disclosure

Private NPC interiors are represented coarsely unless the player is lawfully co-present. The interface distinguishes internal simulation state from what the player may legitimately know.

### Ordinary encounters

Shared-space overlaps can offer one bounded encounter. Greet spends five explicit minutes. Quiet, decline, and pass apply no hidden cost or relationship effect.

### Bounded presence grants

The first visit/access record allows only shared-space entry for a stated place, host, purpose, and expiry. Every broader authority field remains false.

### Schedule-scale autonomy

Autonomous residents now leave indoor movement evidence through their existing schedules without requiring continuous rendering or a per-minute simulation tax.

### Lived Buildings interface

A seventeenth view exposes the new evidence and controls. A labeled one-use experiment prepares a lawful upper-walk-up visit, real stairs, one ordinary encounter, and final room arrival through ordinary engine records.

## Root protections now enforced in state

The module validates that:

- compression remains available;
- greetings remain optional;
- watching creates no reward;
- remote private-room visibility remains false;
- continuous room tracking remains false;
- presence creates no authority;
- social checklists and movement obligations remain false;
- age pressure remains false;
- migration invents no earlier presence history.

## Reusable organs exposed

- `lawful-presence-snapshot`
- `street-threshold-not-entry-gate`
- `shell-to-room-presence-router`
- `visible-compressed-indoor-parity`
- `schedule-scale-presence-resolver`
- `privacy-bounded-presence-disclosure`
- `ordinary-encounter-with-refusal-root`
- `bounded-presence-access-grant`
- `queued-indoor-to-street-handoff`
- `diagnostic-only-presence-validator`

These organs can support later games, simulations, institutions, multiplayer visitors, AI participants, and observer systems without importing surveillance or control.

## Verification summary

Completed v0.11 evidence:

- **194/194 focused tests** across all eleven component suites, rerun independently against the final source;
- **12 towns × 365 days** with all v0.11 modules loaded, totaling 4,380 primary simulated days and zero validation failures;
- average town outcomes of 5.17 moves, 375.92 décor actions, 803.25 object upgrades, 13.92 distinct home designs, and 11.08 visibly changed homes;
- **8 household worlds × 180 days**, each executed twice with exact serialized equality;
- 105 household proposals, 91 acceptances, 14 declines, 79 conflicts, 65 successful repairs, eight relocations, and 81 autonomous partner initiatives;
- **8 lived-building worlds × 180 days**, each executed twice with exact serialized equality;
- 41,413 completed indoor movements, 41,221 schedule movements, 192 compressed player movements, 103,786 movement minutes, and 3,624 stair uses;
- 96 lawful arrivals, 96 lawful departures, 64 room transitions, and 310 optional encounters passed without penalty;
- focused/example/browser proof of access grants, greeting, quiet acknowledgment, decline, and visible/compressed parity;
- zero validation, object-loss, age-pressure, compulsory-greeting, surveillance, or deterministic-replay failures in the claimed long-run evidence;
- **56/56 schema definitions**;
- **11 complete exported worlds**;
- **15,833 independently validated records**;
- 17-view broad and targeted browser QA with zero page or console errors;
- 58 broad screenshots plus six targeted captures, with zero mobile horizontal overflow.

The complete v0.10 long-run evidence remains bundled as lineage evidence for inherited systems. It is not represented as a fresh v0.11 rerun. Slow v0.11 convenience batches that did not finish are preserved with `.partial.txt` names and excluded from every pass count.

## Meaningful defects found and repaired

### Room transitions were counted twice

The first room-transition completion path incremented the transition metric once when presence changed and again when movement completed. The duplicate increment was removed, and the focused room-route tests now cover the authoritative count path.

### Decline was not truly side-effect free

An early ordinary-encounter implementation could create an empty relationship record when the player declined. That was still state mutation. The response path now inspects existing relation state without creating one, and focused tests compare protected time, money, needs, housing, age, life chapter, and relationship state exactly.

### Current-save round trip changed exterior bookkeeping

Importing a valid current save could replace an existing exterior bookkeeping field with the player’s currently visited address. Migration now preserves valid v0.11 state byte-for-byte rather than “normalizing” it. The round-trip test requires exact serialized equality.

### Older travel QA assumed indoor teleportation

The inherited walkable tests and browser harness expected a visible street route to begin immediately even when the player was inside. v0.11 lawfully completes indoor departure first. The tests now follow that route handoff without weakening street-travel parity.

### QA still expected sixteen views

Browser and screenshot harnesses were migrated to all seventeen views and received dedicated desktop/mobile Lived Buildings coverage. A malformed intermediate screenshot insertion was repaired before the final 58-image set was accepted.

### Long convenience aggregates reached external windows

No interrupted aggregate is counted as a pass. Focused suites, town stress, household stress, lived-building stress, schema QA, browser QA, and screenshot groups were completed independently. Partial stewardship/family/community long outputs are preserved as explicitly interrupted evidence rather than silently promoted.

## Migration honesty

v0.10 saves receive present-day presence snapshots only where derivable from current lawful state. Migration does not fabricate:

- earlier indoor journeys;
- exact private-room history;
- greetings or refusals;
- visit invitations or access grants;
- surveillance evidence;
- social rewards;
- authority.

## Honest limits

- Presence is low-graphic state and evidence, not full character animation.
- NPC indoor movement is summarized at schedule scale.
- Exact private room state is deliberately withheld remotely.
- Encounter content is bounded and not a general dialogue system.
- The access model is a game contract, not real privacy, tenancy, or guest law.
- Arbitrary geometry, lifts/ramps, vehicles, weather, transit, and large crowds remain absent.

## Strongest next branch

**Lived Rooms and Object-Use Scenes v0.12** should attach visible everyday actions to real rooms and persistent objects: sit, read, cook, repair, create, play, rest, and small side activities. The first implementation should preserve visible/compressed parity, privacy, object identity/history, autonomous choice, and no perfect-routine pressure.
