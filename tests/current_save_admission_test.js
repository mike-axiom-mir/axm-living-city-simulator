'use strict';

const assert = require('node:assert/strict');
const { HeadlessSimulator } = require('../runtime/headless-simulator');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function parsedCurrentWorld(seed) {
  const simulator = HeadlessSimulator.create({ seed });
  return {
    simulator,
    world: JSON.parse(simulator.serialize())
  };
}

{
  const { simulator } = parsedCurrentWorld('AXM-CURRENT-SAVE-ROUNDTRIP');
  const serialized = simulator.serialize();
  const loaded = HeadlessSimulator.fromText(serialized);
  check(loaded.serialize() === serialized, 'valid current save round-trips byte-identically');
}

{
  const { simulator, world } = parsedCurrentWorld('AXM-CURRENT-SAVE-AUTHORITY');
  const prepared = simulator.axm.Systems.prepareStewardshipExperiment(world);
  assert.equal(prepared.ok, true, prepared.reason);
  const request = world.stewardshipRequests.find((entry) => entry.id === prepared.requestId);
  request.status = 'forged-approved';
  const before = simulator.axm.Core.serializeWorld(world);

  assert.throws(
    () => simulator.axm.Systems.migrateWorld(world),
    /Current save failed invariant validation:[\s\S]*invalid status/i
  );
  check(
    simulator.axm.Core.serializeWorld(world) === before,
    'invalid current authority record is rejected without rewriting its status'
  );
}

{
  const { simulator, world } = parsedCurrentWorld('AXM-CURRENT-SAVE-MISSING-HISTORY');
  delete world.households;
  const before = simulator.axm.Core.serializeWorld(world);

  assert.throws(
    () => simulator.axm.Systems.migrateWorld(world),
    /Current save failed invariant validation:[\s\S]*Households must be an array/i
  );
  check(
    simulator.axm.Core.serializeWorld(world) === before,
    'missing current history container is rejected without manufacturing an empty replacement'
  );
}

{
  const { simulator, world } = parsedCurrentWorld('AXM-CURRENT-SAVE-PATCH-LEVEL');
  world.version = '0.11.0';
  const loaded = simulator.axm.Systems.migrateWorld(world);
  check(loaded.version === simulator.axm.Core.VERSION, 'valid same-schema patch save advances to the runtime version');
  check(simulator.axm.Systems.validateWorld(loaded).ok, 'valid same-schema patch save remains valid');
}

process.stdout.write('Living City current-save admission test passed: ' + checks + ' checks.\n');
