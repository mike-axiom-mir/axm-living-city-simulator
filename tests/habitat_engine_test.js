'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Households, Habitats } = globalThis.AXM;

function newWorld(seed = 'AXM-HABITAT-TEST') {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  world.people.forEach((person) => { person.moveCooldownUntil = 9999; });
  world.player.money = 1_000_000;
  Object.keys(world.player.materials).forEach((key) => { world.player.materials[key] = 250; });
  return world;
}

function objectIds(world) {
  const ids = [];
  world.places.filter((place) => place.kind === 'residential').forEach((property) => {
    property.furniture.forEach((object) => ids.push(object.id));
  });
  [world.player].concat(world.people).forEach((person) => (person.storedFurniture || []).forEach((object) => ids.push(object.id)));
  return ids.sort();
}

function advanceProposal(world, proposal, maxHours = 120) {
  for (let elapsed = 0; proposal.status === 'pending_npc' && elapsed < maxHours; elapsed += 1) Systems.advanceHours(world, 1);
  assert.notEqual(proposal.status, 'pending_npc', `proposal ${proposal.id} did not resolve`);
  return proposal;
}

function maxRelationship(world, npc) {
  Object.assign(Systems.getRelation(world.player, npc.id), {
    friendship: 100, trust: 100, romance: 100, status: 'dating', interactions: 8
  });
  Object.assign(Systems.getRelation(npc, 'player'), {
    friendship: 100, trust: 100, romance: 100, status: 'dating', interactions: 8
  });
  npc.money = Math.max(npc.money, 100_000);
}

function clearProperty(world, property) {
  for (const tenantId of property.tenants.slice()) {
    if (tenantId === 'player') continue;
    const tenant = World.getPerson(world, tenantId);
    const vacancy = world.places.find((candidate) => candidate.kind === 'residential'
      && candidate.id !== property.id
      && candidate.tenants.length < candidate.capacity
      && !candidate.tenants.includes('player')
      && candidate.listedForRent);
    assert.ok(vacancy, `No lawful vacancy available for ${tenantId}`);
    const moved = Systems.moveNpc(world, tenant, vacancy, { waiveCost: true, causes: ['deterministic habitat test setup'] });
    assert.equal(moved.ok, true, moved.reason);
  }
}

function ownAndOccupy(world, propertyId = 'home_garden_2') {
  const property = World.getProperty(world, propertyId);
  assert.ok(property && property.listedForSale, `${propertyId} must be purchasable`);
  clearProperty(world, property);
  const bought = Systems.buyProperty(world, property.id);
  assert.equal(bought.ok, true, bought.reason);
  const moved = Systems.moveIntoOwnedProperty(world, property.id);
  assert.equal(moved.ok, true, moved.reason);
  assert.equal(property.ownerId, 'player');
  assert.equal(world.player.homePropertyId, property.id);
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  return property;
}

function completeProject(world, project) {
  let guard = 0;
  while (['planned', 'active'].includes(project.status) && guard < 20) {
    world.player.money = Math.max(world.player.money, 1_000_000);
    Object.keys(world.player.materials).forEach((key) => { world.player.materials[key] = Math.max(world.player.materials[key], 250); });
    const result = Systems.workHabitatProject(world, project.id);
    assert.equal(result.ok, true, result.reason);
    guard += 1;
  }
  assert.equal(project.status, 'completed', project.failureReason || 'project did not complete');
  return project;
}

function findOpenSplitEdge(property, roomId = null) {
  return Habitats.listEdges(property).find((edge) => edge.current === 'open'
    && edge.roomIds[0]
    && edge.roomIds[0] === edge.roomIds[1]
    && (!roomId || edge.roomIds[0] === roomId));
}

function establishSharedOwnedHome(seed = 'AXM-HABITAT-SHARED') {
  const world = newWorld(seed);
  const property = ownAndOccupy(world);
  const npc = world.people.find((person) => person.homePropertyId !== property.id);
  maxRelationship(world, npc);
  const commitment = Systems.proposeCommitment(world, npc.id);
  assert.equal(commitment.ok, true, commitment.reason);
  advanceProposal(world, commitment.proposal);
  assert.equal(commitment.proposal.status, 'implemented', JSON.stringify(commitment.proposal.response));
  const household = Households.playerHousehold(world);
  const cohabitation = Systems.proposeCohabitation(world, npc.id, property.id);
  assert.equal(cohabitation.ok, true, cohabitation.reason);
  advanceProposal(world, cohabitation.proposal);
  assert.equal(cohabitation.proposal.status, 'implemented', JSON.stringify(cohabitation.proposal.response));
  assert.equal(Households.isCohabiting(world, household), true);
  return { world, property, npc, household };
}

