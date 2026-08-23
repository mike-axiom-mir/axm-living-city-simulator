# Steward Report — LC-V120 Object-Use Affordances + Item Expansion

Date: 2026-08-23

Status: **REVIEW / NOT CANON**

Base: `codex/living-city-simulator-intake-v0.11.3`

Review branch: `steward/lc-v120-object-use-affordances`

## Current steward result

The review branch now combines grounded object-use, structural reachability auditing, a 24 -> 60 furniture catalogue expansion, and increasingly Sims-like household object behavior. The authoritative world schema remains unchanged and existing saves are not silently repopulated.

## Functional household objects

The catalogue is no longer treated as passive furniture-only content. Real placed objects now unlock or ground bounded activities through the ordinary simulation clock/effects engine.

### Electronics

- `tv_screen` -> Watch TV
- `refurbished_laptop`, `compact_computer`, `handheld_game_screen` -> Play on device
- expanded computers -> Study / Creative time
- `music_player`, `record_music_player` -> Listen to music
- legacy `old_laptop` / `fast_computer` Play behavior remains intact

TV remains explicitly separate from computer semantics: it does not become a Study or PC-play object merely because it has a screen.

### Furniture / home life

- chairs and sofas -> Sit and unwind
- beds -> ordinary Sleep can retain exact selected-bed usage evidence
- book/story shelves -> Browse some books
- lamps -> Read under the light
- house plants -> optional Care for the plant
- shelves / wardrobes / chests / drawers -> optional Browse and organize
- kitchen objects -> ordinary home meal can retain exact selected-kitchen-object usage evidence
- study/creative surfaces -> exact selected-object usage can be retained where the object genuinely supports that action

Plant and storage interactions deliberately create **no daily maintenance streak, cleanliness quota, failure state, or hidden reward path**.

### Home workbench correction

The earlier generic `practice_repair` activity routes to the public repair workshop. The old object-use projection could therefore imply that a home workbench grounded an activity that actually teleported the player elsewhere.

That mismatch is corrected:

- `workbench` / `maker_workbench` now ground `repair_at_bench`;
- the repair occurs at the current home through the ordinary activity engine;
- the public-workshop `practice_repair` activity remains separate;
- object-use no longer claims the public-workshop activity is happening at a home bench.

## Persistent-object evidence

Successful precise object use can add:

- real `usageHours` to the persistent object;
- a small bounded sentimental/familiarity increment;
- exact object identity in completed visual receipts when invoked through Living View.

These are evidence/history-like consequences of choosing an object, not a second progression economy.

## Permission / truth boundaries

- other residents' personal objects are not silently treated as player-usable;
- property fixtures may remain usable where normal room access permits;
- inspection grants no execution authority;
- exact object approaches remain reachability-audited;
- room permission evidence remains separate from object ownership;
- visual feedback remains reward-neutral;
- no active-scene state is fabricated yet.

## Steward corrections retained

Issues found during stewardship remain visible rather than being hidden:

1. an early reachability audit over-constrained coarse bathroom utility use; repaired with the test retained;
2. a proposed broad visual screen classifier was rejected because it could make TV imply computer actions; the exact verified `src/visuals.js` blob was restored;
3. an accidental temporary connector file was deleted and is absent from the final diff;
4. the first item-interaction CI attempt exposed a stale test module order after `item_interactions` became a required headless dependency; the loader expectation was corrected;
5. home-workbench repair routing was found semantically wrong and split from public-workshop repair rather than papered over.

## Verification

**Living City review tests #74: GREEN** on runtime head `effc42c556172476f13849957f535fc04f38de9f` before this receipt-only commit.

Verified gates:

- headless runtime intake: **17/17**
- expanded 60-item catalogue: **6/6**
- deep household item interactions: **14/14**
- object-use affordances: **6/6**
- object-use reachability / permission audit: **6/6**
- complete focused simulation suite: **244/244**
- standalone one-file build smoke: **PASS**
- measured standalone size: **1,464,579 bytes**

Browser render/click QA remains a separate visual check and is not inferred from Node/build receipts.

## Still held for later

- authoritative active scene state
- interruption / resume
- autonomous resident object-use
- final permission resolver
- visible/compressed active-scene parity
- scene-driven character/object animation
- bespoke interactions for remaining purely decorative/specialized object types
- world-schema migration
- release / promotion / merge / CANON

The branch remains a draft review candidate for later local intake.
