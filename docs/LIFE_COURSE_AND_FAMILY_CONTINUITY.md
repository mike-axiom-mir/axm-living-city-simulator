# Life Course and Autonomous Family Continuity — v0.5.0

## Purpose

This organ lets a one-character life simulation represent children, aging, separation, and adult descendants without turning important people into player-owned avatars.

It is not “household control with extra restrictions.” It is a separate continuity graph connected to the same authoritative people, homes, objects, time, relationships, rooms, and city economy.

## Core distinction

```text
adult household agreement
    != family continuity
    != property/construction authority
```

The adult agreement answers questions such as commitment, cohabitation, adult finances, and adult separation.

The family graph answers questions such as care plan, education direction, dependent membership, room boundary, development evidence, and life-stage continuity.

The property layer answers ownership, tenancy, capacity, structure, utilities, fixtures, money, materials, and construction.

No layer may manufacture authority in another.

## Life-course record

Every person carries:

```json
{
  "schema": "axm.living-city.life-course/v0.5.0",
  "ageDays": 5475,
  "ageYears": 15,
  "stage": "teen",
  "birthdayOffset": 214,
  "stageEnteredDay": 1,
  "transitionHistory": [],
  "provenance": "created in v0.5"
}
```

`birthdayOffset` is deterministic per world seed and person ID. This avoids every resident aging on the same day while preserving exact replay.

The stage threshold is deliberately simple in this prototype. It is a simulation mechanism, not a biological or legal claim.

## Family unit

A family unit records continuity rather than control.

Important fields:

```text
linkedHouseholdId
homePropertyId
members[]
carePlan
pendingArrival
pressure
roomAssignments[]
separation
history[]
```

Membership keeps `joinedDay`, optional `leftDay`, role, and agency label.

A person may leave the family home while the historical family link remains. `leftDay` prevents the first-departure transition from repeating.

## Parenthood flow

The normal flow is intentionally multi-step:

```text
active adult partnership
→ accepted shared home
→ exact parenthood proposal
→ autonomous partner answer
→ preparation period
→ capacity and room validation
→ dependent arrival
```

The proposal terms include:

- conceptual arrival path;
- preferred starting stage;
- care mode;
- education mode;
- preparation days;
- player/partner care-hour targets;
- weekly budget.

A proposal can be declined or expire. Acceptance does not immediately insert a person into the world.

The labels `new_child`, `adoption`, and `kinship_care` are narrative/simulation directions only. The prototype does not model reproductive medicine, adoption law, kinship-care assessment, or safeguarding procedure.

## Dependent arrival

A lawful arrival must find:

- an active family unit;
- a valid home;
- capacity for current residents plus the dependent;
- a suitable real room;
- valid object placement or owner storage;
- stable person and object IDs.

The generated dependent becomes a normal city resident with a dependent marker and family-specific records.

The person is added to property occupancy and family membership, but not to the adult household agreement’s `memberIds`.

## Daily life

Dependent schedules use age stage, weekday, hour, accepted education direction, and available city places.

Examples:

- sleeping at home;
- preparing in the morning;
- learning at the community place;
- choosing park/library/home time;
- family and personal time;
- winding down.

Needs update through the ordinary hourly simulation. The child is not paused when the Family tab is closed.

## Development

Current domains:

```text
security
curiosity
social
practical
creativity
independence
```

These are influence/evidence values, not a personality lock or optimization tree.

A future version may add multiple perspectives or uncertainty, but should not silently convert these into deterministic destiny.

## Life-stage transition

At a stage boundary:

1. increment age evidence;
2. record `from`, `to`, day, and age;
3. append world/family history;
4. update stage-specific state;
5. preserve person ID, relationships, objects, storage, and provenance.

The strongest implemented transition is teen→young adult.

At that point the person:

- is no longer financially dependent;
- receives family role `adult_child`;
- becomes eligible for an adult job;
- remains autonomous;
- can later choose independent housing;
- retains family history.

## First independent launch

The special launch path is not a teleport.

It requires:

- young-adult stage;
- an active family membership without `leftDay`;
- movement cooldown complete;
- a genuinely available listed property;
- affordability;
- ordinary NPC movement success.

After success:

- the membership gets `leftDay`;
- personal objects move through ordinary object rules;
- family home listing remains protected for the people still living there;
- the first-launch metric increments once;
- later moves are normal adult housing behavior.

## Separation continuity

When the adult household agreement ends, the family unit may become `continuing_separately` rather than disappearing.

The system preserves:

- dependent identity;
- family membership;
- object ownership;
- current occupancy;
- room/history evidence;
- adult relationship history;
- explicit separation record.

This is an architectural continuity proof, not a legal custody decision.

## Labeled experiment

`prepareFamilyContinuityExperiment` exists for QA and demonstrations.

It:

- creates a compatible adult relationship through the real commitment path;
- establishes cohabitation through the real relocation path;
- lawfully moves existing residents when needed;
- creates the family unit;
- welcomes a child or teen;
- creates objects and a real room assignment;
- labels every shortcut in the ledger.

It is single-use per save and must never be presented as ordinary progression.

## Validation

Family validation checks:

- unique IDs;
- record schemas and statuses;
- known people and units;
- one active family membership per person;
- valid roles and room kinds;
- real room references;
- dependent job/rent restrictions;
- valid proposal recipients/status/history;
- nonnegative care evidence;
- known family/person links.

Validation reports corruption and does not fabricate repairs.
