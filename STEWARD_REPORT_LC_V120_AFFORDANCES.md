# Steward Report — LC-V120 Object-Use Affordances + Item Expansion

Date: 2026-08-23

Status: **REVIEW / NOT CANON**

Base: `codex/living-city-simulator-intake-v0.11.3`

Review branch: `steward/lc-v120-object-use-affordances`

## Current steward result

The review branch now combines grounded object-use, structural reachability auditing, a 24 -> 60 furniture catalogue expansion, increasingly Sims-like household object behavior, and a choice-driven furnishing rent pressure model. The authoritative world schema remains unchanged and existing saves are not silently repopulated.

## Functional household objects

The catalogue is no longer passive furniture-only content. Real placed objects unlock or ground bounded activities through the ordinary simulation clock/effects engine.

- TV -> Watch TV
- expanded laptops / compact computers / handheld -> Play
- expanded computers -> Study / Creative
- chairs / sofas -> Sit and unwind
- book / story shelves -> Browse books
- music players -> Listen to music
- lamps -> Read under the light
- plants -> optional care
- storage furniture -> optional browse / organize
- beds -> ordinary Sleep can record exact bed use
- kitchen objects -> ordinary home meal can record exact kitchen-object use
- home workbenches -> Repair at the home bench

Plant and storage interactions deliberately create no daily maintenance streak, cleanliness quota, failure state, or hidden reward path.

## Furnishing rent pressure instead of passive decay

Household objects no longer passively lose condition merely because simulation time passes. Economic choice pressure now comes from how much personal stuff the player chooses to keep placed while renting.

Rules:

- the first **6 placed personal objects** are the starter allowance and add no furnishing surcharge;
- additional placed personal objects add a small monthly amount based on item size and catalogue value;
- the surcharge is capped at **25% of the home's base rent**, with a small absolute cap floor so the formula remains bounded on unusual test rents;
- only the player's placed personal belongings count;
- roommate belongings, property fixtures and stored objects are excluded;
- storing an object lowers future furnishing pressure again;
- the property's actual `currentRent` is not mutated, so one tenant buying a sofa cannot silently raise every roommate's rent;
- owner-occupiers do not pay a furnishing-rent surcharge to themselves;
- the surcharge is settled on weekly rent boundaries and written visibly to the housing ledger;
- unpaid furnishing surcharge joins visible rent arrears but adds no second mood punishment and no late fee.

Purchasing, storing and replacing stored items return a housing-pressure receipt so the marginal monthly change is inspectable. The pressure summary is also exposed through simulation metrics for future UI and side-income systems.

This is intended to make furniture purchases meaningful without creating chore pressure: more stuff can make life nicer and unlock more activities, but a heavily furnished rented home asks for somewhat more income. Existing employed work and the local-economy `occasional_service` / enterprise paths can already offset that pressure, and later side-income additions can plug into the same economy rather than needing a separate mechanic.

## Home workbench correction

The generic `practice_repair` activity routes to the public repair workshop. The old object-use projection could imply that a home workbench grounded an activity that actually happened elsewhere.

That mismatch remains corrected:

- `workbench` / `maker_workbench` ground `repair_at_bench`;
- repair remains at the current home;
- public-workshop `practice_repair` remains separate;
- object-use no longer claims the public-workshop activity occurs at a home bench.

## Persistent-object evidence

Successful precise object use can add real `usageHours`, a small bounded sentimental/familiarity increment, and exact object identity in completed visual receipts when invoked through Living View. These are history/evidence-like consequences, not a second progression economy.

## Permission / truth boundaries

- other residents' personal objects are not silently treated as player-usable;
- property fixtures may remain usable where normal room access permits;
- inspection grants no execution authority;
- exact object approaches remain reachability-audited;
- room permission evidence remains separate from object ownership;
- visual feedback remains reward-neutral;
- no active-scene state is fabricated yet.

## Steward corrections retained

Issues found during stewardship remain visible rather than hidden:

1. an early reachability audit over-constrained coarse bathroom utility use; repaired with the test retained;
2. a proposed broad visual screen classifier was rejected because it could make TV imply computer actions; the exact verified `src/visuals.js` blob was restored;
3. an accidental temporary connector file was deleted and is absent from the final diff;
4. the first item-interaction CI attempt exposed a stale test module order after `item_interactions` became a required headless dependency; corrected;
5. home-workbench repair routing was found semantically wrong and split from public-workshop repair;
6. the first no-decay attempt was applied too early in module load order and one later simulation extension could still reduce object condition. The no-decay/rent-pressure layer was moved to the final simulation seam and the original failing test was retained.

## Verification

**Living City review tests #98: GREEN** on runtime head `2fdfe43425e28df1b488b8d0a001688b0425201c` before this receipt-only commit.

Verified gates:

- headless runtime intake: **17/17**
- expanded 60-item catalogue: **6/6**
- deep household item interactions: **14/14**
- furnishing rent pressure + no passive decay: **9/9**
- object-use affordances: **6/6**
- object-use reachability / permission audit: **6/6**
- complete focused simulation suite: **253/253**
- standalone one-file build smoke: **PASS**
- measured standalone size: **1,474,146 bytes**

Browser render/click QA remains a separate visual check and is not inferred from Node/build receipts.

## Still held for later

- authoritative active scene state
- interruption / resume
- autonomous resident object-use
- final permission resolver
- visible/compressed active-scene parity
- scene-driven character/object animation
- bespoke interactions for remaining purely decorative/specialized object types
- additional side-income directions beyond the existing local-enterprise foundation
- world-schema migration
- release / promotion / merge / CANON

The branch remains a draft review candidate for later local intake.
