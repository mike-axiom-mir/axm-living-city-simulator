'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'content_expansion', 'world', 'systems', 'career_skills']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, Content, World, Systems, CareerSkills } = globalThis.AXM;
globalThis.AXM.UI = {
  renderWork() { return '<section>base-work</section>'; },
  renderJobCard() { return '<article>base-job</article>'; }
};
require(path.join(ROOT, 'src', 'career_ui.js'));
const { CareerUI } = globalThis.AXM;

function newWorld(seed) {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  return world;
}

function testJobPoolExpandsWithoutRemovingExistingWork() {
  const ids = Content.JOBS.map((job) => job.id);
  ['corner_cafe', 'parcel_depot', 'repair_workshop', 'neighborhood_library', 'design_coop'].forEach((id) => assert.ok(ids.includes(id)));
  ['cafe_kitchen', 'material_market', 'park_steward', 'learning_house'].forEach((id) => assert.ok(ids.includes(id)));
  assert.equal(Content.JOBS.length, 9);
  Content.JOBS.forEach((job) => {
    assert.ok(job.skillProfile && Object.keys(job.skillProfile).length >= 1);
    assert.ok(job.entryRequirements && Object.keys(job.entryRequirements).length >= 1);
    assert.ok(World.createWorld('CAREER-PLACES').places.some((place) => place.id === job.placeId));
  });
}

function testFreshWorldHasBoundedCareerStateAndSixTransferableSkills() {
  const world = newWorld('CAREER-FRESH');
  assert.equal(world.careerSkills.schema, CareerSkills.SCHEMA);
  assert.equal(CareerSkills.SKILL_KEYS.length, 6);
  assert.equal(world.player.skills.engineering, 0);
  assert.equal(CareerSkills.summary(world).noSkillDecay, true);
  assert.equal(CareerSkills.summary(world).noCareerDeadline, true);
  assert.equal(CareerSkills.summary(world).noMandatoryPromotion, true);
  assert.ok(CareerSkills.jobRecord(world, 'corner_cafe', false));
}

function testEntryRequirementsCanUseMoreThanOneSkill() {
  const world = newWorld('CAREER-ENTRY');
  world.player.skills.creativity = 35;
  world.player.skills.focus = 10;
  const blocked = CareerSkills.jobEligibility(world, 'design_coop');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.missing.focus, 10);
  world.player.skills.focus = 20;
  assert.equal(CareerSkills.jobEligibility(world, 'design_coop').ok, true);

  world.player.skills.cooking = 10;
  world.player.skills.focus = 6;
  assert.equal(CareerSkills.jobEligibility(world, 'cafe_kitchen').ok, true);
}

function testInteractiveWorkPreservesPerJobTaskAndShiftHistory() {
  const world = newWorld('CAREER-INTERACTIVE');
  const start = Systems.startInteractiveShift(world);
  assert.equal(start.ok, true);
  for (let hour = 0; hour < 6; hour += 1) {
    const result = Systems.performWorkTask(world, 'serve_carefully');
    assert.equal(result.ok, true);
  }
  assert.equal(world.activeShift, null);
  const record = CareerSkills.jobRecord(world, 'corner_cafe', false);
  assert.equal(record.shifts, 1);
  assert.equal(record.interactiveShifts, 1);
  assert.equal(record.compressedShifts, 0);
  assert.equal(record.hours, 6);
  assert.equal(record.taskHours, 6);
  assert.equal(record.tasks.serve_carefully, 6);
  assert.ok(world.careerSkills.skillEvidence.social.events >= 1);
  assert.ok(world.careerSkills.skillEvidence.social.totalGain > 0);
}

function testCompressedWorkCountsAsRealWorkWithoutInventingEnteredTasks() {
  const world = newWorld('CAREER-COMPRESSED');
  const result = Systems.skipShift(world);
  assert.equal(result.ok, true);
  const record = CareerSkills.jobRecord(world, 'corner_cafe', false);
  assert.equal(record.shifts, 1);
  assert.equal(record.compressedShifts, 1);
  assert.equal(record.interactiveShifts, 0);
  assert.equal(record.hours, 6);
  assert.equal(record.taskHours, 0);
  assert.deepEqual(record.tasks, {});
  assert.ok(world.careerSkills.skillEvidence.social.events >= 1, 'Existing compressed primary-skill learning should leave evidence.');
}

