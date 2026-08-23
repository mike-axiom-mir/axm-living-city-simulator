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

const { Core, World, Systems, Content } = globalThis.AXM;

function newWorld(seed = 'AXM-TEST-SEED') {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  return world;
}

function playerObject(world, catalogId) {
  const home = World.homeOf(world, 'player');
  return home.furniture.find((object) => object.ownerId === 'player' && object.catalogId === catalogId);
}

function testDeterministicGeneration() {
  const a = newWorld('DETERMINISTIC-001');
  const b = newWorld('DETERMINISTIC-001');
  assert.equal(Core.serializeWorld(a), Core.serializeWorld(b), 'same seed must create byte-equivalent initial worlds');
}

function testInitialInvariants() {
  const world = newWorld();
  const result = Systems.validateWorld(world);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(world.people.length, 23);
  assert.equal(world.places.filter((place) => place.kind === 'residential').length, 14);
  assert.equal(World.homeOf(world, 'player').id, 'home_student');
  assert.equal(World.homeOf(world, 'player').sharedBathroom, true);
}

function testUpgradeWithoutReplacement() {
  const world = newWorld('UPGRADE-001');
  Systems.developerGrant(world);
  const chair = playerObject(world, 'secondhand_chair');
  assert.ok(chair, 'starter secondhand chair must exist');
  const originalId = chair.id;
  const originalCatalog = chair.catalogId;
  const before = Core.computeObjectStats(Content.furnitureById(chair.catalogId), chair);

  for (const axis of Systems.UPGRADE_AXES) {
    for (let level = 0; level < 5; level += 1) {
      const result = Systems.upgradeFurniture(world, chair.id, axis);
      assert.equal(result.ok, true, result.reason);
    }
  }

  const after = Core.computeObjectStats(Content.furnitureById(chair.catalogId), chair);
  assert.equal(chair.id, originalId, 'object identity must survive max upgrades');
  assert.equal(chair.catalogId, originalCatalog, 'catalog identity must not be silently replaced');
  assert.ok(after.viability > before.viability + 45, 'viability should materially improve');
  assert.ok(after.viability >= 88, `fully invested cheap chair should become endgame viable; got ${after.viability}`);
  assert.ok(Object.values(after).filter((value) => typeof value === 'number' && value === 100).length < 6, 'a cheap object should not become an identical all-100 stat block');
  assert.equal(chair.history.filter((entry) => entry.type === 'upgrade').length, 25);
}

function testMaxInvestmentPreservesObjectDifferences() {
  const stats = Content.FURNITURE_CATALOG.map((definition) => {
    const object = {
      condition: 100,
      sentimental: 50,
      upgrades: { comfort: 5, beauty: 5, utility: 5, durability: 5, efficiency: 5 },
    };
    return { id: definition.id, stats: Core.computeObjectStats(definition, object) };
  });
  stats.forEach(({ id, stats: result }) => {
    assert.ok(result.viability >= 85, `${id} should remain late-game viable at full investment; got ${result.viability}`);
  });
  const chair = stats.find((entry) => entry.id === 'secondhand_chair').stats;
  const sofa = stats.find((entry) => entry.id === 'deep_sofa').stats;
  assert.notDeepEqual(chair, sofa, 'full investment must preserve meaningful catalogue differences');
  assert.ok(chair.durability > chair.beauty, 'the repaired chair should retain its original durability-over-beauty character');
}

function testStorageNoLoss() {
  const world = newWorld('STORAGE-001');
  const chair = playerObject(world, 'secondhand_chair');
  const id = chair.id;
  const resultStore = Systems.storeFurniture(world, id);
  assert.equal(resultStore.ok, true, resultStore.reason);
  assert.ok(world.player.storedFurniture.some((object) => object.id === id));
  assert.ok(!World.homeOf(world, 'player').furniture.some((object) => object.id === id));
  const resultPlace = Systems.placeStoredFurniture(world, id);
  assert.equal(resultPlace.ok, true, resultPlace.reason);
  assert.ok(World.homeOf(world, 'player').furniture.some((object) => object.id === id));
  assert.equal(World.homeOf(world, 'player').furniture.find((object) => object.id === id).history.some((entry) => entry.type === 'stored'), true);
}

