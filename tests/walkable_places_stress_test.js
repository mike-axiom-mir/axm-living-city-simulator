'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Exteriors } = globalThis.AXM;
const ALL_SEEDS = Array.from({ length: 8 }, (_, index) => `AXM-WALKABLE-STRESS-${String(index + 1).padStart(2, '0')}`);
const SEED_START = Math.max(1, Number.parseInt(process.env.AXM_WALKABLE_STRESS_START || '1', 10));
const SEED_COUNT = Math.max(1, Math.min(8, Number.parseInt(process.env.AXM_WALKABLE_STRESS_COUNT || '8', 10)));
const SEEDS = ALL_SEEDS.slice(SEED_START - 1, SEED_START - 1 + SEED_COUNT);
const DAYS = 180;
const DESTINATIONS = ['place_market', 'place_park', 'place_school', 'place_workshop', 'place_square', 'home_student'];

function run(seed) {
  const world = World.createWorld(seed);
  const ageSnapshot = new Map([world.player].concat(world.people).map((person) => [person.id, {
    age: person.age,
    ageDays: person.lifeCourse?.ageDays,
    stage: person.lifeCourse?.stage
  }]));

  for (let day = 0; day < DAYS; day += 1) {
    Systems.advanceHours(world, 24);
    if (day % 30 === 0) {
      const destination = DESTINATIONS[(day / 30) % DESTINATIONS.length];
      if (world.player.locationId !== destination) {
        const result = Systems.startPlayerTravel(world, destination, 'compressed');
        assert.equal(result.ok, true, `${seed}: ${result.reason}`);
      }
    }
  }

  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, `${seed}: ${validation.errors.join('\n')}`);
  assert.equal(world.settings.travelCompressionAllowed, true);
  assert.equal(world.settings.walkingObligation, false);
  assert.equal(world.settings.agePressure, false);
  assert.equal(world.settings.lifeCourseMode, 'choice');
  assert.equal(world.places.filter((place) => place.exterior?.schema === Exteriors.EXTERIOR_SCHEMA).length, world.places.length);
  assert.equal(new Set(world.places.map((place) => place.exterior.address.label)).size, world.places.length);
  assert.ok(world.streetNetwork.nodes.length > world.places.length);
  assert.ok(world.streetNetwork.edges.length >= world.streetNetwork.nodes.length - 1);
  assert.ok(world.metrics.npcRoutesObserved > 0, `${seed}: no resident routes were recorded`);
  assert.ok(world.metrics.playerJourneysCompleted > 0, `${seed}: no player route was completed`);
  assert.ok(world.metrics.playerCompressedJourneys > 0, `${seed}: no compressed route was completed`);
  assert.ok(world.travelRecords.length <= 500, `${seed}: travel evidence cap failed`);

  for (const [id, before] of ageSnapshot.entries()) {
    const person = World.getPerson(world, id);
    assert.ok(person, `${seed}: original person ${id} disappeared`);
    assert.equal(person.age, before.age, `${seed}: ${id} age changed`);
    assert.equal(person.lifeCourse?.ageDays, before.ageDays, `${seed}: ${id} ageDays changed`);
    assert.equal(person.lifeCourse?.stage, before.stage, `${seed}: ${id} life stage changed`);
  }

  for (const record of world.travelRecords) {
    assert.ok(World.getPlace(world, record.originPlaceId), `${seed}: missing route origin ${record.originPlaceId}`);
    assert.ok(World.getPlace(world, record.destinationPlaceId), `${seed}: missing route destination ${record.destinationPlaceId}`);
    assert.ok(record.route.nodeIds.every((id) => Exteriors.networkNode(world, id)), `${seed}: missing route node`);
    assert.ok(record.route.edgeIds.every((id) => Exteriors.networkEdge(world, id)), `${seed}: missing route edge`);
  }

  const m = Exteriors.metrics(world);
  return {
    world,
    report: {
      seed,
      finalDay: world.time.day,
      population: world.people.length + 1,
      exteriorPlaces: m.exteriorPlaces,
      addresses: m.addresses,
      networkNodes: m.networkNodes,
      networkEdges: m.networkEdges,
      retainedTravelRecords: world.travelRecords.length,
      playerJourneys: world.metrics.playerJourneysCompleted,
      playerCompressedJourneys: world.metrics.playerCompressedJourneys,
      playerVisibleJourneys: world.metrics.playerVisibleJourneys,
      playerWalkingMinutes: world.metrics.playerWalkingMinutes,
      playerDistanceMeters: world.metrics.playerWalkingDistanceMeters,
      npcRoutesObserved: world.metrics.npcRoutesObserved,
      npcRouteDistanceMeters: world.metrics.npcRouteDistanceMeters,
      bundledRoutesRecorded: world.metrics.bundledRoutesRecorded,
      streetMomentsObserved: world.metrics.streetMomentsObserved,
      agePressure: world.settings.agePressure,
      walkingObligation: world.settings.walkingObligation,
      validationErrors: validation.errors.length
    }
  };
}

