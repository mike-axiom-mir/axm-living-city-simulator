# Changelog

## v0.11.3 — Interior Feedback Steward Pass

- Preserved the v0.11.0 authoritative world schema and v0.11.2 visual projection schemas.
- Added success-only `observedEffects` to new completed-activity receipts; the deltas are measured after the ordinary engine runs and add no new effect.
- Added a **What actually changed** card for truthful time, money, need, skill, home-condition, and selected-object changes.
- Added focused-object kind, condition, sentiment, usage, and history details plus **Open in Build & Home**.
- Added distinct completed-action echoes for eating at home, computer play, study, creative time, sleep, shower, and home cleaning.
- Filtered bathroom-inappropriate suggestions and allowed a basic at-home meal in grounded living-room/home contexts.
- Kept old v0.11.2 receipts valid without inventing effect deltas during migration.
- Passed 212/212 focused tests and all ten long stress commands, regenerated deterministic examples, and passed repeated-frame motion/Still/state-isolation QA.

Honest holds: live browser DOM/focus/responsive QA remains UNKNOWN because Python Playwright is unavailable; fresh schema validation remains UNKNOWN because Python `jsonschema` is unavailable. Sealed earlier evidence is retained but not mislabeled as a new run.

## v0.11.2 — Playable Interiors Steward Pass

- Preserved the v0.11 authoritative world schema and the complete v0.11.1 visual foundation.
- Made Living View the initial tab and Room the initial visual mode for new worlds.
- Added a browser for the player's current home rooms; browsing never writes current presence.
- Added persistent-object focus controls, focus rings, labels, and more legible interior placement.
- Added grounded room activity choices that call the existing `AXM.Systems.performActivity` engine.
- Added success-only `axm.living-city.visual-activity-receipt/v0.11.2` receipts with explicit no-extra-reward and not-current-presence boundaries.
- Added completed-moment echoes for sleep, shower, cleaning, and other supported activities.
- Added bounded bed, water, screen, table, kitchen, room-finish, and reduced-motion visual improvements.
- Added 9/9 playable-interior tests, bringing focused coverage to 212/212.
- Reproduced 12 × 365-day town stress and 8 × 180-day presence stress with exact deterministic replay and zero validation failures.
- Extended raster QA to prove completed echoes animate, Still remains stable, and drawing preserves exact world serialization.

Honest hold: live browser layout, responsive, and focus-navigation QA could not run because Python Playwright was unavailable. The updated browser harness is included; those claims remain UNKNOWN rather than being promoted from raster evidence.

## v0.11.1 — Animated Presence Steward Pass

- Preserved the v0.11 authoritative world schema and all simulation systems.
- Added pure `AXM.Visuals` scene derivation after Presence and before Game/UI.
- Added the eighteenth **Living View** with Room, Building, Street, and Follow-presence modes.
- Added low-graphic furniture, figure, shell, façade, route-trace, light, cloud, window, and ambient motion.
- Added Full, Gentle, and Still motion plus device reduced-motion enforcement.
- Exact people appear only through lawful co-presence; private building occupancy remains coarse.
- Visuals consume no simulation RNG and return no state mutation.
- Added 9 focused visual tests, raster frame QA, a browser harness for later Chromium execution, truth-boundary documentation, and a visual verification receipt.
- Reproduced town, household, and lived-building stress evidence without simulation drift.

Honest hold: browser-specific QA for the new tab could not run in this environment because no Chromium executable was available. Raster motion/state-isolation evidence passed and is reported separately.

## v0.11.0 — Lived Buildings and Everyday Presence

### Added

- `AXM.Presence` deterministic presence/privacy/indoor-movement subsystem.
- One current lawful presence snapshot per player/resident.
- Street-threshold state that does not invent interior entry.
- Shell/storey/stair/unit/habitat arrival and departure routes.
- Visible, compressed, partial-visible-then-compressed, and schedule-scale indoor movement.
- Real upper Courtyard Walk-up stair use.
- Privacy-coarsened autonomous presence for remote private interiors.
- Bounded shared-space access grants with all wider authority fields false.
- Refusal-safe ordinary encounters: greet, quiet, decline, and pass.
- Queued lawful indoor-departure-to-street-travel handoff.
- Seventeenth `Lived Buildings` view.
- Four new record schemas and one v0.11 world schema.
- Eleventh deterministic exported example world.
- v0.10 → v0.11 migration contract.

### Protected behavior

- Presence creates no tenancy, ownership, storage, editing, construction, household, family, care, employment, or surveillance authority.
- Exact remote private-room visibility remains false.
- Visible and compressed indoor movement use equal routes, minutes, stairs, and outcomes.
- Watching grants no hidden reward.
- Greetings and social interaction remain optional.
- Quiet, decline, and pass carry no hidden penalty.
- Distant residents resolve at schedule scale rather than continuous room tracking.
- Street arrival stops at the real threshold until access is checked.
- Choice-first life and `agePressure: false` remain intact.

### Repaired during development

- Removed duplicate/mismatched first-pass integration hooks and reapplied the presence bridge cleanly to the verified v0.10 base.
- Removed an empty relationship-record side effect from declining an encounter.
- Preserved valid current exterior bookkeeping byte-for-byte during v0.11 import.
- Updated inherited browser/screenshot QA to complete lawful indoor departure before asserting a street route.
- Updated all browser paths from 16 to 17 views.
- Replaced interrupted aggregate runs with completed component and screenshot-group runs; no interrupted output is counted.

### Verification

- 194/194 focused tests across eleven suites.
- 12 current v0.11 towns × 365 days; 4,380 primary days; zero validation failures.
- 8 current v0.11 household worlds × 180 days, each twice with exact replay; zero object loss.
- 8 lived-building worlds × 90 days, each run twice with exact replay; 20,629 completed movements and 1,741 stair uses.
- 56/56 schemas, 11 exported worlds, 15,833 records.
- 17-view broad browser QA plus targeted shell/presence QA.
- 58/58 broad screenshots plus six targeted captures; zero mobile overflow.

