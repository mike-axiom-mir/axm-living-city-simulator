'use strict';

const assert = require('assert');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Exteriors, Content } = globalThis.AXM;

function newWorld(seed = 'AXM-WALKABLE-TEST') {
  const world = World.createWorld(seed);
  Exteriors.initializeWorld(world, { silent: true });
  return world;
}

function playerSnapshot(world) {
  return {
    time: Core.deepClone(world.time),
    locationId: world.player.locationId,
    money: world.player.money,
    needs: Core.deepClone(world.player.needs),
    age: world.player.age,
    lifeStage: world.player.lifeCourse?.stage,
    ageDays: world.player.lifeCourse?.ageDays
  };
}

function startStreetJourney(world, destinationPlaceId, mode = 'visible') {
  const result = Systems.startPlayerTravel(world, destinationPlaceId, mode);
  if (!result.ok) return result;
  // v0.11 lawfully leaves the current building before the inherited street route starts.
  if (mode === 'visible' && world.activeIndoorMovement) {
    const departure = Systems.finishIndoorMovementCompressed(world);
    if (!departure.ok) return departure;
  }
  const record = result.record
    || result.travel?.record
    || Exteriors.recordById(world, world.activeTravel?.recordId);
  return { ...result, record };
}

function finishVisibleRoute(world) {
  let guard = 0;
  while (world.activeTravel && guard < 200) {
    const result = Systems.stepPlayerTravel(world);
    assert.equal(result.ok, true, result.reason);
    guard += 1;
  }
  assert.ok(guard < 200, 'Visible route did not finish in a bounded number of segments.');
}

function testDeterministicExteriorIdentityAndNetwork() {
  const a = newWorld('WALKABLE-DETERMINISTIC');
  const b = newWorld('WALKABLE-DETERMINISTIC');
  assert.deepEqual(
    a.places.map((place) => place.exterior),
    b.places.map((place) => place.exterior)
  );
  assert.deepEqual(a.streetNetwork, b.streetNetwork);
  assert.equal(a.streetNetwork.schema, Exteriors.NETWORK_SCHEMA);
  assert.ok(a.streetNetwork.nodes.length > a.places.length);
  assert.ok(a.streetNetwork.edges.length >= a.streetNetwork.nodes.length - 1);
}

function testEveryPlaceHasUniqueGroundedExteriorIdentity() {
  const world = newWorld('WALKABLE-EXTERIORS');
  const addresses = new Set();
  for (const place of world.places) {
    assert.equal(place.exterior.schema, Exteriors.EXTERIOR_SCHEMA);
    assert.equal(place.exterior.placeId, place.id);
    assert.ok(place.exterior.address.label);
    assert.equal(addresses.has(place.exterior.address.label), false, `Duplicate address: ${place.exterior.address.label}`);
    addresses.add(place.exterior.address.label);
    assert.ok(place.exterior.facade.material);
    assert.ok(place.exterior.facade.windowCount >= 1);
    assert.ok(place.exterior.entrance.doorNodeId);
    assert.ok(place.exterior.entrance.accessNodeId);
    assert.equal(place.exterior.source.kind, 'deterministic_map_derivation');
  }
  assert.equal(addresses.size, world.places.length);
}

function testAllPlacesAreWalkablyConnected() {
  const world = newWorld('WALKABLE-CONNECTIVITY');
  const origin = world.player.locationId;
  for (const place of world.places) {
    if (place.id === origin) continue;
    const route = Exteriors.routeBetween(world, origin, place.id);
    assert.ok(route, `No route to ${place.id}`);
    assert.equal(route.originPlaceId, origin);
    assert.equal(route.destinationPlaceId, place.id);
    assert.ok(route.nodeIds.length >= 2);
    assert.equal(route.edgeIds.length, route.nodeIds.length - 1);
    assert.ok(route.distanceMeters > 0);
    assert.ok(route.durationMinutes > 0);
  }
}

