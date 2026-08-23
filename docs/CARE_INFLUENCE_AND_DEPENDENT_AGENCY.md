# Care, Influence, and Dependent Agency — v0.5.0

## Goal

Represent responsibility and influence without representing a child as programmable property.

The player can create conditions, offer activities, teach, listen, spend time, provide resources, set/renegotiate boundaries, and shape the environment. The player cannot queue a guaranteed personality, career, loyalty level, or life plan.

## Initial care actions

| Action | Time | Cost | Main influence |
|---|---:|---:|---|
| Share a meal | 1h | €8 | security, social, hunger |
| Read or create together | 2h | €3 | curiosity, creativity |
| Teach something practical | 2h | €4 | practical skill, independence |
| Listen and check in | 1h | €0 | security, social trust |
| Boundary conversation | 1h | €0 | clarity, independence |
| Neighborhood outing | 3h | €12 | curiosity, social world, autonomy |
| Protect rest and recovery | 1h | €2 | energy, security, recovery |

The exact values are prototype balancing, not claims about child development science.

## Acceptance

Infants/toddlers receive direct age-appropriate care while their needs and timing still shape the world.

Children and teens receive a deterministic choice using:

- current trust and friendship;
- mood;
- preferred activities;
- recent refusals of the same action;
- action-specific context;
- world seed;
- day/hour;
- person and action IDs.

This makes the result reproducible while preserving real refusal.

## Refusal contract

When an activity is declined:

- the activity’s money is not spent;
- zero activity care-hours are credited;
- one hour passes for the conversation/attempt;
- the refusal is appended to the daily care record;
- the refusal is appended to personal autonomy evidence;
- no hidden relationship penalty is added;
- trust may rise slightly because refusal was respected;
- the UI explains that the activity was declined now, not forever.

This is a reusable AXM refusal organ: a “no” can be recorded as meaningful interaction without punishing the person or pretending nothing happened.

## Acceptance contract

When accepted:

- exact money and player energy are charged;
- dependent needs change;
- development domains receive bounded influence;
- trust/friendship receive visible influence;
- the daily record receives time, cost, actor, action, and decision evidence;
- the world clock advances;
- the ledger records causes and evidence.

The action does not schedule future obedience.

## Daily care record

A record is keyed by family unit, dependent, and day.

It records:

```text
requiredHours
playerHours
partnerHours
communityHours
cost
actions[]
needsMet
educationEvidence
```

Daily records separate contribution sources. Partner care is autonomous and based on the accepted plan plus the partner’s energy, stability, and independence. Community support requires the accepted plan and an age/schedule fit.

## Care pressure

When supplied support repeatedly falls below the current requirement, the family unit keeps visible pressure evidence.

Possible result:

- an autonomous partner may propose a revised care plan;
- the player may accept or decline;
- no plan is silently overwritten;
- no single value is treated as moral proof of a “good” or “bad” parent.

The long stress results show significant strain under some prototype balances. This is evidence that tuning remains needed, not a reason to hide the state.

## Education direction

Education modes define context rather than destiny:

- `neighborhood_learning`;
- `home_project_mix`;
- `practical_apprenticeship`.

An accepted proposal can change the mode. Daily education adds bounded progress and development based on schedule and environment.

No mode guarantees a career or makes other modes invalid.

## Relationship safety

Dependents use a family-safe relationship path.

Blocked while dependent:

- adult romance interaction;
- dating/commitment proposal;
- adult household membership;
- adult employment;
- personal rent arrears;
- isolated adult relocation;
- adult property-stewardship projects.

The general People view renders a dependent-specific inspector and routes the player back to Family for care/education/room history.

## Development is not destiny

The current numeric domains exist to make cause/effect inspectable and testable.

Rules for future growth:

- never expose one optimal child build;
- avoid deterministic career locking;
- retain uncertainty and reversibility;
- let environments and relationships create opportunities, not commands;
- support strengths without making low values moral failures;
- preserve the person’s own later choices;
- separate player hope from simulated consent.

## Reusable organ opportunities

The care engine can be reused for:

- mentors and learners;
- elder support;
- rehabilitation/recovery simulations;
- animal care with species-appropriate contracts;
- community volunteers;
- team coaching;
- AI companion support boundaries.

Each reuse must define who can refuse, what authority exists, what evidence is visible, and what outcomes cannot be guaranteed.
