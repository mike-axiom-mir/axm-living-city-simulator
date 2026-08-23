'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Households, Habitats, Stewardship, Family, Community, Directions, Economy, Exteriors, Shells, Presence } = globalThis.AXM;
const output = path.join(ROOT, 'examples');
fs.mkdirSync(output, { recursive: true });

function numericDelta(before, after) {
  return Object.fromEntries(
    Object.keys(after)
      .filter((key) => typeof after[key] === 'number' && typeof before[key] === 'number')
      .map((key) => [key, Core.round(after[key] - before[key], 2)])
  );
}

function writeLedger(filePath, title, world) {
  const ledger = [
    `# ${title}`,
    `Seed: ${world.seed}`,
    `Schema: ${world.schema}`,
    `Final simulation time: ${Core.formatDateTime(world)}`,
    `Invariant status: ${Systems.validateWorld(world).ok ? 'PASS' : 'FAIL'}`,
    '',
    ...world.ledger.map((entry) => {
      const causes = entry.causes?.length ? ` | causes: ${entry.causes.join('; ')}` : '';
      return `[Day ${entry.day}, ${String(entry.hour).padStart(2, '0')}:${String(entry.minute || 0).padStart(2, '0')}] [${entry.type}] ${entry.message}${causes}`;
    }),
    '',
  ];
  fs.writeFileSync(filePath, ledger.join('\n'), 'utf8');
}

function advanceProposal(world, proposal, maxHours = 120) {
  let elapsed = 0;
  while (proposal.status === 'pending_npc' && elapsed < maxHours) {
    Systems.advanceHours(world, 1);
    elapsed += 1;
  }
  if (proposal.status !== 'implemented') {
    throw new Error(`Example setup proposal ${proposal.id} resolved as ${proposal.status}: ${JSON.stringify(proposal.response || {})}`);
  }
  return elapsed;
}

function completeProject(world, project) {
  let guard = 0;
  while (['planned', 'active'].includes(project.status) && guard < 24) {
    const result = Systems.workHabitatProject(world, project.id);
    if (!result.ok) throw new Error(result.reason);
    guard += 1;
  }
  if (project.status !== 'completed') throw new Error(`Project ${project.id} did not complete: ${project.failureReason || project.status}`);
  return project;
}

function maxRelationship(world, npc) {
  const relation = Systems.getRelation(world.player, npc.id);
  Object.assign(relation, { friendship: 100, trust: 100, romance: 100, status: 'dating', interactions: Math.max(5, relation.interactions) });
  const reverse = Systems.getRelation(npc, 'player');
  Object.assign(reverse, { friendship: 100, trust: 100, romance: 100, status: 'dating', interactions: Math.max(5, reverse.interactions) });
}

function habitatSummary(property) {
  const facility = Habitats.facilityReport(property);
  return {
    propertyId: property.id,
    propertyName: property.name,
    ownerId: property.ownerId,
    revision: property.habitat.revision,
    layoutHash: property.habitat.layoutHash,
    structuralCondition: property.habitat.structuralCondition,
    rooms: property.habitat.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      purpose: room.purpose,
      area: room.area,
      floorFinishId: room.finish.floorFinishId,
      wallFinishId: room.finish.wallFinishId,
      utilityAccess: room.utilityAccess,
    })),
    partitions: property.habitat.partitions.length,
    doors: property.habitat.partitions.filter((entry) => entry.kind === 'door').length,
    projects: property.habitat.projects.map((project) => ({
      id: project.id,
      type: project.spec.type,
      summary: project.summary,
      status: project.status,
      authority: project.authority,
      completedPhases: project.completedPhaseIds.length,
      phaseCount: project.phases.length,
      spent: project.spent,
      completedDay: project.completedDay,
      failureReason: project.failureReason,
    })),
    facilityEvidence: {
      allRoomsReachable: facility.allRoomsReachable,
      reachableCellCount: facility.reachableCellCount,
      totalCellCount: facility.totalCellCount,
      bathroom: facility.bathroom,
      kitchen: facility.kitchen,
      sleepObjectsReachable: facility.sleepObjectsReachable,
    },
  };
}

function clearPropertyForExample(world, property) {
  const moved = [];
  for (const tenantId of property.tenants.slice()) {
    if (tenantId === 'player') continue;
    const tenant = World.getPerson(world, tenantId);
    const vacancy = world.places.find((candidate) => candidate.kind === 'residential'
      && candidate.id !== property.id
      && candidate.tenants.length < candidate.capacity
      && !candidate.tenants.includes('player')
      && candidate.listedForRent);
    if (!vacancy) throw new Error(`No lawful vacancy available for deterministic example tenant ${tenantId}.`);
    const result = Systems.moveNpc(world, tenant, vacancy, {
      waiveCost: true,
      causes: ['explicit deterministic example preparation', 'real vacant capacity'],
      evidence: { exampleSetup: true },
    });
    if (!result.ok) throw new Error(result.reason);
    moved.push({ tenantId, destinationPropertyId: vacancy.id });
  }
  return moved;
}

function createObserverExample() {
  const seed = 'AXM-LIVING-CITY-EXAMPLE-100D';
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  const report = Systems.runObserverDays(world, 100);

  fs.writeFileSync(path.join(output, 'AXM_100_DAY_OBSERVER_SNAPSHOT.json'), Core.serializeWorld(world) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_100_DAY_METRICS.json'), JSON.stringify({
    schema: 'axm.living-city-sim.qa-metrics/v0.6.0',
    seed,
    observerDays: 100,
    generatedBy: 'tools/generate_examples.js',
    before: report.before,
    after: report.after,
    observerEvidence: {
      changedPropertyCount: report.changedPropertyCount,
      changedPropertyIds: report.changedPropertyIds,
      changedProperties: report.changedProperties,
    },
    delta: numericDelta(report.before, report.after),
    validation: report.validation,
  }, null, 2) + '\n', 'utf8');
  writeLedger(path.join(output, 'AXM_100_DAY_LEDGER.txt'), 'AXM Living City — 100-Day Deterministic Example Ledger', world);
  return { seed, world, report };
}

function createHouseholdExample() {
  const seed = 'AXM-HOUSEHOLD-AGREEMENT-EXAMPLE-180D';
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  world.people.forEach((person) => { person.moveCooldownUntil = 30; });
  const prepared = Systems.prepareHouseholdExperiment(world);
  if (!prepared.ok) throw new Error(prepared.reason);
  const partner = World.getPerson(world, prepared.npcId);
  maxRelationship(world, partner);
  world.player.money = Math.max(world.player.money, 12000);
  partner.money = Math.max(partner.money, 12000);

  const commitment = Systems.proposeCommitment(world, partner.id);
  if (!commitment.ok) throw new Error(commitment.reason);
  advanceProposal(world, commitment.proposal);
  const household = Households.playerHousehold(world);
  if (!household) throw new Error('Commitment example did not create a household agreement.');

  const destination = Households.eligibleJointMoveProperties(world, household)
    .find((property) => property.tenants.length === 0);
  if (!destination) throw new Error('No vacant pair-capable home exists for the example.');
  const cohabitation = Systems.proposeCohabitation(world, partner.id, destination.id);
  if (!cohabitation.ok) throw new Error(cohabitation.reason);
  advanceProposal(world, cohabitation.proposal);

  const finance = Systems.proposeHouseholdChange(world, household.id, 'finance', {
    mode: 'income_weighted',
    weeklyReserveTarget: 12,
  });
  if (!finance.ok) throw new Error(finance.reason);
  advanceProposal(world, finance.proposal);

  world.people.forEach((person) => { person.moveCooldownUntil = 0; });
  const before = Systems.computeMetrics(world);
  const report = Systems.runObserverDays(world, 180);
  const validation = Systems.validateWorld(world);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));

  const householdRecord = world.households.find((entry) => entry.id === household.id);
  const sharedHome = World.getProperty(world, householdRecord.homePropertyId);
  const summary = {
    schema: 'axm.living-city-sim.household-example-report/v0.6.0',
    seed,
    generatedBy: 'tools/generate_examples.js',
    observerDaysAfterSetup: 180,
    setup: {
      partnerId: partner.id,
      partnerName: partner.name,
      commitmentProposalId: commitment.proposal.id,
      commitmentStatus: commitment.proposal.status,
      cohabitationProposalId: cohabitation.proposal.id,
      cohabitationStatus: cohabitation.proposal.status,
      destinationPropertyId: destination.id,
      destinationName: destination.name,
      financeProposalId: finance.proposal.id,
      financeStatus: finance.proposal.status,
    },
    finalHousehold: {
      id: householdRecord.id,
      status: householdRecord.status,
      revision: householdRecord.revision,
      homePropertyId: householdRecord.homePropertyId,
      sharedReserve: householdRecord.sharedReserve,
      strain: householdRecord.strain,
      unresolvedIssueIds: householdRecord.unresolvedIssueIds,
      financeMode: householdRecord.agreement.finances.mode,
      weeklyReserveTarget: householdRecord.agreement.finances.weeklyReserveTarget,
      spaceMode: householdRecord.agreement.space.mode,
      legacyZones: householdRecord.agreement.space.zones,
      roomGraphRevision: householdRecord.agreement.space.roomGraphRevision,
      roomPermissions: householdRecord.agreement.space.roomPermissions,
      historyEntries: householdRecord.history.length,
    },
    sharedHabitat: habitatSummary(sharedHome),
    before,
    after: report.after,
    delta: numericDelta(before, report.after),
    proposalStatusCounts: world.householdProposals.reduce((counts, proposal) => {
      counts[proposal.status] = (counts[proposal.status] || 0) + 1;
      return counts;
    }, {}),
    issueStatusCounts: world.householdIssues.reduce((counts, issue) => {
      counts[issue.status] = (counts[issue.status] || 0) + 1;
      return counts;
    }, {}),
    observerEvidence: {
      changedPropertyCount: report.changedPropertyCount,
      changedPropertyIds: report.changedPropertyIds,
    },
    validation,
  };

  fs.writeFileSync(path.join(output, 'AXM_HOUSEHOLD_AGREEMENT_180_DAY_WORLD.json'), Core.serializeWorld(world) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_HOUSEHOLD_AGREEMENT_180_DAY_REPORT.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
  writeLedger(path.join(output, 'AXM_HOUSEHOLD_AGREEMENT_180_DAY_LEDGER.txt'), 'AXM Household Agreement — 180-Day Deterministic Example Ledger', world);
  return { seed, world, report, summary };
}

