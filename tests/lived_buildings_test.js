'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Habitats, Shells, Presence } = globalThis.AXM;

function newWorld(seed = 'AXM-LIVED-BUILDINGS-TEST') {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  return world;
}

function snapshotPlayer(world) {
  return Core.deepClone({
    time: world.time,
    money: world.player.money,
    needs: world.player.needs,
    relationships: world.player.relationships,
    age: world.player.age,
    lifeCourse: world.player.lifeCourse,
    homePropertyId: world.player.homePropertyId
  });
}

function finishVisibleIndoor(world) {
  let guard = 0;
  while (world.activeIndoorMovement && guard < 100) {
    const result = Systems.stepIndoorMovement(world);
    assert.equal(result.ok, true, result.reason);
    guard += 1;
  }
  assert.ok(guard < 100, 'Visible indoor route did not finish in a bounded number of steps.');
}

function findOccupiedOtherHome(world) {
  return world.places.find((place) => place.kind === 'residential'
    && place.id !== world.player.homePropertyId
    && (place.tenants || []).length > 0);
}

function placePlayerAtThreshold(world, placeId) {
  world.player.locationId = placeId;
  Presence.arriveFromStreetTravel(world, placeId, { mode: 'bundled', travelRecordId: 'test_route' });
}

function testInitialPresenceFoundation() {
  const world = newWorld('PRESENCE-INITIAL');
  assert.equal(Object.keys(world.presenceByPerson).length, world.people.length + 1);
  assert.equal(world.metrics.presenceSnapshotsInitialized, world.people.length + 1);
  assert.equal(world.settings.presenceCompressionAllowed, true);
  assert.equal(world.settings.compulsoryGreetings, false);
  assert.equal(world.settings.presenceWatchingReward, false);
  assert.equal(world.settings.presenceSurveillance, false);
  assert.equal(world.settings.minuteByMinutePresenceTax, false);
  assert.equal(Systems.validateWorld(world).ok, true);
}

function testStreetThresholdNeverInventsEntry() {
  const world = newWorld('PRESENCE-THRESHOLD');
  const property = findOccupiedOtherHome(world);
  assert.ok(property);
  placePlayerAtThreshold(world, property.id);
  const presence = Presence.presenceFor(world, 'player');
  assert.equal(presence.kind, 'street_threshold');
  assert.equal(presence.roomId, null);
  const access = Presence.accessFor(world, 'player', property.id);
  assert.equal(access.ok, false);
  const result = Systems.startIndoorArrival(world, property.id, 'compressed');
  assert.equal(result.ok, false);
  assert.match(result.reason, /does not create permission/i);
}

function testResidentCanLeaveAndReenterOwnHome() {
  const world = newWorld('PRESENCE-RESIDENT');
  const homeId = world.player.homePropertyId;
  const departure = Systems.startIndoorDeparture(world, 'compressed');
  assert.equal(departure.ok, true, departure.reason);
  assert.equal(Presence.presenceFor(world, 'player').kind, 'street_threshold');
  const arrival = Systems.startIndoorArrival(world, homeId, 'compressed');
  assert.equal(arrival.ok, true, arrival.reason);
  assert.equal(Presence.presenceFor(world, 'player').kind, 'room');
  assert.equal(Presence.presenceFor(world, 'player').accessBasis, 'resident');
}

function testOccupiedPropertyOwnershipDoesNotGrantEntry() {
  const world = newWorld('PRESENCE-OWNER-BOUNDARY');
  const property = findOccupiedOtherHome(world);
  property.ownerId = 'player';
  placePlayerAtThreshold(world, property.id);
  const access = Presence.accessFor(world, 'player', property.id);
  assert.equal(access.ok, false);
  assert.equal(access.basis, 'threshold_only');
  assert.equal(access.authority.ownership, false);
}

