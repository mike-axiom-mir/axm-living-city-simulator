# Construction Authority and Phases — v0.4.0

## Why construction is not a click-to-mutate action

The larger idea needs buildings to matter over time. Construction therefore separates **intention, authority, funding, materials, labor, validation, and verified result**.

The player and autonomous residents now use the same authoritative construction engine. Neither path may bypass permission checks, resource evidence, phased work, room recomputation, object reflow, or rollback.

## Authority matrix

| Situation | Surface | Wall/door | Utility | Structural repair |
|---|---:|---:|---:|---:|
| Current solo rental | bounded direct | denied | denied | denied |
| Current owned solo home | direct | direct | direct | direct |
| Current shared rental, player-private room | bounded direct | denied | denied | denied |
| Current shared rental, common/partner-private room | proposal, then bounded project | denied | denied | denied |
| Current shared owned home, player-private room | direct | direct | direct | direct |
| Current shared owned home, common/partner-private room | household proposal | household proposal | household proposal | household proposal |
| Player-owned remote property with resident tenants | resident request; player may approve or refuse | resident request; player may approve or refuse | resident request; player may approve or refuse | resident request; player may approve or refuse |
| Externally owned occupied property | deterministic owner-policy request | deterministic owner-policy request | deterministic owner-policy request | deterministic owner-policy request |
| Resident co-tenant affected by a proposal | explicit resident approval or refusal | explicit resident approval or refusal | explicit resident approval or refusal | explicit resident approval or refusal |

The exact command rechecks the live world. The table is a readable summary, not the authority source. A room permission, tenancy, relationship, or ownership fact cannot silently invent a different authority.

## Proposal does not equal construction

For player-authored shared-home work:

1. exact project terms are proposed;
2. the other resident may accept or refuse;
3. acceptance creates bounded authority evidence;
4. ownership, occupancy, target, and room permission are revalidated;
5. a construction project is queued;
6. phases still require resources and work;
7. structure changes only after final validation.

For resident-authored work:

1. the resident forms an inspectable habitat intention;
2. they save money in a separate intention escrow;
3. affected co-tenants may accept or refuse;
4. the legal owner or player-landlord may accept, refuse, or authorize an owner contribution;
5. accepted authority does not instantly mutate the property;
6. required materials are bought into the same escrow;
7. the resident performs phased labor through the construction engine;
8. the completed change must pass the same transactional validation as player work.

A pending or accepted request is therefore evidence of permission, not evidence that construction already happened.

## Project record

Schema: `axm.construction-project/v0.4.0`.

Important fields include:

- stable project ID;
- property, creator, and acting resident/player;
- project type and exact target specification;
- human summary and canonical target key;
- authority mode and evidence links;
- household proposal or stewardship request/intention IDs where relevant;
- layout revision at planning;
- funding mode and resource-owner evidence;
- phase index and phase records;
- completed phase IDs;
- spent money/material totals;
- status, completion day, failure reason;
- append-only project history.

The resident intention, request, escrow, and property policy remain separate records. The project does not overwrite their histories.

## Phase families

Surface work records inspection/preservation, preparation, application, and settling/verification.

Partition work records measurement, material preparation, frame/edge work, wall/door/open implementation, and validation.

Utility work records route inspection, parts preparation, service installation, and safety/room verification.

Repair work records diagnosis, preparation, reinforcement/repair, and whole-habitat verification.

Exact values are prototype balance. The separation between preparation and authoritative completion is foundational.

## Actor-aware resources

`projectBudget()` calculates required money and materials before a project begins.

Player work can draw from the player’s ordinary money/material inventory when the authority path permits it.

Resident stewardship work uses intention escrow. Resident savings, owner contributions, purchased materials, phase spending, refunds, and resale losses remain visible in the intention/request evidence. A resident cannot create money or materials merely because an owner approved the idea.

## Stale target protection

A structural project stores the habitat revision seen during planning. If another structural edit changes the graph before work completes, the stale project fails rather than guessing which new edge or room was intended.

Surface and utility projects additionally verify that the referenced room still exists.

A resident moving away, a permission deadline passing, or authority becoming invalid withdraws or fails the bounded intention rather than silently carrying it into an unrelated home.

## Transaction boundary

At completion the engine snapshots habitat, property furniture, player storage, and all resident storage. It then applies the exact project, recomputes graph state, reflows objects, synchronizes permissions, and validates.

Commit requires:

- valid graph and connections;
- reachable required facilities;
- valid utility layers;
- lawful property and household authority;
- matching stewardship/household evidence when used;
- no missing or transferred object identity;
- matching project target evidence.

Failure restores the snapshot and records why. A resident’s autonomy does not weaken the rollback/no-loss boundary.

## Refusal, cancellation, withdrawal, and release

Refusal is a valid outcome. It does not create a hidden relationship punishment.

A planned or active player project can be cancelled. Completed phases and already-spent resources remain historical evidence; cancellation is not silently rewritten into “never happened.”

A resident intention can be declined, withdrawn, fail validation, or expire. Unspent escrow is released through explicit refund evidence. Purchased unused materials can be resold with a recorded prototype loss rather than disappearing or being refunded at an invented perfect value.

## Implemented actor generalization

v0.4 completes the actor-aware path anticipated by v0.3:

- `createStewardshipProject()` creates a project only from valid resident intention/request evidence;
- `workStewardshipProject()` performs resident phases using resident escrow;
- co-tenant and owner authority remain independent;
- external owners use deterministic, inspectable policy thresholds;
- the player can decide requests only for property they actually own;
- neither NPC logic nor UI code may mutate habitat structure directly.

This shared path is the main reusable organ: autonomous actors can shape persistent places without receiving invisible world-edit power.
