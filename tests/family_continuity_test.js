'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, Content, World, Systems, Households, Habitats, Family } = globalThis.AXM;

function newWorld(seed = 'AXM-FAMILY-TEST') {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  world.people.forEach((person) => {
    person.moveCooldownUntil = 9999;
    person.habitatIntentionCooldownUntil = 9999;
  });
  return world;
}

function setupFamily(seed = 'AXM-FAMILY-SETUP', variant = 'young_child') {
  const world = newWorld(seed);
  const result = Systems.prepareFamilyContinuityExperiment(world, variant);
  assert.equal(result.ok, true, result.reason);
  const unit = Family.familyUnitById(world, result.familyUnitId);
  const dependent = World.getPerson(world, result.dependentId);
  const partner = World.getPerson(world, result.partnerId);
  const household = Households.playerHousehold(world);
  const home = World.getProperty(world, result.propertyId);
  assert.ok(unit && dependent && partner && household && home);
  return { world, result, unit, dependent, partner, household, home };
}

function allObjectLocations(world) {
  const locations = new Map();
  world.places.filter((property) => property.kind === 'residential').forEach((property) => {
    property.furniture.forEach((object) => locations.set(object.id, `property:${property.id}`));
  });
  [world.player].concat(world.people).forEach((person) => {
    (person.storedFurniture || []).forEach((object) => locations.set(object.id, `storage:${person.id}`));
  });
  return locations;
}

function dependentObjectIds(world, dependentId) {
  const ids = [];
  world.places.filter((property) => property.kind === 'residential').forEach((property) => {
    property.furniture.filter((object) => object.ownerId === dependentId).forEach((object) => ids.push(object.id));
  });
  const person = World.getPerson(world, dependentId);
  (person?.storedFurniture || []).filter((object) => object.ownerId === dependentId).forEach((object) => ids.push(object.id));
  return ids.sort();
}

function resolveFamilyProposal(world, proposal, options = {}) {
  proposal.dueDay = world.time.day;
  const original = Core.hashString;
  Core.hashString = (text) => {
    if (options.teenVoiceDeclines && String(text).includes('teen-room-voice')) return 100;
    return options.decline ? 100 : 0;
  };
  try {
    Family.dailyTick(world);
  } finally {
    Core.hashString = original;
  }
  return proposal;
}

function resolveHouseholdProposal(world, proposal) {
  proposal.dueDay = world.time.day;
  const original = Core.randomInt;
  Core.randomInt = () => 0;
  try {
    Households.dailyTick(world, {});
  } finally {
    Core.randomInt = original;
  }
  return proposal;
}

function emptyProperty(world, target, excludedIds = []) {
  const excluded = new Set([target.id, ...excludedIds]);
  for (const tenantId of target.tenants.slice()) {
    if (tenantId === 'player') throw new Error('Test target unexpectedly contains the player.');
    const tenant = World.getPerson(world, tenantId);
    assert.ok(tenant, `missing target tenant ${tenantId}`);
    const vacancy = world.places.find((property) => property.kind === 'residential'
      && !excluded.has(property.id)
      && property.tenants.length < property.capacity
      && !property.tenants.includes('player'));
    assert.ok(vacancy, `no lawful vacancy available for ${tenant.name}`);
    const moved = Systems.moveNpc(world, tenant, vacancy, { waiveCost: true, causes: ['focused whole-family relocation test setup'] });
    assert.equal(moved.ok, true, moved.reason);
  }
  assert.equal(target.tenants.length, 0);
}

function alternativeSurfaceSpec(property, roomId) {
  const room = Habitats.roomById(property, roomId);
  assert.ok(room);
  const finish = Habitats.FINISHES.find((entry) => entry.id !== room.finish.wallFinishId);
  assert.ok(finish);
  return { type: 'surface', target: { roomId, surface: 'walls', finishId: finish.id } };
}

