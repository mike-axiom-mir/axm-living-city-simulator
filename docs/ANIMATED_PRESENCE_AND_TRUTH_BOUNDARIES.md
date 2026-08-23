# Animated Presence and Truth Boundaries — v0.11.1

## Purpose

The Animated Presence pass lets AXM Living City feel visibly alive before the later Lived Rooms simulation is built. It extends presentation without pretending that presentation is authoritative gameplay.

The governing split is:

```text
authoritative simulation facts
→ privacy-bounded visual derivation
→ optional pixels
→ no return path into authority
```

## What may be visualized

### Room

- the player’s persistent room graph and placed objects;
- the player when their lawful presence is that room;
- another person only when `AXM.Presence.visiblePresencesForPlayer` marks them exactly co-present;
- light and ambient motion derived from simulation time;
- a player-home room while away, clearly labeled as not current presence and containing no claimed present figure.

### Building

- real shell identity, storeys, windows, door, roof, and place count;
- current player level or an active bounded indoor route;
- aggregate occupant count.

It may not infer or draw a private occupant’s room.

### Street

- persistent exterior identity and address;
- the player when present or travelling;
- anonymous recent public route traces;
- time-of-day light and ambient clouds.

Anonymous route traces are atmosphere, not named live resident tracking.

## What animation does not mean

- A lamp glow does not prove somebody switched on a lamp.
- An idle pose does not prove a sit/read/rest action occurred.
- A moving trace does not create or change a travel record.
- Watching does not spend time, restore needs, increase skill, improve relationships, reveal information, or create rewards.
- Selecting Room, Building, or Street changes only UI preference.

Authoritative object-use actions remain the v0.12 branch and require their own scene record, permissions, duration, resource effects, privacy state, history, and visible/compressed parity.

## Motion policy

`Full` provides the complete low-graphic animation set. `Gentle` lowers update cadence and amplitude. `Still` draws one stable frame. A device-level reduced-motion preference also forces Still behavior.

No action is gated behind animation. Indoor and street compression remain authoritative and penalty-free.

## Determinism and state safety

The visual module uses stable hashes rather than `Core.nextRandom`. Scene derivation and canvas rendering must preserve:

- `world.rngState`;
- simulation time;
- needs, money, skills, relationships, and housing;
- presence, movement, encounter, and access records;
- object identity and position;
- authority flags and privacy coarsening.

`axm.living-city.visual-scene/v0.11.2` is an ephemeral runtime projection and is not added to the authoritative world schema. v0.11.2 also permits a success-only completed-moment receipt; its separate replay boundary is defined in `PLAYABLE_INTERIORS_AND_COMPLETED_MOMENT_ECHOES.md`.

## Merge gates for later animation work

1. Action-bound animation may begin only after an authoritative scene exists.
2. Visible and compressed resolution must retain equal outcome and cost.
3. Private rooms remain undisclosed remotely.
4. No continuous resident tracking is introduced to make animation easier.
5. Rendering remains replaceable and non-authoritative.
6. Still/reduced-motion support remains first-class.
7. Watching never becomes a progression strategy.
