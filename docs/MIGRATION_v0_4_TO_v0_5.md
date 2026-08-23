# Migration Contract — v0.4.0 to v0.5.0

## Source

```text
axm.living-city-sim.world/v0.4.0
```

## Target

```text
axm.living-city-sim.world/v0.5.0
```

## What migration adds

Top-level state:

```text
familyUnits: []
familyProposals: []
careRecords: []
```

UI state:

```text
selectedFamilyUnitId
selectedFamilyProposalId
selectedDependentId
```

Flags/metrics:

```text
familyExperimentPrepared
familyProposalsCreated
familyProposalsAccepted
familyProposalsDeclined
familyUnitsCreated
dependentsWelcomed
careActions
careHoursPlayer
careHoursPartner
careHoursCommunity
careNeedsMetDays
careStrainDays
educationDays
familyRelocations
familySeparations
lifeStageTransitions
adultChildrenLaunched
familySupportSpend
familyEnvironmentUpdates
```

Every existing person receives a life-course record inferred from their existing age and a deterministic birthday offset.

## What migration preserves

- world seed and RNG state;
- time;
- player and residents;
- relationships;
- jobs, money, needs, skills, possessions, and storage;
- properties, ownership, tenancy, occupancy, and rent;
- furniture IDs, ownership, finishes, condition, upgrades, sentiment, and history;
- adult household agreements, proposals, issues, and histories;
- structural habitats, rooms, permissions, utilities, projects, and histories;
- stewardship intentions, requests, escrow, owner policy, and property histories;
- ledger and metrics;
- UI/settings where compatible.

## What migration must not invent

Migration does not infer:

- that a partner is a parent;
- that cohabiting adults have children;
- a dependent from age gaps or surnames;
- an accepted parenthood/care/education plan;
- a family unit;
- a room assignment;
- dependent objects;
- historical care records;
- past birthdays or stage transitions;
- custody, guardianship, or legal status.

This remains true even when two adults are cohabiting and have a strong romantic relationship.

## Life-course provenance

Migrated record example:

```json
{
  "schema": "axm.living-city.life-course/v0.5.0",
  "ageDays": 15742,
  "ageYears": 43,
  "stage": "adult",
  "birthdayOffset": 47,
  "stageEnteredDay": 1,
  "transitionHistory": [],
  "provenance": "deterministically inferred from existing age without inventing family ties"
}
```

The exact `ageDays` includes the prior integer age plus deterministic offset. It is a continuity mechanism, not reconstructed biography.

## Validation

After migration:

- world schema must be v0.5.0;
- every person must have a valid life-course record;
- family arrays must exist and be valid arrays;
- no family member links may exist unless the source world already had an explicit future-compatible record;
- all previous object/household/habitat/stewardship invariants must still pass.

Migration failures are reported. Corrupt evidence is not silently rewritten into a plausible family history.

## Storage keys

Current autosave key:

```text
axm.living-city-sim.autosave.v0.5.0
```

Legacy keys v0.1–v0.4 are checked explicitly. A successful import/export should be used as the durable portable checkpoint rather than relying only on browser storage.
