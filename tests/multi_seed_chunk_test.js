'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { World, Systems } = globalThis.AXM;
const start = Math.max(1, Number.parseInt(process.env.AXM_STRESS_START || process.argv[2] || '1', 10));
const count = Math.max(1, Math.min(12, Number.parseInt(process.env.AXM_STRESS_COUNT || process.argv[3] || '4', 10)));
const end = Math.min(12, start + count - 1);
const rows = [];

for (let index = start; index <= end; index += 1) {
  const seed = `AXM-STRESS-${String(index).padStart(3, '0')}`;
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  const report = Systems.runObserverDays(world, 365);
  assert.equal(report.validation.ok, true, `${seed}: ${report.validation.errors.join('\n')}`);
  assert.ok(report.after.moves > 0, `${seed}: housing market produced no move in 365 days`);
  assert.ok(report.after.decorSignatureCount >= 10, `${seed}: décor converged too far (${report.after.decorSignatureCount})`);
  assert.ok(report.changedPropertyCount >= 10, `${seed}: too few homes changed visible state (${report.changedPropertyCount})`);
  assert.ok(report.after.npcDecorActions >= 150, `${seed}: too little autonomous decoration (${report.after.npcDecorActions})`);
  assert.ok(report.after.npcUpgradeActions >= 150, `${seed}: too little upgrade-without-replacement activity (${report.after.npcUpgradeActions})`);
  const row = {
    seed,
    moves: report.after.moves,
    decorActions: report.after.npcDecorActions,
    upgradeActions: report.after.npcUpgradeActions,
    signatures: report.after.decorSignatureCount,
    changedHomes: report.changedPropertyCount,
    npcWealthAverage: report.after.npcWealthAverage,
    shellBuildings: world.buildings?.length || 0,
    frontageProposals: world.frontageProposals?.length || 0,
    frontageProjects: world.frontageProjects?.length || 0,
  };
  rows.push(row);
  console.log(`PASS ${seed} · moves ${row.moves} · décor ${row.decorActions} · upgrades ${row.upgradeActions} · shells ${row.shellBuildings}`);
}

const output = { start, end, count: rows.length, daysPerSeed: 365, rows };
const outPath = path.join(__dirname, `MULTI_SEED_STRESS_v0_10_${String(start).padStart(2, '0')}_${String(end).padStart(2, '0')}.json`);
fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`WROTE ${path.relative(ROOT, outPath)}`);
