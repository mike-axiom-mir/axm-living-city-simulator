'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Directions, Economy } = globalThis.AXM;

function newWorld(seed = 'AXM-LOCAL-ECONOMY-TEST') {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  return world;
}

function createPlayerEnterprise(world, options = {}) {
  world.player.money = Math.max(world.player.money, 5000);
  const result = Systems.createEnterprise(world, {
    templateId: 'repair_table',
    path: 'occasional_service',
    name: 'Keep-It-Going Table',
    purpose: 'Preserve useful things without turning repair into a compulsory growth ladder.',
    ...options
  });
  assert.equal(result.ok, true, result.reason);
  return result.enterprise;
}

function runUntilCustomer(world, enterprise, limit = 8) {
  for (let index = 0; index < limit; index += 1) {
    const result = Systems.startEnterpriseSession(world, enterprise.id, 'compressed');
    assert.equal(result.ok, true, result.reason);
    if (result.session.customers.length) return result.session;
  }
  throw new Error('Expected at least one actual resident customer in bounded test attempts.');
}

function testFoundationAddsRealRoomsNeedsAndResidentDirections() {
  const world = newWorld('ECONOMY-FOUNDATION');
  assert.equal(world.schema, Core.SCHEMA);
  assert.equal(Economy.commercialPremises(world).length, 4);
  assert.equal(world.localNeeds.length, Economy.LOCAL_NEED_TEMPLATES.length);
  assert.ok(world.enterprises.filter((entry) => entry.ownerId !== 'player').length >= 2);
  assert.ok(Economy.commercialPremises(world).some((entry) => entry.listedForLease));
  assert.ok(Economy.commercialPremises(world).some((entry) => entry.occupantEnterpriseId));
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testPrivateHobbyCreatesNoForcedStartupCost() {
  const world = newWorld('ECONOMY-PRIVATE');
  const before = world.player.money;
  const result = Systems.createEnterprise(world, {
    templateId: 'creative_studio',
    path: 'private_hobby',
    name: 'Odd Little Visual Room',
    purpose: 'Something worth making even when nobody buys it.'
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.enterprise.status, 'private');
  assert.equal(result.enterprise.equipment.length, 0);
  assert.equal(world.player.money, before);
  assert.equal(result.enterprise.optional, true);
  assert.equal(result.enterprise.noAgeGate, true);
  assert.equal(result.enterprise.ageGate, null);
  assert.equal(result.enterprise.noGrowthRequirement, true);
  assert.equal(result.enterprise.noFailureLabel, true);
}

function testSourceProjectProvenanceRemainsLinked() {
  const world = newWorld('ECONOMY-SOURCE');
  world.player.money = 5000;
  const object = Directions.ownedObjects(world, 'player')[0].object;
  const projectResult = Systems.createPersonalProject(world, {
    templateId: 'restoration',
    targetObjectId: object.id,
    title: 'Keep the first chair alive',
    meaning: 'It remembers the starting room.'
  });
  assert.equal(projectResult.ok, true, projectResult.reason);
  const enterpriseResult = Systems.createEnterprise(world, {
    templateId: 'repair_table',
    path: 'private_hobby',
    sourceProjectId: projectResult.project.id,
    name: 'Chair Memory Table',
    purpose: projectResult.project.meaning
  });
  assert.equal(enterpriseResult.ok, true, enterpriseResult.reason);
  assert.equal(enterpriseResult.enterprise.sourceProjectId, projectResult.project.id);
  assert.ok(enterpriseResult.enterprise.history[0].evidence.sourceProjectId === projectResult.project.id);
}

function testOccasionalServiceUsesAttributableStarterKit() {
  const world = newWorld('ECONOMY-STARTER');
  world.player.money = 5000;
  const before = world.player.money;
  const enterprise = createPlayerEnterprise(world);
  const template = Economy.templateById(enterprise.templateId);
  assert.equal(enterprise.status, 'occasional');
  assert.equal(enterprise.equipment.length, template.equipment.length);
  assert.equal(Core.round(before - world.player.money, 2), template.starterCost);
  assert.ok(enterprise.equipment.every((entry) => entry.ownerId === 'player' && entry.enterpriseId === enterprise.id));
}

function testCommercialLeaseUsesGenuineVacancyAndSeparateAuthority() {
  const world = newWorld('ECONOMY-LEASE');
  world.player.money = 5000;
  const premise = Economy.commercialPremises(world).find((entry) => entry.listedForLease);
  assert.ok(premise);
  const enterprise = createPlayerEnterprise(world, { path: 'tiny_enterprise', premiseId: premise.id });
  assert.equal(enterprise.premiseId, premise.id);
  assert.equal(premise.occupantEnterpriseId, enterprise.id);
  assert.equal(premise.listedForLease, false);
  assert.notEqual(premise.ownerId, 'player');
  assert.equal(enterprise.ownerId, 'player');
  assert.ok(enterprise.lease.depositHeld === premise.deposit);

  const second = Systems.createEnterprise(world, {
    templateId: 'learning_table', path: 'occasional_service', name: 'Second Direction', purpose: 'Test actual occupancy.'
  });
  assert.equal(second.ok, true, second.reason);
  const rejected = Systems.leasePremise(world, second.enterprise.id, premise.id);
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /occupied|not currently offered/i);
}

function testCustomersAreActualResidentsWithRealMoney() {
  const world = newWorld('ECONOMY-CUSTOMERS');
  const enterprise = createPlayerEnterprise(world);
  const before = new Map(world.people.map((person) => [person.id, person.money]));
  const session = runUntilCustomer(world, enterprise);
  assert.ok(session.customers.length > 0);
  for (const transaction of session.customers) {
    const person = World.getPerson(world, transaction.personId);
    assert.ok(person && person.id !== 'player');
    assert.equal(Core.round(before.get(person.id) - person.money, 2), transaction.price);
    assert.ok(transaction.reasons.includes('actual resident need fit'));
  }
  assert.equal(enterprise.totals.customers, enterprise.customerHistory.length);
  assert.equal(world.metrics.enterpriseCustomersServed, world.enterpriseSessions.reduce((sum, entry) => sum + entry.customers.length, 0));
}

function testNoAnonymousDemandRecordsCanAppear() {
  const world = newWorld('ECONOMY-NO-ANONYMOUS');
  const enterprise = createPlayerEnterprise(world);
  runUntilCustomer(world, enterprise);
  const valid = new Set(world.people.map((person) => person.id));
  world.enterpriseSessions.forEach((session) => session.customers.forEach((customer) => assert.ok(valid.has(customer.personId))));
  enterprise.customerHistory.forEach((customer) => assert.ok(valid.has(customer.personId)));
  assert.equal(world.enterpriseSessions.some((session) => session.customers.some((customer) => !customer.personId)), false);
}

function testCompressedAndEnteredWorkAreBothValid() {
  const world = newWorld('ECONOMY-WORK-MODES');
  const enterprise = createPlayerEnterprise(world);
  const dayHourBefore = world.time.day * 24 + world.time.hour;
  const compressed = Systems.startEnterpriseSession(world, enterprise.id, 'compressed');
  assert.equal(compressed.ok, true, compressed.reason);
  assert.equal(compressed.session.status, 'completed');
  assert.equal(compressed.session.mode, 'compressed');
  assert.ok(world.time.day * 24 + world.time.hour >= dayHourBefore + 3);

  const entered = Systems.startEnterpriseSession(world, enterprise.id, 'interactive');
  assert.equal(entered.ok, true, entered.reason);
  assert.equal(world.activeEnterpriseSessionId, entered.session.id);
  const template = Economy.templateById(enterprise.templateId);
  for (const action of template.actions.slice(0, 3)) {
    const result = Systems.performEnterpriseTask(world, enterprise.id, action.id);
    assert.equal(result.ok, true, result.reason);
  }
  assert.equal(world.activeEnterpriseSessionId, null);
  assert.equal(entered.session.status, 'completed');
  assert.equal(entered.session.mode, 'interactive');
}

function testInteractiveCancellationInventsNoCustomersOrRevenue() {
  const world = newWorld('ECONOMY-CANCEL');
  const enterprise = createPlayerEnterprise(world);
  const before = { customers: enterprise.totals.customers, revenue: enterprise.totals.revenue };
  const started = Systems.startEnterpriseSession(world, enterprise.id, 'interactive');
  assert.equal(started.ok, true, started.reason);
  const cancelled = Systems.cancelEnterpriseSession(world, enterprise.id);
  assert.equal(cancelled.ok, true, cancelled.reason);
  assert.equal(started.session.status, 'cancelled');
  assert.equal(started.session.customers.length, 0);
  assert.equal(enterprise.totals.customers, before.customers);
  assert.equal(enterprise.totals.revenue, before.revenue);
}

function testPauseAndResumeCreateNoFailurePenalty() {
  const world = newWorld('ECONOMY-PAUSE');
  const enterprise = createPlayerEnterprise(world);
  const money = world.player.money;
  const relationSnapshot = Core.deepClone(world.player.relationships);
  assert.equal(Systems.pauseEnterprise(world, enterprise.id).ok, true);
  assert.equal(enterprise.status, 'paused');
  Systems.advanceHours(world, 24 * 9, { freezePlayer: true });
  assert.equal(enterprise.status, 'paused');
  assert.equal(Systems.resumeEnterprise(world, enterprise.id).ok, true);
  assert.equal(enterprise.status, 'occasional');
  assert.equal(world.player.money, money);
  assert.deepEqual(world.player.relationships, relationSnapshot);
  assert.ok(enterprise.history.some((entry) => entry.type === 'paused'));
  assert.ok(enterprise.history.some((entry) => entry.type === 'resumed'));
}

function testPausedPremiseChoiceIsExplicitAndCasual() {
  const keepWorld = newWorld('ECONOMY-PAUSE-KEEP-ROOM');
  keepWorld.player.money = 5000;
  const keepPremise = Economy.commercialPremises(keepWorld).find((entry) => entry.listedForLease);
  const keepEnterprise = createPlayerEnterprise(keepWorld, { path: 'tiny_enterprise', premiseId: keepPremise.id });
  keepEnterprise.funds = 1000;
  const due = Core.round(keepEnterprise.lease.weeklyLease + keepEnterprise.lease.utilityBase, 2);
  const fundsBefore = keepEnterprise.funds;
  const kept = Systems.pauseEnterprise(keepWorld, keepEnterprise.id, false);
  assert.equal(kept.ok, true, kept.reason);
  assert.equal(kept.releasedRoom, false);
  assert.equal(keepEnterprise.pausePremisePolicy, 'kept_with_costs');
  assert.equal(keepPremise.occupantEnterpriseId, keepEnterprise.id);
  keepWorld.time.day = 8;
  Economy.dailyTick(keepWorld, { freezePlayer: true });
  assert.equal(keepEnterprise.funds, Core.round(fundsBefore - due, 2), 'keeping a real room must retain its plainly recorded cost');
  assert.ok(keepEnterprise.history.some((entry) => entry.type === 'paused' && entry.evidence?.continuingWeeklyRoomCost === due));

  const releaseWorld = newWorld('ECONOMY-PAUSE-RELEASE-ROOM');
  releaseWorld.player.money = 5000;
  const releasePremise = Economy.commercialPremises(releaseWorld).find((entry) => entry.listedForLease);
  const releaseEnterprise = createPlayerEnterprise(releaseWorld, { path: 'tiny_enterprise', premiseId: releasePremise.id });
  const released = Systems.pauseEnterprise(releaseWorld, releaseEnterprise.id, true);
  assert.equal(released.ok, true, released.reason);
  assert.equal(released.releasedRoom, true);
  assert.equal(releaseEnterprise.status, 'paused');
  assert.equal(releaseEnterprise.pausePremisePolicy, 'released');
  assert.equal(releaseEnterprise.premiseId, null);
  assert.equal(releasePremise.occupantEnterpriseId, null);
  assert.equal(releasePremise.listedForLease, true);
  assert.ok(released.returnedDeposit >= 0);
}

function testClosureReleasesRoomAndPreservesHistoryAndEquipment() {
  const world = newWorld('ECONOMY-CLOSE');
  world.player.money = 5000;
  const premise = Economy.commercialPremises(world).find((entry) => entry.listedForLease);
  const enterprise = createPlayerEnterprise(world, { path: 'tiny_enterprise', premiseId: premise.id });
  runUntilCustomer(world, enterprise);
  enterprise.funds += 35;
  const equipmentIds = enterprise.equipment.map((entry) => entry.id);
  const customerCount = enterprise.customerHistory.length;
  const historyCount = enterprise.history.length;
  const closed = Systems.closeEnterprise(world, enterprise.id);
  assert.equal(closed.ok, true, closed.reason);
  assert.equal(enterprise.status, 'closed');
  assert.equal(enterprise.premiseId, null);
  assert.equal(premise.occupantEnterpriseId, null);
  assert.equal(premise.listedForLease, true);
  assert.deepEqual(enterprise.equipment.map((entry) => entry.id), equipmentIds);
  assert.equal(enterprise.customerHistory.length, customerCount);
  assert.ok(enterprise.history.length > historyCount);
  assert.equal(enterprise.noFailureLabel, true);
  assert.ok(enterprise.history.some((entry) => entry.type === 'closed' && /without a failure label/i.test(entry.message)));
}

function testPivotPreservesExistingEquipmentIdentity() {
  const world = newWorld('ECONOMY-PIVOT');
  world.player.money = 5000;
  const enterprise = createPlayerEnterprise(world);
  const before = new Set(enterprise.equipment.map((entry) => entry.id));
  const pivot = Systems.pivotEnterprise(world, enterprise.id, 'creative_studio', 'need_creative_support');
  assert.equal(pivot.ok, true, pivot.reason);
  assert.equal(enterprise.templateId, 'creative_studio');
  before.forEach((id) => assert.ok(enterprise.equipment.some((entry) => entry.id === id)));
  assert.ok(enterprise.history.some((entry) => entry.type === 'pivoted' && entry.evidence.oldTemplate === 'repair_table'));
}

function testEquipmentRepairAndUpgradePreserveObjectIdentity() {
  const world = newWorld('ECONOMY-EQUIPMENT');
  world.player.money = 5000;
  const enterprise = createPlayerEnterprise(world);
  const equipment = enterprise.equipment[0];
  const id = equipment.id;
  equipment.condition = 45;
  const repaired = Systems.repairEnterpriseEquipment(world, enterprise.id, id);
  assert.equal(repaired.ok, true, repaired.reason);
  assert.equal(equipment.id, id);
  assert.ok(equipment.condition > 45);
  const upgraded = Systems.upgradeEnterpriseEquipment(world, enterprise.id, id, 'reliability');
  assert.equal(upgraded.ok, true, upgraded.reason);
  assert.equal(equipment.id, id);
  assert.equal(equipment.upgrades.reliability, 1);
  assert.ok(equipment.history.some((entry) => entry.type === 'repaired'));
  assert.ok(equipment.history.some((entry) => entry.type === 'upgraded'));
}

function testPricingModesRemainExplicitAndBounded() {
  const world = newWorld('ECONOMY-PRICING');
  const enterprise = createPlayerEnterprise(world);
  assert.equal(Systems.setEnterprisePricing(world, enterprise.id, 'fixed_fair', 27).ok, true);
  assert.deepEqual(enterprise.pricing, { mode: 'fixed_fair', basePrice: 27 });
  assert.equal(Systems.setEnterprisePricing(world, enterprise.id, 'free_exchange', 0).ok, true);
  assert.deepEqual(enterprise.pricing, { mode: 'free_exchange', basePrice: 0 });
  assert.equal(Systems.setEnterprisePricing(world, enterprise.id, 'extractive_maximum', 999).ok, false);
}

function testV07MigrationAddsInfrastructureButNoFabricatedEnterpriseHistory() {
  const current = newWorld('ECONOMY-MIGRATION');
  const legacy = Core.deepClone(current);
  legacy.schema = 'axm.living-city-sim.world/v0.7.0';
  legacy.version = '0.7.0';
  legacy.places = legacy.places.filter((place) => place.kind !== 'commercial');
  delete legacy.localNeeds;
  delete legacy.enterprises;
  delete legacy.enterpriseSessions;
  delete legacy.activeEnterpriseSessionId;
  [legacy.player].concat(legacy.people).forEach((person) => {
    delete person.enterpriseIds;
    delete person.enterpriseCooldownUntil;
  });
  ['enterpriseExperimentPrepared', 'enterpriseFoundationLogged', 'enterpriseSeeded'].forEach((key) => delete legacy.flags[key]);
  Object.keys(legacy.metrics).filter((key) => key.startsWith('enterprise') || key.startsWith('npcEnterprise')).forEach((key) => delete legacy.metrics[key]);
  const migrated = Systems.migrateWorld(legacy);
  assert.equal(migrated.schema, Core.SCHEMA);
  assert.equal(migrated.enterprises.length, 0);
  assert.equal(migrated.enterpriseSessions.length, 0);
  assert.equal(Economy.commercialPremises(migrated).length, 4);
  assert.equal(migrated.localNeeds.length, Economy.LOCAL_NEED_TEMPLATES.length);
  assert.ok(migrated.ledger.some((entry) => entry.type === 'migration' && /no past enterprise/i.test(entry.message)));
  const validation = Systems.validateWorld(migrated);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testChoiceFirstAgeRemainsStableThroughEconomyTime() {
  const world = newWorld('ECONOMY-NO-AGE-PRESSURE');
  const enterprise = createPlayerEnterprise(world);
  const age = world.player.age;
  const ageDays = world.player.lifeCourse.ageDays;
  const stage = world.player.lifeCourse.stage;
  for (let index = 0; index < 4; index += 1) Systems.startEnterpriseSession(world, enterprise.id, 'compressed');
  Systems.advanceHours(world, 24 * 300, { freezePlayer: true });
  assert.equal(world.settings.lifeCourseMode, 'choice');
  assert.equal(world.settings.agePressure, false);
  assert.equal(world.player.age, age);
  assert.equal(world.player.lifeCourse.ageDays, ageDays);
  assert.equal(world.player.lifeCourse.stage, stage);
}

function testResidentEnterpriseEvolutionReplaysDeterministically() {
  function run() {
    const world = newWorld('ECONOMY-DETERMINISTIC');
    Systems.advanceHours(world, 24 * 180);
    return world;
  }
  const a = run();
  const b = run();
  assert.equal(Core.serializeWorld(a), Core.serializeWorld(b));
  assert.ok(a.enterprises.some((entry) => entry.ownerId !== 'player'));
  assert.ok(a.enterpriseSessions.some((entry) => entry.mode === 'autonomous'));
  assert.equal(a.settings.agePressure, false);
  assert.equal(Systems.validateWorld(a).ok, true, Systems.validateWorld(a).errors.join('\n'));
}

function testValidationRejectsInventedCustomerAndAgeGateWithoutRepair() {
  const world = newWorld('ECONOMY-VALIDATION');
  const enterprise = createPlayerEnterprise(world);
  runUntilCustomer(world, enterprise);
  const snapshot = Core.serializeWorld(world);
  enterprise.ageGate = 35;
  enterprise.noAgeGate = false;
  world.enterpriseSessions[world.enterpriseSessions.length - 1].customers.push({ personId: 'anonymous_market_unit', price: 10, satisfaction: 90 });
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((entry) => /choice-first enterprise roots|age/i.test(entry)));
  assert.ok(validation.errors.some((entry) => /actual resident customer|invalid actual resident/i.test(entry)));
  assert.notEqual(Core.serializeWorld(world), snapshot, 'test corruption should remain visible rather than silently repaired');
}

function testWorkerOfferCreatesNoImmediateLaborOrWiderAuthority() {
  const world = newWorld('ECONOMY-WORKER-OFFER');
  const enterprise = createPlayerEnterprise(world);
  const person = world.people.find((entry) => !globalThis.AXM.Family.isDependent(entry));
  const beforeRelation = Core.deepClone(person.relationships?.player || null);
  const result = Systems.inviteEnterpriseWorker(world, enterprise.id, person.id, { wagePerSession: 28, sessionsPerWeek: 1 });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.offer.status, 'pending_npc');
  assert.equal(enterprise.workerIds.includes(person.id), false, 'sending an offer must not create labor');
  assert.equal(result.offer.authority.enterpriseWork, true);
  assert.equal(result.offer.authority.enterpriseOwnership, false);
  assert.equal(result.offer.authority.household, false);
  assert.equal(result.offer.authority.tenancy, false);
  assert.equal(result.offer.authority.propertyEdit, false);
  assert.deepEqual(person.relationships?.player || null, beforeRelation, 'sending an offer must not secretly change the relationship');
}

