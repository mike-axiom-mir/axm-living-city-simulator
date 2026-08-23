# Migration Contract — v0.8.0 to v0.9.0

## Source

`axm.living-city-sim.world/v0.8.0`

## Target

`axm.living-city-sim.world/v0.9.0`

## Preserved without reinterpretation

- player and autonomous residents;
- money, needs, skills, relationships, jobs, and housing;
- properties, ownership, tenancy, occupancy, and objects;
- household agreements and issues;
- structural habitats and projects;
- stewardship intentions, requests, escrow, and history;
- family units, care, education, and chapter choices;
- community institutions, opportunities, connections, and adventures;
- personal directions and object provenance;
- enterprises, premises, customers, workers, equipment, and economy history;
- choice-first settings and frozen ages.

## Added as current derivable infrastructure

- `time.minute`, defaulting to `0` when absent;
- one exterior identity for every current place;
- one current street network from existing map geometry;
- empty travel and street-moment collections;
- exterior counters/state;
- travel metrics;
- `defaultTravelMode`;
- `travelCompressionAllowed: true`;
- `walkingObligation: false`.

## Not fabricated

Migration does not invent:

- previous routes;
- prior distances or walking minutes;
- street encounters;
- achievements;
- walking streaks;
- commute failures;
- earlier exterior renovations;
- ownership or access authority.

The network describes the current world. It does not rewrite the world’s past.
