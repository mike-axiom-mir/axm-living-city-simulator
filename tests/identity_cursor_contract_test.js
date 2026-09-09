'use strict';

const assert = require('node:assert/strict');
const { HeadlessSimulator } = require('../runtime/headless-simulator');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function fresh(seed) {
  return HeadlessSimulator.create({ seed });
}

{
  const simulator = fresh('AXM-IDENTITY-CENSUS');
  const inspection = simulator.axm.Core.inspectIdentityCursors(simulator.world);
  check(inspection.schema === 'axm.living-city.identity-cursors/v1', 'identity census has an explicit contract version');
  check(simulator.axm.Core.validateIdentityCursors(simulator.world).length === 0, 'new world identity cursors cover every issued identity');
  check(Object.keys(inspection.domains).join(',') === 'core,shell,economy,exterior,presence', 'all five identity domains share one registry');
  check(inspection.domains.core.issuedIds === inspection.domains.core.cursor, 'initial core cursor exactly covers its issued identities');
  check(simulator.summary().identityCursors.domains.shell.maxIssued === simulator.world.shellIdCounter, 'headless summary exposes shell identity evidence');
}

{
  const simulator = fresh('AXM-IDENTITY-LOW-CURSOR');
  const world = JSON.parse(simulator.serialize());
  const maximum = simulator.axm.Core.inspectIdentityCursors(world).domains.core.maxIssued;
  world.idCounter = maximum - 1;
  const before = simulator.axm.Core.serializeWorld(world);
  assert.throws(
    () => simulator.axm.Systems.migrateWorld(world),
    new RegExp(`Current save failed invariant validation:[\\s\\S]*idCounter ${maximum - 1} is behind issued identity ${maximum}`)
  );
  check(simulator.axm.Core.serializeWorld(world) === before, 'current save with a lowered cursor is rejected without normalization');
}

{
  const simulator = fresh('AXM-IDENTITY-DUPLICATE');
  const world = simulator.world;
  world.ledger.push(simulator.axm.Core.deepClone(world.ledger[0]));
  const validation = simulator.axm.Systems.validateWorld(world);
  check(!validation.ok && validation.errors.some((error) => /Issued identity .* appears more than once/.test(error)), 'duplicate issued identity is diagnosed across retained records');
}

{
  const simulator = fresh('AXM-IDENTITY-LEGACY-MIGRATION');
  const world = JSON.parse(simulator.serialize());
  const priorMaximum = simulator.axm.Core.inspectIdentityCursors(world).domains.core.maxIssued;
  world.schema = 'axm.living-city-sim.world/v0.10.0';
  world.idCounter = 0;
  const migrated = simulator.axm.Systems.migrateWorld(world);
  check(migrated.idCounter > priorMaximum, 'legacy migration raises the cursor before issuing its migration event');
  check(simulator.axm.Systems.validateWorld(migrated).ok, 'legacy cursor reconciliation produces valid current state');
}

{
  const simulator = fresh('AXM-IDENTITY-DOMAIN-FLOORS');
  const world = {
    idCounter: 0,
    shellIdCounter: 0,
    economyIdCounter: 0,
    exteriorIdCounter: 0,
    presenceIdCounter: 0,
    records: [
      { id: 'event_00042' },
      { id: 'shell_event_000017' },
      { id: 'enterprise_event_00009' },
      { id: 'travel_000004' },
      { id: 'ordinary_encounter_000006' }
    ]
  };
  simulator.axm.Core.reconcileLegacyIdentityCursors(world);
  check(world.idCounter === 42, 'legacy reconciliation derives the core cursor floor');
  check(world.shellIdCounter === 17, 'legacy reconciliation derives the shell cursor floor');
  check(world.economyIdCounter === 9, 'legacy reconciliation derives the economy cursor floor');
  check(world.exteriorIdCounter === 4, 'legacy reconciliation derives the exterior cursor floor');
  check(world.presenceIdCounter === 6, 'legacy reconciliation derives the presence cursor floor');
}

{
  const simulator = fresh('AXM-IDENTITY-ISSUANCE');
  const world = simulator.world;
  const before = world.presenceIdCounter;
  const id = simulator.axm.Core.issueIdentity(world, 'presence', 'ordinary_encounter');
  check(id === `ordinary_encounter_${String(before + 1).padStart(6, '0')}`, 'registered domain issuance advances the correct cursor deterministically');
  assert.throws(() => simulator.axm.Core.issueIdentity(world, 'presence', 'event'), /not registered/);
  check(true, 'cross-domain identity prefixes fail closed');
  world.presenceIdCounter = Number.MAX_SAFE_INTEGER;
  assert.throws(() => simulator.axm.Core.issueIdentity(world, 'presence', 'ordinary_encounter'), /exhausted/);
  check(true, 'exhausted identity space fails closed');
}

process.stdout.write('Living City identity cursor contract test passed: ' + checks + ' checks.\n');
