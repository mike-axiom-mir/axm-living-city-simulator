# Machine Handoff — AXM Living City Interior Feedback v0.11.3

## Package identity

`AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3`

Authoritative world schema: `axm.living-city-sim.world/v0.11.0`

Standalone: `standalone/AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html`

## Read first

1. `DESIGN_ROOTS.md`
2. `CURRENT_BUILD_STATUS.md`
3. `ACTION_REPORT.md`
4. `docs/INTERIOR_FEEDBACK_AND_ACTION_ECHOES_v0_11_3.md`
5. `docs/MIGRATION_v0_11_2_TO_v0_11_3.md`
6. `docs/PLAYABLE_INTERIORS_AND_COMPLETED_MOMENT_ECHOES.md`
7. `tests/FINAL_TEST_RESULTS_v0_11_3.txt`
8. `tests/LIVE_VISUAL_VERIFICATION_RECEIPT_v0_11_3.txt`
9. `HANDOFF/CONTINUITY_RECEIPT_v0_11_3.txt`
10. `CONTINUATION_PROMPT.md`

## Required source order

`core → content → world → systems → households → habitats → stewardship → family → community → directions → economy → exteriors → shells → presence → visuals → game → ui`

`presence` loads after systems/habitats/exteriors/shells. `visuals` loads after presence and before game/UI.

## v0.11.3 effect-feedback boundary

The stable receipt schema remains `axm.living-city.visual-activity-receipt/v0.11.2`. New successful contextual activities may add `observedEffects`.

```text
bounded before snapshot
→ AXM.Systems.performActivity once
→ bounded after snapshot
→ numeric delta comparison
→ presentation-only feedback
```

Required truths:

- `effectsObserved: true` means values were compared, not applied by the receipt.
- `effectScope` is `player_and_selected_home_context`.
- `noAddedEffect` remains true.
- Wider autonomous evolution stays in the ordinary ledger.
- Older receipts without the payload remain valid and display no invented deltas.
- The feedback card and completed echo are not current presence or active scene state.

## Context and object details

- A focused object must belong to the selected real room.
- The detail panel reports persistent identity fields and may open that object in Build & Home.
- The bridge grants no ownership, storage, edit, construction, access, or resident authority.
- Bathroom context excludes eating, computer play, study, and creative work even if legacy objects are oddly placed there.
- A basic meal may be offered from grounded home/common-room context; do not claim every seed has a kitchen fixture.

## Verification state

- Focused: 212/212 PASS.
- Long stress: all ten commands PASS.
- Examples: PASS.
- Repeated-frame action motion, Still stability, and state isolation: PASS.
- Browser DOM/focus/responsive: UNKNOWN; Python Playwright missing.
- Fresh schema validation: UNKNOWN; Python `jsonschema` missing and schemas unchanged.

## Merge gates

- one directly controlled character and autonomous residents;
- choice-first life and `agePressure: false`;
- presence and observation create no wider authority;
- exact private-room disclosure requires lawful co-presence;
- visible/compressed parity and no watching reward;
- contextual actions call the authoritative activity engine exactly once;
- effect feedback reports, never creates;
- object identity survives use, repair, upgrade, and display;
- no routine checklist, optimal-room score, or bathroom nonsense;
- diagnostic-only validation, deterministic replay, and inspectable local export.

## Strongest next branch

`LC-V120-LIVED-ROOMS`: add authoritative active object-use scenes with duration, interruption, privacy, object permission, autonomous choice, and visible/compressed parity beneath the existing visual grammar.

Do not promote v0.11.3 receipts or echoes into that state by inference.
