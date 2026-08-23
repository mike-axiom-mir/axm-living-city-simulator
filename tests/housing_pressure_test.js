'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of [
  'core', 'content', 'content_expansion', 'world', 'systems', 'item_interactions',
  'households', 'habitats', 'object_use', 'object_use_item_expansion', 'object_use_audit',
  'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells',
  'presence', 'housing_pressure'
]) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, Content, World, Systems, HousingPressure } = globalThis.AXM;

function newWorld(seed) {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  return world;
}

function playerOnlyHome(world) {
  const home = World.homeOf(world, 'player');
  home.furniture = home.furniture.filter((object) => object.ownerId === 'player');
  return home;
}

function buyExtra(world, catalogId = 'clip_lamp') {
  if (world.player.money < 1000) Systems.developerGrant(world);
  const result = Systems.buyFurniture(world, catalogId);
  assert.equal(result.ok, true, `${catalogId} should fit after non-player furniture is cleared.`);
  return result;
}

function testStarterPossessionsHaveNoFurnishingSurcharge() {
  const world = newWorld('HOUSING-PRESSURE-STARTER');
  playerOnlyHome(world);
  const pressure = HousingPressure.summary(world);
  assert.equal(pressure.personalPlacedObjects, 6);
  assert.equal(pressure.freeObjectAllowance, 6);
  assert.equal(pressure.chargeableObjects, 0);
  assert.equal(pressure.monthlySurcharge, 0);
}

function testBuyingBeyondStarterAllowanceRaisesOnlyPlayerPressure() {
  const world = newWorld('HOUSING-PRESSURE-BUY');
  const home = playerOnlyHome(world);
  const marketRentBefore = home.currentRent;
  const before = HousingPressure.summary(world);
  const purchase = buyExtra(world, 'clip_lamp');
  const after = HousingPressure.summary(world);
  assert.ok(after.monthlySurcharge > before.monthlySurcharge);
  assert.ok(purchase.housingPressure.deltaMonthly > 0);
  assert.equal(home.currentRent, marketRentBefore, 'Personal belongings must not silently raise roommates\' market rent.');
}

function testRoommateObjectsAndFixturesDoNotCountAgainstPlayer() {
  const world = newWorld('HOUSING-PRESSURE-BOUNDARY');
  const home = playerOnlyHome(world);
  const otherId = home.tenants.find((id) => id !== 'player') || world.people[0].id;
  for (let i = 0; i < 4; i += 1) {
    const object = World.createFurnitureInstance(world, 'clip_lamp', otherId, { ownershipMode: 'personal', condition: 80 });
    World.addFurnitureToProperty(world, home, object);
  }
  const fixture = World.createFurnitureInstance(world, 'basic_lamp', home.ownerId, { ownershipMode: 'property_fixture', condition: 80 });
  World.addFurnitureToProperty(world, home, fixture);
  const pressure = HousingPressure.summary(world);
  assert.equal(pressure.personalPlacedObjects, 6);
  assert.equal(pressure.monthlySurcharge, 0);
}

function testStorageReducesFuturePressureAgain() {
  const world = newWorld('HOUSING-PRESSURE-STORAGE');
  playerOnlyHome(world);
  const purchase = buyExtra(world, 'clip_lamp');
  const added = purchase.object;
  const high = HousingPressure.summary(world).monthlySurcharge;
  assert.ok(high > 0);
  const stored = Systems.storeFurniture(world, added.id);
  assert.equal(stored.ok, true);
  assert.ok(stored.housingPressure.deltaMonthly < 0);
  assert.equal(HousingPressure.summary(world).monthlySurcharge, 0);
}

