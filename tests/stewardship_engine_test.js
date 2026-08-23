'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Habitats, Stewardship } = globalThis.AXM;

function newWorld(seed = 'AXM-STEWARDSHIP-TEST') {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  world.people.forEach((person) => {
    person.moveCooldownUntil = 9999;
    person.habitatIntentionCooldownUntil = 9999;
  });
  return world;
}

function residential(world) {
  return world.places.filter((place) => place.kind === 'residential');
}

function objectIds(world) {
  const ids = [];
  residential(world).forEach((property) => property.furniture.forEach((object) => ids.push(object.id)));
  [world.player].concat(world.people).forEach((person) => (person.storedFurniture || []).forEach((object) => ids.push(object.id)));
  return ids.sort();
}

function oneTenantExternalHome(world) {
  const property = residential(world).find((place) => place.ownerId !== 'player'
    && !place.tenants.includes('player')
    && place.tenants.length === 1);
  assert.ok(property, 'test needs an externally owned one-tenant property');
  const resident = World.getPerson(world, property.tenants[0]);
  assert.ok(resident);
  return { property, resident };
}

function multiTenantExternalHome(world) {
  const property = residential(world).find((place) => place.ownerId !== 'player'
    && !place.tenants.includes('player')
    && place.tenants.length >= 2);
  assert.ok(property, 'test needs an externally owned multi-tenant property');
  const resident = World.getPerson(world, property.tenants[0]);
  const other = World.getPerson(world, property.tenants[1]);
  assert.ok(resident && other);
  return { property, resident, other };
}

function surfaceSpec(property, finishId = null) {
  const room = property.habitat.rooms.find((entry) => entry.purpose !== 'bathroom') || property.habitat.rooms[0];
  const alternatives = Habitats.FINISHES.filter((entry) => entry.id !== room.finish.wallFinishId);
  const finish = finishId ? Habitats.FINISHES.find((entry) => entry.id === finishId) : alternatives[0];
  assert.ok(finish && finish.id !== room.finish.wallFinishId, 'test needs an alternative finish');
  return { type: 'surface', target: { roomId: room.id, surface: 'walls', finishId: finish.id } };
}

function formForced(world, resident, spec) {
  resident.money = Math.max(resident.money, 5_000);
  const result = Stewardship.formIntention(world, resident.id, spec, { force: true });
  assert.equal(result.ok, true, result.reason);
  return result.intention;
}

function contributeResident(world, intention, amount) {
  const resident = World.getPerson(world, intention.residentId);
  const contribution = Core.round(Math.min(amount, resident.money), 2);
  assert.ok(contribution > 0, 'resident needs money for test contribution');
  resident.money = Core.round(resident.money - contribution, 2);
  intention.funding.escrow.money = Core.round(intention.funding.escrow.money + contribution, 2);
  intention.funding.contributionTotals.resident = Core.round(intention.funding.contributionTotals.resident + contribution, 2);
  intention.funding.history.push({ day: world.time.day, source: 'focused_test_resident', amount: contribution, totalEscrow: intention.funding.escrow.money });
  return contribution;
}

function fundTo(world, intention, target) {
  const current = intention.funding.contributionTotals.resident + intention.funding.contributionTotals.propertyReserve;
  const needed = Core.round(Math.max(0, target - current), 2);
  const resident = World.getPerson(world, intention.residentId);
  resident.money = Math.max(resident.money, needed + 500);
  return needed > 0 ? contributeResident(world, intention, needed) : 0;
}

function seedAndSubmit(world, intention) {
  fundTo(world, intention, intention.funding.requestThreshold);
  const request = Stewardship.submitRequest(world, intention);
  assert.ok(request, 'request should be created');
  return request;
}

function advanceStewardshipDays(world, days = 1) {
  for (let index = 0; index < days; index += 1) {
    world.time.day += 1;
    Stewardship.dailyTick(world);
  }
}

function preparePlayerRequest(world) {
  world.player.money = Math.max(world.player.money, 1_000_000);
  const setup = Stewardship.prepareStewardshipExperiment(world);
  assert.equal(setup.ok, true, setup.reason);
  const request = Stewardship.requestById(world, setup.requestId);
  const intention = Stewardship.intentionById(world, setup.intentionId);
  const property = World.getProperty(world, setup.propertyId);
  const resident = World.getPerson(world, setup.residentId);
  assert.ok(request && intention && property && resident);
  assert.equal(request.status, 'pending_player');
  return { setup, request, intention, property, resident };
}

