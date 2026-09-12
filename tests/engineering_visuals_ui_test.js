'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of [
  'core', 'content', 'content_expansion', 'world', 'systems', 'item_interactions',
  'households', 'habitats', 'object_use', 'object_use_item_expansion', 'object_use_audit',
  'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells',
  'presence', 'housing_pressure', 'historical_era', 'engineering_ewaste', 'engineering_visuals'
]) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, HistoricalEra, EngineeringEwaste, EngineeringVisuals } = globalThis.AXM;

function newWorld(seed) {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  return world;
}

function testVisualProjectionIsReadOnly() {
  const world = newWorld('ENGINEERING-VISUAL-READONLY');
  const state = EngineeringEwaste.ensureState(world);
  state.prototypes.push({
    id: 'prototype_visual_test',
    blueprintId: 'motor_bug',
    name: 'Motor Bug',
    kind: 'kinetic_prototype',
    builtYear: 2000,
    autonomous: false,
    scheduleAuthority: false,
    provenance: ['test provenance']
  });
  const before = Core.serializeWorld(world);
  const scene = EngineeringVisuals.sceneFor(world);
  assert.equal(EngineeringVisuals.validateScene(scene).ok, true);
  assert.equal(scene.prototypes.length, 1);
  assert.equal(scene.prototypes[0].autonomous, false);
  assert.equal(scene.prototypes[0].scheduleAuthority, false);
  assert.equal(scene.visualOnly, true);
  assert.equal(scene.noRewardAuthority, true);
  assert.equal(scene.noWorldMutation, true);
  assert.equal(Core.serializeWorld(world), before, 'Projecting an engineering scene must not mutate world state.');
}

function testPrototypeMotionIsBoundedAndDeterministic() {
  const crawler = { blueprintId: 'mini_scrap_crawler' };
  const a = EngineeringVisuals.motionForPrototype(crawler, 12345, 1);
  const b = EngineeringVisuals.motionForPrototype(crawler, 12345, 1);
  assert.deepEqual(a, b);
  assert.ok(Math.abs(a.x) <= 72.0001, 'Crawler display path must remain bounded.');
  assert.ok(Math.abs(a.y) <= 2.0001, 'Crawler vertical presentation jitter must remain bounded.');

  const bug = EngineeringVisuals.motionForPrototype({ blueprintId: 'motor_bug' }, 9876, 1);
  assert.ok(Math.abs(bug.x) <= 3.2001, 'Motor Bug jitter must remain small and bounded.');
  assert.ok(Math.abs(bug.y) <= 1.2001);

  const still = EngineeringVisuals.motionForPrototype(crawler, 12345, 0);
  assert.deepEqual(still, { x: 0, y: 0, rotation: 0, light: 0.58 });
}

function testVisualSceneRejectsAutonomyClaims() {
  const world = newWorld('ENGINEERING-VISUAL-AUTONOMY-GATE');
  const state = EngineeringEwaste.ensureState(world);
  state.prototypes.push({
    id: 'bad_claim',
    blueprintId: 'mini_scrap_crawler',
    name: 'Bad Claim',
    kind: 'miniature_robotica',
    builtYear: 2015,
    autonomous: true,
    scheduleAuthority: false,
    provenance: []
  });
  const scene = EngineeringVisuals.sceneFor(world);
  const validation = EngineeringVisuals.validateScene(scene);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(' '), /autonomy/i);
}

function testUnknownFutureEngineeringSchemaIsHeldReadOnly() {
  const world = newWorld('ENGINEERING-VISUAL-FUTURE');
  world.engineeringEwaste = { schema: 'axm.living-city.engineering-ewaste/v99-future', sentinel: { keep: 'exactly' } };
  const before = Core.serializeWorld(world);
  const scene = EngineeringVisuals.sceneFor(world);
  assert.equal(scene.kind, 'held');
  assert.match(scene.reason, /unrecognized state schema/i);
  assert.equal(scene.prototypes.length, 0);
  assert.equal(Core.serializeWorld(world), before, 'Unknown future engineering state must survive visual inspection byte-for-byte.');
}

function testPrototypeHistorySurvivesIntoVisualProjection() {
  const world = newWorld('ENGINEERING-VISUAL-PROVENANCE');
  world.time.day = HistoricalEra.dayForYear(2015);
  world.player.skills.engineering = 3;
  const home = World.homeOf(world, 'player');
  home.furniture.push(World.createFurnitureInstance(world, 'workbench', 'player', { condition: 95 }));
  const state = EngineeringEwaste.ensureState(world);
  Object.assign(state.components, { wire: 2, motor: 2, board: 1, sensor: 1, casing: 1 });
  const built = EngineeringEwaste.buildPrototype(world, 'mini_scrap_crawler');
  assert.equal(built.ok, true);
  const scene = EngineeringVisuals.sceneFor(world);
  const projected = scene.prototypes.find((entry) => entry.id === built.prototype.id);
  assert.ok(projected);
  assert.equal(projected.builtYear, built.prototype.builtYear);
  assert.deepEqual(projected.provenance, built.prototype.provenance);
}

function testBrowserAndStandaloneWiringStayModular() {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const builder = fs.readFileSync(path.join(ROOT, 'tools', 'build_standalone.py'), 'utf8');
  const ui = fs.readFileSync(path.join(ROOT, 'src', 'engineering_ui.js'), 'utf8');

  assert.ok(index.includes('src/engineering_visuals.js'));
  assert.ok(index.includes('src/engineering_ui.js'));
  assert.ok(index.indexOf('src/engineering_ewaste.js') < index.indexOf('src/engineering_visuals.js'));
  assert.ok(index.indexOf('src/ui.js') < index.indexOf('src/engineering_ui.js'));
  assert.ok(builder.includes("'src/engineering_visuals.js'"));
  assert.ok(builder.includes("'src/engineering_ui.js'"));
  assert.equal(ui.includes('EngineeringEwaste.ensureState('), false, 'Opening/rendering the Engineering tab must not initialize state by inspection.');
  assert.ok(ui.includes("Game.invoke('collectEwaste')"));
  assert.ok(ui.includes("Game.invoke('inspectEwaste', id)"));
  assert.ok(ui.includes("Game.invoke('refurbishEwaste', id)"));
  assert.ok(ui.includes("Game.invoke('salvageEwaste', id)"));
  assert.ok(ui.includes("Game.invoke('sellRefurbished', id)"));
  assert.ok(ui.includes("Game.invoke('buildPrototype', id)"));
}

const tests = [
  testVisualProjectionIsReadOnly,
  testPrototypeMotionIsBoundedAndDeterministic,
  testVisualSceneRejectsAutonomyClaims,
  testUnknownFutureEngineeringSchemaIsHeldReadOnly,
  testPrototypeHistorySurvivesIntoVisualProjection,
  testBrowserAndStandaloneWiringStayModular
];

for (const test of tests) test();
console.log(`PASS engineering visual/UI tests: ${tests.length}/${tests.length}`);
