'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of [
  'core', 'content', 'content_expansion', 'world', 'systems', 'item_interactions',
  'historical_era', 'engineering_ewaste', 'career_skills', 'career_engineering_bridge'
]) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, EngineeringEwaste, CareerSkills, CareerEngineeringBridge } = globalThis.AXM;

function newWorld(seed) {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  return world;
}

function testEngineeringPracticeLeavesTransferableEvidenceWithoutExtraSkillReward() {
  const world = newWorld('CAREER-ENGINEERING-EVIDENCE');
  const collected = EngineeringEwaste.collectEwaste(world);
  assert.equal(collected.ok, true);
  const before = CareerSkills.skillSnapshot(world.player);
  const inspected = EngineeringEwaste.inspectEwaste(world, collected.lot.id);
  assert.equal(inspected.ok, true);
  const after = CareerSkills.skillSnapshot(world.player);
  assert.equal(Core.round(after.focus - before.focus, 2), 0.25);
  assert.equal(Core.round(after.repair - before.repair, 2), 0.2);
  assert.equal(Core.round(after.engineering - before.engineering, 2), 0.2);
  assert.ok(world.careerSkills.skillEvidence.engineering.events >= 1);
  assert.equal(world.careerSkills.skillEvidence.engineering.sources.at(-1).type, 'engineering_work');
  assert.equal(world.careerSkills.skillEvidence.engineering.sources.at(-1).label, 'Inspect e-waste');
  assert.equal(CareerEngineeringBridge.addsNoEngineeringReward, true);
}

function testMissingCareerStateCanBeInstalledByExplicitEngineeringWork() {
  const world = newWorld('CAREER-ENGINEERING-MISSING');
  delete world.careerSkills;
  assert.equal(Object.prototype.hasOwnProperty.call(world, 'careerSkills'), false);
  const result = EngineeringEwaste.collectEwaste(world);
  assert.equal(result.ok, true);
  assert.equal(world.careerSkills.schema, CareerSkills.SCHEMA);
  assert.ok(world.careerSkills.skillEvidence.focus.events >= 1);
}

function testUnknownCareerSchemaRefusesBeforeEngineeringMutation() {
  const world = newWorld('CAREER-ENGINEERING-FUTURE');
  world.careerSkills = { schema: 'axm.living-city.career-skills/v99-future', sentinel: { keep: 'me' } };
  const before = Core.serializeWorld(world);
  assert.throws(() => EngineeringEwaste.collectEwaste(world), /refusing to overwrite/i);
  assert.equal(Core.serializeWorld(world), before, 'Career schema refusal must happen before engineering changes time, lots, money or skills.');
  assert.equal(CareerEngineeringBridge.refusesUnknownCareerSchemaBeforeEngineeringMutation, true);
}

function testEngineeringBridgeKeepsBackendAuthorityFlagsUnchanged() {
  const world = newWorld('CAREER-ENGINEERING-AUTHORITY');
  const summary = EngineeringEwaste.summary(world);
  assert.equal(summary.noPassiveEwasteGeneration, true);
  assert.equal(summary.noMaintenanceObligation, true);
  assert.equal(summary.robotAutonomyEnabled, false);
  assert.equal(CareerEngineeringBridge.recordsSkillEvidenceOnly, true);
}

const tests = [
  testEngineeringPracticeLeavesTransferableEvidenceWithoutExtraSkillReward,
  testMissingCareerStateCanBeInstalledByExplicitEngineeringWork,
  testUnknownCareerSchemaRefusesBeforeEngineeringMutation,
  testEngineeringBridgeKeepsBackendAuthorityFlagsUnchanged
];

for (const test of tests) test();
console.log(`PASS career/engineering bridge tests: ${tests.length}/${tests.length}`);