function testDeterministicPolicyInitialization() {
  const a = newWorld('AXM-STEWARDSHIP-POLICY');
  const b = newWorld('AXM-STEWARDSHIP-POLICY');
  const compact = (world) => residential(world).map((property) => ({
    id: property.id,
    schema: property.stewardship.schema,
    policy: property.stewardship.policy,
    requestIds: property.stewardship.requestIds,
    history: property.stewardship.history
  }));
  assert.deepEqual(compact(a), compact(b));
  compact(a).forEach((entry) => assert.equal(entry.schema, Stewardship.PROPERTY_SCHEMA));
}

function testResidentFormsAndSavesVisibleEscrow() {
  const world = newWorld('AXM-STEWARDSHIP-SAVING');
  const { property, resident } = oneTenantExternalHome(world);
  const intention = formForced(world, resident, surfaceSpec(property));
  resident.money = 2_000;
  const before = resident.money;
  advanceStewardshipDays(world, 3);
  assert.ok(intention.funding.escrow.money > 0, 'resident should visibly save into project escrow');
  assert.ok(resident.money < before, 'saving must come from resident money');
  assert.equal(intention.funding.contributionTotals.resident, intention.funding.escrow.money);
  assert.ok(world.metrics.stewardshipResidentSavings > 0);
}

function testCotenantRefusalRefundsAndAddsNoHiddenPenalty() {
  const world = newWorld('AXM-STEWARDSHIP-COTENANT-REFUSAL');
  const { property, resident, other } = multiTenantExternalHome(world);
  resident.relationships[other.id] = { friendship: -100, trust: -100, romance: 0, status: 'roommate', interactions: 0 };
  other.traits.creativity = 100;
  other.preferences.colors = ['moss'];
  const intention = formForced(world, resident, surfaceSpec(property, 'night_blue'));
  resident.money = 1_000;
  const beforeMoney = resident.money;
  const relationBefore = Core.deepClone(resident.relationships[other.id]);
  const request = seedAndSubmit(world, intention);
  assert.equal(request.status, 'declined');
  assert.equal(intention.status, 'declined');
  assert.equal(request.response.boundary, 'co_tenant_consent');
  assert.equal(resident.money, beforeMoney, 'unspent escrow should be returned to the resident');
  assert.deepEqual(resident.relationships[other.id], relationBefore, 'refusal must not inject a hidden relationship punishment');
  assert.ok(world.metrics.stewardshipCotenantDeclines >= 1);
}

function testExternalOwnerApprovalIsDeterministicAndAudited() {
  const world = newWorld('AXM-STEWARDSHIP-EXTERNAL-APPROVE');
  const { property, resident } = oneTenantExternalHome(world);
  property.condition = 60;
  property.habitat.structuralCondition = 60;
  property.maintenanceReserve = 1_000;
  Object.assign(property.stewardship.policy, { generosity: 100, alterationTolerance: 100, repairPriority: 100, responseDelayDays: 0 });
  resident.stewardshipReliability = 100;
  resident.rentArrears = 0;
  const intention = formForced(world, resident, { type: 'repair', target: { structure: 'whole_habitat' } });
  const request = seedAndSubmit(world, intention);
  assert.equal(request.status, 'pending_external');
  const reserveBefore = property.maintenanceReserve;
  const result = Stewardship.resolveExternalRequest(world, request);
  assert.equal(result.ok, true);
  assert.equal(result.approved, undefined, 'approveRequest returns the approval record directly');
  assert.equal(request.status, 'approved');
  assert.equal(request.authorities.externalOwner.status, 'approved');
  assert.ok(request.authorities.externalOwner.evidence.deterministicDecisionKey);
  assert.ok(request.acceptedOwnerContribution > 0);
  assert.equal(property.maintenanceReserve, Core.round(reserveBefore - request.acceptedOwnerContribution, 2));
}

