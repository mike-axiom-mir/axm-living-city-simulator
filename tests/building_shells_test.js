'use strict';

const assert = require('assert');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Shells } = globalThis.AXM;

function newWorld(seed = 'AXM-SHELL-TEST') {
  const world = World.createWorld(seed);
  Shells.initializeWorld(world, { silent: true });
  return world;
}

function completeProject(world, projectId) {
  let guard = 0;
  while (guard < 80) {
    const project = Shells.projectById(world, projectId);
    if (!project || ['completed', 'failed', 'cancelled'].includes(project.status)) return project;
    const result = Systems.advanceFrontageProject(world, projectId);
    assert.equal(result.ok, true, result.reason);
    guard += 1;
  }
  throw new Error('Frontage project did not finish in a bounded number of steps.');
}

function testDeterministicShellGeneration() {
  const a = newWorld('SHELL-DETERMINISTIC');
  const b = newWorld('SHELL-DETERMINISTIC');
  assert.deepEqual(a.buildings, b.buildings);
  assert.equal(a.shellRngState, b.shellRngState);
}

function testEveryPlaceBelongsToExactlyOneShell() {
  const world = newWorld('SHELL-ASSIGNMENT');
  const counts = new Map();
  world.buildings.forEach((building) => building.placeIds.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
  world.places.forEach((place) => {
    assert.equal(counts.get(place.id), 1, `${place.id} must belong to exactly one shell.`);
    assert.ok(place.shellRef?.buildingId);
    assert.equal(Shells.buildingForPlace(world, place.id)?.id, place.shellRef.buildingId);
  });
}

function testTwoStoreyApartmentHasRealVerticalRoute() {
  const world = newWorld('SHELL-APARTMENT');
  const building = Shells.buildingById(world, 'building_courtyard_walkup');
  assert.ok(building);
  assert.equal(building.storeys.length, 2);
  assert.equal(building.verticalLinks.length, 1);
  assert.equal(building.verticalLinks[0].type, 'stairs');
  const upper = World.getPlace(world, 'home_courtyard_2');
  assert.ok(upper.shellRef.primaryStoreyId.includes('_s1_'));
  const route = Shells.routeFromStreetToPlace(world, upper.id);
  assert.ok(route);
  assert.ok(route.edgeIds.some((id) => building.routeNetwork.edges.find((edge) => edge.id === id)?.kind === 'stairs'));
}

function testAllShellWallGraphsAndOpeningsAreGrounded() {
  const world = newWorld('SHELL-WALLS');
  world.buildings.forEach((building) => {
    building.storeys.forEach((storey) => {
      assert.equal(storey.wallGraph.nodes.length, 4);
      assert.equal(storey.wallGraph.edges.length, 4);
      const edgeIds = new Set(storey.wallGraph.edges.map((edge) => edge.id));
      storey.openings.forEach((opening) => assert.ok(edgeIds.has(opening.wallEdgeId)));
    });
  });
}

function testEveryPlaceRoutesFromStreetToCurrentInteriorEntry() {
  const world = newWorld('SHELL-CONTINUITY');
  world.places.forEach((place) => {
    const route = Shells.routeFromStreetToPlace(world, place.id);
    assert.ok(route, `No internal route for ${place.id}.`);
    const continuity = Shells.buildingForPlace(world, place.id).interiorContinuity.find((entry) => entry.placeId === place.id);
    assert.ok(continuity);
    if (place.kind === 'residential') assert.ok(place.habitat.rooms.some((room) => room.id === continuity.habitatEntryRoomId));
  });
}

function testNoFacadeChoreOrOptimizationAuthorityExists() {
  const world = newWorld('SHELL-NO-CHORES');
  const metrics = Shells.metrics(world);
  assert.equal(world.settings.facadeMaintenanceObligation, false);
  assert.equal(world.settings.frontageDailyDecay, false);
  assert.equal(world.settings.exteriorOptimizationScore, false);
  assert.equal(metrics.facadeMaintenanceObligation, false);
  assert.equal(metrics.frontageDailyDecay, false);
  assert.equal(metrics.optimizationScore, false);
}

function testPlayerProposalDoesNotInstantlyChangeExterior() {
  const world = newWorld('SHELL-PLAYER-PROPOSAL');
  const place = World.getPlace(world, world.player.homePropertyId);
  const before = Core.deepClone(Shells.frontageForPlace(world, place.id));
  const result = Systems.proposePlayerFrontageChange(world, place.id, 'door_color');
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.proposal.status, 'pending_owner');
  assert.equal(result.proposal.projectId, null);
  assert.deepEqual(Shells.frontageForPlace(world, place.id), before);
}