function testBoundedGrantAllowsSharedEntryWithoutAuthority() {
  const world = newWorld('PRESENCE-GRANT');
  const property = findOccupiedOtherHome(world);
  const hostId = property.tenants[0];
  const grantResult = Presence.createAccessGrant(world, hostId, 'player', property.id, { days: 2, purpose: 'test_visit' });
  assert.equal(grantResult.ok, true, grantResult.reason);
  assert.deepEqual(grantResult.grant.authority, {
    tenancy: false, ownership: false, edit: false, storage: false, household: false, care: false, surveillance: false
  });
  placePlayerAtThreshold(world, property.id);
  const access = Presence.accessFor(world, 'player', property.id);
  assert.equal(access.ok, true);
  assert.equal(access.basis, 'accepted_presence_grant');
  const arrival = Systems.startIndoorArrival(world, property.id, 'compressed');
  assert.equal(arrival.ok, true, arrival.reason);
  assert.equal(Presence.presenceFor(world, 'player').kind, 'room');
}

function testVisitorCannotEnterPrivatePurposeRoom() {
  const world = newWorld('PRESENCE-PRIVATE-ROOM');
  const property = findOccupiedOtherHome(world);
  const hostId = property.tenants[0];
  const result = Presence.createAccessGrant(world, hostId, 'player', property.id, { purpose: 'test_visit' });
  assert.equal(result.ok, true);
  const privateRoom = property.habitat.rooms.find((room) => ['sleep', 'bathroom', 'storage', 'work'].includes(room.purpose));
  assert.ok(privateRoom, 'Expected a non-shared room purpose.');
  const access = Presence.roomAccessFor(world, 'player', property, privateRoom.id, Presence.accessFor(world, 'player', property.id));
  assert.equal(access.ok, false);
  assert.match(access.reason, /shared visit space/i);
}

function testUpperWalkupRouteUsesRealStairs() {
  const world = newWorld('PRESENCE-STAIRS');
  const experiment = Systems.prepareLivedBuildingExperiment(world);
  assert.equal(experiment.ok, true, experiment.reason);
  const result = Systems.startIndoorArrival(world, experiment.propertyId, 'visible');
  assert.equal(result.ok, true, result.reason);
  assert.ok(result.movement.route.steps.some((step) => step.kind === 'stairs'));
  assert.ok(result.movement.route.steps.some((step) => step.kind === 'unit_entry'));
  assert.ok(result.movement.route.steps.some((step) => step.kind === 'room_entry'));
}

function testVisibleAndCompressedArrivalParity() {
  const visibleWorld = newWorld('PRESENCE-PARITY');
  const compressedWorld = newWorld('PRESENCE-PARITY');
  const a = Systems.prepareLivedBuildingExperiment(visibleWorld);
  const b = Systems.prepareLivedBuildingExperiment(compressedWorld);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  const visibleStart = Systems.startIndoorArrival(visibleWorld, a.propertyId, 'visible');
  const compressed = Systems.startIndoorArrival(compressedWorld, b.propertyId, 'compressed');
  assert.equal(visibleStart.ok, true);
  assert.equal(compressed.ok, true);
  finishVisibleIndoor(visibleWorld);
  const visibleMovement = visibleStart.movement;
  const compressedMovement = compressed.movement;
  assert.equal(visibleMovement.elapsedMinutes, compressedMovement.elapsedMinutes);
  assert.equal(visibleMovement.route.stairSteps, compressedMovement.route.stairSteps);
  assert.deepEqual(visibleWorld.time, compressedWorld.time);
  assert.deepEqual(visibleWorld.player.needs, compressedWorld.player.needs);
  assert.equal(Presence.presenceFor(visibleWorld, 'player').roomId, Presence.presenceFor(compressedWorld, 'player').roomId);
  assert.equal(visibleWorld.player.age, compressedWorld.player.age);
  assert.equal(visibleWorld.player.lifeCourse.stage, compressedWorld.player.lifeCourse.stage);
}

function testPartialVisibleThenCompressionPreservesRouteCost() {
  const world = newWorld('PRESENCE-PARTIAL');
  const experiment = Systems.prepareLivedBuildingExperiment(world);
  const started = Systems.startIndoorArrival(world, experiment.propertyId, 'visible');
  assert.equal(started.ok, true);
  const first = Systems.stepIndoorMovement(world);
  assert.equal(first.ok, true);
  const finished = Systems.finishIndoorMovementCompressed(world);
  assert.equal(finished.ok, true, finished.reason);
  assert.equal(finished.movement.elapsedMinutes, finished.movement.route.totalMinutes);
  assert.equal(finished.movement.currentStepIndex, finished.movement.route.steps.length);
  assert.equal(finished.movement.status, 'completed');
}

