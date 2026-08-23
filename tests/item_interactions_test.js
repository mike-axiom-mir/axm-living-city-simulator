'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of [
  'core', 'content', 'content_expansion', 'world', 'systems', 'item_interactions',
  'households', 'habitats', 'object_use', 'object_use_item_expansion', 'object_use_audit',
  'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells',
  'presence', 'visuals', 'item_visual_interactions'
]) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, Content, World, Systems, Habitats, Visuals, ObjectUse } = globalThis.AXM;

function newWorld(seed) {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  return world;
}

function clearHome(world) {
  const home = World.homeOf(world, 'player');
  home.furniture = [];
  return home;
}

function place(world, catalogId, ownerId = 'player', ownershipMode = 'personal') {
  const home = World.homeOf(world, 'player');
  const object = World.createFurnitureInstance(world, catalogId, ownerId, {
    ownershipMode,
    colorId: 'moss',
    condition: 100,
    sentimental: 1
  });
  assert.equal(World.addFurnitureToProperty(world, home, object), true, `${catalogId} should fit in the cleared test home.`);
  return object;
}

function roomFor(home, object) {
  const room = Habitats.roomAtCell(home, object.position.x, object.position.y);
  assert.ok(room, `${object.catalogId} should belong to a real room.`);
  return room;
}

function minuteStamp(world) {
  return (world.time.day - 1) * 1440 + world.time.hour * 60 + (world.time.minute || 0);
}

function testTvIsARealLeisureAction() {
  const world = newWorld('ITEM-TV-ACTION');
  clearHome(world);
  const tv = place(world, 'tv_screen');
  const beforeTime = minuteStamp(world);
  const beforeUsage = tv.usageHours;
  const result = Systems.performActivity(world, 'watch_tv');
  assert.equal(result.ok, true);
  assert.equal(minuteStamp(world) - beforeTime, 120);
  assert.equal(Core.round(tv.usageHours - beforeUsage, 2), 2);
  assert.equal(result.itemInteraction.objectId, tv.id);
  assert.equal(result.itemInteraction.catalogId, 'tv_screen');
  assert.equal(result.itemInteraction.noExtraReward, true);
}

function testTvIsRequiredAndOtherResidentOwnershipIsNotAssumed() {
  const missing = newWorld('ITEM-TV-MISSING');
  clearHome(missing);
  const before = minuteStamp(missing);
  const noTv = Systems.performActivity(missing, 'watch_tv');
  assert.equal(noTv.ok, false);
  assert.match(noTv.reason, /no usable tv/i);
  assert.equal(minuteStamp(missing), before);

  const sharedHome = newWorld('ITEM-TV-OTHER-OWNER');
  clearHome(sharedHome);
  const otherId = World.homeOf(sharedHome, 'player').tenants.find((id) => id !== 'player') || sharedHome.people[0].id;
  const otherTv = place(sharedHome, 'tv_screen', otherId, 'personal');
  sharedHome.ui.pendingVisualActivity = {
    actionId: 'watch_tv',
    roomId: roomFor(World.homeOf(sharedHome, 'player'), otherTv).id,
    objectId: otherTv.id
  };
  const denied = Systems.performActivity(sharedHome, 'watch_tv');
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /another resident/i);
}

function testExpandedLaptopCanActuallyPlay() {
  const world = newWorld('ITEM-LAPTOP-PLAY');
  clearHome(world);
  const laptop = place(world, 'refurbished_laptop');
  assert.equal(World.homeOf(world, 'player').furniture.some((object) => ['old_laptop', 'fast_computer'].includes(object.catalogId)), false);
  const beforeUsage = laptop.usageHours;
  const result = Systems.performActivity(world, 'play_device');
  assert.equal(result.ok, true, 'Expanded laptop should play without needing a hidden legacy computer.');
  assert.equal(Core.round(laptop.usageHours - beforeUsage, 2), 2);
  assert.equal(result.itemInteraction.catalogId, 'refurbished_laptop');
}

function testLegacyComputerPlayStillWorks() {
  const world = newWorld('ITEM-LEGACY-PC');
  const home = World.homeOf(world, 'player');
  const laptop = home.furniture.find((object) => object.ownerId === 'player' && object.catalogId === 'old_laptop');
  assert.ok(laptop);
  const beforeUsage = laptop.usageHours;
  const result = Systems.performActivity(world, 'play_pc');
  assert.equal(result.ok, true);
  assert.equal(Core.round(laptop.usageHours - beforeUsage, 2), 2, 'Legacy play behavior should remain unchanged.');
}

