'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Family, Community } = globalThis.AXM;
const ALL_SEEDS = Array.from({ length: 8 }, (_, index) => `AXM-COMMUNITY-STRESS-${String(index + 1).padStart(2, '0')}`);
const SEED_START = Math.max(1, Number.parseInt(process.env.AXM_COMMUNITY_STRESS_START || '1', 10));
const SEED_COUNT = Math.max(1, Math.min(8, Number.parseInt(process.env.AXM_COMMUNITY_STRESS_COUNT || '8', 10)));
const SEEDS = ALL_SEEDS.slice(SEED_START - 1, SEED_START - 1 + SEED_COUNT);
const DAYS = 240;

function objectIds(world) {
  const ids = new Set();
  world.places.filter((place) => place.kind === 'residential').forEach((property) => property.furniture.forEach((object) => ids.add(object.id)));
  [world.player].concat(world.people).forEach((person) => (person.storedFurniture || []).forEach((object) => ids.add(object.id)));
  return ids;
}

function ordinal(id) {
  return Number(String(id).split('_').at(-1)) || 0;
}

function run(seed, seedIndex) {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  world.player.money = 2_000_000;
  const initialObjects = objectIds(world);
  const targetDay = world.time.day + DAYS;
  const counters = {
    playerJoins: 0,
    playerLeaves: 0,
    playerParticipations: 0,
    acceptedInvites: 0,
    declinedInvites: 0,
    adventuresDiscovered: 0,
    adventureStages: 0,
    adventuresReleased: 0,
    outgoingInvites: 0,
    checkpoints: 0
  };

  while (world.time.day < targetDay) {
    const incoming = world.communityOpportunities.filter((entry) => entry.status === 'awaiting_player');
    incoming.forEach((opportunity) => {
      const accept = (seedIndex + ordinal(opportunity.id) + world.time.day) % 3 !== 0;
      const response = Systems.respondToCommunityOpportunity(world, opportunity.id, accept ? 'accept' : 'decline');
      assert.equal(response.ok, true, response.reason);
      if (accept) counters.acceptedInvites += 1;
      else counters.declinedInvites += 1;
    });

    if (world.time.day % 29 === (seedIndex * 3) % 29) {
      const institution = world.communityInstitutions[(world.time.day + seedIndex) % world.communityInstitutions.length];
      if (!Community.membershipFor(institution, 'player')) {
        const result = Systems.requestCommunityMembership(world, institution.id);
        if (result.ok) counters.playerJoins += 1;
      }
    }

    if (world.time.day % 47 === (seedIndex * 5 + 3) % 47) {
      const institution = world.communityInstitutions.find((entry) => Community.membershipFor(entry, 'player'));
      if (institution) {
        const result = Systems.leaveCommunityInstitution(world, institution.id);
        if (result.ok) counters.playerLeaves += 1;
      }
    }

    const activeAdventure = Community.activeAdventureFor(world, 'player');
    if (!activeAdventure && world.time.day % 23 === (seedIndex + 2) % 23) {
      const result = Systems.discoverAdventure(world);
      if (result.ok) counters.adventuresDiscovered += 1;
    } else if (activeAdventure && world.time.day % 7 === (seedIndex + 1) % 7) {
      if ((ordinal(activeAdventure.id) + seedIndex) % 5 === 0 && activeAdventure.stageIndex >= 1) {
        const result = Systems.releaseAdventure(world, activeAdventure.id);
        if (result.ok) counters.adventuresReleased += 1;
      } else {
        const result = Systems.continueAdventure(world, activeAdventure.id);
        if (result.ok) counters.adventureStages += 1;
      }
    }

    if (world.time.day % 13 === (seedIndex + 4) % 13) {
      const opportunity = world.communityOpportunities
        .filter((entry) => ['open', 'available'].includes(entry.status) && entry.eventDay >= world.time.day && entry.eventDay <= world.time.day + 3)
        .sort((a, b) => a.eventDay - b.eventDay || a.startHour - b.startHour)[0];
      if (opportunity) {
        const result = Systems.participateCommunityOpportunity(world, opportunity.id);
        if (result.ok && !result.waitlisted) counters.playerParticipations += 1;
      }
    }

    if (world.time.day % 31 === (seedIndex + 7) % 31) {
      const connection = world.communityConnections.find((entry) => entry.status === 'active' && entry.personIds.includes('player'));
      const personId = connection?.personIds.find((id) => id !== 'player');
      const person = personId ? World.getPerson(world, personId) : null;
      if (person && !Family.isDependent(person)) {
        const result = Systems.inviteCommunityConnection(world, personId);
        if (result.ok) counters.outgoingInvites += 1;
      }
    }

    Systems.advanceHours(world, 24);
    if (world.time.day % 20 === 0) {
      const validation = Systems.validateWorld(world);
      assert.equal(validation.ok, true, `${seed} day ${world.time.day}: ${validation.errors.join('\n')}`);
      counters.checkpoints += 1;
    }
  }

  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  const finalObjects = objectIds(world);
  initialObjects.forEach((id) => assert.equal(finalObjects.has(id), true, `${seed}: object ${id} disappeared`));
  assert.equal(world.settings.noDailyStreaks, true);
  assert.equal(world.settings.opportunityExpiryPenalty, false);
  assert.ok(world.metrics.communityOpportunitiesGenerated >= 20, `${seed}: too few community possibilities`);
  assert.ok(world.metrics.communityNpcParticipations > 0, `${seed}: residents never participated`);
  assert.ok(world.communityConnections.length > 0, `${seed}: no community connections formed`);
  assert.ok(world.adventureThreads.some((entry) => entry.ownerId !== 'player'), `${seed}: no autonomous resident adventure emerged`);
  assert.ok(counters.adventuresDiscovered > 0, `${seed}: player discovered no adventure`);
  assert.ok(counters.playerParticipations > 0, `${seed}: player participated in no community moment`);

  return { world, counters, serialized: Core.serializeWorld(world) };
}

const rows = [];
SEEDS.forEach((seed, seedIndex) => {
  const first = run(seed, seedIndex);
  const second = run(seed, seedIndex);
  assert.equal(first.serialized, second.serialized, `${seed}: community evolution was not byte-deterministic`);
  rows.push({
    seed,
    ...first.counters,
    opportunities: first.world.metrics.communityOpportunitiesGenerated,
    npcParticipations: first.world.metrics.communityNpcParticipations,
    playerParticipations: first.world.metrics.communityPlayerParticipations,
    expiries: first.world.metrics.communityOpportunityExpiries,
    connections: first.world.communityConnections.length,
    mentorLinks: first.world.communityConnections.filter((entry) => entry.kind === 'mentor').length,
    visits: first.world.metrics.communityVisitsCompleted,
    adventureThreads: first.world.adventureThreads.length,
    adventureCompletions: first.world.adventureThreads.filter((entry) => entry.status === 'completed').length,
    adventureReleases: first.world.adventureThreads.filter((entry) => entry.status === 'released').length
  });
});

const totals = rows.reduce((acc, row) => {
  Object.entries(row).forEach(([key, value]) => {
    if (typeof value === 'number') acc[key] = (acc[key] || 0) + value;
  });
  return acc;
}, {});

console.log(`PASS community stress: ${SEEDS.length} deterministic worlds × ${DAYS} days, each executed twice.`);
console.log(JSON.stringify({
  seeds: SEEDS.length,
  daysPerSeed: DAYS,
  totals,
  rows
}, null, 2));
