# Migration v0.10 → v0.11

## Input

A valid `axm.living-city-sim.world/v0.10.0` world.

## Derived current state

Migration may derive:

- one current presence snapshot per person;
- current threshold/room/coarse-private state from lawful current location;
- current building/storey/entry references from existing v0.10 shells;
- default privacy/no-obligation settings and zeroed metrics;
- empty current v0.11 record collections.

## Forbidden invention

Migration may not fabricate:

- earlier arrivals, departures, stair use, or room transitions;
- exact private-room history;
- ordinary encounters, greetings, quiet responses, refusals, or passes;
- visit/access grants;
- rewards for watching;
- surveillance or wider authority;
- relationship effects;
- player accomplishments.

## Current-save preservation

A valid v0.11 save must round-trip exactly. Migration/initialization may fill only genuinely absent legacy fields; it must not normalize valid current evidence to a different address, room, or bookkeeping value.

## Failure behavior

Malformed data is rejected or diagnosed. Validation does not silently repair it.
