'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Economy } = globalThis.AXM;
const allSeeds = Array.from({ length: 8 }, (_, index) => `AXM-ECONOMY-STRESS-${String(index + 1).padStart(2, '0')}`);
const seedStart = Math.max(1, Number.parseInt(process.env.AXM_ECONOMY_STRESS_START || '1', 10));
const seedCount = Math.max(1, Math.min(8, Number.parseInt(process.env.AXM_ECONOMY_STRESS_COUNT || '8', 10)));
const seeds = allSeeds.slice(seedStart - 1, seedStart - 1 + seedCount);
const DAYS = 240;

function run(seed) {
  const world = World.createWorld(seed);
  const ages = new Map([world.player].concat(world.people).map((person) => [person.id, {
    age: person.age,
    ageDays: person.lifeCourse?.ageDays,
    stage: person.lifeCourse?.stage
  }]));
  Systems.advanceHours(world, DAYS * 24);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, `${seed}: ${validation.errors.join('\n')}`);
  assert.equal(world.settings.lifeCourseMode, 'choice');
  assert.equal(world.settings.agePressure, false);
  for (const [id, before] of ages.entries()) {
    const person = World.getPerson(world, id);
    assert.ok(person, `${seed}: original person ${id} disappeared`);
    assert.equal(person.age, before.age, `${seed}: ${id} age changed`);
    assert.equal(person.lifeCourse?.ageDays, before.ageDays, `${seed}: ${id} ageDays changed`);
    assert.equal(person.lifeCourse?.stage, before.stage, `${seed}: ${id} life stage changed`);
  }
  const validCustomers = new Set(world.people.map((person) => person.id));
  world.enterpriseSessions.forEach((session) => {
    session.customers.forEach((customer) => assert.ok(validCustomers.has(customer.personId), `${seed}: invented customer ${customer.personId}`));
  });
  assert.equal(Economy.commercialPremises(world).length, 4);
  assert.equal(world.localNeeds.length, Economy.LOCAL_NEED_TEMPLATES.length);
  assert.ok(world.enterprises.filter((entry) => entry.ownerId !== 'player').length >= 2);
  assert.ok(world.enterpriseSessions.some((entry) => entry.mode === 'autonomous'), `${seed}: no resident enterprise session`);
  assert.ok(world.metrics.enterpriseCustomersServed > 0, `${seed}: no resident customers were served`);
  assert.ok(world.enterprises.every((entry) => entry.optional && entry.noAgeGate && entry.ageGate === null && entry.noGrowthRequirement && entry.noFailureLabel));

  return {
    world,
    result: {
      seed,
      day: world.time.day,
      population: world.people.length + 1,
      enterprises: world.enterprises.length,
      residentEnterprises: world.enterprises.filter((entry) => entry.ownerId !== 'player').length,
      privateDirections: world.enterprises.filter((entry) => entry.status === 'private').length,
      occasionalDirections: world.enterprises.filter((entry) => entry.status === 'occasional').length,
      openDirections: world.enterprises.filter((entry) => entry.status === 'open').length,
      pausedDirections: world.enterprises.filter((entry) => entry.status === 'paused').length,
      closedDirections: world.enterprises.filter((entry) => entry.status === 'closed').length,
      sessions: world.enterpriseSessions.length,
      autonomousSessions: world.enterpriseSessions.filter((entry) => entry.mode === 'autonomous').length,
      customers: world.enterpriseSessions.reduce((sum, entry) => sum + entry.customers.length, 0),
      flexibleOrFree: world.enterpriseSessions.reduce((sum, entry) => sum + entry.customers.filter((customer) => customer.flexibleOrFree).length, 0),
      revenue: Core.round(world.enterprises.reduce((sum, entry) => sum + entry.totals.revenue, 0), 2),
      costs: Core.round(world.enterprises.reduce((sum, entry) => sum + entry.totals.costs, 0), 2),
      equipmentObjects: world.enterprises.reduce((sum, entry) => sum + entry.equipment.length, 0),
      occupiedPremises: Economy.commercialPremises(world).filter((entry) => entry.occupantEnterpriseId).length,
      vacantPremises: Economy.commercialPremises(world).filter((entry) => entry.listedForLease).length,
      needsServed: world.localNeeds.reduce((sum, entry) => sum + entry.servedCount, 0),
      highestNeedSignal: Math.max(...world.localNeeds.map((entry) => entry.score)),
      agePressure: world.settings.agePressure,
      validationErrors: validation.errors.length
    }
  };
}

