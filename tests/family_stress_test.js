'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Households, Family } = globalThis.AXM;
const ALL_SEEDS = Array.from({ length: 8 }, (_, index) => `AXM-FAMILY-STRESS-${String(index + 1).padStart(2, '0')}`);
const SEED_START = Math.max(1, Number.parseInt(process.env.AXM_FAMILY_STRESS_START || '1', 10));
const SEED_COUNT = Math.max(1, Math.min(8, Number.parseInt(process.env.AXM_FAMILY_STRESS_COUNT || '8', 10)));
const SEEDS = ALL_SEEDS.slice(SEED_START - 1, SEED_START - 1 + SEED_COUNT);
const DAYS = 180;
const CARE_ACTION_IDS = Object.keys(Family.CARE_ACTIONS);

function allObjectLocations(world) {
  const locations = new Map();
  world.places.filter((property) => property.kind === 'residential').forEach((property) => {
    property.furniture.forEach((object) => locations.set(object.id, `property:${property.id}`));
  });
  [world.player].concat(world.people).forEach((person) => {
    (person.storedFurniture || []).forEach((object) => locations.set(object.id, `storage:${person.id}`));
  });
  return locations;
}

function dependentObjectIds(world, familyUnitId) {
  const unit = Family.familyUnitById(world, familyUnitId);
  if (!unit) return [];
  const personIds = new Set(unit.members.filter((member) => ['dependent', 'adult_child'].includes(member.role)).map((member) => member.personId));
  const ids = [];
  world.places.filter((property) => property.kind === 'residential').forEach((property) => {
    property.furniture.filter((object) => personIds.has(object.ownerId)).forEach((object) => ids.push(object.id));
  });
  world.people.filter((person) => personIds.has(person.id)).forEach((person) => {
    (person.storedFurniture || []).filter((object) => object.ownerId === person.id).forEach((object) => ids.push(object.id));
  });
  return Array.from(new Set(ids)).sort();
}

function relationSnapshot(world, personId) {
  return {
    player: Core.deepClone(world.player.relationships[personId] || null),
    reverse: Core.deepClone(World.getPerson(world, personId)?.relationships?.player || null)
  };
}

function incomingTerms(unit, ordinal) {
  if (ordinal % 2 === 0) {
    return {
      mode: unit.carePlan.mode === 'balanced' ? 'flexible' : 'balanced',
      playerTargetHours: Core.clamp(unit.carePlan.playerTargetHours + 0.5, 0.5, 10),
      partnerTargetHours: Core.clamp(unit.carePlan.partnerTargetHours, 0.5, 10),
      weeklyBudget: Core.clamp(unit.carePlan.weeklyBudget + 8, 10, 300),
      reason: 'deterministic family stress proposal with visible terms'
    };
  }
  return {
    label: `Family evening ${ordinal}`,
    meaning: 'A chosen recurring moment that records connection without creating control or legal status.'
  };
}

function createIncomingProposal(world, unit, partner, ordinal) {
  const type = ordinal % 2 === 0 ? 'care_plan' : 'family_ritual';
  return Family.createFamilyProposal(world, type, partner.id, ['player'], incomingTerms(unit, ordinal), {
    status: 'awaiting_player',
    familyUnitId: unit.id,
    householdId: unit.linkedHouseholdId,
    dueDay: world.time.day,
    expiresDay: world.time.day + 12
  });
}

function maybeOpenPlayerProposal(world, unit, elapsed, seedIndex) {
  if (elapsed === 12) {
    return Systems.proposeFamilyChange(world, unit.id, 'education_plan', {
      mode: seedIndex % 2 === 0 ? 'home_project_mix' : 'practical_apprenticeship'
    });
  }
  if (elapsed === 44) {
    return Systems.proposeFamilyChange(world, unit.id, 'family_ritual', {
      label: `Seed ${seedIndex + 1} chosen meal`,
      meaning: 'A visible shared ritual that does not imply ownership, obedience, or legal status.'
    });
  }
  if (elapsed === 78) {
    return Systems.proposeFamilyChange(world, unit.id, 'care_plan', {
      mode: seedIndex % 3 === 0 ? 'player_leads' : 'balanced',
      playerTargetHours: 2.5,
      partnerTargetHours: 2,
      weeklyBudget: 68
    });
  }
  return null;
}

