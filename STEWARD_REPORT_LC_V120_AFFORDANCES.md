# Steward Report — LC-V120 Object-Use Affordances + Item Expansion

Date: 2026-08-23

Status: **REVIEW / NOT CANON**

Base: `codex/living-city-simulator-intake-v0.11.3`

Review branch: `steward/lc-v120-object-use-affordances`

## Current steward result

The review branch now combines grounded object-use, structural reachability auditing, a 24 -> 60 furniture catalogue expansion, and real interaction behavior for expanded computers, handheld gaming and television. The authoritative world schema remains unchanged.

## 60-item catalogue

The original 24 items remain intact and 36 objects are added for **60 total** across seats, sleep, work/hobby, activity/electronics, lighting, storage, surfaces, decor and compact kitchen equipment.

Existing saves and starter rooms are **not silently repopulated**. Existing object ids, placement and history remain untouched.

## Real TV and computer interactions

A post-expansion cross-check found that catalogue depth had moved ahead of interaction depth:

- expanded laptops could appear as computer-like room objects, but the legacy Play action still hardcoded only `old_laptop` and `fast_computer`;
- study/creative use of expanded laptops did not record selected-object usage;
- `tv_screen` was buyable/placeable/upgradable furniture but had no simulation activity.

This is corrected through modular extension files rather than rewriting the large core systems file.

### Expanded computers / handheld

- `refurbished_laptop`, `compact_computer`, and `handheld_game_screen` ground and execute `play_device`.
- `refurbished_laptop` and `compact_computer` ground study and creative time.
- successful selected-device use records real `usageHours` and small bounded sentimental familiarity on that persistent object.
- legacy `old_laptop` / `fast_computer` `play_pc` behavior remains intact.

### TV

- `tv_screen` grounds and executes `watch_tv`.
- Watch TV advances the ordinary simulation clock for two hours and applies bounded leisure need effects through the ordinary activity engine.
- real persistent TV usage is recorded.
- no TV means the activity is rejected rather than invented.
- another resident's personal TV is not assumed usable without permission.
- TV is deliberately not treated as a study computer or generic PC-play device.

### Living View bridge

`src/item_visual_interactions.js` extends the public visual activity projection while leaving the previously verified large `src/visuals.js` source untouched:

- legacy PCs retain their existing Play option;
- expanded computers/handhelds receive precise Play-on-device options;
- TVs receive Watch TV;
- TV never gains Study or PC Play merely because it has a screen;
- exact object identity is retained for completed-action receipts.

## Object-use / authority boundaries

- exact object approaches remain structurally reachability-audited;
- room permission evidence remains advisory and separate from object ownership;
- inspection grants no execution authority;
- other-resident personal ownership is not silently overridden;
- visual feedback remains reward-neutral;
- item actions delegate their time/needs/skills simulation to the ordinary `Systems.performActivity` engine instead of creating a parallel progression path.

## Steward corrections retained

The branch keeps the issues found during stewardship visible rather than rewriting history:

1. an early reachability audit over-constrained coarse bathroom utility use; the model was repaired and the test retained;
2. a proposed broad visual screen classifier was rejected because it could make a TV imply computer actions; the exact previously verified `src/visuals.js` blob was restored;
3. an accidental temporary connector file was deleted and is absent from the final diff;
4. the first real-item CI attempt exposed a stale test module order after `item_interactions` became a required headless dependency; the test loader was corrected rather than bypassing the dependency.

## Verification

**Living City review tests #64: GREEN** on branch head `1f21582537d96b095f1638b0995572b2663f402b` before this receipt-only commit.

Verified gates:

- headless runtime intake: **17/17 checks passed**
- expanded 60-item catalogue: **6/6 tests passed**
- real TV / expanded-device interactions: **8/8 tests passed**
- object-use affordances: **6/6 tests passed**
- object-use reachability / permission audit: **6/6 tests passed**
- complete focused simulation suite: **238/238 tests passed**
- standalone one-file build smoke: **PASS**
- most recent measured standalone size from the identical runtime source: **1,456,907 bytes**

Browser render/click QA remains a separate visual check and is not inferred from Node/build receipts.

## Still held for later

- authoritative active scene state
- interruption / resume
- autonomous resident object-use
- final permission resolver
- visible/compressed active-scene parity
- scene-driven character/object animation
- broader interaction catalogue for every furniture/decor type
- world-schema migration
- release / promotion / merge / CANON

The branch remains a review candidate for later local intake.