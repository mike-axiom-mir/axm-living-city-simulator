# Room Graph and Permission Model — v0.4.0

## Separation of concepts

The simulation treats these as different facts:

- who legally owns the property;
- who occupies it;
- who owns each object or fixture;
- who may enter or observe;
- who may change a surface;
- who may change structure or utilities;
- which household member governs a room;
- whether another resident accepted a specific change;
- whether the owner accepted a specific tenant request;
- who supplies money and materials;
- who performs the work.

Conflating them would recreate household puppeteering, landlord remote control, or autonomous actors with hidden edit powers.

## Graph identity

Rooms are connected components separated by wall or door edges. Door records connect room IDs for navigation. Permission records reference room IDs, not screen rectangles.

`roomGraphRevision` ties the household permission projection to the current habitat revision. After construction, permissions are synchronized and existing objects rechecked.

## Household permission kinds

- `player_private` — player may place/change personal objects; partner needs agreement.
- `common` — shared governance; structural/shared-space work can require proposal.
- `partner_private` — partner retains authorship; direct player placement/change is denied.

Bathroom and necessary circulation are normally common so one resident cannot claim a required facility as exclusive merely through projection order.

## Legacy zones

v0.2 stored rectangular zones. v0.3 and v0.4 preserve them in the agreement as migration evidence and map their holder patterns onto actual rooms. The rectangles do not decide current placement.

This avoids a silent history rewrite while letting the authoritative model improve.

## Placement check

For every occupied object cell the engine resolves the room permission. Placement fails when:

- the footprint spans multiple rooms;
- it crosses a wall/door boundary;
- a player object enters partner-private space;
- an NPC object enters player-private space;
- a common-space action lacks the required accepted authority;
- utility requirements are absent.

A successful placement check is not structural authority. It only proves that this object can lawfully occupy those cells.

## Structural authority

Room permission does not override property ownership. A common-room proposal can establish mutual household consent but cannot authorize wall, plumbing, or utility work in a rental.

Property ownership also does not override occupancy. A player-owned remote property occupied by NPC tenants is not a freely editable dollhouse. In v0.4 it instead creates a stewardship relationship: residents can submit bounded requests, and the player may approve or refuse them without directly controlling the tenant.

For autonomous resident construction, authority can require two independent gates:

1. affected co-tenant consent;
2. legal owner permission.

The linked request records each response and reason. Approval is project-specific and cannot be reused as general editing power.

## Funding and labor are separate from permission

Permission does not create resources. A request can be accepted while the resident continues saving.

The resident may fund the work, the owner may contribute from a recorded maintenance reserve, or an approved mixed path may be used. Construction begins only when the selected resource path is satisfied. The resident then performs the project phases through the common construction engine.

## Purpose authority

Room meaning is separate from room access. A partner-private room blocks unilateral player purpose changes. Player-authored and resident-authored purposes carry provenance. Suggestions remain optional.

A stewardship project may leave a visible resident-authored purpose/history, but it cannot overwrite an explicit player or agreement-authored purpose without the relevant bounded authority.

## Exit, moving, and re-projection

When a household agreement ends, its history remains. Shared-room permissions cease to govern as a household contract, but neither resident is automatically evicted and no object ownership changes.

When a resident moves away while an intention is unresolved, the intention is withdrawn rather than following them into another property. Escrow release is recorded. The property history keeps the abandoned request as part of its biography.

## Larger-household direction

Do not extend the three labels by hardcoding more rectangles. A larger-household organ should use:

- room ID;
- holder set;
- action capabilities;
- decision rule (individual, unanimous, majority, guardian/care role, landlord approval);
- funding rule;
- expiry/review;
- provenance.

That allows roommates, children, care relationships, studios, workshops, and businesses without treating every member as one merged household actor.
