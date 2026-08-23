'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'src/core.js'));
require(path.join(ROOT, 'src/content.js'));
require(path.join(ROOT, 'src/world.js'));
require(path.join(ROOT, 'src/systems.js'));
require(path.join(ROOT, 'src/households.js'));
require(path.join(ROOT, 'src/habitats.js'));
require(path.join(ROOT, 'src/stewardship.js'));
require(path.join(ROOT, 'src/family.js'));
require(path.join(ROOT, 'src/community.js'));
require(path.join(ROOT, 'src/directions.js'));
require(path.join(ROOT, 'src/economy.js'));
require(path.join(ROOT, 'src/exteriors.js'));
require(path.join(ROOT, 'src/shells.js'));
require(path.join(ROOT, 'src/presence.js'));

const { Core, World, Systems, Households, Content } = globalThis.AXM;

function newWorld(seed = 'AXM-HOUSEHOLD-TEST') {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  // Tests reserve the initial housing layout so unrelated NPC movement cannot
  // accidentally steal a selected experiment home while a proposal is pending.
  world.people.forEach((person) => { person.moveCooldownUntil = 9999; });
  return world;
}

function maxRelationship(world, npc) {
  const relation = Systems.getRelation(world.player, npc.id);
  relation.friendship = 100;
  relation.trust = 100;
  relation.romance = 100;
  relation.status = 'dating';
  relation.interactions = Math.max(5, relation.interactions);
  const reverse = Systems.getRelation(npc, 'player');
  reverse.friendship = 100;
  reverse.trust = 100;
  reverse.romance = 100;
  reverse.status = 'dating';
  return relation;
}

function advanceProposal(world, proposal, maxHours = 120) {
  let elapsed = 0;
  while (['pending_npc'].includes(proposal.status) && elapsed < maxHours) {
    Systems.advanceHours(world, 1);
    elapsed += 1;
  }
  assert.notEqual(proposal.status, 'pending_npc', `proposal ${proposal.id} did not resolve within ${maxHours} hours`);
  return proposal;
}

function establishPartnership(seed = 'AXM-HH-PARTNER') {
  const world = newWorld(seed);
  const prep = Systems.prepareHouseholdExperiment(world);
  assert.equal(prep.ok, true, prep.reason);
  const npc = World.getPerson(world, prep.npcId);
  maxRelationship(world, npc);
  const proposed = Systems.proposeCommitment(world, npc.id);
  assert.equal(proposed.ok, true, proposed.reason);
  advanceProposal(world, proposed.proposal);
  assert.equal(proposed.proposal.status, 'implemented', JSON.stringify(proposed.proposal.response));
  const household = Households.playerHousehold(world);
  assert.ok(household, 'accepted commitment should create an active household agreement');
  return { world, npc, household, commitment: proposed.proposal };
}

function establishCohabitation(seed = 'AXM-HH-COHABIT', options = {}) {
  const state = establishPartnership(seed);
  const { world, npc, household } = state;
  world.player.money = Math.max(world.player.money, 10000);
  npc.money = Math.max(npc.money, 10000);
  maxRelationship(world, npc);
  let destination = null;
  if (options.requirePrivateRooms) {
    const candidate = world.places.find((property) => property.kind === 'residential'
      && property.capacity >= 2
      && property.habitat.rooms.filter((room) => !['bathroom', 'entry'].includes(room.purpose)).length >= 2
      && !property.tenants.includes('player'));
    assert.ok(candidate, 'test world should expose a multi-room property');
    const householdMembers = new Set(household.memberIds);
    for (const tenantId of candidate.tenants.slice()) {
      if (householdMembers.has(tenantId)) continue;
      const tenant = World.getPerson(world, tenantId);
      const vacancy = world.places.find((property) => property.kind === 'residential'
        && property.id !== candidate.id
        && property.tenants.length === 0
        && property.capacity >= 1
        && property.listedForRent);
      assert.ok(vacancy, 'test setup needs a lawful vacancy for an existing resident');
      const relocation = Systems.moveNpc(world, tenant, vacancy, { waiveCost: true, causes: ['deterministic room-permission test setup'] });
      assert.equal(relocation.ok, true, relocation.reason);
    }
    destination = Households.eligibleJointMoveProperties(world, household).find((property) => property.id === candidate.id);
  } else {
    destination = Households.eligibleJointMoveProperties(world, household).find((property) => property.tenants.length === 0);
  }
  assert.ok(destination, 'test world should expose a vacant pair-capable home');
  const objectIdsBeforeMove = personalObjectLocations(world, ['player', npc.id]);
  const proposed = Systems.proposeCohabitation(world, npc.id, destination.id);
  assert.equal(proposed.ok, true, proposed.reason);
  advanceProposal(world, proposed.proposal);
  assert.equal(proposed.proposal.status, 'implemented', JSON.stringify(proposed.proposal.response));
  return { ...state, destination, cohabitation: proposed.proposal, objectIdsBeforeMove };
}

