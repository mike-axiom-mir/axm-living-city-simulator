'use strict';

const assert = require('node:assert/strict');
const { HeadlessSimulator } = require('../runtime/headless-simulator');

const CURRENT_KEY = 'axm.living-city-sim.autosave.v0.11.3';
const LEGACY_KEY = 'axm.living-city-sim.autosave.v0.11.2';

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function createStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  const writes = [];
  return {
    writes,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      const text = String(value);
      writes.push({ key, value: text });
      values.set(key, text);
    },
    removeItem(key) {
      values.delete(key);
    },
    value(key) {
      return values.has(key) ? values.get(key) : null;
    }
  };
}

function currentWorld(seed) {
  return HeadlessSimulator.create({ seed }).serialize();
}

const bootstrap = HeadlessSimulator.create({ seed: 'AXM-STALE-AUTOSAVE-BOOTSTRAP' });
require('../src/game.js');
const Game = bootstrap.axm.Game;
assert.ok(Game && typeof Game.writeAutosave === 'function', 'browser game autosave surface must load in Node harness');

const originalWarn = console.warn;
const warnings = [];
console.warn = (...args) => warnings.push(args.map(String).join(' '));

try {
  {
    warnings.length = 0;
    const first = currentWorld('AXM-AUTOSAVE-FIRST-WRITER');
    const second = currentWorld('AXM-AUTOSAVE-SECOND-WRITER');
    const storage = createStorage({ [CURRENT_KEY]: first });
    globalThis.localStorage = storage;

    const loaded = Game.readAutosave();
    Game.world = loaded;
    storage.setItem(CURRENT_KEY, second);
    const writesBefore = storage.writes.length;
    const saved = Game.writeAutosave();

    check(saved === false, 'a session refuses to autosave over bytes changed after its last read');
    check(storage.value(CURRENT_KEY) === second, 'stale writer refusal preserves the newer stored world exactly');
    check(storage.writes.length === writesBefore, 'stale writer refusal performs no storage write');
    check(warnings.some((line) => line.includes('changed since this session last observed')), 'stale writer refusal leaves an explicit diagnostic');
  }

  {
    warnings.length = 0;
    const initial = currentWorld('AXM-AUTOSAVE-SEQUENTIAL');
    const storage = createStorage({ [CURRENT_KEY]: initial });
    globalThis.localStorage = storage;

    Game.world = Game.readAutosave();
    Game.world.time.day += 1;
    const firstSave = Game.writeAutosave();
    const firstBytes = storage.value(CURRENT_KEY);
    Game.world.time.day += 1;
    const secondSave = Game.writeAutosave();

    check(firstSave === true && secondSave === true, 'successful writes advance the observed baseline for later same-session autosaves');
    check(storage.value(CURRENT_KEY) !== firstBytes, 'later same-session autosave can publish the next deterministic world state');
  }

  {
    warnings.length = 0;
    const existing = currentWorld('AXM-AUTOSAVE-UNSEEN-EXISTING');
    const storage = createStorage({ [CURRENT_KEY]: existing });
    globalThis.localStorage = storage;

    Game.world = JSON.parse(currentWorld('AXM-AUTOSAVE-UNSEEN-NEW'));
    Game.autosaveBaselineKnown = false;
    Game.autosaveBaseText = null;
    const saved = Game.writeAutosave();

    check(saved === false, 'an unobserved session refuses to overwrite an already-present current autosave');
    check(storage.value(CURRENT_KEY) === existing, 'unknown-baseline refusal preserves pre-existing local state');
  }

  {
    warnings.length = 0;
    const storage = createStorage();
    globalThis.localStorage = storage;

    Game.world = JSON.parse(currentWorld('AXM-AUTOSAVE-FIRST-SAVE'));
    Game.autosaveBaselineKnown = false;
    Game.autosaveBaseText = null;
    const saved = Game.writeAutosave();

    check(saved === true, 'an unobserved session may claim an actually empty autosave slot');
    check(storage.value(CURRENT_KEY) === bootstrap.axm.Core.serializeWorld(Game.world), 'first save records exactly the authoritative serialized world');
  }

  {
    warnings.length = 0;
    const observed = currentWorld('AXM-AUTOSAVE-CLEAR-OBSERVED');
    const newer = currentWorld('AXM-AUTOSAVE-CLEAR-NEWER');
    const legacy = currentWorld('AXM-AUTOSAVE-CLEAR-LEGACY');
    const storage = createStorage({ [CURRENT_KEY]: observed, [LEGACY_KEY]: legacy });
    globalThis.localStorage = storage;

    Game.world = Game.readAutosave();
    storage.setItem(CURRENT_KEY, newer);
    const cleared = Game.clearAutosave();

    check(cleared === false, 'a stale session refuses to clear local saves after the current slot changed');
    check(storage.value(CURRENT_KEY) === newer, 'stale clear refusal preserves the newer current save exactly');
    check(storage.value(LEGACY_KEY) === legacy, 'stale clear refusal performs no partial deletion of legacy recovery state');
    check(Game.autosaveConflict?.kind === 'stale-storage', 'stale clear refusal preserves the shared stale-storage conflict contract');
    check(warnings.some((line) => line.includes('clear refused')), 'stale clear refusal leaves an explicit diagnostic');
  }

  {
    const storage = createStorage({ [CURRENT_KEY]: currentWorld('AXM-AUTOSAVE-CLEAR') });
    globalThis.localStorage = storage;
    Game.world = Game.readAutosave();
    const cleared = Game.clearAutosave();

    check(cleared === true, 'explicit clear succeeds when the current slot still matches this session baseline');
    check(Game.autosaveBaselineKnown === true && Game.autosaveBaseText === null, 'successful explicit clear establishes an observed empty autosave baseline');
  }
} finally {
  console.warn = originalWarn;
  delete globalThis.localStorage;
}

process.stdout.write('Living City stale autosave writer test passed: ' + checks + ' checks.\n');
