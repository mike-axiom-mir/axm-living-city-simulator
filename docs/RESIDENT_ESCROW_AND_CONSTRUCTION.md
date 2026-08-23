# Resident Escrow and Construction v0.4.0

## Why escrow exists

Without an explicit resource layer, “autonomous building” becomes magic: the resident asks, approval appears, and the room changes for free.

v0.4 separates:

- intention;
- permission;
- funding;
- material acquisition;
- work;
- structural completion.

## Budget

The shared habitat engine derives a budget from project phases:

```text
phases[]
phaseMoney
materialMoney
totalMoney
materials{}
hours
```

Material cost uses the project-authored material catalogue. Phase money and material money remain separate in evidence.

## Contribution sources

### Resident

The resident transfers simulated personal money into the intention escrow. The transfer reduces resident money and increases `contributionTotals.resident`.

### Property reserve

An approved owner contribution reduces the target property maintenance reserve and increases `contributionTotals.propertyReserve`.

The two sources never become indistinguishable.

## Request threshold

A resident does not need the entire project cost before asking permission. They first save a visible share, demonstrating that the intention is real. The threshold is stored in the intention.

Permission may therefore arrive while the resident still needs to continue saving.

## Material purchase

When full money is available:

- material cost leaves escrow money;
- exact quantities enter escrow materials;
- purchase day, cost, unit prices, and quantities are recorded;
- `materialsPurchased` becomes true.

No project phase may consume unavailable materials.

## Project creation

A resident project requires:

- current tenancy at the target property;
- resident actor not equal to player;
- linked intention ID;
- linked request ID;
- approved request;
- complete permission evidence;
- valid project specification.

The resulting project uses:

```text
creatorId = residentId
resourceMode = resident_escrow
authority.mode = resident_stewardship
```

## Phase work

Each phase checks and consumes:

- phase money;
- material quantities;
- resident occupancy;
- project status;
- stale layout revision where relevant.

The phase records actor, money, materials, hours, and remaining escrow. Resident energy/hygiene and relevant skill change through their own work.

## Completion transaction

After the final phase, the existing habitat transaction:

1. snapshots habitat/furniture/storage;
2. applies the exact change;
3. recomputes rooms and permissions;
4. reflows or owner-stores objects;
5. validates room coverage, reachability, required facilities, utilities, permissions, object IDs/owners, and layout consistency;
6. commits or restores the snapshot.

A failed validation records failure; it does not consume the previous lawful home state.

## Withdrawal and refunds

### Before materials

Remaining escrow can be returned directly:

- property contribution back to the property reserve;
- resident contribution back to resident money.

### After materials

Unused materials are converted through a bounded resale value. The difference between purchase value and recovered value is recorded as material resale loss.

### After partial phases

Spent phase money/materials remain spent because work occurred. Only remaining value is returned. The history preserves completed phases and reason for ending.

## Invariants

- escrow money ≥ 0;
- material quantities ≥ 0;
- contribution totals ≥ 0;
- owner contribution cannot exceed authorized reserve transfer;
- project creator equals intention resident;
- resident must occupy project property while working;
- request/intention/project/property links must resolve;
- terminal request/intention states agree with project outcome;
- no object identity loss is accepted;
- refund/loss evidence precedes escrow clearing.

## Reusable AXM organ

This is a bounded capability-finance pattern: autonomous actors cannot invoke expensive or state-changing capabilities without attributable resources. It can later support businesses, robotics maintenance, village construction, or local AI resource budgets.
