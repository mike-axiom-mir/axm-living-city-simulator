# Bounded Enterprise Work and Authority v0.8.0

## Root distinction

A person agreeing to perform some paid work does not become a controllable unit, co-owner, household member, tenant, dependent, or extension of the enterprise owner.

## Offer lifecycle

```text
owner selects an eligible autonomous adult
→ exact wage and 1–3 sessions/week are proposed
→ pending offer exists with no labor
→ resident answers later
→ accepted / declined / withdrawn
→ each used session reserves and pays its wage
→ either side may end the bounded agreement
```

## Authority object

An accepted offer grants:

```json
{
  "enterpriseWork": true,
  "enterpriseOwnership": false,
  "personalMoney": false,
  "household": false,
  "tenancy": false,
  "propertyEdit": false,
  "familyCare": false,
  "lifeDirection": false
}
```

Any broader authority is invalid.

## Wage integrity

Before a worker is included in a session:

- the agreement must be accepted and active;
- the weekly session cap must not be exhausted;
- the enterprise must be able to reserve the exact wage;
- the wage is attributable to that session and resident;
- the worker’s personal money changes by the recorded amount;
- enterprise wage totals and offer usage evidence update.

The engine does not invent unpaid labor because a resident is a friend, partner, family member, or community connection.

## Refusal and exit

Declining an offer or ending an accepted agreement:

- creates no hidden friendship/trust/romance penalty;
- transfers no equipment or ownership;
- does not change housing or household state;
- preserves the answer and earlier paid sessions as history.

## Current limits

This is a bounded prototype, not labor law. It does not model contracts, taxes, benefits, sick leave, scheduling negotiations, unions, workplace safety regulation, discrimination law, redundancy, or full career progression.