function testVisibleAndCompressedTravelHaveEqualCost() {
  const compressed = newWorld('WALKABLE-PARITY');
  const visible = newWorld('WALKABLE-PARITY');
  const destinationId = 'place_market';
  const preview = Exteriors.routeBetween(compressed, compressed.player.locationId, destinationId);
  assert.ok(preview);

  const compressedResult = startStreetJourney(compressed, destinationId, 'compressed');
  assert.equal(compressedResult.ok, true, compressedResult.reason);

  const visibleStart = startStreetJourney(visible, destinationId, 'visible');
  assert.equal(visibleStart.ok, true, visibleStart.reason);
  finishVisibleRoute(visible);

  const a = playerSnapshot(compressed);
  const b = playerSnapshot(visible);
  assert.deepEqual(a, b);
  assert.equal(compressedResult.record.route.durationMinutes, preview.durationMinutes);
  const visibleRecord = visible.travelRecords.find((entry) => entry.actorId === 'player' && entry.mode === 'visible');
  assert.equal(visibleRecord.elapsedMinutes, compressedResult.record.elapsedMinutes);
  assert.equal(visibleRecord.route.distanceMeters, compressedResult.record.route.distanceMeters);
  assert.ok(visibleRecord.observations.length > 0);
}

function testVisibleTravelCanBeCompressedMidRouteWithoutPenalty() {
  const world = newWorld('WALKABLE-MID-COMPRESS');
  const start = startStreetJourney(world, 'place_school', 'visible');
  assert.equal(start.ok, true, start.reason);
  const first = Systems.stepPlayerTravel(world);
  assert.equal(first.ok, true, first.reason);
  const elapsed = start.record.elapsedMinutes;
  assert.ok(elapsed > 0);
  const finish = Systems.finishPlayerTravelCompressed(world);
  assert.equal(finish.ok, true, finish.reason);
  assert.equal(world.activeTravel, null);
  assert.equal(world.player.locationId, 'place_school');
  assert.equal(finish.record.status, 'completed');
  assert.equal(finish.record.elapsedMinutes, finish.record.route.durationMinutes);
  assert.ok(finish.record.history.some((entry) => entry.type === 'remaining_route_compressed'));
  assert.equal(world.settings.walkingObligation, false);
}

function testVisibleRouteCanEndEarlyAtARealEndpoint() {
  const world = newWorld('WALKABLE-END-EARLY');
  const origin = world.player.locationId;
  const start = startStreetJourney(world, 'place_river_workroom', 'visible');
  assert.equal(start.ok, true, start.reason);
  assert.equal(Systems.stepPlayerTravel(world).ok, true);
  const result = Systems.endPlayerTravelEarly(world);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.record.status, 'ended_early');
  assert.ok([origin, 'place_river_workroom'].includes(world.player.locationId));
  assert.equal(world.activeTravel, null);
  assert.ok(result.record.history.some((entry) => entry.type === 'ended_early'));
  const ledger = world.ledger.slice().reverse().find((entry) => entry.evidence?.routeId === result.record.id && /without a failure label/i.test(entry.message));
  assert.ok(ledger);
  assert.match(ledger.message, /without a failure label/i);
}

function testStreetMomentsAreObservationsNotRewardsOrPunishments() {
  const world = newWorld('WALKABLE-MOMENTS');
  const start = startStreetJourney(world, 'place_market', 'visible');
  assert.equal(start.ok, true, start.reason);
  const result = Systems.stepPlayerTravel(world);
  assert.equal(result.ok, true, result.reason);
  assert.ok(result.observation);
  assert.equal(result.observation.schema, Exteriors.STREET_MOMENT_SCHEMA);
  assert.equal(result.observation.consequence, 'observation_only');
  assert.ok(result.observation.text.length > 12);
  assert.equal(Object.prototype.hasOwnProperty.call(result.observation, 'reward'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.observation, 'penalty'), false);
}

function testMinuteLevelClockCrossesHoursAndDaysCorrectly() {
  const world = newWorld('WALKABLE-MINUTES');
  world.time = { day: 2, hour: 23, minute: 50 };
  Systems.advanceMinutes(world, 85, { freezePlayer: true });
  assert.deepEqual(world.time, { day: 3, hour: 1, minute: 15 });
  assert.equal(Systems.validateWorld(world).ok, true, Systems.validateWorld(world).errors.join('\n'));
}

