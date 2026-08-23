# Personal Directions Engine v0.7.0

## Purpose

Create long-lived, self-authored directions without turning life into a quest log, productivity streak, or age timetable.

A project is not proof of a good life. Ordinary life remains complete without one.

## Project lifecycle

```text
create
→ active
→ pause / resume / reshape / collaborate
→ complete or release
→ optional archive
```

No state is called failed merely because the owner changed direction.

## Project templates

- Restoration — existing owned object.
- Making — existing place.
- Creative — existing place.
- Collection — existing place.
- Garden — existing place.
- Research — existing place.
- Local journey — existing place.
- Learning — existing place.

Each template currently contains three authored chapters. Chapters use deterministic resources and effects.

## Required record fields

Every project records:

- stable ID and owner;
- template and type;
- title and personal meaning;
- status and timestamps;
- `noDeadline: true`;
- `noAgeGate: true`;
- `ageGate: null`;
- life chapter at creation without exact-age requirement;
- real target and provenance;
- ordered chapter records;
- collaborator IDs and invitation records;
- reshapes;
- resource evidence;
- append-only project history.

## Real resources

Player project work may consume:

- world time;
- money;
- materials;
- energy and other needs;
- skill effects.

If required materials or money are missing, the chapter waits. Nothing expires.

Object targets are revalidated before any cost is taken.

## Restoration

Restoration may target only an object that:

- exists;
- is owned by the project owner;
- is not a property fixture;
- is in a real property or the owner’s storage.

Each restoration chapter appends to the same object’s history and changes condition or sentiment. It never silently replaces the object or transfers ownership.

## Pause

Pause preserves:

- status and completed chapters;
- title and meaning;
- money already spent;
- materials already used;
- object interventions;
- skills already learned;
- project history.

Pause itself changes no mood, skill, relationship, reputation, or age value.

## Reshape

Reshape changes the current title and meaning while retaining the previous interpretation in `reshapes`. Completed chapters are not undone.

## Complete

Completion requires all chosen chapters. It creates history, not a mandatory unlock or superior life rank.

## Release

Release ends an open direction without labeling it failure. Completed work and provenance remain. No hidden player penalty is applied.

## Archive

Completed and released projects can be archived for organization. The archive records the earlier terminal state rather than flattening completed and released into the same meaning.

## Autonomous resident policy

Residents periodically evaluate project templates against:

- traits;
- skills;
- personal goals;
- owned objects;
- current places;
- recent project history;
- deterministic seeded variation.

They may create and advance projects through the same records and object authority checks.

## Validation

The validator rejects:

- duplicate project IDs;
- unknown owners or collaborators;
- unknown templates or statuses;
- deadlines or age gates;
- missing exact-age-free life context;
- missing or unauthorized targets;
- invalid chapter progress;
- invalid resource totals;
- person-to-project index corruption.

It diagnoses invalid state without silently rewriting it.