function testDeterministicStructuralGeneration() {
  const a = newWorld('AXM-HABITAT-DETERMINISTIC');
  const b = newWorld('AXM-HABITAT-DETERMINISTIC');
  const compact = (world) => world.places.filter((place) => place.kind === 'residential').map((property) => ({
    id: property.id,
    hash: property.habitat.layoutHash,
    partitions: property.habitat.partitions,
    rooms: property.habitat.rooms
  }));
  assert.deepEqual(compact(a), compact(b));
}

function testEveryInitialHomeHasReachableFacilities() {
  const world = newWorld('AXM-HABITAT-FACILITIES');
  for (const property of world.places.filter((place) => place.kind === 'residential')) {
    const result = Habitats.validateProperty(world, property);
    assert.equal(result.ok, true, `${property.id}: ${result.errors.join(' | ')}`);
    assert.equal(result.facilities.allRoomsReachable, true);
    assert.ok(result.facilities.bathroom?.reachable);
    assert.equal(result.facilities.bathroom.utilities.water, true);
    assert.equal(result.facilities.bathroom.utilities.waste, true);
  }
}

function testRentalSurfaceProjectIsPhasedAndExpressionSafe() {
  const world = newWorld('AXM-HABITAT-SURFACE');
  const property = World.homeOf(world, 'player');
  const room = property.habitat.rooms.find((entry) => entry.purpose !== 'bathroom');
  const finish = Habitats.FINISHES.find((entry) => entry.id !== room.finish.wallFinishId);
  const before = room.finish.wallFinishId;
  const request = Systems.requestHabitatProject(world, property.id, { type: 'surface', target: { roomId: room.id, surface: 'walls', finishId: finish.id } });
  assert.equal(request.ok, true, request.reason);
  assert.equal(request.project.status, 'planned');
  assert.equal(room.finish.wallFinishId, before, 'planning must not mutate the surface');
  completeProject(world, request.project);
  assert.equal(room.finish.wallFinishId, finish.id);
  assert.equal(world.metrics.surfaceProjects, 1);
}

function testRenterCannotInventStructuralAuthority() {
  const world = newWorld('AXM-HABITAT-RENT-AUTHORITY');
  const property = World.homeOf(world, 'player');
  const edge = findOpenSplitEdge(property);
  assert.ok(edge);
  const request = Systems.requestHabitatProject(world, property.id, { type: 'partition', target: { edgeKey: edge.key, kind: 'door', materialId: 'timber_frame' } });
  assert.equal(request.ok, false);
  assert.match(request.reason, /property ownership/i);
}

function testOwnedPartitionProjectCreatesARealStructuralEdge() {
  const world = newWorld('AXM-HABITAT-PARTITION');
  const property = ownAndOccupy(world);
  const edge = findOpenSplitEdge(property);
  assert.ok(edge);
  const beforeRooms = property.habitat.rooms.length;
  const beforeRevision = property.habitat.revision;
  const beforeHash = property.habitat.layoutHash;
  const request = Systems.requestHabitatProject(world, property.id, { type: 'partition', target: { edgeKey: edge.key, kind: 'door', materialId: 'reclaimed_timber' } });
  assert.equal(request.ok, true, request.reason);
  assert.equal(property.habitat.rooms.length, beforeRooms, 'planning is not construction');
  completeProject(world, request.project);
  assert.ok(property.habitat.rooms.length >= 1, 'completed edge must preserve a valid room graph');
  const validation = Habitats.validateProperty(world, property);
  assert.equal(validation.ok, true, validation.errors.join(' | '));
  assert.equal(validation.facilities.allRoomsReachable, true);
  assert.equal(property.habitat.revision, beforeRevision + 1);
  assert.notEqual(property.habitat.layoutHash, beforeHash);
  assert.equal(Habitats.partitionAt(property, edge.key).kind, 'door');
}

