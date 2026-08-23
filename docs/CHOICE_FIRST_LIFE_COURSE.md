# Choice-First Life Course Contract v0.7.0

## Purpose

Time should create history without deciding that a person has missed their life.

The default life-course model therefore separates:

- **simulation time** — days and hours in the living world;
- **life chapter** — broad context such as child, teen, young adult, adult, or elder;
- **exact numeric age** — compatibility data that may be hidden and frozen;
- **choice authority** — who may explicitly open a later chapter.

## Default state

```json
{
  "lifeCourseMode": "choice",
  "showExactAges": false,
  "agePressure": false
}
```

## Choice mode

A daily tick:

- increments `chapterDays`;
- does not change `age`;
- does not change `ageYears`;
- does not change `ageDays`;
- does not change `stage`;
- creates no fertility clock, age gate, missed window, or “too late” state.

The focused suite proves this across 400 days for every tracked person in a fresh world.

## Explicit chapter transitions

`advanceLifeChapter(world, personId)` may be used only when the world is in choice mode.

Current authority:

- the player may choose their own next chapter;
- the player may choose a dependent’s next chapter through family continuity;
- the player may not advance an autonomous adult partner or unrelated resident;
- the Elder chapter remains open-ended.

A transition records:

- from and to chapters;
- day;
- actor;
- `mode: choice`;
- `noDeadline: true`;
- `noMissedWindow: true`.

It preserves:

- person ID;
- objects and storage;
- relationships;
- family links;
- home and property history;
- care and education evidence;
- open personal projects;
- project targets and completed chapters.

## Optional calendar mode

A player may explicitly enable `calendar` mode.

This mode retains the earlier age-day progression for players who want calendar realism. Enabling it is logged and reversible. It does not change `agePressure`, which remains false.

Calendar mode is not the default, is not required for progression, and creates no project age gates.

## Exact-age display

Exact age labels are hidden by default. The display may be toggled without changing the simulation state.

This is not data erasure. Numeric age fields remain in the save for compatibility and migration integrity.

## Migration

A v0.6 save retains its existing stage and numeric age values. Migration changes the default mode to choice-first, hides exact age labels, and records that no elapsed life or transition was fabricated.

## Validation invariants

A valid v0.7 world requires:

- `lifeCourseMode` is `choice` or `calendar`;
- `agePressure` is exactly `false`;
- `showExactAges` is boolean;
- every person has a valid chapter;
- every life-course record has choice history and transition history arrays;
- no personal project contains an age gate.

## Known limitation

Autonomous adults do not yet self-author chapter transitions in choice mode. They remain in their current chapter until a future autonomous life-direction engine adds explicit self-chosen transitions. The player cannot make that choice for them.
