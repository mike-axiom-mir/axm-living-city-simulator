# Community Adventure Engine v0.6

## Goal

Create a living community that can generate people, places, invitations, shared moments, and personal adventures without turning civic life into a task board.

## Institution model

Each institution records:

- stable ID and schema;
- name, kind, description, tags, and place;
- capacity;
- active and waiting memberships;
- mentor IDs;
- autonomous policy data;
- creation provenance;
- append-only history.

Membership states are visible. A full institution produces a waiting state rather than silently rejecting, charging, or fabricating capacity.

Membership grants access only. `attendanceRequired` remains false.

## Opportunity model

Each opportunity records:

- kind and template;
- institution or host;
- place;
- event day, start hour, and duration;
- cost and capacity;
- participant and waiting IDs;
- initiator and invite status;
- authority flags;
- outcome and history.

The engine supports open events and explicit invitations.

### Lifecycle

```text
created
→ open / awaiting_player / pending_npc
→ available / waiting
→ completed / declined / expired / cancelled
```

An expired event means its time passed. It does not set a player-failure flag or apply a hidden stat loss.

## Participation

Participation validates:

- event status;
- capacity or waiting state;
- player funds;
- scheduling;
- participant existence;
- home-visit authority where relevant.

The world advances to the event’s real time. Participants temporarily use the event location. Ordinary schedules resume afterward.

## Connections

Shared moments may create or deepen a community connection. A connection records:

- person IDs;
- kind;
- warmth and trust;
- shared-activity count;
- last shared day;
- origin and history.

Connections are not duplicates of household, family, tenancy, employment, or object-ownership records.

## Mentors

Institutions can identify active members as mentors based on interest and capability. Mentor status is a community relationship, not authority over another resident.

## Adventures

An adventure thread records:

- owner;
- theme and template;
- title, origin, and meaning;
- optional companion;
- ordered stages;
- current stage;
- status;
- no-deadline flag;
- discovery, completion, or release evidence;
- history.

### Player rules

- At most one active player adventure.
- Discovery costs time but does not guarantee a “better” life.
- Chapters may be continued at any later time.
- Completion does not unlock a mandatory tier.
- Release carries no hidden penalty.
- Completed and released threads remain in history.

### NPC rules

NPCs may form, advance, complete, or leave threads through deterministic interest and world-state evaluation. This produces community history without requiring player observation.

## Determinism

Institution initialization, event supply, NPC participation, invitations, memberships, connections, and adventures use the seed, current state, IDs, and deterministic hash choices.

No model-generated output controls authoritative state.

## Reuse outside Living City

The engine can become a reusable AXM organ for:

- village simulations;
- club/community systems;
- school or learning-center prototypes;
- local multiplayer social hubs;
- story worlds where events continue without the player;
- agent simulations that need bounded invitations and refusal.
