'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { HeadlessSimulator } = require('../runtime/headless-simulator');
const SaveStore = require('../runtime/file-save-store');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

const simulator = HeadlessSimulator.create({ seed: 'AXM-CANONICAL-PROJECTION' });
const ordinarySave = simulator.serialize();
const canonical = simulator.serializeCanonical();
const projected = JSON.parse(canonical);
const expectedProjection = JSON.parse(ordinarySave);
delete expectedProjection.ui;

check(Object.hasOwn(JSON.parse(ordinarySave), 'ui'), 'ordinary save compatibility retains UI state');
check(!Object.hasOwn(projected, 'ui'), 'canonical projection excludes root UI realization state');
check(JSON.stringify(projected) === JSON.stringify(expectedProjection), 'canonical projection removes no other world fields');
check(projected.schema === simulator.world.schema, 'canonical projection retains the world schema');
check(projected.settings && projected.settings.casualRealism === true, 'simulation policy settings remain canonical');
check(simulator.serialize() === ordinarySave, 'projection does not mutate the live world or ordinary save');

const beforeUiChange = simulator.serializeCanonical();
simulator.world.ui.activeTab = 'home';
simulator.world.ui.selectedObjectId = 'display-only-selection';
simulator.world.ui.toast = { message: 'derived presentation', tone: 'info', nonce: 99 };
check(simulator.serializeCanonical() === beforeUiChange, 'UI-only changes do not change canonical bytes');

simulator.world.player.money -= 1;
check(simulator.serializeCanonical() !== beforeUiChange, 'simulation-state changes do change canonical bytes');

let ordinaryProjectionRejected = false;
try {
  HeadlessSimulator.fromText(beforeUiChange);
} catch (error) {
  ordinaryProjectionRejected = /Current save failed invariant validation/.test(String(error && error.message));
}
check(ordinaryProjectionRejected, 'canonical projection is not admitted as an ordinary current save');

const resumed = HeadlessSimulator.fromCanonicalText(beforeUiChange);
check(resumed.serializeCanonical() === beforeUiChange, 'canonical projection reconstructs through explicit projection rehydration');
check(resumed.world.ui && typeof resumed.world.ui === 'object', 'projection rehydration restores disposable UI defaults');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-living-city-canonical-'));
try {
  const input = path.join(tempRoot, 'world.json');
  SaveStore.writeNewSave(input, ordinarySave);
  const cli = spawnSync(process.execPath, [path.join(__dirname, '..', 'runtime', 'cli.js'), 'canonical', '--in', input], {
    encoding: 'utf8'
  });
  check(cli.status === 0, 'headless CLI emits a canonical projection');
  check(cli.stdout === canonical + '\n', 'headless CLI output is byte-identical to the API projection');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

process.stdout.write('Living City canonical world projection test passed: ' + checks + ' checks.\n');