function testExternalOwnerDeclineIsDeterministicAndRefunded() {
  const world = newWorld('AXM-STEWARDSHIP-EXTERNAL-DECLINE');
  const { property, resident } = oneTenantExternalHome(world);
  property.condition = 100;
  property.maintenanceReserve = 0;
  Object.assign(property.stewardship.policy, { generosity: 0, alterationTolerance: 0, repairPriority: 0, responseDelayDays: 0 });
  resident.stewardshipReliability = 0;
  resident.rentArrears = 10_000;
  resident.traits.neatness = 0;
  resident.money = 1_000;
  const intention = formForced(world, resident, surfaceSpec(property));
  const beforeMoney = resident.money;
  const request = seedAndSubmit(world, intention);
  const result = Stewardship.resolveExternalRequest(world, request);
  assert.equal(result.ok, true);
  assert.equal(result.approved, false);
  assert.equal(request.status, 'declined');
  assert.equal(request.authorities.externalOwner.status, 'declined');
  assert.equal(intention.status, 'declined');
  assert.equal(resident.money, beforeMoney, 'declined external request must release unspent resident escrow');
}

function testRemotePlayerOwnedRequestWaitsWithoutBuilding() {
  const world = newWorld('AXM-STEWARDSHIP-PLAYER-PENDING');
  const { request, intention, property } = preparePlayerRequest(world);
  assert.equal(property.ownerId, 'player');
  assert.ok(!property.tenants.includes('player'), 'ownership must not displace or occupy the tenant home');
  assert.equal(request.status, 'pending_player');
  assert.equal(intention.status, 'awaiting_permission');
  assert.equal(intention.projectId, null);
  assert.equal(property.habitat.projects.some((project) => project.stewardshipIntentionId === intention.id), false);
}

function testInvalidOwnerShareResponseLeavesPendingStateUntouched() {
  const world = newWorld('AXM-STEWARDSHIP-FAILED-ACTION-NO-CONSENT');
  const { request, property } = preparePlayerRequest(world);
  property.ownerId = 'town_housing_network';
  property.ownerLabel = 'Town Housing Network';
  world.player.ownedPropertyIds = world.player.ownedPropertyIds.filter((id) => id !== property.id);
  const before = Core.deepClone(request);
  const metricsBefore = Core.deepClone(world.metrics);
  const result = Systems.respondToStewardshipRequest(world, request.id, 'approve_owner_share');
  assert.equal(result.ok, false);
  assert.match(result.reason, /only a property owner/i);
  assert.deepEqual(request, before, 'rejected action must not create partial approval state');
  assert.equal(world.metrics.stewardshipPlayerApprovals, metricsBefore.stewardshipPlayerApprovals);
}

function testTenantFundedApprovalPreservesReserve() {
  const world = newWorld('AXM-STEWARDSHIP-TENANT-FUNDED');
  const { request, intention, property } = preparePlayerRequest(world);
  const reserveBefore = property.maintenanceReserve;
  const result = Systems.respondToStewardshipRequest(world, request.id, 'approve_tenant_funded');
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.approved, true);
  assert.equal(request.status, 'approved');
  assert.equal(intention.status, 'approved_saving');
  assert.equal(property.maintenanceReserve, reserveBefore);
  assert.equal(request.acceptedOwnerContribution, 0);
}

function testOwnerShareApprovalDeductsExactReserve() {
  const world = newWorld('AXM-STEWARDSHIP-OWNER-SHARE');
  const { request, intention, property } = preparePlayerRequest(world);
  const reserveBefore = property.maintenanceReserve;
  const expected = Core.round(Math.min(request.proposedOwnerContribution, reserveBefore), 2);
  const result = Systems.respondToStewardshipRequest(world, request.id, 'approve_owner_share');
  assert.equal(result.ok, true, result.reason);
  assert.equal(request.status, 'approved');
  assert.equal(intention.funding.contributionTotals.propertyReserve, expected);
  assert.equal(request.acceptedOwnerContribution, expected);
  assert.equal(property.maintenanceReserve, Core.round(reserveBefore - expected, 2));
}

