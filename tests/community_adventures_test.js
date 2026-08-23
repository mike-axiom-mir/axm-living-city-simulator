'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, Content, World, Systems, Community } = globalThis.AXM;

function newWorld(seed = 'AXM-COMMUNITY-TEST') {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  world.player.money = Math.max(world.player.money, 100_000);
  world.people.forEach((person) => {
    person.moveCooldownUntil = 9999;
    person.habitatIntentionCooldownUntil = 9999;
  });
  return world;
}

function relationSnapshot(world, personId) {
  const person = World.getPerson(world, personId);
  return Core.deepClone({
    player: world.player.relationships[personId] || null,
    reverse: person?.relationships?.player || null
  });
}

function playerStateSnapshot(world) {
  return Core.deepClone({
    money: world.player.money,
    needs: world.player.needs,
    skills: world.player.skills,
    relationships: world.player.relationships,
    homePropertyId: world.player.homePropertyId,
    ownedPropertyIds: world.player.ownedPropertyIds
  });
}

function tenantSnapshot(world) {
  return Object.fromEntries(world.places.filter((place) => place.kind === 'residential')
    .map((property) => [property.id, property.tenants.slice().sort()]));
}

function testDeterministicCommunityFoundation() {
  const a = newWorld('AXM-COMMUNITY-DETERMINISTIC');
  const b = newWorld('AXM-COMMUNITY-DETERMINISTIC');
  assert.equal(Core.serializeWorld(a), Core.serializeWorld(b));
}

