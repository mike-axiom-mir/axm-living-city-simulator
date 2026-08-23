# Schema Reference — v0.11.0

Authoritative world:

- `schemas/world-v0.11.0.schema.json`
- `axm.living-city-sim.world/v0.11.0`

New v0.11 records:

- `schemas/lived-presence-v0.11.0.schema.json`
- `axm.living-city.lived-presence/v0.11.0`
- `schemas/indoor-movement-v0.11.0.schema.json`
- `axm.living-city.indoor-movement/v0.11.0`
- `schemas/ordinary-encounter-v0.11.0.schema.json`
- `axm.living-city.ordinary-encounter/v0.11.0`
- `schemas/presence-access-grant-v0.11.0.schema.json`
- `axm.living-city.presence-access-grant/v0.11.0`

v0.10 shell/frontage records remain authoritative inside v0.11 worlds:

- `building-shell-v0.10.0.schema.json`
- `frontage-proposal-v0.10.0.schema.json`
- `frontage-project-v0.10.0.schema.json`

Earlier versioned schemas remain included because the current world preserves household, habitat, stewardship, family, community, project, economy, exterior, travel, shell, and object records from their defining versions.

Final v0.11 validation target:

- 56/56 schema definitions;
- 11 exported worlds;
- 15,833 compatible records;
- current presence snapshots, indoor movement records, ordinary encounters, and bounded access grants validated independently.

See `tests/FINAL_SCHEMA_QA_OUTPUT_v0_11.txt` for exact counts.