function testLabeledExperimentPreservesTenantAndCreatesExactRequest() {
  const world = newWorld('SHELL-EXPERIMENT');
  const beforePeople = world.people.map((person) => person.id);
  const result = Systems.prepareBuildingShellExperiment(world);
  assert.equal(result.ok, true, result.reason);
  const property = World.getProperty(world, result.propertyId);
  assert.equal(property.ownerId, 'player');
  assert.ok(property.tenants.includes(result.authorId));
  assert.deepEqual(world.people.map((person) => person.id), beforePeople);
  assert.equal(result.proposal.status, 'awaiting_player');
  assert.equal(result.proposal.change.type, 'window_boxes');
  assert.equal(result.proposal.projectId, null);
  assert.equal(world.flags.shellExperimentPrepared, true);
  assert.equal(Systems.prepareBuildingShellExperiment(world).ok, false);
}

function testDeclineChangesNeitherFrontageNorRelationship() {
  const world = newWorld('SHELL-DECLINE');
  const result = Systems.prepareBuildingShellExperiment(world);
  const proposal = result.proposal;
  const frontageBefore = Core.deepClone(Shells.frontageForPlace(world, proposal.placeId));
  const relationBefore = Core.deepClone(Systems.getRelation(world.player, proposal.authorId));
  const authorMoney = World.getPerson(world, proposal.authorId).money;
  const answer = Systems.respondToFrontageProposal(world, proposal.id, 'decline');
  assert.equal(answer.ok, true, answer.reason);
  assert.equal(proposal.status, 'declined');
  assert.deepEqual(Shells.frontageForPlace(world, proposal.placeId), frontageBefore);
  assert.deepEqual(Systems.getRelation(world.player, proposal.authorId), relationBefore);
  assert.equal(World.getPerson(world, proposal.authorId).money, authorMoney);
}

function testApprovalCreatesProjectButNotInstantFacade() {
  const world = newWorld('SHELL-APPROVAL');
  const result = Systems.prepareBuildingShellExperiment(world);
  const frontageBefore = Core.deepClone(Shells.frontageForPlace(world, result.propertyId));
  const answer = Systems.respondToFrontageProposal(world, result.proposal.id, 'approve');
  assert.equal(answer.ok, true, answer.reason);
  assert.ok(answer.project);
  assert.equal(result.proposal.status, 'project_created');
  assert.deepEqual(Shells.frontageForPlace(world, result.propertyId), frontageBefore);
}

function testPhasedResidentWorkPreservesIdentityAndAppliesExactChange() {
  const world = newWorld('SHELL-PHASES');
  const result = Systems.prepareBuildingShellExperiment(world);
  const personIds = world.people.map((person) => person.id);
  const place = World.getPlace(world, result.propertyId);
  const building = Shells.buildingForPlace(world, place.id);
  const shellId = building.id;
  const answer = Systems.respondToFrontageProposal(world, result.proposal.id, 'approve');
  const project = completeProject(world, answer.project.id);
  assert.equal(project.status, 'completed');
  assert.equal(Shells.frontageForPlace(world, place.id).windowBoxes, true);
  assert.equal(Shells.buildingForPlace(world, place.id).id, shellId);
  assert.deepEqual(world.people.map((person) => person.id), personIds);
  assert.ok(project.completedPhaseIds.includes('confirm_design'));
  assert.ok(project.completedPhaseIds.includes('gather_materials'));
  assert.ok(project.completedPhaseIds.includes('install_and_check'));
}

function testMigrationAddsPresentShellsWithoutInventingFrontageHistory() {
  const world = newWorld('SHELL-MIGRATION');
  world.schema = 'axm.living-city-sim.world/v0.9.0';
  world.version = '0.9.0';
  delete world.buildings;
  delete world.frontageProposals;
  delete world.frontageProjects;
  delete world.shellState;
  delete world.shellRngState;
  delete world.shellIdCounter;
  world.places.forEach((place) => { delete place.shellRef; });
  const migrated = Systems.migrateWorld(world);
  assert.equal(migrated.schema, Core.SCHEMA);
  assert.equal(migrated.frontageProposals.length, 0);
  assert.equal(migrated.frontageProjects.length, 0);
  assert.ok(migrated.buildings.length > 0);
  assert.ok(migrated.buildings.every((building) => building.frontages.every((frontage) => frontage.history.length === 0)));
  assert.ok(migrated.ledger.some((entry) => entry.type === 'migration' && entry.message.includes('building shells')));
}

