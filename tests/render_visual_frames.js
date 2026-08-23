'use strict';

// QA-only raster capture. The shipped game itself has no package dependency.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas } = require('@napi-rs/canvas');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'tests', 'output_v0_11_3_visual_frames');

globalThis.document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; }
};

for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence', 'visuals', 'game', 'ui']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Visuals, UI } = globalThis.AXM;

function digest(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function capture(world, mode, timestamp, motion, filename) {
  world.ui.visualSceneMode = mode;
  const beforeDraw = Core.serializeWorld(world);
  const canvas = createCanvas(960, 560);
  UI.drawLivingCanvas(world, canvas, timestamp, motion);
  assert.equal(Core.serializeWorld(world), beforeDraw, `${mode} raster draw mutated authoritative world state.`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(OUTPUT, filename), buffer);
  return { filename, sha256: digest(buffer), bytes: buffer.length };
}

function worldWithGroundedActivity(actionId) {
  for (let index = 0; index < 40; index += 1) {
    const world = World.createWorld(`AXM-VISUAL-MOMENT-${actionId}-${index}`);
    Systems.updateNpcSchedules(world);
    Visuals.ensureUiState(world);
    world.ui.visualSceneMode = 'room';
    for (const room of Visuals.roomChoices(world)) {
      world.ui.selectedVisualRoomId = room.id;
      const activity = Visuals.sceneFor(world, 'room').activities.find((entry) => entry.id === actionId);
      if (activity) return { world, room, activity };
    }
  }
  throw new Error(`No deterministic grounded room found for ${actionId}.`);
}

function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const world = World.createWorld('AXM-VISUAL-FRAME-QA');
  Systems.updateNpcSchedules(world);
  Visuals.ensureUiState(world);
  const captures = [];

  for (const mode of ['room', 'building', 'street']) {
    const early = capture(world, mode, 800, 'full', `${mode}_0800.png`);
    const later = capture(world, mode, 2400, 'full', `${mode}_2400.png`);
    assert.notEqual(early.sha256, later.sha256, `${mode} full-motion frames were identical.`);
    captures.push(early, later);
  }

  const momentActions = ['sleep', 'shower', 'eat_home', 'play_pc', 'study_focus', 'creative_time', 'clean_home'];
  for (const actionId of momentActions) {
    const setup = worldWithGroundedActivity(actionId);
    setup.world.ui.pendingVisualActivity = {
      actionId,
      roomId: setup.room.id,
      objectId: setup.activity.objectId
    };
    const activityResult = Systems.performActivity(setup.world, actionId);
    assert.equal(activityResult.ok, true);
    assert.ok(activityResult.visualReceipt);
    assert.equal(activityResult.visualReceipt.observedEffects.effectsObserved, true);
    const momentEarly = capture(setup.world, 'room', 900, 'full', `room_${actionId}_0900.png`);
    const momentLater = capture(setup.world, 'room', 2600, 'full', `room_${actionId}_2600.png`);
    assert.notEqual(momentEarly.sha256, momentLater.sha256, `${actionId} completed-moment echo did not animate.`);
    captures.push(momentEarly, momentLater);
  }

  world.ui.visualSceneMode = 'room';
  world.ui.selectedVisualRoomId = Visuals.roomChoices(world).find((entry) => entry.purpose === 'sleep').id;
  const stillEarly = capture(world, 'room', 0, 'still', 'room_still_a.png');
  const stillLater = capture(world, 'room', 5000, 'still', 'room_still_b.png');
  assert.equal(stillEarly.sha256, stillLater.sha256, 'Still frames diverged.');
  captures.push(stillEarly, stillLater);

  const receipt = {
    schema: 'axm.visual-frame-qa/v1.2',
    seed: world.seed,
    result: 'PASS',
    claims: {
      fullMotionChangesPixels: true,
      completedMomentChangesPixels: true,
      completedMomentKinds: momentActions,
      stillModeStable: true,
      authoritativeWorldUnchanged: true
    },
    captures
  };
  fs.writeFileSync(path.join(OUTPUT, 'FRAME_DIGESTS.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log('PASS raster visual QA: ambient scenes and seven completed-moment kinds advance, still mode is stable, world state unchanged');
  console.log(JSON.stringify(receipt, null, 2));
}

main();