function createStructuralExample() {
  const seed = 'AXM-STRUCTURAL-HABITAT-EXAMPLE';
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  const grant = Systems.developerGrant(world);
  if (!grant.ok) throw new Error(grant.reason);
  const property = World.getProperty(world, 'home_garden_2');
  const relocatedResidents = clearPropertyForExample(world, property);
  const purchase = Systems.buyProperty(world, property.id);
  if (!purchase.ok) throw new Error(purchase.reason);
  const move = Systems.moveIntoOwnedProperty(world, property.id);
  if (!move.ok) throw new Error(move.reason);

  const before = habitatSummary(property);
  const projectIds = [];

  const expressiveRoom = property.habitat.rooms.find((room) => !['bathroom', 'kitchen'].includes(room.purpose)) || property.habitat.rooms[0];
  const purpose = Systems.setRoomPurpose(world, property.id, expressiveRoom.id, 'hobby');
  if (!purpose.ok) throw new Error(purpose.reason);
  const finish = Habitats.FINISHES.find((entry) => entry.id !== expressiveRoom.finish.wallFinishId && entry.id === 'night_blue')
    || Habitats.FINISHES.find((entry) => entry.id !== expressiveRoom.finish.wallFinishId);
  const surface = Systems.requestHabitatProject(world, property.id, {
    type: 'surface',
    target: { roomId: expressiveRoom.id, surface: 'walls', finishId: finish.id },
  });
  if (!surface.ok) throw new Error(surface.reason);
  completeProject(world, surface.project);
  projectIds.push(surface.project.id);

  const serviceRoom = property.habitat.rooms.find((room) => !room.utilityAccess.water && room.id !== expressiveRoom.id)
    || property.habitat.rooms.find((room) => !room.utilityAccess.water);
  if (!serviceRoom) throw new Error('Structural example needs a dry room.');
  for (const utilityType of ['water', 'waste']) {
    const utility = Systems.requestHabitatProject(world, property.id, {
      type: 'utility',
      target: { roomId: serviceRoom.id, utilityType },
    });
    if (!utility.ok) throw new Error(utility.reason);
    completeProject(world, utility.project);
    projectIds.push(utility.project.id);
  }

  const edge = Habitats.listEdges(property).find((entry) => entry.current === 'open'
    && entry.roomIds[0]
    && entry.roomIds[0] === entry.roomIds[1]);
  if (!edge) throw new Error('Structural example needs an open internal edge.');
  const partition = Systems.requestHabitatProject(world, property.id, {
    type: 'partition',
    target: { edgeKey: edge.key, kind: 'door', materialId: 'reclaimed_timber' },
  });
  if (!partition.ok) throw new Error(partition.reason);
  completeProject(world, partition.project);
  projectIds.push(partition.project.id);

  if (property.habitat.structuralCondition < 99) {
    const repair = Systems.requestHabitatProject(world, property.id, { type: 'repair', target: { structure: 'whole_habitat' } });
    if (!repair.ok) throw new Error(repair.reason);
    completeProject(world, repair.project);
    projectIds.push(repair.project.id);
  }

  const validation = Systems.validateWorld(world);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  const after = habitatSummary(property);
  const report = {
    schema: 'axm.living-city-sim.structural-example-report/v0.5.0',
    seed,
    generatedBy: 'tools/generate_examples.js',
    setupDisclosure: {
      developerGrantUsed: true,
      preparedPropertyId: property.id,
      relocatedResidents,
      note: 'This is a deterministic QA/example setup, not claimed normal progression balance.',
    },
    before,
    after,
    completedProjectIds: projectIds,
    objectIdentityEvidence: {
      placedObjectIds: property.furniture.map((object) => object.id).sort(),
      playerStoredObjectIds: (world.player.storedFurniture || []).map((object) => object.id).sort(),
    },
    metrics: Systems.computeMetrics(world),
    validation,
  };

  fs.writeFileSync(path.join(output, 'AXM_STRUCTURAL_HABITAT_WORLD.json'), Core.serializeWorld(world) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_STRUCTURAL_HABITAT_RECORD.json'), JSON.stringify(property.habitat, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_STRUCTURAL_HABITAT_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  writeLedger(path.join(output, 'AXM_STRUCTURAL_HABITAT_LEDGER.txt'), 'AXM Structural Habitat — Deterministic Construction Ledger', world);
  return { seed, world, property, report };
}

function createStewardshipExample() {
  const seed = 'AXM-AUTONOMOUS-STEWARDSHIP-EXAMPLE';
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  world.player.money = Math.max(world.player.money, 100000);
  const setup = Stewardship.prepareStewardshipExperiment(world);
  if (!setup.ok) throw new Error(setup.reason);
  const property = World.getProperty(world, setup.propertyId);
  const resident = World.getPerson(world, setup.residentId);
  const request = Stewardship.requestById(world, setup.requestId);
  const intention = Stewardship.intentionById(world, setup.intentionId);
  resident.moveCooldownUntil = 9999;
  const reserveBefore = property.maintenanceReserve;
  const decision = Systems.respondToStewardshipRequest(world, request.id, 'approve_owner_share');
  if (!decision.ok) throw new Error(decision.reason);

  let elapsedDays = 0;
  while (!Stewardship.TERMINAL_INTENTION.has(intention.status) && elapsedDays < 120) {
    Systems.advanceHours(world, 24, { freezePlayer: true });
    elapsedDays += 1;
  }
  if (intention.status !== 'completed') throw new Error(`Stewardship example ended as ${intention.status}: ${intention.failureReason || 'no reason'}`);
  const project = Stewardship.intentionProject(world, intention);
  const validation = Systems.validateWorld(world);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));

  const report = {
    schema: 'axm.living-city-sim.autonomous-stewardship-example-report/v0.5.0',
    seed,
    generatedBy: 'tools/generate_examples.js',
    setupDisclosure: {
      labeledExperiment: true,
      propertyId: property.id,
      residentId: resident.id,
      ownershipTransferredWithoutEviction: !property.tenants.includes('player') && property.tenants.includes(resident.id),
      residentMoveFrozenForFocusedEvidence: true,
      note: 'The setup is an explicit QA shortcut. Funding after the initial disclosed seed progressed through the normal daily resident-saving loop.',
    },
    authorityEvidence: {
      requestId: request.id,
      status: request.status,
      playerAuthority: request.authorities.player,
      externalOwnerAuthority: request.authorities.externalOwner,
      coTenantAuthority: request.authorities.coTenants,
      proposedOwnerContribution: request.proposedOwnerContribution,
      acceptedOwnerContribution: request.acceptedOwnerContribution,
      reserveBefore,
      reserveAfter: property.maintenanceReserve,
    },
    intentionEvidence: {
      id: intention.id,
      status: intention.status,
      summary: intention.summary,
      reasons: intention.reasons,
      budget: intention.funding.budget,
      contributionTotals: intention.funding.contributionTotals,
      materialPurchaseEvidence: intention.funding.materialPurchaseEvidence,
      completedDay: intention.completedDay,
      historyEntries: intention.history.length,
    },
    projectEvidence: project ? {
      id: project.id,
      creatorId: project.creatorId,
      resourceMode: project.resourceMode,
      status: project.status,
      completedPhaseIds: project.completedPhaseIds,
      phaseCount: project.phases.length,
      spent: project.spent,
      authority: project.authority,
    } : null,
    propertyEvidence: {
      id: property.id,
      ownerId: property.ownerId,
      tenantIds: property.tenants,
      maintenanceReserve: property.maintenanceReserve,
      completedIntentionIds: property.stewardship.completedIntentionIds,
      requestIds: property.stewardship.requestIds,
      habitatRevision: property.habitat.revision,
      layoutHash: property.habitat.layoutHash,
      historyEntries: property.history.length,
    },
    elapsedDays,
    metrics: Systems.computeMetrics(world),
    validation,
  };

  fs.writeFileSync(path.join(output, 'AXM_AUTONOMOUS_STEWARDSHIP_WORLD.json'), Core.serializeWorld(world) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_AUTONOMOUS_STEWARDSHIP_INTENTION_RECORD.json'), JSON.stringify(intention, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_AUTONOMOUS_STEWARDSHIP_REQUEST_RECORD.json'), JSON.stringify(request, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_AUTONOMOUS_STEWARDSHIP_PROPERTY_RECORD.json'), JSON.stringify(property.stewardship, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_AUTONOMOUS_STEWARDSHIP_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  writeLedger(path.join(output, 'AXM_AUTONOMOUS_STEWARDSHIP_LEDGER.txt'), 'AXM Autonomous Habitat Stewardship — Deterministic Evidence Ledger', world);
  return { seed, world, property, resident, request, intention, project, report };
}


