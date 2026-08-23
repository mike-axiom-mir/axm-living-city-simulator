# Migration — v0.11.2 to v0.11.3

## Scope

This is a presentation and feedback patch. The authoritative world schema remains `axm.living-city-sim.world/v0.11.0`, and the visual projection identifiers remain v0.11.2.

## On current-save load

- The patch version advances to 0.11.3.
- Existing world, presence, room, object, household, family, community, project, economy, route, shell, and ledger records are retained.
- No earlier activity, room visit, focused object, effect delta, completed echo, permission, reward, or history is invented.
- Absent v0.11.3 presentation fields receive only safe UI defaults.
- Older ephemeral receipts without `observedEffects` remain readable but do not display fabricated changes.

## Authority and parity

Contextual activity continues to call the same `AXM.Systems.performActivity` path as ordinary activity. The new before/after comparison happens only after success and declares `noAddedEffect: true`. Room browsing, effect feedback, object focus, and the Build & Home bridge grant no new authority.

## Compatibility gate

A migration is invalid if it changes an existing authoritative record merely to make feedback look complete, infers active scene state from a completed echo, reveals a remote private room, or applies an activity effect twice.
