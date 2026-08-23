'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'src/core.js'));
require(path.join(ROOT, 'src/content.js'));
require(path.join(ROOT, 'src/world.js'));
require(path.join(ROOT, 'src/systems.js'));
require(path.join(ROOT, 'src/households.js'));
require(path.join(ROOT, 'src/habitats.js'));
require(path.join(ROOT, 'src/stewardship.js'));
require(path.join(ROOT, 'src/family.js'));
require(path.join(ROOT, 'src/community.js'));
require(path.join(ROOT, 'src/directions.js'));
require(path.join(ROOT, 'src/economy.js'));
require(path.join(ROOT, 'src/exteriors.js'));
require(path.join(ROOT, 'src/shells.js'));
require(path.join(ROOT, 'src/presence.js'));

const { Core, World, Systems, Households } = globalThis.AXM;
const ALL_SEEDS = Array.from({ length: 8 }, (_, index) => `AXM-HOUSEHOLD-STRESS-${String(index + 1).padStart(2, '0')}`);
const START_INDEX = Math.max(1, Number.parseInt(process.env.AXM_HOUSEHOLD_STRESS_START || '1', 10));
const SEED_COUNT = Math.max(1, Math.min(8, Number.parseInt(process.env.AXM_HOUSEHOLD_STRESS_COUNT || '8', 10)));
const SEEDS = ALL_SEEDS.slice(START_INDEX - 1, START_INDEX - 1 + SEED_COUNT);
const DAYS = 180;

function setStrongMutualRelationship(world, npc) {
  const relation = Systems.getRelation(world.player, npc.id);
  Object.assign(relation, { friendship: 100, trust: 100, romance: 100, status: 'dating', interactions: 10 });
  const reverse = Systems.getRelation(npc, 'player');
  Object.assign(reverse, { friendship: 95, trust: 95, romance: 95, status: 'dating', interactions: 10 });
}

function advanceUntilResolved(world, proposal, hours = 120) {
  for (let elapsed = 0; elapsed < hours && proposal.status === 'pending_npc'; elapsed += 1) Systems.advanceHours(world, 1);
  assert.notEqual(proposal.status, 'pending_npc', `${proposal.id} did not resolve in ${hours} hours`);
  assert.equal(proposal.status, 'implemented', `${proposal.id} ended as ${proposal.status}: ${JSON.stringify(proposal.response)}`);
}

function memberObjectIds(world, memberIds) {
  const ids = new Set();
  world.places.filter((place) => place.kind === 'residential').forEach((property) => {
    property.furniture.forEach((object) => {
      if (object.ownershipMode !== 'property_fixture' && memberIds.includes(object.ownerId)) ids.add(object.id);
    });
  });
  memberIds.forEach((id) => {
    const person = World.getPerson(world, id);
    (person.storedFurniture || []).forEach((object) => ids.add(object.id));
  });
  return ids;
}

function setupCohabitingWorld(seed) {
  const world = World.createWorld(seed);
  world.people.forEach((person) => { person.moveCooldownUntil = 9999; });
  const prep = Systems.prepareHouseholdExperiment(world);
  assert.equal(prep.ok, true, prep.reason);
  const partner = World.getPerson(world, prep.npcId);
  setStrongMutualRelationship(world, partner);
  world.player.money = 25000;
  partner.money = 25000;

  const commitment = Systems.proposeCommitment(world, partner.id);
  assert.equal(commitment.ok, true, commitment.reason);
  advanceUntilResolved(world, commitment.proposal);
  const household = Households.playerHousehold(world);
  assert.ok(household);

  const destination = Households.eligibleJointMoveProperties(world, household)
    .filter((property) => property.tenants.length === 0)
    .sort((a, b) => b.condition - a.condition || a.currentRent - b.currentRent)[0];
  assert.ok(destination, 'stress setup needs one vacant pair-capable property');
  const cohabitation = Systems.proposeCohabitation(world, partner.id, destination.id);
  assert.equal(cohabitation.ok, true, cohabitation.reason);
  advanceUntilResolved(world, cohabitation.proposal);
  assert.equal(Households.isCohabiting(world, household), true);

  const finance = Systems.proposeHouseholdChange(world, household.id, 'finance', {
    mode: 'income_weighted',
    weeklyReserveTarget: 12
  });
  assert.equal(finance.ok, true, finance.reason);
  advanceUntilResolved(world, finance.proposal);

  return { world, partner, household };
}

function responsePolicy(proposal, day) {
  // Deliberately exercise both human boundaries and implementation paths.
  if (proposal.type === 'relocation') return day % 4 === 0 ? 'accept' : 'decline';
  return day % 5 === 0 ? 'decline' : 'accept';
}

function repairPolicy(issue) {
  if (['space', 'independence'].includes(issue.type)) return 'give_space';
  if (issue.type === 'money') return 'practical_plan';
  return 'listen';
}