function testChangingJobKeepsEarlierPracticeAndUsesTransferableRequirements() {
  const world = newWorld('CAREER-CHANGE');
  assert.equal(Systems.skipShift(world).ok, true);
  const oldRecord = Core.deepClone(CareerSkills.jobRecord(world, 'corner_cafe', false));
  world.player.skills.cooking = 16;
  world.player.skills.focus = 12;
  const changed = Systems.applyForJob(world, 'cafe_kitchen');
  assert.equal(changed.ok, true);
  assert.equal(world.player.jobId, 'cafe_kitchen');
  assert.equal(CareerSkills.jobRecord(world, 'corner_cafe', false).hours, oldRecord.hours);
  assert.ok(CareerSkills.jobRecord(world, 'cafe_kitchen', false));
  assert.equal(world.careerSkills.history.at(-1).fromJobId, 'corner_cafe');
  assert.equal(world.careerSkills.history.at(-1).toJobId, 'cafe_kitchen');
}

function testOrdinarySocialLifeCanBuildTransferableSocialSkill() {
  const world = newWorld('CAREER-SOCIAL');
  const npc = world.people[0];
  const beforeSkill = world.player.skills.social;
  const beforeEvents = world.careerSkills.skillEvidence.social.events;
  const result = Systems.interactWithNpc(world, npc.id, 'talk');
  assert.equal(result.ok, true);
  assert.ok(world.player.skills.social > beforeSkill);
  assert.ok(world.careerSkills.skillEvidence.social.events > beforeEvents);
  assert.equal(world.careerSkills.skillEvidence.social.sources.at(-1).type, 'social_practice');
}

function testJobFitUsesSeveralSkillsAndExperienceIsDescriptive() {
  const world = newWorld('CAREER-FIT');
  const early = CareerSkills.jobFit(world, 'repair_workshop');
  world.player.skills.repair = 55;
  world.player.skills.focus = 45;
  world.player.skills.creativity = 35;
  world.player.skills.social = 25;
  world.player.skills.engineering = 15;
  const later = CareerSkills.jobFit(world, 'repair_workshop');
  assert.ok(later.score > early.score);
  assert.ok(later.contributions.length >= 4);
  assert.match(later.band, /fit/i);
}

function testReadOnlyCareerInspectionDoesNotInstallMissingOrOverwriteFutureState() {
  const world = newWorld('CAREER-READONLY');
  delete world.careerSkills;
  const before = Core.serializeWorld(world);
  const summary = CareerSkills.summary(world);
  assert.equal(summary.currentJobHours, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(world, 'careerSkills'), false);
  assert.equal(Core.serializeWorld(world), before);

  world.careerSkills = { schema: 'axm.living-city.career-skills/v99-future', sentinel: { keep: 'me' } };
  const futureBefore = Core.serializeWorld(world);
  CareerSkills.summary(world);
  assert.equal(Core.serializeWorld(world), futureBefore);
  assert.throws(() => CareerSkills.ensureState(world), /refusing to overwrite/i);
  assert.equal(Core.serializeWorld(world), futureBefore);
}

function testCareerUiShowsEvidenceInsteadOfAForcedPromotionTree() {
  const world = newWorld('CAREER-UI');
  const skills = CareerUI.renderSkillEvidence(world);
  const current = CareerUI.renderCurrentJobDepth(world);
  const kitchen = CareerUI.renderJobCard(world, Content.jobById('cafe_kitchen'));
  assert.match(skills, /Transferable skills/);
  assert.match(skills, /No skill decay/);
  assert.match(skills, /Engineering/);
  assert.match(current, /no mandatory promotion/i);
  assert.match(kitchen, /Cooking 10/);
  assert.match(kitchen, /Skill mix/);
}

const tests = [
  testJobPoolExpandsWithoutRemovingExistingWork,
  testFreshWorldHasBoundedCareerStateAndSixTransferableSkills,
  testEntryRequirementsCanUseMoreThanOneSkill,
  testInteractiveWorkPreservesPerJobTaskAndShiftHistory,
  testCompressedWorkCountsAsRealWorkWithoutInventingEnteredTasks,
  testChangingJobKeepsEarlierPracticeAndUsesTransferableRequirements,
  testOrdinarySocialLifeCanBuildTransferableSocialSkill,
  testJobFitUsesSeveralSkillsAndExperienceIsDescriptive,
  testReadOnlyCareerInspectionDoesNotInstallMissingOrOverwriteFutureState,
  testCareerUiShowsEvidenceInsteadOfAForcedPromotionTree
];

for (const test of tests) test();
console.log(`PASS career/skills tests: ${tests.length}/${tests.length}`);