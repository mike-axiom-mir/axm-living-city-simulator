# Migration Contract — v0.3 to v0.4

## Source

```text
axm.living-city-sim.world/v0.3.0
```

## Target

```text
axm.living-city-sim.world/v0.4.0
```

## Additions

The migration adds or normalizes:

- `habitatIntentions: []`;
- `stewardshipRequests: []`;
- resident `habitatIntentionCooldownUntil`;
- resident `stewardshipReliability`;
- property `stewardship` record and deterministic owner policy;
- construction project schema v0.4;
- project `creatorId` fallback;
- project `resourceMode` fallback;
- null stewardship intention/request links for legacy projects;
- v0.4 UI selection fields;
- v0.4 flags and metrics defaults;
- structural habitat schema v0.4 while retaining its rooms/history.

## Explicit non-invention rules

Migration must not create:

- a habitat intention;
- a stewardship request;
- a co-tenant response;
- a player approval/decline;
- an external-owner answer;
- resident savings;
- owner contribution;
- purchased materials;
- resident construction;
- completed property change;
- relationship penalty/reward;
- new property ownership.

## Legacy construction records

A v0.3 project is treated as player-authored unless its existing historical data proves otherwise. The migration adds neutral compatibility fields:

```text
resourceMode: player_inventory
stewardshipIntentionId: null
stewardshipRequestId: null
authority.requestId: null
```

It does not rewrite completed phases, spend, actor history, target, or outcome.

## Property policy creation

The policy is derived deterministically from current property owner identity:

- player owner → manual human decision mode;
- cooperative owner → cooperative caretaker policy;
- other institutional owner → town housing policy.

This policy is a new future-decision contract. It is not evidence that the owner approved or refused anything in the past.

## Preservation

The migration preserves:

- seed/RNG/id counter;
- time;
- player/resident money, jobs, homes, relationships, objects, and storage;
- property tenants, ownership, furniture, reserve, and history;
- household agreements/proposals/issues;
- room graph, partitions, utilities, purposes, permissions, projects, and habitat history;
- ledger and metrics already present.

## Corruption policy

Known legacy versions may be migrated. A malformed current v0.4 world is rejected. The loader may not use migration as a silent repair tool for current-schema corruption.

## Test evidence

`testV03MigrationAddsEmptyStateWithoutInventingPermission` verifies that a v0.3 snapshot gains valid empty stewardship structures and policies while no intention/request/approval/project is invented.
