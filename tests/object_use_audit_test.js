'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
globalThis.document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; }
};
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'object_use', 'object_use_audit', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence', 'visuals', 'game', 'ui']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Habitats, ObjectUseAudit } = globalThis.AXM;

function newWorld(seed = 'AXM-OBJECT-USE-AUDIT-TEST') {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  return world;
}

function roomByPurpose(world, purpose) {
  const home = World.homeOf(world, 'player');
  const room = home.habitat.rooms.find((entry) => entry.purpose === purpose);
  assert.ok(room, `Starting home needs a ${purpose} room.`);
  return { home, room };
}

function testSleepingUseHasReachableApproachEvidence() {
  const world = newWorld('OBJECT-AUDIT-SLEEP');
  const { home, room } = roomByPurpose(world, 'sleep');
  const audit = ObjectUseAudit.auditForRoom(world, home.id, room.id);
  assert.ok(audit);
  const sleep = audit.affordances.find((entry) => entry.actionId === 'sleep' && entry.objectId);
  assert.ok(sleep, 'A usable sleeping object should survive the reachability audit.');
  assert.equal(sleep.audit.spatiallyGrounded, true);
  assert.equal(sleep.audit.positionPrecision, 'exact_object_plus_reachable_approach');
  assert.ok(sleep.audit.approachCells.length >= 1);
  const reachable = Habitats.reachableCells(home);
  sleep.audit.approachCells.forEach((cell) => assert.equal(reachable.has(Habitats.cellKey(cell.x, cell.y)), true));
  assert.equal(ObjectUseAudit.validateAudit(world, audit).ok, true);
}

function testBathroomUtilityStaysRoomZoneHonest() {
  const world = newWorld('OBJECT-AUDIT-BATHROOM');
  const { home, room } = roomByPurpose(world, 'bathroom');
  const audit = ObjectUseAudit.auditForRoom(world, home.id, room.id);
  const shower = audit.affordances.find((entry) => entry.actionId === 'shower');
  assert.ok(shower);
  assert.equal(shower.source, 'room_utility');
  assert.equal(shower.audit.positionPrecision, 'reachable_room_zone_only');
  assert.ok(shower.audit.approachCells.length >= 1);
  assert.equal(shower.objectId, null);
}

function testPermissionSnapshotIsEvidenceNotAuthority() {
  const world = newWorld('OBJECT-AUDIT-PERMISSION');
  const { home, room } = roomByPurpose(world, 'sleep');
  room.permissionSnapshot = {
    kind: 'partner_private',
    holderIds: ['npc_001'],
    source: 'test_snapshot'
  };
  const before = Core.serializeWorld(world);
  const audit = ObjectUseAudit.auditForRoom(world, home.id, room.id, 'player');
  assert.equal(audit.roomPermission.status, 'actor_not_listed_in_snapshot');
  assert.equal(audit.roomPermission.actorListed, false);
  assert.equal(audit.permissionResolutionDeferred, true);
  assert.equal(audit.noExecutionAuthority, true);
  audit.affordances.forEach((entry) => {
    assert.equal(entry.audit.permission.requiresResolution, true);
    assert.equal(entry.audit.permission.noAuthorityGranted, true);
  });
  assert.equal(Core.serializeWorld(world), before, 'Permission audit must not mutate or refresh authoritative state.');
}

function testAuditIsDeterministicAndReadOnly() {
  const world = newWorld('OBJECT-AUDIT-DETERMINISTIC');
  const { home, room } = roomByPurpose(world, 'sleep');
  const before = Core.serializeWorld(world);
  const first = ObjectUseAudit.auditForRoom(world, home.id, room.id);
  const second = ObjectUseAudit.auditForRoom(world, home.id, room.id);
  assert.deepEqual(second, first);
  assert.equal(first.readOnly, true);
  assert.equal(Core.serializeWorld(world), before);
}

function testAuditedApproachesStayInRoomAndReachable() {
  const world = newWorld('OBJECT-AUDIT-CELLS');
  const home = World.homeOf(world, 'player');
  const reachable = Habitats.reachableCells(home);
  home.habitat.rooms.forEach((room) => {
    const roomCells = new Set(room.cells);
    const audit = ObjectUseAudit.auditForRoom(world, home.id, room.id);
    assert.ok(audit);
    audit.affordances.forEach((entry) => {
      entry.audit.approachCells.forEach((cell) => {
        const key = Habitats.cellKey(cell.x, cell.y);
        assert.equal(roomCells.has(key), true, `${entry.id} escaped ${room.id}.`);
        assert.equal(reachable.has(key), true, `${entry.id} used an unreachable approach cell.`);
      });
    });
    assert.equal(ObjectUseAudit.validateAudit(world, audit).ok, true);
  });
}

function testUnknownRoomReturnsNoAudit() {
  const world = newWorld('OBJECT-AUDIT-UNKNOWN');
  assert.equal(ObjectUseAudit.auditForRoom(world, world.player.homePropertyId, 'missing_room'), null);
}

const tests = [
  testSleepingUseHasReachableApproachEvidence,
  testBathroomUtilityStaysRoomZoneHonest,
  testPermissionSnapshotIsEvidenceNotAuthority,
  testAuditIsDeterministicAndReadOnly,
  testAuditedApproachesStayInRoomAndReachable,
  testUnknownRoomReturnsNoAudit
];

for (const test of tests) test();
console.log(`PASS object-use audit tests: ${tests.length}/${tests.length}`);
