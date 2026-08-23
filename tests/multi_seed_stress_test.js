'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { World, Systems } = globalThis.AXM;
const start = Math.max(0, Number(process.env.TOWN_STRESS_START || 0));
const seedCount = Math.max(1, Number(process.env.TOWN_STRESS_SEEDS || 12));
const daysPerSeed = Math.max(1, Number(process.env.TOWN_STRESS_DAYS || 365));
const suffix = process.env.TOWN_STRESS_SUFFIX || (start === 0 && seedCount === 12 && daysPerSeed === 365 ? '' : `_v0_11_${String(start + 1).padStart(2, '0')}_${String(start + seedCount).padStart(2, '0')}`);
const seeds = Array.from({ length: seedCount }, (_, index) => `AXM-STRESS-${String(start + index + 1).padStart(3, '0')}`);
const rows = [];

for (const seed of seeds) {
  const startedAt = Date.now();
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  const report = Systems.runObserverDays(world, daysPerSeed);
  assert.equal(report.validation.ok, true, `${seed}: ${report.validation.errors.join('\n')}`);
  if (daysPerSeed >= 365) {
    assert.ok(report.after.moves > 0, `${seed}: housing market produced no move in ${daysPerSeed} days`);
    assert.ok(report.after.decorSignatureCount >= 10, `${seed}: décor converged too far (${report.after.decorSignatureCount})`);
    assert.ok(report.changedPropertyCount >= 10, `${seed}: too few homes changed visible state (${report.changedPropertyCount})`);
    assert.ok(report.after.npcDecorActions >= 150, `${seed}: too little autonomous decoration (${report.after.npcDecorActions})`);
    assert.ok(report.after.npcUpgradeActions >= 150, `${seed}: too little upgrade-without-replacement activity (${report.after.npcUpgradeActions})`);
  }
  const row = {
    seed,
    days: daysPerSeed,
    elapsedSeconds: Math.round((Date.now() - startedAt) / 10) / 100,
    moves: report.after.moves,
    decorActions: report.after.npcDecorActions,
    upgradeActions: report.after.npcUpgradeActions,
    signatures: report.after.decorSignatureCount,
    changedHomes: report.changedPropertyCount,
    npcWealthAverage: report.after.npcWealthAverage,
    indoorMovementsCompleted: report.after.indoorMovementsCompleted,
    npcIndoorTransitions: report.after.npcRoutesObserved,
    validationErrors: report.validation.errors.length,
  };
  rows.push(row);
  console.log(`PASS ${seed}: ${daysPerSeed} days in ${row.elapsedSeconds}s; moves ${row.moves}; changed homes ${row.changedHomes}; indoor movements ${row.indoorMovementsCompleted}.`);
}

const average = (key) => Math.round(rows.reduce((sum, row) => sum + row[key], 0) / rows.length * 100) / 100;
const result = {
  schema: 'axm.living-city-sim.town-stress-results/v0.11.0',
  start,
  seeds: rows.length,
  daysPerSeed,
  totalSimulatedDays: rows.length * daysPerSeed,
  rows,
  averages: {
    moves: average('moves'),
    decorActions: average('decorActions'),
    upgradeActions: average('upgradeActions'),
    signatures: average('signatures'),
    changedHomes: average('changedHomes'),
    npcWealthAverage: average('npcWealthAverage'),
    indoorMovementsCompleted: average('indoorMovementsCompleted'),
    npcIndoorTransitions: average('npcIndoorTransitions'),
  },
  minimums: {
    moves: Math.min(...rows.map((row) => row.moves)),
    decorActions: Math.min(...rows.map((row) => row.decorActions)),
    upgradeActions: Math.min(...rows.map((row) => row.upgradeActions)),
    signatures: Math.min(...rows.map((row) => row.signatures)),
    changedHomes: Math.min(...rows.map((row) => row.changedHomes)),
  },
  validationFailures: rows.reduce((sum, row) => sum + row.validationErrors, 0),
};

const jsonPath = path.join(__dirname, `TOWN_STRESS_RESULTS${suffix}.json`);
const txtPath = path.join(__dirname, `TOWN_STRESS_RESULTS${suffix}.txt`);
fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
fs.writeFileSync(txtPath, [
  `AXM Living City Town Stress ${suffix || 'full'}`,
  `Seeds: ${rows.length}`,
  `Days per seed: ${daysPerSeed}`,
  `Total simulated days: ${result.totalSimulatedDays}`,
  `Validation failures: ${result.validationFailures}`,
  `Average moves: ${result.averages.moves}`,
  `Average décor actions: ${result.averages.decorActions}`,
  `Average upgrades: ${result.averages.upgradeActions}`,
  `Average changed homes: ${result.averages.changedHomes}`,
  `Average indoor movements: ${result.averages.indoorMovementsCompleted}`,
  '',
  ...rows.map((row) => `${row.seed}: moves ${row.moves}; décor ${row.decorActions}; upgrades ${row.upgradeActions}; changed homes ${row.changedHomes}; indoor ${row.indoorMovementsCompleted}; ${row.elapsedSeconds}s`),
  '',
].join('\n'), 'utf8');

console.log(`PASS multi-seed stress test: ${rows.length} deterministic towns × ${daysPerSeed} days.`);
console.log(JSON.stringify(result, null, 2));
