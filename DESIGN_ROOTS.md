# Design Roots — AXM Living City v0.11.3

This file protects the cumulative roots of the branch. New mechanics may extend them but may not silently normalize the project into household puppeteering, optimization chores, surveillance, age pressure, or a mandatory business ladder.

# AXM Living City — Protected Design Roots

**Current package:** Interior Feedback Steward Pass v0.11.3  
**Root status:** protected. New branches may extend or challenge these roots through explicit versioning, but may not silently normalize the game into household puppeteering, age pressure, optimization chores, compulsory entrepreneurship, commute pressure, façade chores, ownership-based resident control, or a conventional quest/tycoon ladder.

## 1. One controlled life

The player directly controls one character.

Partners, children, friends, coworkers, workers, customers, tenants, mentors, visitors, and neighbors remain autonomous people. Relationship creates influence, shared history, negotiation, and responsibility—not possession.

## 2. Casual realism, not consequence-free fantasy and not a chore

Time, money, energy, housing, work, materials, distance, care, maintenance, rent, wages, and commercial costs may matter.

Realism should ground choices without demanding repetitive meter servicing. Common upkeep and travel may be compressed. The player should remain free to spend attention on expression, people, building, work, exploration, projects, quiet time, or nothing ambitious.

## 3. Ordinary life is already complete

The game must not require adventure, romance, family, ownership, career success, wealth, community membership, business, travel, personal projects, or constant self-improvement to call a life valid.

There is no universal “good life” build.

## 4. Age is context, never a countdown

The default simulation clock must not force life-stage transitions.

- No fertility clock.
- No age gate.
- No “too late.”
- No missed-life window.
- No penalty for remaining in a chapter.
- No project, enterprise, or route expiration merely because life time passed.

Choice-first life chapters are the default. Optional calendar aging may exist only as an explicit player setting. Exact ages may be shown only by explicit display choice. `agePressure` remains false.

## 5. Be yourself

Traits, skills, interests, objects, relationships, and surroundings create possibilities. They do not define a correct personality template.

A player may specialize, remain broad, change direction, work for somebody else, keep a hobby private, travel slowly, compress travel, or avoid optimization entirely.

## 6. Find your adventure

Adventure may be a local walk, a friendship, a restored chair, a question, a family moment, a tiny service, a strange creation, a quiet evening, or something not anticipated by the system.

The game should create openings, not prescribe one heroic or commercial arc.

## 7. Do not make others smaller

Other people retain autonomy, ownership, refusal, boundaries, money, labor, location, and history.

Consent in one authority layer cannot be silently reused in another. Presence is not tenancy. Relationship is not control. Property ownership is not ownership of residents. Collaboration is not ownership transfer. A customer is not a demand token. A worker is not an enterprise-owned unit. Seeing somebody’s route is not authority over their destination.

## 8. Grow in your own way

Growth may mean learning, resting, repairing, caring, earning, leaving, returning, simplifying, trying again, changing interpretation, maintaining stability, offering something occasionally, taking a walk, staying home, or releasing a direction.

No streak, productivity score, compulsory next tier, profit ladder, distance target, step target, or universal life ladder may define growth.

## 9. Expression must survive progression

An object, room, home, frontage, or enterprise should not become obsolete merely because another catalogue item has a larger number.

Objects and equipment can be repaired, upgraded, recolored, adapted, restored, and given history while retaining identity and distinct characteristics. Future exterior work must follow the same rule.

## 10. Projects and enterprises are possibilities, not obligations

A personal project requires a reason that matters to its owner. It may remain private forever.

An enterprise may be private, occasional, tiny, cooperative, paused, pivoted, closed, or never created. Completion, revenue, scale, or ownership must not create a compulsory next tier. Closure is a lifecycle choice, not automatically a failure label.

## 11. The world does not wait for the player

Homes, jobs, institutions, relationships, projects, commercial rooms, customers, enterprises, streets, and routes belong to a living world. Residents may move, choose, decorate, repair, connect, refuse, work, buy, sell, travel, and pursue their own directions.

Autonomy must remain causal and inspectable rather than magical or manipulative.

## 12. Economy must remain attributable

Money, wages, costs, deposits, leases, equipment, customers, free services, and owner withdrawals require explicit records.

No anonymous demand, fabricated customer, invisible labor, magical revenue, hidden cost, or silent ownership transfer may enter authoritative state.

## 13. Authority is scoped

Maintain explicit separation between:

- direct character control;
- adult household agreements;
- family care authority;
- property ownership and tenancy;
- object and equipment ownership;
- construction permission;
- institution membership;
- community participation;
- project collaboration;
- enterprise ownership;
- commercial occupancy;
- customer participation;
- bounded employment;
- public route access;
- exterior observation.

No accepted action silently creates broader authority.

## 14. Deterministic authority remains final

Optional AI may later propose dialogue, décor, project ideas, business concepts, schedules, routes, or frontage ideas, but the deterministic simulation validates actions, resources, ownership, permissions, customers, wages, paths, and state changes.

Subsystem random streams should be isolated when practical so adding one branch cannot silently rewrite unrelated outcomes.

## 15. Local-first, exportable, and honest

The game must remain usable offline, exportable, inspectable, and resistant to artificial gating. Migration must not invent consent, history, accomplishments, customers, sales, labor, leases, enterprises, prior journeys, or street encounters. Validation reports corruption rather than silently rewriting it.

## 16. Branch, do not silently rewrite

New directions may branch, test, and challenge. Successful pieces return through explicit versioning and merge evidence. The root remains recoverable.

## 17. Place identity survives occupants and ownership

