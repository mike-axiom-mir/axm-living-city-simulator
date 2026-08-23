# Structural Habitat Engine — v0.4.0

## Purpose

Turn each residential property from a decorative grid into a persistent, deterministic habitat with real room identity, passable doors, surfaces, utilities, structural condition, projects, histories, validation, and autonomous-but-bounded resident alteration.

The engine is deliberately low-graphic. Its job is to prove the underlying mechanisms before exterior architecture and final art.

## Authoritative record

A habitat uses schema `axm.structural-habitat/v0.4.0` and belongs to one residential property. It contains:

- revision and room-ID counter;
- entrance cell;
- structural condition;
- canonical partitions;
- computed rooms;
- room connections;
- utility summary;
- construction projects;
- deterministic layout hash;
- migration evidence;
- habitat history.

Furniture remains outside the habitat record in the property’s object list. Resident intentions, permission requests, escrow, and owner policy also remain separate. This preserves the distinction between structure, possessions, plans, legal authority, and funding.

## Room computation

The property grid is flood-filled. An interior `wall` or `door` edge blocks room merging; an open edge does not. Existing rooms are compared with new connected components by cell overlap so the best surviving identity can retain:

- room ID;
- explicit name and purpose;
- purpose provenance;
- finishes;
- utilities;
- history.

A door is therefore both:

1. a boundary that keeps two rooms distinct;
2. a connection that can make them reachable.

## Reachability and required facilities

The engine starts at the recorded entrance and traverses cells through open edges and passable doors. A valid habitat must preserve:

- reachable room cells;
- a reachable wet bathroom;
- food-preparation capability with required services;
- reachable sleep objects;
- valid room, connection, and partition references.

The system rejects a partition preview that would strand a room. Final completion repeats the check after object reflow and permission synchronization.

## Surfaces and utilities

Every room has independent:

- floor finish;
- wall finish;
- finish condition;
- power access;
- water access;
- waste access.

The layers are intentionally separate. Repainting does not repair a wall, and adding water does not automatically add waste.

## Room meaning and provenance

Room purposes describe use rather than grant magical stats. The current set includes flexible, entry, living, sleep, work/study, kitchen, bathroom, storage, hobby, and workshop.

`roomSuggestions()` provides candidate meanings. `setRoomPurpose()` is an explicit authored action with provenance. Suggestions are not optimization law.

Recognized provenance now includes player, agreement, resident, stewardship, migration, and inferred sources. A resident-authored or player-authored purpose is not silently overwritten by a later graph recomputation.

The sole bathroom cannot be removed until another valid wet bathroom exists. Declaring a room a bathroom requires water and waste.

## Object contract

`objectFitsAt()` and `placementPermission()` jointly require:

- one-room footprint;
- no partition crossing;
- no collision;
- matching utilities;
- actor/owner authority.

After construction, `reflowObjects()` uses deterministic search. Personal objects that cannot fit enter the correct owner’s storage. Property-bound fixtures remain with the property and legal owner. The before/after identity set is checked before completion commits.

## Project integration

The engine exposes these major project functions:

- `validateProjectSpec()`;
- `projectAuthority()`;
- `projectBudget()`;
- `requestHabitatProject()`;
- `createAuthorizedProject()`;
- `createStewardshipProject()`;
- `workHabitatProject()`;
- `workStewardshipProject()`;
- `cancelHabitatProject()`;
- `findProject()`.

The Household Agreement Engine calls `createAuthorizedProject()` only after an accepted shared-home renovation proposal.

The Autonomous Habitat Shaper calls `createStewardshipProject()` only after the linked intention has the required co-tenant and property-owner evidence and enough escrowed resources. Resident phases then pass through `workStewardshipProject()` rather than mutating rooms directly.

## Property stewardship boundary

Each residential property now also carries `axm.property-stewardship/v0.4.0` state. That record points to requests, owner policy, maintenance reserve, and stewardship history, but it does not replace the habitat.

Legal ownership, occupancy, fixture ownership, resident intention, and project authority remain distinct. Transferring a property in the labeled experiment updates legal ownership and property-bound fixtures together while leaving tenant occupancy and personal objects intact.

## Validation boundary

`validateProperty()` reports errors; it does not repair them. `Systems.validateWorld()` includes every residential habitat plus graph permissions, object placement, intentions, requests, policies, escrow, and linked projects.

A current-schema corruption is rejected. Migration/normalization occurs only in the explicit legacy path or first-time habitat initialization.

## Reuse beyond this game

The engine can donate:

- real-room generation for Coexisting Village;
- bounded habitat editing for autonomous village residents;
- room/utility constraints for miniature machine villages;
- deterministic layout validation for asset/build tools;
- an intention → permission → escrow → phased project → evidence boundary for human/AI collaborative construction;
- property biography and resident-authored change history for other persistent simulations.

Donation must preserve authority and no-loss roots rather than copying only the visual grid.