function createFamilyExample() {
  const seed = 'AXM-FAMILY-CONTINUITY-EXAMPLE-120D';
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  world.player.money = Math.max(world.player.money, 100000);
  const setup = Systems.prepareFamilyContinuityExperiment(world, 'teen');
  if (!setup.ok) throw new Error(setup.reason);
  const unit = Family.familyUnitById(world, setup.familyUnitId);
  const teen = World.getPerson(world, setup.dependentId);
  const partner = World.getPerson(world, setup.partnerId);
  const home = World.getProperty(world, setup.propertyId);
  if (!unit || !teen || !partner || !home) throw new Error('Family example setup references are incomplete.');
  maxRelationship(world, partner);
  partner.money = Math.max(partner.money, 50000);
  teen.money = Math.max(teen.money, 12000);
  teen.lifeCourse.ageDays = 18 * 365 - 36;
  teen.lifeCourse.ageYears = 17;
  teen.lifeCourse.stage = 'teen';
  teen.age = 17;

  const toddlerArrival = Family.welcomeDependent(world, unit, { stage: 'toddler', experiment: true });
  if (!toddlerArrival.ok) throw new Error(toddlerArrival.reason);
  const toddler = toddlerArrival.person;
  const initialDependentObjectIds = new Set();
  const captureDependentObjects = () => {
    const familyPersonIds = new Set(unit.members.filter((member) => ['dependent', 'adult_child'].includes(member.role)).map((member) => member.personId));
    world.places.filter((property) => property.kind === 'residential').forEach((property) => property.furniture
      .filter((object) => familyPersonIds.has(object.ownerId))
      .forEach((object) => initialDependentObjectIds.add(object.id)));
    world.people.filter((person) => familyPersonIds.has(person.id)).forEach((person) => (person.storedFurniture || [])
      .filter((object) => object.ownerId === person.id)
      .forEach((object) => initialDependentObjectIds.add(object.id)));
  };
  captureDependentObjects();

  const initialCare = [
    Systems.performCareAction(world, teen.id, 'listen_check_in'),
    Systems.performCareAction(world, toddler.id, 'share_meal'),
  ];
  initialCare.forEach((result) => { if (!result.ok) throw new Error(result.reason); });

  const education = Systems.proposeFamilyChange(world, unit.id, 'education_plan', { mode: 'home_project_mix' });
  if (!education.ok) throw new Error(education.reason);
  advanceProposal(world, education.proposal);

  const relationBeforeBoundary = {
    player: Core.deepClone(world.player.relationships[partner.id]),
    reverse: Core.deepClone(partner.relationships.player),
  };
  const incoming = Family.createFamilyProposal(world, 'family_ritual', partner.id, ['player'], {
    label: 'Sunday reset',
    meaning: 'A suggested shared rhythm that remains optional and does not create legal or control authority.',
  }, {
    status: 'awaiting_player',
    familyUnitId: unit.id,
    householdId: unit.linkedHouseholdId,
    dueDay: world.time.day,
    expiresDay: world.time.day + 10,
  });
  if (!incoming.ok) throw new Error(incoming.reason);
  const boundaryResponse = Systems.respondToFamilyProposal(world, incoming.proposal.id, 'decline');
  if (!boundaryResponse.ok) throw new Error(boundaryResponse.reason);
  const relationAfterBoundary = {
    player: Core.deepClone(world.player.relationships[partner.id]),
    reverse: Core.deepClone(partner.relationships.player),
  };
  if (JSON.stringify(relationBeforeBoundary) !== JSON.stringify(relationAfterBoundary)) {
    throw new Error('Declining the example family proposal changed relationship state.');
  }

  const careActionIds = Object.keys(Family.CARE_ACTIONS);
  const counters = { offered: 0, accepted: 0, refused: 0, incomingAccepted: 0, incomingDeclined: 1 };
  for (let elapsed = 0; elapsed < 120; elapsed += 1) {
    const activeDependents = Family.dependentMembers(world, unit)
      .map((entry) => entry.person)
      .filter((person) => Family.isDependent(person));
    if (activeDependents.length && elapsed % 4 === 0) {
      const person = activeDependents[elapsed % activeDependents.length];
      const actionId = careActionIds[(elapsed / 4) % careActionIds.length];
      const result = Systems.performCareAction(world, person.id, actionId);
      if (!result.ok) throw new Error(result.reason);
      counters.offered += 1;
      if (result.accepted) counters.accepted += 1;
      else counters.refused += 1;
    }
    Systems.advanceHours(world, 24, { freezePlayer: true });
    world.familyProposals.filter((proposal) => proposal.familyUnitId === unit.id && proposal.status === 'awaiting_player').forEach((proposal) => {
      const relationBefore = {
        player: Core.deepClone(world.player.relationships[partner.id]),
        reverse: Core.deepClone(partner.relationships.player),
      };
      const accept = (proposal.createdDay + proposal.id.length) % 3 !== 0;
      const result = Systems.respondToFamilyProposal(world, proposal.id, accept ? 'accept' : 'decline');
      if (!result.ok) throw new Error(result.reason);
      if (accept) counters.incomingAccepted += 1;
      else {
        counters.incomingDeclined += 1;
        const relationAfter = {
          player: Core.deepClone(world.player.relationships[partner.id]),
          reverse: Core.deepClone(partner.relationships.player),
        };
        if (JSON.stringify(relationBefore) !== JSON.stringify(relationAfter)) {
          throw new Error(`Declining family proposal ${proposal.id} changed relationship state.`);
        }
      }
    });
  }
  Systems.advanceHours(world, 48, { freezePlayer: true });
  world.familyProposals.filter((proposal) => proposal.familyUnitId === unit.id && proposal.status === 'awaiting_player').forEach((proposal) => {
    const result = Systems.respondToFamilyProposal(world, proposal.id, 'decline');
    if (!result.ok) throw new Error(result.reason);
    counters.incomingDeclined += 1;
  });

  const validation = Systems.validateWorld(world);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  const finalLocations = new Set();
  world.places.filter((property) => property.kind === 'residential').forEach((property) => property.furniture.forEach((object) => finalLocations.add(object.id)));
  [world.player].concat(world.people).forEach((person) => (person.storedFurniture || []).forEach((object) => finalLocations.add(object.id)));
  const lostDependentObjectIds = Array.from(initialDependentObjectIds).filter((id) => !finalLocations.has(id));
  if (lostDependentObjectIds.length) throw new Error(`Family example lost dependent objects: ${lostDependentObjectIds.join(', ')}`);

  const teenMember = unit.members.find((member) => member.personId === teen.id);
  const report = {
    schema: 'axm.living-city-sim.family-continuity-example-report/v0.6.0',
    seed,
    generatedBy: 'tools/generate_examples.js',
    setupDisclosure: {
      labeledExperiment: true,
      note: 'The initial partner, home, and two dependents use explicit QA shortcuts; all later care, refusal, education, aging, proposal, and housing outcomes use the normal deterministic systems.',
      familyUnitId: unit.id,
      householdId: unit.linkedHouseholdId,
      homePropertyId: home.id,
      homeListedForRentAfterFamilyPlan: home.listedForRent,
      teenId: teen.id,
      toddlerId: toddler.id,
    },
    authorityEvidence: {
      adultHouseholdMemberIds: Households.householdById(world, unit.linkedHouseholdId)?.memberIds || [],
      familyMemberIds: unit.members.map((member) => member.personId),
      declinedProposalId: incoming.proposal.id,
      declinedProposalStatus: incoming.proposal.status,
      relationshipUnchangedByDecline: JSON.stringify(relationBeforeBoundary) === JSON.stringify(relationAfterBoundary),
      boundary: 'adult household consent, family care authority, and property authority remain separate',
    },
    lifeCourseEvidence: {
      teenFinalStage: teen.lifeCourse.stage,
      teenFinalAge: teen.age,
      teenTransitionHistory: teen.lifeCourse.transitionHistory,
      teenMemberRole: teenMember?.role || null,
      teenLeftFamilyHomeDay: teenMember?.leftDay || null,
      teenHomePropertyId: teen.homePropertyId,
      toddlerFinalStage: toddler.lifeCourse.stage,
      lifeStageTransitions: world.metrics.lifeStageTransitions,
      adultChildrenLaunched: world.metrics.adultChildrenLaunched,
    },
    careEvidence: {
      counters,
      records: world.careRecords.filter((record) => record.familyUnitId === unit.id).length,
      finalizedRecords: world.careRecords.filter((record) => record.familyUnitId === unit.id && record.finalized).length,
      careHoursPlayer: world.metrics.careHoursPlayer,
      careHoursPartner: Core.round(world.metrics.careHoursPartner, 2),
      careHoursCommunity: Core.round(world.metrics.careHoursCommunity, 2),
      careNeedsMetDays: world.metrics.careNeedsMetDays,
      careStrainDays: world.metrics.careStrainDays,
      educationDays: world.metrics.educationDays,
      familySupportSpend: world.metrics.familySupportSpend,
    },
    proposalEvidence: {
      total: world.familyProposals.length,
      accepted: world.metrics.familyProposalsAccepted,
      declined: world.metrics.familyProposalsDeclined,
      pending: world.familyProposals.filter((proposal) => ['pending_npc', 'awaiting_player', 'waiting_space'].includes(proposal.status)).length,
      educationProposalId: education.proposal.id,
      educationProposalStatus: education.proposal.status,
    },
    objectEvidence: {
      trackedDependentObjectIds: Array.from(initialDependentObjectIds).sort(),
      lostDependentObjectIds,
    },
    finalFamilyMetrics: Family.metrics(world),
    validation,
  };

  const representativeCare = world.careRecords.find((record) => record.familyUnitId === unit.id && record.actions.length) || world.careRecords[0];
  const representativeProposal = world.familyProposals.find((proposal) => proposal.id === incoming.proposal.id) || world.familyProposals[0];
  fs.writeFileSync(path.join(output, 'AXM_FAMILY_CONTINUITY_WORLD.json'), Core.serializeWorld(world) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_FAMILY_UNIT_RECORD.json'), JSON.stringify(unit, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_FAMILY_PROPOSAL_RECORD.json'), JSON.stringify(representativeProposal, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_CARE_RECORD.json'), JSON.stringify(representativeCare, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_LIFE_COURSE_RECORD.json'), JSON.stringify(teen.lifeCourse, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_FAMILY_CONTINUITY_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  writeLedger(path.join(output, 'AXM_FAMILY_CONTINUITY_LEDGER.txt'), 'AXM Family Continuity — 120-Day Deterministic Evidence Ledger', world);
  return { seed, world, unit, teen, toddler, report };
}


function createCommunityExample() {
  const seed = 'AXM-COMMUNITY-ADVENTURES-EXAMPLE-120D';
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  world.player.money = Math.max(world.player.money, 250000);
  world.people.forEach((person) => {
    person.moveCooldownUntil = 9999;
    person.habitatIntentionCooldownUntil = 9999;
  });

  const setup = Systems.prepareCommunityAdventureExperiment(world);
  if (!setup.ok) throw new Error(setup.reason);
  const waitingInstitution = Community.institutionById(world, setup.institutionId);
  const waitingMembership = Community.membershipFor(waitingInstitution, 'player');
  const incoming = world.communityOpportunities.find((entry) => entry.status === 'awaiting_player');
  if (!waitingInstitution || !waitingMembership || !incoming) throw new Error('Community example setup is incomplete.');

  const host = World.getPerson(world, incoming.hostId);
  const relationBeforeDecline = {
    player: Core.deepClone(world.player.relationships[host.id] || null),
    reverse: Core.deepClone(host.relationships.player || null),
  };
  const playerBeforeDecline = {
    money: world.player.money,
    needs: Core.deepClone(world.player.needs),
    skills: Core.deepClone(world.player.skills),
  };
  const declined = Systems.respondToCommunityOpportunity(world, incoming.id, 'decline');
  if (!declined.ok) throw new Error(declined.reason);
  const relationAfterDecline = {
    player: Core.deepClone(world.player.relationships[host.id] || null),
    reverse: Core.deepClone(host.relationships.player || null),
  };
  const playerAfterDecline = {
    money: world.player.money,
    needs: Core.deepClone(world.player.needs),
    skills: Core.deepClone(world.player.skills),
  };

  const leavingMember = Community.activeMembers(waitingInstitution)[0];
  leavingMember.status = 'left';
  leavingMember.leftDay = world.time.day;
  Community.processWaitlist(world, waitingInstitution);
  if (Community.membershipFor(waitingInstitution, 'player')?.status !== 'active') throw new Error('Visible waiting state did not promote after a real opening.');

  const dropIn = world.communityOpportunities
    .filter((entry) => entry.status === 'open' && entry.kind === 'drop_in' && entry.participantIds.length < entry.capacity)
    .sort((a, b) => a.eventDay - b.eventDay || a.startHour - b.startHour)[0];
  if (!dropIn) throw new Error('No available community drop-in exists for the example.');
  const participation = Systems.participateCommunityOpportunity(world, dropIn.id);
  if (!participation.ok || participation.waitlisted) throw new Error(participation.reason || 'Example community participation only entered a waiting state.');

  const adventure = Community.activeAdventureFor(world, 'player');
  if (!adventure) throw new Error('Labeled community example did not create a no-deadline adventure.');
  while (adventure.status === 'active') {
    const continued = Systems.continueAdventure(world, adventure.id);
    if (!continued.ok) throw new Error(continued.reason);
  }

  const connection = world.communityConnections.find((entry) => entry.personIds.includes('player'));
  if (connection) {
    const personId = connection.personIds.find((id) => id !== 'player');
    const person = World.getPerson(world, personId);
    if (person && !Family.isDependent(person)) {
      Object.assign(Systems.getRelation(world.player, person.id), { friendship: 100, trust: 100 });
      Object.assign(Systems.getRelation(person, 'player'), { friendship: 100, trust: 100 });
      const invite = Systems.inviteCommunityConnection(world, person.id);
      if (invite.ok) {
        Systems.advanceHours(world, 48);
        if (invite.opportunity.status === 'available') {
          const visit = Systems.participateCommunityOpportunity(world, invite.opportunity.id);
          if (!visit.ok) throw new Error(visit.reason);
        }
      }
    }
  }

  const beforeObserver = Systems.computeMetrics(world);
  const observer = Systems.runObserverDays(world, 120);
  const validation = Systems.validateWorld(world);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));

  const report = {
    schema: 'axm.living-city-sim.community-adventures-example-report/v0.6.0',
    seed,
    generatedBy: 'tools/generate_examples.js',
    observerDaysAfterSetup: 120,
    casualRealismRoot: {
      casualRealism: world.settings.casualRealism,
      noDailyStreaks: world.settings.noDailyStreaks,
      opportunityExpiryPenalty: world.settings.opportunityExpiryPenalty,
      compressedBasicsAction: 'gentle_routine',
      principle: 'be yourself; find your adventure; do no harm; grow in your own way',
    },
    refusalEvidence: {
      invitationId: incoming.id,
      status: incoming.status,
      relationshipUnchanged: JSON.stringify(relationBeforeDecline) === JSON.stringify(relationAfterDecline),
      playerStateUnchanged: JSON.stringify(playerBeforeDecline) === JSON.stringify(playerAfterDecline),
      hiddenPenalty: false,
    },
    membershipEvidence: {
      institutionId: waitingInstitution.id,
      membershipId: waitingMembership.id,
      finalStatus: waitingMembership.status,
      capacity: waitingInstitution.capacity,
      activeMembers: Community.activeMembers(waitingInstitution).length,
      promotedOnlyAfterOpening: true,
      attendanceDuty: false,
    },
    opportunityEvidence: {
      opportunityId: dropIn.id,
      status: dropIn.status,
      eventDay: dropIn.eventDay,
      durationHours: dropIn.durationHours,
      authority: dropIn.authority,
      playerCompletedDay: dropIn.playerCompletedDay,
    },
    adventureEvidence: {
      adventureId: adventure.id,
      title: adventure.title,
      noDeadline: adventure.noDeadline,
      status: adventure.status,
      completedStages: adventure.stages.filter((stage) => stage.status === 'completed').length,
      totalStages: adventure.stages.length,
      companionId: adventure.companionId,
    },
    beforeObserver,
    afterObserver: observer.after,
    delta: numericDelta(beforeObserver, observer.after),
    finalMetrics: Community.metrics(world),
    validation,
  };

  const representativeInstitution = waitingInstitution;
  const representativeOpportunity = world.communityOpportunities.find((entry) => entry.id === dropIn.id) || world.communityOpportunities[0];
  const representativeConnection = world.communityConnections.find((entry) => entry.personIds.includes('player')) || world.communityConnections[0];
  const representativeAdventure = world.adventureThreads.find((entry) => entry.id === adventure.id) || world.adventureThreads[0];
  fs.writeFileSync(path.join(output, 'AXM_COMMUNITY_ADVENTURES_WORLD.json'), Core.serializeWorld(world) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_COMMUNITY_INSTITUTION_RECORD.json'), JSON.stringify(representativeInstitution, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_COMMUNITY_OPPORTUNITY_RECORD.json'), JSON.stringify(representativeOpportunity, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_COMMUNITY_CONNECTION_RECORD.json'), JSON.stringify(representativeConnection, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_ADVENTURE_THREAD_RECORD.json'), JSON.stringify(representativeAdventure, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_COMMUNITY_ADVENTURES_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  writeLedger(path.join(output, 'AXM_COMMUNITY_ADVENTURES_LEDGER.txt'), 'AXM Community Adventures — Casual-Realism Evidence Ledger', world);
  return { seed, world, report, representativeInstitution, representativeOpportunity, representativeConnection, representativeAdventure };
}


