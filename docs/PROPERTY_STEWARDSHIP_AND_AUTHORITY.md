# Property Stewardship and Authority v0.4.0

## Core distinction

The simulation treats these as separate facts:

- who legally owns a property;
- who currently occupies it;
- who owns each object;
- who may decide about a room;
- who may approve one exact alteration;
- who pays for one exact alteration;
- who performs the work.

No one fact silently grants the others.

## Property policy record

Every residential property has:

```text
schema
policy
requestIds
completedIntentionIds
history
```

The policy contains:

```text
id
name
ownerMode
responseDelayDays
generosity
alterationTolerance
repairPriority
```

`ownerMode` is either:

- `player_decides`
- `external_policy`

## Co-tenant authority

A resident alteration affecting a shared home first resolves the people who also live there and whose shared-space use is affected.

Each co-tenant response records:

- person ID;
- status;
- response day;
- score;
- reason;
- relationship/property/project evidence.

A decline stops that exact request. The owner path becomes `not_reached`, because owner approval cannot erase a co-tenant boundary.

## Player authority

The player is asked only when an explicit role is required, such as property owner. The interface offers:

- approve, resident funds it;
- approve with bounded property-reserve contribution;
- decline the exact change.

The command layer rechecks the role. A forged/invalid UI call is rejected before any authority state changes.

A decline does not inject an undocumented friendship, romance, trust, or mood penalty. Later visible story consequences may be designed, but they must be explicit causal simulation rather than punishment hidden inside the response handler.

## External owner policy

An institutional owner answers after a recorded delay. The decision score includes project type and grounded evidence.

Final evidence includes:

- policy ID;
- resident reliability;
- arrears;
- property condition;
- maintenance reserve;
- approval threshold;
- deterministic decision key;
- score and answer.

Current project thresholds favor repair, then utility, surface, and partition changes. This is prototype policy, not legal advice.

## Ownership transfer

The labeled QA setup demonstrates a remote occupied property becoming player-owned without tenant eviction.

Transfer effects:

- legal owner fields update;
- player property index updates;
- property listing state updates;
- property-bound fixture owner IDs update with evidence;
- tenant occupancy remains;
- tenant personal objects remain tenant-owned;
- stewardship policy becomes human decision mode;
- no interior edit authority is granted.

## Maintenance reserve

The reserve belongs to the property context, not automatically to the occupant or owner’s personal wallet.

A request may propose a bounded property share. Human approval with owner share deducts the exact accepted amount. Resident-funded approval leaves the reserve unchanged. External policy may contribute according to its decision path.

## Remote ownership boundary

A player who owns an occupied property may:

- see requests requiring owner authority;
- approve/refuse exact changes;
- contribute from the property reserve;
- inspect room/property history;
- receive rent through existing simulation.

They may not:

- directly place/move/delete tenant furniture;
- directly recolor tenant-authored rooms;
- assign the tenant’s job or schedule;
- force a resident intention;
- evict the tenant as a side effect of purchase or refusal.

## Future tenancy layer

Still missing:

- lease term and renewal;
- deposit and return evidence;
- repair responsibility split;
- inspection consent;
- emergency repair exception;
- rent adjustment/tenant compensation after improvements;
- owner neglect and dispute process;
- joint ownership;
- legal jurisdiction profiles.

These should extend the authority record, not bypass it.