const results = [];
for (const seed of seeds) {
  const first = run(seed);
  const second = run(seed);
  assert.equal(Core.serializeWorld(first.world), Core.serializeWorld(second.world), `${seed}: serialized replay diverged`);
  results.push(first.result);
  console.log(`PASS ${seed} · ${first.result.enterprises} directions · ${first.result.sessions} sessions · ${first.result.customers} actual residents`);
}

const totals = results.reduce((acc, row) => {
  for (const key of ['enterprises', 'residentEnterprises', 'privateDirections', 'occasionalDirections', 'openDirections', 'pausedDirections', 'closedDirections', 'sessions', 'autonomousSessions', 'customers', 'flexibleOrFree', 'revenue', 'costs', 'equipmentObjects', 'needsServed']) {
    acc[key] = Core.round((acc[key] || 0) + row[key], 2);
  }
  return acc;
}, {});
const aggregate = {
  schema: 'axm.living-city.local-economy-stress-report/v0.8.0',
  generatedAt: new Date().toISOString(),
  seeds: results.length,
  daysPerSeed: DAYS,
  deterministicExecutions: results.length * 2,
  simulatedDaysAcrossPrimaryRuns: results.length * DAYS,
  results,
  totals,
  averages: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Core.round(value / results.length, 2)])),
  invariants: {
    exactSerializedReplay: true,
    actualResidentCustomersOnly: true,
    noAgePressure: true,
    originalPeopleKeptAgeAndStage: true,
    noValidationFailures: true
  }
};

const subsetSuffix = seeds.length === allSeeds.length ? '' : `_v0_10_${String(seedStart).padStart(2, '0')}_${String(seedStart + seeds.length - 1).padStart(2, '0')}`;
const jsonPath = path.join(ROOT, 'tests', `LOCAL_ECONOMY_STRESS_RESULTS${subsetSuffix}.json`);
const txtPath = path.join(ROOT, 'tests', `LOCAL_ECONOMY_STRESS_RESULTS${subsetSuffix}.txt`);
fs.writeFileSync(jsonPath, `${JSON.stringify(aggregate, null, 2)}\n`);
const lines = [
  'AXM Living City — Living Local Economy v0.8.0',
  'Deterministic local-economy stress results',
  '',
  `Seeds: ${aggregate.seeds}`,
  `Days per seed: ${DAYS}`,
  `Deterministic executions: ${aggregate.deterministicExecutions}`,
  `Primary simulated days: ${aggregate.simulatedDaysAcrossPrimaryRuns}`,
  `Resident enterprise sessions: ${totals.autonomousSessions}`,
  `Actual resident customers: ${totals.customers}`,
  `Flexible/free services: ${totals.flexibleOrFree}`,
  `Enterprise revenue: ${Core.formatMoney(totals.revenue)}`,
  `Enterprise attributable costs: ${Core.formatMoney(totals.costs)}`,
  `Equipment objects retained: ${totals.equipmentObjects}`,
  `Need-service records: ${totals.needsServed}`,
  '',
  'All selected worlds replayed to exact serialized equality.',
  'Every customer ID resolved to an actual resident.',
  'Choice-first age and life-stage state remained stable.',
  'No validation failures were observed.',
  '',
  ...results.map((row) => `${row.seed}: ${row.enterprises} directions; ${row.sessions} sessions; ${row.customers} customers; ${row.flexibleOrFree} flexible/free; ${row.occupiedPremises} occupied commercial rooms.`)
];
fs.writeFileSync(txtPath, `${lines.join('\n')}\n`);
console.log(`\nPASS ${results.length}/${results.length} local-economy stress worlds; exact replay confirmed.`);
console.log(JSON.stringify(totals, null, 2));
