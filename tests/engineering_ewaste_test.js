'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of [
  'core', 'content', 'content_expansion', 'world', 'systems', 'item_interactions',
  'households', 'habitats', 'object_use', 'object_use_item_expansion', 'object_use_audit',
  'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells',
  'presence', 'housing_pressure', 'historical_era', 'engineering_ewaste'
]) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, HistoricalEra, EngineeringEwaste } = globalThis.AXM;

function newWorld(seed) {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  return world;
}

function addPlayerBench(world) {
  const home = World.homeOf(world, 'player');
  const bench = World.createFurnitureInstance(world, 'workbench', 'player', { condition: 90 });
  home.furniture.push(bench);
  return bench;
}

function firstInspectedLot(world) {
  const collected = EngineeringEwaste.collectEwaste(world);
  assert.equal(collected.ok, true);
  const inspected = EngineeringEwaste.inspectEwaste(world, collected.lot.id);
  assert.equal(inspected.ok, true);
  return inspected.lot;
}

function testFreshWorldStartsWithEmptyOptionalEngineeringState() {
  const world = newWorld('EWASTE-FRESH');
  const summary = EngineeringEwaste.summary(world);
  assert.equal(summary.currentYear, 1980);
  assert.equal(summary.queuedLots, 0);
  assert.equal(summary.refurbishedStock, 0);
  assert.equal(summary.prototypes, 0);
  assert.equal(summary.robotAutonomyEnabled, false);
  assert.equal(summary.noMaintenanceObligation, true);
}

function testEraAppropriateSalvagePoolExpandsOverTime() {
  const world = newWorld('EWASTE-ERA-POOL');
  const early = EngineeringEwaste.sourcePool(world).map((entry) => entry.id);
  assert.ok(early.includes('cassette_player_scrap'));
  assert.ok(early.includes('toy_motor_scrap'));
  assert.equal(early.includes('mobile_phone_scrap'), false);
  world.time.day = HistoricalEra.dayForYear(2010);
  const later = EngineeringEwaste.sourcePool(world).map((entry) => entry.id);
  assert.ok(later.includes('desktop_pc_scrap'));
  assert.ok(later.includes('mobile_phone_scrap'));
  assert.ok(later.length > early.length);
}

function testCollectionIsDeterministicAndExplicit() {
  const a = newWorld('EWASTE-DETERMINISTIC');
  const b = newWorld('EWASTE-DETERMINISTIC');
  const aResult = EngineeringEwaste.collectEwaste(a);
  const bResult = EngineeringEwaste.collectEwaste(b);
  assert.equal(aResult.ok, true);
  assert.equal(bResult.ok, true);
  assert.deepEqual(aResult.lot, bResult.lot);
  assert.equal(a.time.day, b.time.day);
  assert.equal(a.time.hour, b.time.hour);
}

function testInspectionRevealsChoiceWithoutAutoSalvaging() {
  const world = newWorld('EWASTE-INSPECT');
  const collected = EngineeringEwaste.collectEwaste(world);
  const beforeComponents = { ...EngineeringEwaste.summary(world).components };
  const result = EngineeringEwaste.inspectEwaste(world, collected.lot.id);
  assert.equal(result.ok, true);
  assert.equal(result.lot.inspected, true);
  assert.ok(result.lot.expectedComponents);
  assert.ok(result.lot.estimatedResaleValue > 0);
  assert.deepEqual(EngineeringEwaste.summary(world).components, beforeComponents, 'Inspection must not silently dismantle the lot.');
  assert.equal(EngineeringEwaste.summary(world).queuedLots, 1);
}

function testSalvageNeedsARealBenchOrWorkshopPresence() {
  const world = newWorld('EWASTE-BENCH');
  const lot = firstInspectedLot(world);
  const blocked = EngineeringEwaste.salvageEwaste(world, lot.id);
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /workbench|workshop/i);
  addPlayerBench(world);
  const result = EngineeringEwaste.salvageEwaste(world, lot.id);
  assert.equal(result.ok, true);
  assert.ok(Object.values(result.components).some((value) => value > 0));
  assert.equal(EngineeringEwaste.summary(world).queuedLots, 0);
  assert.ok(EngineeringEwaste.engineeringLevel(world) > 0);
}

function testHomeWorkbenchCannotBeUsedRemotely() {
  const world = newWorld('EWASTE-BENCH-PRESENCE');
  const home = World.homeOf(world, 'player');
  addPlayerBench(world);
  const lot = firstInspectedLot(world);
  world.player.locationId = 'place_cafe';
  const remote = EngineeringEwaste.salvageEwaste(world, lot.id);
  assert.equal(remote.ok, false);
  assert.match(remote.reason, /workbench is at home|return home/i);
  assert.equal(EngineeringEwaste.summary(world).queuedLots, 1, 'Remote refusal must leave the lot intact.');
  world.player.locationId = home.id;
  assert.equal(EngineeringEwaste.salvageEwaste(world, lot.id).ok, true);
}