const reports = [];
for (const seed of SEEDS) {
  const first = run(seed);
  const second = run(seed);
  assert.equal(Core.serializeWorld(first.world), Core.serializeWorld(second.world), `${seed}: deterministic replay diverged`);
  reports.push(first.report);
  console.log(`PASS ${seed} · ${first.report.npcRoutesObserved} resident routes · ${first.report.playerJourneys} player routes · exact replay`);
}

const sumKeys = [
  'retainedTravelRecords', 'playerJourneys', 'playerCompressedJourneys', 'playerVisibleJourneys',
  'playerWalkingMinutes', 'playerDistanceMeters', 'npcRoutesObserved', 'npcRouteDistanceMeters',
  'bundledRoutesRecorded', 'streetMomentsObserved'
];
const totals = reports.reduce((acc, row) => {
  for (const key of sumKeys) acc[key] = Core.round((acc[key] || 0) + row[key], 3);
  return acc;
}, {});
const aggregate = {
  schema: 'axm.living-city.walkable-places-stress-report/v0.9.0',
  generatedAt: new Date().toISOString(),
  seeds: reports.length,
  daysPerSeed: DAYS,
  deterministicExecutions: reports.length * 2,
  simulatedDaysAcrossPrimaryRuns: reports.length * DAYS,
  reports,
  totals,
  averages: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Core.round(value / reports.length, 3)])),
  invariants: {
    exactSerializedReplay: true,
    everyPlaceHasUniqueAddress: true,
    everyRetainedRouteUsesExistingNodesAndPlaces: true,
    travelCompressionAlwaysAvailable: true,
    walkingNeverObligatory: true,
    choiceFirstAgeStable: true,
    noValidationFailures: true
  }
};

const subsetSuffix = SEEDS.length === ALL_SEEDS.length ? '' : `_v0_10_${String(SEED_START).padStart(2, '0')}_${String(SEED_START + SEEDS.length - 1).padStart(2, '0')}`;
fs.writeFileSync(path.join(ROOT, 'tests', `WALKABLE_PLACES_STRESS_RESULTS${subsetSuffix}.json`), `${JSON.stringify(aggregate, null, 2)}\n`);
const lines = [
  'AXM Living City — Walkable Places v0.9.0',
  'Deterministic walkable-place stress results',
  '',
  `Seeds: ${aggregate.seeds}`,
  `Days per seed: ${DAYS}`,
  `Deterministic executions: ${aggregate.deterministicExecutions}`,
  `Primary simulated days: ${aggregate.simulatedDaysAcrossPrimaryRuns}`,
  `Resident routes recorded: ${totals.npcRoutesObserved}`,
  `Player journeys: ${totals.playerJourneys}`,
  `Player travel minutes: ${totals.playerWalkingMinutes}`,
  `Player distance: ${totals.playerDistanceMeters} m`,
  `Resident route distance: ${totals.npcRouteDistanceMeters} m`,
  '',
  'Every world replayed to exact serialized equality.',
  'Every place retained a unique deterministic address and connected entrance.',
  'Every retained route resolved to existing people, places, nodes, and edges.',
  'Travel compression remained available; walking never became obligatory.',
  'Choice-first ages and life chapters remained stable.',
  'No validation failures were observed.',
  '',
  ...reports.map((row) => `${row.seed}: ${row.npcRoutesObserved} resident routes; ${row.playerJourneys} player routes; ${row.playerWalkingMinutes} player minutes; ${row.retainedTravelRecords} retained records.`)
];
fs.writeFileSync(path.join(ROOT, 'tests', `WALKABLE_PLACES_STRESS_RESULTS${subsetSuffix}.txt`), `${lines.join('\n')}\n`);
console.log(`\nPASS ${reports.length}/${reports.length} walkable-place stress worlds; exact replay confirmed.`);
console.log(JSON.stringify(totals, null, 2));
