'use strict';

const assert = require('node:assert/strict');
const { HeadlessSimulator } = require('../runtime/headless-simulator');

const CURRENT_KEY = 'axm.living-city-sim.autosave.v0.11.3';
const LEGACY_KEY = 'axm.living-city-sim.autosave.v0.11.2';
const CLEAR_TRANSACTION_KEY = 'axm.living-city-sim.autosave.clear-transaction.v1';
const CLEAR_TRANSACTION_MARKER = 'axm.living-city.autosave-clear-transaction/v1:DELETE_INTENT';

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function createStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  const operations = [];
  const faults = {
    setKey: null,
    removeKey: null
  };
  return {
    operations,
    faults,
    getItem(key) {
      operations.push({ op: 'get', key });
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      operations.push({ op: 'set', key });
      if (faults.setKey === key) throw new Error('injected set failure for ' + key);
      values.set(key, String(value));
    },
    removeItem(key) {
      operations.push({ op: 'remove', key });
      if (faults.removeKey === key) throw new Error('injected remove failure for ' + key);
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

function resetSession() {
  Game.autosaveBaselineKnown = false;
  Game.autosaveBaseText = null;
  Game.autosaveConflict = null;
}

const bootstrap = HeadlessSimulator.create({ seed: 'AXM-AUTOSAVE-CLEAR-TRANSACTION-BOOTSTRAP' });
require('../src/game.js');
const Game = bootstrap.axm.Game;
assert.ok(Game && typeof Game.clearAutosave === 'function', 'browser game autosave surface must load in Node harness');

const originalWarn = console.warn;
const warnings = [];
console.warn = (...args) => warnings.push(args.map(String).join(' '));

try {
  {
    warnings.length = 0;
    const current = currentWorld('AXM-CLEAR-TX-CURRENT');
    const legacy = currentWorld('AXM-CLEAR-TX-LEGACY');
    const storage = createStorage({ [CURRENT_KEY]: current, [LEGACY_KEY]: legacy });
    globalThis.localStorage = storage;

    Game.world = Game.readAutosave();
    storage.operations.length = 0;
    storage.faults.removeKey = LEGACY_KEY;
    const cleared = Game.clearAutosave();

    check(cleared === false, 'a mid-clear storage failure is reported instead of being presented as success');
    check(storage.value(CURRENT_KEY) === current, 'a failed clear preserves the current save until legacy cleanup can complete');
    check(storage.value(LEGACY_KEY) === legacy, 'the failing legacy delete leaves that recovery candidate intact');
    check(storage.value(CLEAR_TRANSACTION_KEY) === CLEAR_TRANSACTION_MARKER, 'a failed physical clear retains exact delete intent for deterministic recovery');
    const markerWrite = storage.operations.findIndex((entry) => entry.op === 'set' && entry.key === CLEAR_TRANSACTION_KEY);
    const firstDelete = storage.operations.findIndex((entry) => entry.op === 'remove' && entry.key !== CLEAR_TRANSACTION_KEY);
    check(markerWrite >= 0 && firstDelete > markerWrite, 'delete intent is persisted before any autosave key is removed');

    storage.faults.removeKey = null;
    resetSession();
    const recovered = Game.readAutosave();
    check(recovered === null, 'the next reader completes an admitted interrupted clear instead of resurrecting an older save');
    check(storage.value(CURRENT_KEY) === null && storage.value(LEGACY_KEY) === null, 'interrupted-clear recovery removes current and legacy autosave bytes');
    check(storage.value(CLEAR_TRANSACTION_KEY) === null, 'completed interrupted-clear recovery removes its transaction marker');
    check(Game.autosaveBaselineKnown === true && Game.autosaveBaseText === null, 'completed recovery establishes an observed empty current slot');
  }

  {
    warnings.length = 0;
    const current = currentWorld('AXM-CLEAR-TX-MARKER-FAIL-CURRENT');
    const legacy = currentWorld('AXM-CLEAR-TX-MARKER-FAIL-LEGACY');
    const storage = createStorage({ [CURRENT_KEY]: current, [LEGACY_KEY]: legacy });
    globalThis.localStorage = storage;

    Game.world = Game.readAutosave();
    storage.faults.setKey = CLEAR_TRANSACTION_KEY;
    const cleared = Game.clearAutosave();

    check(cleared === false, 'clear refuses to mutate saves when delete intent cannot be persisted first');
    check(storage.value(CURRENT_KEY) === current && storage.value(LEGACY_KEY) === legacy, 'failed intent persistence leaves every exercised save byte untouched');
    check(storage.operations.every((entry) => entry.op !== 'remove'), 'failed intent persistence performs no delete operation');
  }

  {
    warnings.length = 0;
    const current = currentWorld('AXM-CLEAR-TX-INVALID-MARKER');
    const invalidMarker = 'axm.living-city.autosave-clear-transaction/v1:FORGED_STATE';
    const storage = createStorage({
      [CURRENT_KEY]: current,
      [CLEAR_TRANSACTION_KEY]: invalidMarker
    });
    globalThis.localStorage = storage;
    resetSession();

    const loaded = Game.readAutosave();

    check(loaded === null, 'an unknown clear-transaction marker fails closed before autosave admission');
    check(storage.value(CURRENT_KEY) === current, 'invalid clear-transaction evidence does not delete or rewrite the current save');
    check(storage.value(CLEAR_TRANSACTION_KEY) === invalidMarker, 'invalid clear-transaction evidence is preserved for diagnosis');
    check(Game.autosaveConflict?.kind === 'clear-transaction-held', 'invalid clear-transaction evidence produces an explicit held conflict state');
    check(warnings.some((line) => line.includes('clear transaction')), 'held clear-transaction evidence leaves an explicit diagnostic');
  }

  {
    warnings.length = 0;
    const current = currentWorld('AXM-CLEAR-TX-SUCCESS-CURRENT');
    const legacy = currentWorld('AXM-CLEAR-TX-SUCCESS-LEGACY');
    const storage = createStorage({ [CURRENT_KEY]: current, [LEGACY_KEY]: legacy });
    globalThis.localStorage = storage;

    Game.world = Game.readAutosave();
    storage.operations.length = 0;
    const cleared = Game.clearAutosave();

    check(cleared === true, 'ordinary explicit clear still completes successfully');
    check(storage.value(CURRENT_KEY) === null && storage.value(LEGACY_KEY) === null, 'successful clear removes current and legacy autosaves');
    check(storage.value(CLEAR_TRANSACTION_KEY) === null, 'successful clear leaves no transaction marker behind');
    const markerWrite = storage.operations.findIndex((entry) => entry.op === 'set' && entry.key === CLEAR_TRANSACTION_KEY);
    const currentDelete = storage.operations.findIndex((entry) => entry.op === 'remove' && entry.key === CURRENT_KEY);
    check(markerWrite >= 0 && currentDelete > markerWrite, 'successful clear also records delete intent before deleting current state');
  }
} finally {
  console.warn = originalWarn;
  delete globalThis.localStorage;
}

process.stdout.write('Living City autosave clear transaction test passed: ' + checks + ' checks.\n');