function testCompressedJourneyIncludesLawfulDeparture() {
  const world = newWorld('PRESENCE-JOURNEY-COMPRESSED');
  const destinationId = 'place_market';
  const result = Systems.startPlayerJourney(world, destinationId, 'compressed');
  assert.equal(result.ok, true, result.reason || result.travel?.reason);
  assert.equal(result.departure.kind, 'departure');
  assert.equal(result.departure.status, 'completed');
  assert.equal(world.player.locationId, destinationId);
  assert.equal(Presence.presenceFor(world, 'player').kind, 'street_threshold');
  assert.equal(Presence.presenceFor(world, 'player').placeId, destinationId);
}

function testVisibleJourneyQueuesStreetRouteAfterDeparture() {
  const world = newWorld('PRESENCE-JOURNEY-VISIBLE');
  const result = Systems.startPlayerJourney(world, 'place_market', 'visible');
  assert.equal(result.ok, true, result.reason);
  assert.ok(world.activeIndoorMovement);
  assert.equal(world.activeTravel, null);
  assert.equal(world.presenceState.pendingStreetJourney.destinationPlaceId, 'place_market');
  finishVisibleIndoor(world);
  assert.ok(world.activeTravel, 'Street travel should begin only after indoor departure completes.');
  assert.equal(world.presenceState.pendingStreetJourney, null);
}

function testRoomMovementVisibleAndCompressedUseSameGraph() {
  const visibleWorld = newWorld('PRESENCE-ROOM-PARITY');
  const compressedWorld = newWorld('PRESENCE-ROOM-PARITY');
  const homeA = World.getProperty(visibleWorld, visibleWorld.player.homePropertyId);
  const currentA = Presence.presenceFor(visibleWorld, 'player');
  const targetA = Presence.accessibleRooms(visibleWorld, 'player', homeA.id).find((room) => room.id !== currentA.roomId);
  assert.ok(targetA);
  const homeB = World.getProperty(compressedWorld, compressedWorld.player.homePropertyId);
  const targetB = homeB.habitat.rooms.find((room) => room.id === targetA.id);
  const visible = Systems.startRoomTransition(visibleWorld, targetA.id, 'visible');
  const compressed = Systems.startRoomTransition(compressedWorld, targetB.id, 'compressed');
  assert.equal(visible.ok, true, visible.reason);
  assert.equal(compressed.ok, true, compressed.reason);
  finishVisibleIndoor(visibleWorld);
  assert.equal(visible.movement.elapsedMinutes, compressed.movement.elapsedMinutes);
  assert.deepEqual(visibleWorld.time, compressedWorld.time);
  assert.equal(Presence.presenceFor(visibleWorld, 'player').roomId, targetA.id);
  assert.equal(Presence.presenceFor(compressedWorld, 'player').roomId, targetB.id);
}

function testNpcPrivatePresenceIsCoarse() {
  const world = newWorld('PRESENCE-COARSE');
  world.people.forEach((person) => Presence.reconcileNpcPresence(world, person, null, { source: 'test' }));
  const privatePresences = world.people.map((person) => Presence.presenceFor(world, person.id))
    .filter((entry) => entry?.kind === 'private_interior_coarse');
  assert.ok(privatePresences.length > 0);
  privatePresences.forEach((entry) => {
    assert.equal(entry.roomId, null);
    assert.equal(entry.observableScope, 'private_coarse');
  });
}

