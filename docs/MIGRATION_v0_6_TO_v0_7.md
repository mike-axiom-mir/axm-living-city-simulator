# Migration Contract — v0.6 to v0.7

## Source

`axm.living-city-sim/world/v0.6.0`

## Target

`axm.living-city-sim/world/v0.7.0`

## Preserved

- people and stable IDs;
- exact numeric ages and existing life stages;
- homes, ownership, tenancy, furniture, storage, and object history;
- jobs, money, needs, skills, traits, and relationships;
- household agreements, proposals, conflicts, and history;
- structural habitats and construction evidence;
- stewardship intentions, requests, escrow, and property history;
- family units, care, education, and continuity;
- community institutions, memberships, opportunities, visits, connections, and adventures;
- ledger history.

## Added empty

- `personalProjects`;
- each person’s `personalProjectIds`;
- project cooldowns;
- project metrics;
- directions UI selection;
- directions QA flags.

## Life-course correction

Migration retains each person’s current stage and age values, then sets:

```json
{
  "lifeCourseMode": "choice",
  "showExactAges": false,
  "agePressure": false
}
```

It also adds `chapterDays`, choice history, and display/mode fields where absent.

## Explicit non-invention

Migration must not fabricate:

- a personal project;
- a completed chapter;
- a collaboration;
- an achievement;
- elapsed life in the new mode;
- a chapter choice;
- consent or authority.

The migration ledger states this explicitly.

## Rollback principle

Keep the original v0.6 export. Migration is versioned and deterministic, but a user should retain the source save as a rollback point.