function testWorkModesRemainValid() {
  const skipWorld = newWorld('WORK-001');
  const activeWorld = newWorld('WORK-001');
  const skipStart = skipWorld.player.money;
  const activeStart = activeWorld.player.money;

  const skipped = Systems.skipShift(skipWorld);
  assert.equal(skipped.ok, true, skipped.reason);

  const started = Systems.startInteractiveShift(activeWorld);
  assert.equal(started.ok, true, started.reason);
  const taskId = Content.jobById(activeWorld.player.jobId).actions[0].id;
  while (activeWorld.activeShift) {
    const result = Systems.performWorkTask(activeWorld, taskId);
    assert.notEqual(result.ok, false, result.reason);
  }

  const skipEarned = skipWorld.player.money - skipStart;
  const activeEarned = activeWorld.player.money - activeStart;
  assert.ok(skipEarned > 0 && activeEarned > 0);
  assert.ok(Math.abs(skipEarned - activeEarned) / skipEarned < 0.15, 'interactive and skipped work should remain economically comparable');
  assert.ok(activeWorld.player.skills.social > skipWorld.player.skills.social, 'interactive work should emphasize influence and learning');
}

function testRealVacancyMove() {
  const world = newWorld('MOVE-001');
  Systems.developerGrant(world);
  const destination = World.getProperty(world, 'home_courtyard_2');
  assert.equal(destination.tenants.length, 0, 'test property should begin genuinely vacant');
  const oldHome = World.homeOf(world, 'player');
  const playerObjectIds = oldHome.furniture.filter((object) => object.ownerId === 'player').map((object) => object.id);
  const result = Systems.rentProperty(world, destination.id);
  assert.equal(result.ok, true, result.reason);
  assert.equal(world.player.homePropertyId, destination.id);
  assert.ok(destination.tenants.includes('player'));
  assert.ok(!oldHome.tenants.includes('player'));
  const retained = destination.furniture.filter((object) => playerObjectIds.includes(object.id)).length + (world.player.storedFurniture || []).filter((object) => playerObjectIds.includes(object.id)).length;
  assert.equal(retained, playerObjectIds.length, 'moving must preserve every player-owned object, placed or stored');
}

function testPropertyFixturesRemainBoundAndTenantsRetainAgency() {
  const world = newWorld('PROPERTY-AUTHORITY-001');
  Systems.developerGrant(world);
  const property = World.getProperty(world, 'home_lane_2');
  const tenantsBefore = property.tenants.slice();
  const fixtureIds = property.furniture.filter((object) => object.ownershipMode === 'property_fixture').map((object) => object.id);
  const tenantObjectOwners = property.furniture.filter((object) => object.ownershipMode !== 'property_fixture').map((object) => object.ownerId).sort();
  assert.ok(fixtureIds.length > 0, 'sale property should contain explicit property-bound fixtures');

  const purchase = Systems.buyProperty(world, property.id);
  assert.equal(purchase.ok, true, purchase.reason);
  assert.deepEqual(property.tenants, tenantsBefore, 'buying a property must not displace its residents');
  assert.ok(fixtureIds.every((id) => property.furniture.find((object) => object.id === id)?.ownerId === 'player'), 'fixtures should transfer with legal property ownership');
  assert.deepEqual(property.furniture.filter((object) => object.ownershipMode !== 'property_fixture').map((object) => object.ownerId).sort(), tenantObjectOwners, 'tenant personal assets must not transfer to the buyer');

  const remoteFixture = property.furniture.find((object) => object.id === fixtureIds[0]);
  const remoteMove = Systems.moveFurniture(world, remoteFixture.id, 1, 0);
  assert.equal(remoteMove.ok, false, 'ownership must not grant remote interior control');
  assert.match(remoteMove.reason, /resident-authored home/i);

  const moveIn = Systems.moveIntoOwnedProperty(world, property.id);
  assert.equal(moveIn.ok, true, moveIn.reason);
  const storeFixture = Systems.storeFurniture(world, remoteFixture.id);
  assert.equal(storeFixture.ok, false, 'property fixture must not become portable personal furniture');
  assert.match(storeFixture.reason, /bound to the building/i);

  const destination = World.getProperty(world, 'home_courtyard_2');
  const leaveAgain = Systems.rentProperty(world, destination.id);
  assert.equal(leaveAgain.ok, true, leaveAgain.reason);
  assert.ok(fixtureIds.every((id) => property.furniture.some((object) => object.id === id)), 'fixtures must stay with the property when the owner moves away');
  assert.equal(Systems.validateWorld(world).ok, true);
}

