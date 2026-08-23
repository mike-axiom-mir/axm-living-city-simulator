'use strict';

const assert = require('assert');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}
const { Core, World, Systems, Shells } = globalThis.AXM;

function run(seed, approve) {
  const world = World.createWorld(seed);
  Shells.initializeWorld(world, { silent: true });
  const experiment = Systems.prepareBuildingShellExperiment(world);
  assert.equal(experiment.ok, true, experiment.reason);
  const response = Systems.respondToFrontageProposal(world, experiment.proposal.id, approve ? 'approve' : 'decline');
  assert.equal(response.ok, true, response.reason);
  Systems.advanceHours(world, 24 * 180, { freezePlayer: true });
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.slice(0, 8).join('\n'));
  const metrics = Shells.metrics(world);
  assert.equal(metrics.connectedPlaces, world.places.length);
  assert.equal(metrics.facadeMaintenanceObligation, false);
  assert.equal(metrics.frontageDailyDecay, false);
  assert.equal(metrics.optimizationScore, false);
  return { world, metrics, serialized: Core.serializeWorld(world) };
}

const summary = {
  worlds: 0,
  daysPerWorld: 180,
  proposals: 0,
  approved: 0,
  declined: 0,
  completedProjects: 0,
  phases: 0,
  residentSavings: 0,
  buildings: 0,
  storeys: 0,
  windows: 0,
  validationFailures: 0
};

for (let index = 0; index < 8; index += 1) {
  const seed = `AXM-SHELL-STRESS-${String(index + 1).padStart(2, '0')}`;
  const a = run(seed, index % 2 === 0);
  const b = run(seed, index % 2 === 0);
  assert.equal(a.serialized, b.serialized, `${seed} did not replay exactly.`);
  summary.worlds += 1;
  summary.proposals += a.world.frontageProposals.length;
  summary.approved += a.world.frontageProposals.filter((entry) => ['project_created', 'completed'].includes(entry.status)).length;
  summary.declined += a.world.frontageProposals.filter((entry) => entry.status === 'declined').length;
  summary.completedProjects += a.world.frontageProjects.filter((entry) => entry.status === 'completed').length;
  summary.phases += a.world.metrics.frontageProjectPhases;
  summary.residentSavings = Core.round(summary.residentSavings + a.world.metrics.frontageResidentSavings, 2);
  summary.buildings += a.metrics.buildings;
  summary.storeys += a.metrics.storeys;
  summary.windows += a.metrics.windows;
  console.log(`PASS ${seed}: ${a.world.frontageProposals.length} proposals, ${a.metrics.completedProjects} completed, ${a.metrics.buildings} shells`);
}

console.log('\n' + JSON.stringify(summary, null, 2));
