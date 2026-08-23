# AXM Living City — Interior Feedback Steward Pass v0.11.3

**Status:** playable deterministic local-first simulation foundation; not a finished commercial life simulator.  
**Working title:** “Living City” remains provisional.  
**Runtime:** one offline HTML file or modular browser source. No account, API key, AI model, server, analytics, installation, or network request is required.

The protected center remains:

> **Be yourself. Find your adventure. Do not make others smaller. Grow in your own way.**

v0.11.3 preserves the complete v0.11.2 simulation and makes the **Living View** more readable after an activity. The player can see the effects the ordinary engine actually applied, inspect a focused persistent object, jump to that object in Build & Home, and watch a more distinct completed-action echo. The patch also removes implausible bathroom suggestions such as studying, computer play, and creative work. It adds no second reward path and still never presents a replay as current presence.

Presence is spatial evidence only. It does not create tenancy, ownership, edit permission, construction authority, household membership, family authority, employment, storage rights, or surveillance access.

## Start here

- Windows: `START_LIVING_CITY.bat`
- Linux/macOS: `START_LIVING_CITY.sh`
- Standalone offline build: `standalone/AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html`
- Modular development entry: `index.html`
- Protected roots: `DESIGN_ROOTS.md`
- Full action report: `ACTION_REPORT.md`
- Local-machine handoff: `MACHINE_HANDOFF.md`
- Current build status: `CURRENT_BUILD_STATUS.md`
- Continuation prompt: `CONTINUATION_PROMPT.md`
- Exact final evidence: `tests/FINAL_TEST_RESULTS_v0_11_3.txt`
- Presence contract: `docs/LIVED_BUILDINGS_AND_EVERYDAY_PRESENCE.md`
- Privacy/authority contract: `docs/PRESENCE_PRIVACY_AND_AUTHORITY.md`
- Encounter/compression contract: `docs/ORDINARY_ENCOUNTERS_AND_COMPRESSION_PARITY.md`
- Animated-presence contract: `docs/ANIMATED_PRESENCE_AND_TRUTH_BOUNDARIES.md`
- Playable-interiors contract: `docs/PLAYABLE_INTERIORS_AND_COMPLETED_MOMENT_ECHOES.md`
- Interior-feedback contract: `docs/INTERIOR_FEEDBACK_AND_ACTION_ECHOES_v0_11_3.md`
- v0.10 → v0.11 migration: `docs/MIGRATION_v0_10_TO_v0_11.md`
- v0.11.1 → v0.11.2 migration: `docs/MIGRATION_v0_11_1_TO_v0_11_2.md`
- v0.11.2 → v0.11.3 migration: `docs/MIGRATION_v0_11_2_TO_v0_11_3.md`

Opening the standalone HTML is the simplest path. It starts in **Living View** and Room mode. Browse your current home's rooms, select a real object, and use **Things to do here** for contextual versions of existing activities. Use **Building / Street** for the other visual grammars or **Follow presence** to follow current lawful state. Full, Gentle, and Still motion are explicit choices; a device reduced-motion preference also forces a stable frame.

## What v0.11.3 adds

- A factual **What actually changed** card derived only after the ordinary activity engine succeeds.
- Exact deltas for time, money, needs, skills, home condition, and the selected object when those values actually changed.
- A focused-object detail panel with kind, condition, sentiment, usage, history count, and a direct **Open in Build & Home** bridge.
- Distinct meal, computer-play, study, creative, sleep, shower, and cleaning echoes with deterministic Full/Gentle/Still behavior.
- Context-sense filtering so bathroom rooms do not suggest studying, computer play, creative work, or eating.
- A living-room basic meal option when the current home context supports it, even when the seed has no dedicated kitchen fixture.
- Backward-compatible optional receipt evidence: older v0.11.2 receipts render without fabricated deltas.
- A fresh 212/212 regression run, the complete long stress-command matrix, deterministic examples, repeated-frame inspection, and self-contained local-intake packaging.

This remains a feedback patch, not v0.12 active scene state. The activity completes through the ordinary engine first; the effect receipt and animation explain that completed event afterward.

## What v0.11.2 added

- A room browser for the player's current home; browsing never moves the player or invents current actors.
- Contextual activity choices grounded in real room purposes and persistent objects.
- Exact parity with `AXM.Systems.performActivity`; the visual path is convenience, not a second reward path.
- Selectable persistent objects with clear canvas focus rings and labels.
- Completed-moment echoes created only after a real activity succeeds and explicitly labeled as not current presence.
- More legible room layouts, purpose finishes, and bounded bed, water, table, screen, and kitchen motion.
- Nine new playable-interior tests plus raster proof for focus and completed-echo animation.

