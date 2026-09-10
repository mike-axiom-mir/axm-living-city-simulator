'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
globalThis.document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; }
};
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence', 'visuals', 'game', 'ui']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Presence, Visuals, UI } = globalThis.AXM;

function newWorld(seed = 'AXM-PLAYABLE-INTERIORS-TEST') {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  Visuals.ensureUiState(world);
  return world;
}

function withoutVisualReceipt(world) {
  const clone = Core.deepClone(world);
  delete clone.ui.pendingVisualActivity;
  delete clone.ui.lastVisualActivityReceipt;
  delete clone.ui.selectedVisualRoomId;
  delete clone.ui.selectedVisualObjectId;
  return clone;
}

function sleepOption(world) {
  world.ui.visualSceneMode = 'room';
  const room = Visuals.roomChoices(world).find((entry) => entry.purpose === 'sleep');
  assert.ok(room, 'The starting home needs a sleeping room.');
  world.ui.selectedVisualRoomId = room.id;
  const scene = Visuals.sceneFor(world, 'room');
  const activity = scene.activities.find((entry) => entry.id === 'sleep');
  assert.ok(activity, 'A real bed should ground the sleep quick action.');
  return { room, scene, activity };
}

function testNewWorldStartsInsidePlayableLivingView() {
  const world = newWorld('INTERIOR-START');
  assert.equal(world.ui.toast, null, 'Background town setup must not announce an NPC direction as player feedback.');
  assert.equal(world.ui.activeTab, 'visuals');
  assert.equal(world.ui.visualSceneMode, 'room');
  const scene = Visuals.sceneFor(world);
  assert.equal(scene.kind, 'room');
  assert.ok(scene.rooms.length >= 3);
  assert.ok(scene.activities.length >= 1);
  assert.equal(Visuals.validateScene(scene).ok, true);
}

function testRoomBrowserNeverInventsCurrentPresence() {
  const world = newWorld('INTERIOR-ROOM-BROWSER');
  const current = Presence.presenceFor(world, 'player');
  const other = Visuals.roomChoices(world).find((entry) => entry.id !== current.roomId);
  assert.ok(other);
  world.ui.visualSceneMode = 'room';
  world.ui.selectedVisualRoomId = other.id;
  const scene = Visuals.sceneFor(world, 'room');
  assert.equal(scene.roomId, other.id);
  assert.equal(scene.currentPresence, false);
  assert.equal(scene.actors.length, 0);
  assert.match(scene.subtitle, /not current presence/i);
}

function testQuickChoicesAreGroundedInRoomOrObjectState() {
  const world = newWorld('INTERIOR-GROUNDED-CHOICES');
  const { scene } = sleepOption(world);
  assert.ok(scene.objects.some((object) => object.kind === 'bed'));
  assert.ok(scene.activities.some((activity) => activity.id === 'sleep' && activity.objectId));

  const bathroom = Visuals.roomChoices(world).find((entry) => entry.purpose === 'bathroom');
  assert.ok(bathroom?.utilities.water);
  world.ui.selectedVisualRoomId = bathroom.id;
  const bathroomScene = Visuals.sceneFor(world, 'room');
  assert.ok(bathroomScene.activities.some((activity) => activity.id === 'shower'));
  assert.equal(bathroomScene.activities.some((activity) => ['eat_home', 'play_pc', 'study_focus', 'creative_time'].includes(activity.id)), false);

  const living = Visuals.roomChoices(world).find((entry) => entry.purpose === 'living');
  world.ui.selectedVisualRoomId = living.id;
  const livingScene = Visuals.sceneFor(world, 'room');
  assert.ok(livingScene.activities.some((activity) => activity.id === 'eat_home'));
}

function testCompletedEchoRequiresARealCompletedActivity() {
  const world = newWorld('INTERIOR-REAL-RECEIPT');
  const { room, activity } = sleepOption(world);
  assert.equal(world.ui.lastVisualActivityReceipt, null);
  world.ui.pendingVisualActivity = { actionId: activity.id, roomId: room.id, objectId: activity.objectId };
  const result = Systems.performActivity(world, activity.id);
  assert.equal(result.ok, true, result.reason);
  assert.ok(result.visualReceipt);
  assert.equal(result.visualReceipt.source, 'completed_activity');
  assert.equal(result.visualReceipt.noExtraReward, true);
  assert.equal(result.visualReceipt.notCurrentPresence, true);
  assert.equal(result.visualReceipt.objectId, activity.objectId);
  assert.equal(result.visualReceipt.observedEffects.effectsObserved, true);
  assert.equal(result.visualReceipt.observedEffects.noAddedEffect, true);
  assert.equal(result.visualReceipt.observedEffects.effectScope, 'player_and_selected_home_context');
  assert.equal(result.visualReceipt.observedEffects.timeMinutes, 480);
  assert.ok(Object.keys(result.visualReceipt.observedEffects.needs).length >= 1);
  const scene = Visuals.sceneFor(world, 'room');
  assert.equal(scene.recentMoment.actionId, 'sleep');
  assert.equal(Visuals.validateScene(scene).ok, true);
}