function createPersonalDirectionsExample() {
  const seed = 'AXM-PERSONAL-DIRECTIONS-EXAMPLE-120D';
  const world = World.createWorld(seed);
  world.player.money = Math.max(world.player.money, 5000);
  Object.keys(world.player.materials || {}).forEach((id) => {
    world.player.materials[id] = Math.max(world.player.materials[id], 12);
  });

  const owned = Directions.ownedObjects(world, 'player')
    .slice()
    .sort((a, b) => ((b.object.sentimental || 0) + (100 - (b.object.condition || 100)))
      - ((a.object.sentimental || 0) + (100 - (a.object.condition || 100))) || a.object.id.localeCompare(b.object.id));
  if (!owned.length) throw new Error('No player-owned object exists for the personal-directions example.');
  const target = owned[0];
  target.object.condition = Math.min(target.object.condition, 42);
  target.object.sentimental = Math.max(target.object.sentimental, 14);
  const targetId = target.object.id;
  const targetHistoryBefore = target.object.history.length;
  const targetConditionBefore = target.object.condition;
  const targetSentimentBefore = target.object.sentimental;

  const created = Systems.createPersonalProject(world, {
    templateId: 'restoration',
    targetObjectId: targetId,
    title: 'The chair that came with me',
    meaning: 'Its history matters more than replacing it with the statistically newest object.'
  });
  if (!created.ok) throw new Error(created.reason);
  const project = created.project;

  let result = Systems.workPersonalProject(world, project.id);
  if (!result.ok) throw new Error(result.reason);
  result = Systems.pausePersonalProject(world, project.id);
  if (!result.ok) throw new Error(result.reason);
  result = Systems.resumePersonalProject(world, project.id);
  if (!result.ok) throw new Error(result.reason);
  result = Systems.reshapePersonalProject(
    world,
    project.id,
    'The chair that keeps changing with me',
    'Preserve its old history, make it useful now, and leave room for what it may become later.'
  );
  if (!result.ok) throw new Error(result.reason);

  const collaborator = world.people.find((person) => !Family.isDependent(person));
  let collaborationRequest = null;
  if (collaborator) {
    Community.ensureConnection(world, 'player', collaborator.id, 'creative_partner', {
      warmthGain: 18,
      trustGain: 14,
      message: `${world.player.name} and ${collaborator.name} already shared one grounded community moment.`,
      causes: ['explicit example preparation', 'lived connection required before collaboration'],
      evidence: { labeledExample: true }
    });
    const invited = Systems.inviteProjectCollaborator(world, project.id, collaborator.id);
    if (!invited.ok) throw new Error(invited.reason);
    collaborationRequest = invited.request;
    Systems.advanceHours(world, 48, { freezePlayer: true });
  }

  const stageBeforeChoice = world.player.lifeCourse.stage;
  const lifeChoice = Systems.advanceLifeChapter(world, 'player');
  if (!lifeChoice.ok) throw new Error(lifeChoice.reason);
  if (project.status !== 'active' || project.target.objectId !== targetId) {
    throw new Error('The open personal project did not survive the explicit life-chapter choice.');
  }

  let guard = 0;
  while (project.status === 'active' && guard < 12) {
    result = Systems.workPersonalProject(world, project.id);
    if (!result.ok) throw new Error(result.reason);
    guard += 1;
  }
  if (project.status !== 'completed') throw new Error(`Personal restoration did not complete: ${project.status}`);
  const completedTarget = Directions.findOwnedObject(world, 'player', targetId);
  if (!completedTarget) throw new Error('Restoration target disappeared at completion.');
  const targetConditionAtCompletion = completedTarget.object.condition;
  const targetSentimentAtCompletion = completedTarget.object.sentimental;
  const targetHistoryAtCompletion = completedTarget.object.history.length;
  if (targetConditionAtCompletion <= targetConditionBefore) {
    throw new Error('The restoration chapters did not improve object condition at completion.');
  }

  const releasedCreated = Systems.createPersonalProject(world, {
    templateId: 'creative',
    targetPlaceId: 'place_library',
    title: 'A story I may never owe anyone',
    meaning: 'The direction can be meaningful even when I decide not to finish or publish it.'
  });
  if (!releasedCreated.ok) throw new Error(releasedCreated.reason);
  const releasedProject = releasedCreated.project;
  result = Systems.releasePersonalProject(world, releasedProject.id);
  if (!result.ok) throw new Error(result.reason);

  const anchor = {
    age: world.player.age,
    ageYears: world.player.lifeCourse.ageYears,
    ageDays: world.player.lifeCourse.ageDays,
    stage: world.player.lifeCourse.stage,
    chapterDays: world.player.lifeCourse.chapterDays,
  };
  const beforeObserver = Systems.computeMetrics(world);
  const observer = Systems.runObserverDays(world, 120);
  const validation = Systems.validateWorld(world);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  if (world.player.age !== anchor.age
      || world.player.lifeCourse.ageYears !== anchor.ageYears
      || world.player.lifeCourse.ageDays !== anchor.ageDays
      || world.player.lifeCourse.stage !== anchor.stage) {
    throw new Error('Choice-first life context changed under ordinary simulated time.');
  }
  if (world.settings.lifeCourseMode !== 'choice' || world.settings.agePressure !== false) {
    throw new Error('Choice-first no-age-pressure settings drifted during the example.');
  }

  const finalTarget = Directions.findOwnedObject(world, 'player', targetId);
  if (!finalTarget || finalTarget.object.id !== targetId) throw new Error('Restoration target identity was lost.');
  const report = {
    schema: 'axm.living-city-sim.personal-directions-example-report/v0.7.0',
    seed,
    generatedBy: 'tools/generate_examples.js',
    observerDaysAfterSetup: 120,
    choiceFirstEvidence: {
      mode: world.settings.lifeCourseMode,
      agePressure: world.settings.agePressure,
      exactAgesVisible: world.settings.showExactAges,
      stageBeforeExplicitChoice: stageBeforeChoice,
      stageAfterExplicitChoice: anchor.stage,
      explicitTransition: lifeChoice.transition,
      ageAtObserverStart: anchor.age,
      ageAtObserverEnd: world.player.age,
      ageDaysAtObserverStart: anchor.ageDays,
      ageDaysAtObserverEnd: world.player.lifeCourse.ageDays,
      chapterDaysAdvancedWithoutCalendarAging: world.player.lifeCourse.chapterDays - anchor.chapterDays,
      missedWindow: false,
    },
    restorationEvidence: {
      projectId: project.id,
      status: project.status,
      noDeadline: project.noDeadline,
      noAgeGate: project.noAgeGate,
      ageGate: project.ageGate,
      exactAgeRequired: project.lifeContext.exactAgeRequired,
      createdLifeChapter: project.lifeContext.stageAtCreation,
      completedLifeChapter: anchor.stage,
      survivedExplicitChapterChoice: true,
      targetObjectId: targetId,
      objectIdentityPreserved: finalTarget.object.id === targetId,
      conditionBefore: targetConditionBefore,
      conditionAfterCompletion: targetConditionAtCompletion,
      conditionAfter120OrdinaryDays: finalTarget.object.condition,
      sentimentalBefore: targetSentimentBefore,
      sentimentalAfterCompletion: targetSentimentAtCompletion,
      sentimentalAfter120OrdinaryDays: finalTarget.object.sentimental,
      objectHistoryEntriesBefore: targetHistoryBefore,
      objectHistoryEntriesAtCompletion: targetHistoryAtCompletion,
      objectHistoryEntriesAfter120OrdinaryDays: finalTarget.object.history.length,
      projectObjectHistoryEntries: project.evidence.objectHistoryEntries,
      reshapes: project.reshapes,
      collaboratorId: collaborator?.id || null,
      collaborationStatus: collaborationRequest?.status || null,
      collaborationCreatedNoOwnership: true,
    },
    releaseEvidence: {
      projectId: releasedProject.id,
      status: releasedProject.status,
      noDeadline: releasedProject.noDeadline,
      noAgeGate: releasedProject.noAgeGate,
      hiddenPenalty: false,
      historyExplicitlyRecordsNoHiddenPenalty: releasedProject.history.at(-1)?.evidence?.hiddenPenalty === false,
      labelledFailure: false,
    },
    beforeObserver,
    afterObserver: observer.after,
    delta: numericDelta(beforeObserver, observer.after),
    finalDirectionMetrics: Directions.metrics(world),
    validation,
  };

  fs.writeFileSync(path.join(output, 'AXM_PERSONAL_DIRECTIONS_WORLD.json'), Core.serializeWorld(world) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_PERSONAL_PROJECT_RECORD.json'), JSON.stringify(project, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_CHOICE_FIRST_LIFE_COURSE_RECORD.json'), JSON.stringify(world.player.lifeCourse, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_PERSONAL_DIRECTIONS_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  writeLedger(path.join(output, 'AXM_PERSONAL_DIRECTIONS_LEDGER.txt'), 'AXM Personal Directions — Choice-First 120-Day Evidence Ledger', world);
  return { seed, world, report, project, releasedProject };
}


function createLocalEconomyExample() {
  const seed = 'AXM-LOCAL-ECONOMY-EXAMPLE-080';
  const world = World.createWorld(seed);
  const ageAnchor = {
    age: world.player.age,
    ageYears: world.player.lifeCourse.ageYears,
    ageDays: world.player.lifeCourse.ageDays,
    stage: world.player.lifeCourse.stage,
  };

  world.player.money += 1800;
  Core.appendLedger(world, 'research', 'A labeled local-economy example grant was added for deterministic evidence generation.', {
    actorIds: ['player'], causes: ['explicit example setup', 'not ordinary progression'], evidence: { amount: 1800 }
  });

  const target = world.places
    .filter((place) => place.kind === 'residential')
    .flatMap((place) => place.furniture || [])
    .find((object) => object.ownerId === 'player' && !object.isFixture);
  if (!target) throw new Error('Local-economy example could not find a player-owned source object.');
  const sourceProjectResult = Systems.createPersonalProject(world, {
    templateId: 'restoration',
    targetObjectId: target.id,
    title: 'Keep useful things going',
    meaning: 'Learn from one real object before offering bounded repair help to neighbors.'
  });
  if (!sourceProjectResult.ok) throw new Error(sourceProjectResult.reason);
  const sourceProject = sourceProjectResult.project;

  const created = Systems.createEnterprise(world, {
    templateId: 'repair_table',
    path: 'occasional_service',
    sourceProjectId: sourceProject.id,
    name: 'Keep-It-Going Table',
    purpose: 'A small repair direction that may stay occasional, use actual resident customers, and close without becoming a failed life route.',
    pricingMode: 'pay_what_fits',
    basePrice: 18
  });
  if (!created.ok) throw new Error(created.reason);
  const enterprise = created.enterprise;
  const equipmentIdentity = enterprise.equipment.map((entry) => entry.id);

  const compressed = Systems.startEnterpriseSession(world, enterprise.id, 'compressed');
  if (!compressed.ok || compressed.session.status !== 'completed') throw new Error(compressed.reason || 'Compressed enterprise session failed.');

  const vacantPremise = Economy.commercialPremises(world).find((entry) => entry.listedForLease && !entry.occupantEnterpriseId);
  if (!vacantPremise) throw new Error('Local-economy example needs one real vacant commercial room.');
  const scaled = Systems.changeEnterprisePath(world, enterprise.id, 'tiny_enterprise', vacantPremise.id);
  if (!scaled.ok) throw new Error(scaled.reason);

  const interactive = Systems.startEnterpriseSession(world, enterprise.id, 'interactive');
  if (!interactive.ok) throw new Error(interactive.reason);
  const template = Economy.templateById(enterprise.templateId);
  for (let index = 0; index < 3; index += 1) {
    const worked = Systems.performEnterpriseTask(world, enterprise.id, template.actions[index % template.actions.length].id);
    if (!worked.ok) throw new Error(worked.reason);
  }
  if (world.activeEnterpriseSessionId) throw new Error('Interactive example session remained active after three bounded work moments.');

  const equipment = enterprise.equipment[0];
  const equipmentId = equipment.id;
  const conditionBeforeRepair = equipment.condition;
  const repaired = Systems.repairEnterpriseEquipment(world, enterprise.id, equipmentId);
  if (!repaired.ok) throw new Error(repaired.reason);
  const upgraded = Systems.upgradeEnterpriseEquipment(world, enterprise.id, equipmentId, 'reliability');
  if (!upgraded.ok) throw new Error(upgraded.reason);

  const workerCandidate = world.people.find((person) => Economy.eligibleEnterpriseWorker(world, enterprise, person));
  let workOffer = null;
  if (workerCandidate) {
    const offered = Systems.inviteEnterpriseWorker(world, enterprise.id, workerCandidate.id, { wagePerSession: 24, sessionsPerWeek: 1 });
    if (!offered.ok) throw new Error(offered.reason);
    workOffer = offered.offer;
  }

  const paused = Systems.pauseEnterprise(world, enterprise.id, true);
  if (!paused.ok || !paused.releasedRoom) throw new Error(paused.reason || 'Pause-and-release did not release the room.');
  const resumed = Systems.resumeEnterprise(world, enterprise.id);
  if (!resumed.ok) throw new Error(resumed.reason);

  const privateCreated = Systems.createEnterprise(world, {
    templateId: 'creative_studio',
    path: 'private_hobby',
    name: 'Unpublished Window Notes',
    purpose: 'A private practice that proves an economic-capable direction does not have to sell anything.'
  });
  if (!privateCreated.ok) throw new Error(privateCreated.reason);
  const privateEnterprise = privateCreated.enterprise;
  const closed = Systems.closeEnterprise(world, privateEnterprise.id);
  if (!closed.ok) throw new Error(closed.reason);

  const beforeObserver = Systems.computeMetrics(world);
  const observer = Systems.runObserverDays(world, 60);
  const validation = Systems.validateWorld(world);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));

  const allCustomerIds = world.enterpriseSessions.flatMap((session) => session.customers.map((entry) => entry.personId));
  const actualResidentIds = new Set(world.people.map((person) => person.id));
  if (!allCustomerIds.length || !allCustomerIds.every((id) => actualResidentIds.has(id))) {
    throw new Error('Local-economy example contains a missing or fabricated customer identity.');
  }
  if (world.player.age !== ageAnchor.age
      || world.player.lifeCourse.ageYears !== ageAnchor.ageYears
      || world.player.lifeCourse.ageDays !== ageAnchor.ageDays
      || world.player.lifeCourse.stage !== ageAnchor.stage
      || world.settings.agePressure !== false) {
    throw new Error('The local economy created age pressure or automatic life-stage drift.');
  }
  if (equipment.id !== equipmentId || !equipmentIdentity.includes(equipment.id)) {
    throw new Error('Enterprise equipment identity changed during repair or upgrade.');
  }

  const report = {
    schema: 'axm.living-city-sim.local-economy-example-report/v0.8.0',
    seed,
    generatedBy: 'tools/generate_examples.js',
    observerDaysAfterSetup: 60,
    choiceFirstEvidence: {
      optional: enterprise.optional,
      noAgeGate: enterprise.noAgeGate,
      ageGate: enterprise.ageGate,
      noGrowthRequirement: enterprise.noGrowthRequirement,
      noFailureLabel: enterprise.noFailureLabel,
      agePressure: world.settings.agePressure,
      playerAgeBefore: ageAnchor.age,
      playerAgeAfter: world.player.age,
      playerStageBefore: ageAnchor.stage,
      playerStageAfter: world.player.lifeCourse.stage,
    },
    provenanceEvidence: {
      sourceProjectId: enterprise.sourceProjectId,
      sourceProjectTitle: sourceProject.title,
      sourceObjectId: target.id,
      sourceOwnershipPreserved: target.ownerId === 'player',
    },
    premiseEvidence: {
      premiseId: vacantPremise.id,
      occupiedDuringTinyPath: vacantPremise.history.some((entry) => entry.type === 'lease_started' && entry.enterpriseId === enterprise.id),
      releasedOnChosenPause: vacantPremise.occupantEnterpriseId !== enterprise.id,
      listedAfterRelease: vacantPremise.listedForLease,
    },
    actualCustomerEvidence: {
      sessionCount: world.enterpriseSessions.length,
      serviceRecords: allCustomerIds.length,
      uniqueResidentCustomers: new Set(allCustomerIds).size,
      allCustomersExistInTown: true,
      anonymousDemandTokens: 0,
      compressedSessionId: compressed.session.id,
      interactiveSessionId: interactive.session.id,
    },
    equipmentEvidence: {
      equipmentId,
      identityPreserved: equipment.id === equipmentId,
      conditionBeforeRepair,
      conditionAfterRepairAndWear: equipment.condition,
      reliabilityLevel: equipment.upgrades.reliability,
      historyEntries: equipment.history.length,
    },
    workOfferEvidence: workOffer ? {
      id: workOffer.id,
      personId: workOffer.personId,
      finalStatus: workOffer.status,
      enterpriseWorkOnly: workOffer.authority.enterpriseWork,
      ownershipGranted: workOffer.authority.enterpriseOwnership,
      tenancyGranted: workOffer.authority.tenancy,
      householdAuthorityGranted: workOffer.authority.household,
    } : null,
    closureEvidence: {
      enterpriseId: privateEnterprise.id,
      status: privateEnterprise.status,
      labelledFailure: false,
      historyPreserved: privateEnterprise.history.length > 0,
    },
    beforeObserver,
    afterObserver: observer.after,
    delta: numericDelta(beforeObserver, observer.after),
    finalEconomyMetrics: Economy.metrics(world),
    validation,
  };

  fs.writeFileSync(path.join(output, 'AXM_LOCAL_ECONOMY_WORLD.json'), Core.serializeWorld(world) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_LOCAL_NEED_RECORD.json'), JSON.stringify(world.localNeeds[0], null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_COMMERCIAL_PREMISE_RECORD.json'), JSON.stringify(Economy.commercialPremises(world)[0], null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_ENTERPRISE_RECORD.json'), JSON.stringify(enterprise, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_ENTERPRISE_EQUIPMENT_RECORD.json'), JSON.stringify(equipment, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_ENTERPRISE_SESSION_RECORD.json'), JSON.stringify(compressed.session, null, 2) + '\n', 'utf8');
  if (workOffer) fs.writeFileSync(path.join(output, 'AXM_ENTERPRISE_WORK_OFFER_RECORD.json'), JSON.stringify(workOffer, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_LOCAL_ECONOMY_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_LOCAL_ECONOMY_RECORDS.json'), JSON.stringify({
    localNeeds: world.localNeeds,
    commercialPremises: Economy.commercialPremises(world),
    enterprises: world.enterprises,
    enterpriseSessions: world.enterpriseSessions,
    enterpriseWorkOffers: world.enterpriseWorkOffers,
  }, null, 2) + '\n', 'utf8');
  writeLedger(path.join(output, 'AXM_LOCAL_ECONOMY_LEDGER.txt'), 'AXM Living Local Economy — 60-Day Evidence Ledger', world);
  return { seed, world, report, enterprise, privateEnterprise };
}


