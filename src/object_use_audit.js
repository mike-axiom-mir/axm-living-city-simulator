(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const World = AXM.World;
  const Habitats = AXM.Habitats;
  const ObjectUse = AXM.ObjectUse;

  const AUDIT_SCHEMA = 'axm.living-city.object-use-audit/v0.12.0-draft';

  function sortedUnique(values) {
    return Array.from(new Set(values)).sort();
  }

  function roomPermissionEvidence(room, actorId) {
    const snapshot = room?.permissionSnapshot && typeof room.permissionSnapshot === 'object'
      ? room.permissionSnapshot
      : null;
    const holderIds = sortedUnique((snapshot?.holderIds || []).filter(Boolean));
    const actorListed = holderIds.includes(actorId);
    let status = 'unresolved';
    if (snapshot) {
      if (actorListed) status = 'actor_listed_in_snapshot';
      else if (holderIds.length) status = 'actor_not_listed_in_snapshot';
      else status = 'no_explicit_holders_in_snapshot';
    }
    return {
      status,
      kind: snapshot?.kind || 'unspecified',
      source: snapshot?.source || 'none',
      holderIds,
      actorListed,
      advisoryOnly: true
    };
  }

  function occupiedCells(property, ignoreObjectId = null) {
    const occupied = new Set();
    (property?.furniture || []).forEach((object) => {
      if (object.id === ignoreObjectId) return;
      World.footprintCells(object).forEach((key) => occupied.add(key));
    });
    return occupied;
  }

  function objectCells(entry) {
    return new Set((entry?.useSpot?.objectCells || []).map((cell) => Habitats.cellKey(cell.x, cell.y)));
  }

  function reachableRoomCells(property, room) {
    if (!property || !room) return [];
    const reachable = Habitats.reachableCells(property);
    return (room.cells || [])
      .filter((key) => reachable.has(key))
      .map((key) => Habitats.parseCellKey(key))
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }

  function reachableFreeRoomCells(property, room, ignoreObjectId = null) {
    if (!property || !room) return [];
    const occupied = occupiedCells(property, ignoreObjectId);
    return reachableRoomCells(property, room)
      .filter((cell) => !occupied.has(Habitats.cellKey(cell.x, cell.y)));
  }

  function auditedApproachCells(property, room, entry) {
    const roomCells = new Set(room.cells || []);
    const reachable = Habitats.reachableCells(property);
    const occupied = occupiedCells(property, entry.objectId || null);
    const blockedByOwnObject = objectCells(entry);
    const supplied = Array.isArray(entry?.useSpot?.approachCells) ? entry.useSpot.approachCells : [];

    if (supplied.length) {
      return supplied.filter((cell) => {
        const key = Habitats.cellKey(cell.x, cell.y);
        return roomCells.has(key) && reachable.has(key) && !occupied.has(key) && !blockedByOwnObject.has(key);
      }).sort((a, b) => (a.y - b.y) || (a.x - b.x));
    }

    // Room-level utility/zone affordances deliberately do not claim an exact
    // standing position. Their spatial evidence is only that the room itself
    // is structurally reachable. Requiring an unoccupied cell here would turn
    // coarse room evidence into false object-level precision and could hide a
    // legitimate bathroom/kitchen utility merely because furniture occupies
    // every cell in a tiny room.
    if (entry.source !== 'persistent_object') {
      return reachableRoomCells(property, room).slice(0, 12);
    }

    return reachableFreeRoomCells(property, room, entry.objectId || null).slice(0, 12);
  }

  function auditAffordance(property, room, actorId, entry) {
    const approachCells = auditedApproachCells(property, room, entry);
    const exactObject = entry.source === 'persistent_object';
    const permission = {
      objectHint: entry.permissionHint || (entry.objectId ? 'object_permission_unspecified' : 'room_access_still_required'),
      room: roomPermissionEvidence(room, actorId),
      requiresResolution: true,
      noAuthorityGranted: true
    };
    return {
      ...Core.deepClone(entry),
      audit: {
        spatiallyGrounded: approachCells.length > 0,
        positionPrecision: exactObject ? 'exact_object_plus_reachable_approach' : 'reachable_room_zone_only',
        approachCells,
        permission,
        evidence: exactObject
          ? 'persistent object + room graph + structural reachability'
          : 'persistent room/utility graph + structural reachability'
      },
      noExecutionAuthority: true,
      noReward: true
    };
  }

  function auditForRoom(world, propertyId, roomId, actorId = 'player') {
    const property = World.getProperty(world, propertyId);
    const room = Habitats.roomById(property, roomId);
    if (!property || !room || !ObjectUse?.affordancesForRoom) return null;

    const before = Core.serializeWorld(world);
    const base = ObjectUse.affordancesForRoom(world, propertyId, roomId, actorId);
    if (!base) return null;
    const audited = (base.affordances || []).map((entry) => auditAffordance(property, room, actorId, entry));
    const grounded = audited.filter((entry) => entry.audit.spatiallyGrounded);
    const blocked = audited.filter((entry) => !entry.audit.spatiallyGrounded).map((entry) => ({
      id: entry.id,
      actionId: entry.actionId,
      objectId: entry.objectId || null,
      source: entry.source,
      reason: entry.source === 'persistent_object'
        ? 'No structurally reachable free approach position was found for this persistent object.'
        : 'The authoritative room graph is not structurally reachable.',
      permission: entry.audit.permission,
      noExecutionAuthority: true
    }));
    const after = Core.serializeWorld(world);

    return {
      schema: AUDIT_SCHEMA,
      sourceSchema: base.schema,
      actorId,
      placeId: property.id,
      roomId: room.id,
      habitatRevision: Number(property.habitat?.revision) || 0,
      roomPermission: roomPermissionEvidence(room, actorId),
      affordances: grounded,
      blockedCandidates: blocked,
      actionIds: sortedUnique(grounded.map((entry) => entry.actionId)),
      readOnly: before === after,
      noExecutionAuthority: true,
      permissionResolutionDeferred: true,
      noReward: true
    };
  }

  function validateAudit(world, audit) {
    const errors = [];
    const add = (message) => { if (errors.length < 80) errors.push(message); };
    if (!audit || audit.schema !== AUDIT_SCHEMA) return { ok: false, errors: ['Invalid object-use audit schema.'] };
    if (audit.readOnly !== true) add('Object-use audit mutated authoritative world state.');
    if (audit.noExecutionAuthority !== true) add('Audit must not claim execution authority.');
    if (audit.permissionResolutionDeferred !== true) add('Permission resolution must remain deferred.');
    if (audit.noReward !== true) add('Audit must remain reward-neutral.');

    const property = World.getProperty(world, audit.placeId);
    const room = Habitats.roomById(property, audit.roomId);
    if (!property || !room) return { ok: false, errors: ['Audit references an unknown residential room.'] };
    const roomCells = new Set(room.cells || []);
    const reachable = Habitats.reachableCells(property);
    const ids = new Set();

    (audit.affordances || []).forEach((entry) => {
      if (!entry.id || ids.has(entry.id)) add(`Duplicate or missing audited affordance id ${String(entry.id)}.`);
      ids.add(entry.id);
      if (entry.audit?.spatiallyGrounded !== true) add(`${entry.id} was exposed without grounded room evidence.`);
      if (!Array.isArray(entry.audit?.approachCells) || !entry.audit.approachCells.length) add(`${entry.id} has no audited spatial evidence cells.`);
      if (entry.audit?.permission?.requiresResolution !== true || entry.audit?.permission?.noAuthorityGranted !== true) add(`${entry.id} permission evidence overreaches.`);
      (entry.audit?.approachCells || []).forEach((cell) => {
        const key = Habitats.cellKey(cell.x, cell.y);
        if (!roomCells.has(key)) add(`${entry.id} spatial evidence escaped the room.`);
        if (!reachable.has(key)) add(`${entry.id} spatial evidence is not structurally reachable.`);
      });
    });

    (audit.blockedCandidates || []).forEach((entry) => {
      if (!entry.id || ids.has(entry.id)) add(`Duplicate or missing blocked candidate id ${String(entry.id)}.`);
      ids.add(entry.id);
      if (entry.noExecutionAuthority !== true) add(`${entry.id} blocked candidate claims execution authority.`);
    });

    return { ok: errors.length === 0, errors };
  }

  AXM.ObjectUseAudit = {
    AUDIT_SCHEMA,
    roomPermissionEvidence,
    reachableRoomCells,
    reachableFreeRoomCells,
    auditForRoom,
    validateAudit
  };
}(typeof window !== 'undefined' ? window : globalThis));
