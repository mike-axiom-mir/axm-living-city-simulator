# QA Report — AXM Living City v0.11.3 Interior Feedback

## Outcome

**PASS for the completed evidence described below.** Interrupted convenience aggregates are explicitly excluded.

## Focused regression

| System | Result |
|---|---:|
| Foundation | 12/12 |
| Household agreements | 13/13 |
| Structural habitats | 19/19 |
| Autonomous stewardship | 17/17 |
| Family continuity | 21/21 |
| Community adventures | 18/18 |
| Personal directions | 16/16 |
| Living local economy | 23/23 |
| Walkable places | 17/17 |
| Building shells/frontages | 18/18 |
| Lived buildings/presence | 20/20 |
| Animated presence boundaries/UI markup | 9/9 |
| Playable interiors/activity parity/UI markup | 9/9 |
| **Total** | **212/212** |

Every focused suite was rerun against the v0.11.3 source. The result does not depend on an interrupted aggregate.

## Full-world town integration

Twelve deterministic v0.11 towns ran for 365 days each with all source modules loaded.

- Primary simulated days: **4,380**.
- Validation failures: **0**.
- Average resident moves: **5.17**.
- Average autonomous décor actions: **375.92**.
- Average object upgrades: **803.25**.
- Average distinct final home designs: **13.92**.
- Average visibly changed homes: **11.08**.
- Minimum visibly changed homes in any world: **10**.

## Adult-household deterministic stress

Eight cohabiting worlds ran for 180 days against the v0.11.3 source and each seed was executed twice with exact serialized equality required.

- Household proposals: **105**.
- Accepted: **91**.
- Declined: **14**.
- Conflicts: **79**.
- Successful repairs: **65**.
- Relocations: **8**.
- Autonomous partner initiatives: **81**.
- Tracked member objects across final worlds: **151**.
- Validation failures: **0**.
- Object-loss failures: **0**.
- Exact-replay failures: **0**.

## Long deterministic matrix

All ten current long commands completed successfully: town, household, stewardship, family, community, personal directions, local economy, walkable places, building shells, and lived-building presence. Repeated-seed suites required exact deterministic replay. Current lived-building defaults covered 8 worlds × 90 days with 20,629 completed movements, 1,741 stair uses, zero validation failures, and zero replay failures.

## Retained v0.11.2 lived-building deterministic stress

Eight worlds ran for 180 days and each seed was executed twice with exact serialized equality required.

- Indoor movements started/completed: **41,413 / 41,413**.
- Schedule-scale movements: **41,221**.
- Compressed player movements: **192**.
- Grounded indoor movement minutes: **103,786**.
- Stair uses: **3,624**.
- Lawful arrivals/departures: **96 / 96**.
- Room transitions: **64**.
- Optional encounters offered/passed: **310 / 310**.
- Final retained detailed presence records: **4,688**.
- Final current-presence snapshots: **192**.
- Validation failures: **0**.
- Exact-replay failures: **0**.
- Object-loss failures: **0**.
- Age pressure, compulsory greetings, surveillance, watching rewards, remote private-room disclosure, and minute-by-minute presence tax remained false.

The stress path uses repeated lawful public/home journeys and schedule-scale autonomous movement. Bounded private visits and explicit greeting/quiet/decline decisions are proven separately by focused, deterministic-example, and browser tests rather than being manufactured into the stress route.

## Schemas and deterministic examples

- Draft 2020-12 schema definitions: **56/56**.
- Complete v0.11 exported worlds: **11**.
- Independently validated v0.11-compatible records: **15,833**.
- Included examples cover lawful stair movement, bounded access, side-effect-free refusal, privacy coarsening, and choice-first age stability.

## v0.11.3 interior-feedback QA

- New worlds open in Living View with Room mode.
- Room browsing is limited to the player's current home and does not place current actors in an unoccupied browsed room.
- Contextual actions are grounded in actual room purposes and persistent objects.
- The contextual route and direct `AXM.Systems.performActivity` route produce exact gameplay-equivalent world state aside from ephemeral visual UI fields.
- Invalid rooms create no receipt; object focus is presentation-only.
- Migration creates no earlier room visit, activity, or visual receipt.
- New receipts report only measured time, money, need, skill, home-condition, and selected-object deltas after the ordinary engine succeeds.
- The receipt declares `noAddedEffect: true`; older receipts without measured effects remain valid and gain no invented values.
- Focused-object detail exposes persistent identity fields and the Build & Home bridge without widening authority.
- Bathroom context filters eating, computer play, study, and creative work.
- A grounded living-room/home context can offer a basic meal without claiming a kitchen fixture exists.

## v0.11.3 visual frame QA

- Room, Building, and Street each rendered at two timestamps.
- All three full-motion pairs produced distinct PNG hashes.
- Sleep, shower, eat-at-home, computer-play, study, creative-time, and clean-home moments each rendered at two timestamps and produced distinct PNG hashes.
- Two Still-mode room frames rendered at different timestamps produced the same SHA-256 hash.
- Every raster draw preserved exact world serialization.
- Pure scene derivation preserved `world.rngState`.
- The generated frames were visually inspected for visible room, building, street, figure, lighting, and truth-boundary labels.

The current environment exposed a raster canvas renderer but lacked Python Playwright. Therefore the updated eighteenth-view browser harness is included but not promoted as a completed browser pass here. Desktop/mobile DOM layout and live browser focus behavior remain a named follow-up.

## Inherited v0.11 browser and visual QA

- Broad browser flow across the original **17 views**: PASS under the sealed v0.11 evidence.
- Building-shell targeted flow under v0.11: PASS.
- Lived-building targeted flow: PASS.
- Page errors: **0**.
- Console errors: **0**.
- Broad desktop/mobile screenshots: **58/58**.
- Targeted shell/presence screenshots: **6**.
- Horizontal-overflow failures: **0**.

## Defects found and repaired

1. Room-transition evidence was incremented twice in the first completion path.
2. Declining an encounter could create an empty relationship record.
3. Current-save migration could normalize an exterior bookkeeping field and break exact round trips.
4. Inherited travel QA assumed street travel began before lawful indoor departure.
5. Browser/screenshot harnesses still expected sixteen views.
6. A malformed intermediate screenshot capture insertion was removed before final evidence generation.
7. Initial room rendering packed persistent objects too tightly; deterministic placement and room finishes were revised before the accepted raster inspection.
8. The whole-home cleaning shortcut initially described only the selected room; its copy now states the true existing activity scope.

## Execution honesty

A parallel convenience batch in the v0.11 lineage attempted the slow stewardship, family, and community long suites. The external command window ended before they completed. Those partial stdout files use `.partial.txt` names and are not counted.

For v0.11.3, focused tests, every long stress command, deterministic examples, and repeated-frame raster QA were run against the patch. Schema files were unchanged, but the current schema command stopped at the missing Python `jsonschema` dependency; the 56/56 result is explicitly retained from sealed earlier packages. The updated Living View browser attempt stopped at the missing Python Playwright dependency; no browser result was inferred from raster output.