function testVisibilityRequiresLawfulCoPresence() {
  const world = newWorld('PRESENCE-VISIBILITY');
  const home = World.getProperty(world, world.player.homePropertyId);
  const person = world.people[0];
  if (!(home.tenants || []).includes(person.id)) home.tenants.push(person.id);
  person.homePropertyId = home.id;
  person.locationId = home.id;
  Presence.reconcileNpcPresence(world, person, null, { source: 'test' });
  let visible = Presence.visiblePresencesForPlayer(world).find((entry) => entry.person.id === person.id);
  assert.ok(visible);
  assert.equal(visible.disclosure, 'private_coarse');
  assert.equal(visible.presence.roomId, null);
  const publicPlace = World.getPlace(world, 'place_market');
  const publicBuilding = Shells.buildingForPlace(world, publicPlace.id);
  Presence.setPresence(world, 'player', {
    kind: 'public_interior', placeId: publicPlace.id, buildingId: publicBuilding?.id || null, storeyId: null,
    level: 0, routeNodeId: publicPlace.shellRef?.unitRouteNodeId || null, roomId: null,
    activity: 'inside the market', accessBasis: 'public_or_scheduled_place', privacy: 'public', observableScope: 'self', source: 'test'
  });
  Presence.setPresence(world, person.id, {
    kind: 'public_interior', placeId: publicPlace.id, buildingId: publicBuilding?.id || null, storeyId: null,
    level: 0, routeNodeId: publicPlace.shellRef?.unitRouteNodeId || null, roomId: null,
    activity: 'inside the market', accessBasis: 'public_or_scheduled_place', privacy: 'public', observableScope: 'co_present', source: 'test'
  });
  visible = Presence.visiblePresencesForPlayer(world).find((entry) => entry.person.id === person.id);
  assert.equal(visible.disclosure, 'co_present');
}

function createCoPresentEncounter(world) {
  const person = world.people.find((entry) => !globalThis.AXM.Family.isDependent(entry));
  const publicPlace = World.getPlace(world, 'place_market');
  const building = Shells.buildingForPlace(world, publicPlace.id);
  const shared = {
    kind: 'public_interior', placeId: publicPlace.id, buildingId: building?.id || null, storeyId: null,
    level: 0, routeNodeId: publicPlace.shellRef?.unitRouteNodeId || null, roomId: null,
    activity: 'briefly nearby', accessBasis: 'public_or_scheduled_place', privacy: 'public', source: 'test'
  };
  Presence.setPresence(world, 'player', { ...shared, observableScope: 'self' });
  Presence.setPresence(world, person.id, { ...shared, observableScope: 'co_present' });
  const encounter = Presence.offerEncounter(world, person.id, { cause: 'focused refusal test', kindId: 'same_room_moment' });
  assert.ok(encounter);
  return { encounter, person };
}

function testDeclineIsTrulySideEffectFree() {
  const world = newWorld('PRESENCE-DECLINE');
  const { encounter, person } = createCoPresentEncounter(world);
  delete world.player.relationships[person.id];
  const before = snapshotPlayer(world);
  const hadRelation = Object.prototype.hasOwnProperty.call(world.player.relationships, person.id);
  const result = Systems.respondToOrdinaryEncounter(world, encounter.id, 'decline');
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.encounter.status, 'declined');
  assert.deepEqual(snapshotPlayer(world), before);
  assert.equal(Object.prototype.hasOwnProperty.call(world.player.relationships, person.id), hadRelation);
}

function testQuietAcknowledgmentIsSideEffectFree() {
  const world = newWorld('PRESENCE-QUIET');
  const { encounter } = createCoPresentEncounter(world);
  const before = snapshotPlayer(world);
  const result = Systems.respondToOrdinaryEncounter(world, encounter.id, 'quiet');
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.encounter.status, 'quietly_acknowledged');
  assert.deepEqual(snapshotPlayer(world), before);
}

function testGreetingRequiresExplicitFiveMinutes() {
  const world = newWorld('PRESENCE-GREET');
  const { encounter, person } = createCoPresentEncounter(world);
  const beforeMinutes = Presence.absoluteMinutes(world.time);
  const beforeRelation = Core.deepClone(world.player.relationships[person.id] || null);
  const beforeAge = world.player.age;
  const beforeStage = world.player.lifeCourse.stage;
  const result = Systems.respondToOrdinaryEncounter(world, encounter.id, 'greet');
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.encounter.status, 'greeted');
  assert.equal(Presence.absoluteMinutes(world.time) - beforeMinutes, 5);
  const relation = world.player.relationships[person.id];
  assert.ok(relation);
  assert.ok((relation.friendship || 0) > (beforeRelation?.friendship || 0));
  assert.equal(world.player.age, beforeAge);
  assert.equal(world.player.lifeCourse.stage, beforeStage);
  assert.ok(Object.values(result.encounter.authority).every((value) => value === false));
}

