# Migration — World v0.2.0 to v0.3.0

## Current target

`axm.living-city-sim.world/v0.3.0`

## Entry condition

Only known legacy schemas enter the migration path. A malformed current-schema world is not treated as legacy and silently repaired.

## Added state

Migration adds or normalizes:

- structural habitat records for every residential property;
- partitions, rooms, door connections, finishes, utilities, condition, layout hash, projects, and history;
- habitat metrics and UI selections;
- graph-based room permissions for active cohabiting households;
- `roomGraphRevision`;
- room-purpose provenance.

## Initial structure

The adapter derives deterministic starter partitions from the property grid/known facilities. It does not claim those walls were historically player-built. Habitat history marks initialization/migration.

Existing furniture IDs and positions are tested against the new room/utility contract. A personal object that cannot legally remain is owner-stored; it is not deleted or transferred.

## Zone mapping

Legacy rectangular permission zones are copied into `legacyZones`/migration evidence. Actual rooms are assigned holder patterns based on overlap and required shared facilities.

The adapter does not fabricate a partner or agreement. Only an already valid cohabiting household receives a graph permission projection.

## Consent and ownership protections

Migration does not invent:

- commitment or cohabitation acceptance;
- authority for a pending renovation;
- property ownership;
- landlord consent;
- a jointly approved room purpose;
- completed construction;
- money/material spend;
- a response to any proposal.

## Purpose provenance

Migrated/inferred room labels receive non-player provenance. An explicit v0.3 player choice is never inferred retroactively.

## Utilities

Known bathroom/kitchen facilities justify initial utility access in their rooms. Other services are not granted merely because a room would benefit from them.

## Validation

After migration the complete world runs through current validation. Failure rejects the import with readable errors. Migration evidence is appended to the ledger and habitat history.

## Rollback expectation

Keep the original exported v0.2 JSON outside the game before a major local intake. The v0.3 runtime exports only current schema after successful migration; it does not downgrade a v0.3 room graph back into v0.2 rectangles.
