# Living Local Economy Engine v0.8.0

## Purpose

The engine lets existing people, places, projects, skills, needs, and equipment form a local economy without converting the life simulator into a mandatory tycoon game.

Its center is not “maximize profit.” Its center is:

```text
notice a real local need
→ choose whether it matters to you
→ keep the direction private or offer it occasionally
→ use a real place only when needed
→ serve actual residents
→ preserve costs, money, work, and source history
→ pause, pivot, close, or continue without a universal score
```

## Enterprise paths

### Private hobby

- No customers.
- No forced starter kit.
- No premise required.
- No assumption that monetization is progress.

### Occasional service

- Bounded sessions.
- May operate without a leased room.
- Starter equipment becomes attributable when service actually begins.
- Skipping sessions creates no penalty.

### Tiny enterprise

- May lease a genuinely vacant commercial room.
- Pays explicit deposit, weekly lease, and utilities.
- Can remain small indefinitely.

### Cooperative

- Reserved as a distinct path.
- Current implementation supports bounded workers, but not full cooperative ownership, voting, or surplus governance.

## Lifecycle states

- `private`
- `occasional`
- `open`
- `paused`
- `closed`

Path and status are related but not collapsed. A paused direction may retain or release its premise. Closing preserves enterprise history and equipment.

## Local needs

Need signals are refreshed from current town evidence. They expose a score and its causes. They are not invisible demand multipliers and do not guarantee customers.

Current needs cover repair, affordable food, practical learning, creative support, reuse, and local connection.

## Enterprise templates

Each template defines:

- relevant need types;
- starter cost and equipment;
- bounded base capacity;
- base price;
- meaningful entered-session actions;
- skill, need, quality, agency, cost, and capacity effects.

Different templates remain different at high investment; the engine does not force one best enterprise.

## Sessions

### Compressed

A complete bounded session advances three hours and resolves work, customers, costs, equipment wear, wages, and history in one action.

### Interactive

The player enters the place and performs a small number of meaningful tasks. Three task moments are enough to settle the session. The hard cap prevents the workday from becoming a click-grind.

Cancelling creates no customer, revenue, or false completion.

## Money

Enterprise funds are separate from personal money. Records distinguish:

- startup and equipment cost;
- premise deposit;
- weekly room and utility costs;
- session costs;
- customer payments;
- flexible/free service;
- wage reserve and paid wages;
- owner support;
- owner withdrawal;
- arrears.

A room can be released after sustained unpaid costs while the direction remains preserved as paused rather than erased.

## Actual residents

Customer selection begins from eligible existing people. Service records retain their resident ID and payment. The validator rejects missing residents, anonymous demand tokens, and ungrounded revenue.

## Autonomous residents

Residents may form a direction when their skills, traits, possessions, money, local needs, and deterministic variation align. Formation remains deliberately uncommon.

Autonomous sessions use the same customer, money, equipment, and history model. The player does not select NPC customers or operate NPC enterprises.

## No age pressure

Every enterprise record declares:

- `noAgeGate: true`;
- `ageGate: null`;
- `noGrowthRequirement: true`;
- `optional: true`;
- `noFailureLabel: true`.

Economy time cannot advance age or life chapter in default choice-first mode.

## Validation

The engine validates:

- schemas and IDs;
- owner existence;
- legal premise occupancy;
- equipment authority;
- source-project links;
- pricing mode;
- status/path values;
- customer existence;
- customer and session attribution;
- work-offer scope;
- no-age and no-growth invariants;
- active-session consistency;
- deterministic random state.

It reports invalid state rather than silently repairing it.
