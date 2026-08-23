# Autonomous Habitat Shaper v0.4.0

## Purpose

This organ lets a resident become an understandable author of the home they inhabit without giving them unrestricted mutation access, a hidden LLM controller, or player ownership.

It converts resident state and habitat evidence into one bounded intention that must survive finance, authority, construction, and validation.

## Input evidence

The candidate generator may read:

- resident current home and tenancy;
- room graph, room purpose, surfaces, utilities, and condition;
- resident-owned objects and where they are located;
- resident preferences and personal goal;
- creativity, neatness, stability, repair, cooking, and related compact traits/skills;
- money, arrears, and stewardship reliability;
- active construction target locks;
- deterministic world seed and current day.

It may not read private external data or call an online model.

## Candidate kinds

### Surface

A resident may prefer a different wall/floor finish in a room where they hold belongings or spend meaningful time. Preference is one cause, not a command. Current condition, creativity, goal, and deterministic variation also matter.

### Repair

Structural/property condition can create a restoration intention. Repair has a higher external-owner approval priority because it protects the property rather than only changing style.

### Utility

A resident may request lawful power, water, or waste access for a room whose intended use makes that service meaningful.

### Partition

Bounded wall/door/open-edge changes may be proposed only when the habitat validator accepts the exact target as a possible project. The resident never writes a partition directly.

## Selection

- Invalid candidates are discarded before scoring.
- Targets already controlled by active projects are discarded.
- Candidate reasons and score evidence are retained.
- One highest lawful candidate may become an intention.
- One resident can have only one non-terminal intention.
- Cooldowns prevent constant re-evaluation and churn.

The score is not presented as moral truth or psychological diagnosis. It is a compact deterministic decision aid.

## Intention statuses

```text
saving
awaiting_permission
approved_saving
ready
working
completed
declined
withdrawn
failed
```

### `saving`

The resident has an intention and is accumulating visible funds. No request may exist yet.

### `awaiting_permission`

The request threshold has been reached and an exact request is waiting for required people or owner policy.

### `approved_saving`

Permission is complete, but the total budget is not. The resident continues saving.

### `ready`

Funds and materials are available and the linked construction project may be created/advanced.

### `working`

A resident-authored project exists and phases are being completed.

### Terminal states

- `completed`: every phase and invariant passed;
- `declined`: an authority refused the exact request;
- `withdrawn`: the resident moved, deadline passed, or no longer pursued the change;
- `failed`: the authorized work could not lawfully complete.

## No direct habitat mutation

The organ may create an intention, request, funding evidence, and authorized project. It may not directly:

- change a room finish;
- add/remove a wall or door;
- grant utilities;
- move another person’s object;
- change a layout hash;
- mark a project completed.

All physical changes pass through `AXM.Habitats`.

## Property history

A completed resident intention is indexed in the property stewardship record and remains attributable to the resident. Declined, withdrawn, and failed attempts remain visible through request/intention/property history where relevant.

## Reusable AXM value

This organ is more general than a life-sim décor feature. Its pattern is:

```text
agent notices grounded need
→ forms explainable bounded intention
→ resolves authority
→ accumulates resources
→ invokes validated capability
→ returns evidence/outcome
```

The same shape could support autonomous workshop maintenance, village improvements, robot self-care, or bounded AI habitat management without granting broad control.