function testAutonomousResidentsLeaveRouteEvidence() {
  const world = newWorld('WALKABLE-NPC-ROUTES');
  Systems.advanceHours(world, 10, { freezePlayer: true });
  const routes = world.travelRecords.filter((entry) => entry.mode === 'schedule');
  assert.ok(routes.length > 0, 'Expected autonomous schedule routes.');
  for (const route of routes.slice(0, 30)) {
    assert.ok(World.getPerson(world, route.actorId));
    assert.ok(World.getPlace(world, route.originPlaceId));
    assert.ok(World.getPlace(world, route.destinationPlaceId));
    assert.equal(route.status, 'completed');
    assert.ok(route.route.distanceMeters > 0);
    assert.equal(route.timeAccounting, 'hourly_schedule_resolution');
  }
}

function testOrdinaryActionsKeepBundledRouteProvenance() {
  const world = newWorld('WALKABLE-BUNDLED');
  const before = world.travelRecords.length;
  const activity = Content.activityById('eat_out');
  assert.ok(activity, 'Expected the café activity.');
  const result = Systems.performActivity(world, activity.id);
  assert.equal(result.ok, true, result.reason);
  const records = world.travelRecords.slice(before).filter((entry) => entry.actorId === 'player' && entry.mode === 'bundled');
  assert.ok(records.length >= 1, 'Expected bundled route provenance for an ordinary activity.');
  assert.ok(records.every((entry) => entry.timeAccounting === 'inside_existing_action_budget'));
}

function testTravelDoesNotCreateAgePressureOrAWalkingStreak() {
  const world = newWorld('WALKABLE-NO-PRESSURE');
  const before = playerSnapshot(world);
  for (const destination of ['place_market', 'place_park', 'home_student']) {
    if (world.player.locationId === destination) continue;
    const result = startStreetJourney(world, destination, 'compressed');
    assert.equal(result.ok, true, result.reason);
  }
  assert.equal(world.settings.lifeCourseMode, 'choice');
  assert.equal(world.settings.agePressure, false);
  assert.equal(world.settings.walkingObligation, false);
  assert.equal(world.settings.travelCompressionAllowed, true);
  assert.equal(world.player.age, before.age);
  assert.equal(world.player.lifeCourse.ageDays, before.ageDays);
  assert.equal(world.player.lifeCourse.stage, before.lifeStage);
  assert.equal(Object.prototype.hasOwnProperty.call(world.metrics, 'walkingStreak'), false);
}

function testRouteAuthorityDoesNotGrantPlaceAuthority() {
  const world = newWorld('WALKABLE-AUTHORITY');
  const occupied = world.places.find((place) => place.kind === 'residential' && !place.tenants.includes('player') && place.tenants.length > 0);
  assert.ok(occupied);
  const before = {
    tenants: occupied.tenants.slice(),
    ownerId: occupied.ownerId,
    furniture: occupied.furniture.map((entry) => entry.id)
  };
  const result = startStreetJourney(world, occupied.id, 'compressed');
  assert.equal(result.ok, true, result.reason);
  assert.equal(world.player.locationId, occupied.id);
  assert.deepEqual(occupied.tenants, before.tenants);
  assert.equal(occupied.ownerId, before.ownerId);
  assert.deepEqual(occupied.furniture.map((entry) => entry.id), before.furniture);
  assert.equal(occupied.tenants.includes('player'), false);
}

function testV08MigrationDerivesPresentNetworkButNoPastTravel() {
  const current = newWorld('WALKABLE-MIGRATION');
  const legacy = Core.deepClone(current);
  legacy.schema = 'axm.living-city-sim.world/v0.8.0';
  legacy.version = '0.8.0';
  legacy.time = { day: legacy.time.day, hour: legacy.time.hour };
  delete legacy.streetNetwork;
  delete legacy.travelRecords;
  delete legacy.streetMoments;
  delete legacy.exteriorState;
  delete legacy.activeTravel;
  delete legacy.exteriorIdCounter;
  delete legacy.settings.defaultTravelMode;
  delete legacy.settings.travelCompressionAllowed;
  delete legacy.settings.walkingObligation;
  legacy.places.forEach((place) => delete place.exterior);
  const migrated = Systems.migrateWorld(legacy);
  assert.equal(migrated.schema, Core.SCHEMA);
  assert.equal(migrated.version, Core.VERSION);
  assert.equal(migrated.travelRecords.length, 0);
  assert.equal(migrated.streetMoments.length, 0);
  assert.ok(migrated.streetNetwork.nodes.length > 0);
  assert.ok(migrated.places.every((place) => place.exterior?.schema === Exteriors.EXTERIOR_SCHEMA));
  assert.ok(migrated.ledger.some((entry) => entry.type === 'migration' && /no past journey/i.test(entry.message)));
  const validation = Systems.validateWorld(migrated);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testValidationRejectsCorruptionWithoutSilentRepair() {
  const world = newWorld('WALKABLE-CORRUPTION');
  const target = world.places[0];
  const originalAddress = target.exterior.address.label;
  world.settings.walkingObligation = true;
  target.exterior.address.label = world.places[1].exterior.address.label;
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((entry) => /walking cannot become an obligation/i.test(entry)));
  assert.ok(validation.errors.some((entry) => /duplicated/i.test(entry)));
  assert.equal(world.settings.walkingObligation, true);
  assert.notEqual(target.exterior.address.label, originalAddress);
}