function currentDependents(world, unit) {
  return Family.dependentMembers(world, unit).map((entry) => entry.person).filter((person) => Family.isDependent(person));
}

function run(seed, seedIndex) {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  world.player.money = 1_000_000;
  const variant = seedIndex % 2 === 0 ? 'young_child' : 'teen';
  const prepared = Systems.prepareFamilyContinuityExperiment(world, variant);
  assert.equal(prepared.ok, true, prepared.reason);
  const unit = Family.familyUnitById(world, prepared.familyUnitId);
  const primary = World.getPerson(world, prepared.dependentId);
  const partner = World.getPerson(world, prepared.partnerId);
  assert.ok(unit && primary && partner);
  partner.money = Math.max(partner.money, 50_000);
  primary.money = Math.max(primary.money, 7_500);

  if (variant === 'teen') {
    assert.equal(primary.lifeCourse.stage, 'teen');
    assert.equal(world.settings.lifeCourseMode, 'choice');
    assert.equal(world.settings.agePressure, false);
  }

  const trackedObjects = new Set(dependentObjectIds(world, unit.id));
  const counters = {
    careOffers: 0,
    careAccepted: 0,
    careRefused: 0,
    playerOriginProposals: 0,
    incomingObserved: 0,
    incomingAccepted: 0,
    incomingDeclined: 0,
    npcProposalAcceptances: 0,
    npcProposalDeclines: 0,
    secondDependentsWelcomed: 0,
    explicitChapterChoices: 0,
    separations: 0,
    checkpoints: 0
  };

  let lastAcceptedMetric = world.metrics.familyProposalsAccepted;
  let lastDeclinedMetric = world.metrics.familyProposalsDeclined;

  for (let elapsed = 0; elapsed < DAYS; elapsed += 1) {
    if (elapsed === 24 || elapsed === 68) {
      const incoming = createIncomingProposal(world, unit, partner, elapsed / 2 + seedIndex);
      assert.equal(incoming.ok, true, incoming.reason);
      counters.incomingObserved += 1;
      const planBefore = Core.deepClone(unit.carePlan);
      assert.equal(incoming.proposal.status, 'awaiting_player');
      if (incoming.proposal.type === 'care_plan') assert.deepEqual(unit.carePlan, planBefore, 'incoming proposal must not apply before the player answers');
    }

    const opened = maybeOpenPlayerProposal(world, unit, elapsed, seedIndex);
    if (opened) {
      assert.equal(opened.ok, true, opened.reason);
      assert.equal(opened.proposal.status, 'pending_npc');
      counters.playerOriginProposals += 1;
    }

    if (elapsed === 34 && seedIndex % 2 === 0) {
      const second = Family.welcomeDependent(world, unit, { stage: 'toddler', experiment: true });
      assert.equal(second.ok, true, second.reason);
      second.person.money = 1_000;
      dependentObjectIds(world, unit.id).forEach((id) => trackedObjects.add(id));
      counters.secondDependentsWelcomed += 1;
    }

    if (variant === 'teen' && elapsed === 54 + seedIndex) {
      const beforeObjects = new Set(dependentObjectIds(world, unit.id));
      const result = Systems.advanceLifeChapter(world, primary.id);
      assert.equal(result.ok, true, result.reason);
      assert.equal(result.transition.mode, 'choice');
      assert.equal(result.transition.noMissedWindow, true);
      assert.equal(primary.lifeCourse.stage, 'young_adult');
      assert.equal(world.settings.agePressure, false);
      const afterLocations = allObjectLocations(world);
      beforeObjects.forEach((id) => assert.ok(afterLocations.has(id), `${seed}: explicit life-chapter choice lost dependent object ${id}`));
      counters.explicitChapterChoices += 1;
    }

    const dependents = currentDependents(world, unit);
    if (dependents.length && elapsed % 3 === 0) {
      const person = dependents[(elapsed + seedIndex) % dependents.length];
      const actionId = CARE_ACTION_IDS[(elapsed / 3 + seedIndex) % CARE_ACTION_IDS.length];
      const result = Systems.performCareAction(world, person.id, actionId);
      assert.equal(result.ok, true, result.reason);
      counters.careOffers += 1;
      if (result.accepted) counters.careAccepted += 1;
      else counters.careRefused += 1;
    }

    Systems.advanceHours(world, 24, { freezePlayer: true });

    const awaiting = world.familyProposals.filter((proposal) => proposal.familyUnitId === unit.id && proposal.status === 'awaiting_player');
    awaiting.forEach((proposal) => {
      const relationBefore = relationSnapshot(world, partner.id);
      const ordinal = Number(proposal.id.split('_').at(-1)) || proposal.createdDay;
      const response = (seedIndex + ordinal) % 3 === 0 ? 'decline' : 'accept';
      const result = Systems.respondToFamilyProposal(world, proposal.id, response);
      assert.equal(result.ok, true, result.reason);
      if (response === 'decline') {
        counters.incomingDeclined += 1;
        assert.deepEqual(relationSnapshot(world, partner.id), relationBefore, 'declining a family proposal must not inject a hidden adult relationship penalty');
      } else {
        counters.incomingAccepted += 1;
      }
    });

    if (world.metrics.familyProposalsAccepted > lastAcceptedMetric) {
      counters.npcProposalAcceptances += world.metrics.familyProposalsAccepted - lastAcceptedMetric;
      lastAcceptedMetric = world.metrics.familyProposalsAccepted;
    }
    if (world.metrics.familyProposalsDeclined > lastDeclinedMetric) {
      counters.npcProposalDeclines += world.metrics.familyProposalsDeclined - lastDeclinedMetric;
      lastDeclinedMetric = world.metrics.familyProposalsDeclined;
    }

    if (elapsed === 118 && seedIndex % 2 === 0) {
      const household = Households.playerHousehold(world);
      if (household?.status === 'active') {
        const beforeIds = new Set(dependentObjectIds(world, unit.id));
        const result = Systems.endHouseholdAgreement(world, household.id, null, true);
        assert.equal(result.ok, true, result.reason);
        assert.equal(unit.status, 'continuing_separately');
        beforeIds.forEach((id) => assert.ok(allObjectLocations(world).has(id), `${seed}: separation lost dependent-owned object ${id}`));
        counters.separations += 1;
      }
    }

    if (elapsed % 15 === 0 || elapsed === DAYS - 1) {
      const validation = Systems.validateWorld(world);
      assert.equal(validation.ok, true, `${seed} loop ${elapsed}, world day ${world.time.day}: ${validation.errors.join('\n')}`);
      currentDependents(world, unit).forEach((person) => {
        assert.equal(person.jobId, null, `${seed}: dependent ${person.id} acquired an adult job`);
        assert.equal(person.rentArrears, 0, `${seed}: dependent ${person.id} acquired rent debt`);
      });
      counters.checkpoints += 1;
    }
  }

  // Finish any proposal whose autonomous answer became due on the last loop.
  Systems.advanceHours(world, 48, { freezePlayer: true });
  world.familyProposals.filter((proposal) => proposal.familyUnitId === unit.id && proposal.status === 'awaiting_player').forEach((proposal) => {
    const relationBefore = relationSnapshot(world, partner.id);
    const response = (seedIndex + proposal.createdDay) % 2 === 0 ? 'accept' : 'decline';
    const result = Systems.respondToFamilyProposal(world, proposal.id, response);
    assert.equal(result.ok, true, result.reason);
    if (response === 'decline') assert.deepEqual(relationSnapshot(world, partner.id), relationBefore);
  });

  const finalLocations = allObjectLocations(world);
  trackedObjects.forEach((id) => assert.ok(finalLocations.has(id), `${seed}: dependent-owned object ${id} was lost`));
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));

  const records = world.careRecords.filter((record) => record.familyUnitId === unit.id);
  const finalized = records.filter((record) => record.finalized);
  const members = Family.unitMembers(world, unit);
  const adultChildren = members.filter((entry) => entry.role === 'adult_child');
  const launched = adultChildren.filter((entry) => entry.leftDay).length;

  return {
    serialization: Core.serializeWorld(world),
    report: {
      seed,
      variant,
      loops: DAYS,
      worldDaysAdvanced: world.time.day,
      familyMembers: members.length,
      careRecords: records.length,
      finalizedCareDays: finalized.length,
      careNeedsMetDays: world.metrics.careNeedsMetDays,
      careStrainDays: world.metrics.careStrainDays,
      educationDays: world.metrics.educationDays,
      careHoursPlayer: Core.round(world.metrics.careHoursPlayer, 2),
      careHoursPartner: Core.round(world.metrics.careHoursPartner, 2),
      careHoursCommunity: Core.round(world.metrics.careHoursCommunity, 2),
      familySupportSpend: Core.round(world.metrics.familySupportSpend, 2),
      proposalsCreated: world.metrics.familyProposalsCreated,
      proposalsAccepted: world.metrics.familyProposalsAccepted,
      proposalsDeclined: world.metrics.familyProposalsDeclined,
      lifeStageTransitions: world.metrics.lifeStageTransitions,
      lifeCourseMode: world.settings.lifeCourseMode,
      agePressure: world.settings.agePressure,
      adultChildren: adultChildren.length,
      adultChildrenLaunched: launched,
      familyRelocations: world.metrics.familyRelocations,
      familySeparations: world.metrics.familySeparations,
      trackedDependentObjects: trackedObjects.size,
      finalDependentOwnedObjects: dependentObjectIds(world, unit.id).length,
      ...counters
    }
  };
}

