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

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-living-city-headless-'));

try {
  const first = HeadlessSimulator.create({ seed: 'AXM-HEADLESS-INTAKE' });
  const second = HeadlessSimulator.create({ seed: 'AXM-HEADLESS-INTAKE' });
  check(first.validate().ok, 'headless world validates without a browser');
  check(first.serialize() === second.serialize(), 'same seed produces byte-identical serialized worlds');
  check(typeof globalThis.window === 'undefined', 'runtime does not require or create window');
  check(typeof globalThis.document === 'undefined', 'runtime does not require or create document');
  check(typeof globalThis.localStorage === 'undefined', 'runtime does not require or create localStorage');

  const headlessHome = first.axm.World.homeOf(first.world, 'player');
  const headlessRoom = headlessHome?.habitat?.rooms?.find((entry) => entry.purpose === 'sleep') || headlessHome?.habitat?.rooms?.[0];
  const beforeProjection = first.serialize();
  const affordances = headlessHome && headlessRoom
    ? first.axm.ObjectUse.affordancesForRoom(first.world, headlessHome.id, headlessRoom.id, 'player')
    : null;
  check(Boolean(affordances) && first.axm.ObjectUse.validateProjection(first.world, affordances).ok, 'headless runtime exposes a valid object-use affordance projection');
  check(first.serialize() === beforeProjection, 'headless object-use inspection does not mutate authoritative world state');

  const initialFile = path.join(tempRoot, 'initial.json');
  SaveStore.writeNewSave(initialFile, first.serialize());
  check(fs.existsSync(initialFile), 'filesystem adapter writes an explicit save file');

  const loaded = HeadlessSimulator.fromText(SaveStore.readSave(initialFile).text);
  check(loaded.serialize() === first.serialize(), 'filesystem save round-trips exactly');

  const advancedA = HeadlessSimulator.fromText(first.serialize());
  const advancedB = HeadlessSimulator.fromText(first.serialize());
  advancedA.advanceMinutes(125);
  advancedB.advanceMinutes(125);
  check(advancedA.serialize() === advancedB.serialize(), 'headless time advancement is deterministic');
  check(advancedA.summary().time.hour !== first.summary().time.hour, 'headless runtime advances authoritative time');

  assert.throws(
    () => SaveStore.writeNewSave(initialFile, advancedA.serialize()),
    /EEXIST|exist/i
  );
  check(true, 'filesystem adapter refuses silent save overwrite');

  const cli = path.join(__dirname, '..', 'runtime', 'cli.js');
  const cliNew = path.join(tempRoot, 'cli-new.json');
  const cliStep = path.join(tempRoot, 'cli-step.json');
  const created = spawnSync(process.execPath, [cli, 'new', '--seed', 'AXM-CLI-INTAKE', '--out', cliNew], {
    encoding: 'utf8'
  });
  check(created.status === 0 && fs.existsSync(cliNew), 'CLI creates a world without browser APIs');
  const stepped = spawnSync(process.execPath, [cli, 'step', '--in', cliNew, '--minutes', '60', '--out', cliStep], {
    encoding: 'utf8'
  });
  check(stepped.status === 0 && fs.existsSync(cliStep), 'CLI advances into a separate filesystem checkpoint');
  const inspected = spawnSync(process.execPath, [cli, 'inspect', '--in', cliStep], { encoding: 'utf8' });
  const inspection = inspected.status === 0 ? JSON.parse(inspected.stdout) : null;
  check(inspection && inspection.summary.valid === true, 'CLI inspects and validates the saved simulation');

  process.stdout.write('Living City headless runtime intake test passed: ' + checks + ' checks.\n');
} finally {
  const resolvedTemp = path.resolve(tempRoot);
  const systemTemp = path.resolve(os.tmpdir()) + path.sep;
  if (!resolvedTemp.startsWith(systemTemp)) {
    throw new Error('refusing to clean a test path outside the system temp directory');
  }
  fs.rmSync(resolvedTemp, { recursive: true, force: true });
}
