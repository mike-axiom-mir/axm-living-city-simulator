# Migration Contract — v0.7.0 to v0.8.0

## Source

`axm.living-city-sim.world/v0.7.0`

## Target

`axm.living-city-sim.world/v0.8.0`

## Preserved without reinterpretation

- people and player identity;
- homes, objects, ownership, storage, and history;
- jobs, money, needs, skills, and relationships;
- household agreements, proposals, issues, reserves, and permissions;
- habitats, construction projects, and room graphs;
- stewardship intentions, requests, funding, and outcomes;
- family units, dependents, care, education, and continuity;
- institutions, opportunities, connections, visits, and adventures;
- personal projects, object provenance, collaboration, and release history;
- choice-first life settings and exact stored ages.

## Added as current infrastructure

- four commercial rooms;
- six current local-need signals;
- empty enterprise containers where absent;
- empty enterprise-session and work-offer containers;
- enterprise IDs on people;
- economy settings, flags, metrics, UI state, and random stream.

## Not fabricated

Migration creates no past:

- enterprise;
- customer;
- sale or revenue;
- cost or profit;
- work session;
- employee or wage;
- commercial lease;
- equipment;
- closure or success;
- business-related relationship;
- age or life transition.

Commercial rooms and need signals are present-day infrastructure, not invented history.

## Validation

After migration, the full v0.8 validator must pass. Invalid legacy state is diagnosed rather than silently rewritten outside the explicit migration contract.