function testWallThatWouldStrandBathroomIsRejected() {
  const world = newWorld('AXM-HABITAT-PATH-GUARD');
  const property = ownAndOccupy(world);
  const bathroom = property.habitat.rooms.find((room) => room.purpose === 'bathroom');
  const door = Habitats.listEdges(property).find((edge) => edge.current === 'door' && edge.roomIds.includes(bathroom.id));
  assert.ok(door, 'bathroom should have a door');
  const result = Habitats.validateProjectSpec(world, property, { type: 'partition', target: { edgeKey: door.key, kind: 'wall', materialId: 'timber_frame' } });
  assert.equal(result.ok, false);
  assert.match(result.reason, /inaccessible room/i);
}

function testConstructionReflowsOrStoresWithoutObjectIdentityLoss() {
  const world = newWorld('AXM-HABITAT-NO-LOSS');
  const property = ownAndOccupy(world);
  const crossingObject = property.furniture.find((object) => object.footprint[0] > 1 || object.footprint[1] > 1);
  assert.ok(crossingObject, 'test needs a multi-cell object');
  let edge = null;
  for (let dy = 0; dy < crossingObject.footprint[1] && !edge; dy += 1) {
    for (let dx = 1; dx < crossingObject.footprint[0] && !edge; dx += 1) {
      const key = Habitats.edgeKey('V', crossingObject.position.x + dx, crossingObject.position.y + dy);
      if (Habitats.edgeCells(property, key) && !Habitats.partitionAt(property, key)) edge = { key };
    }
  }
  for (let dy = 1; dy < crossingObject.footprint[1] && !edge; dy += 1) {
    for (let dx = 0; dx < crossingObject.footprint[0] && !edge; dx += 1) {
      const key = Habitats.edgeKey('H', crossingObject.position.x + dx, crossingObject.position.y + dy);
      if (Habitats.edgeCells(property, key) && !Habitats.partitionAt(property, key)) edge = { key };
    }
  }
  assert.ok(edge, 'test needs an open edge crossing a large object');
  const beforeIds = objectIds(world);
  const beforePosition = Core.deepClone(crossingObject.position);
  const request = Systems.requestHabitatProject(world, property.id, { type: 'partition', target: { edgeKey: edge.key, kind: 'door', materialId: 'light_metal' } });
  assert.equal(request.ok, true, request.reason);
  assert.equal(request.project.history[0].evidence.layoutRevision, property.habitat.revision);
  completeProject(world, request.project);
  assert.deepEqual(objectIds(world), beforeIds);
  const location = property.furniture.find((object) => object.id === crossingObject.id)
    || world.player.storedFurniture.find((object) => object.id === crossingObject.id);
  assert.ok(location, 'crossing object must remain placed or stored');
  if (property.furniture.includes(location)) {
    assert.equal(Habitats.footprintRespectsPartitions(property, location.position.x, location.position.y, location.footprint), true);
    assert.notDeepEqual(location.position, beforePosition, 'crossing object should be reflowed when the new door cuts through it');
  }
}

function testUtilityProjectsCreateExplicitRoomCapability() {
  const world = newWorld('AXM-HABITAT-UTILITY');
  const property = ownAndOccupy(world);
  const room = property.habitat.rooms.find((entry) => !entry.utilityAccess.water && entry.purpose !== 'bathroom');
  assert.ok(room);
  const water = Systems.requestHabitatProject(world, property.id, { type: 'utility', target: { roomId: room.id, utilityType: 'water' } });
  assert.equal(water.ok, true, water.reason);
  completeProject(world, water.project);
  assert.equal(room.utilityAccess.water, true);
  const waste = Systems.requestHabitatProject(world, property.id, { type: 'utility', target: { roomId: room.id, utilityType: 'waste' } });
  assert.equal(waste.ok, true, waste.reason);
  completeProject(world, waste.project);
  assert.equal(room.utilityAccess.waste, true);
  assert.equal(world.metrics.utilityProjects, 2);
}