An address, door, street connection, frontage history, and shell belong to the place. A tenant, owner, visitor, worker, customer, or passerby may affect a place only through their real scoped authority.

Changing occupants must not silently regenerate the building into a different place.

## 18. Travel attention is a player choice

Visible and compressed travel must remain equally authoritative.

- Same route.
- Same time.
- Same grounded need cost.
- No hidden visible-mode reward.
- No compression shame.
- No walking streak.
- No commute failure.
- No mandatory animation before ordinary actions.

The player may inspect a journey when it is interesting and compress it when it is not.

## 19. Observation is not obligation

A street moment may reveal life, history, or atmosphere without demanding a click, relationship, reward, response, purchase, or collection.

The city should feel alive without continuously asking the player to service it.


## 20. A shell is place continuity, not resident control

A building shell may connect address, exterior door, storey, stairs, unit entry, and interior room. That spatial continuity does not grant access, tenancy, ownership, construction authority, family authority, surveillance rights, or control over anyone inside.

Every place belongs to one shell, while people remain free to move through ordinary life.

## 21. Frontage expression requires exact bounded authority

A resident may propose a frontage change for a place they actually occupy. The request must state the exact before/after mutation and reach the correct owner authority.

- Proposal is not permission.
- Permission is not construction.
- Ownership is not direct decoration control over a tenant.
- Refusal changes neither the frontage nor the relationship.
- Accepted work requires attributable funding and phases.
- Validation failure rolls the change back without erasing the attempt.

## 22. Exterior depth must not become maintenance pressure

Roofs, windows, doors, signs, lighting, accents, and frontage history may deepen a place. They may not create an automatic upkeep streak, daily decay loop, universal appearance score, one best façade, or age-based renovation deadline.

The authoritative defaults remain:

```json
{
  "facadeMaintenanceObligation": false,
  "frontageDailyDecay": false,
  "exteriorOptimizationScore": false
}
```

## 23. Presence is evidence, not authority

Knowing where a person is in the simulation does not grant tenancy, ownership, access, storage, edit permission, construction authority, household/family/care authority, employment, or control.

A building route connects spatial facts. It does not create a right over the person using it.

## 24. Private interiors remain private

The deterministic simulation may resolve that an autonomous resident is inside a private home. The player interface must not expose an exact private room unless lawful co-presence and disclosure rules justify it.

Remote private-room visibility and surveillance-style resident tracking remain false.

## 25. Indoor attention is a player choice

Visible and compressed indoor movement use the same route, access check, time, stairs, and destination.

Watching may create atmosphere. It may not create better rewards, relationship farming, hidden skill gain, or superior outcomes.

## 26. Ordinary encounters are optional

A shared landing or room may create a small social possibility. It may not become a greeting checklist, streak, reputation test, or compulsory relationship interaction.

Quiet acknowledgment, decline, and allowing a moment to pass are valid and penalty-free.

## 27. Distant presence remains summarized

Autonomous residents outside the player’s relevant space should resolve at schedule scale. The game must not require minute-by-minute tracking of every room simply to prove the city is alive.

## 28. Arrival is separate from access

Reaching an address places a person at the entrance threshold. Entry requires its own lawful access check and indoor route. A street journey may not silently invent presence inside a home, unit, workplace, or institution.

## 29. Refusal must leave no residue disguised as neutrality

A refusal-safe action must not secretly create an empty relationship record, spend time, alter needs, move money, change housing, or widen authority. “No penalty” means no hidden structural residue unless the truthful history of the refusal itself is explicitly intended.

## 30. Animation is presentation, not proof

An animated frame may make existing rooms, objects, shells, streets, routes, and lawful presence easier or more enjoyable to perceive. It may not fabricate an action, resident location, private disclosure, reward, relationship effect, need change, time passage, or authority merely because a visual would look more alive.

- Exact people require lawful self-presence or co-presence evidence.
- Private occupants remain coarse rather than being placed for visual fullness.
- Watching creates no progression advantage.
- Full, gentle, still, and device reduced-motion choices remain valid.
- Authoritative object-use animation must wait for authoritative object-use scene state.

## 31. A replay is not current presence

A completed-moment echo may help a player remember or enjoy an activity that truthfully finished. It must remain visibly and structurally distinct from a live actor location or active scene.

- Browsing a room does not move anyone into it.
- A completed pose is labeled as after-the-fact.
- A replay does not disclose another person's private room.
- A replay cannot grant access, reward, relationship change, skill, money, or authority.
- An active object-use scene requires its own authoritative state and cannot be inferred from an echo.

## 32. Contextual convenience reuses the real engine

A room-level shortcut may make ordinary life easier to play, but it may not become a second simulation path.

- The same activity function validates and applies the same time and need effects.
- Watching or selecting an object produces no better outcome.
- Invalid room or object context creates no visual receipt.
- Contextual options are invitations, not a routine, streak, score, or maintenance checklist.
- The interface may explain why an action fits a room without declaring one optimal way to live.

## 33. Feedback reports effects; it does not create them

An after-the-fact card may summarize only changes observed around a successful ordinary-engine action.

- Measure before and after; never apply a second effect from the receipt.
- State the observation scope and leave wider autonomous evolution in the ordinary ledger.
- An absent or legacy value remains unknown rather than being fabricated.
- Watching, focusing an object, or opening its details grants no extra reward or authority.

## 34. Everyday context should make ordinary sense

Convenience choices may be permissive, but they should not become absurd merely because a matching object happens to exist in legacy data.

- Bathrooms do not suggest computer play, study, creative work, or eating.
- A basic meal may be grounded in the home/common-room context without pretending every seed owns a kitchen fixture.
- Context filters improve legibility; they do not define a correct routine or one optimal room.
