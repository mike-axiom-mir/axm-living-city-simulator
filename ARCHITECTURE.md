# Architecture — AXM Living City v0.11.3

## Runtime shape

AXM Living City is a deterministic browser simulation with two equivalent entries:

- modular source through `index.html`;
- bundled offline source through `standalone/AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3.html`.

There is no server, model call, analytics endpoint, account, or network dependency.

## Authoritative source order

1. `src/core.js` — deterministic utilities, serialization, IDs, hashing, ledger, history.
2. `src/content.js` — templates, jobs, activities, objects, places, names, finishes.
3. `src/world.js` — world generation and authoritative people/place/object state.
4. `src/systems.js` — time, needs, jobs, schedules, housing, migration, validation.
5. `src/households.js` — adult agreements and scoped cohabitation authority.
6. `src/habitats.js` — rooms, walls, doors, utilities, construction, rollback.
7. `src/stewardship.js` — resident-authored habitat intentions and property permission.
8. `src/family.js` — care, dependents, family continuity, choice-first chapters.
9. `src/community.js` — institutions, invitations, visits, connections, adventures.
10. `src/directions.js` — undated personal projects and provenance.
11. `src/economy.js` — optional local enterprise, actual customers, bounded workers.
12. `src/exteriors.js` — exterior identity, street graph, travel records, street moments.
13. `src/shells.js` — building shells, storeys, openings, vertical routes, frontages.
14. `src/presence.js` — lawful presence, indoor movement, privacy disclosure, ordinary encounters, access grants.
15. `src/visuals.js` — pure, non-authoritative room/building/street scene derivation and motion policy.
16. `src/game.js` — persistence, action invocation, import/export, autosave migration.
17. `src/ui.js` — 18-view interface, maps, animated canvas rendering, shell/presence evidence, responsive controls.

`src/presence.js` must load after systems, habitats, exteriors, and shells. `src/visuals.js` loads after presence and before game/UI.

## v0.11.3 presentation plane

`AXM.Visuals` creates ephemeral `axm.living-city.visual-scene/v0.11.2` projections. These objects never enter the authoritative world schema.

The presentation plane is intentionally one-way:

```text
world + lawful presence + persistent objects + shell/exterior identity
→ pure visual scene derivation
→ canvas pixels
→ no state return path
```

It uses stable hashes for visual phases and placements rather than the simulation RNG. Exact people appear only through lawful co-presence. Coarse private presence remains coarse. Rendering and watching cannot advance time, consume needs, create records, or award progress.

The Living View canvas owns three visual grammars:

- `room`: persistent room graph, furniture, time-of-day light, player/co-present figures;
- `building`: shell/storeys/windows plus bounded player-route cues and coarse occupancy;
- `street`: persistent façade, public route traces, player presence, light, and ambient motion.

Motion policy is `full | gentle | still`. User Still and device reduced-motion both produce a stable frame.

## Playable-interior bridge

The Room browser adds a deliberately narrow bridge from presentation controls to the existing activity engine:

```text
room/object selection (UI only)
→ pending visual request
→ AXM.Systems.performActivity
→ ordinary authoritative time/need effects
→ success-only visual receipt
→ completed echo (presentation only)
```

The receipt schema is `axm.living-city.visual-activity-receipt/v0.11.2`. It is not stored as world history and is valid only with `source: completed_activity`, `notCurrentPresence: true`, and `noExtraReward: true`.

v0.11.3 keeps that projection schema stable and adds a backward-compatible optional `observedEffects` payload to newly created receipts. `AXM.Systems` captures a bounded player/home/object snapshot, runs the existing authoritative activity once, then computes finite numeric deltas from the completed state. The payload must declare `effectsObserved: true`, `effectScope: player_and_selected_home_context`, and `noAddedEffect: true`. Missing payloads on older v0.11.2 receipts are rendered as unknown rather than filled with invented values.

The UI may display those measured deltas and focused-object details, but the one-way boundary remains: receipt data can explain an already completed action and cannot become a source of simulation effects, presence, reward, access, or authority.

Room selection never writes presence. A browsed room that is not the player's current lawful room has no current actors. Object selection is accepted only when the object belongs to the selected room. This keeps the convenience path grounded while preserving the one-way authority boundary.

The bridge is intentionally not the v0.12 active-scene organ. There is no authoritative actor pose, remaining duration, interruption state, autonomous object-use choice, or visible/compressed action scene yet.

## v0.11 record types

`AXM.Presence` owns four versioned records:

