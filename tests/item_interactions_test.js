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

const { Core, World, Systems, Habitats, Visuals, ObjectUse } = globalThis.AXM;

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

function sceneFor(world, object) {
  const home = World.homeOf(world, 'player');
  const room = roomFor(home, object);
  return {
    room,
    scene: {
      kind: 'room',
      placeId: home.id,
      purpose: room.purpose,
      utilities: { ...(room.utilityAccess || {}) },
      objects: Visuals.objectsInRoom(home, room)
    }
  };
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
  assert.equal(result.ok, true);
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
  assert.equal(Core.round(laptop.usageHours - beforeUsage, 2), 2);
}

function testLivingViewShowsTvAsTvNotStudyComputer() {
  const world = newWorld('ITEM-TV-VISUAL');
  const home = clearHome(world);
  const tv = place(world, 'tv_screen');
  const { scene } = sceneFor(world, tv);
  const options = Visuals.roomActivityOptions(world, scene);
  assert.ok(options.some((entry) => entry.id === 'watch_tv' && entry.objectId === tv.id));
  assert.equal(options.some((entry) => ['play_pc', 'play_device', 'study_focus'].includes(entry.id) && entry.objectId === tv.id), false);
  assert.equal(home.id, scene.placeId);
}

function testLaptopLivingViewCanPlayStudyAndCreate() {
  const world = newWorld('ITEM-LAPTOP-VISUAL');
  clearHome(world);
  const laptop = place(world, 'refurbished_laptop');
  const { scene } = sceneFor(world, laptop);
  const options = Visuals.roomActivityOptions(world, scene);
  assert.ok(options.some((entry) => entry.id === 'play_device' && entry.objectId === laptop.id));
  assert.ok(options.some((entry) => entry.id === 'study_focus' && entry.objectId === laptop.id));
  assert.ok(options.some((entry) => entry.id === 'creative_time' && entry.objectId === laptop.id));
  assert.equal(options.some((entry) => entry.id === 'play_pc' && entry.objectId === laptop.id), false);
}

function testSelectedLaptopStudyRecordsRealObjectUseInReceipt() {
  const world = newWorld('ITEM-LAPTOP-STUDY-RECEIPT');
  const home = clearHome(world);
  const laptop = place(world, 'refurbished_laptop');
  const room = roomFor(home, laptop);
  assert.ok(Visuals.groundedActivityForRoom(world, room.id, 'study_focus', laptop.id));
  const beforeUsage = laptop.usageHours;
  world.ui.pendingVisualActivity = { actionId: 'study_focus', placeId: home.id, roomId: room.id, objectId: laptop.id };
  const result = Systems.performActivity(world, 'study_focus');
  assert.equal(result.ok, true);
  assert.equal(Core.round(laptop.usageHours - beforeUsage, 2), 2);
  assert.equal(result.visualReceipt?.objectId, laptop.id);
  assert.equal(result.visualReceipt?.observedEffects?.object?.usageHours, 2);
}

function testSeatIsUsableRestFurniture() {
  const world = newWorld('ITEM-SEAT-RELAX');
  clearHome(world);
  const chair = place(world, 'patched_armchair');
  const beforeTime = minuteStamp(world);
  const beforeUsage = chair.usageHours;
  const result = Systems.performActivity(world, 'relax_seated');
  assert.equal(result.ok, true);
  assert.equal(minuteStamp(world) - beforeTime, 60);
  assert.equal(Core.round(chair.usageHours - beforeUsage, 2), 1);
}

function testOptionalHouseholdObjectsHaveRealActions() {
  const cases = [
    ['read_books', 'book_shelf'],
    ['listen_music', 'record_music_player'],
    ['read_by_lamp', 'desk_lamp'],
    ['care_plant', 'large_plant'],
    ['organize_storage', 'drawer_crate']
  ];
  cases.forEach(([actionId, catalogId], index) => {
    const world = newWorld(`ITEM-HOUSEHOLD-${index}`);
    clearHome(world);
    const object = place(world, catalogId);
    const before = object.usageHours;
    const result = Systems.performActivity(world, actionId);
    assert.equal(result.ok, true, `${catalogId} should support ${actionId}.`);
    assert.equal(Core.round(object.usageHours - before, 2), 1);
    assert.equal(result.itemInteraction.objectId, object.id);
  });
}

function testKitchenAndBedRecordExactSelectedUse() {
  const mealWorld = newWorld('ITEM-KITCHEN-USE');
  const mealHome = clearHome(mealWorld);
  const stove = place(mealWorld, 'induction_stove');
  const mealRoom = roomFor(mealHome, stove);
  mealWorld.ui.pendingVisualActivity = { actionId: 'eat_home', placeId: mealHome.id, roomId: mealRoom.id, objectId: stove.id };
  const mealBefore = stove.usageHours;
  const meal = Systems.performActivity(mealWorld, 'eat_home');
  assert.equal(meal.ok, true);
  assert.equal(Core.round(stove.usageHours - mealBefore, 2), 1);
  assert.equal(meal.itemInteraction.objectId, stove.id);

  const sleepWorld = newWorld('ITEM-BED-USE');
  const sleepHome = clearHome(sleepWorld);
  const bed = place(sleepWorld, 'double_bed');
  const sleepRoom = roomFor(sleepHome, bed);
  sleepWorld.ui.pendingVisualActivity = { actionId: 'sleep', placeId: sleepHome.id, roomId: sleepRoom.id, objectId: bed.id };
  const bedBefore = bed.usageHours;
  const sleep = Systems.performActivity(sleepWorld, 'sleep');
  assert.equal(sleep.ok, true);
  assert.equal(Core.round(bed.usageHours - bedBefore, 2), 8);
  assert.equal(sleep.itemInteraction.objectId, bed.id);
}

