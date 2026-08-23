# Playable Interiors and Completed-Moment Echoes — v0.11.2

## Purpose

v0.11.2 makes the existing Living View easier and more enjoyable to play without claiming the full authoritative object-use scene system reserved for v0.12.

The player can now browse the rooms of their current home, focus a persistent object, and choose a small set of activities grounded in that room. The choice is routed through the existing `AXM.Systems.performActivity` engine. Only a successful completed activity may produce a short visual receipt.

## Interaction flow

```text
select a real room
→ inspect its persistent objects
→ choose an activity already supported by the simulation
→ existing activity engine validates and completes it
→ authoritative time and need effects occur once
→ optional completed-moment echo is shown
```

The room panel is a contextual doorway into existing simulation actions. It is not a second activity engine and does not offer better outcomes than the ordinary controls.

## Room browsing

- **Room mode** shows a selected room in the player's current home.
- **Follow presence** still follows the player's actual lawful presence.
- Browsing another room never moves the player and never places a current actor there.
- A selected object must belong to the selected room.
- Exact other people remain subject to the existing lawful co-presence disclosure rules.

Room browsing is therefore presentation state, not location state.

## Contextual activity choices

Activities are offered only where existing room purpose or object kind provides a grounded affordance. Examples include:

| Activity | Grounding |
|---|---|
| Sleep | bed in a sleep room |
| Shower | bathroom and water fixture |
| Eat at home | kitchen fixture |
| Play on the computer | screen/computer object |
| Study or create | suitable work room or table/screen/storage object |
| Clean home | a home room, using the existing whole-home care action |

The mapping is intentionally small and legible. It does not define a perfect routine, one best furniture arrangement, or a daily obligation.

## Completed-moment receipt

The visual receipt schema is `axm.living-city.visual-activity-receipt/v0.11.2`.

A receipt may exist only when:

- the activity engine returned success;
- the requested room belongs to the player's current home;
- the selected object, when present, belongs to that room;
- the receipt identifies itself as `source: "completed_activity"`;
- `notCurrentPresence` and `noExtraReward` are true.

The receipt is a presentation trace. It is deliberately labeled as a completed visual echo, never as live actor presence. It gives no additional time, need, skill, money, relationship, object, authority, or progression effect.

## Visual grammar

The room canvas now adds:

- clearer separation of persistent furniture;
- selected-object focus rings and labels;
- modest room-purpose finishes;
- richer bounded motion for beds, screens, tables, kitchens, and water fixtures;
- short after-the-fact poses for sleep, shower, cleaning, and generic completed activities.

Full, Gentle, Still, and device reduced-motion policies remain active. Still mode remains stable.

## What remains held for v0.12

v0.11.2 does not create an authoritative active scene with actor, object, start time, remaining duration, interruption state, autonomous choice, privacy state, and visible/compressed parity. It also does not continuously animate autonomous residents using private objects.

Those are the merge gates for **Lived Rooms and Object-Use Scenes v0.12**. A completed echo must not be promoted into current scene truth.

