# Next Build Roadmap — after v0.11.3

## Recommended branch

**Lived Rooms and Object-Use Scenes v0.12.0**

## Why now

The city already knows:

- who people are and which life belongs to the player;
- which objects they own, value, repair, upgrade, and remember;
- which rooms exist and which doors connect them;
- which place, shell, storey, landing, stair, and unit contains those rooms;
- who may lawfully enter and what presence may be disclosed;
- how visible and compressed movement remain equally authoritative.
- how to derive a non-authoritative Room, Building, or Street visual grammar without mutating the world or advancing simulation randomness.
- how to browse the player's real home rooms, focus persistent objects, and route contextual choices through the existing completed-activity engine.
- how to show a success-only completed-moment echo without presenting it as current presence or an extra reward.
- how to report bounded, actually observed player/home/object effects without applying them twice or fabricating legacy values.
- how to show useful object details and bridge to Build & Home without widening authority.
- how to filter contextual choices when legacy object placement would make them implausible.

The strongest missing layer is not another management screen. It is making the existing rooms and persistent objects visibly useful: sitting, reading, cooking, repairing, creating, playing, resting, listening, and doing small side activities without turning life into a perfect-routine checklist.

## First bounded experiment

```text
one student room
+ one shared bathroom
+ one small-house common room
+ one shop or community institution
+ real object-use positions
+ sit/read/cook/repair/create/play/rest scenes
+ one autonomous resident choosing a scene
+ visible, partly visible, or compressed execution
+ privacy, room access, and object authority
+ optional object-use history
```

## Stages

1. **Object affordances** — map existing objects to bounded actions and lawful use positions without creating one statistically correct object.
2. **Scene state** — record actor, object, room, action, time, mode, purpose, and provenance.
3. **Visible/compressed parity** — watching, partial watching, and compression use the same time, cost, state change, and authority.
4. **Autonomous use** — residents choose grounded scenes from schedules, needs, interests, relationships, skills, and available objects.
5. **Privacy and permission** — private scenes remain undisclosed remotely; object and room authority remain scoped.
6. **Object history** — meaningful use may add bounded history without turning normal use into durability chores.
7. **Authoritative visual binding** — bind the existing low-graphic pose and motion grammar to real scene state only after affordance, permission, duration, privacy, and visible/compressed parity exist.

The v0.11.3 room shortcuts complete existing compressed activities immediately and then show measured after-the-fact feedback. They are useful interaction affordances, not active object-use scenes. Do not promote ambient motion, an observed delta, or a completed echo into current scene history, extra skill progress, money, relationship change, or authority.

## Deferred

- perfect daily routines;
- mandatory need servicing;
- continuous animation of every resident;
- relationship farming by watching;
- remote private-room scenes;
- high-detail character rigs;
- one optimal furniture arrangement;
- object-use streaks, battle passes, or artificial gating;
- weather and environmental atmosphere until the room-use foundation is stable.

## Merge gates

- one directly controlled life remains;
- autonomous residents remain autonomous;
- `agePressure` remains false;
- no routine, social, or observation checklist;
- visible mode grants no hidden reward;
- compression remains fully valid;
- object identity and ownership are preserved;
- private scenes remain private;
- presence and object use grant no wider authority;
- no object loss or silent replacement;
- local export remains inspectable;
- deterministic replay remains stable.
