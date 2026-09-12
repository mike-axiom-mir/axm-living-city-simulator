'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
globalThis.document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; }
};
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'object_use', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence', 'visuals', 'game', 'ui']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Habitats, ObjectUse } = globalThis.AXM;

function newWorld(seed = 'AXM-OBJECT-USE-AFFORDANCES-TEST') {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  return world;
}

function roomByPurpose(world, purpose) {
  const home = World.homeOf(world, 'player');
  const room = home.habitat.rooms.find((entry) => entry.purpose === purpose);
  assert.ok(room, `Starting home needs a ${purpose} room.`);
  return { home, room };
}

function testSleepingObjectProducesGroundedSleepAffordance() {
  const world = newWorld('OBJECT-USE-SLEEP');
  const { home, room } = roomByPurpose(world, 'sleep');
  const projection = ObjectUse.affordancesForRoom(world, home.id, room.id);
  assert.ok(projection);
  assert.equal(projection.noExecutionAuthority, true);
  assert.equal(projection.permissionResolutionDeferred, true);
  assert.equal(projection.noReward, true);
  const sleep = projection.affordances.find((entry) => entry.actionId === 'sleep' && entry.source === 'persistent_object');
  assert.ok(sleep, 'A real persistent sleeping object should ground sleep.');
  assert.ok(sleep.objectId);
  assert.equal(sleep.useSpot.kind, 'object');
  assert.equal(sleep.useSpot.objectId, sleep.objectId);
  assert.ok(sleep.useSpot.objectCells.length >= 1);
  assert.equal(ObjectUse.validateProjection(world, projection).ok, true);
}

function testBathroomUtilityGroundsShowerWithoutInventedObject() {
  const world = newWorld('OBJECT-USE-BATHROOM');
  const { home, room } = roomByPurpose(world, 'bathroom');
  const projection = ObjectUse.affordancesForRoom(world, home.id, room.id);
  const shower = projection.affordances.find((entry) => entry.actionId === 'shower');
  assert.ok(shower, 'A bathroom with water and waste should expose a shower affordance.');
  assert.equal(shower.source, 'room_utility');
  assert.equal(shower.objectId, null);
  assert.deepEqual(shower.useSpot.utilities, ['water', 'waste']);
  assert.equal(projection.affordances.some((entry) => ['play_pc', 'study_focus', 'creative_time'].includes(entry.actionId)), false);
  assert.equal(ObjectUse.validateProjection(world, projection).ok, true);
}

function testProjectionIsDeterministicAndReadOnly() {
  const world = newWorld('OBJECT-USE-DETERMINISTIC');
  const { home, room } = roomByPurpose(world, 'sleep');
  const before = Core.serializeWorld(world);
  const first = ObjectUse.affordancesForRoom(world, home.id, room.id);
  const second = ObjectUse.affordancesForRoom(world, home.id, room.id);
  assert.deepEqual(second, first);
  assert.equal(Core.serializeWorld(world), before, 'Affordance inspection must not mutate authoritative world state.');
}

function testOtherOwnedObjectSignalsPermissionInsteadOfAssumingIt() {
  const world = newWorld('OBJECT-USE-PERMISSION');
  const { home, room } = roomByPurpose(world, 'sleep');
  const object = home.furniture.find((entry) => Habitats.roomAtCell(home, entry.position.x, entry.position.y)?.id === room.id && globalThis.AXM.Content.furnitureById(entry.catalogId)?.category === 'sleep');
  assert.ok(object);
  object.ownerId = 'npc_001';
  object.ownershipMode = 'personal';
  const projection = ObjectUse.affordancesForRoom(world, home.id, room.id, 'player');
  const sleep = projection.affordances.find((entry) => entry.actionId === 'sleep' && entry.objectId === object.id);
  assert.ok(sleep);
  assert.equal(sleep.permissionHint, 'other_owned_object_requires_permission');
  assert.equal(sleep.noExecutionAuthority, true);
  assert.equal(projection.permissionResolutionDeferred, true);
}

function testUseCellsStayInsideRoomGraph() {
  const world = newWorld('OBJECT-USE-CELLS');
  const { home, room } = roomByPurpose(world, 'sleep');
  const projection = ObjectUse.affordancesForRoom(world, home.id, room.id);
  const roomCells = new Set(room.cells);
  projection.affordances.filter((entry) => entry.source === 'persistent_object').forEach((entry) => {
    entry.useSpot.objectCells.concat(entry.useSpot.approachCells).forEach((cell) => {
      assert.equal(roomCells.has(Habitats.cellKey(cell.x, cell.y)), true, `${entry.id} leaked outside its room.`);
    });
  });
  assert.equal(ObjectUse.validateProjection(world, projection).ok, true);
}

function testUnknownRoomReturnsNoProjection() {
  const world = newWorld('OBJECT-USE-UNKNOWN');
  assert.equal(ObjectUse.affordancesForRoom(world, world.player.homePropertyId, 'room_that_does_not_exist'), null);
}

const tests = [
  testSleepingObjectProducesGroundedSleepAffordance,
  testBathroomUtilityGroundsShowerWithoutInventedObject,
  testProjectionIsDeterministicAndReadOnly,
  testOtherOwnedObjectSignalsPermissionInsteadOfAssumingIt,
  testUseCellsStayInsideRoomGraph,
  testUnknownRoomReturnsNoProjection
];

for (const test of tests) test();
console.log(`PASS object-use affordance tests: ${tests.length}/${tests.length}`);
