'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of [
  'core', 'content', 'content_expansion', 'world', 'systems', 'item_interactions',
  'households', 'habitats', 'object_use', 'object_use_item_expansion', 'object_use_audit',
  'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells',
  'presence', 'housing_pressure', 'historical_era'
]) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, HistoricalEra } = globalThis.AXM;

function newWorld(seed) {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  return world;
}

function testTimelineStartsIn1980AndEndsAt2026() {
  assert.equal(HistoricalEra.yearForDay(1), 1980);
  assert.equal(HistoricalEra.yearForDay(8), 1981);
  assert.equal(HistoricalEra.yearForDay(71), 1990);
  assert.equal(HistoricalEra.yearForDay(323), 2026);
  assert.equal(HistoricalEra.yearForDay(99999), 2026);
  assert.equal(HistoricalEra.dayForYear(2026), 323);
}

function testEraLabelsFollowDecades() {
  assert.equal(HistoricalEra.eraForYear(1980).id, 'eighties');
  assert.equal(HistoricalEra.eraForYear(1996).id, 'nineties');
  assert.equal(HistoricalEra.eraForYear(2004).id, 'connected_2000s');
  assert.equal(HistoricalEra.eraForYear(2016).id, 'mobile_2010s');
  assert.equal(HistoricalEra.eraForYear(2026).id, 'present_2020s');
}

function testNew1980WorldUsesEraAppropriateStarterTech() {
  const world = newWorld('HISTORICAL-STARTER');
  const home = World.homeOf(world, 'player');
  const playerItems = home.furniture.filter((object) => object.ownerId === 'player');
  assert.equal(HistoricalEra.currentYear(world), 1980);
  assert.equal(playerItems.some((object) => object.catalogId === 'old_laptop'), false);
  assert.equal(playerItems.some((object) => object.catalogId === 'music_player'), true);
  assert.equal(playerItems.length, 6, 'Historical start should preserve the six-item starter footprint.');
}

function testFutureTechnologyCannotBeBoughtEarly() {
  const world = newWorld('HISTORICAL-BUY-GATE');
  Systems.developerGrant(world);
  const beforeMoney = world.player.money;
  const result = Systems.buyFurniture(world, 'compact_computer');
  assert.equal(result.ok, false);
  assert.equal(result.historicalEra.currentYear, 1980);
  assert.equal(result.historicalEra.introducedYear, 2010);
  assert.match(result.reason, /2010/);
  assert.equal(world.player.money, beforeMoney, 'Blocked future purchases must not spend money.');
}

function testTechnologyUnlocksWhenItsEraArrives() {
  const world = newWorld('HISTORICAL-UNLOCK');
  Systems.developerGrant(world);
  world.time.day = HistoricalEra.dayForYear(1995);
  assert.equal(HistoricalEra.currentYear(world), 1995);
  const availability = HistoricalEra.furnitureAvailability(world, 'old_laptop');
  assert.equal(availability.ok, true);
  const result = Systems.buyFurniture(world, 'old_laptop');
  assert.equal(result.ok, true);
  assert.equal(result.historicalEra.currentYear, 1995);
}

function testPresentEraUnlocksAllSixtyCatalogueItems() {
  const world = newWorld('HISTORICAL-PRESENT');
  world.time.day = HistoricalEra.dayForYear(2026);
  const summary = HistoricalEra.summary(world);
  assert.equal(summary.currentYear, 2026);
  assert.equal(summary.atPresent, true);
  assert.equal(summary.totalFurniture, 60);
  assert.equal(summary.availableFurniture, 60);
}

function testHeaderExposesHistoricalYearWithoutChangingLifeCoursePressure() {
  const world = newWorld('HISTORICAL-HEADER');
  assert.match(Core.formatDateTime(world), /^1980 · Analog Eighties ·/);
  const ageBefore = world.player.age;
  world.time.day = HistoricalEra.dayForYear(2026);
  assert.match(Core.formatDateTime(world), /^2026 · Present Era ·/);
  assert.equal(world.player.age, ageBefore, 'Historical world progression must not silently force player aging.');
  assert.equal(HistoricalEra.summary(world).playerAgePressure, false);
}

function testExistingFutureObjectsArePreservedInsteadOfDeleted() {
  const world = newWorld('HISTORICAL-NO-LOSS');
  const home = World.homeOf(world, 'player');
  const future = World.createFurnitureInstance(world, 'compact_computer', 'player', { condition: 91 });
  home.furniture.push(future);
  const before = Core.serializeWorld(world);
  const availability = HistoricalEra.furnitureAvailability(world, future.catalogId);
  assert.equal(availability.ok, false);
  assert.ok(home.furniture.some((object) => object.id === future.id), 'Existing future-tech object must not be deleted.');
  assert.equal(Core.serializeWorld(world), before, 'Availability inspection must remain read-only.');
}

function testHistoricalProgressionIsDeterministic() {
  const a = newWorld('HISTORICAL-DETERMINISM');
  const b = newWorld('HISTORICAL-DETERMINISM');
  [1, 71, 141, 211, 281, 323, 800].forEach((day) => {
    a.time.day = day;
    b.time.day = day;
    assert.deepEqual(HistoricalEra.summary(a), HistoricalEra.summary(b));
  });
}

const tests = [
  testTimelineStartsIn1980AndEndsAt2026,
  testEraLabelsFollowDecades,
  testNew1980WorldUsesEraAppropriateStarterTech,
  testFutureTechnologyCannotBeBoughtEarly,
  testTechnologyUnlocksWhenItsEraArrives,
  testPresentEraUnlocksAllSixtyCatalogueItems,
  testHeaderExposesHistoricalYearWithoutChangingLifeCoursePressure,
  testExistingFutureObjectsArePreservedInsteadOfDeleted,
  testHistoricalProgressionIsDeterministic
];

for (const test of tests) test();
console.log(`PASS historical era tests: ${tests.length}/${tests.length}`);