function testResidentProjectCompletesThroughSharedValidatorWithoutObjectLoss() {
  const world = newWorld('AXM-STEWARDSHIP-COMPLETE-NO-LOSS');
  const beforeIds = objectIds(world);
  const { request, intention, property } = preparePlayerRequest(world);
  const roomId = intention.projectSpec.target.roomId;
  const finishId = intention.projectSpec.target.finishId;
  const approval = Systems.respondToStewardshipRequest(world, request.id, 'approve_owner_share');
  assert.equal(approval.ok, true, approval.reason);
  fundTo(world, intention, intention.funding.budget.totalMoney);
  let guard = 0;
  while (intention.status !== 'completed' && guard < 30) {
    advanceStewardshipDays(world, 1);
    guard += 1;
  }
  assert.equal(intention.status, 'completed', intention.failureReason || 'resident project did not complete');
  const project = Stewardship.intentionProject(world, intention);
  assert.equal(project.status, 'completed');
  assert.equal(project.creatorId, intention.residentId);
  assert.equal(project.resourceMode, 'resident_escrow');
  assert.equal(property.habitat.rooms.find((room) => room.id === roomId).finish.wallFinishId, finishId);
  assert.deepEqual(objectIds(world), beforeIds, 'resident construction must preserve every object identity');
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testResidentMoveWithdrawsAndRefunds() {
  const world = newWorld('AXM-STEWARDSHIP-MOVE-WITHDRAW');
  const { property, resident } = oneTenantExternalHome(world);
  resident.money = 1_000;
  const intention = formForced(world, resident, surfaceSpec(property));
  const beforeMoney = resident.money;
  const request = seedAndSubmit(world, intention);
  assert.equal(request.status, 'pending_external');
  const destination = residential(world).find((place) => place.id !== property.id && place.tenants.length < place.capacity && !place.tenants.includes('player'));
  assert.ok(destination);
  const moved = Systems.moveNpc(world, resident, destination, { waiveCost: true, causes: ['focused stewardship withdrawal test'] });
  assert.equal(moved.ok, true, moved.reason);
  advanceStewardshipDays(world, 1);
  assert.equal(intention.status, 'withdrawn');
  assert.equal(request.status, 'withdrawn');
  assert.equal(resident.money, beforeMoney, 'moving before work should return the resident escrow');
  assert.match(intention.failureReason, /moved before/i);
}

function testPlayerDeclinePreservesRelationshipState() {
  const world = newWorld('AXM-STEWARDSHIP-PLAYER-DECLINE');
  const { request, intention, resident } = preparePlayerRequest(world);
  const playerRelationBefore = Core.deepClone(world.player.relationships[resident.id]);
  const residentRelationBefore = Core.deepClone(resident.relationships.player);
  const result = Systems.respondToStewardshipRequest(world, request.id, 'decline');
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.approved, false);
  assert.equal(request.status, 'declined');
  assert.equal(intention.status, 'declined');
  assert.equal(request.response.noRelationshipPenalty, true);
  assert.deepEqual(world.player.relationships[resident.id], playerRelationBefore);
  assert.deepEqual(resident.relationships.player, residentRelationBefore);
}

function testUnansweredPlayerRequestWithdrawsAtVisibleDeadline() {
  const world = newWorld('AXM-STEWARDSHIP-DEADLINE');
  const { request, intention } = preparePlayerRequest(world);
  intention.deadlineDay = world.time.day;
  advanceStewardshipDays(world, 1);
  assert.equal(intention.status, 'withdrawn');
  assert.equal(request.status, 'withdrawn');
  assert.match(intention.failureReason, /unanswered request/i);
}