function testQuickActivityHasExactGameplayParity() {
  const direct = newWorld('INTERIOR-ACTIVITY-PARITY');
  const visual = newWorld('INTERIOR-ACTIVITY-PARITY');
  const { room, activity } = sleepOption(visual);
  const directResult = Systems.performActivity(direct, activity.id);
  visual.ui.pendingVisualActivity = { actionId: activity.id, roomId: room.id, objectId: activity.objectId };
  const visualResult = Systems.performActivity(visual, activity.id);
  assert.equal(directResult.ok, true);
  assert.equal(visualResult.ok, true);
  assert.deepEqual(withoutVisualReceipt(visual), withoutVisualReceipt(direct));
}

function testInvalidRoomCannotCreateAVisualReceipt() {
  const world = newWorld('INTERIOR-INVALID-RECEIPT');
  world.ui.pendingVisualActivity = { actionId: 'sleep', roomId: 'room_that_does_not_exist', objectId: null };
  const result = Systems.performActivity(world, 'sleep');
  assert.equal(result.ok, true);
  assert.equal(result.visualReceipt, null);
  assert.equal(world.ui.lastVisualActivityReceipt, null);

  const bathroom = Visuals.roomChoices(world).find((entry) => entry.purpose === 'bathroom');
  world.ui.pendingVisualActivity = { actionId: 'sleep', roomId: bathroom.id, objectId: null };
  const ungrounded = Systems.performActivity(world, 'sleep');
  assert.equal(ungrounded.ok, true);
  assert.equal(ungrounded.visualReceipt, null);
  assert.equal(world.ui.lastVisualActivityReceipt, null);
}

function testObjectFocusIsPresentationOnly() {
  const world = newWorld('INTERIOR-OBJECT-FOCUS');
  const { scene } = sleepOption(world);
  const object = scene.objects[0];
  const before = Core.serializeWorld(world);
  world.ui.selectedVisualObjectId = object.id;
  const focused = Visuals.sceneFor(world, 'room');
  assert.equal(focused.selectedObjectId, object.id);
  assert.equal(Visuals.validateScene(focused).ok, true);
  const after = Core.parseWorld(Core.serializeWorld(world));
  const beforeWorld = Core.parseWorld(before);
  delete after.ui.selectedVisualObjectId;
  delete beforeWorld.ui.selectedVisualObjectId;
  assert.deepEqual(after, beforeWorld);
}

function testPatchMigrationAddsNewUiDefaultsWithoutHistory() {
  const world = newWorld('INTERIOR-PATCH-MIGRATION');
  world.version = '0.11.1';
  const existingRoomSelection = world.ui.selectedRoomId = World.homeOf(world, 'player').habitat.rooms[0].id;
  delete world.ui.selectedVisualRoomId;
  delete world.ui.selectedVisualObjectId;
  delete world.ui.pendingVisualActivity;
  delete world.ui.lastVisualActivityReceipt;
  const migrated = Systems.migrateWorld(world);
  assert.equal(migrated.version, '0.11.3');
  assert.equal(migrated.ui.selectedRoomId, existingRoomSelection);
  assert.equal(migrated.ui.selectedVisualRoomId, null);
  assert.equal(migrated.ui.lastVisualActivityReceipt, null);
  assert.equal(Systems.validateWorld(migrated).ok, true);
}

function testLivingViewMarkupExposesRoomPlayWithoutRewardPressure() {
  const world = newWorld('INTERIOR-MARKUP');
  const { room, activity } = sleepOption(world);
  world.ui.pendingVisualActivity = { actionId: activity.id, roomId: room.id, objectId: activity.objectId };
  assert.equal(Systems.performActivity(world, activity.id).ok, true);
  const html = UI.renderLivingVisuals(world);
  assert.match(html, /Browse your home rooms/i);
  assert.match(html, /Things to do here/);
  assert.match(html, /data-action="visual-room"/);
  assert.match(html, /data-action="visual-activity"/);
  assert.match(html, /Focus a real object/);
  assert.match(html, /What actually changed/);
  assert.match(html, /Factual receipt/);
  assert.match(html, /class="visual-action-pulse recorded" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(html, /Ordinary engine result; watching added nothing/);
  assert.match(html, /Open in Build &amp; Home/);
  assert.match(html, /adds no bonus/i);
  assert.doesNotMatch(html, /daily streak/i);
}

function testLivingViewKeepsReadyFeedbackBesideTheAction() {
  const world = newWorld('INTERIOR-ACTION-PULSE-READY');
  sleepOption(world);
  const html = UI.renderLivingVisuals(world);
  assert.match(html, /class="visual-action-pulse ready" role="status"/);
  assert.match(html, /Choose a grounded activity\. Its exact result will stay here beside the same controls\./);
}

const tests = [
  testNewWorldStartsInsidePlayableLivingView,
  testRoomBrowserNeverInventsCurrentPresence,
  testQuickChoicesAreGroundedInRoomOrObjectState,
  testCompletedEchoRequiresARealCompletedActivity,
  testQuickActivityHasExactGameplayParity,
  testInvalidRoomCannotCreateAVisualReceipt,
  testObjectFocusIsPresentationOnly,
  testPatchMigrationAddsNewUiDefaultsWithoutHistory,
  testLivingViewMarkupExposesRoomPlayWithoutRewardPressure,
  testLivingViewKeepsReadyFeedbackBesideTheAction
];

for (const test of tests) test();
console.log(`PASS playable interiors tests: ${tests.length}/${tests.length}`);