function testLongObserverRun() {
  const world = newWorld('LONG-RUN-001');
  const initialPlayerMoney = world.player.money;
  const initialNeeds = JSON.stringify(world.player.needs);
  const report = Systems.runObserverDays(world, 365);
  assert.equal(report.validation.ok, true, report.validation.errors.join('\n'));
  assert.equal(world.player.money, initialPlayerMoney, 'observer mode should freeze player financial consequences');
  assert.equal(JSON.stringify(world.player.needs), initialNeeds, 'observer mode should freeze player needs');
  assert.ok(report.after.npcDecorActions > 200, 'autonomous residents should reshape homes over a year');
  assert.ok(report.after.decorSignatureCount >= 10, 'homes should not converge to one décor signature');
  assert.ok(report.changedPropertyCount >= 10, 'most homes should visibly evolve during a year');
  assert.equal(report.changedPropertyCount, report.changedPropertyIds.length, 'observer count and changed-property ids must agree');
  assert.equal(new Set(report.changedPropertyIds).size, report.changedPropertyIds.length, 'observer changed-property ids must be unique');
  assert.ok(report.changedProperties.every((entry) => entry.beforeSignature !== entry.afterSignature), 'every reported home change must have different before/after signatures');
  assert.ok(report.after.moves > 0, 'housing market should produce explainable movement');
}

function testDeterministicEvolution() {
  const a = newWorld('EVOLUTION-001');
  const b = newWorld('EVOLUTION-001');
  Systems.runObserverDays(a, 120);
  Systems.runObserverDays(b, 120);
  assert.equal(Core.serializeWorld(a), Core.serializeWorld(b), 'same seed plus same commands must evolve identically');
}

function testExportImport() {
  const world = newWorld('EXPORT-001');
  Systems.advanceHours(world, 72);
  const text = Core.serializeWorld(world);
  const parsed = Core.parseWorld(text);
  const validation = Systems.validateWorld(parsed);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(parsed.seed, world.seed);
  assert.equal(parsed.time.day, world.time.day);
}


function testValidationRejectsCorruptionWithoutSilentRewrite() {
  const cases = [
    {
      name: 'duplicate object id',
      mutate(world) {
        const home = World.homeOf(world, 'player');
        home.furniture[1].id = home.furniture[0].id;
      },
      pattern: /appears in both/i,
    },
    {
      name: 'object outside room',
      mutate(world) { World.homeOf(world, 'player').furniture[0].position.x = 999; },
      pattern: /outside the room bounds/i,
    },
    {
      name: 'invalid rotation',
      mutate(world) { World.homeOf(world, 'player').furniture[0].position.rotation = 45; },
      pattern: /invalid rotation/i,
    },
    {
      name: 'unknown furniture catalog',
      mutate(world) { World.homeOf(world, 'player').furniture[0].catalogId = 'invented_catalog_entry'; },
      pattern: /unknown furniture catalog/i,
    },
    {
      name: 'unknown object color',
      mutate(world) { World.homeOf(world, 'player').furniture[0].colorId = 'invented_color'; },
      pattern: /unknown color/i,
    },
    {
      name: 'fixture ownership mismatch',
      mutate(world) {
        const property = World.getProperty(world, 'home_lane_1');
        property.furniture.find((object) => object.ownershipMode === 'property_fixture').ownerId = 'npc_001';
      },
      pattern: /fixture owner does not match/i,
    },
    {
      name: 'unknown tenant',
      mutate(world) { World.getProperty(world, 'home_courtyard_2').tenants.push('ghost_person'); },
      pattern: /unknown tenant/i,
    },
    {
      name: 'placed object duplicated into storage',
      mutate(world) {
        const object = World.homeOf(world, 'player').furniture.find((entry) => entry.ownerId === 'player' && entry.ownershipMode === 'personal');
        world.player.storedFurniture = [Core.deepClone(object)];
      },
      pattern: /appears in both/i,
    },
    {
      name: 'malformed tenant collection',
      mutate(world) { World.getProperty(world, 'home_lane_1').tenants = 'not-an-array'; },
      pattern: /tenants must be an array/i,
    },
  ];

  cases.forEach(({ name, mutate, pattern }, index) => {
    const world = newWorld(`CORRUPTION-${index}`);
    mutate(world);
    const before = Core.serializeWorld(world);
    const validation = Systems.validateWorld(world);
    assert.equal(validation.ok, false, `${name} should be rejected`);
    assert.match(validation.errors.join(' | '), pattern, `${name} should produce a specific diagnostic`);
    assert.equal(Core.serializeWorld(world), before, `${name} validation must not silently rewrite the world`);
  });
}

const tests = [
  testDeterministicGeneration,
  testInitialInvariants,
  testUpgradeWithoutReplacement,
  testMaxInvestmentPreservesObjectDifferences,
  testStorageNoLoss,
  testWorkModesRemainValid,
  testRealVacancyMove,
  testPropertyFixturesRemainBoundAndTenantsRetainAgency,
  testLongObserverRun,
  testDeterministicEvolution,
  testExportImport,
  testValidationRejectsCorruptionWithoutSilentRewrite
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

if (passed === tests.length) {
  console.log(`\n${passed}/${tests.length} tests passed.`);
}