function testRefurbishThenSellCreatesGroundedSideIncome() {
  const world = newWorld('EWASTE-REFURBISH');
  addPlayerBench(world);
  world.player.money = 100;
  const lot = firstInspectedLot(world);
  const beforeLifetime = world.player.lifetimeEarnings;
  const refurbished = EngineeringEwaste.refurbishEwaste(world, lot.id);
  assert.equal(refurbished.ok, true);
  assert.ok(refurbished.stock.saleValue > refurbished.cost);
  assert.equal(EngineeringEwaste.summary(world).refurbishedStock, 1);
  const moneyBeforeSale = world.player.money;
  const sale = EngineeringEwaste.sellRefurbished(world, refurbished.stock.id);
  assert.equal(sale.ok, true);
  assert.equal(world.player.money, Core.round(moneyBeforeSale + sale.amount, 2));
  assert.equal(world.player.lifetimeEarnings, Core.round(beforeLifetime + sale.amount, 2));
  assert.equal(EngineeringEwaste.summary(world).refurbishedStock, 0);
}

function testRoboticaBlueprintIsHistoricalAndCapabilityGated() {
  const world = newWorld('EWASTE-ROBOT-GATE');
  let gate = EngineeringEwaste.blueprintAvailability(world, 'mini_scrap_crawler');
  assert.equal(gate.ok, false);
  assert.equal(gate.introducedYear, 2015);
  world.time.day = HistoricalEra.dayForYear(2015);
  gate = EngineeringEwaste.blueprintAvailability(world, 'mini_scrap_crawler');
  assert.equal(gate.ok, false);
  assert.match(gate.reason, /engineering 3/i);
  world.player.skills.engineering = 3;
  assert.equal(EngineeringEwaste.blueprintAvailability(world, 'mini_scrap_crawler').ok, true);
}

function testMiniScrapCrawlerConsumesRealReclaimedComponentsButGetsNoAutonomy() {
  const world = newWorld('EWASTE-ROBOT-BUILD');
  world.time.day = HistoricalEra.dayForYear(2015);
  world.player.skills.engineering = 3;
  addPlayerBench(world);
  const state = EngineeringEwaste.ensureState(world);
  Object.assign(state.components, { wire: 2, motor: 2, board: 1, sensor: 1, casing: 1 });
  const result = EngineeringEwaste.buildPrototype(world, 'mini_scrap_crawler');
  assert.equal(result.ok, true);
  assert.equal(result.prototype.kind, 'miniature_robotica');
  assert.equal(result.prototype.autonomous, false);
  assert.equal(result.prototype.scheduleAuthority, false);
  assert.match(result.prototype.provenance[0], /reclaimed e-waste components/);
  assert.equal(state.components.wire, 0);
  assert.equal(state.components.motor, 0);
  assert.equal(state.components.sensor, 0);
  assert.equal(EngineeringEwaste.summary(world).miniatureRobotica, 1);
}

function testTimePassingDoesNotCreateEwasteOrRobotChores() {
  const world = newWorld('EWASTE-NO-PASSIVE');
  const before = EngineeringEwaste.summary(world);
  Systems.advanceHours(world, 24 * 14, { freezePlayer: true });
  const after = EngineeringEwaste.summary(world);
  assert.equal(after.queuedLots, before.queuedLots);
  assert.equal(after.prototypes, before.prototypes);
  assert.equal(after.noPassiveEwasteGeneration, true);
  assert.equal(after.noMaintenanceObligation, true);
}

function testInspectingLegacyWorldDoesNotSilentlyInstallState() {
  const world = newWorld('EWASTE-LEGACY-READ');
  delete world.engineeringEwaste;
  const before = Core.serializeWorld(world);
  const summary = EngineeringEwaste.summary(world);
  assert.equal(summary.queuedLots, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(world, 'engineeringEwaste'), false);
  assert.equal(Core.serializeWorld(world), before, 'Read-only engineering summary must not silently rewrite a legacy world.');
  const action = EngineeringEwaste.collectEwaste(world);
  assert.equal(action.ok, true);
  assert.equal(world.engineeringEwaste.schema, EngineeringEwaste.SCHEMA, 'Explicit engineering action may initialize its bounded state.');
}

function testUnknownEngineeringSchemaIsNeverOverwritten() {
  const world = newWorld('EWASTE-FUTURE-SCHEMA');
  world.engineeringEwaste = { schema: 'axm.living-city.engineering-ewaste/v99-future', sentinel: { keep: 'me' } };
  const before = Core.serializeWorld(world);
  const summary = EngineeringEwaste.summary(world);
  assert.equal(summary.queuedLots, 0, 'Read-only summary may report an empty compatible projection.');
  assert.equal(Core.serializeWorld(world), before, 'Read-only inspection must preserve unknown future state byte-for-byte.');
  assert.throws(() => EngineeringEwaste.collectEwaste(world), /refusing to overwrite/i);
  assert.equal(Core.serializeWorld(world), before, 'Explicit action must refuse rather than clobber an unknown engineering schema.');
}

const tests = [
  testFreshWorldStartsWithEmptyOptionalEngineeringState,
  testEraAppropriateSalvagePoolExpandsOverTime,
  testCollectionIsDeterministicAndExplicit,
  testInspectionRevealsChoiceWithoutAutoSalvaging,
  testSalvageNeedsARealBenchOrWorkshopPresence,
  testHomeWorkbenchCannotBeUsedRemotely,
  testRefurbishThenSellCreatesGroundedSideIncome,
  testRoboticaBlueprintIsHistoricalAndCapabilityGated,
  testMiniScrapCrawlerConsumesRealReclaimedComponentsButGetsNoAutonomy,
  testTimePassingDoesNotCreateEwasteOrRobotChores,
  testInspectingLegacyWorldDoesNotSilentlyInstallState,
  testUnknownEngineeringSchemaIsNeverOverwritten
];

for (const test of tests) test();
console.log(`PASS engineering/e-waste tests: ${tests.length}/${tests.length}`);
