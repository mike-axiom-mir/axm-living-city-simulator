'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Stewardship } = globalThis.AXM;
const ALL_SEEDS = Array.from({ length: 8 }, (_, index) => `AXM-STEWARDSHIP-STRESS-${String(index + 1).padStart(2, '0')}`);
const SEED_START = Math.max(1, Number.parseInt(process.env.AXM_STEWARDSHIP_STRESS_START || '1', 10));
const SEED_COUNT = Math.max(1, Math.min(8, Number.parseInt(process.env.AXM_STEWARDSHIP_STRESS_COUNT || '8', 10)));
const SEEDS = ALL_SEEDS.slice(SEED_START - 1, SEED_START - 1 + SEED_COUNT);
const DAYS = 240;

function allObjectIds(world) {
  const ids = new Set();
  world.places.filter((place) => place.kind === 'residential').forEach((property) => {
    property.furniture.forEach((object) => ids.add(object.id));
  });
  [world.player].concat(world.people).forEach((person) => (person.storedFurniture || []).forEach((object) => ids.add(object.id)));
  return ids;
}

function decisionFor(seedIndex, request, property) {
  const ordinal = Number(request.id.split('_').at(-1)) || request.createdDay;
  if ((seedIndex + ordinal) % 5 === 0) return 'decline';
  if (property.ownerId === 'player' && property.maintenanceReserve > 0 && (seedIndex + ordinal) % 2 === 0) return 'approve_owner_share';
  return 'approve_tenant_funded';
}

function run(seed, seedIndex) {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  world.player.money = Math.max(world.player.money, 1_000_000);
  const initialIds = allObjectIds(world);
  const prepared = Stewardship.prepareStewardshipExperiment(world);
  assert.equal(prepared.ok, true, prepared.reason);
  const counters = {
    playerApprovals: 0,
    playerDeclines: 0,
    ownerShareApprovals: 0,
    tenantFundedApprovals: 0,
    pendingObservedWithoutProject: 0,
    checkpoints: 0
  };

  for (let elapsed = 0; elapsed < DAYS; elapsed += 1) {
    Systems.advanceHours(world, 24, { freezePlayer: true });

    const pending = world.stewardshipRequests.filter((request) => request.status === 'pending_player');
    pending.forEach((request) => {
      const intention = Stewardship.intentionById(world, request.intentionId);
      const property = World.getProperty(world, request.propertyId);
      assert.ok(intention && property, 'pending player request must retain linked intention and property');
      assert.equal(intention.projectId, null, 'resident construction must not begin before the human decision');
      assert.equal(property.habitat.projects.some((project) => project.stewardshipIntentionId === intention.id), false, 'pending permission must not create a hidden project');
      counters.pendingObservedWithoutProject += 1;

      const response = decisionFor(seedIndex, request, property);
      const reserveBefore = property.maintenanceReserve;
      const relationBefore = Core.deepClone(world.player.relationships[request.residentId]);
      const result = Systems.respondToStewardshipRequest(world, request.id, response);
      assert.equal(result.ok, true, result.reason);
      if (response === 'decline') {
        counters.playerDeclines += 1;
        assert.equal(request.status, 'declined');
        assert.deepEqual(world.player.relationships[request.residentId], relationBefore, 'player boundary may not inject a hidden relationship penalty');
      } else {
        counters.playerApprovals += 1;
        if (response === 'approve_owner_share') {
          counters.ownerShareApprovals += 1;
          assert.ok(property.maintenanceReserve < reserveBefore, 'owner-share approval must visibly draw from maintenance reserve');
        } else {
          counters.tenantFundedApprovals += 1;
          assert.equal(property.maintenanceReserve, reserveBefore, 'tenant-funded approval must leave property reserve untouched');
        }
      }
    });

    if (elapsed % 20 === 0 || elapsed === DAYS - 1) {
      const validation = Systems.validateWorld(world);
      assert.equal(validation.ok, true, `${seed} day ${world.time.day}: ${validation.errors.join('\n')}`);
      counters.checkpoints += 1;
    }
  }

  const finalIds = allObjectIds(world);
  initialIds.forEach((id) => assert.ok(finalIds.has(id), `${seed}: original object ${id} was lost`));
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  const active = world.habitatIntentions.filter((entry) => !Stewardship.TERMINAL_INTENTION.has(entry.status));
  active.forEach((intention) => {
    assert.ok(intention.funding.escrow.money >= 0, `${seed}: negative active escrow`);
    assert.ok(World.getPerson(world, intention.residentId), `${seed}: active intention lost its resident`);
    assert.ok(World.getProperty(world, intention.propertyId), `${seed}: active intention lost its property`);
  });

  return {
    serialization: Core.serializeWorld(world),
    report: {
      seed,
      days: DAYS,
      formed: world.metrics.habitatIntentionsFormed,
      completed: world.metrics.habitatIntentionsCompleted,
      declined: world.metrics.habitatIntentionsDeclined,
      withdrawn: world.metrics.habitatIntentionsWithdrawn,
      failed: world.metrics.habitatIntentionsFailed,
      requests: world.metrics.stewardshipRequestsSubmitted,
      requestsApproved: world.metrics.stewardshipRequestsApproved,
      requestsDeclined: world.metrics.stewardshipRequestsDeclined,
      externalApprovals: world.metrics.stewardshipExternalApprovals,
      externalDeclines: world.metrics.stewardshipExternalDeclines,
      cotenantApprovals: world.metrics.stewardshipCotenantApprovals,
      cotenantDeclines: world.metrics.stewardshipCotenantDeclines,
      residentSavings: Core.round(world.metrics.stewardshipResidentSavings, 2),
      ownerContributions: Core.round(world.metrics.stewardshipOwnerContributions, 2),
      materialsPurchased: Core.round(world.metrics.stewardshipMaterialsPurchased, 2),
      phases: world.metrics.stewardshipProjectPhases,
      projectsCompleted: world.metrics.stewardshipProjectsCompleted,
      refunded: Core.round(world.metrics.stewardshipEscrowRefunded, 2),
      resaleLoss: Core.round(world.metrics.stewardshipMaterialResaleLoss, 2),
      activeAtEnd: active.length,
      objectCount: finalIds.size,
      ...counters
    }
  };
}