function testEncounterCanPassWithoutPenalty() {
  const world = newWorld('PRESENCE-PASS');
  const { encounter } = createCoPresentEncounter(world);
  const before = snapshotPlayer(world);
  Systems.advanceHours(world, 7, { freezePlayer: true });
  assert.equal(encounter.status, 'passed');
  assert.deepEqual(snapshotPlayer(world).money, before.money);
  assert.deepEqual(snapshotPlayer(world).relationships, before.relationships);
  assert.equal(world.settings.socialChecklist, false);
}

function testMigrationCreatesPresentSnapshotWithoutInventedHistory() {
  const current = newWorld('PRESENCE-MIGRATION');
  const legacy = Core.deepClone(current);
  legacy.schema = 'axm.living-city-sim.world/v0.10.0';
  legacy.version = '0.10.0';
  delete legacy.presenceState;
  delete legacy.presenceByPerson;
  delete legacy.presenceRecords;
  delete legacy.ordinaryEncounters;
  delete legacy.presenceAccessGrants;
  delete legacy.activeIndoorMovement;
  delete legacy.presenceIdCounter;
  const migrated = Systems.migrateWorld(legacy);
  assert.equal(migrated.schema, Core.SCHEMA);
  assert.equal(Object.keys(migrated.presenceByPerson).length, migrated.people.length + 1);
  assert.deepEqual(migrated.presenceRecords, []);
  assert.deepEqual(migrated.ordinaryEncounters, []);
  assert.deepEqual(migrated.presenceAccessGrants, []);
  assert.equal(Systems.validateWorld(migrated).ok, true);
}

function testRoundTripAndCorruptionRejection() {
  const world = newWorld('PRESENCE-ROUNDTRIP');
  const experiment = Systems.prepareLivedBuildingExperiment(world);
  assert.equal(experiment.ok, true);
  const arrival = Systems.startIndoorArrival(world, experiment.propertyId, 'compressed');
  assert.equal(arrival.ok, true);
  const serialized = Core.serializeWorld(world);
  const roundTripped = Systems.migrateWorld(Core.parseWorld(serialized));
  assert.equal(Core.serializeWorld(roundTripped), serialized);
  assert.equal(Systems.validateWorld(roundTripped).ok, true);
  const npc = roundTripped.people.find((person) => Presence.presenceFor(roundTripped, person.id)?.kind === 'private_interior_coarse');
  assert.ok(npc);
  Presence.presenceFor(roundTripped, npc.id).roomId = World.getProperty(roundTripped, npc.homePropertyId).habitat.rooms[0].id;
  const invalid = Systems.validateWorld(roundTripped);
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => /private room ID/i.test(error)));
}

const tests = [
  testInitialPresenceFoundation,
  testStreetThresholdNeverInventsEntry,
  testResidentCanLeaveAndReenterOwnHome,
  testOccupiedPropertyOwnershipDoesNotGrantEntry,
  testBoundedGrantAllowsSharedEntryWithoutAuthority,
  testVisitorCannotEnterPrivatePurposeRoom,
  testUpperWalkupRouteUsesRealStairs,
  testVisibleAndCompressedArrivalParity,
  testPartialVisibleThenCompressionPreservesRouteCost,
  testCompressedJourneyIncludesLawfulDeparture,
  testVisibleJourneyQueuesStreetRouteAfterDeparture,
  testRoomMovementVisibleAndCompressedUseSameGraph,
  testNpcPrivatePresenceIsCoarse,
  testVisibilityRequiresLawfulCoPresence,
  testDeclineIsTrulySideEffectFree,
  testQuietAcknowledgmentIsSideEffectFree,
  testGreetingRequiresExplicitFiveMinutes,
  testEncounterCanPassWithoutPenalty,
  testMigrationCreatesPresentSnapshotWithoutInventedHistory,
  testRoundTripAndCorruptionRejection
];

let passed = 0;
for (const test of tests) {
  test();
  passed += 1;
  console.log(`PASS ${test.name}`);
}
console.log(`\n${passed}/${tests.length} lived-building presence tests passed.`);
