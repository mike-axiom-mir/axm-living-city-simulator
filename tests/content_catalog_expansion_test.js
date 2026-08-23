'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
globalThis.document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; }
};
for (const file of ['core', 'content', 'content_expansion', 'world', 'systems', 'households', 'habitats', 'object_use', 'object_use_item_expansion', 'object_use_audit', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence', 'visuals', 'game', 'ui']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Content, ContentExpansion, Core, World, Systems, Habitats, ObjectUse } = globalThis.AXM;
const CATEGORIES = ['seat', 'sleep', 'work', 'activity', 'light', 'storage', 'surface', 'decor', 'food'];
const STATS = ['comfort', 'beauty', 'utility', 'durability', 'efficiency'];

function newWorld(seed = 'AXM-CONTENT-EXPANSION-TEST') {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  return world;
}

function testCatalogueExpandsFrom24To60WithoutReplacingBaseItems() {
  assert.equal(ContentExpansion.itemCount, 36);
  assert.equal(ContentExpansion.totalCatalogueItems, 60);
  assert.equal(Content.FURNITURE_CATALOG.length, 60);
  assert.ok(Content.furnitureById('secondhand_chair'));
  assert.ok(Content.furnitureById('old_laptop'));
  assert.ok(Content.furnitureById('patched_armchair'));
  assert.ok(Content.furnitureById('mini_fridge'));
  assert.equal(new Set(Content.FURNITURE_CATALOG.map((item) => item.id)).size, 60);
}

function testEveryExistingCategoryGetsMoreVariety() {
  const expandedIds = new Set(ContentExpansion.itemIds);
  CATEGORIES.forEach((category) => {
    const added = Content.FURNITURE_CATALOG.filter((item) => expandedIds.has(item.id) && item.category === category);
    assert.ok(added.length >= 3, `${category} should gain at least three new options.`);
  });
}

function testNewItemsKeepReadableBoundedDefinitions() {
  ContentExpansion.items.forEach((item) => {
    assert.ok(item.price >= 0);
    assert.ok(item.footprint.every((value) => Number.isInteger(value) && value >= 1 && value <= 3));
    assert.ok(item.styleTags.length >= 1);
    assert.ok(item.signature.length >= 1);
    STATS.forEach((key) => assert.ok(Number.isFinite(item.baseStats[key]) && item.baseStats[key] >= 0 && item.baseStats[key] <= 100, `${item.id}.${key}`));
    assert.equal(STATS.every((key) => item.baseStats[key] >= 70), false, `${item.id} must not become a universal best-stat object.`);
  });
  assert.ok(ContentExpansion.items.some((item) => item.price < 30), 'Expansion should include genuinely cheap objects.');
  assert.ok(ContentExpansion.items.some((item) => item.price > 600), 'Expansion should include aspirational objects without making them mandatory.');
}

function testEveryNewDefinitionCanCreateARealPersistentObject() {
  const world = newWorld('CATALOGUE-CREATE-OBJECTS');
  ContentExpansion.items.forEach((definition) => {
    const object = World.createFurnitureInstance(world, definition.id, 'player', { condition: 80, sentimental: 5 });
    assert.equal(object.catalogId, definition.id);
    assert.equal(object.ownerId, 'player');
    assert.deepEqual(object.footprint, definition.footprint);
    assert.equal(Array.isArray(object.history), true);
  });
}

function testNewComputerGroundsExistingGameplayWithoutNewRewardPath() {
  const world = newWorld('CATALOGUE-COMPUTER-AFFORDANCE');
  const home = World.homeOf(world, 'player');
  const room = home.habitat.rooms.find((entry) => ['work', 'living', 'sleep'].includes(entry.purpose));
  assert.ok(room);
  const computer = World.createFurnitureInstance(world, 'refurbished_laptop', 'player', { colorId: 'night', condition: 82 });
  const placed = World.addFurnitureToProperty(world, home, computer, null, (x, y, footprint) => {
    return Habitats.roomAtCell(home, x, y)?.id === room.id && Habitats.objectFitsAt(home, computer, x, y, footprint);
  });
  assert.equal(placed, true);
  const projection = ObjectUse.affordancesForRoom(world, home.id, room.id, 'player');
  const play = projection.affordances.find((entry) => entry.actionId === 'play_pc' && entry.objectId === computer.id);
  assert.ok(play, 'New computers should plug into the existing PC activity rather than inventing a second reward path.');
  assert.equal(play.noReward, true);
  assert.equal(play.noExecutionAuthority, true);
  assert.equal(ObjectUse.validateProjection(world, projection).ok, true);
}

function testExpansionDoesNotChangeWorldSchemaOrDeterminism() {
  const a = newWorld('CATALOGUE-DETERMINISM');
  const b = newWorld('CATALOGUE-DETERMINISM');
  assert.equal(a.schema, 'axm.living-city-sim.world/v0.11.0');
  assert.equal(b.schema, a.schema);
  assert.equal(Core.serializeWorld(a), Core.serializeWorld(b));
}

const tests = [
  testCatalogueExpandsFrom24To60WithoutReplacingBaseItems,
  testEveryExistingCategoryGetsMoreVariety,
  testNewItemsKeepReadableBoundedDefinitions,
  testEveryNewDefinitionCanCreateARealPersistentObject,
  testNewComputerGroundsExistingGameplayWithoutNewRewardPath,
  testExpansionDoesNotChangeWorldSchemaOrDeterminism
];

for (const test of tests) test();
console.log(`PASS content catalogue expansion tests: ${tests.length}/${tests.length}`);
