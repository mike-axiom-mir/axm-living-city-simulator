'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { World, Systems, Directions } = globalThis.AXM;
const ALL_SEEDS = Array.from({ length: 8 }, (_, index) => `AXM-DIRECTIONS-STRESS-${String(index + 1).padStart(2, '0')}`);
const SEED_START = Math.max(1, Number.parseInt(process.env.AXM_DIRECTIONS_STRESS_START || '1', 10));
const SEED_COUNT = Math.max(1, Math.min(8, Number.parseInt(process.env.AXM_DIRECTIONS_STRESS_COUNT || '8', 10)));
const SEEDS = ALL_SEEDS.slice(SEED_START - 1, SEED_START - 1 + SEED_COUNT);
const DAYS = 240;

function run(seed) {
  const world = World.createWorld(seed);
  const ageSnapshot = new Map([world.player].concat(world.people).map((person) => [person.id, {
    age: person.age,
    ageDays: person.lifeCourse.ageDays,
    stage: person.lifeCourse.stage
  }]));
  Systems.advanceHours(world, DAYS * 24, { freezePlayer: true });
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, `${seed}\n${validation.errors.join('\n')}`);
  assert.equal(world.settings.lifeCourseMode, 'choice');
  assert.equal(world.settings.agePressure, false);
  [world.player].concat(world.people).forEach((person) => {
    const before = ageSnapshot.get(person.id);
    if (!before) return;
    assert.equal(person.age, before.age, `${seed}: ${person.id} age changed`);
    assert.equal(person.lifeCourse.ageDays, before.ageDays, `${seed}: ${person.id} ageDays changed`);
    assert.equal(person.lifeCourse.stage, before.stage, `${seed}: ${person.id} stage changed`);
  });
  const projects = world.personalProjects;
  assert.ok(projects.length > 0, `${seed}: no autonomous personal direction emerged`);
  projects.forEach((project) => {
    assert.equal(project.noDeadline, true);
    assert.equal(project.noAgeGate, true);
    assert.equal(project.ageGate, null);
    assert.equal(project.lifeContext.exactAgeRequired, false);
  });
  const serialized = JSON.stringify(world);
  const metric = Directions.metrics(world);
  return {
    serialized,
    report: {
      seed,
      day: world.time.day,
      projects: projects.length,
      npcOpen: metric.npcOpen,
      npcCompleted: metric.npcCompleted,
      npcReleased: projects.filter((entry) => entry.ownerId !== 'player' && entry.status === 'released').length,
      npcPaused: projects.filter((entry) => entry.ownerId !== 'player' && entry.status === 'paused').length,
      chapters: projects.reduce((sum, entry) => sum + entry.stageIndex, 0),
      restorationProjects: projects.filter((entry) => entry.templateId === 'restoration').length,
      objectHistoryEntries: metric.totalObjectHistoryEntries,
      playerAgeStable: true,
      allTrackedAgesStable: true,
      validationErrors: validation.errors.length
    }
  };
}

const reports = [];
for (const seed of SEEDS) {
  const first = run(seed);
  const second = run(seed);
  assert.equal(first.serialized, second.serialized, `${seed}: deterministic replay diverged`);
  reports.push(first.report);
  console.log(`PASS ${seed} · ${first.report.projects} projects · ${first.report.chapters} chapters · exact replay`);
}

const totals = reports.reduce((acc, row) => {
  Object.entries(row).forEach(([key, value]) => {
    if (typeof value === 'number') acc[key] = (acc[key] || 0) + value;
  });
  return acc;
}, {});
const summary = {
  schema: 'axm.living-city.personal-directions-stress/v0.7.0',
  seeds: SEEDS.length,
  daysPerSeed: DAYS,
  deterministicRuns: SEEDS.length * 2,
  totalSimulatedDays: SEEDS.length * DAYS * 2,
  totals,
  reports
};
console.log('\n' + JSON.stringify(summary, null, 2));