## v0.11.1 visual foundation retained

- An eighteenth playable view: **Living View**.
- Low-graphic animated room scenes drawn from real room graphs and persistent furniture.
- Building elevations with time-of-day light, bounded player-route cues, and coarse occupancy rather than private-room markers.
- Street panoramas with persistent façades, public route traces, clouds, light, and player presence.
- Full, Gentle, and Still motion policies, plus device reduced-motion respect.
- A pure `AXM.Visuals` derivation module that does not consume the simulation RNG or write authoritative scene state.
- Pixel-level frame QA proving motion changes pixels, Still mode remains byte-stable, and drawing leaves world state unchanged.

This patch deliberately does **not** pretend the visuals are v0.12 active object-use scenes. Ambient motion is atmosphere. A completed-moment echo is evidence only that the ordinary activity already completed; it is not a current actor scene. Authoritative active sit/read/cook/repair/create/play/rest scenes remain the next branch.

## What v0.11 adds

### One authoritative presence snapshot per person

Every player/resident has a current deterministic presence record. Presence can distinguish:

- a public street threshold;
- a shared building route or landing;
- stairs and unit-entry routes;
- a lawful room;
- a deliberately coarse private interior when exact room disclosure would be surveillance.

The initial world contains one player plus 23 autonomous residents, so validation requires 24 current snapshots.

### Lawful arrival and departure

Street travel no longer teleports the player directly into a room. The flow is now:

```text
street route completes
→ player remains outside the real entrance
→ access is checked
→ lawful indoor route begins
→ landing/stairs/unit entry are traversed
→ valid room presence is established
```

Leaving reverses that path. A visible street journey requested from indoors is queued until the lawful indoor departure completes. A compressed journey resolves the same departure first, then the same street route.

### Real stairs, landings, and room graph use

The upper Courtyard Walk-up route uses the v0.10 shell stair edge rather than an invented shortcut. Room transitions use the existing habitat room/door graph and respect private/common purpose and household boundaries.

### Visible or compressed indoor movement

Indoor arrival, departure, and room transitions support visible and compressed modes.

Both modes use the same:

- route steps;
- access decision;
- minutes;
- stairs;
- final presence;
- authority outcome.

The player may also watch part of a visible route and compress the remainder. Watching creates atmosphere, not superior progression.

### Privacy-aware visibility

The simulation may know that an autonomous resident is inside their lawful home, but the interface does not expose an exact private room unless the player is lawfully co-present in a discloseable space.

Remote private-room visibility is false. Presence does not become a resident tracker.

### Refusal-safe ordinary encounters

A brief shared-space overlap may create an ordinary encounter. The player may:

- say a small hello, explicitly spending five minutes;
- give a quiet acknowledgment with no hidden state change;
- say “not now” with no hidden state change;
- leave the moment unanswered until it passes without penalty.

Quiet and decline preserve time, money, needs, housing, ownership, and relationship state exactly. Declining does not even create an empty relationship record.

### Bounded access grants

A visit grant may allow shared-space entry for one place and purpose. It grants no:

- tenancy;
- storage;
- object ownership;
- edit or construction authority;
- household/family/care authority;
- employment;
- surveillance.

Owning an occupied property still does not grant entry into the tenant’s private home.

### Schedule-scale autonomous presence

Distant residents are not simulated minute by minute. Their schedules resolve indoor movement at bounded schedule scale, leaving deterministic route evidence without creating a continuous tracking tax.

### Seventeenth playable view retained

The new **Lived Buildings** view exposes:

- current lawful presence;
- indoor route and stair evidence;
- visible/compressed entry, exit, and room movement;
- lawfully perceivable people;
- ordinary encounter choices/history;
- bounded grants;
- privacy, no-obligation, and no-watching-reward roots.

## Earlier foundations remain active

v0.11 still contains:

- one directly controlled character among autonomous residents;
- living housing, rent, vacancies, moves, and property history;
- playable or compressed employment;
- deep decorating, recoloring, repair, storage, sentiment, and upgrade-without-replacement;
- adult household agreements, boundaries, finance, conflict, repair, relocation, and unilateral exit;
- structural rooms, walls, doors, utilities, surfaces, phased construction, validation, and rollback;
- resident-authored interior and frontage changes with real funding and permission;
- autonomous dependents, care, refusal, education, family continuity, and choice-first adulthood;
- community institutions, invitations, visits, connections, and no-deadline adventures;
- undated personal directions and object restoration;
- optional local enterprise using actual residents as customers;
- connected addresses, exterior identity, street routes, observation-only moments, and travel compression parity;
- persistent building shells, storeys, stairs, unit entries, and resident-authored frontages;
- deterministic JSON import/export, ledger export, source provenance, and corruption diagnosis without silent repair.