function testLivingViewShowsTvAsTvNotStudyComputer() {
  const world = newWorld('ITEM-TV-VISUAL');
  const home = clearHome(world);
  const tv = place(world, 'tv_screen');
  const room = roomFor(home, tv);
  const scene = {
    kind: 'room',
    placeId: home.id,
    purpose: room.purpose,
    utilities: { ...(room.utilityAccess || {}) },
    objects: Visuals.objectsInRoom(home, room)
  };
  const options = Visuals.roomActivityOptions(world, scene);
  const watch = options.find((entry) => entry.id === 'watch_tv' && entry.objectId === tv.id);
  assert.ok(watch, 'TV should expose Watch TV in Living View.');
  assert.equal(options.some((entry) => ['play_pc', 'play_device', 'study_focus'].includes(entry.id) && entry.objectId === tv.id), false, 'TV must not masquerade as a PC or study device.');
}

function testLaptopLivingViewCanPlayStudyAndCreate() {
  const world = newWorld('ITEM-LAPTOP-VISUAL');
  const home = clearHome(world);
  const laptop = place(world, 'refurbished_laptop');
  const room = roomFor(home, laptop);
  const scene = {
    kind: 'room',
    placeId: home.id,
    purpose: room.purpose,
    utilities: { ...(room.utilityAccess || {}) },
    objects: Visuals.objectsInRoom(home, room)
  };
  const options = Visuals.roomActivityOptions(world, scene);
  assert.ok(options.some((entry) => entry.id === 'play_device' && entry.objectId === laptop.id));
  assert.ok(options.some((entry) => entry.id === 'study_focus' && entry.objectId === laptop.id));
  assert.ok(options.some((entry) => entry.id === 'creative_time' && entry.objectId === laptop.id));
  assert.equal(options.some((entry) => entry.id === 'play_pc' && entry.objectId === laptop.id), false, 'Expanded laptop should not route through the legacy hardcoded PC gate.');
}

function testSelectedLaptopStudyRecordsRealObjectUseInReceipt() {
  const world = newWorld('ITEM-LAPTOP-STUDY-RECEIPT');
  const home = clearHome(world);
  const laptop = place(world, 'refurbished_laptop');
  const room = roomFor(home, laptop);
  const grounded = Visuals.groundedActivityForRoom(world, room.id, 'study_focus', laptop.id);
  assert.ok(grounded, 'The exact laptop should ground study before execution.');
  const beforeUsage = laptop.usageHours;
  world.ui.pendingVisualActivity = {
    actionId: 'study_focus',
    placeId: home.id,
    roomId: room.id,
    objectId: laptop.id
  };
  const result = Systems.performActivity(world, 'study_focus');
  assert.equal(result.ok, true);
  assert.equal(Core.round(laptop.usageHours - beforeUsage, 2), 2);
  assert.equal(result.visualReceipt?.objectId, laptop.id);
  assert.equal(result.visualReceipt?.observedEffects?.object?.usageHours, 2);
  assert.equal(result.visualReceipt?.itemInteraction?.noExtraReward, true);
}

function testObjectUseProjectionSeparatesTvAndLaptopCapabilities() {
  const world = newWorld('ITEM-OBJECT-USE-PROJECTION');
  const home = clearHome(world);
  const laptop = place(world, 'refurbished_laptop');
  const tv = place(world, 'tv_screen');
  const laptopRoom = roomFor(home, laptop);
  const tvRoom = roomFor(home, tv);
  const roomIds = new Set([laptopRoom.id, tvRoom.id]);
  const affordances = Array.from(roomIds).flatMap((roomId) => ObjectUse.affordancesForRoom(world, home.id, roomId).affordances);
  assert.ok(affordances.some((entry) => entry.actionId === 'play_device' && entry.objectId === laptop.id));
  assert.ok(affordances.some((entry) => entry.actionId === 'watch_tv' && entry.objectId === tv.id));
  assert.equal(affordances.some((entry) => entry.actionId === 'study_focus' && entry.objectId === tv.id), false);
}

const tests = [
  testTvIsARealLeisureAction,
  testTvIsRequiredAndOtherResidentOwnershipIsNotAssumed,
  testExpandedLaptopCanActuallyPlay,
  testLegacyComputerPlayStillWorks,
  testLivingViewShowsTvAsTvNotStudyComputer,
  testLaptopLivingViewCanPlayStudyAndCreate,
  testSelectedLaptopStudyRecordsRealObjectUseInReceipt,
  testObjectUseProjectionSeparatesTvAndLaptopCapabilities
];

for (const test of tests) test();
console.log(`PASS item interaction tests: ${tests.length}/${tests.length}`);