function testCurrentSaveRoundTripPreservesShellStateExactly() {
  const world = newWorld('SHELL-ROUNDTRIP');
  const result = Systems.prepareBuildingShellExperiment(world);
  Systems.respondToFrontageProposal(world, result.proposal.id, 'approve');
  Systems.advanceFrontageProject(world, result.proposal.projectId);
  const text = Core.serializeWorld(world);
  const imported = Systems.migrateWorld(JSON.parse(text));
  assert.deepEqual(imported.buildings, world.buildings);
  assert.deepEqual(imported.frontageProposals, world.frontageProposals);
  assert.deepEqual(imported.frontageProjects, world.frontageProjects);
}

function testValidationDiagnosesCorruptionWithoutRepairingIt() {
  const world = newWorld('SHELL-CORRUPTION');
  const opening = world.buildings[0].storeys[0].openings[0];
  opening.wallEdgeId = 'missing_edge';
  const before = JSON.stringify(world);
  const validation = Systems.validateWorld(world);
  const after = JSON.stringify(world);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((message) => message.includes('unknown wall edge')));
  assert.equal(after, before, 'validation must diagnose rather than normalize shell corruption');
}

function testCompletedFrontageSurvivesOrdinaryTimeWithoutDailyDecay() {
  const world = newWorld('SHELL-NO-DECAY');
  const result = Systems.prepareBuildingShellExperiment(world);
  const answer = Systems.respondToFrontageProposal(world, result.proposal.id, 'approve');
  completeProject(world, answer.project.id);
  const before = Core.deepClone(Shells.frontageForPlace(world, result.propertyId));
  Systems.advanceHours(world, 24 * 60, { freezePlayer: true });
  const after = Shells.frontageForPlace(world, result.propertyId);
  assert.equal(after.windowBoxes, before.windowBoxes);
  assert.equal(after.revision, before.revision);
}

function testShellAutonomyIsDeterministic() {
  const a = newWorld('SHELL-AUTONOMY');
  const b = newWorld('SHELL-AUTONOMY');
  Systems.advanceHours(a, 24 * 120, { freezePlayer: true });
  Systems.advanceHours(b, 24 * 120, { freezePlayer: true });
  assert.deepEqual(a.frontageProposals, b.frontageProposals);
  assert.deepEqual(a.frontageProjects, b.frontageProjects);
  assert.deepEqual(a.buildings, b.buildings);
  assert.equal(a.shellRngState, b.shellRngState);
}

function testPublicWorkAndCommercialPlacesAlsoHaveShellIdentity() {
  const world = newWorld('SHELL-PLACE-TYPES');
  const samples = [
    world.places.find((place) => place.kind === 'public'),
    world.places.find((place) => place.kind === 'commercial'),
    world.places.find((place) => place.kind === 'residential')
  ];
  samples.forEach((place) => {
    assert.ok(place);
    const building = Shells.buildingForPlace(world, place.id);
    assert.ok(building);
    assert.ok(building.storeys.length >= 1);
    assert.ok(building.frontages.some((frontage) => frontage.placeId === place.id));
  });
}

function testFullWorldValidationPasses() {
  const world = newWorld('SHELL-FULL-VALIDATION');
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

const tests = [
  testDeterministicShellGeneration,
  testEveryPlaceBelongsToExactlyOneShell,
  testTwoStoreyApartmentHasRealVerticalRoute,
  testAllShellWallGraphsAndOpeningsAreGrounded,
  testEveryPlaceRoutesFromStreetToCurrentInteriorEntry,
  testNoFacadeChoreOrOptimizationAuthorityExists,
  testPlayerProposalDoesNotInstantlyChangeExterior,
  testLabeledExperimentPreservesTenantAndCreatesExactRequest,
  testDeclineChangesNeitherFrontageNorRelationship,
  testApprovalCreatesProjectButNotInstantFacade,
  testPhasedResidentWorkPreservesIdentityAndAppliesExactChange,
  testMigrationAddsPresentShellsWithoutInventingFrontageHistory,
  testCurrentSaveRoundTripPreservesShellStateExactly,
  testValidationDiagnosesCorruptionWithoutRepairingIt,
  testCompletedFrontageSurvivesOrdinaryTimeWithoutDailyDecay,
  testShellAutonomyIsDeterministic,
  testPublicWorkAndCommercialPlacesAlsoHaveShellIdentity,
  testFullWorldValidationPasses
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
console.log(`\n${passed}/${tests.length} building-shell tests passed.`);