function createWalkablePlacesExample() {
  const seed = 'AXM-WALKABLE-PLACES-EXAMPLE-090';
  const world = World.createWorld(seed);
  const ageAnchor = {
    age: world.player.age,
    ageDays: world.player.lifeCourse.ageDays,
    stage: world.player.lifeCourse.stage,
  };

  Systems.advanceHours(world, 24 * 30, { freezePlayer: true });
  const residentRoutesBeforePlayer = world.metrics.npcRoutesObserved;
  const originId = world.player.locationId;
  const destinationId = 'place_market';
  const routePreview = Exteriors.routeBetween(world, originId, destinationId);
  if (!routePreview) throw new Error('Walkable example could not resolve its primary route.');

  const visibleJourney = Systems.startPlayerTravel(world, destinationId, 'visible');
  if (!visibleJourney.ok) throw new Error(visibleJourney.reason);
  if (world.activeIndoorMovement) {
    const departureFinished = Systems.finishIndoorMovementCompressed(world);
    if (!departureFinished.ok) throw new Error(departureFinished.reason);
  }
  const visibleRecordAtStart = Exteriors.recordById(world, world.activeTravel?.recordId);
  if (!visibleRecordAtStart) throw new Error('Visible street route did not begin after lawful indoor departure.');
  const visible = { ok: true, record: visibleRecordAtStart };
  const firstStep = Systems.stepPlayerTravel(world);
  if (!firstStep.ok || !firstStep.observation) throw new Error(firstStep.reason || 'Visible route did not create an observation.');
  const visibleFinished = Systems.finishPlayerTravelCompressed(world);
  if (!visibleFinished.ok) throw new Error(visibleFinished.reason);

  const compressedDestinationId = 'place_school';
  const compressed = Systems.startPlayerTravel(world, compressedDestinationId, 'compressed');
  if (!compressed.ok) throw new Error(compressed.reason);

  const validation = Systems.validateWorld(world);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  if (world.player.age !== ageAnchor.age
      || world.player.lifeCourse.ageDays !== ageAnchor.ageDays
      || world.player.lifeCourse.stage !== ageAnchor.stage
      || world.settings.agePressure !== false
      || world.settings.walkingObligation !== false
      || world.settings.travelCompressionAllowed !== true) {
    throw new Error('Walkable-place evidence violated choice-first or casual-travel roots.');
  }

  const visibleRecord = Exteriors.recordById(world, visible.record.id);
  const compressedRecord = Exteriors.recordById(world, compressed.record.id);
  const streetMoment = world.streetMoments.find((entry) => entry.id === firstStep.observation.id);
  const sampleExterior = world.places.find((place) => place.id === 'home_student').exterior;
  const report = {
    schema: 'axm.living-city-sim.walkable-places-example-report/v0.9.0',
    seed,
    generatedBy: 'tools/generate_examples.js',
    observerDaysBeforePlayerRoutes: 30,
    networkEvidence: {
      places: world.places.length,
      exteriorPlaces: Exteriors.metrics(world).exteriorPlaces,
      uniqueAddresses: Exteriors.metrics(world).addresses,
      nodes: world.streetNetwork.nodes.length,
      edges: world.streetNetwork.edges.length,
      networkHash: world.exteriorState.networkHash,
      residentRoutesBeforePlayer,
      residentRoutesAfterPlayer: world.metrics.npcRoutesObserved,
    },
    parityEvidence: {
      visibleRouteId: visibleRecord.id,
      visibleDurationMinutes: visibleRecord.elapsedMinutes,
      visibleDistanceMeters: visibleRecord.route.distanceMeters,
      remainingRouteCompressedByChoice: visibleRecord.history.some((entry) => entry.type === 'remaining_route_compressed'),
      compressedRouteId: compressedRecord.id,
      compressedDurationMinutes: compressedRecord.elapsedMinutes,
      compressedDistanceMeters: compressedRecord.route.distanceMeters,
      compressionAlwaysAvailable: world.settings.travelCompressionAllowed,
      walkingObligatory: world.settings.walkingObligation,
      walkingStreakPresent: Object.prototype.hasOwnProperty.call(world.metrics, 'walkingStreak'),
    },
    observationEvidence: {
      momentId: streetMoment.id,
      consequence: streetMoment.consequence,
      rewardPresent: Object.prototype.hasOwnProperty.call(streetMoment, 'reward'),
      penaltyPresent: Object.prototype.hasOwnProperty.call(streetMoment, 'penalty'),
      text: streetMoment.text,
    },
    exteriorEvidence: {
      placeId: sampleExterior.placeId,
      address: sampleExterior.address,
      facade: sampleExterior.facade,
      entrance: sampleExterior.entrance,
      source: sampleExterior.source,
    },
    choiceFirstEvidence: {
      agePressure: world.settings.agePressure,
      playerAgeBefore: ageAnchor.age,
      playerAgeAfter: world.player.age,
      playerStageBefore: ageAnchor.stage,
      playerStageAfter: world.player.lifeCourse.stage,
    },
    finalMetrics: Exteriors.metrics(world),
    validation,
  };

  fs.writeFileSync(path.join(output, 'AXM_WALKABLE_PLACES_WORLD.json'), Core.serializeWorld(world) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_PLACE_EXTERIOR_RECORD.json'), JSON.stringify(sampleExterior, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_STREET_NETWORK_RECORD.json'), JSON.stringify(world.streetNetwork, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_TRAVEL_RECORD.json'), JSON.stringify(visibleRecord, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_STREET_MOMENT_RECORD.json'), JSON.stringify(streetMoment, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_WALKABLE_PLACES_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  writeLedger(path.join(output, 'AXM_WALKABLE_PLACES_LEDGER.txt'), 'AXM Walkable Places — Exterior and Route Evidence Ledger', world);
  return { seed, world, report, visibleRecord, compressedRecord, streetMoment };
}


function createBuildingShellsExample() {
  const seed = 'AXM-BUILDING-SHELLS-EXAMPLE-0100';
  const world = World.createWorld(seed);
  Shells.initializeWorld(world, { silent: true, newWorld: true });
  const experiment = Systems.prepareBuildingShellExperiment(world);
  if (!experiment.ok) throw new Error(experiment.reason);
  const frontageBefore = Core.deepClone(Shells.frontageForPlace(world, experiment.propertyId));
  const tenantPreservedAtTransfer = World.getProperty(world, experiment.propertyId).tenants.includes(experiment.authorId);
  const approved = Systems.respondToFrontageProposal(world, experiment.proposal.id, 'approve');
  if (!approved.ok) throw new Error(approved.reason);
  if (JSON.stringify(Shells.frontageForPlace(world, experiment.propertyId)) !== JSON.stringify(frontageBefore)) {
    throw new Error('Approval mutated the frontage before phased work.');
  }
  let guard = 0;
  while (!['completed', 'failed'].includes(approved.project.status) && guard < 80) {
    const step = Systems.advanceFrontageProject(world, approved.project.id);
    if (!step.ok) throw new Error(step.reason);
    guard += 1;
  }
  if (approved.project.status !== 'completed') throw new Error('Frontage example did not complete.');
  Systems.advanceHours(world, 24 * 60, { freezePlayer: true });
  const validation = Systems.validateWorld(world);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  const apartment = Shells.buildingById(world, 'building_courtyard_walkup');
  const house = Shells.buildingForPlace(world, experiment.propertyId);
  const shop = Shells.buildingForPlace(world, 'place_lane_workroom');
  const route = Shells.routeFromStreetToPlace(world, 'home_courtyard_2');
  const report = {
    schema: 'axm.living-city-sim.building-shells-example-report/v0.10.0',
    seed,
    generatedBy: 'tools/generate_examples.js',
    shellEvidence: {
      buildings: world.buildings.length,
      placeCount: world.places.length,
      allPlacesAssignedOnce: new Set(world.buildings.flatMap((building) => building.placeIds)).size === world.places.length,
      apartmentBuildingId: apartment.id,
      apartmentStoreys: apartment.storeys.length,
      apartmentStairs: apartment.verticalLinks.length,
      upperFloorRouteEdgeIds: route.edgeIds,
      occupiedHouseBuildingId: house.id,
      shopBuildingId: shop.id,
    },
    authorityEvidence: {
      proposalId: experiment.proposal.id,
      authorId: experiment.authorId,
      propertyId: experiment.propertyId,
      playerOwnerAfterExperiment: World.getProperty(world, experiment.propertyId).ownerId === 'player',
      tenantPreservedAtTransfer,
      tenantPresentAfter60AutonomousDays: World.getProperty(world, experiment.propertyId).tenants.includes(experiment.authorId),
      proposalStatus: experiment.proposal.status,
      noRelationshipPenalty: experiment.proposal.noRelationshipPenalty,
      projectId: approved.project.id,
      projectStatus: approved.project.status,
      completedPhaseIds: approved.project.completedPhaseIds,
      finalWindowBoxes: Shells.frontageForPlace(world, experiment.propertyId).windowBoxes,
    },
    casualRealismEvidence: {
      facadeMaintenanceObligation: world.settings.facadeMaintenanceObligation,
      frontageDailyDecay: world.settings.frontageDailyDecay,
      exteriorOptimizationScore: world.settings.exteriorOptimizationScore,
      agePressure: world.settings.agePressure,
    },
    metrics: Shells.metrics(world),
    validation,
  };
  fs.writeFileSync(path.join(output, 'AXM_BUILDING_SHELLS_WORLD.json'), Core.serializeWorld(world) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_BUILDING_SHELL_RECORD.json'), JSON.stringify(apartment, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_FRONTAGE_PROPOSAL_RECORD.json'), JSON.stringify(experiment.proposal, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_FRONTAGE_PROJECT_RECORD.json'), JSON.stringify(approved.project, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_BUILDING_SHELLS_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  writeLedger(path.join(output, 'AXM_BUILDING_SHELLS_LEDGER.txt'), 'AXM Building Shells — Storey, Authority, and Frontage Evidence Ledger', world);
  return { seed, world, report, apartment, proposal: experiment.proposal, project: approved.project };
}


function createLivedBuildingsExample() {
  const seed = 'AXM-LIVED-BUILDINGS-EXAMPLE-0110';
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  const ageAnchor = {
    age: world.player.age,
    ageDays: world.player.lifeCourse.ageDays,
    stage: world.player.lifeCourse.stage,
  };
  const experiment = Systems.prepareLivedBuildingExperiment(world);
  if (!experiment.ok) throw new Error(experiment.reason);
  const access = Presence.accessFor(world, 'player', experiment.propertyId);
  if (!access.ok || access.basis !== 'accepted_presence_grant') throw new Error('Experiment did not create bounded lawful shared-space access.');
  const started = Systems.startIndoorArrival(world, experiment.propertyId, 'visible');
  if (!started.ok) throw new Error(started.reason);
  let encounter = null;
  let visibleSteps = 0;
  while (world.activeIndoorMovement && !encounter && visibleSteps < 8) {
    const step = Systems.stepIndoorMovement(world);
    if (!step.ok) throw new Error(step.reason);
    visibleSteps += 1;
    encounter = Presence.openEncounter(world);
  }
  if (!encounter) encounter = Presence.offerEncounter(world, experiment.hostId, { cause: 'labeled v0.11 evidence' });
  if (!encounter) throw new Error('Lived-building example could not create a lawful co-presence encounter.');
  const refusalBefore = Core.deepClone({
    time: world.time,
    money: world.player.money,
    needs: world.player.needs,
    relationship: world.player.relationships[experiment.hostId] || null,
  });
  const declined = Systems.respondToOrdinaryEncounter(world, encounter.id, 'decline');
  if (!declined.ok) throw new Error(declined.reason);
  const refusalAfter = Core.deepClone({
    time: world.time,
    money: world.player.money,
    needs: world.player.needs,
    relationship: world.player.relationships[experiment.hostId] || null,
  });
  if (JSON.stringify(refusalBefore) !== JSON.stringify(refusalAfter)) throw new Error('Declining an ordinary encounter changed protected state.');
  const finished = world.activeIndoorMovement
    ? Systems.finishIndoorMovementCompressed(world)
    : { ok: true, movement: started.movement };
  if (!finished.ok) throw new Error(finished.reason);
  const playerPresence = Presence.presenceFor(world, 'player');
  const movement = Presence.movementById(world, started.movement.id);
  const grant = world.presenceAccessGrants.find((entry) => entry.id === experiment.grantId);
  const validation = Systems.validateWorld(world);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  if (world.player.age !== ageAnchor.age
      || world.player.lifeCourse.ageDays !== ageAnchor.ageDays
      || world.player.lifeCourse.stage !== ageAnchor.stage
      || world.settings.agePressure !== false
      || world.settings.compulsoryGreetings !== false
      || world.settings.presenceWatchingReward !== false
      || world.settings.presenceSurveillance !== false
      || world.settings.minuteByMinutePresenceTax !== false) {
    throw new Error('Lived-building evidence violated casual, privacy, or choice-first roots.');
  }
  const report = {
    schema: 'axm.living-city-sim.lived-buildings-example-report/v0.11.0',
    seed,
    generatedBy: 'tools/generate_examples.js',
    accessEvidence: {
      propertyId: experiment.propertyId,
      buildingId: experiment.buildingId,
      hostId: experiment.hostId,
      grantId: experiment.grantId,
      accessBasis: access.basis,
      authority: access.authority,
    },
    routeEvidence: {
      movementId: movement.id,
      modeStarted: 'visible',
      remainingRouteCompressedByChoice: movement.history.some((entry) => entry.type === 'remaining_route_compressed'),
      minutes: movement.elapsedMinutes,
      steps: movement.route.steps.length,
      stairSteps: movement.route.stairSteps,
      finalPresenceKind: playerPresence.kind,
      finalRoomId: playerPresence.roomId,
    },
    refusalEvidence: {
      encounterId: encounter.id,
      status: encounter.status,
      before: refusalBefore,
      after: refusalAfter,
      protectedStateEqual: JSON.stringify(refusalBefore) === JSON.stringify(refusalAfter),
      noResponseRequired: encounter.noResponseRequired,
      noRelationshipPenalty: encounter.noRelationshipPenalty,
      noWatchingReward: encounter.noWatchingReward,
      authority: encounter.authority,
    },
    privacyEvidence: {
      trackedPeople: Object.keys(world.presenceByPerson).length,
      remotePrivateRoomIdsRetained: world.people.filter((person) => {
        const presence = Presence.presenceFor(world, person.id);
        return presence?.kind === 'private_interior_coarse' && presence.roomId;
      }).length,
      surveillanceEnabled: world.settings.presenceSurveillance,
      minuteByMinuteTax: world.settings.minuteByMinutePresenceTax,
    },
    choiceFirstEvidence: {
      agePressure: world.settings.agePressure,
      playerAgeBefore: ageAnchor.age,
      playerAgeAfter: world.player.age,
      playerStageBefore: ageAnchor.stage,
      playerStageAfter: world.player.lifeCourse.stage,
    },
    finalMetrics: Presence.metrics(world),
    validation,
  };

  fs.writeFileSync(path.join(output, 'AXM_LIVED_BUILDINGS_WORLD.json'), Core.serializeWorld(world) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_LIVED_PRESENCE_RECORD.json'), JSON.stringify(playerPresence, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_INDOOR_MOVEMENT_RECORD.json'), JSON.stringify(movement, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_ORDINARY_ENCOUNTER_RECORD.json'), JSON.stringify(encounter, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_PRESENCE_ACCESS_GRANT_RECORD.json'), JSON.stringify(grant, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(output, 'AXM_LIVED_BUILDINGS_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  writeLedger(path.join(output, 'AXM_LIVED_BUILDINGS_LEDGER.txt'), 'AXM Lived Buildings — Presence, Privacy, and Ordinary Encounter Evidence Ledger', world);
  return { seed, world, report, playerPresence, movement, encounter, grant };
}

const observer = createObserverExample();
const household = createHouseholdExample();
const structural = createStructuralExample();
const stewardship = createStewardshipExample();
const family = createFamilyExample();
const community = createCommunityExample();
const directions = createPersonalDirectionsExample();
const economy = createLocalEconomyExample();
const walkable = createWalkablePlacesExample();
const shells = createBuildingShellsExample();
const lived = createLivedBuildingsExample();
console.log('Generated deterministic examples:');
console.log(`- ${observer.seed}: 100-day observer world, metrics, and ledger`);
console.log(`- ${household.seed}: accepted commitment, accepted cohabitation, accepted finance revision, then 180 autonomous days`);
console.log(`- ${structural.seed}: owned habitat, room purpose, surface, water, waste, partition, optional repair, and evidence ledger`);
console.log(`- ${stewardship.seed}: occupied remote property, resident-authored request, explicit owner decision, visible saving, materials, phased work, and retained property history`);
console.log(`- ${family.seed}: two autonomous dependents, explicit care and refusal evidence, education planning, life-stage transition, independent adulthood, and preserved objects`);
console.log(`- ${community.seed}: optional institutions, visible waiting, refusal-safe invitation, lived community moment, bounded connection, and a no-deadline adventure`);
console.log(`- ${directions.seed}: choice-first life chapter, undated restoration across that chapter change, optional collaboration, preserved object identity, release without punishment, and 120 no-aging observer days`);
console.log(`- ${economy.seed}: optional local enterprise, real commercial room, actual resident customers, compressed and entered sessions, bounded work offer, repairable equipment, pause/release, and closure without failure`);
console.log(`- ${walkable.seed}: deterministic exterior identities, unique addresses, connected pedestrian routes, visible/compressed travel parity, autonomous resident routes, and observation-only street moments`);
console.log(`- ${shells.seed}: persistent building shells, two-storey routes, wall graphs, resident-authored frontage authority, phased work, and no façade chores`);
console.log(`- ${lived.seed}: lawful arrivals and departures, real landings and stairs, visible/compressed parity, privacy-coarsened autonomous presence, bounded access, and a refusal-safe ordinary encounter`);
console.log(JSON.stringify({
  observerAfter: observer.report.after,
  householdAfter: household.report.after,
  householdStatus: household.summary.finalHousehold,
  structuralAfter: structural.report.after,
  structuralValidation: structural.report.validation,
  stewardship: stewardship.report,
  family: family.report,
  community: community.report,
  directions: directions.report,
  economy: economy.report,
  walkable: walkable.report,
  shells: shells.report,
  lived: lived.report,
}, null, 2));