## v0.10.0 — Building Shells, Storeys, and Resident-Authored Frontages

### Added

- `AXM.Shells` deterministic shell/frontage subsystem.
- One persistent building-shell assignment for every current place.
- First explicit shared two-storey apartment shell: `Courtyard Walk-up`.
- Closed low-graphic exterior wall graphs per storey.
- Windows and external doors attached to real wall-edge IDs.
- Landings, unit entries, and stairs in an internal building route graph.
- Street-to-storey-to-unit-to-habitat continuity records.
- Stable roof identity with no maintenance obligation.
- Resident-authored exact frontage proposals.
- Player-owner, external-owner, and author-is-owner authority modes.
- Resident escrow and three-phase frontage work.
- Snapshot validation and rollback on failed final application.
- Sixteenth `Buildings` view with responsive low-graphic elevations.
- Three new record schemas and one v0.10 world schema.
- Tenth deterministic exported example world.
- Migration contract from v0.9.

### Protected behavior

- One shell per place; occupant and owner changes do not regenerate place identity.
- A building route grants no tenancy, access, ownership, surveillance, or resident control.
- Proposal is not permission; permission is not construction.
- Refusal changes no frontage and applies no hidden relationship penalty.
- Approval creates attributable resident-funded work rather than free instant mutation.
- No façade maintenance obligation, daily decay, appearance score, or age pressure.
- Migration derives present geometry but invents no prior frontage or construction history.

### Repaired during development

- Shell validation originally called normalization, which could silently repair corrupted evidence. Validation is now diagnostic-only and has direct regression coverage.
- Owner-contribution/tenant-transfer reporting initially blurred “preserved at transfer” with “remained forever.” Evidence now distinguishes safe transfer from later autonomous movement.
- Direct-require legacy tests initially omitted `src/shells.js`. Their source order was corrected before final town and household stress reruns.
- The canonical all-seed town command exceeded the external single-command window before final output. The same 12 seeds were rerun in three completed chunks and aggregated; no interrupted command was counted.

### Verification

- 174/174 focused tests.
- 12 towns × 365 days with shells loaded.
- 8 household worlds × 180 days, each run twice with exact replay.
- 8 shell worlds × 180 days, each run twice with exact replay.
- 51/51 schemas, 10 exported worlds, 10,372 records.
- 16-view targeted browser QA with zero page/console errors and zero mobile overflow.

## v0.9.0 — Walkable Places and Exterior Identity

### Added

- `AXM.Exteriors` deterministic exterior and movement subsystem.
- Stable unique addresses for every current place.
- Façade material, window style/count, roofline, frontage type, sign, door, and access identity.
- Four named pedestrian lanes and three connecting passages.
- Connected entrance-to-entrance route graph.
- Minute-level player travel.
- Visible, compressed, compress-remainder, and early-end travel choices.
- Autonomous resident schedule-route evidence.
- Bundled route provenance for already-costed actions.
- Observation-only street moments.
- Fifteenth `Street Life` view and responsive street canvas.
- Four new JSON schemas and one v0.9 world schema.
- Ninth deterministic exported example world.
- Migration contract from v0.8.

### Protected behavior

- Travel compression is always valid when a route exists.
- Visible and compressed modes use equal route/time/need cost.
- No walking streak, commute score, age pressure, or hidden visible-mode reward.
- Route or exterior observation grants no authority over a person or place.
- Migration creates present infrastructure but no fabricated past journeys.

### Repaired during development

- Removed tiny segmented-versus-compressed cost drift by using one linear rounded travel effect.
- Removed a hidden mood asymmetry that made visible walking statistically superior.
- Initialized `usageSessions` on newly created enterprise equipment so current saves no longer gain a field only after import/migration.
- Added a non-serialized route cache after repeated pathfinding made long observer suites unacceptably slow.
- Updated browser and screenshot QA from 14 to 15 views.
- Replaced an interrupted 50/51 visual aggregate with independent group reruns and full 51-image verification.

### Verification

- 156/156 focused tests.
- All inherited long deterministic suites passed.
- 8 walkable worlds × 180 days, each run twice with exact serialized equality.
- 47/47 schemas, 9 exported worlds, 9,012 records.
- 15-view browser QA with zero page/console errors.
- 51/51 desktop/mobile screenshots with zero overflow failures.

## v0.8.0 — Living Local Economy

Added optional local enterprise, real commercial rooms, actual resident customers, dual-mode enterprise work, repairable equipment, bounded workers, attributable money, and isolated economy randomness.

## v0.7.0 — Choice-First Personal Directions

Added no-age-pressure life chapters, undated personal projects, restoration, collaboration, pause, reshape, completion, archive, and release.

## v0.6.0 — Casual Community Adventures

Added casual-realism maintenance compression, institutions, invitations, bounded visits, connections, and no-deadline adventures.

## v0.5.0 — Family Continuity

Added autonomous dependents, care influence, refusal, education, family continuity, and independent adulthood.

## v0.4.0 — Autonomous Stewardship

Added resident-authored renovations, escrow, permission, phased work, refunds, and property biographies.

## v0.3.0 — Structural Habitats

Added real rooms, walls, doors, surfaces, utilities, construction phases, validation, and rollback.

## v0.2.0 — Household Agreements

Added adult commitment, cohabitation, shared finance, room boundaries, conflict, repair, and unilateral separation.

## v0.1.0 — Living City Foundation

Established one directly controlled character, autonomous residents, housing, work, decorating, object identity, upgrades, and deterministic saves.