function testMovingWetFixtureUsesRealObjectRequirements() {
  const world = newWorld('AXM-HABITAT-MOVE-UTILITY');
  const origin = World.getProperty(world, 'home_garden_2');
  const destination = World.getProperty(world, 'home_student');
  const npc = world.people.find((person) => person.homePropertyId === origin.id) || world.people[0];
  assert.ok(origin && destination && npc);

  // Fill every remaining wet-room cell so a kitchenette has no lawful wet
  // placement. Dry floor space intentionally remains available; this catches
  // any move path that forgets the object's catalog/utility requirements.
  destination.habitat.rooms
    .filter((room) => room.utilityAccess.water && room.utilityAccess.waste)
    .flatMap((room) => room.cells.map(Habitats.parseCellKey))
    .forEach((cell) => {
      if (!World.positionFits(destination, destination.furniture, cell.x, cell.y, [1, 1])) return;
      const blocker = World.createFurnitureInstance(world, 'secondhand_chair', destination.ownerId, {
        ownershipMode: 'property_fixture', x: cell.x, y: cell.y, condition: 100
      });
      destination.furniture.push(blocker);
    });

  const kitchenette = World.createFurnitureInstance(world, 'kitchenette', npc.id, { condition: 100 });
  const placedAtOrigin = World.addFurnitureToProperty(
    world,
    origin,
    kitchenette,
    null,
    (x, y, footprint) => Habitats.objectFitsAt(origin, kitchenette, x, y, footprint)
  );
  assert.equal(placedAtOrigin, true, 'origin needs a lawful wet placement');

  let dryGeometryExists = false;
  for (let y = 0; y <= destination.roomGrid[1] - kitchenette.footprint[1]; y += 1) {
    for (let x = 0; x <= destination.roomGrid[0] - kitchenette.footprint[0]; x += 1) {
      if (World.positionFits(destination, destination.furniture, x, y, kitchenette.footprint)
        && !Habitats.objectFitsAt(destination, kitchenette, x, y, kitchenette.footprint)) {
        dryGeometryExists = true;
      }
    }
  }
  assert.equal(dryGeometryExists, true, 'test must retain tempting but utility-invalid dry floor space');

  Systems.transferPersonalFurniture(world, npc.id, origin, destination);
  assert.equal(destination.furniture.some((object) => object.id === kitchenette.id), false);
  assert.equal(npc.storedFurniture.some((object) => object.id === kitchenette.id), true, 'no lawful placement must use no-loss storage');
  const validation = Habitats.validateProperty(world, destination);
  assert.equal(validation.ok, true, validation.errors.join(' | '));
}

function testSharedStructureRequiresConsentAndStillWaitsForConstruction() {
  const { world, property, household } = establishSharedOwnedHome();
  const edge = findOpenSplitEdge(property);
  assert.ok(edge);
  const beforeHash = property.habitat.layoutHash;
  const beforeProjects = property.habitat.projects.length;
  const request = Systems.requestHabitatProject(world, property.id, { type: 'partition', target: { edgeKey: edge.key, kind: 'door', materialId: 'timber_frame' } });
  assert.equal(request.ok, true, request.reason);
  assert.equal(request.requiresProposal, true);
  assert.equal(property.habitat.projects.length, beforeProjects, 'proposal is not a construction project yet');
  assert.equal(property.habitat.layoutHash, beforeHash);
  advanceProposal(world, request.proposal);
  assert.equal(request.proposal.status, 'implemented', JSON.stringify(request.proposal.response));
  assert.equal(property.habitat.projects.length, beforeProjects + 1);
  const project = property.habitat.projects.at(-1);
  assert.equal(project.authority.proposalId, request.proposal.id);
  assert.equal(property.habitat.layoutHash, beforeHash, 'accepted consent authorizes work but does not complete it');
  assert.ok(household.history.some((entry) => entry.type === 'construction_project_authorized'));
  completeProject(world, project);
  assert.notEqual(property.habitat.layoutHash, beforeHash);
}

function testGraphPermissionsReplaceLegacyRectangleAuthority() {
  const { world, property, household, npc } = establishSharedOwnedHome('AXM-HABITAT-PERMISSIONS');
  const permissions = household.agreement.space.roomPermissions;
  assert.equal(permissions.length, property.habitat.rooms.length);
  assert.equal(household.agreement.space.roomGraphRevision, property.habitat.revision);
  const partnerPermission = permissions.find((entry) => entry.kind === 'partner_private');
  if (partnerPermission) {
    const room = Habitats.roomById(property, partnerPermission.roomId);
    const playerObject = property.furniture.find((object) => object.ownerId === 'player' && object.ownershipMode !== 'property_fixture' && object.footprint[0] === 1 && object.footprint[1] === 1);
    const cell = room.cells.map(Habitats.parseCellKey).find((point) => World.positionFits(property, property.furniture, point.x, point.y, playerObject.footprint, playerObject.id));
    if (cell) {
      const permission = Habitats.placementPermission(world, property, 'player', playerObject, cell.x, cell.y, playerObject.footprint);
      assert.equal(permission.ok, false);
      assert.match(permission.reason, /private room/i);
    }
  }
  assert.equal(World.getPerson(world, npc.id).isPlayerControlled, false);
}