- `axm.living-city.lived-presence/v0.11.0`;
- `axm.living-city.indoor-movement/v0.11.0`;
- `axm.living-city.ordinary-encounter/v0.11.0`;
- `axm.living-city.presence-access-grant/v0.11.0`.

World-level state:

- `world.presenceByPerson` — current snapshot by player/resident ID;
- `world.presenceRecords` — retained movement evidence;
- `world.ordinaryEncounters` — offered/responded/passed encounter history;
- `world.presenceAccessGrants` — bounded shared-space access;
- `world.presenceState` — counters, pending street handoff, experiment state;
- `world.activeIndoorMovement` — one current player-visible indoor route;
- presence settings, UI selectors, flags, and metrics.

## Presence kinds

Current snapshots may use:

- `street_threshold` — outside a real entrance; no interior access implied;
- `building_route` — landing, stair, or unit-entry route;
- `room` — a valid lawful room;
- `private_interior_coarse` — known to be inside a private place, exact room withheld.

A snapshot includes place/building/storey/route/room references only where lawful and structurally valid.

## Access pipeline

`accessFor(world, actorId, placeId)` separates spatial reachability from legal/scoped permission.

Possible legitimate bases include:

- public or scheduled access;
- current resident/tenant access;
- lawful owner access to a genuinely vacant place;
- accepted bounded visit/presence grant.

Ownership of an occupied property does not grant private entry. A visit grant cannot create tenancy, storage, editing, construction, family, care, employment, or surveillance authority.

## Arrival/departure pipeline

Arrival:

```text
street threshold
→ access check
→ shell street-access node
→ landing
→ stairs when required
→ unit entry
→ habitat entry room
```

Departure reverses the route. A visible street journey requested from indoors is stored in `presenceState.pendingStreetJourney` until departure completes. A compressed journey resolves departure first and then delegates to `AXM.Exteriors`.

## Indoor movement model

Movement records contain:

- actor, place, building, kind, and mode;
- authoritative ordered route steps;
- elapsed/total minutes;
- stair count;
- access basis and authority-denial flags;
- visible/compressed/schedule evidence;
- history and completion state.

Room transitions derive from `AXM.Habitats` room-door connectivity and permission. Visible and compressed execution share the same route and cost.

## Privacy disclosure

`visiblePeople`/disclosure helpers expose exact presence only through lawful co-presence. Remote private interiors remain coarse. The UI never uses the simulation’s internal schedule resolution as a blanket permission to reveal private room state.

Authoritative false settings include:

```json
{
  "compulsoryGreetings": false,
  "presenceWatchingReward": false,
  "presenceSurveillance": false,
  "remotePrivateRoomVisibility": false,
  "presenceViewCreatesRewards": false,
  "minuteByMinutePresenceTax": false,
  "continuousRoomTracking": false,
  "socialChecklist": false,
  "presenceMovementObligation": false
}
```

## Ordinary encounter model

An encounter may be offered only from a grounded shared-space overlap. Responses:

- `greet` — explicit five-minute action and bounded social effect;
- `quiet` — no time, money, needs, or relationship mutation;
- `decline` — no time, money, needs, or relationship mutation;
- automatic pass — no penalty.

The response is truthful history, not authority expansion.

## Autonomous schedule resolution

NPC presence hooks into hourly schedule updates. Distant movement uses `schedule` mode and does not require per-minute rendering. Detailed retained records are bounded; current snapshots remain authoritative.

## Persistence and migration

The authoritative world schema is `axm.living-city-sim.world/v0.11.0`.

v0.10 migration derives a current presence snapshot from present lawful location, tenancy, public schedule, shell, and habitat facts. It creates no fabricated earlier arrivals, departures, room visits, encounters, greetings, grants, surveillance, or movement history.

Current v0.11 round trips preserve serialized state exactly. Validation is diagnostic-only and must not initialize or repair the state it is checking.

## User interface

The 18 views are:

1. Town
2. Street Life
3. Buildings
4. Lived Buildings
5. Living View
6. One Life
7. Build & Home
8. People
9. Agreements
10. Family
11. Community
12. Directions
13. Local Economy
14. Stewardship
15. Workday
16. Housing
17. World Ledger
18. Observer Lab

The Lived Buildings view renders privacy-safe current presence, indoor route/stair evidence, lawful entry/exit/room controls, ordinary encounters, active grants, and explicit no-obligation roots.

Living View renders privacy-bounded Room, Building, and Street scenes. Room mode also exposes the player's own home rooms, persistent-object focus, grounded ordinary activities, and labeled completed-moment echoes.