function testCurrentSaveRoundTripPreservesRouteAndExteriorEvidence() {
  const world = newWorld('WALKABLE-ROUNDTRIP');
  assert.equal(startStreetJourney(world, 'place_market', 'visible').ok, true);
  assert.equal(Systems.stepPlayerTravel(world).ok, true);
  assert.equal(Systems.finishPlayerTravelCompressed(world).ok, true);
  const serialized = Core.serializeWorld(world);
  const imported = Systems.migrateWorld(Core.parseWorld(serialized));
  assert.equal(Core.serializeWorld(imported), serialized);
  assert.equal(imported.travelRecords.length, world.travelRecords.length);
  assert.equal(imported.streetMoments.length, world.streetMoments.length);
  assert.equal(imported.exteriorState.networkHash, world.exteriorState.networkHash);
}

function testLabeledWalkableExperimentUsesRealRouteAndIsSingleUse() {
  const world = newWorld('WALKABLE-EXPERIMENT');
  const result = Systems.prepareWalkableExperiment(world);
  assert.equal(result.ok, true, result.reason);
  assert.ok(world.activeTravel);
  const record = Exteriors.recordById(world, result.recordId);
  assert.ok(record);
  assert.equal(record.mode, 'visible');
  assert.ok(record.elapsedMinutes > 0);
  assert.equal(world.metrics.walkableExperimentRuns, 1);
  const again = Systems.prepareWalkableExperiment(world);
  assert.equal(again.ok, false);
  assert.match(again.reason, /already prepared/i);
}

function testLongEvolutionRetainsWalkableInvariants() {
  const world = newWorld('WALKABLE-LONG');
  for (let day = 0; day < 90; day += 1) {
    Systems.advanceHours(world, 24, { freezePlayer: true });
    if (day % 15 === 0) {
      const destination = day % 30 === 0 ? 'place_market' : 'place_park';
      if (world.player.locationId !== destination) {
        const result = startStreetJourney(world, destination, 'compressed');
        assert.equal(result.ok, true, result.reason);
      }
    }
  }
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.ok(world.travelRecords.some((entry) => entry.actorId !== 'player'));
  assert.ok(world.metrics.playerJourneysCompleted > 0);
  assert.equal(world.settings.walkingObligation, false);
}

const tests = [
  testDeterministicExteriorIdentityAndNetwork,
  testEveryPlaceHasUniqueGroundedExteriorIdentity,
  testAllPlacesAreWalkablyConnected,
  testVisibleAndCompressedTravelHaveEqualCost,
  testVisibleTravelCanBeCompressedMidRouteWithoutPenalty,
  testVisibleRouteCanEndEarlyAtARealEndpoint,
  testStreetMomentsAreObservationsNotRewardsOrPunishments,
  testMinuteLevelClockCrossesHoursAndDaysCorrectly,
  testAutonomousResidentsLeaveRouteEvidence,
  testOrdinaryActionsKeepBundledRouteProvenance,
  testTravelDoesNotCreateAgePressureOrAWalkingStreak,
  testRouteAuthorityDoesNotGrantPlaceAuthority,
  testV08MigrationDerivesPresentNetworkButNoPastTravel,
  testValidationRejectsCorruptionWithoutSilentRepair,
  testCurrentSaveRoundTripPreservesRouteAndExteriorEvidence,
  testLabeledWalkableExperimentUsesRealRouteAndIsSingleUse,
  testLongEvolutionRetainsWalkableInvariants
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
console.log(`\n${passed}/${tests.length} walkable-place tests passed.`);
