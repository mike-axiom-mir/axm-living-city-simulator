(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Habitats = AXM.Habitats;

  const AFFORDANCE_SCHEMA = 'axm.living-city.object-use-affordances/v0.12.0-draft';

  const OBJECT_RULES = [
    {
      actionId: 'sleep',
      categories: ['sleep'],
      reason: 'A persistent sleeping object can ground sleep without inventing a new bed or room.'
    },
    {
      actionId: 'eat_home',
      categories: ['food'],
      reason: 'A persistent food-preparation object can ground a home meal.'
    },
    {
      actionId: 'play_pc',
      catalogIds: ['old_laptop', 'fast_computer'],
      reason: 'A real computer already placed in the room can ground computer play.'
    },
    {
      actionId: 'study_focus',
      categories: ['work', 'surface', 'storage'],
      catalogIds: ['old_laptop', 'fast_computer', 'story_shelf'],
      reason: 'A persistent work surface, study object, or computer can ground focused study.'
    },
    {
      actionId: 'creative_time',
      categories: ['work', 'surface'],
      catalogIds: ['old_laptop', 'fast_computer', 'music_player', 'story_shelf'],
      reason: 'A persistent creative surface or tool can ground open-ended creative time.'
    },
    {
      actionId: 'practice_repair',
      catalogIds: ['workbench'],
      reason: 'A real repair workbench can ground repair practice.'
    }
  ];

  function sortedUnique(values) {
    return Array.from(new Set(values)).sort();
  }

  function cellsForObject(object) {
    return World.footprintCells(object).map((key) => Habitats.parseCellKey(key));
  }

  function objectRoom(property, object) {
    return Habitats.roomAtCell(property, object.position?.x, object.position?.y);
  }

  function objectDescriptor(object) {
    const definition = Content.furnitureById(object.catalogId);
    return {
      id: object.id,
      catalogId: object.catalogId,
      name: definition?.name || Core.titleCase(object.catalogId || 'object'),
      category: definition?.category || 'unknown',
      ownerId: object.ownerId || null,
      ownershipMode: object.ownershipMode || 'personal',
      position: {
        x: Number(object.position?.x) || 0,
        y: Number(object.position?.y) || 0,
        rotation: Number(object.position?.rotation) || 0
      },
      footprint: Array.isArray(object.footprint) ? object.footprint.slice() : [1, 1],
      condition: Number(object.condition) || 0,
      usageHours: Number(object.usageHours) || 0
    };
  }

  function objectMatchesRule(object, rule) {
    const definition = Content.furnitureById(object.catalogId);
    const categoryMatch = Array.isArray(rule.categories) && rule.categories.includes(definition?.category);
    const catalogMatch = Array.isArray(rule.catalogIds) && rule.catalogIds.includes(object.catalogId);
    return Boolean(categoryMatch || catalogMatch);
  }

  function permissionHint(actorId, object) {
    if (!object) return 'room_access_still_required';
    if (object.ownershipMode === 'property_fixture') return 'fixture_use_still_requires_room_access';
    if (!object.ownerId) return 'unowned_object_still_requires_room_access';
    if (object.ownerId === actorId) return 'actor_owned_object';
    if (object.ownershipMode === 'shared') return 'shared_object_still_requires_room_access';
    return 'other_owned_object_requires_permission';
  }

  function occupiedCellSet(property, ignoreObjectId = null) {
    const occupied = new Set();
    (property.furniture || []).forEach((object) => {
      if (object.id === ignoreObjectId) return;
      World.footprintCells(object).forEach((key) => occupied.add(key));
    });
    return occupied;
  }

  function approachCells(property, room, object) {
    const roomCells = new Set(room.cells || []);
    const occupied = occupiedCellSet(property, object.id);
    const objectCells = new Set(World.footprintCells(object));
    const candidates = [];
    const seen = new Set();

    cellsForObject(object).forEach((cell) => {
      [
        { x: cell.x, y: cell.y - 1 },
        { x: cell.x + 1, y: cell.y },
        { x: cell.x, y: cell.y + 1 },
        { x: cell.x - 1, y: cell.y }
      ].forEach((candidate) => {
        const key = Habitats.cellKey(candidate.x, candidate.y);
        if (seen.has(key) || !roomCells.has(key) || occupied.has(key) || objectCells.has(key)) return;
        seen.add(key);
        candidates.push(candidate);
      });
    });

    return candidates.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }

  function objectUseSpot(property, room, object) {
    return {
      kind: 'object',
      roomId: room.id,
      objectId: object.id,
      objectCells: cellsForObject(object),
      approachCells: approachCells(property, room, object),
      positionSource: 'persistent_furniture_and_room_graph'
    };
  }

  function actionDescriptor(actionId) {
    const action = Content.activityById(actionId);
    if (!action) return null;
    return {
      actionId: action.id,
      actionName: action.name,
      hours: action.hours,
      cost: action.cost,
      description: action.description
    };
  }

  function objectAffordance(property, room, actorId, object, rule) {
    const action = actionDescriptor(rule.actionId);
    if (!action) return null;
    const descriptor = objectDescriptor(object);
    return {
      id: `aff:${room.id}:${rule.actionId}:${object.id}`,
      source: 'persistent_object',
      ...action,
      reason: rule.reason,
      object: descriptor,
      objectId: descriptor.id,
      permissionHint: permissionHint(actorId, object),
      useSpot: objectUseSpot(property, room, object),
      noExecutionAuthority: true,
      noReward: true
    };
  }

  function roomUtilityAffordances(room) {
    const out = [];
    if (room.purpose === 'bathroom' && room.utilityAccess?.water && room.utilityAccess?.waste) {
      const action = actionDescriptor('shower');
      if (action) {
        out.push({
          id: `aff:${room.id}:shower:utility`,
          source: 'room_utility',
          ...action,
          reason: 'The existing bathroom room graph exposes real water and waste access.',
          object: null,
          objectId: null,
          permissionHint: 'room_access_still_required',
          useSpot: {
            kind: 'room_utility',
            roomId: room.id,
            utilities: ['water', 'waste'],
            positionSource: 'room_utility_graph'
          },
          noExecutionAuthority: true,
          noReward: true
        });
      }
    }
    const clean = actionDescriptor('clean_home');
    if (clean) {
      out.push({
        id: `aff:${room.id}:clean_home:room`,
        source: 'room_zone',
        ...clean,
        reason: 'The existing room can be the starting context for whole-home care without inventing an object.',
        object: null,
        objectId: null,
        permissionHint: 'room_access_still_required',
        useSpot: {
          kind: 'room_zone',
          roomId: room.id,
          positionSource: 'persistent_room_graph'
        },
        noExecutionAuthority: true,
        noReward: true
      });
    }
    return out;
  }

  function affordancesForRoom(world, propertyId, roomId, actorId = 'player') {
    const property = World.getProperty(world, propertyId);
    const room = Habitats.roomById(property, roomId);
    if (!property || !room) return null;

    const objects = (property.furniture || [])
      .filter((object) => objectRoom(property, object)?.id === room.id)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));

    const affordances = [];
    objects.forEach((object) => {
      OBJECT_RULES.forEach((rule) => {
        if (!objectMatchesRule(object, rule)) return;
        const affordance = objectAffordance(property, room, actorId, object, rule);
        if (affordance) affordances.push(affordance);
      });
    });
    affordances.push(...roomUtilityAffordances(room));
    affordances.sort((a, b) => a.actionId.localeCompare(b.actionId) || String(a.objectId || '').localeCompare(String(b.objectId || '')));

    return {
      schema: AFFORDANCE_SCHEMA,
      actorId,
      placeId: property.id,
      roomId: room.id,
      roomPurpose: room.purpose,
      habitatRevision: Number(property.habitat?.revision) || 0,
      evidence: 'persistent furniture + room graph + utility graph',
      affordances,
      actionIds: sortedUnique(affordances.map((entry) => entry.actionId)),
      noExecutionAuthority: true,
      permissionResolutionDeferred: true,
      noReward: true
    };
  }

  function validateProjection(world, projection) {
    const errors = [];
    const add = (message) => { if (errors.length < 80) errors.push(message); };
    if (!projection || projection.schema !== AFFORDANCE_SCHEMA) return { ok: false, errors: ['Invalid object-use affordance schema.'] };
    if (projection.noExecutionAuthority !== true) add('Affordance projection must not claim execution authority.');
    if (projection.permissionResolutionDeferred !== true) add('Permission resolution must remain explicit and deferred in this stage.');
    const property = World.getProperty(world, projection.placeId);
    const room = Habitats.roomById(property, projection.roomId);
    if (!property || !room) return { ok: false, errors: ['Projection references an unknown residential room.'] };
    const roomCells = new Set(room.cells || []);
    const objectIds = new Set((property.furniture || []).filter((object) => objectRoom(property, object)?.id === room.id).map((object) => object.id));
    const ids = new Set();

    (projection.affordances || []).forEach((entry) => {
      if (!entry.id || ids.has(entry.id)) add(`Duplicate or missing affordance id ${String(entry.id)}.`);
      ids.add(entry.id);
      if (!Content.activityById(entry.actionId)) add(`${entry.id} references unknown activity ${String(entry.actionId)}.`);
      if (entry.noExecutionAuthority !== true) add(`${entry.id} claims execution authority.`);
      if (entry.noReward !== true) add(`${entry.id} must remain reward-neutral.`);
      if (entry.source === 'persistent_object') {
        if (!entry.objectId || !objectIds.has(entry.objectId)) add(`${entry.id} references an object outside the room.`);
        if (entry.useSpot?.objectId !== entry.objectId) add(`${entry.id} use spot does not match its object.`);
        (entry.useSpot?.objectCells || []).concat(entry.useSpot?.approachCells || []).forEach((cell) => {
          const key = Habitats.cellKey(cell.x, cell.y);
          if (!roomCells.has(key)) add(`${entry.id} contains a use cell outside the room graph.`);
        });
      } else if (!['room_utility', 'room_zone'].includes(entry.source)) {
        add(`${entry.id} has unsupported source ${String(entry.source)}.`);
      }
    });

    return { ok: errors.length === 0, errors };
  }

  AXM.ObjectUse = {
    AFFORDANCE_SCHEMA,
    OBJECT_RULES,
    permissionHint,
    approachCells,
    affordancesForRoom,
    validateProjection
  };
}(typeof window !== 'undefined' ? window : globalThis));