const reports = [];
SEEDS.forEach((seed, seedIndex) => {
  const first = run(seed, seedIndex);
  const second = run(seed, seedIndex);
  assert.equal(first.serialization, second.serialization, `${seed}: stewardship evolution was not deterministic`);
  reports.push(first.report);
  console.log(`PASS ${seed} · formed ${first.report.formed} · completed ${first.report.completed} · declined ${first.report.declined} · phases ${first.report.phases}`);
});

const numericTotals = reports.reduce((totals, report) => {
  Object.entries(report).forEach(([key, value]) => {
    if (typeof value === 'number') totals[key] = Core.round((totals[key] || 0) + value, 2);
  });
  return totals;
}, {});

if (SEEDS.length === ALL_SEEDS.length) {
  assert.ok(numericTotals.formed > 0, 'stress run should form resident-authored habitat intentions');
  assert.ok(numericTotals.requests > 0, 'stress run should submit permission requests');
  assert.ok(numericTotals.playerApprovals > 0, 'stress policy should approve player-owned tenant requests');
  assert.ok(numericTotals.playerDeclines > 0, 'stress policy should exercise a human boundary');
  assert.ok(numericTotals.externalApprovals > 0, 'external owner policy should approve at least one request');
  assert.ok(numericTotals.externalDeclines > 0, 'external owner policy should decline at least one request');
  assert.ok(numericTotals.cotenantApprovals > 0, 'co-tenants should approve at least one exact change');
  assert.ok(numericTotals.cotenantDeclines > 0, 'co-tenants should refuse at least one exact change');
  assert.ok(numericTotals.residentSavings > 0, 'resident project savings should be visible');
  assert.ok(numericTotals.ownerContributions > 0, 'property maintenance reserves should contribute in approved cases');
  assert.ok(numericTotals.phases > 0, 'residents should perform phased construction work');
  assert.ok(numericTotals.projectsCompleted > 0, 'some resident-authored projects should complete');
  assert.ok(numericTotals.pendingObservedWithoutProject > 0, 'pending requests should be observed before any project exists');
}


console.log(`\n${SEEDS.length}/${SEEDS.length} deterministic stewardship worlds passed ${DAYS} simulated days each, each run twice.`);
console.log(JSON.stringify({ seeds: SEEDS.length, daysPerSeed: DAYS, deterministicRunsPerSeed: 2, totals: numericTotals, reports }, null, 2));