function testInitialLifeCourseAddsNoInventedFamily() {
  const world = newWorld('AXM-FAMILY-INITIAL');
  assert.equal(world.familyUnits.length, 0);
  assert.equal(world.familyProposals.length, 0);
  assert.equal(world.careRecords.length, 0);
  [world.player].concat(world.people).forEach((person) => {
    assert.equal(person.lifeCourse.schema, Family.LIFE_COURSE_SCHEMA);
    assert.equal(person.familyUnitId, null);
    assert.equal(person.dependent || false, false);
  });
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testV04MigrationAddsClockButInventsNoFamilyTies() {
  const current = newWorld('AXM-FAMILY-MIGRATION');
  const legacy = Core.deepClone(current);
  legacy.schema = 'axm.living-city-sim.world/v0.4.0';
  legacy.version = '0.4.0';
  delete legacy.familyUnits;
  delete legacy.familyProposals;
  delete legacy.careRecords;
  delete legacy.flags.familyExperimentPrepared;
  delete legacy.ui.selectedFamilyUnitId;
  delete legacy.ui.selectedFamilyProposalId;
  delete legacy.ui.selectedDependentId;
  delete legacy.player.lifeCourse;
  delete legacy.player.familyUnitId;
  legacy.people.forEach((person) => {
    delete person.lifeCourse;
    delete person.familyUnitId;
    delete person.dependent;
  });
  Systems.migrateWorld(legacy);
  assert.equal(legacy.schema, Core.SCHEMA);
  assert.deepEqual(legacy.familyUnits, []);
  assert.deepEqual(legacy.familyProposals, []);
  assert.deepEqual(legacy.careRecords, []);
  [legacy.player].concat(legacy.people).forEach((person) => {
    assert.equal(person.lifeCourse.schema, Family.LIFE_COURSE_SCHEMA);
    assert.equal(person.familyUnitId, null);
    assert.equal(person.dependent || false, false);
  });
  assert.ok(legacy.ledger.some((entry) => entry.type === 'migration' && /no fabricated/i.test(entry.causes.join(' '))));
  const validation = Systems.validateWorld(legacy);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testLabeledExperimentCreatesSeparateAutonomousFamilyGraph() {
  const { world, unit, dependent, partner, household, home } = setupFamily('AXM-FAMILY-GRAPH');
  assert.equal(unit.linkedHouseholdId, household.id);
  assert.deepEqual(household.memberIds.sort(), ['player', partner.id].sort(), 'dependent must not be smuggled into the adult agreement');
  assert.equal(household.memberIds.includes(dependent.id), false);
  assert.equal(dependent.familyUnitId, unit.id);
  assert.equal(dependent.householdId, null);
  assert.equal(dependent.dependent, true);
  assert.equal(dependent.jobId, null);
  assert.equal(dependent.rentArrears, 0);
  assert.equal(dependent.isPlayerControlled, false);
  assert.ok(home.tenants.includes(dependent.id));
  const member = unit.members.find((entry) => entry.personId === dependent.id);
  assert.equal(member.role, 'dependent');
  assert.equal(member.agency, 'autonomous_dependent');
  const objects = dependentObjectIds(world, dependent.id);
  assert.ok(objects.length >= 3, 'dependent should receive personally owned starter objects');
  objects.forEach((id) => {
    const location = allObjectLocations(world).get(id);
    assert.ok(location, `object ${id} must remain locatable`);
  });
  const assignment = unit.roomAssignments.find((entry) => entry.personId === dependent.id);
  assert.ok(assignment);
  assert.ok(Habitats.roomById(home, assignment.roomId));
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}


function testFamilyHomeCapacityIsNotAutomaticPublicListing() {
  const world = World.createWorld('AXM-FAMILY-CAPACITY-BOUNDARY');
  Systems.updateNpcSchedules(world);
  const prepared = Systems.prepareFamilyContinuityExperiment(world, 'young_child');
  assert.equal(prepared.ok, true, prepared.reason);
  const unit = Family.familyUnitById(world, prepared.familyUnitId);
  const home = World.getProperty(world, prepared.propertyId);
  assert.ok(unit && home);
  assert.equal(home.listedForRent, false, 'accepted family capacity must not remain an automatic public room listing');
  const familyIds = new Set(unit.members.map((member) => member.personId));
  world.people.filter((person) => !familyIds.has(person.id)).forEach((person) => { person.moveCooldownUntil = world.time.day; });
  Systems.advanceHours(world, 40 * 24, { freezePlayer: true });
  assert.equal(home.listedForRent, false);
  assert.deepEqual(home.tenants.filter((id) => !familyIds.has(id)), [], 'unrelated residents may not silently occupy reserved family capacity');
  const second = Family.welcomeDependent(world, unit, { stage: 'toddler', experiment: true });
  assert.equal(second.ok, true, second.reason);
  assert.equal(home.listedForRent, false);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testParenthoodProposalRequiresAnswerPreparationAndCapacity() {
  const { world, unit } = setupFamily('AXM-FAMILY-PHASED-ARRIVAL');
  const peopleBefore = world.people.length;
  const proposed = Systems.proposeParenthood(world, {
    path: 'adoption', preferredStage: 'child', careMode: 'balanced', educationMode: 'home_project_mix',
    preparationDays: 4, playerCommitmentHours: 2.5, partnerCommitmentHours: 2, weeklyBudget: 70
  });
  assert.equal(proposed.ok, true, proposed.reason);
  assert.equal(proposed.proposal.status, 'pending_npc');
  assert.equal(world.people.length, peopleBefore, 'opening a proposal must not create a child');
  assert.equal(unit.pendingArrival, null);
  resolveFamilyProposal(world, proposed.proposal);
  assert.equal(proposed.proposal.status, 'accepted');
  assert.ok(unit.pendingArrival);
  assert.equal(world.people.length, peopleBefore, 'acceptance begins preparation rather than creating a person instantly');
  unit.pendingArrival.readyDay = world.time.day;
  Family.dailyTick(world);
  assert.equal(world.people.length, peopleBefore + 1);
  assert.equal(unit.pendingArrival, null);
  assert.equal(proposed.proposal.status, 'implemented');
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testParenthoodRefusalLeavesAdultRelationshipUntouched() {
  const { world, partner } = setupFamily('AXM-FAMILY-PARENTHOOD-REFUSAL');
  const relation = world.player.relationships[partner.id];
  relation.friendship = -100;
  relation.trust = -100;
  relation.romance = -100;
  partner.traits.stability = 0;
  partner.traits.independence = 100;
  world.player.money = 0;
  partner.money = 0;
  const before = Core.deepClone(relation);
  const proposed = Systems.proposeParenthood(world, { path: 'new_child', preferredStage: 'infant' });
  assert.equal(proposed.ok, true, proposed.reason);
  resolveFamilyProposal(world, proposed.proposal, { decline: true });
  assert.equal(proposed.proposal.status, 'declined');
  assert.deepEqual(world.player.relationships[partner.id], before, 'family refusal must not inject a hidden adult relationship punishment');
}

function testAcceptedCareUsesTimeMoneyEvidenceAndInfluence() {
  const { world, unit, dependent } = setupFamily('AXM-FAMILY-CARE-ACCEPT');
  const relation = world.player.relationships[dependent.id];
  relation.friendship = 100;
  relation.trust = 100;
  const before = {
    day: world.time.day, hour: world.time.hour, money: world.player.money,
    curiosity: dependent.development.curiosity, creativity: dependent.development.creativity,
    trust: relation.trust
  };
  const original = Core.hashString;
  Core.hashString = () => 0;
  let result;
  try { result = Systems.performCareAction(world, dependent.id, 'read_create'); }
  finally { Core.hashString = original; }
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.accepted, true);
  assert.equal(world.player.money, Core.round(before.money - Family.CARE_ACTIONS.read_create.cost, 2));
  const elapsed = (world.time.day - before.day) * 24 + world.time.hour - before.hour;
  assert.equal(elapsed, Family.CARE_ACTIONS.read_create.hours);
  assert.ok(dependent.development.curiosity > before.curiosity);
  assert.ok(dependent.development.creativity > before.creativity);
  const record = Family.careRecordForDay(world, unit, dependent.id, false);
  assert.ok(record);
  assert.equal(record.playerHours, Family.CARE_ACTIONS.read_create.hours);
  assert.ok(record.actions.some((entry) => entry.actionId === 'read_create' && entry.accepted));
}

function testCareRefusalCostsNoMoneyAndAddsNoPunishment() {
  const { world, unit, dependent } = setupFamily('AXM-FAMILY-CARE-REFUSAL', 'teen');
  const relation = world.player.relationships[dependent.id];
  relation.friendship = -100;
  relation.trust = -100;
  dependent.needs.mood = 0;
  dependent.careAutonomy.preferredActivities = [];
  const moneyBefore = world.player.money;
  const trustBefore = relation.trust;
  const timeBefore = world.time.day * 24 + world.time.hour;
  const original = Core.hashString;
  Core.hashString = () => 100;
  let result;
  try { result = Systems.performCareAction(world, dependent.id, 'neighborhood_outing'); }
  finally { Core.hashString = original; }
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.accepted, false);
  assert.equal(world.player.money, moneyBefore);
  assert.equal(world.time.day * 24 + world.time.hour, timeBefore + 1, 'listening to the refusal still takes a bounded hour');
  assert.ok(relation.trust >= trustBefore, 'respecting refusal must not lower hidden trust');
  const record = Family.careRecordForDay(world, unit, dependent.id, false);
  assert.ok(record.actions.some((entry) => entry.actionId === 'neighborhood_outing' && entry.accepted === false));
}

function testGenericAdultSocialAndRomanceAreBlockedForDependents() {
  const { world, dependent } = setupFamily('AXM-FAMILY-SOCIAL-BOUNDARY', 'teen');
  const before = Core.deepClone(world.player.relationships[dependent.id]);
  const flirt = Systems.interactWithNpc(world, dependent.id, 'flirt');
  assert.equal(flirt.ok, false);
  assert.match(flirt.reason, /family/i);
  assert.deepEqual(world.player.relationships[dependent.id], before);
}

function testLateNightFamilyProposalCannotResolveInsideItsOwnSendingAction() {
  const world = World.createWorld('AXM-FAMILY-LATE-NIGHT-PROPOSAL');
  world.player.money = 100000;
  const prepared = Systems.prepareFamilyContinuityExperiment(world, 'teen');
  assert.equal(prepared.ok, true, prepared.reason);
  const unit = Family.familyUnitById(world, prepared.familyUnitId);
  const dayBefore = world.time.day;
  world.time.hour = 23;

  const result = Systems.proposeFamilyChange(world, unit.id, 'education_plan', { mode: 'home_project_mix' });
  assert.equal(result.ok, true, result.reason);
  assert.equal(world.time.day, dayBefore + 1, 'the one-hour sending action should cross midnight');
  assert.equal(result.proposal.status, 'pending_npc', 'the recipient must still receive a real delayed decision window');
  assert.ok(result.proposal.dueDay > world.time.day, 'the proposal cannot become due during the same action that creates it');
}

function testEducationAndCommunitySupportUseDailyEvidence() {
  const { world, unit, dependent } = setupFamily('AXM-FAMILY-EDUCATION');
  const progressBefore = dependent.education.progress;
  for (let day = 0; day < 6; day += 1) {
    world.time.day += 1;
    Family.dailyTick(world);
  }
  assert.ok(dependent.education.progress > progressBefore);
  assert.ok(dependent.education.attendanceDays > 0);
  const records = world.careRecords.filter((record) => record.familyUnitId === unit.id && record.personId === dependent.id);
  assert.ok(records.some((record) => record.communityHours > 0));
  assert.ok(world.metrics.educationDays > 0);
}

function testDependentPrivateRoomBlocksUnilateralPlayerPlacement() {
  const { world, unit, dependent, home } = setupFamily('AXM-FAMILY-PRIVATE-ROOM');
  const assignment = unit.roomAssignments.find((entry) => entry.personId === dependent.id);
  const room = Habitats.roomById(home, assignment.roomId);
  const [x, y] = room.cells[0].split(',').map(Number);
  const object = World.createFurnitureInstance(world, 'wall_print', 'player');
  const result = Habitats.placementPermission(world, home, 'player', object, x, y, object.footprint);
  assert.equal(result.ok, false);
  assert.match(result.reason, /private room/i);
  const childObject = home.furniture.find((entry) => entry.ownerId === dependent.id) || dependent.storedFurniture[0];
  assert.ok(childObject);
  const childResult = Family.placementPermission(world, home, dependent.id, childObject, x, y, childObject.footprint);
  assert.equal(childResult.ok, true);
}

function testFamilyRoomConstructionNeedsPlanThenRealWork() {
  const { world, unit, dependent, home } = setupFamily('AXM-FAMILY-ROOM-PROJECT');
  world.player.money = 1_000_000;
  Object.keys(world.player.materials).forEach((key) => { world.player.materials[key] = 250; });
  const assignment = unit.roomAssignments.find((entry) => entry.personId === dependent.id);
  const room = Habitats.roomById(home, assignment.roomId);
  const oldFinish = room.finish.wallFinishId;
  const spec = alternativeSurfaceSpec(home, room.id);
  const request = Systems.requestHabitatProject(world, home.id, spec);
  assert.equal(request.ok, true, request.reason);
  assert.equal(request.requiresFamilyProposal, true);
  assert.equal(request.proposal.status, 'pending_npc');
  assert.equal(Habitats.roomById(home, room.id).finish.wallFinishId, oldFinish, 'proposal creation must not mutate the room');
  resolveFamilyProposal(world, request.proposal);
  assert.equal(request.proposal.status, 'implemented');
  assert.ok(request.proposal.implementedProjectId);
  assert.equal(Habitats.roomById(home, room.id).finish.wallFinishId, oldFinish, 'acceptance should queue construction rather than instantly applying it');
  let project = home.habitat.projects.find((entry) => entry.id === request.proposal.implementedProjectId);
  assert.ok(project);
  for (let step = 0; step < 20 && !['completed', 'failed', 'cancelled'].includes(project.status); step += 1) {
    const worked = Systems.workHabitatProject(world, project.id);
    assert.equal(worked.ok, true, worked.reason);
    project = home.habitat.projects.find((entry) => entry.id === project.id);
  }
  assert.equal(project.status, 'completed');
  assert.equal(Habitats.roomById(home, room.id).finish.wallFinishId, spec.target.finishId);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testTeenRoomVoiceCanVetoWithoutHiddenPenalty() {
  const { world, unit, dependent, partner, home } = setupFamily('AXM-FAMILY-TEEN-VOICE', 'teen');
  const assignment = unit.roomAssignments.find((entry) => entry.personId === dependent.id);
  const spec = alternativeSurfaceSpec(home, assignment.roomId);
  const adultRelationBefore = Core.deepClone(world.player.relationships[partner.id]);
  const childRelationBefore = Core.deepClone(world.player.relationships[dependent.id]);
  const request = Systems.requestHabitatProject(world, home.id, spec);
  assert.equal(request.ok, true, request.reason);
  resolveFamilyProposal(world, request.proposal, { teenVoiceDeclines: true });
  assert.equal(request.proposal.status, 'declined');
  assert.equal(request.proposal.response.evidence.dependentVoice.accepted, false);
  assert.equal(home.habitat.projects.some((project) => project.familyProposalId === request.proposal.id || project.proposalId === request.proposal.id), false);
  assert.deepEqual(world.player.relationships[partner.id], adultRelationBefore);
  assert.deepEqual(world.player.relationships[dependent.id], childRelationBefore);
}

function testDependentCannotMoveAloneOrCarryRentDebt() {
  const { world, dependent, home } = setupFamily('AXM-FAMILY-HOUSING-BOUNDARY');
  const destination = world.places.find((property) => property.kind === 'residential' && property.id !== home.id && property.tenants.length < property.capacity);
  assert.ok(destination);
  const moved = Systems.moveNpc(world, dependent, destination, { waiveCost: true });
  assert.equal(moved.ok, false);
  assert.match(moved.reason, /family/i);
  const moneyBefore = dependent.money;
  world.time.day = 7;
  world.time.hour = 23;
  Systems.advanceHours(world, 2);
  assert.equal(dependent.money, moneyBefore);
  assert.equal(dependent.rentArrears, 0);
}

function testWholeFamilyRelocationMovesDependentsAndObjectsTogether() {
  const { world, unit, dependent, partner, household, home } = setupFamily('AXM-FAMILY-WHOLE-MOVE');
  world.player.money = 1_000_000;
  partner.money = 1_000_000;
  const relation = world.player.relationships[partner.id];
  relation.friendship = 100;
  relation.trust = 100;
  relation.romance = 100;
  const target = world.places.find((property) => property.kind === 'residential' && property.id !== home.id && property.capacity >= 3);
  assert.ok(target);
  emptyProperty(world, target, [home.id]);
  const beforeObjects = dependentObjectIds(world, dependent.id);
  const proposed = Systems.proposeCohabitation(world, partner.id, target.id);
  assert.equal(proposed.ok, true, proposed.reason);
  resolveHouseholdProposal(world, proposed.proposal);
  assert.equal(proposed.proposal.status, 'implemented', JSON.stringify(proposed.proposal.response));
  assert.equal(world.player.homePropertyId, target.id);
  assert.equal(partner.homePropertyId, target.id);
  assert.equal(dependent.homePropertyId, target.id);
  assert.equal(unit.homePropertyId, target.id);
  assert.ok(target.tenants.includes(dependent.id));
  assert.equal(home.tenants.includes(dependent.id), false);
  assert.deepEqual(dependentObjectIds(world, dependent.id), beforeObjects);
  assert.ok(unit.roomAssignments.every((entry) => Habitats.roomById(target, entry.roomId)));
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testAdultSeparationPreservesDependentContinuityAndObjects() {
  const { world, unit, dependent, household } = setupFamily('AXM-FAMILY-SEPARATION');
  const objectsBefore = dependentObjectIds(world, dependent.id);
  const result = Systems.endHouseholdAgreement(world, household.id, null, true);
  assert.equal(result.ok, true, result.reason);
  assert.equal(household.status, 'ended');
  assert.equal(unit.status, 'continuing_separately');
  assert.equal(unit.linkedHouseholdId, null);
  assert.equal(dependent.familyUnitId, unit.id);
  assert.deepEqual(dependentObjectIds(world, dependent.id), objectsBefore);
  assert.match(unit.separation.boundary, /not a legal custody model/i);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testLifeStageTransitionPreservesIdentityAndLaunchesAdultAgency() {
  const { world, unit, dependent } = setupFamily('AXM-FAMILY-ADULT-TRANSITION', 'teen');
  assert.equal(Systems.setLifeCourseMode(world, 'calendar').ok, true);
  const id = dependent.id;
  const objectsBefore = dependentObjectIds(world, id);
  dependent.lifeCourse.ageDays = 18 * 365 - 1;
  dependent.lifeCourse.ageYears = 17;
  dependent.lifeCourse.stage = 'teen';
  dependent.age = 17;
  Family.dailyTick(world);
  assert.equal(dependent.id, id);
  assert.equal(dependent.lifeCourse.stage, 'young_adult');
  assert.equal(dependent.dependent, false);
  assert.ok(Content.jobById(dependent.jobId));
  const member = unit.members.find((entry) => entry.personId === id);
  assert.equal(member.role, 'adult_child');
  assert.equal(unit.roomAssignments.some((entry) => entry.personId === id), false);
  assert.deepEqual(dependentObjectIds(world, id), objectsBefore);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testAdultChildCanAutonomouslyLaunchWithoutErasingFamilyLink() {
  const { world, unit, dependent, home } = setupFamily('AXM-FAMILY-ADULT-LAUNCH', 'teen');
  assert.equal(Systems.setLifeCourseMode(world, 'calendar').ok, true);
  dependent.lifeCourse.ageDays = 18 * 365 - 1;
  dependent.lifeCourse.ageYears = 17;
  dependent.lifeCourse.stage = 'teen';
  dependent.age = 17;
  Family.dailyTick(world);
  dependent.money = 100_000;
  dependent.moveCooldownUntil = world.time.day;
  const originalHome = home.id;
  let launched = false;
  for (let step = 0; step < 80 && !launched; step += 1) {
    world.time.day += 1;
    Family.dailyTick(world);
    launched = dependent.homePropertyId !== originalHome;
  }
  assert.equal(launched, true, 'young adult should eventually make an affordable independent housing choice');
  const member = unit.members.find((entry) => entry.personId === dependent.id);
  assert.ok(member.leftDay);
  assert.equal(dependent.familyUnitId, unit.id, 'family provenance continues after leaving the home');
  assert.equal(world.metrics.adultChildrenLaunched, 1);
  const firstIndependentHome = dependent.homePropertyId;
  for (let step = 0; step < 120; step += 1) {
    world.time.day += 1;
    Family.dailyTick(world);
  }
  assert.equal(world.metrics.adultChildrenLaunched, 1, 'the first independent launch may only be recorded once');
  assert.equal(dependent.homePropertyId, firstIndependentHome, 'family launch logic must not keep remapping an already independent adult child');
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testValidationDiagnosesFamilyCorruptionWithoutRepairingIt() {
  const { world, dependent } = setupFamily('AXM-FAMILY-CORRUPTION');
  dependent.jobId = 'corner_cafe';
  dependent.rentArrears = 55;
  const before = Core.serializeWorld(world);
  const validation = Systems.validateWorld(world);
  const after = Core.serializeWorld(world);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => /dependent.*adult job/i.test(error)));
  assert.ok(validation.errors.some((error) => /financial dependent.*rent arrears/i.test(error)));
  assert.equal(after, before, 'validation must diagnose rather than silently repair family corruption');
}

function testDeterministicFamilyEvolution() {
  function run(seed) {
    const { world, dependent } = setupFamily(seed, 'teen');
    const original = Core.hashString;
    Core.hashString = () => 0;
    try { Systems.performCareAction(world, dependent.id, 'listen_check_in'); }
    finally { Core.hashString = original; }
    Systems.advanceHours(world, 75 * 24, { freezePlayer: true });
    world.familyProposals.filter((proposal) => proposal.status === 'awaiting_player').forEach((proposal) => Systems.respondToFamilyProposal(world, proposal.id, 'accept'));
    const validation = Systems.validateWorld(world);
    assert.equal(validation.ok, true, validation.errors.join('\n'));
    return Core.serializeWorld(world);
  }
  assert.equal(run('AXM-FAMILY-DETERMINISM'), run('AXM-FAMILY-DETERMINISM'));
}

const tests = [
  testInitialLifeCourseAddsNoInventedFamily,
  testV04MigrationAddsClockButInventsNoFamilyTies,
  testLabeledExperimentCreatesSeparateAutonomousFamilyGraph,
  testFamilyHomeCapacityIsNotAutomaticPublicListing,
  testParenthoodProposalRequiresAnswerPreparationAndCapacity,
  testParenthoodRefusalLeavesAdultRelationshipUntouched,
  testAcceptedCareUsesTimeMoneyEvidenceAndInfluence,
  testCareRefusalCostsNoMoneyAndAddsNoPunishment,
  testGenericAdultSocialAndRomanceAreBlockedForDependents,
  testLateNightFamilyProposalCannotResolveInsideItsOwnSendingAction,
  testEducationAndCommunitySupportUseDailyEvidence,
  testDependentPrivateRoomBlocksUnilateralPlayerPlacement,
  testFamilyRoomConstructionNeedsPlanThenRealWork,
  testTeenRoomVoiceCanVetoWithoutHiddenPenalty,
  testDependentCannotMoveAloneOrCarryRentDebt,
  testWholeFamilyRelocationMovesDependentsAndObjectsTogether,
  testAdultSeparationPreservesDependentContinuityAndObjects,
  testLifeStageTransitionPreservesIdentityAndLaunchesAdultAgency,
  testAdultChildCanAutonomouslyLaunchWithoutErasingFamilyLink,
  testValidationDiagnosesFamilyCorruptionWithoutRepairingIt,
  testDeterministicFamilyEvolution,
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

if (!process.exitCode) console.log(`\n${passed}/${tests.length} family continuity tests passed.`);
