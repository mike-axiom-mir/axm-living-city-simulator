# Building Shells and Storey Continuity — v0.10.0

## Purpose

This contract connects the v0.9 street/exterior layer to the v0.3+ structural habitat layer without replacing either one.

A **place** remains the established simulation location: a home, workplace, institution, park edge, shop, or commercial room. A **building shell** is the low-graphic physical envelope that one or more places occupy.

The shell answers questions the previous layers could not answer cleanly:

- Which places are in the same building?
- Which storey contains each place?
- Does an upper-floor unit have a real vertical route?
- Which wall edge contains an external door or window?
- Can the street entrance reach the correct unit and existing interior entry room?
- Does a frontage change preserve the building/place identity?

It does not invent a right to enter, edit, own, rent, supervise, or control anyone.

## Authoritative records

### Building shell

Schema: `axm.living-city.building-shell/v0.10.0`

A shell contains:

- stable `id`, `name`, and `type`;
- `placeIds` assigned to that shell;
- map-derived footprint;
- front side;
- storeys;
- vertical links;
- internal route network;
- external access nodes;
- per-place frontage state;
- interior continuity records;
- roof identity;
- revision and append-only bounded history.

### Place pointer

Each current place receives a `shellRef`:

- `buildingId`;
- primary storey ID;
- all storey IDs used by that place;
- unit route node;
- street access node.

Every place must appear in exactly one shell. Validation diagnoses missing, duplicate, or mismatched assignments without silently rebuilding the world.

## Deterministic derivation

Present-day shell geometry is derived from stable current facts:

- world seed;
- place ID;
- place map rectangle;
- existing exterior entrance side and identity;
- place kind/type;
- explicit v0.10 group definitions where two existing places are known to share one building.

Owner, tenant, customer, worker, or visitor identity is not used as the shell seed. People may change while the place remains itself.

A separate `shellRngState` isolates shell/frontage variation from family, community, housing, directions, economy, and travel random streams. Adding a frontage decision must not change an unrelated relationship outcome merely by consuming another subsystem’s random number.

## First shared multi-storey building

`building_courtyard_walkup` groups:

- `home_courtyard_1` on the ground floor;
- `home_courtyard_2` on the upper floor.

It contains:

- one ground landing;
- one upper landing;
- one stair edge;
- one unit entry per apartment;
- separate external access records;
- a route from street access to each unit.

This proves that two existing places can share one stable building identity without merging their tenancy, interiors, objects, permissions, rent, or histories.

## Storey wall graph

Each current storey uses a deliberately simple closed envelope:

- four corner nodes;
- north, east, south, and west exterior wall edges;
- deterministic metric dimensions;
- openings attached to specific edge IDs.

This is the strongest grounded low-graphic first layer. It is not represented as arbitrary polygonal architecture, because the current game does not yet need that complexity to prove continuity and authority.

### Openings

Current opening types:

- `window`;
- `external_door`.

An opening stores its wall edge, dimensions, offset, and source-place evidence. An opening that references a missing edge is invalid.

## Internal building route graph

A building route graph may contain:

- `street_access` nodes;
- `landing` nodes;
- `place_entry` nodes;
- `entry_passage` edges;
- `stairs` edges;
- `unit_entry` edges.

For each place, the engine must find a route from its assigned street-access node to its unit-entry node. A multi-storey building must contain at least one vertical route.

The route is intentionally small and deterministic. It grounds spatial continuity without forcing the simulation to animate every resident step or calculate a detailed physics path.

## Interior continuity

Each shell stores a per-place continuity record linking:

- exterior door node;
- street access node;
- unit route node;
- primary storey;
- current structural habitat entry room when the place is residential.

The source block records the exterior and habitat schema versions. The migration note explicitly says that v0.10 links current state; it does not fabricate a historical construction sequence.

## Roof identity

A roof currently records:

- style inherited from exterior identity;
- deterministic material;
- current descriptive condition;
- source evidence;
- `maintenanceObligation: false`.

Roof condition is not a hidden decay timer, repair streak, failure countdown, or optimization score. A future weather/repair layer must pass a new merge gate before it can turn descriptive state into consequence.

## Validation invariants

A valid v0.10 shell foundation requires:

1. Every building uses the v0.10 shell schema.
2. Building IDs are unique.
3. Every place is assigned exactly once.
4. Each place pointer matches its actual building.
5. Every storey has a closed four-edge shell.
6. Every opening references a real wall edge.
7. Every internal route edge references real nodes.
8. Every multi-storey shell has a vertical route.
9. Every place has an interior continuity record.
10. Every place has a frontage state.
11. Every residential continuity record references a real habitat room.
12. Every place can route from its street access to its unit entry.
13. Validation only diagnoses; it does not call normalization or silently repair corruption.

## Current limits

- Four-edge envelopes only.
- No exterior room extensions, balconies, yards, foundations, basements, terrain cuts, or arbitrary footprints.
- Stairs are route evidence rather than detailed geometry.
- No lift/ramp alternative yet; the current stair record explicitly marks that limitation.
- Interior residents are not yet continuously located in individual rooms.
- Public open-space shells are identity edges rather than enclosed architecture.

These limits are deliberate boundaries, not hidden claims.