function testHomeWorkbenchRepairActuallyStaysHome() {
  const world = newWorld('ITEM-HOME-BENCH');
  const home = clearHome(world);
  const bench = place(world, 'maker_workbench');
  const beforeRepair = world.player.skills.repair;
  const beforeUsage = bench.usageHours;
  const result = Systems.performActivity(world, 'repair_at_bench');
  assert.equal(result.ok, true);
  assert.equal(world.player.locationId, home.id, 'Home bench repair should not route to the public workshop.');
  assert.ok(world.player.skills.repair > beforeRepair);
  assert.equal(Core.round(bench.usageHours - beforeUsage, 2), 2);
}

function testLivingViewSurfacesBroaderExactObjectActions() {
  const cases = [
    ['relax_seated', 'reading_chair'],
    ['read_books', 'book_shelf'],
    ['listen_music', 'record_music_player'],
    ['read_by_lamp', 'desk_lamp'],
    ['care_plant', 'large_plant'],
    ['organize_storage', 'drawer_crate'],
    ['repair_at_bench', 'maker_workbench']
  ];
  cases.forEach(([actionId, catalogId], index) => {
    const world = newWorld(`ITEM-VISUAL-HOUSEHOLD-${index}`);
    clearHome(world);
    const object = place(world, catalogId);
    const { scene } = sceneFor(world, object);
    const options = Visuals.roomActivityOptions(world, scene);
    assert.ok(options.some((entry) => entry.id === actionId && entry.objectId === object.id), `${catalogId} should surface ${actionId}.`);
  });
}

function testOtherResidentsPersonalSeatIsNotSilentlyOffered() {
  const world = newWorld('ITEM-OTHER-SEAT');
  const home = clearHome(world);
  const otherId = home.tenants.find((id) => id !== 'player') || world.people[0].id;
  const chair = place(world, 'patched_armchair', otherId, 'personal');
  const { scene } = sceneFor(world, chair);
  const options = Visuals.roomActivityOptions(world, scene);
  assert.equal(options.some((entry) => entry.id === 'relax_seated' && entry.objectId === chair.id), false);
  const direct = Systems.performActivity(world, 'relax_seated');
  assert.equal(direct.ok, false);
  assert.match(direct.reason, /no usable chair/i);
}

function testObjectUseProjectionSeparatesCapabilitiesAndHomeRepair() {
  const world = newWorld('ITEM-OBJECT-USE-PROJECTION');
  const home = clearHome(world);
  const laptop = place(world, 'refurbished_laptop');
  const tv = place(world, 'tv_screen');
  const bench = place(world, 'workbench');
  const roomIds = new Set([roomFor(home, laptop).id, roomFor(home, tv).id, roomFor(home, bench).id]);
  const affordances = Array.from(roomIds).flatMap((roomId) => ObjectUse.affordancesForRoom(world, home.id, roomId).affordances);
  assert.ok(affordances.some((entry) => entry.actionId === 'play_device' && entry.objectId === laptop.id));
  assert.ok(affordances.some((entry) => entry.actionId === 'watch_tv' && entry.objectId === tv.id));
  assert.equal(affordances.some((entry) => entry.actionId === 'study_focus' && entry.objectId === tv.id), false);
  assert.ok(affordances.some((entry) => entry.actionId === 'repair_at_bench' && entry.objectId === bench.id));
  assert.equal(affordances.some((entry) => entry.actionId === 'practice_repair' && entry.objectId === bench.id), false);
}

const tests = [
  testTvIsARealLeisureAction,
  testTvIsRequiredAndOtherResidentOwnershipIsNotAssumed,
  testExpandedLaptopCanActuallyPlay,
  testLegacyComputerPlayStillWorks,
  testLivingViewShowsTvAsTvNotStudyComputer,
  testLaptopLivingViewCanPlayStudyAndCreate,
  testSelectedLaptopStudyRecordsRealObjectUseInReceipt,
  testSeatIsUsableRestFurniture,
  testOptionalHouseholdObjectsHaveRealActions,
  testKitchenAndBedRecordExactSelectedUse,
  testHomeWorkbenchRepairActuallyStaysHome,
  testLivingViewSurfacesBroaderExactObjectActions,
  testOtherResidentsPersonalSeatIsNotSilentlyOffered,
  testObjectUseProjectionSeparatesCapabilitiesAndHomeRepair
];

for (const test of tests) test();
console.log(`PASS item interaction tests: ${tests.length}/${tests.length}`);
