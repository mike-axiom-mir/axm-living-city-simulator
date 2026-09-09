'use strict';

const assert = require('node:assert/strict');
const { HeadlessSimulator } = require('../runtime/headless-simulator');

const CURRENT_KEY = 'axm.living-city-sim.autosave.v0.11.3';
const LEGACY_KEY = 'axm.living-city-sim.autosave.v0.10.0';
const OLDER_LEGACY_KEY = 'axm.living-city-sim.autosave.v0.9.0';

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function createStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  const reads = [];
  const writes = [];
  return {
    reads,
    writes,
    getItem(key) {
      reads.push(key);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      writes.push({ key, value: String(value) });
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    value(key) {
      return values.get(key);
    }
  };
}

function serializedCurrentWorld(seed) {
  return HeadlessSimulator.create({ seed }).serialize();
}

function serializedLegacyWorld(seed) {
  const simulator = HeadlessSimulator.create({ seed });
  const world = JSON.parse(simulator.serialize());
  world.schema = 'axm.living-city-sim.world/v0.10.0';
  world.version = '0.10.0';
  return simulator.axm.Core.serializeWorld(world);
}

const bootstrap = HeadlessSimulator.create({ seed: 'AXM-AUTOSAVE-RECOVERY-BOOTSTRAP' });
require('../src/game.js');
const Game = bootstrap.axm.Game;
assert.ok(Game && typeof Game.readAutosave === 'function', 'browser game autosave surface must load in Node harness');

const originalWarn = console.warn;
const warnings = [];
console.warn = (...args) => warnings.push(args.map(String).join(' '));

try {
  {
    warnings.length = 0;
    const storage = createStorage({
      [CURRENT_KEY]: '{malformed-current-json',
      [LEGACY_KEY]: serializedLegacyWorld('AXM-AUTOSAVE-RECOVER-LEGACY')
    });
    globalThis.localStorage = storage;

    const world = Game.readAutosave();
    check(world?.seed === 'AXM-AUTOSAVE-RECOVER-LEGACY', 'malformed newest autosave does not suppress a valid legacy candidate');
    check(storage.reads.includes(LEGACY_KEY), 'candidate scan continues to the legacy slot after newest-slot rejection');
    check(
      warnings.some((line) => line.includes(CURRENT_KEY) && line.includes('rejected')),
      'rejected candidate leaves a key-specific diagnostic'
    );
    check(
      JSON.parse(storage.value(CURRENT_KEY)).schema === bootstrap.axm.Core.SCHEMA,
      'successful legacy recovery promotes the migrated world into the current autosave slot'
    );
  }

  {
    warnings.length = 0;
    const invalidCurrent = JSON.parse(serializedCurrentWorld('AXM-AUTOSAVE-CURRENT-CORRUPT'));
    delete invalidCurrent.households;
    const invalidCurrentText = bootstrap.axm.Core.serializeWorld(invalidCurrent);
    const storage = createStorage({
      [CURRENT_KEY]: invalidCurrentText,
      [LEGACY_KEY]: serializedLegacyWorld('AXM-AUTOSAVE-RECOVER-AFTER-INVARIANT')
    });
    globalThis.localStorage = storage;

    const world = Game.readAutosave();
    check(world?.seed === 'AXM-AUTOSAVE-RECOVER-AFTER-INVARIANT', 'current-schema invariant rejection does not suppress a valid legacy candidate');
    check(
      warnings.some((line) => line.includes(CURRENT_KEY) && line.includes('rejected')),
      'current-schema invariant rejection is attributed to the rejected slot'
    );
  }

  {
    warnings.length = 0;
    const currentText = serializedCurrentWorld('AXM-AUTOSAVE-CURRENT-WINS');
    const storage = createStorage({
      [CURRENT_KEY]: currentText,
      [LEGACY_KEY]: serializedLegacyWorld('AXM-AUTOSAVE-SHOULD-NOT-WIN')
    });
    globalThis.localStorage = storage;

    const world = Game.readAutosave();
    check(world?.seed === 'AXM-AUTOSAVE-CURRENT-WINS', 'valid newest autosave remains authoritative over older candidates');
    check(!storage.reads.includes(LEGACY_KEY), 'candidate scan stops after the first valid autosave');
  }

  {
    warnings.length = 0;
    const currentBytes = '{bad-current';
    const legacyBytes = '{bad-legacy';
    const storage = createStorage({
      [CURRENT_KEY]: currentBytes,
      [LEGACY_KEY]: legacyBytes,
      [OLDER_LEGACY_KEY]: serializedLegacyWorld('AXM-AUTOSAVE-RECOVER-THIRD')
    });
    globalThis.localStorage = storage;

    const world = Game.readAutosave();
    check(world?.seed === 'AXM-AUTOSAVE-RECOVER-THIRD', 'multiple rejected candidates do not suppress the next valid local snapshot');
    check(storage.reads.includes(OLDER_LEGACY_KEY), 'candidate scan can pass more than one corrupt slot');
  }

  {
    warnings.length = 0;
    const currentBytes = '{still-bad-current';
    const legacyBytes = '{still-bad-legacy';
    const storage = createStorage({
      [CURRENT_KEY]: currentBytes,
      [LEGACY_KEY]: legacyBytes
    });
    globalThis.localStorage = storage;

    const world = Game.readAutosave();
    check(world === null, 'all rejected autosave candidates fail closed to no recovered world');
    check(storage.value(CURRENT_KEY) === currentBytes, 'failed recovery does not rewrite the rejected current bytes');
    check(storage.value(LEGACY_KEY) === legacyBytes, 'failed recovery does not rewrite the rejected legacy bytes');
  }
} finally {
  console.warn = originalWarn;
  delete globalThis.localStorage;
}

process.stdout.write('Living City autosave candidate recovery test passed: ' + checks + ' checks.\n');