function testPassiveHouseholdObjectDecayIsDisabled() {
  const world = newWorld('HOUSING-PRESSURE-NO-DECAY');
  const before = new Map();
  world.places.filter((place) => place.kind === 'residential').forEach((property) => {
    property.furniture.forEach((object) => before.set(object.id, object.condition));
  });
  Systems.advanceHours(world, 72, { freezePlayer: true });
  world.places.filter((place) => place.kind === 'residential').forEach((property) => {
    property.furniture.forEach((object) => {
      if (!before.has(object.id)) return;
      assert.ok(object.condition >= before.get(object.id), `${object.id} should not passively decay with time.`);
    });
  });
}

function testWeeklyBoundaryChargesVisibleFurnishingRent() {
  const world = newWorld('HOUSING-PRESSURE-WEEKLY');
  playerOnlyHome(world);
  buyExtra(world, 'clip_lamp');
  buyExtra(world, 'side_table');
  const expected = HousingPressure.summary(world).weeklySurcharge;
  assert.ok(expected > 0);
  world.player.money = 5000;
  world.time = { day: 7, hour: 23, minute: 0 };
  Systems.advanceHours(world, 1);
  const receipt = world.ledger.slice().reverse().find((entry) => entry.evidence?.schema === HousingPressure.SCHEMA && Number(entry.evidence.weeklySurcharge) > 0);
  assert.ok(receipt, 'Crossing a weekly rent boundary should record the furnishing surcharge visibly.');
  assert.equal(receipt.evidence.weeklySurcharge, expected);
  assert.equal(receipt.evidence.noLateFee, true);
}

function testFurnishingArrearsHaveNoExtraMoodPunishmentOrLateFee() {
  const world = newWorld('HOUSING-PRESSURE-ARREARS');
  playerOnlyHome(world);
  buyExtra(world, 'clip_lamp');
  world.player.money = 0;
  const beforeMood = world.player.needs.mood;
  const beforeArrears = world.player.rentArrears;
  const result = HousingPressure.chargeOneWeek(world, 1);
  assert.ok(result.shortfall > 0);
  assert.equal(world.player.needs.mood, beforeMood, 'Furnishing surcharge arrears should not add a second mood punishment.');
  assert.ok(world.player.rentArrears > beforeArrears);
  const receipt = world.ledger.at(-1);
  assert.equal(receipt.evidence.noLateFee, true);
}

function testOwnerOccupierDoesNotPayFurnishingRentToThemself() {
  const world = newWorld('HOUSING-PRESSURE-OWNER');
  const home = playerOnlyHome(world);
  buyExtra(world, 'compact_computer');
  home.ownerId = 'player';
  home.ownerLabel = world.player.name;
  assert.equal(HousingPressure.summary(world).monthlySurcharge, 0);
}

function testPressureRemainsBoundedEvenWithManyExpensiveObjects() {
  const world = newWorld('HOUSING-PRESSURE-CAP');
  const home = playerOnlyHome(world);
  for (let i = 0; i < 20; i += 1) {
    const object = World.createFurnitureInstance(world, 'compact_computer', 'player', { condition: 100 });
    home.furniture.push(object);
  }
  const pressure = HousingPressure.summary(world);
  assert.equal(pressure.monthlySurcharge <= pressure.capMonthly, true);
  assert.equal(pressure.monthlySurcharge, pressure.capMonthly);
}

const tests = [
  testStarterPossessionsHaveNoFurnishingSurcharge,
  testBuyingBeyondStarterAllowanceRaisesOnlyPlayerPressure,
  testRoommateObjectsAndFixturesDoNotCountAgainstPlayer,
  testStorageReducesFuturePressureAgain,
  testPassiveHouseholdObjectDecayIsDisabled,
  testWeeklyBoundaryChargesVisibleFurnishingRent,
  testFurnishingArrearsHaveNoExtraMoodPunishmentOrLateFee,
  testOwnerOccupierDoesNotPayFurnishingRentToThemself,
  testPressureRemainsBoundedEvenWithManyExpensiveObjects
];

for (const test of tests) test();
console.log(`PASS housing-pressure tests: ${tests.length}/${tests.length}`);
