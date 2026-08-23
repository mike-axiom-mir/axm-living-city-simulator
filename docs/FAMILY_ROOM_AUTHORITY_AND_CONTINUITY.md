# Family Room Authority and Continuity — v0.5.0

## Purpose

Connect family boundaries to the real structural-habitat engine instead of drawing decorative “child zones” that the simulation ignores.

## Room assignments

A family assignment references an existing habitat room ID and one person.

Kinds:

```text
dependent_private
dependent_shared
family_common
```

Each assignment records:

- stable assignment ID;
- room ID;
- person ID;
- kind;
- human label;
- creation day;
- provenance.

## Authority layering

Room authority is evaluated alongside:

- object ownership;
- adult household room permissions;
- property ownership/tenancy;
- accepted exact proposals;
- construction authority;
- fixture rules.

A dependent-private assignment does not transfer property ownership. It creates a meaningful use/privacy boundary within a lawful home.

## Object placement

When an actor attempts to place or move an object, family placement authority may reject the position when it violates a dependent-private boundary.

Dependent-owned objects can be placed in their assigned room. When a move or construction change makes placement impossible, the object returns to the owner’s storage rather than being deleted or transferred.

## Family room proposals

A room-plan proposal can request:

- another room assignment;
- a different privacy/shared kind;
- a different person-room mapping.

It does not create a room, wall, door, utility, or completed renovation.

For changes affecting an older child/teen private room, dependent voice is part of decision evidence. A refusal can block implementation without hidden punishment.

## Construction

A structural project affecting a family-assigned room still follows:

```text
exact proposal/authority
→ funding and materials
→ phased labor
→ structural validation
→ object reflow/storage
→ commit or rollback
```

Family authority is an input to the shared validator, not a separate magic construction path.

## Whole-family move

Before adult relocation, required capacity becomes:

```text
adult household members + active dependents
```

After an accepted adult move, family synchronization:

1. identifies active dependent members;
2. moves occupancy to the destination;
3. transfers each dependent’s personal objects;
4. places objects under real destination rules or uses owner storage;
5. updates the family home;
6. creates lawful room assignments where possible;
7. records move/history evidence;
8. keeps the new family home off the public rental market.

A destination that cannot fit the complete family is invalid.

## Public listing boundary

A home’s unused numerical capacity is not automatically a public vacancy when an active family plan is using the property.

v0.5 explicitly updates `listedForRent` during:

- family-unit creation;
- dependent arrival;
- family relocation;
- adult-child departure;
- family ending.

General NPC housing also requires a listed property. This closes the earlier leak where an unrelated resident could consume family capacity.

## Separation

Adult household separation does not silently decide legal custody.

The family unit records continuity and current homes. Objects remain with their owners. Existing occupancy is preserved unless another lawful move occurs. The history states what the simulation knows and does not claim a court/legal outcome.

## Young-adult room release

On teen→young-adult transition:

- family role becomes `adult_child`;
- the dependent-private assignment is removed;
- personal objects remain owned by the young adult;
- the person can remain at home temporarily;
- a later independent move uses ordinary adult housing.

Removing a room assignment does not delete the room or objects.

## Future expansion questions

A later multi-household family branch should explicitly address:

- two-home continuity;
- visiting/sleeping schedules;
- shared object access;
- consent for room reuse;
- stepfamilies and multiple adult guardians;
- institution-linked transport and schedules;
- legal/prototype boundary labels;
- adult children returning home;
- elder-care room authority.

Those questions should not be hidden inside the current two-adult agreement model.
