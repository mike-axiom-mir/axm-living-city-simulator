# Migration Contract — v0.5 to v0.6

## Source

```text
axm.living-city-sim/world/v0.5.0
```

## Target

```text
axm.living-city-sim/world/v0.6.0
```

## Preserved exactly

Migration preserves existing:

- player and NPC identities;
- money, needs, skills, traits, and relationships;
- jobs and schedules;
- homes, occupancy, ownership, rent, and listings;
- furniture, fixtures, storage, upgrades, and object provenance;
- adult household agreements, proposals, issues, and histories;
- structural habitats, room graphs, utilities, permissions, and projects;
- stewardship intentions, requests, escrow, and property histories;
- family units, life-course records, care records, proposals, and room assignments;
- world time, seed, ledger, and existing metrics.

## Added present-day infrastructure

Migration adds:

- `settings.casualRealism = true` unless an explicit compatible value exists;
- `settings.noDailyStreaks = true`;
- `settings.opportunityExpiryPenalty = false`;
- five deterministic community institutions;
- community metric fields;
- community UI selection fields;
- community experiment flags;
- empty community opportunity, connection, and adventure arrays.

## History not invented

Migration does **not** infer or fabricate past:

- institution membership;
- attendance;
- waitlist position;
- invitations;
- refusals;
- home visits;
- mentor relationships;
- community connections;
- adventures;
- adventure completion or release.

The institutions are present-day infrastructure. Empty history means “not recorded in the older schema,” not “these people had no community life.”

## Version evidence

A successful migration appends an explicit migration ledger entry. It does not rewrite older ledger entries.

## Rejection

If the source world is structurally invalid, migration does not silently repair ownership, tenancy, objects, consent, or family links. Import returns validation evidence.