function testAcceptedWorkerIsPaidFromReservedEnterpriseFunds() {
  const world = newWorld('ECONOMY-WORKER-ACCEPT');
  const enterprise = createPlayerEnterprise(world);
  enterprise.funds = 500;
  const person = world.people.find((entry) => !globalThis.AXM.Family.isDependent(entry));
  person.traits.ambition = 100;
  person.traits.independence = 0;
  if (!person.relationships.player) person.relationships.player = { friendship: 0, trust: 0, romance: 0, status: 'none' };
  person.relationships.player.friendship = 100;
  person.relationships.player.trust = 100;
  const offered = Systems.inviteEnterpriseWorker(world, enterprise.id, person.id, { wagePerSession: 40, sessionsPerWeek: 1 });
  assert.equal(offered.ok, true, offered.reason);
  world.time.day = offered.offer.dueDay;
  world.time.hour = 20;
  Economy.resolveEnterpriseWorkOffers(world);
  assert.equal(offered.offer.status, 'accepted', JSON.stringify(offered.offer.response));
  assert.ok(enterprise.workerIds.includes(person.id));
  const workerMoneyBefore = person.money;
  const fundsBefore = enterprise.funds;
  const sessionResult = Systems.startEnterpriseSession(world, enterprise.id, 'compressed');
  assert.equal(sessionResult.ok, true, sessionResult.reason);
  assert.ok(sessionResult.session.workerIds.includes(person.id), 'accepted worker should join one available bounded session');
  assert.equal(Core.round(person.money - workerMoneyBefore, 2), 40, 'worker receives the exact recorded wage');
  assert.equal(sessionResult.session.wageReserve, 40);
  assert.equal(offered.offer.sessionsWorkedThisWeek, 1);
  assert.equal(enterprise.totals.wages, 40);
  assert.ok(enterprise.funds <= fundsBefore + sessionResult.session.revenue, 'wage cannot be fabricated outside enterprise funds and session revenue');
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testWorkerDeclineAndAgreementEndCarryNoHiddenRelationshipPenalty() {
  const world = newWorld('ECONOMY-WORKER-BOUNDARY');
  const enterprise = createPlayerEnterprise(world);
  const person = world.people.find((entry) => !globalThis.AXM.Family.isDependent(entry));
  person.traits.ambition = 0;
  person.traits.independence = 100;
  if (!person.relationships.player) person.relationships.player = { friendship: -100, trust: -100, romance: 0, status: 'none' };
  person.relationships.player.friendship = -100;
  person.relationships.player.trust = -100;
  const before = Core.deepClone(person.relationships.player);
  const offered = Systems.inviteEnterpriseWorker(world, enterprise.id, person.id, { wagePerSession: 6, sessionsPerWeek: 3 });
  assert.equal(offered.ok, true, offered.reason);
  world.time.day = offered.offer.dueDay;
  Economy.resolveEnterpriseWorkOffers(world);
  assert.equal(offered.offer.status, 'declined', JSON.stringify(offered.offer.response));
  assert.equal(enterprise.workerIds.includes(person.id), false);
  assert.deepEqual(person.relationships.player, before, 'declining work must not create a hidden relationship punishment');

  // A separate accepted agreement can also end without wider authority or relationship damage.
  const second = world.people.find((entry) => entry.id !== person.id && !globalThis.AXM.Family.isDependent(entry));
  if (!second.relationships.player) second.relationships.player = { friendship: 100, trust: 100, romance: 0, status: 'friend' };
  second.relationships.player.friendship = 100;
  second.relationships.player.trust = 100;
  second.traits.ambition = 100;
  second.traits.independence = 0;
  const accepted = Systems.inviteEnterpriseWorker(world, enterprise.id, second.id, { wagePerSession: 60, sessionsPerWeek: 1 });
  assert.equal(accepted.ok, true, accepted.reason);
  world.time.day = accepted.offer.dueDay;
  Economy.resolveEnterpriseWorkOffers(world);
  assert.equal(accepted.offer.status, 'accepted');
  const secondRelation = Core.deepClone(second.relationships.player);
  const ended = Systems.endEnterpriseWorker(world, enterprise.id, second.id);
  assert.equal(ended.ok, true, ended.reason);
  assert.equal(accepted.offer.status, 'ended');
  assert.equal(enterprise.workerIds.includes(second.id), false);
  assert.deepEqual(second.relationships.player, secondRelation, 'ending bounded enterprise work must not rewrite the relationship');
}

function testLabeledExperimentUsesOrdinaryEngineAndIsSingleUse() {
  const world = newWorld('ECONOMY-EXPERIMENT');
  const first = Systems.prepareEnterpriseExperiment(world);
  assert.equal(first.ok, true, first.reason);
  const enterprise = Economy.enterpriseById(world, first.enterpriseId);
  assert.ok(enterprise && enterprise.ownerId === 'player');
  assert.ok(enterprise.history.some((entry) => entry.type === 'experiment_prepared'));
  assert.ok(world.ledger.some((entry) => entry.type === 'research' && /enterprise experiment grant/i.test(entry.message)));
  const second = Systems.prepareEnterpriseExperiment(world);
  assert.equal(second.ok, false);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

const tests = [
  testFoundationAddsRealRoomsNeedsAndResidentDirections,
  testPrivateHobbyCreatesNoForcedStartupCost,
  testSourceProjectProvenanceRemainsLinked,
  testOccasionalServiceUsesAttributableStarterKit,
  testCommercialLeaseUsesGenuineVacancyAndSeparateAuthority,
  testCustomersAreActualResidentsWithRealMoney,
  testNoAnonymousDemandRecordsCanAppear,
  testCompressedAndEnteredWorkAreBothValid,
  testInteractiveCancellationInventsNoCustomersOrRevenue,
  testPauseAndResumeCreateNoFailurePenalty,
  testPausedPremiseChoiceIsExplicitAndCasual,
  testClosureReleasesRoomAndPreservesHistoryAndEquipment,
  testPivotPreservesExistingEquipmentIdentity,
  testEquipmentRepairAndUpgradePreserveObjectIdentity,
  testPricingModesRemainExplicitAndBounded,
  testV07MigrationAddsInfrastructureButNoFabricatedEnterpriseHistory,
  testChoiceFirstAgeRemainsStableThroughEconomyTime,
  testResidentEnterpriseEvolutionReplaysDeterministically,
  testValidationRejectsInventedCustomerAndAgeGateWithoutRepair,
  testWorkerOfferCreatesNoImmediateLaborOrWiderAuthority,
  testAcceptedWorkerIsPaidFromReservedEnterpriseFunds,
  testWorkerDeclineAndAgreementEndCarryNoHiddenRelationshipPenalty,
  testLabeledExperimentUsesOrdinaryEngineAndIsSingleUse
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
    process.exit(1);
  }
}
console.log(`\n${passed}/${tests.length} living-local-economy tests passed.`);
