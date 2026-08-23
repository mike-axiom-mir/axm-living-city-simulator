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

function newWorld(seed = 'AXM-VISUAL-PRESENCE-TEST') {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  Visuals.ensureUiState(world);
  return world;
}

function testRoomSceneUsesPersistentObjectsAndLawfulActors() {
  const world = newWorld('VISUAL-ROOM');
  const current = Presence.presenceFor(world, 'player');
  assert.equal(current.kind, 'room');
  const scene = Visuals.sceneFor(world, 'room');
  assert.equal(scene.kind, 'room');
  assert.equal(scene.currentPresence, true);
  assert.ok(scene.objects.length > 0);
  assert.ok(scene.actors.some((actor) => actor.id === 'player'));
  assert.equal(scene.actors.every((actor) => actor.exact === true), true);
  assert.equal(scene.noAuthority, true);
  assert.equal(scene.noReward, true);
  assert.equal(Visuals.validateScene(scene).ok, true);
}

function testVisualDerivationDoesNotMutateWorldOrRng() {
  const world = newWorld('VISUAL-NO-MUTATION');
  const before = Core.serializeWorld(world);
  const beforeRng = world.rngState;
  for (const mode of Visuals.MODES) {
    const scene = Visuals.sceneFor(world, mode);
    assert.equal(Visuals.validateScene(scene).ok, true);
  }
  assert.equal(world.rngState, beforeRng);
  assert.equal(Core.serializeWorld(world), before);
}

function testBuildingSceneNeverPlacesPrivateResidents() {
  const world = newWorld('VISUAL-BUILDING');
  const scene = Visuals.sceneFor(world, 'building');
  assert.equal(scene.kind, 'building');
  assert.equal(scene.noPrivateRoomTracking, true);
  assert.ok(scene.coarseOccupants >= 1);
  assert.equal(Object.hasOwn(scene, 'residentRoomIds'), false);
  assert.equal(Object.hasOwn(scene, 'actors'), false);
  assert.equal(Visuals.validateScene(scene).ok, true);
}

function testStreetSceneUsesPublicEvidenceOnly() {
  const world = newWorld('VISUAL-STREET');
  const scene = Visuals.sceneFor(world, 'street');
  assert.equal(scene.kind, 'street');
  assert.ok(scene.address);
  assert.equal(scene.noAuthority, true);
  assert.equal(scene.noReward, true);
  assert.equal(Object.hasOwn(scene, 'privateRoomId'), false);
}

function testRoomFallbackDoesNotInventPresence() {
  const world = newWorld('VISUAL-ROOM-FALLBACK');
  Systems.startIndoorDeparture(world, 'compressed');
  assert.equal(Presence.presenceFor(world, 'player').kind, 'street_threshold');
  const scene = Visuals.sceneFor(world, 'room');
  assert.equal(scene.kind, 'room');
  assert.equal(scene.currentPresence, false);
  assert.equal(scene.actors.length, 0);
  assert.match(scene.subtitle, /not current presence/i);
}

function testAutoModeFollowsBoundedPresence() {
  const world = newWorld('VISUAL-AUTO');
  assert.equal(Visuals.sceneFor(world, 'auto').kind, 'room');
  const result = Systems.startIndoorDeparture(world, 'visible');
  assert.equal(result.ok, true, result.reason);
  assert.equal(Visuals.sceneFor(world, 'auto').kind, 'building');
  Systems.finishIndoorMovementCompressed(world);
  assert.equal(Visuals.sceneFor(world, 'auto').kind, 'street');
}

function testMotionPolicyRespectsBothUserAndDevice() {
  const world = newWorld('VISUAL-MOTION');
  world.settings.visualMotion = 'gentle';
  world.settings.reducedMotion = false;
  assert.equal(Visuals.motionLevel(world, false), 'gentle');
  assert.equal(Visuals.motionLevel(world, true), 'still');
  world.settings.reducedMotion = true;
  assert.equal(Visuals.motionLevel(world, false), 'still');
}

function testPatchMigrationPreservesSchemaAndAddsOnlyUiDefaults() {
  const world = newWorld('VISUAL-PATCH-MIGRATION');
  world.version = '0.11.0';
  delete world.settings.visualMotion;
  delete world.ui.visualSceneMode;
  const beforeObjects = JSON.stringify(world.places.map((place) => (place.furniture || []).map((object) => object.id)));
  const migrated = Systems.migrateWorld(world);
  assert.equal(migrated.schema, 'axm.living-city-sim.world/v0.11.0');
  assert.equal(migrated.version, '0.11.3');
  assert.equal(migrated.settings.visualMotion, 'full');
  assert.equal(migrated.ui.visualSceneMode, 'auto');
  assert.equal(JSON.stringify(migrated.places.map((place) => (place.furniture || []).map((object) => object.id))), beforeObjects);
  assert.equal(Systems.validateWorld(migrated).ok, true);
}

function testLivingViewMarkupExposesTruthAndMotionControls() {
  const world = newWorld('VISUAL-MARKUP');
  const html = UI.renderLivingVisuals(world);
  assert.match(html, /id="livingCanvas"/);
  assert.match(html, /Truth boundary intact/);
  assert.match(html, /Playable room choices/);
  assert.match(html, /data-action="visual-scene"/);
  assert.match(html, /data-action="visual-motion"/);
  assert.match(html, /No animation gate/);
}

const tests = [
  testRoomSceneUsesPersistentObjectsAndLawfulActors,
  testVisualDerivationDoesNotMutateWorldOrRng,
  testBuildingSceneNeverPlacesPrivateResidents,
  testStreetSceneUsesPublicEvidenceOnly,
  testRoomFallbackDoesNotInventPresence,
  testAutoModeFollowsBoundedPresence,
  testMotionPolicyRespectsBothUserAndDevice,
  testPatchMigrationPreservesSchemaAndAddsOnlyUiDefaults,
  testLivingViewMarkupExposesTruthAndMotionControls
];

for (const test of tests) test();
console.log(`PASS visual presence tests: ${tests.length}/${tests.length}`);
