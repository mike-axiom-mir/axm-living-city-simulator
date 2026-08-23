# Source Provenance — AXM Living City v0.11.3

## v0.11.3 steward source

v0.11.3 branches explicitly from the sealed local v0.11.2 source as `AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3`. It extends post-activity feedback, focused-object detail, contextual suggestion sense, completed-action drawing, documentation, and QA. It does not replace or regenerate the v0.11 simulation, and the sealed v0.11.2 source remains untouched at its separate source path.

The authoritative world schema remains `axm.living-city-sim.world/v0.11.0`. The stable visual scene and receipt projections remain v0.11.2; new receipts may carry backward-compatible optional measured effects. No legacy receipt receives fabricated deltas.

## v0.11.2 steward source

v0.11.2 branches explicitly from the sealed local v0.11.1 source as `AXM_LIVING_CITY_SIM_PLAYABLE_INTERIORS_v0_11_2`. It extends the Living View, ordinary activity integration, documentation, and QA; it does not replace or regenerate the v0.11 simulation.

The authoritative world schema remains `axm.living-city-sim.world/v0.11.0`. New visual scene and completed-moment receipt objects are ephemeral runtime projections.

## v0.11.1 steward source

This patch was extended from the canonical `AXM_LIVING_CITY_SIM_CURRENT_HANDOFF_v0_11_0.zip` supplied alongside the full history archive.

- input handoff SHA-256: `4f6f05733e3a28ac8edc64480b2a5c09854f0a77a456b16a7719f86449b9de71`;
- the separately supplied handoff and the copy sealed inside `AXM_LIVING_CITY_SIM_FULL_HISTORY_ARCHIVE_v0_11_0.zip` were byte-identical;
- both supplied outer ZIPs passed compressed-data integrity tests before extraction;
- v0.11.0 remains recoverable and unchanged in the supplied history archive;
- v0.11.1 branches explicitly as `AXM_LIVING_CITY_SIM_ANIMATED_PRESENCE_v0_11_1`.

The original v0.11 provenance follows below.

Current package ID:

`AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3`

## Direct lineage

v0.11 is an explicit extension of the packaged v0.10 Building Shells, Storeys, and Resident-Authored Frontages foundation. It preserves the earlier source and adds `src/presence.js`, four presence schemas, the explicit v0.10 → v0.11 migration, examples, UI, focused/stress/browser tests, and documentation.

The v0.10 game was not silently replaced by a detached presence demo or surveillance-oriented architecture.

## Authored package content

The code, deterministic data, documentation, generated examples, schemas, tests, and low-graphic UI in this package were created for the AXM Living City branch.

No external runtime library is bundled into the standalone game. Python Playwright and Chromium are used only by QA and are not required by the game.

## Deterministic derivation

Current presence derives from:

- stable player/resident IDs;
- current lawful location and tenancy;
- public/scheduled place access;
- accepted bounded grants;
- existing exterior street thresholds;
- existing shell/storey/stair/unit routes;
- existing habitat room and permission graphs;
- separate deterministic presence decisions where variation is needed.

## Privacy/source integrity

The authoritative simulation may retain coarse internal presence needed for schedules and continuity. The player-facing disclosure layer intentionally withholds exact remote private-room state. Internal truth is not treated as automatic user visibility.

## Migration honesty

v0.10 saves receive current snapshots derived from present state. They do not receive invented earlier arrivals, departures, room visits, encounters, greetings, refusals, grants, surveillance, or rewards.

## Evidence provenance

- Focused presence source: `tests/lived_buildings_test.js`
- Focused visual source: `tests/visual_presence_test.js`
- Focused playable-interior source: `tests/playable_interiors_test.js`
- Presence stress source: `tests/lived_buildings_stress_test.js`
- Completed stress output: `tests/LIVED_BUILDINGS_STRESS_RESULTS_v0_11.txt`
- Schema output: `tests/FINAL_SCHEMA_QA_OUTPUT_v0_11.txt`
- Broad browser output: `tests/FINAL_BROWSER_QA_OUTPUT_v0_11.txt`
- Targeted presence browser: `tests/lived_buildings_browser_test.py`
- Broad screenshots: `tests/output_v0_11_screenshots/`
- Targeted screenshots: `tests/output_v0_11_targeted/`
- Current final report: `tests/FINAL_TEST_RESULTS_v0_11_3.json`
- Current visual digest: `tests/VISUAL_FRAME_DIGESTS_v0_11_3.json`
- Current continuity receipt: `HANDOFF/CONTINUITY_RECEIPT_v0_11_3.txt`
- Package integrity: `CHECKSUMS_SHA256.txt`
