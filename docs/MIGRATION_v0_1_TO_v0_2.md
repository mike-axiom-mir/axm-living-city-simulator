# Migration — World v0.1.0 to v0.2.0

## Why migration is explicit

v0.2 adds household records whose meaning depends on consent. A simple schema-string replacement would be unsafe because a v0.1 relationship label such as `partner` does not prove that the new finance, space, relocation, renovation, and dissolution terms were accepted.

## Accepted source

`axm.living-city-sim.world/v0.1.0`

## Produced destination

`axm.living-city-sim.world/v0.2.0`

## Deterministic transform

The migrator:

1. deep-clones the parsed source;
2. initializes `households`, `householdProposals`, and `householdIssues` as empty arrays;
3. adds null `householdId` and storage/initiative defaults to people;
4. adds property `rentBasis`, `utilitiesIncluded`, and `weeklyUtilityBase` defaults;
5. adds household metrics, UI selection fields, and experiment flag;
6. updates schema/version;
7. appends a migration ledger entry;
8. validates the complete result before it can become active state.

## Consent rule

The migrator never manufactures a v0.2 household agreement from a legacy relationship. Existing relationship values remain visible, including `partner`, so no prior state is silently erased. The ledger explicitly says that no household consent agreement was invented.

## Autosave behavior

The current runtime checks the v0.2 autosave key first and the v0.1 key second. When a valid legacy save is migrated, it writes the v0.2 copy under the new key and leaves the original v0.1 key intact as backup.

## Failure behavior

Unsupported schemas, malformed JSON, or invalid migrated state are rejected. The runtime does not delete unknown fields, regenerate residents, move objects, or silently rebuild the world to make it pass.

## Test evidence

`testLegacyMigrationIsExplicitAndNoConsentIsInvented` builds a v0.1-shaped world containing a legacy `partner` relationship, migrates it, and verifies:

- current schema/version;
- valid current world;
- no household created;
- relationship label preserved;
- migration evidence present.
