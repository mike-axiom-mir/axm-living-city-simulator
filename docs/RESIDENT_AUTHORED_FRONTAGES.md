# Resident-Authored Frontages — Authority, Funding, and Refusal v0.10.0

## Root

A resident may care about the outside of the place where they actually live or work. That does not make them a puppet, and property ownership does not make the occupant’s expression automatically controllable by the owner.

The v0.10 frontage path is:

```text
resident forms exact idea
→ correct authority receives exact request
→ approval or refusal is recorded
→ accepted request creates a separate funded project
→ resident saves toward the exact cost
→ three phases are completed
→ final shell validation runs
→ exact change applies or rolls back
```

No step is silently skipped.

## Author eligibility

A person may author a frontage idea only when they:

- actually occupy the target place; or
- lawfully own a genuinely vacant target place.

Being a friend, visitor, customer, employee, community member, household relative, or route observer is not enough.

## Current bounded change types

- `door_color`
- `window_boxes`
- `frame_style`
- `entry_light`
- `sign_text`
- `facade_accent`

Each proposal stores an exact before value and exact after value. “Improve the façade” is not sufficient authority because it hides the actual requested mutation.

## Proposal is not permission

Schema: `axm.living-city.frontage-proposal/v0.10.0`

A proposal records:

- author;
- building and place;
- created time and visible decision due day;
- exact change;
- owner identity;
- authority decision mode;
- cost and finance evidence;
- status and project link;
- `noRelationshipPenalty: true`;
- history.

Creation does not:

- change the façade;
- move money;
- create materials;
- grant broader construction authority;
- modify a relationship;
- transfer ownership or tenancy.

## Authority modes

### Player-owned occupied property

When the player owns a place occupied by another resident, the request becomes `awaiting_player`.

The player may approve or decline the exact request. They do not gain direct remote decoration controls over the tenant’s whole home.

### External owner

An external deterministic policy answers after the visible due day. The policy considers the bounded change, cost, and current property condition. It may approve or refuse.

This is simulated governance, not a claim to model real tenancy law.

### Author is lawful owner

When the author holds the relevant property authority, the proposal can be approved without a second owner response. It still creates a separate project and does not mutate the frontage instantly.

## Refusal root

Refusal is a valid outcome.

A declined proposal:

- changes no frontage value;
- creates no project;
- applies no hidden friendship, trust, romance, household, or reputation penalty;
- remains in history;
- states who declined and why;
- does not label the resident’s idea as failure or bad taste.

The focused suite compares the relationship state before and after a player refusal.

## Project is not free construction

Schema: `axm.living-city.frontage-project/v0.10.0`

An approved proposal creates a project with:

- actor;
- exact proposal/building/place references;
- required money;
- resident escrow;
- spent amount;
- three phases;
- completed-phase IDs;
- status, completion, failure, and history evidence.

### Funding

The resident places attributable personal money into a dedicated escrow. Approval does not generate money. Saving is visible and bounded. The first implementation does not charge the property owner automatically.

### Phases

1. Confirm the exact design.
2. Gather the stated materials.
3. Install and verify the frontage.

The façade changes only after all phases are complete.

## Application and rollback

The final phase:

1. snapshots the frontage, linked exterior state, and building revision;
2. applies only the exact approved field;
3. increments frontage/building revision;
4. adds resident-authored history;
5. validates the building;
6. retains the change on success;
7. restores the snapshot and records failure on validation error.

The building ID, place ID, resident ID, proposal ID, and project ID remain stable.

## Casual-realism protections

The shell engine sets and validates:

```json
{
  "facadeMaintenanceObligation": false,
  "frontageDailyDecay": false,
  "exteriorOptimizationScore": false
}
```

Completed frontage work does not decay merely because days pass. The game has no frontage quality leaderboard. A different frame, door color, sign, or window-box choice is expression—not a lower tier that must eventually be replaced.

## Labeled experiment

The Buildings/Lab experiment:

- identifies one occupied small house;
- transfers property ownership to the player for QA;
- preserves the tenant at the moment of transfer;
- transfers only building-bound fixtures where relevant;
- creates one real tenant-authored request;
- uses the ordinary response, funding, phase, mutation, and validation paths.

The tenant may later move through ordinary autonomous life. “Preserved at transfer” is distinct from “forced to remain forever.”

## Current limits

- One open frontage request/project per place.
- Bounded expressive changes only.
- No cooperative design meeting or multi-tenant vote yet.
- No owner contribution, rent offset, compensation, deposit dispute, permit, contractor, or liability system.
- No windows/doors added or removed structurally through frontage projects yet.
- No weather-driven repair demand.

Future expansion must preserve exact authority, resident agency, refusal neutrality, and no-chore roots.