function personalObjectLocations(world, ownerIds) {
  const ids = new Set(ownerIds);
  const result = [];
  world.places.filter((place) => place.kind === 'residential').forEach((property) => {
    property.furniture.filter((object) => object.ownershipMode !== 'property_fixture' && ids.has(object.ownerId))
      .forEach((object) => result.push(object.id));
  });
  ownerIds.forEach((id) => {
    const person = World.getPerson(world, id);
    (person.storedFurniture || []).forEach((object) => result.push(object.id));
  });
  return result.sort();
}

function testLegacyMigrationIsExplicitAndNoConsentIsInvented() {
  const current = newWorld('AXM-LEGACY-MIGRATION');
  const npc = current.people[0];
  const relation = Systems.getRelation(current.player, npc.id);
  relation.status = 'partner';
  relation.friendship = 72;
  relation.trust = 66;
  relation.romance = 58;
  const legacy = Core.deepClone(current);
  legacy.schema = 'axm.living-city-sim.world/v0.1.0';
  legacy.version = '0.1.0';
  delete legacy.households;
  delete legacy.householdProposals;
  delete legacy.householdIssues;
  delete legacy.player.householdId;
  delete legacy.player.storedFurniture;
  legacy.people.forEach((person) => {
    delete person.householdId;
    delete person.householdInitiativeCooldownUntil;
    delete person.storedFurniture;
  });
  legacy.places.filter((place) => place.kind === 'residential').forEach((property) => {
    delete property.rentBasis;
    delete property.utilitiesIncluded;
    delete property.weeklyUtilityBase;
  });

  const parsed = Core.parseWorld(Core.serializeWorld(legacy));
  const migrated = Systems.migrateWorld(parsed);
  assert.equal(migrated.schema, Core.SCHEMA);
  assert.equal(migrated.version, Core.VERSION);
  assert.deepEqual(migrated.households, [], 'migration must not fabricate a consent agreement from a legacy relationship label');
  assert.equal(migrated.player.relationships[npc.id].status, 'partner', 'legacy relationship state should remain visible');
  assert.ok(migrated.ledger.some((entry) => entry.type === 'migration' && entry.message.includes('no household consent agreement was invented')));
  const validation = Systems.validateWorld(migrated);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testCommitmentIsDelayedConsentNotImmediateControl() {
  const world = newWorld('AXM-COMMITMENT-CONSENT');
  const prep = Systems.prepareHouseholdExperiment(world);
  const npc = World.getPerson(world, prep.npcId);
  maxRelationship(world, npc);
  const beforePlayerMoney = world.player.money;
  const result = Systems.proposeCommitment(world, npc.id);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.proposal.status, 'pending_npc');
  assert.equal(Households.playerHousehold(world), null, 'sending a proposal cannot create consent');
  assert.equal(world.player.relationships[npc.id].status, 'dating');
  advanceProposal(world, result.proposal);
  const household = Households.playerHousehold(world);
  assert.equal(result.proposal.status, 'implemented');
  assert.ok(household);
  assert.equal(household.agreement.finances.personalAccountsRemainSeparate, true);
  assert.equal(household.agreement.finances.sharedReserveRequiresMutualConsent, true);
  assert.equal(world.player.householdId, household.id);
  assert.equal(npc.householdId, household.id);
  assert.equal(world.player.money, beforePlayerMoney, 'commitment itself must not silently merge or drain player funds');
  assert.equal(household.sharedReserve, 0, 'commitment must not manufacture shared funds');
  assert.notEqual(world.player.money, npc.money, 'separate accounts should remain independently valued');
  assert.equal(npc.isPlayerControlled, false);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testCohabitationMovesBothPeopleWithoutObjectLossOrBoundaryViolations() {
  const { world, npc, household, destination, objectIdsBeforeMove } = establishCohabitation('AXM-COHABIT-OBJECTS');
  // The helper has already completed the move; use history evidence to verify it
  // was an explicit joint relocation rather than direct NPC manipulation.
  assert.equal(world.player.homePropertyId, destination.id);
  assert.equal(npc.homePropertyId, destination.id);
  assert.deepEqual(new Set(destination.tenants), new Set(['player', npc.id]));
  assert.equal(household.homePropertyId, destination.id);
  assert.equal(household.agreement.space.zones.length, 3);
  assert.deepEqual(household.agreement.space.zones.map((zone) => zone.kind), ['player_private', 'common', 'partner_private']);
  assert.ok(household.history.some((entry) => entry.type === 'relocation'));

  destination.furniture.filter((object) => object.ownershipMode !== 'property_fixture' && ['player', npc.id].includes(object.ownerId)).forEach((object) => {
    const permission = object.ownerId === 'player'
      ? Households.canPlacePlayerObject(world, destination, object, object.position.x, object.position.y, object.footprint)
      : Households.canPlaceNpcObject(world, destination, npc.id, object, object.position.x, object.position.y, object.footprint);
    assert.equal(permission.ok, true, `${object.id}: ${permission.reason}`);
  });
  const afterIds = personalObjectLocations(world, ['player', npc.id]);
  assert.deepEqual(afterIds, objectIdsBeforeMove, 'joint relocation must move or store objects, never delete them');
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testPrivateZoneAndJointMoveAuthorityAreEnforced() {
  const { world, npc, household, destination } = establishCohabitation('AXM-PRIVATE-ZONES', { requirePrivateRooms: true });
  const partnerPermission = household.agreement.space.roomPermissions.find((entry) => entry.kind === 'partner_private');
  const partnerRoom = globalThis.AXM.Habitats.roomById(destination, partnerPermission?.roomId);
  const object = destination.furniture.find((entry) => entry.ownerId === 'player' && entry.ownershipMode !== 'property_fixture' && entry.footprint[0] === 1 && entry.footprint[1] === 1);
  assert.ok(object && partnerPermission && partnerRoom);
  let target = null;
  for (const key of partnerRoom.cells) {
    const cell = globalThis.AXM.Habitats.parseCellKey(key);
    if (World.positionFits(destination, destination.furniture, cell.x, cell.y, object.footprint, object.id)) {
      target = cell;
      break;
    }
  }
  assert.ok(target, 'test requires one open partner-private room cell');
  const original = Core.deepClone(object.position);
  const move = Systems.moveFurniture(world, object.id, target.x - object.position.x, target.y - object.position.y);
  assert.equal(move.ok, false);
  assert.match(move.reason, /private room/i);
  assert.deepEqual(object.position, original);

  const otherVacancy = world.places.find((place) => place.kind === 'residential' && place.tenants.length < place.capacity && place.id !== destination.id);
  world.player.money = 100000;
  const unilateral = Systems.rentProperty(world, otherVacancy.id);
  assert.equal(unilateral.ok, false);
  assert.match(unilateral.reason, /joint relocation proposal/i);
  assert.equal(world.player.homePropertyId, destination.id);
  assert.equal(npc.homePropertyId, destination.id);
}

function testFinanceAgreementRedistributesVisibleCostsAndBuildsReserve() {
  const { world, npc, household } = establishCohabitation('AXM-FINANCE-AGREEMENT');
  maxRelationship(world, npc);
  const result = Systems.proposeHouseholdChange(world, household.id, 'finance', {
    mode: 'player_covers_more',
    weeklyReserveTarget: 20
  });
  assert.equal(result.ok, true, result.reason);
  advanceProposal(world, result.proposal);
  assert.equal(result.proposal.status, 'implemented');
  assert.equal(household.agreement.finances.mode, 'player_covers_more');
  assert.equal(household.agreement.finances.weeklyReserveTarget, 20);
  const dues = Households.redistributePropertyExpense(world, World.getProperty(world, household.homePropertyId), 'rent', {
    player: 50,
    [npc.id]: 50
  });
  assert.equal(dues.player, 65);
  assert.equal(dues[npc.id], 35);
  assert.equal(dues.player + dues[npc.id], 100);

  world.player.money = 10000;
  npc.money = 10000;
  household.lastReserveWeek = -1;
  world.time.day = 7;
  world.time.hour = 23;
  Systems.advanceHours(world, 1);
  assert.ok(household.sharedReserve > 0);
  assert.ok(world.metrics.householdReserveContributions >= 1);
  assert.ok(world.metrics.householdSharedExpensePayments >= 2);
  assert.ok(household.history.some((entry) => entry.type === 'reserve_contribution'));
}

function testNpcCanInitiateAndPlayerCanDeclineWithoutHiddenPenalty() {
  const { world, npc, household } = establishCohabitation('AXM-NPC-INITIATIVE');
  maxRelationship(world, npc);
  household.nextNpcInitiativeDay = world.time.day;
  world.householdProposals.forEach((proposal) => {
    if (['pending_npc', 'awaiting_player'].includes(proposal.status)) proposal.status = 'withdrawn';
  });
  const hoursToNextDay = 24 - world.time.hour;
  Systems.advanceHours(world, hoursToNextDay);
  const proposal = world.householdProposals.find((entry) => entry.status === 'awaiting_player' && entry.proposerId === npc.id);
  assert.ok(proposal, 'partner should be able to initiate a household proposal');
  const before = Core.deepClone(world.player.relationships[npc.id]);
  const response = Systems.respondToHouseholdProposal(world, proposal.id, 'decline');
  assert.equal(response.ok, true, response.reason);
  assert.equal(proposal.status, 'declined');
  const after = world.player.relationships[npc.id];
  assert.equal(after.friendship, before.friendship);
  assert.equal(after.trust, before.trust);
  assert.equal(after.romance, before.romance);
  assert.ok(proposal.history.some((entry) => /boundar/i.test(entry.message)));
}

function testCohabitingNpcHousingEvaluationCreatesProposalInsteadOfMoving() {
  const { world, npc, household, destination } = establishCohabitation('AXM-NPC-JOINT-MOVE-GATE');
  const candidate = Households.eligibleJointMoveProperties(world, household)
    .find((property) => property.id !== destination.id && property.tenants.length === 0);
  assert.ok(candidate, 'test requires another empty pair-capable home');
  const before = { household: household.homePropertyId, player: world.player.homePropertyId, partner: npc.homePropertyId };
  const handled = Households.handleNpcHousingDecision(world, npc, destination, candidate, {
    currentScore: 20,
    destinationScore: 80,
    reason: 'deterministic test preference'
  });
  assert.equal(handled, true);
  const proposal = world.householdProposals.find((entry) => entry.status === 'awaiting_player' && entry.type === 'relocation' && entry.proposerId === npc.id);
  assert.ok(proposal, 'NPC housing evaluation should become a player-visible joint relocation proposal');
  assert.equal(proposal.terms.destinationPropertyId, candidate.id);
  assert.deepEqual({ household: household.homePropertyId, player: world.player.homePropertyId, partner: npc.homePropertyId }, before,
    'housing evaluation must not move either partner before the player responds');
}

function testPartnerOwnedRenovationRequiresProposalAndPreservesOwnership() {
  const { world, npc, household, destination } = establishCohabitation('AXM-RENOVATION-CONSENT');
  maxRelationship(world, npc);
  npc.money = 10000;
  let object = destination.furniture.find((entry) => entry.ownerId === npc.id && entry.ownershipMode !== 'property_fixture');
  // Not every starting home happens to contain an object owned by this exact
  // resident. Add an explicit test possession rather than pretending the
  // partner owns a property fixture or silently transferring ownership.
  if (!object) {
    object = World.createFurnitureInstance(world, 'secondhand_chair', npc.id, {
      source: 'deterministic household consent test'
    });
    const placementRule = (x, y, footprint) => Households.canPlaceNpcObject(
      world, destination, npc.id, object, x, y, footprint
    ).ok;
    const placed = World.addFurnitureToProperty(world, destination, object, null, placementRule);
    assert.equal(placed, true, 'test requires one legal partner-private/common placement cell');
  }
  const beforeLevel = object.upgrades.durability;
  const result = Systems.proposeHouseholdChange(world, household.id, 'renovation', {
    kind: 'partner_upgrade',
    objectId: object.id,
    axis: 'durability'
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(object.upgrades.durability, beforeLevel, 'proposal cannot edit partner property before consent');
  advanceProposal(world, result.proposal);
  assert.equal(result.proposal.status, 'implemented');
  assert.equal(object.ownerId, npc.id);
  assert.equal(object.upgrades.durability, beforeLevel + 1);
  assert.ok(object.history.some((entry) => entry.type === 'agreement_upgrade'));
}

function testConflictRepairUsesEvidenceAndDoesNotSilentlyEraseIssue() {
  const { world, npc, household } = establishCohabitation('AXM-REPAIR-EVIDENCE');
  const relation = maxRelationship(world, npc);
  world.player.skills.social = 100;
  world.time.hour = 12;
  const issue = {
    id: Core.uniqueId(world, 'household_issue'),
    householdId: household.id,
    type: 'money',
    status: 'open',
    severity: 1,
    createdDay: world.time.day,
    createdHour: world.time.hour,
    resolvedDay: null,
    repairAttempts: 0,
    message: `${npc.name} wants a clearer money plan.`,
    evidence: { injectedBy: 'deterministic test', pressure: 1 },
    history: []
  };
  world.householdIssues.push(issue);
  household.unresolvedIssueIds.push(issue.id);
  world.rngState = 1;
  const result = Systems.repairHouseholdIssue(world, household.id, issue.id, 'practical_plan');
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.outcome, 'resolved');
  assert.equal(issue.status, 'resolved');
  assert.ok(issue.resolvedDay != null);
  assert.equal(household.unresolvedIssueIds.includes(issue.id), false);
  assert.ok(issue.history.some((entry) => entry.type === 'repair_attempt' && entry.evidence.score != null && entry.evidence.roll != null));
  assert.ok(relation.trust >= 100 || relation.trust <= 100);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testAgreementCanEndUnilaterallyWithoutEvictionOrReserveTheft() {
  const { world, npc, household, destination } = establishCohabitation('AXM-HH-SEPARATION-STAY');
  const objectsBefore = personalObjectLocations(world, ['player', npc.id]);
  household.sharedReserve = 100;
  household.history.push({
    id: 'test_reserve_contribution', day: world.time.day, hour: world.time.hour,
    type: 'reserve_contribution', message: 'Deterministic contribution evidence.', actorIds: ['player', npc.id],
    proposalId: null, issueId: null, causes: ['test'], evidence: { paid: { player: 70, [npc.id]: 30 } }
  });
  const pending = Systems.proposeHouseholdChange(world, household.id, 'finance', { mode: 'equal', weeklyReserveTarget: 5 });
  assert.equal(pending.ok, true, pending.reason);
  const issue = {
    id: Core.uniqueId(world, 'household_issue'), householdId: household.id, type: 'space', status: 'open', severity: 3,
    createdDay: world.time.day, createdHour: world.time.hour, resolvedDay: null, repairAttempts: 0,
    message: 'A visible unresolved test issue.', evidence: { test: true }, history: []
  };
  world.householdIssues.push(issue);
  household.unresolvedIssueIds.push(issue.id);
  const playerMoney = world.player.money;
  const partnerMoney = npc.money;
  const result = Systems.endHouseholdAgreement(world, household.id, null, true);
  assert.equal(result.ok, true, result.reason);
  assert.equal(household.status, 'ended');
  assert.equal(household.endMode, 'autonomous_cotenants');
  assert.equal(world.player.homePropertyId, destination.id);
  assert.equal(npc.homePropertyId, destination.id);
  assert.deepEqual(new Set(destination.tenants), new Set(['player', npc.id]), 'ending an agreement must not evict either co-tenant');
  assert.equal(world.player.householdId, null);
  assert.equal(npc.householdId, null);
  assert.equal(world.player.relationships[npc.id].status, 'former_partner');
  assert.equal(npc.relationships.player.status, 'former_partner');
  assert.equal(household.sharedReserve, 0);
  assert.equal(world.player.money, playerMoney + 70);
  assert.equal(npc.money, partnerMoney + 30);
  assert.equal(pending.proposal.status, 'withdrawn');
  assert.equal(issue.status, 'closed');
  assert.deepEqual(personalObjectLocations(world, ['player', npc.id]), objectsBefore);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testAgreementExitMovePreservesBothPeoplesObjects() {
  const { world, npc, household, destination: sharedHome } = establishCohabitation('AXM-HH-SEPARATION-MOVE');
  world.player.money = 20000;
  const before = personalObjectLocations(world, ['player', npc.id]);
  const exitHome = Households.eligiblePlayerExitProperties(world, household).find((property) => property.tenants.length === 0);
  assert.ok(exitHome, 'test requires one empty exit home');
  const result = Systems.endHouseholdAgreement(world, household.id, exitHome.id, true);
  assert.equal(result.ok, true, result.reason);
  assert.equal(world.player.homePropertyId, exitHome.id);
  assert.equal(npc.homePropertyId, sharedHome.id);
  assert.equal(sharedHome.tenants.includes('player'), false);
  assert.equal(sharedHome.tenants.includes(npc.id), true);
  assert.equal(exitHome.tenants.includes('player'), true);
  assert.deepEqual(personalObjectLocations(world, ['player', npc.id]), before, 'separation move must relocate or store possessions, never delete them');
  assert.equal(Households.playerHousehold(world), null);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testHouseholdValidationRejectsCorruptionWithoutRepairingIt() {
  const { world, household } = establishPartnership('AXM-HH-CORRUPTION');
  household.sharedReserve = -7;
  const before = Core.serializeWorld(world);
  const validation = Systems.validateWorld(world);
  const after = Core.serializeWorld(world);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => /shared reserve/i.test(error)));
  assert.equal(after, before, 'validation must diagnose household corruption without mutating or repairing it');
}

function testDeterministicHouseholdEvolution() {
  function run(seed) {
    const { world, npc, household } = establishCohabitation(seed);
    maxRelationship(world, npc);
    const change = Systems.proposeHouseholdChange(world, household.id, 'finance', {
      mode: 'income_weighted', weeklyReserveTarget: 12
    });
    assert.equal(change.ok, true, change.reason);
    advanceProposal(world, change.proposal);
    Systems.advanceHours(world, 30 * 24, { freezePlayer: true });
    const validation = Systems.validateWorld(world);
    assert.equal(validation.ok, true, validation.errors.join('\n'));
    return Core.serializeWorld(world);
  }
  assert.equal(run('AXM-HH-DETERMINISM'), run('AXM-HH-DETERMINISM'));
}

const tests = [
  testLegacyMigrationIsExplicitAndNoConsentIsInvented,
  testCommitmentIsDelayedConsentNotImmediateControl,
  testCohabitationMovesBothPeopleWithoutObjectLossOrBoundaryViolations,
  testPrivateZoneAndJointMoveAuthorityAreEnforced,
  testFinanceAgreementRedistributesVisibleCostsAndBuildsReserve,
  testNpcCanInitiateAndPlayerCanDeclineWithoutHiddenPenalty,
  testCohabitingNpcHousingEvaluationCreatesProposalInsteadOfMoving,
  testPartnerOwnedRenovationRequiresProposalAndPreservesOwnership,
  testConflictRepairUsesEvidenceAndDoesNotSilentlyEraseIssue,
  testAgreementCanEndUnilaterallyWithoutEvictionOrReserveTheft,
  testAgreementExitMovePreservesBothPeoplesObjects,
  testHouseholdValidationRejectsCorruptionWithoutRepairingIt,
  testDeterministicHouseholdEvolution,
];

let passed = 0;
for (const test of tests) {
  try {
    test();
    passed += 1;
    console.log(`PASS ${test.name}`);
  } catch (error) {
    console.error(`FAIL ${test.name}`);
    console.error(error.stack || error.message);
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) console.log(`\n${passed}/${tests.length} household agreement tests passed.`);