function testInitialCasualRealismRootsAreActive() {
  const world = newWorld('AXM-COMMUNITY-ROOTS');
  assert.equal(world.schema, Core.SCHEMA);
  assert.equal(world.settings.casualRealism, true);
  assert.equal(world.settings.noDailyStreaks, true);
  assert.equal(world.settings.opportunityExpiryPenalty, false);
  assert.equal(world.communityInstitutions.length, 5);
  assert.ok(world.communityOpportunities.length >= 5);
  assert.equal(Content.activityById('gentle_routine').name, 'Take care of the basics');
  assert.match(world.player.activeObjective, /be yourself/i);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testV05MigrationAddsPresentInfrastructureWithoutInventedHistory() {
  const world = newWorld('AXM-COMMUNITY-MIGRATION');
  const legacy = Core.deepClone(world);
  legacy.schema = 'axm.living-city-sim.world/v0.5.0';
  legacy.version = '0.5.0';
  delete legacy.communityInstitutions;
  delete legacy.communityOpportunities;
  delete legacy.communityConnections;
  delete legacy.adventureThreads;
  delete legacy.ui.selectedCommunityInstitutionId;
  delete legacy.ui.selectedCommunityOpportunityId;
  delete legacy.ui.selectedCommunityConnectionId;
  delete legacy.ui.selectedAdventureId;
  delete legacy.flags.communityExperimentPrepared;
  delete legacy.flags.communityFoundationLogged;
  delete legacy.settings.casualRealism;
  delete legacy.settings.noDailyStreaks;
  delete legacy.settings.opportunityExpiryPenalty;
  Object.keys(legacy.metrics).filter((key) => key.startsWith('community') || key.startsWith('adventure') || key.startsWith('npcAdventure')).forEach((key) => delete legacy.metrics[key]);

  const migrated = Systems.migrateWorld(legacy);
  assert.equal(migrated.schema, Core.SCHEMA);
  assert.equal(migrated.version, Core.VERSION);
  assert.equal(migrated.communityInstitutions.length, 5);
  migrated.communityInstitutions.forEach((institution) => assert.deepEqual(institution.members, []));
  assert.deepEqual(migrated.communityOpportunities, []);
  assert.deepEqual(migrated.communityConnections, []);
  assert.deepEqual(migrated.adventureThreads, []);
  assert.equal(migrated.settings.noDailyStreaks, true);
  assert.equal(migrated.settings.opportunityExpiryPenalty, false);
  assert.equal(migrated.ledger.some((entry) => /no past membership, attendance, invitation, relationship, or adventure was fabricated/i.test(entry.message)), true);
  const validation = Systems.validateWorld(migrated);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testCasualNeedsRhythmIsGroundedButGentler() {
  const casual = newWorld('AXM-CASUAL-RHYTHM');
  const strict = newWorld('AXM-CASUAL-RHYTHM');
  casual.player.needs = { energy: 90, hunger: 90, hygiene: 90, mood: 70, social: 70 };
  strict.player.needs = Core.deepClone(casual.player.needs);
  strict.settings.casualRealism = false;
  Systems.advanceHours(casual, 6);
  Systems.advanceHours(strict, 6);
  assert.ok(casual.player.needs.hunger > strict.player.needs.hunger, 'casual hunger pressure should be gentler');
  assert.ok(casual.player.needs.hygiene > strict.player.needs.hygiene, 'casual hygiene pressure should be gentler');
  assert.ok(casual.player.needs.social > strict.player.needs.social, 'casual social pressure should be gentler');
  assert.ok(casual.player.needs.hunger < 90, 'real causes still exist');
}

function testGentleRoutineCompressesMaintenanceClicks() {
  const world = newWorld('AXM-GENTLE-ROUTINE');
  world.player.needs = { energy: 20, hunger: 20, hygiene: 20, mood: 20, social: 20 };
  const before = Core.deepClone(world.player.needs);
  const money = world.player.money;
  const day = world.time.day;
  const hour = world.time.hour;
  const result = Systems.performActivity(world, 'gentle_routine');
  assert.equal(result.ok, true, result.reason);
  assert.equal(world.player.money, money - 4);
  assert.equal((world.time.day * 24 + world.time.hour) - (day * 24 + hour), 2);
  for (const key of ['energy', 'hunger', 'hygiene', 'mood', 'social']) assert.ok(world.player.needs[key] > before[key], `${key} should improve`);
}

function testMembershipCapacityCreatesVisibleWaitlistAndPromotion() {
  const world = newWorld('AXM-COMMUNITY-CAPACITY');
  const institution = Community.institutionById(world, 'community_repair_circle');
  assert.equal(Community.activeMembers(institution).length, institution.capacity);
  const joined = Systems.requestCommunityMembership(world, institution.id);
  assert.equal(joined.ok, true);
  assert.equal(joined.status, 'waiting');
  assert.equal(Community.membershipFor(institution, 'player').status, 'waiting');
  const leaving = Community.activeMembers(institution)[0];
  leaving.status = 'left';
  leaving.leftDay = world.time.day;
  Community.processWaitlist(world, institution);
  assert.equal(Community.membershipFor(institution, 'player').status, 'active');
  assert.equal(Community.activeMembers(institution).length, institution.capacity);
}

function testLeavingMembershipAddsNoHiddenPlayerPenalty() {
  const world = newWorld('AXM-COMMUNITY-LEAVE');
  const institution = world.communityInstitutions.find((entry) => Community.activeMembers(entry).length < entry.capacity);
  assert.ok(institution);
  const joined = Systems.requestCommunityMembership(world, institution.id);
  assert.equal(joined.status, 'active');
  const before = playerStateSnapshot(world);
  const time = Core.deepClone(world.time);
  const result = Systems.leaveCommunityInstitution(world, institution.id);
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(playerStateSnapshot(world), before);
  assert.deepEqual(world.time, time);
  const record = institution.members.find((entry) => entry.personId === 'player');
  assert.equal(record.status, 'left');
}

function testOpportunityExpiryIsNotFailureOrFomoPenalty() {
  const world = newWorld('AXM-COMMUNITY-EXPIRY');
  const opportunity = world.communityOpportunities.find((entry) => entry.status === 'open');
  assert.ok(opportunity);
  world.communityOpportunities.filter((entry) => entry.id !== opportunity.id).forEach((entry) => { entry.status = 'completed'; entry.npcProcessed = true; });
  opportunity.expiresDay = world.time.day - 1;
  const before = playerStateSnapshot(world);
  Community.dailyTick(world);
  assert.equal(opportunity.status, 'expired');
  assert.deepEqual(playerStateSnapshot(world), before);
  assert.equal(opportunity.history.some((entry) => /without a hidden relationship, mood, reputation, or progression penalty/i.test(entry.message)), true);
}

function testIncomingInvitationCanBeDeclinedWithoutRelationshipPenalty() {
  const world = newWorld('AXM-COMMUNITY-DECLINE');
  const prepared = Systems.prepareCommunityAdventureExperiment(world);
  assert.equal(prepared.ok, true, prepared.reason);
  const invitation = world.communityOpportunities.find((entry) => entry.status === 'awaiting_player');
  assert.ok(invitation);
  const beforeRelation = relationSnapshot(world, invitation.hostId);
  const beforePlayer = playerStateSnapshot(world);
  const beforeTime = Core.deepClone(world.time);
  const result = Systems.respondToCommunityOpportunity(world, invitation.id, 'decline');
  assert.equal(result.ok, true, result.reason);
  assert.equal(invitation.status, 'declined');
  assert.deepEqual(relationSnapshot(world, invitation.hostId), beforeRelation);
  assert.deepEqual(playerStateSnapshot(world), beforePlayer);
  assert.deepEqual(world.time, beforeTime);
}

function testHomeVisitPreservesTenancyAndAuthorityBoundaries() {
  const world = newWorld('AXM-COMMUNITY-VISIT');
  const prepared = Systems.prepareCommunityAdventureExperiment(world);
  assert.equal(prepared.ok, true, prepared.reason);
  const invitation = world.communityOpportunities.find((entry) => entry.status === 'awaiting_player');
  assert.ok(invitation);
  Systems.respondToCommunityOpportunity(world, invitation.id, 'accept');
  const tenants = tenantSnapshot(world);
  const homes = Object.fromEntries([world.player].concat(world.people).map((person) => [person.id, person.homePropertyId]));
  const result = Systems.participateCommunityOpportunity(world, invitation.id);
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(tenantSnapshot(world), tenants);
  [world.player].concat(world.people).forEach((person) => assert.equal(person.homePropertyId, homes[person.id]));
  assert.deepEqual(invitation.authority, { tenancy: false, edit: false, storage: false, employment: false, care: false });
  assert.equal(world.player.locationId, world.player.homePropertyId);
}

function testOutgoingInvitationReceivesAutonomousDeterministicAnswer() {
  const run = () => {
    const world = newWorld('AXM-COMMUNITY-NPC-ANSWER');
    const person = world.people.find((entry) => !globalThis.AXM.Family.isDependent(entry));
    Object.assign(Systems.getRelation(world.player, person.id), { friendship: 75, trust: 70 });
    Object.assign(Systems.getRelation(person, 'player'), { friendship: 75, trust: 70 });
    const sent = Systems.inviteCommunityConnection(world, person.id);
    assert.equal(sent.ok, true, sent.reason);
    Systems.advanceHours(world, 48);
    assert.notEqual(sent.opportunity.status, 'pending_npc');
    return { status: sent.opportunity.status, history: sent.opportunity.history, relation: relationSnapshot(world, person.id) };
  };
  assert.deepEqual(run(), run());
}

function testAdventureHasNoDeadlineAndOnlyOneCanBeActive() {
  const world = newWorld('AXM-COMMUNITY-ADVENTURE');
  const first = Systems.discoverAdventure(world);
  assert.equal(first.ok, true, first.reason);
  assert.equal(first.adventure.noDeadline, true);
  const second = Systems.discoverAdventure(world);
  assert.equal(second.ok, false);
  Systems.runObserverDays(world, 120);
  assert.equal(first.adventure.status, 'active');
  assert.equal(first.adventure.stageIndex, 0);
  assert.equal(world.adventureThreads.filter((entry) => entry.ownerId === 'player' && entry.status === 'active').length, 1);
}

function testAdventureCanBeContinuedAndReleasedWithoutPenalty() {
  const world = newWorld('AXM-COMMUNITY-RELEASE');
  const discovered = Systems.discoverAdventure(world);
  assert.equal(discovered.ok, true, discovered.reason);
  const continued = Systems.continueAdventure(world, discovered.adventure.id);
  assert.equal(continued.ok, true, continued.reason);
  assert.equal(discovered.adventure.stageIndex, 1);
  const before = playerStateSnapshot(world);
  const time = Core.deepClone(world.time);
  const released = Systems.releaseAdventure(world, discovered.adventure.id);
  assert.equal(released.ok, true, released.reason);
  assert.equal(discovered.adventure.status, 'released');
  assert.deepEqual(playerStateSnapshot(world), before);
  assert.deepEqual(world.time, time);
}

function testAdventureCanCompleteWithoutCreatingMandatoryUnlock() {
  const world = newWorld('AXM-COMMUNITY-COMPLETE');
  const discovered = Systems.discoverAdventure(world);
  assert.equal(discovered.ok, true, discovered.reason);
  while (discovered.adventure.status === 'active') {
    const result = Systems.continueAdventure(world, discovered.adventure.id);
    assert.equal(result.ok, true, result.reason);
  }
  assert.equal(discovered.adventure.status, 'completed');
  assert.equal(discovered.adventure.stages.every((stage) => stage.status === 'completed'), true);
  assert.equal(world.metrics.adventureThreadsCompleted, 1);
  assert.equal(world.settings.noDailyStreaks, true);
}

function testCommunityActivityOverridesOrdinaryNpcLocationOnlyDuringEvent() {
  const world = newWorld('AXM-COMMUNITY-LOCATION');
  const template = Community.OPPORTUNITY_TEMPLATES[0];
  const opportunity = Community.createOpportunity(world, template, { eventDay: world.time.day, startHour: world.time.hour });
  assert.ok(opportunity.participantIds.length);
  const person = World.getPerson(world, opportunity.participantIds[0]);
  Systems.updateNpcSchedules(world);
  assert.equal(person.locationId, opportunity.placeId);
  assert.match(person.activity, /taking part/i);
}

function testValidationRejectsInventedCommunityAuthorityWithoutRepairingIt() {
  const world = newWorld('AXM-COMMUNITY-CORRUPTION');
  const opportunity = world.communityOpportunities[0];
  opportunity.authority.tenancy = true;
  const before = Core.serializeWorld(world);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(' | '), /may not invent tenancy/i);
  assert.equal(Core.serializeWorld(world), before);
}

function testDeterministicCommunityEvolution() {
  const run = () => {
    const world = newWorld('AXM-COMMUNITY-EVOLUTION');
    Systems.runObserverDays(world, 90);
    const validation = Systems.validateWorld(world);
    assert.equal(validation.ok, true, validation.errors.join('\n'));
    return Core.serializeWorld(world);
  };
  assert.equal(run(), run());
}

function testLabeledExperimentIsExplicitAndSingleUse() {
  const world = newWorld('AXM-COMMUNITY-EXPERIMENT');
  const beforeStarted = world.metrics.adventureThreadsStarted;
  const first = Systems.prepareCommunityAdventureExperiment(world);
  assert.equal(first.ok, true, first.reason);
  assert.equal(world.flags.communityExperimentPrepared, true);
  assert.equal(world.metrics.adventureThreadsStarted, beforeStarted + 1);
  assert.ok(Community.activeAdventureFor(world, 'player'));
  assert.equal(world.communityOpportunities.some((entry) => entry.status === 'awaiting_player'), true);
  assert.equal(world.ledger.some((entry) => /labeled community-adventure experiment/i.test(entry.message)), true);
  const second = Systems.prepareCommunityAdventureExperiment(world);
  assert.equal(second.ok, false);
}

const tests = [
  testDeterministicCommunityFoundation,
  testInitialCasualRealismRootsAreActive,
  testV05MigrationAddsPresentInfrastructureWithoutInventedHistory,
  testCasualNeedsRhythmIsGroundedButGentler,
  testGentleRoutineCompressesMaintenanceClicks,
  testMembershipCapacityCreatesVisibleWaitlistAndPromotion,
  testLeavingMembershipAddsNoHiddenPlayerPenalty,
  testOpportunityExpiryIsNotFailureOrFomoPenalty,
  testIncomingInvitationCanBeDeclinedWithoutRelationshipPenalty,
  testHomeVisitPreservesTenancyAndAuthorityBoundaries,
  testOutgoingInvitationReceivesAutonomousDeterministicAnswer,
  testAdventureHasNoDeadlineAndOnlyOneCanBeActive,
  testAdventureCanBeContinuedAndReleasedWithoutPenalty,
  testAdventureCanCompleteWithoutCreatingMandatoryUnlock,
  testCommunityActivityOverridesOrdinaryNpcLocationOnlyDuringEvent,
  testValidationRejectsInventedCommunityAuthorityWithoutRepairingIt,
  testDeterministicCommunityEvolution,
  testLabeledExperimentIsExplicitAndSingleUse
];

let passed = 0;
for (const test of tests) {
  try {
    test();
    passed += 1;
    console.log(`PASS ${test.name}`);
  } catch (error) {
    console.error(`FAIL ${test.name}`);
    console.error(error.stack || error);
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) console.log(`\n${passed}/${tests.length} community-adventure tests passed.`);
