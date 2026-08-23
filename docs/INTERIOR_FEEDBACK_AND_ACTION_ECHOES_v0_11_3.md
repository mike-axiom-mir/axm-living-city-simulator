# Interior Feedback and Action Echoes — v0.11.3

## Purpose

v0.11.3 makes ordinary home activity easier to understand without creating a second simulation path. The authoritative activity runs once. Only after success does the presentation layer compare a bounded before/after snapshot and explain the differences it actually observed.

## Effect receipt contract

New completed-activity receipts may include:

```text
observedEffects.effectsObserved = true
observedEffects.effectScope = player_and_selected_home_context
observedEffects.noAddedEffect = true
observedEffects.timeMinutes = finite non-negative number
```

Optional measured values include money, player needs, player skills, current-home condition, and the selected object's condition, sentiment, and usage. Zero or absent values are not presented as progress. Background autonomous changes remain attributable through the ordinary ledger because the bounded card does not claim to summarize the whole city.

The receipt remains ephemeral `axm.living-city.visual-activity-receipt/v0.11.2`. This is a compatible extension rather than a world-schema migration.

## Truth boundary

```text
capture bounded before state
→ call AXM.Systems.performActivity
→ ordinary engine validates and applies all effects
→ capture bounded after state
→ compare numeric values
→ draw factual feedback and completed echo
```

The comparison does not write money, needs, skills, object history, room state, relationships, presence, rewards, access, or authority. A failed activity creates no success receipt. A legacy receipt with no `observedEffects` remains valid and produces no fabricated delta card.

## Focused objects

The selected object must belong to the browsed real room. Living View may show its name, kind, condition, sentiment, usage hours, and history-entry count. **Open in Build & Home** changes UI focus to that existing object; it does not grant edit permission, ownership, storage rights, construction authority, or access to another resident.

## Context sense

Activity options remain suggestions, not a routine score. v0.11.3 adds an exclusion rule so bathroom rooms do not offer eating, computer play, study, or creative work even when legacy generation placed a table or laptop there. A basic meal may be offered from a living-room/home context; that does not claim a dedicated kitchen object exists in every seed.

## Action echoes

The completed echoes remain explicitly labeled as visual echoes, not current presence. Distinct low-graphic grammars now cover:

- sleep;
- shower/bathroom use;
- eat at home;
- computer play;
- practical study;
- small creative work;
- clean and maintain home.

Full motion advances each echo, Gentle reduces movement, and Still produces a stable frame. Watching grants no better outcome.

## Deferred to v0.12

v0.11.3 has no authoritative actor pose, remaining duration, interrupt/resume state, autonomous live object-use choice, or visible/compressed active-scene parity. Those require an explicit scene record and permission/privacy gate; they must not be inferred from this feedback layer.
