# Migration Contract — v0.9.0 to v0.10.0

## Accepted source

World schema:

`axm.living-city-sim.world/v0.9.0`

Migrated target:

`axm.living-city-sim.world/v0.10.0`

## Preserved without reinterpretation

Migration preserves existing:

- world seed and deterministic core state;
- player and autonomous residents;
- exact money, needs, skills, relationships, jobs, schedules, and locations;
- homes, ownership, tenancy, rent, fixtures, personal objects, storage, and object histories;
- household agreements, proposals, issues, finance, room permissions, and separation evidence;
- structural habitats, rooms, doors, walls, utilities, projects, and histories;
- stewardship intentions, escrow, owner decisions, and construction evidence;
- family units, dependents, care, education, and choice-first life-course records;
- community institutions, visits, invitations, connections, and adventures;
- personal directions and object provenance;
- enterprises, customers, workers, equipment, premises, and local-need records;
- v0.9 exteriors, addresses, street graph, travel records, street moments, and minute time;
- ledger, metrics, flags, and export history.

## Present-day derivation allowed

v0.10 may derive current building shells because current places already contain enough present-state evidence:

- stable IDs;
- map rectangles;
- exterior entrances;
- place kind/type;
- current structural habitat entry rooms;
- world seed.

The migration may create:

- current `world.buildings`;
- one current `place.shellRef` per place;
- current storey/wall/opening graphs;
- current street-to-unit route networks;
- current roof and frontage baseline state;
- current continuity links;
- empty proposal/project arrays when none exist;
- shell settings, counters, UI selectors, flags, metrics, and isolated RNG state.

## History migration must not invent

Migration must not fabricate:

- prior shell construction dates;
- past storey additions;
- historical stair use;
- old frontage proposals;
- resident approvals or refusals;
- resident savings or material purchases;
- completed frontage projects;
- façade repair streaks;
- exterior scores;
- prior owner/tenant disputes;
- past accessibility work;
- weather damage or maintenance debt.

The shell foundation history may state that present-day geometry was deterministically derived during v0.10 migration. It may not pretend that the building was constructed during play.

## Choice-first and casual settings

Migration enforces the existing protected roots:

```json
{
  "agePressure": false,
  "walkingObligation": false,
  "travelCompressionAllowed": true,
  "facadeMaintenanceObligation": false,
  "frontageDailyDecay": false,
  "exteriorOptimizationScore": false
}
```

This is schema/root normalization, not invented player history.

## Current-save round trip

A valid v0.10 save exported and imported without mutation must preserve:

- serialized shell state;
- proposal/project state;
- shell RNG state;
- route/continuity references;
- frontage revisions and history;
- every earlier subsystem.

Focused tests compare the current serialized world before and after round trip.

## Corruption handling

Validation diagnoses broken shell pointers, duplicate assignments, invalid wall/opening references, inaccessible storeys, invalid proposal/project records, and forbidden chore flags.

Validation does not call migration, `ensureState`, or silent repair. A corrupt v0.10 record remains corrupt until an explicit repair/migration action is chosen outside validation.
