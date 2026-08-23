'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, Content, World, Systems, Family, Community, Directions } = globalThis.AXM;

function newWorld(seed = 'AXM-DIRECTIONS-TEST') {
  const world = World.createWorld(seed);
  world.settings.simulationSpeed = 0;
  return world;
}

function fundPlayer(world) {
  world.player.money = 100_000;
  Object.keys(world.player.materials || {}).forEach((id) => { world.player.materials[id] = 100; });
}

function firstOwned(world) {
  const found = Directions.ownedObjects(world, 'player')[0];
  assert.ok(found, 'expected a player-owned object');
  return found;
}

function createRestoration(world, suffix = '') {
  fundPlayer(world);
  const found = firstOwned(world);
  const result = Systems.createPersonalProject(world, {
    templateId: 'restoration',
    targetObjectId: found.object.id,
    title: `Keep this object ${suffix}`.trim(),
    meaning: 'Its history matters more than replacing it with a statistically superior object.'
  });
  assert.equal(result.ok, true, result.reason);
  return { project: result.project, found };
}

function absoluteHour(world) {
  return world.time.day * 24 + world.time.hour;
}

function testChoiceFirstRootsAreDefaultAndValid() {
  const world = newWorld('AXM-DIR-ROOTS');
  assert.equal(world.schema, Core.SCHEMA);
  assert.equal(world.version, Core.VERSION);
  assert.equal(world.settings.lifeCourseMode, 'choice');
  assert.equal(world.settings.showExactAges, false);
  assert.equal(world.settings.agePressure, false);
  assert.deepEqual(world.personalProjects, []);
  assert.equal(world.player.lifeCourse.mode, 'choice');
  assert.equal(world.player.lifeCourse.agePressure, false);
  assert.deepEqual(world.player.lifeCourse.chapterChoiceHistory, []);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testV06MigrationAddsNoFabricatedProjectOrElapsedLife() {
  const legacy = newWorld('AXM-DIR-MIGRATION');
  const stageBefore = legacy.player.lifeCourse.stage;
  const ageBefore = legacy.player.age;
  legacy.schema = 'axm.living-city-sim.world/v0.6.0';
  legacy.version = '0.6.0';
  delete legacy.personalProjects;
  delete legacy.settings.lifeCourseMode;
  delete legacy.settings.showExactAges;
  delete legacy.settings.agePressure;
  delete legacy.ui.selectedPersonalProjectId;
  delete legacy.flags.personalDirectionsExperimentPrepared;
  delete legacy.flags.personalDirectionsFoundationLogged;
  [legacy.player].concat(legacy.people).forEach((person) => {
    delete person.personalProjectIds;
    delete person.personalProjectCooldownUntil;
    delete person.lifeCourse.mode;
    delete person.lifeCourse.agePressure;
    delete person.lifeCourse.exactAgeVisible;
    delete person.lifeCourse.chapterDays;
    delete person.lifeCourse.chapterChoiceHistory;
  });
  Object.keys(legacy.metrics).filter((key) => key.startsWith('personalProject') || key.startsWith('projectCollaboration') || key.startsWith('npcPersonalProject') || ['projectMoneySpent', 'projectMaterialsSpent', 'lifeChapterChoices'].includes(key)).forEach((key) => delete legacy.metrics[key]);

  Systems.migrateWorld(legacy);
  assert.equal(legacy.schema, Core.SCHEMA);
  assert.equal(legacy.settings.lifeCourseMode, 'choice');
  assert.equal(legacy.settings.agePressure, false);
  assert.equal(legacy.player.lifeCourse.stage, stageBefore);
  assert.equal(legacy.player.age, ageBefore);
  assert.deepEqual(legacy.personalProjects, []);
  assert.deepEqual(legacy.player.personalProjectIds, []);
  assert.equal(legacy.ledger.some((entry) => /no past project, chapter, collaboration, or achievement was fabricated/i.test(entry.message)), true);
  const validation = Systems.validateWorld(legacy);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testFourHundredDaysCreateNoAgeCountdownInChoiceMode() {
  const world = newWorld('AXM-DIR-NO-AGE-CLOCK');
  const before = new Map([world.player].concat(world.people).map((person) => [person.id, {
    age: person.age,
    stage: person.lifeCourse.stage,
    ageDays: person.lifeCourse.ageDays
  }]));
  Systems.advanceHours(world, 400 * 24, { freezePlayer: true });
  [world.player].concat(world.people).forEach((person) => {
    const original = before.get(person.id);
    assert.equal(person.age, original.age, `${person.id} age changed in choice mode`);
    assert.equal(person.lifeCourse.ageDays, original.ageDays, `${person.id} ageDays changed in choice mode`);
    assert.equal(person.lifeCourse.stage, original.stage, `${person.id} stage changed in choice mode`);
    assert.ok(person.lifeCourse.chapterDays >= 400);
  });
  assert.equal(world.settings.agePressure, false);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testCalendarAgingIsExplicitAndOptional() {
  const world = newWorld('AXM-DIR-CALENDAR-OPT-IN');
  const result = Systems.setLifeCourseMode(world, 'calendar');
  assert.equal(result.ok, true, result.reason);
  const life = world.player.lifeCourse;
  life.stage = 'young_adult';
  life.ageYears = 24;
  life.ageDays = 25 * 365 - 1;
  world.player.age = 24;
  Family.dailyTick(world);
  assert.equal(world.settings.lifeCourseMode, 'calendar');
  assert.equal(life.stage, 'adult');
  assert.equal(world.settings.agePressure, false);
  assert.equal(Systems.setLifeCourseMode(world, 'choice').ok, true);
  const frozen = life.ageDays;
  Family.dailyTick(world);
  assert.equal(life.ageDays, frozen);
}

function testExplicitLifeChapterChoicePreservesOpenProjectAndIdentity() {
  const world = newWorld('AXM-DIR-CHAPTER-CHOICE');
  const { project } = createRestoration(world);
  const id = world.player.id;
  const stageBefore = world.player.lifeCourse.stage;
  const objectId = project.target.objectId;
  const result = Systems.advanceLifeChapter(world, 'player');
  assert.equal(result.ok, true, result.reason);
  assert.equal(world.player.id, id);
  assert.notEqual(world.player.lifeCourse.stage, stageBefore);
  assert.equal(project.status, 'active');
  assert.equal(project.target.objectId, objectId);
  assert.equal(world.personalProjects.includes(project), true);
  assert.equal(world.metrics.lifeChapterChoices, 1);
  assert.equal(result.transition.noMissedWindow, true);
  assert.equal(Systems.validateWorld(world).ok, true);
}

function testAnyLifeChapterCanStartAProjectWithoutAgeGate() {
  const world = newWorld('AXM-DIR-ELDER-PROJECT');
  world.player.lifeCourse.stage = 'elder';
  world.player.lifeCourse.ageYears = 82;
  world.player.lifeCourse.ageDays = 82 * 365;
  world.player.age = 82;
  const result = Systems.createPersonalProject(world, {
    templateId: 'creative',
    targetPlaceId: 'place_library',
    title: 'A new strange story',
    meaning: 'Curiosity did not expire because a calendar number changed.'
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.project.lifeContext.stageAtCreation, 'elder');
  assert.equal(result.project.noAgeGate, true);
  assert.equal(result.project.ageGate, null);
  assert.equal(result.project.lifeContext.exactAgeRequired, false);
}

function testRestorationRequiresRealOwnerAuthority() {
  const world = newWorld('AXM-DIR-OBJECT-AUTHORITY');
  const npcObject = world.places.flatMap((property) => property.furniture || []).find((object) => object.ownerId !== 'player');
  assert.ok(npcObject);
  const before = JSON.stringify(npcObject);
  const result = Systems.createPersonalProject(world, {
    templateId: 'restoration',
    targetObjectId: npcObject.id,
    title: 'Take another person’s history',
    meaning: 'This should be rejected.'
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /actually owns|cannot become/i);
  assert.equal(JSON.stringify(npcObject), before);
  assert.equal(world.personalProjects.length, 0);
}

function testProjectWorkUsesRealTimeMoneyAndMaterials() {
  const world = newWorld('AXM-DIR-REAL-RESOURCES');
  const { project } = createRestoration(world);
  assert.equal(Systems.workPersonalProject(world, project.id).ok, true);
  const chapter = Directions.currentChapter(project);
  const beforeHour = absoluteHour(world);
  const beforeMoney = world.player.money;
  const beforeMaterials = Core.deepClone(world.player.materials);
  const result = Systems.workPersonalProject(world, project.id);
  assert.equal(result.ok, true, result.reason);
  assert.equal(absoluteHour(world) - beforeHour, chapter.hours);
  assert.equal(Core.round(beforeMoney - world.player.money, 2), chapter.money);
  Object.entries(chapter.materials).forEach(([id, amount]) => assert.equal(beforeMaterials[id] - world.player.materials[id], amount));
  assert.equal(project.evidence.hoursWorked, 4);
  assert.equal(project.evidence.moneySpent, chapter.money);
}

function testRestorationPreservesObjectIdentityAndAddsHistory() {
  const world = newWorld('AXM-DIR-OBJECT-HISTORY');
  const { project, found } = createRestoration(world);
  found.object.condition = 35;
  found.object.sentimental = 8;
  const id = found.object.id;
  const historyBefore = found.object.history.length;
  const conditionBefore = found.object.condition;
  while (project.status === 'active') {
    const result = Systems.workPersonalProject(world, project.id);
    assert.equal(result.ok, true, result.reason);
  }
  const after = Directions.findOwnedObject(world, 'player', id);
  assert.ok(after);
  assert.equal(after.object.id, id);
  assert.ok(after.object.condition > conditionBefore);
  assert.ok(after.object.sentimental > 8);
  assert.ok(after.object.history.length >= historyBefore + 3);
  assert.equal(project.evidence.objectHistoryEntries, 3);
  assert.equal(project.status, 'completed');
}

function testPauseResumeAndReleaseCarryNoHiddenPlayerPenalty() {
  const world = newWorld('AXM-DIR-PAUSE-RELEASE');
  const { project } = createRestoration(world);
  const snapshot = {
    money: world.player.money,
    needs: Core.deepClone(world.player.needs),
    skills: Core.deepClone(world.player.skills),
    relationships: Core.deepClone(world.player.relationships)
  };
  assert.equal(Systems.pausePersonalProject(world, project.id).ok, true);
  assert.equal(Systems.resumePersonalProject(world, project.id).ok, true);
  assert.equal(Systems.releasePersonalProject(world, project.id).ok, true);
  assert.equal(world.player.money, snapshot.money);
  assert.deepEqual(world.player.needs, snapshot.needs);
  assert.deepEqual(world.player.skills, snapshot.skills);
  assert.deepEqual(world.player.relationships, snapshot.relationships);
  assert.equal(project.status, 'released');
  assert.equal(project.history.at(-1).evidence.hiddenPenalty, false);
}

function testReshapePreservesCompletedChaptersAndEarlierMeaning() {
  const world = newWorld('AXM-DIR-RESHAPE');
  const { project } = createRestoration(world);
  assert.equal(Systems.workPersonalProject(world, project.id).ok, true);
  const oldTitle = project.title;
  const oldMeaning = project.meaning;
  const result = Systems.reshapePersonalProject(world, project.id, 'Keep it useful and strange', 'The history still matters, but now the project also follows how I actually use it.');
  assert.equal(result.ok, true, result.reason);
  assert.equal(project.stageIndex, 1);
  assert.equal(project.chapters[0].status, 'completed');
  assert.equal(project.reshapes[0].title, oldTitle);
  assert.equal(project.reshapes[0].meaning, oldMeaning);
}

function testCollaborationDeclineIsDelayedAndRelationshipNeutral() {
  const world = newWorld('AXM-DIR-COLLAB-DECLINE');
  const { project } = createRestoration(world);
  const template = Directions.templateById(project.templateId);
  let chosen = null;
  for (const person of world.people.filter((entry) => !Family.isDependent(entry))) {
    const connection = Community.ensureConnection(world, 'player', person.id, 'creative_partner', { warmthGain: 0, trustGain: 0, message: 'Test connection.' });
    connection.warmth = 0;
    connection.trust = 0;
    const score = Core.clamp(18 + Directions.projectFit(world, person, template) * 0.45, 0, 100);
    const roll = (Core.hashString(`${world.seed}|${project.id}|${person.id}|collaboration`) % 10000) / 100;
    if (roll > score) { chosen = { person, connection, score, roll }; break; }
  }
  assert.ok(chosen, 'expected at least one deterministic decline candidate');
  const beforePlayer = Core.deepClone(world.player.relationships[chosen.person.id]);
  const beforeNpc = Core.deepClone(chosen.person.relationships.player);
  const invited = Systems.inviteProjectCollaborator(world, project.id, chosen.person.id);
  assert.equal(invited.ok, true, invited.reason);
  assert.equal(invited.request.status, 'pending_npc');
  assert.equal(project.collaboratorIds.includes(chosen.person.id), false);
  world.time.day = invited.request.dueDay;
  Directions.dailyTick(world);
  assert.equal(invited.request.status, 'declined');
  assert.equal(invited.request.evidence.relationshipPenalty, 0);
  assert.deepEqual(world.player.relationships[chosen.person.id], beforePlayer);
  assert.deepEqual(chosen.person.relationships.player, beforeNpc);
}

function testCompletionCreatesHistoryNotMandatoryUnlock() {
  const world = newWorld('AXM-DIR-COMPLETE-NO-LADDER');
  const { project } = createRestoration(world);
  while (project.status === 'active') assert.equal(Systems.workPersonalProject(world, project.id).ok, true);
  assert.equal(project.status, 'completed');
  assert.equal(world.personalProjects.length, 1);
  assert.equal(Object.hasOwn(project, 'mandatoryNextProjectId'), false);
  assert.equal(Object.hasOwn(project, 'deadlineDay'), false);
  assert.equal(Object.hasOwn(project, 'unlockTier'), false);
  assert.match(project.history.at(-1).message, /did not unlock a compulsory next tier/i);
}

function testNpcProjectsEmergeAndReplayDeterministically() {
  const run = () => {
    const world = newWorld('AXM-DIR-NPC-DETERMINISM');
    for (let day = 0; day < 360; day += 1) {
      world.time.day += 1;
      Directions.dailyTick(world);
    }
    const validation = Systems.validateWorld(world);
    assert.equal(validation.ok, true, validation.errors.join('\n'));
    return world.personalProjects.filter((entry) => entry.ownerId !== 'player').map((entry) => ({
      id: entry.id,
      ownerId: entry.ownerId,
      templateId: entry.templateId,
      status: entry.status,
      stageIndex: entry.stageIndex,
      target: entry.target,
      history: entry.history
    }));
  };
  const a = run();
  const b = run();
  assert.ok(a.length > 0, 'expected autonomous residents to form personal directions');
  assert.ok(a.some((entry) => entry.stageIndex > 0 || ['completed', 'released'].includes(entry.status)), 'expected at least one autonomous project to progress');
  assert.deepEqual(a, b);
}

function testValidatorRejectsAgeGateDeadlineAndAgePressureWithoutRepair() {
  const world = newWorld('AXM-DIR-VALIDATION');
  const { project } = createRestoration(world);
  project.noDeadline = false;
  project.deadlineDay = world.time.day + 4;
  project.noAgeGate = false;
  project.ageGate = { min: 18, max: 30 };
  world.settings.agePressure = true;
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, false);
  assert.equal(validation.errors.some((entry) => /no-deadline|age gate|age-pressure/i.test(entry)), true);
  assert.equal(project.deadlineDay, world.time.day + 4);
  assert.deepEqual(project.ageGate, { min: 18, max: 30 });
  assert.equal(world.settings.agePressure, true);
}

function testLabeledExperimentUsesRealObjectAndIsSingleUse() {
  const world = newWorld('AXM-DIR-EXPERIMENT');
  const beforeIds = new Set(Directions.ownedObjects(world, 'player').map((entry) => entry.object.id));
  const first = Systems.preparePersonalDirectionsExperiment(world);
  assert.equal(first.ok, true, first.reason);
  assert.equal(beforeIds.has(first.objectId), true);
  const project = Directions.projectById(world, first.projectId);
  assert.ok(project);
  assert.equal(project.stageIndex, 1);
  assert.equal(project.noDeadline, true);
  assert.equal(project.noAgeGate, true);
  assert.equal(world.flags.personalDirectionsExperimentPrepared, true);
  const second = Systems.preparePersonalDirectionsExperiment(world);
  assert.equal(second.ok, false);
  assert.match(second.reason, /already prepared/i);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

const tests = [
  testChoiceFirstRootsAreDefaultAndValid,
  testV06MigrationAddsNoFabricatedProjectOrElapsedLife,
  testFourHundredDaysCreateNoAgeCountdownInChoiceMode,
  testCalendarAgingIsExplicitAndOptional,
  testExplicitLifeChapterChoicePreservesOpenProjectAndIdentity,
  testAnyLifeChapterCanStartAProjectWithoutAgeGate,
  testRestorationRequiresRealOwnerAuthority,
  testProjectWorkUsesRealTimeMoneyAndMaterials,
  testRestorationPreservesObjectIdentityAndAddsHistory,
  testPauseResumeAndReleaseCarryNoHiddenPlayerPenalty,
  testReshapePreservesCompletedChaptersAndEarlierMeaning,
  testCollaborationDeclineIsDelayedAndRelationshipNeutral,
  testCompletionCreatesHistoryNotMandatoryUnlock,
  testNpcProjectsEmergeAndReplayDeterministically,
  testValidatorRejectsAgeGateDeadlineAndAgePressureWithoutRepair,
  testLabeledExperimentUsesRealObjectAndIsSingleUse
];

let passed = 0;
for (const test of tests) {
  try {
    test();
    passed += 1;
    console.log(`PASS ${test.name}`);
  } catch (error) {
    console.error(`FAIL ${test.name}`);
    console.error(error.stack || error);
    process.exitCode = 1;
    break;
  }
}
console.log(`\n${passed}/${tests.length} personal-directions tests passed.`);