function testRoomPurposeSuggestionsRemainNonBinding() {
  const world = newWorld('AXM-HABITAT-PURPOSE');
  const property = World.homeOf(world, 'player');
  const room = property.habitat.rooms.find((entry) => entry.purpose !== 'bathroom');
  const suggestions = Habitats.roomSuggestions(property, room.id);
  assert.ok(suggestions.length >= 2);
  const chosen = suggestions.find((entry) => entry.id !== suggestions[0].id) || suggestions[0];
  const result = Systems.setRoomPurpose(world, property.id, room.id, chosen.id);
  assert.equal(result.ok, true, result.reason);
  assert.equal(room.purpose, chosen.id);
  assert.equal(world.metrics.roomPurposeChanges, 1);
}

function testPlayerRoomPurposeSurvivesStructuralRecompute() {
  const world = newWorld('AXM-HABITAT-PURPOSE-PROVENANCE');
  const property = ownAndOccupy(world);
  const edge = Habitats.listEdges(property).find((entry) => entry.current === 'open'
    && entry.roomIds[0]
    && entry.roomIds[0] === entry.roomIds[1]
    && Habitats.roomById(property, entry.roomIds[0])?.purpose !== 'bathroom');
  assert.ok(edge);
  const room = Habitats.roomById(property, edge.roomIds[0]);
  const chosen = Systems.setRoomPurpose(world, property.id, room.id, 'hobby');
  assert.equal(chosen.ok, true, chosen.reason);
  assert.equal(room.purposeSource, 'player');
  const project = Systems.requestHabitatProject(world, property.id, {
    type: 'partition', target: { edgeKey: edge.key, kind: 'door', materialId: 'reclaimed_timber' }
  });
  assert.equal(project.ok, true, project.reason);
  completeProject(world, project.project);
  const surviving = Habitats.roomById(property, room.id);
  assert.ok(surviving, 'stable overlap should preserve the selected room identity');
  assert.equal(surviving.purpose, 'hobby');
  assert.equal(surviving.purposeSource, 'player');
}

function testOnlyBathroomPurposeCannotBeSilentlyRemoved() {
  const world = newWorld('AXM-HABITAT-BATHROOM-PURPOSE');
  const property = World.homeOf(world, 'player');
  const bathroom = property.habitat.rooms.find((room) => room.purpose === 'bathroom');
  assert.ok(bathroom);
  const result = Systems.setRoomPurpose(world, property.id, bathroom.id, 'hobby');
  assert.equal(result.ok, false);
  assert.match(result.reason, /only bathroom/i);
  assert.equal(bathroom.purpose, 'bathroom');
  assert.equal(Habitats.validateProperty(world, property).ok, true);
}


function testRemoteOwnedPropertyStillRejectsControl() {
  const world = newWorld('AXM-HABITAT-REMOTE');
  const remote = World.getProperty(world, 'home_rooftop');
  const bought = Systems.buyProperty(world, remote.id);
  assert.equal(bought.ok, true, bought.reason);
  assert.notEqual(world.player.homePropertyId, remote.id);
  const room = remote.habitat.rooms[0];
  const finish = Habitats.FINISHES.find((entry) => entry.id !== room.finish.wallFinishId);
  const result = Systems.requestHabitatProject(world, remote.id, { type: 'surface', target: { roomId: room.id, surface: 'walls', finishId: finish.id } });
  assert.equal(result.ok, false);
  assert.match(result.reason, /remote control/i);
}