function testV03MigrationAddsEmptyStateWithoutInventingPermission() {
  const world = newWorld('AXM-STEWARDSHIP-MIGRATION');
  const legacy = Core.deepClone(world);
  legacy.schema = 'axm.living-city-sim.world/v0.3.0';
  legacy.version = '0.3.0';
  delete legacy.habitatIntentions;
  delete legacy.stewardshipRequests;
  legacy.places.filter((place) => place.kind === 'residential').forEach((property) => { delete property.stewardship; });
  legacy.people.forEach((person) => {
    delete person.habitatIntentionCooldownUntil;
    delete person.stewardshipReliability;
  });
  delete legacy.ui.selectedHabitatIntentionId;
  delete legacy.ui.selectedStewardshipRequestId;
  delete legacy.flags.stewardshipExperimentPrepared;
  Object.keys(legacy.metrics).filter((key) => key.startsWith('stewardship') || key.startsWith('habitatIntentions')).forEach((key) => delete legacy.metrics[key]);

  const migrated = Systems.migrateWorld(legacy);
  assert.equal(migrated.schema, Core.SCHEMA);
  assert.equal(migrated.version, Core.VERSION);
  assert.deepEqual(migrated.habitatIntentions, []);
  assert.deepEqual(migrated.stewardshipRequests, []);
  assert.equal(migrated.metrics.stewardshipRequestsApproved, 0);
  residential(migrated).forEach((property) => assert.equal(property.stewardship.schema, Stewardship.PROPERTY_SCHEMA));
  assert.equal(migrated.ledger.some((entry) => /no resident intention or permission was invented/i.test(entry.message)), true);
  const validation = Systems.validateWorld(migrated);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testValidationRejectsStewardshipCorruptionWithoutRewrite() {
  const world = newWorld('AXM-STEWARDSHIP-CORRUPTION');
  const { intention } = preparePlayerRequest(world);
  intention.funding.escrow.money = -5;
  const before = Core.serializeWorld(world);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(' | '), /invalid escrow money/i);
  assert.equal(Core.serializeWorld(world), before, 'validation must diagnose without silently repairing the corrupted save');
}

function testDeterministicLongStewardshipEvolution() {
  const a = newWorld('AXM-STEWARDSHIP-EVOLUTION');
  const b = newWorld('AXM-STEWARDSHIP-EVOLUTION');
  a.people.forEach((person) => { person.habitatIntentionCooldownUntil = 2 + (Core.hashString(person.id) % 7); });
  b.people.forEach((person) => { person.habitatIntentionCooldownUntil = 2 + (Core.hashString(person.id) % 7); });
  const reportA = Systems.runObserverDays(a, 180);
  const reportB = Systems.runObserverDays(b, 180);
  assert.equal(reportA.validation.ok, true, reportA.validation.errors.join('\n'));
  assert.equal(reportB.validation.ok, true, reportB.validation.errors.join('\n'));
  assert.ok(a.metrics.habitatIntentionsFormed > 0);
  assert.ok(a.metrics.stewardshipRequestsSubmitted > 0);
  assert.ok(a.metrics.stewardshipProjectPhases > 0);
  assert.equal(Core.serializeWorld(a), Core.serializeWorld(b), 'same seed and commands must produce identical stewardship history');
}

function testLabeledExperimentIsExplicitAndSingleUse() {
  const world = newWorld('AXM-STEWARDSHIP-EXPERIMENT');
  const first = Stewardship.prepareStewardshipExperiment(world);
  assert.equal(first.ok, true, first.reason);
  const property = World.getProperty(world, first.propertyId);
  assert.equal(property.ownerId, 'player');
  assert.ok(property.tenants.includes(first.residentId));
  assert.ok(!property.tenants.includes('player'));
  const second = Stewardship.prepareStewardshipExperiment(world);
  assert.equal(second.ok, false);
  assert.match(second.reason, /already used/i);
}

const tests = [
  testDeterministicPolicyInitialization,
  testResidentFormsAndSavesVisibleEscrow,
  testCotenantRefusalRefundsAndAddsNoHiddenPenalty,
  testExternalOwnerApprovalIsDeterministicAndAudited,
  testExternalOwnerDeclineIsDeterministicAndRefunded,
  testRemotePlayerOwnedRequestWaitsWithoutBuilding,
  testInvalidOwnerShareResponseLeavesPendingStateUntouched,
  testTenantFundedApprovalPreservesReserve,
  testOwnerShareApprovalDeductsExactReserve,
  testResidentProjectCompletesThroughSharedValidatorWithoutObjectLoss,
  testResidentMoveWithdrawsAndRefunds,
  testPlayerDeclinePreservesRelationshipState,
  testUnansweredPlayerRequestWithdrawsAtVisibleDeadline,
  testV03MigrationAddsEmptyStateWithoutInventingPermission,
  testValidationRejectsStewardshipCorruptionWithoutRewrite,
  testDeterministicLongStewardshipEvolution,
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

if (passed === tests.length) console.log(`\n${passed}/${tests.length} stewardship engine tests passed.`);