## Development commands

```bash
npm run build
npm test
npm run test:presence
npm run test:presence-stress
npm run test:visuals
npm run test:interiors
npm run examples
npm run qa:schemas
npm run qa:browser
npm run qa:shells-browser
npm run qa:presence-browser
npm run qa:visuals-browser
npm run qa:screenshots
```

`npm run verify` chains the complete suite. On constrained sandboxes, long or visual groups should be run independently and only completed outputs counted.

## Verified evidence

Current v0.11.3 evidence includes:

- **212/212 focused tests** across thirteen independently completed suites, including 9/9 visual-presence boundary tests and 9/9 playable-interior tests;
- **12 deterministic towns × 365 days**, totaling 4,380 primary simulated days with the complete v0.11 source order loaded and zero validation failures;
- average town outcomes of 5.17 resident moves, 375.92 autonomous décor actions, 803.25 object upgrades, 13.92 distinct home designs, and 11.08 visibly changed homes;
- **8 adult-household worlds × 180 days**, each replayed from the same seed with exact serialized equality against the v0.11.3 source;
- 105 household proposals, 91 acceptances, 14 declines, 79 conflicts, 65 successful repairs, eight relocations, and 81 autonomous partner initiatives;
- the complete town, household, stewardship, family, community, directions, economy, walkable-place, building-shell, and lived-building long stress commands all completed successfully;
- **8 lived-building worlds × 90 days**, each replayed exactly from the final source, with 20,629 completed movements and 1,741 stair uses;
- direct focused, example, and browser proof of bounded access grants, greeting, quiet acknowledgment, decline, and partial-visible-then-compressed movement;
- zero validation, object-loss, age-pressure, surveillance, compulsory-greeting, or replay failures in the claimed long-run evidence;
- the sealed **56/56** Draft 2020-12 schema-definition result; schema files were unchanged and the current runtime again lacked Python `jsonschema` for a fresh rerun;
- **11** complete v0.11 exported worlds;
- **15,833** independently validated compatible records;
- deterministic raster proof that Room, Building, Street, and all seven completed-action echo kinds change across timestamps while Still frames remain byte-identical;
- exact proof that visual derivation and raster drawing do not change authoritative world serialization or the deterministic RNG;
- inherited v0.11 browser QA remains valid for the original 17 views; the updated eighteenth-view browser harness is included, but could not execute here because Python Playwright was unavailable.

The completed v0.10 package remains the historical source for the earlier branch’s full long-domain stress evidence. A convenience attempt to rerun the slow stewardship, family, and community long suites under v0.11 exceeded the external command window; partial outputs are explicitly marked and excluded. No v0.10 metric is relabeled as a fresh v0.11 result.

## Honest limits

- Animation is intentionally low-graphic. Completed echoes follow real finished activities, but they are presentation receipts rather than authoritative active object-use scenes or continuous resident simulation.
- Distant residents resolve at schedule scale rather than walking every indoor step in real time.
- The first visible indoor routes use existing shell and room graphs; arbitrary navigation meshes do not exist yet.
- Exact private-room disclosure is intentionally unavailable remotely.
- Ordinary encounters are a bounded first set, not a complete dialogue engine.
- Visits use scoped grants rather than complete social hosting, keys, lease law, or guest-right systems.
- The game still lacks free-form exterior geometry, lifts/ramps, vehicles, transit, weather, large crowds, and high-detail 3D scenes.
- Current-environment visual verification used repeated raster canvas capture; live browser layout/motion QA for the new tab remains a named follow-up rather than a fake pass.
- Authority models are simulation contracts, not real housing, family, employment, or privacy law.

## Strongest next branch

**Lived Rooms and Object-Use Scenes v0.12** should make the existing rooms and deeply persistent objects visibly useful without creating a routine checklist.

First experiment:

```text
one student room
+ one shared bathroom
+ one small-house common room
+ one shop or institution
+ real object-use spots
+ sit/read/cook/repair/create/play/rest scenes
+ extend the existing low-graphic visual grammar with action-bound poses only after authoritative scene state exists
+ autonomous resident choices
+ visible or compressed parity
+ privacy and room authority
+ object-use history without daily chores
```

The merge gate remains strict: no perfect routine, no compulsory greetings, no watching reward, no object-use grind, no remote private-room surveillance, no direct control over autonomous residents, and no age pressure.
