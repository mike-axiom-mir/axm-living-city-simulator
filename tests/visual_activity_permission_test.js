'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { loadSimulation } = require('../runtime/load-simulation');

const axm = loadSimulation();
require(path.join(__dirname, '..', 'src', 'visuals.js'));
const { World, Systems, Visuals, ItemInteractions, Habitats } = axm;

const world = World.createWorld('AXM-VISUAL-PERMISSION-ALIGNMENT');
Systems.updateNpcSchedules(world);
Visuals.ensureUiState(world);
Systems.advanceHours(world, 24);

const home = World.homeOf(world, 'player');
let sleepOptions = 0;
let personalForeignBeds = 0;
for (const room of home.habitat.rooms.filter((entry) => entry.purpose === 'sleep')) {
  world.ui.visualSceneMode = 'room';
  world.ui.selectedVisualRoomId = room.id;
  const scene = Visuals.sceneFor(world, 'room');
  const rawObjects = home.furniture.filter((object) => Habitats.roomAtCell(home, object.position?.x, object.position?.y)?.id === room.id);
  personalForeignBeds += rawObjects.filter((object) => /bed|mattress/.test(object.catalogId) && object.ownerId !== 'player' && object.ownershipMode !== 'property_fixture').length;
  const sleep = scene.activities.find((entry) => entry.id === 'sleep') || null;
  if (!sleep) continue;
  sleepOptions += 1;
  assert.ok(sleep.objectId, 'Sleep quick action must bind a concrete permitted bed/mattress.');
  const object = home.furniture.find((entry) => entry.id === sleep.objectId);
  assert.ok(object, 'Visual Sleep object must exist in the selected home.');
  assert.equal(Habitats.roomAtCell(home, object.position?.x, object.position?.y)?.id, room.id, 'Visual Sleep object must belong to the selected room.');
  assert.equal(ItemInteractions.objectMatchesAction(object, 'sleep'), true, 'Visual Sleep object must satisfy the item-action catalogue.');
  assert.equal(ItemInteractions.directUseAllowed(object), true, 'Visual Sleep object must pass the existing player-use permission rule.');
  const request = { actionId: 'sleep', roomId: room.id, objectId: sleep.objectId };
  const resolved = ItemInteractions.resolveActionObject(world, 'sleep', request);
  assert.equal(resolved.reason, null, 'Advertised Sleep quick action must be admitted by Item Interactions.');
  assert.equal(resolved.object?.id, sleep.objectId);
}

assert.ok(personalForeignBeds > 0, 'Regression seed should include at least one other resident personal bed.');
assert.ok(sleepOptions > 0, 'At least one lawful grounded Sleep option should remain available.');
console.log(`PASS visual activity permission alignment: ${sleepOptions} lawful Sleep option(s), ${personalForeignBeds} foreign personal bed(s) excluded`);