const reports = [];
SEEDS.forEach((seed, seedIndex) => {
  const first = run(seed, seedIndex);
  const second = run(seed, seedIndex);
  assert.equal(first.serialization, second.serialization, `${seed}: family continuity evolution was not deterministic`);
  reports.push(first.report);
  console.log(`PASS ${seed} · care ${first.report.careAccepted}/${first.report.careOffers} accepted · proposals ${first.report.proposalsAccepted}/${first.report.proposalsCreated} accepted · transitions ${first.report.lifeStageTransitions}`);
});

const totals = reports.reduce((aggregate, report) => {
  Object.entries(report).forEach(([key, value]) => {
    if (typeof value === 'number') aggregate[key] = Core.round((aggregate[key] || 0) + value, 2);
  });
  return aggregate;
}, {});

if (SEEDS.length === ALL_SEEDS.length) {
  assert.ok(totals.careOffers > 0, 'stress run should offer real care actions');
  assert.ok(totals.careAccepted > 0, 'some care offers should be autonomously accepted');
  assert.ok(totals.careRefused > 0, 'some care offers should be autonomously refused');
  assert.ok(totals.careHoursPlayer > 0 && totals.careHoursPartner > 0 && totals.careHoursCommunity > 0, 'player, partner, and community care evidence should all be present');
  assert.ok(totals.educationDays > 0, 'dependent education should advance through the living clock');
  assert.ok(totals.playerOriginProposals > 0, 'player-origin family plans should be exercised');
  assert.ok(totals.incomingObserved > 0, 'partner-origin proposals should be observed before response');
  assert.ok(totals.incomingAccepted > 0, 'stress policy should accept some incoming family proposals');
  assert.ok(totals.incomingDeclined > 0, 'stress policy should preserve some human boundaries');
  assert.ok(totals.proposalsAccepted > 0 && totals.proposalsDeclined > 0, 'autonomous and human proposal outcomes should include acceptance and refusal');
  assert.ok(totals.secondDependentsWelcomed > 0, 'multi-dependent family units should be exercised');
  assert.ok(totals.lifeStageTransitions > 0 && totals.explicitChapterChoices > 0, 'teen worlds should enter autonomous adulthood through explicit chapter choices');
  assert.ok(totals.separations > 0, 'adult separation should preserve family continuity in stress worlds');
  assert.ok(totals.trackedDependentObjects > 0, 'dependent-owned objects should be tracked and preserved');
}


console.log(`\n${SEEDS.length}/${SEEDS.length} deterministic family worlds passed ${DAYS} simulation loops each, each run twice.`);
console.log(JSON.stringify({ seeds: SEEDS.length, loopsPerSeed: DAYS, deterministicRunsPerSeed: 2, totals, reports }, null, 2));