function testV02MigrationPreservesObjectsAndMapsRoomPermissions() {
  const { world, household } = establishSharedOwnedHome('AXM-HABITAT-MIGRATION');
  const beforeIds = objectIds(world);
  const householdId = household.id;
  const legacy = Core.deepClone(world);
  legacy.schema = 'axm.living-city-sim.world/v0.2.0';
  legacy.version = '0.2.0';
  legacy.places.filter((place) => place.kind === 'residential').forEach((property) => { delete property.habitat; });
  delete legacy.ui.selectedRoomId;
  delete legacy.ui.selectedHabitatProjectId;
  delete legacy.ui.selectedHabitatEdgeKey;
  Object.keys(legacy.metrics).filter((key) => key.startsWith('habitat') || key === 'structuralChanges' || key === 'surfaceProjects' || key === 'utilityProjects' || key === 'roomPurposeChanges').forEach((key) => delete legacy.metrics[key]);
  legacy.households.forEach((entry) => {
    if (entry.agreement?.space) {
      delete entry.agreement.space.roomPermissions;
      delete entry.agreement.space.roomGraphRevision;
    }
  });
  const migrated = Systems.migrateWorld(Core.parseWorld(Core.serializeWorld(legacy)));
  assert.equal(migrated.schema, Core.SCHEMA);
  assert.deepEqual(objectIds(migrated), beforeIds);
  const migratedHousehold = migrated.households.find((entry) => entry.id === householdId);
  assert.ok(migratedHousehold);
  assert.ok(migratedHousehold.agreement.space.roomPermissions.length > 0);
  assert.ok(migrated.ledger.some((entry) => entry.type === 'migration'));
  const validation = Systems.validateWorld(migrated);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
}

function testValidationRejectsRoomGraphCorruptionWithoutRepairingIt() {
  const world = newWorld('AXM-HABITAT-CORRUPTION');
  const property = World.homeOf(world, 'player');
  const room = property.habitat.rooms[0];
  const original = room.cells.slice();
  room.cells.push(original[0]);
  const result = Systems.validateWorld(world);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /multiple rooms|covers|duplicate/i.test(error)));
  assert.equal(room.cells.length, original.length + 1, 'validation must report rather than silently repair');
}

function testTwoDifferentLayoutsRemainViable() {
  const make = (seed, edgeIndex) => {
    const world = newWorld(seed);
    const property = ownAndOccupy(world);
    const edges = Habitats.listEdges(property).filter((edge) => edge.current === 'open' && edge.roomIds[0] === edge.roomIds[1]);
    assert.ok(edges.length > edgeIndex);
    const request = Systems.requestHabitatProject(world, property.id, { type: 'partition', target: { edgeKey: edges[edgeIndex].key, kind: 'door', materialId: 'timber_frame' } });
    assert.equal(request.ok, true, request.reason);
    completeProject(world, request.project);
    const validation = Habitats.validateProperty(world, property);
    assert.equal(validation.ok, true, validation.errors.join('\n'));
    return property.habitat.layoutHash;
  };
  const a = make('AXM-HABITAT-LAYOUT-A', 0);
  const b = make('AXM-HABITAT-LAYOUT-B', 1);
  assert.notEqual(a, b);
}

function testLongSimulationKeepsHabitatInvariants() {
  const world = newWorld('AXM-HABITAT-LONG-STRESS');
  Systems.advanceHours(world, 365 * 24, { freezePlayer: true });
  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.slice(0, 20).join('\n'));
  assert.equal(world.time.day, 366);
}

const tests = [
  testDeterministicStructuralGeneration,
  testEveryInitialHomeHasReachableFacilities,
  testRentalSurfaceProjectIsPhasedAndExpressionSafe,
  testRenterCannotInventStructuralAuthority,
  testOwnedPartitionProjectCreatesARealStructuralEdge,
  testWallThatWouldStrandBathroomIsRejected,
  testConstructionReflowsOrStoresWithoutObjectIdentityLoss,
  testUtilityProjectsCreateExplicitRoomCapability,
  testMovingWetFixtureUsesRealObjectRequirements,
  testSharedStructureRequiresConsentAndStillWaitsForConstruction,
  testGraphPermissionsReplaceLegacyRectangleAuthority,
  testRoomPurposeSuggestionsRemainNonBinding,
  testPlayerRoomPurposeSurvivesStructuralRecompute,
  testOnlyBathroomPurposeCannotBeSilentlyRemoved,
  testRemoteOwnedPropertyStillRejectsControl,
  testV02MigrationPreservesObjectsAndMapsRoomPermissions,
  testValidationRejectsRoomGraphCorruptionWithoutRepairingIt,
  testTwoDifferentLayoutsRemainViable,
  testLongSimulationKeepsHabitatInvariants
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
if (passed === tests.length) console.log(`\n${passed}/${tests.length} structural habitat tests passed.`);