function run(seed) {
  const { world, partner, household } = setupCohabitingWorld(seed);
  const initialIds = memberObjectIds(world, household.memberIds);
  const counters = { acceptedIncoming: 0, declinedIncoming: 0, relocationPrompts: 0, repairAttempts: 0 };

  for (let day = 0; day < DAYS; day += 1) {
    const homeBeforeTick = household.homePropertyId;
    Systems.advanceHours(world, 24, { freezePlayer: true });

    const incoming = world.householdProposals.filter((proposal) => proposal.status === 'awaiting_player');
    if (incoming.some((proposal) => proposal.type === 'relocation')) {
      counters.relocationPrompts += incoming.filter((proposal) => proposal.type === 'relocation').length;
      assert.equal(household.homePropertyId, homeBeforeTick, 'an NPC relocation proposal changed the home before player consent');
      assert.equal(world.player.homePropertyId, homeBeforeTick, 'player moved before responding to an NPC relocation proposal');
      assert.equal(partner.homePropertyId, homeBeforeTick, 'partner moved unilaterally while cohabiting');
    }

    incoming.forEach((proposal) => {
      const response = responsePolicy(proposal, day);
      const result = Systems.respondToHouseholdProposal(world, proposal.id, response);
      assert.equal(result.ok, true, result.reason);
      if (response === 'accept') counters.acceptedIncoming += 1;
      else counters.declinedIncoming += 1;
    });

    if (day % 14 === 0) {
      const issue = household.unresolvedIssueIds.map((id) => Households.issueById(world, id)).find((entry) => entry?.status === 'open');
      if (issue) {
        const result = Systems.repairHouseholdIssue(world, household.id, issue.id, repairPolicy(issue));
        assert.equal(result.ok, true, result.reason);
        counters.repairAttempts += 1;
      }
    }

    if (day % 15 === 0 || day === DAYS - 1) {
      const validation = Systems.validateWorld(world);
      assert.equal(validation.ok, true, validation.errors.join('\n'));
    }
  }

  const finalIds = memberObjectIds(world, household.memberIds);
  initialIds.forEach((id) => assert.ok(finalIds.has(id), `member object ${id} was lost`));
  assert.equal(household.agreement.finances.personalAccountsRemainSeparate, true);
  assert.equal(household.agreement.finances.sharedReserveRequiresMutualConsent, true);
  assert.ok(household.sharedReserve >= 0);
  assert.ok(household.revision >= 2);
  assert.equal(world.player.householdId, household.id);
  assert.equal(partner.householdId, household.id);
  assert.equal(world.player.homePropertyId, partner.homePropertyId);
  const home = World.getProperty(world, household.homePropertyId);
  assert.ok(home.tenants.every((id) => household.memberIds.includes(id)), 'joint home gained an unrelated tenant without modelled consent');

  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  return {
    serialization: Core.serializeWorld(world),
    report: {
      seed,
      day: world.time.day,
      agreementRevision: household.revision,
      sharedReserve: Core.round(household.sharedReserve, 2),
      proposals: world.metrics.householdProposals,
      accepted: world.metrics.householdProposalsAccepted,
      declined: world.metrics.householdProposalsDeclined,
      counteroffers: world.metrics.householdCounteroffers,
      conflicts: world.metrics.householdConflicts,
      repairs: world.metrics.householdRepairs,
      relocations: world.metrics.householdRelocations,
      npcInitiatives: world.metrics.npcHouseholdInitiatives,
      objectCount: finalIds.size,
      ...counters
    }
  };
}

const reports = [];
for (const seed of SEEDS) {
  const first = run(seed);
  const second = run(seed);
  assert.equal(first.serialization, second.serialization, `${seed} household evolution was not deterministic`);
  reports.push(first.report);
  console.log(`PASS ${seed} · revision ${first.report.agreementRevision} · proposals ${first.report.proposals} · conflicts ${first.report.conflicts}`);
}

const totals = reports.reduce((sum, report) => {
  Object.entries(report).forEach(([key, value]) => {
    if (typeof value === 'number') sum[key] = (sum[key] || 0) + value;
  });
  return sum;
}, {});

assert.ok(totals.npcInitiatives > 0, 'stress run should contain NPC-authored household initiatives');
if (SEEDS.length === ALL_SEEDS.length) {
  assert.ok(totals.acceptedIncoming > 0, 'stress policy should accept at least one NPC-authored proposal');
  assert.ok(totals.declinedIncoming > 0, 'stress policy should exercise at least one player boundary');
}

console.log(`\n${SEEDS.length}/${SEEDS.length} deterministic household worlds passed ${DAYS} simulated days each.`);
console.log(JSON.stringify({ daysPerSeed: DAYS, seedStart: START_INDEX, seeds: SEEDS.length, totals, reports }, null, 2));
