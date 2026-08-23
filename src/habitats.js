(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Systems = AXM.Systems;

  const HABITAT_SCHEMA = 'axm.structural-habitat/v0.4.0';
  const PROJECT_SCHEMA = 'axm.construction-project/v0.4.0';
  const PROJECT_TYPES = ['partition', 'surface', 'utility', 'repair'];
  const PROJECT_STATUSES = ['planned', 'active', 'completed', 'cancelled', 'failed'];
  const PARTITION_KINDS = ['wall', 'door', 'open'];
  const UTILITY_TYPES = ['power', 'water', 'waste'];
  const ROOM_PURPOSES = [
    { id: 'flexible', name: 'Flexible room', note: 'No fixed optimisation role.' },
    { id: 'entry', name: 'Entry', note: 'Arrival, shoes, coats, and circulation.' },
    { id: 'living', name: 'Living room', note: 'Shared rest and social activity.' },
    { id: 'sleep', name: 'Sleeping room', note: 'Privacy and recovery.' },
    { id: 'work', name: 'Work or study', note: 'Focused activity without forcing a career.' },
    { id: 'kitchen', name: 'Kitchen', note: 'Food work where water and power help.' },
    { id: 'bathroom', name: 'Bathroom', note: 'Wet room with water and waste access.' },
    { id: 'storage', name: 'Storage', note: 'Keeps objects without deleting them.' },
    { id: 'hobby', name: 'Hobby room', note: 'Creative or playful activity.' },
    { id: 'workshop', name: 'Workshop', note: 'Repair and material work.' }
  ];
  const WALL_MATERIALS = [
    { id: 'reclaimed_timber', name: 'Reclaimed timber', durability: 58, costFactor: 0.8, material: 'wood' },
    { id: 'timber_frame', name: 'Timber frame', durability: 72, costFactor: 1, material: 'wood' },
    { id: 'light_metal', name: 'Light metal frame', durability: 82, costFactor: 1.3, material: 'metal' },
    { id: 'masonry', name: 'Masonry', durability: 92, costFactor: 1.6, material: 'metal' }
  ];
  const FINISHES = [
    { id: 'bare', name: 'Honest bare surface', color: '#8b8f91', costFactor: 0.35 },
    { id: 'soft_white', name: 'Soft white', color: '#e6e3da', costFactor: 0.8 },
    { id: 'warm_clay', name: 'Warm clay', color: '#a86f5b', costFactor: 1 },
    { id: 'moss_wash', name: 'Moss wash', color: '#6f8870', costFactor: 1 },
    { id: 'night_blue', name: 'Night blue', color: '#415a77', costFactor: 1.05 },
    { id: 'plum_lime', name: 'Plum limewash', color: '#75566f', costFactor: 1.15 },
    { id: 'reclaimed_wood', name: 'Reclaimed wood', color: '#8c6d52', costFactor: 1.35 },
    { id: 'small_tile', name: 'Small tile', color: '#8aa7a2', costFactor: 1.45 },
    { id: 'dark_cork', name: 'Dark cork', color: '#665449', costFactor: 1.2 },
    { id: 'painted_concrete', name: 'Painted concrete', color: '#777f87', costFactor: 1.1 }
  ];

  const METRIC_DEFAULTS = {
    habitatProjectsPlanned: 0,
    habitatProjectsCompleted: 0,
    habitatProjectsCancelled: 0,
    habitatProjectsFailed: 0,
    structuralChanges: 0,
    surfaceProjects: 0,
    utilityProjects: 0,
    habitatRepairs: 0,
    roomPurposeChanges: 0,
    habitatObjectsReflowed: 0,
    habitatObjectsStored: 0,
    habitatMigrations: 0
  };

  function isResidential(property) {
    return Boolean(property && property.kind === 'residential' && Array.isArray(property.roomGrid));
  }

  function roomPurpose(id) {
    return ROOM_PURPOSES.find((entry) => entry.id === id) || ROOM_PURPOSES[0];
  }

  function finishById(id) {
    return FINISHES.find((entry) => entry.id === id) || FINISHES[0];
  }

  function materialById(id) {
    return WALL_MATERIALS.find((entry) => entry.id === id) || WALL_MATERIALS[1];
  }

  function cellKey(x, y) {
    return `${x},${y}`;
  }

  function parseCellKey(key) {
    const [x, y] = String(key).split(',').map(Number);
    return { x, y };
  }

  function edgeKey(orientation, x, y) {
    return `${orientation}:${x}:${y}`;
  }

  function parseEdgeKey(key) {
    const [orientation, sx, sy] = String(key || '').split(':');
    return { orientation, x: Number(sx), y: Number(sy) };
  }

  function edgeCells(property, key) {
    const [w, h] = property.roomGrid;
    const parsed = parseEdgeKey(key);
    if (parsed.orientation === 'V' && Number.isInteger(parsed.x) && Number.isInteger(parsed.y)
      && parsed.x >= 1 && parsed.x < w && parsed.y >= 0 && parsed.y < h) {
      return [{ x: parsed.x - 1, y: parsed.y }, { x: parsed.x, y: parsed.y }];
    }
    if (parsed.orientation === 'H' && Number.isInteger(parsed.x) && Number.isInteger(parsed.y)
      && parsed.x >= 0 && parsed.x < w && parsed.y >= 1 && parsed.y < h) {
      return [{ x: parsed.x, y: parsed.y - 1 }, { x: parsed.x, y: parsed.y }];
    }
    return null;
  }

  function canonicalPartition(property, key, kind = 'wall', options = {}) {
    if (!edgeCells(property, key)) throw new Error(`Invalid internal edge ${key}.`);
    const material = materialById(options.materialId || 'timber_frame');
    return {
      id: key,
      key,
      kind,
      materialId: material.id,
      condition: Core.clamp(Core.safeNumber(options.condition, 82), 0, 100),
      loadBearing: Boolean(options.loadBearing),
      createdDay: Core.safeNumber(options.createdDay, 1),
      door: kind === 'door' ? {
        styleId: options.doorStyleId || 'simple',
        open: options.open !== false,
        lockPolicy: options.lockPolicy || 'household_members',
        condition: Core.clamp(Core.safeNumber(options.doorCondition, 84), 0, 100)
      } : null,
      history: Array.isArray(options.history) ? options.history : []
    };
  }

  function partitionMap(property) {
    const map = new Map();
    (property.habitat?.partitions || []).forEach((entry) => map.set(entry.key, entry));
    return map;
  }

  function partitionAt(property, key) {
    return (property.habitat?.partitions || []).find((entry) => entry.key === key) || null;
  }

  function setPartition(property, key, kind, options = {}) {
    const habitat = property.habitat;
    if (!habitat) throw new Error('Habitat state is missing.');
    habitat.partitions = habitat.partitions.filter((entry) => entry.key !== key);
    if (kind !== 'open') habitat.partitions.push(canonicalPartition(property, key, kind, options));
    habitat.partitions.sort((a, b) => a.key.localeCompare(b.key));
  }

  function boundaryKeyBetween(a, b) {
    if (a.x === b.x && Math.abs(a.y - b.y) === 1) return edgeKey('H', a.x, Math.max(a.y, b.y));
    if (a.y === b.y && Math.abs(a.x - b.x) === 1) return edgeKey('V', Math.max(a.x, b.x), a.y);
    return null;
  }

  function neighbors(property, cell) {
    const [w, h] = property.roomGrid;
    return [
      { x: cell.x - 1, y: cell.y },
      { x: cell.x + 1, y: cell.y },
      { x: cell.x, y: cell.y - 1 },
      { x: cell.x, y: cell.y + 1 }
    ].filter((entry) => entry.x >= 0 && entry.x < w && entry.y >= 0 && entry.y < h);
  }

  function cellsOverlap(a, b) {
    const bSet = new Set(b || []);
    return (a || []).reduce((count, key) => count + (bSet.has(key) ? 1 : 0), 0);
  }

  function nextRoomId(property) {
    const habitat = property.habitat;
    habitat.nextRoomCounter = Math.max(0, Math.floor(Core.safeNumber(habitat.nextRoomCounter, 0))) + 1;
    return `room_${property.id}_${String(habitat.nextRoomCounter).padStart(3, '0')}`;
  }

  function roomDefaultFinish(property, purpose = 'flexible') {
    const styleDefaults = {
      patched: ['reclaimed_wood', 'warm_clay'],
      minimal: ['painted_concrete', 'soft_white'],
      warm: ['reclaimed_wood', 'warm_clay'],
      industrial: ['painted_concrete', 'bare'],
      playful: ['dark_cork', 'plum_lime'],
      green: ['reclaimed_wood', 'moss_wash'],
      vintage: ['reclaimed_wood', 'soft_white'],
      clean: ['small_tile', 'soft_white']
    };
    const [floorFinishId, wallFinishId] = styleDefaults[property.style] || ['dark_cork', 'soft_white'];
    if (purpose === 'bathroom') return { floorFinishId: 'small_tile', wallFinishId: 'soft_white', condition: 84 };
    return { floorFinishId, wallFinishId, condition: 78 };
  }

  function computeRooms(property, options = {}) {
    if (!property.habitat) return [];
    const previousRooms = Array.isArray(options.previousRooms) ? options.previousRooms : (property.habitat.rooms || []);
    const [w, h] = property.roomGrid;
    const partitions = partitionMap(property);
    const visited = new Set();
    const components = [];

    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const startKey = cellKey(x, y);
        if (visited.has(startKey)) continue;
        const queue = [{ x, y }];
        const cells = [];
        visited.add(startKey);
        while (queue.length) {
          const cell = queue.shift();
          cells.push(cellKey(cell.x, cell.y));
          neighbors(property, cell).forEach((neighbor) => {
            const key = cellKey(neighbor.x, neighbor.y);
            if (visited.has(key)) return;
            const boundary = boundaryKeyBetween(cell, neighbor);
            const partition = partitions.get(boundary);
            // Walls and doors both establish room identity. Doors remain passable
            // in the navigation graph, but do not collapse two rooms into one.
            if (partition && ['wall', 'door'].includes(partition.kind)) return;
            visited.add(key);
            queue.push(neighbor);
          });
        }
        components.push(cells.sort((a, b) => {
          const ca = parseCellKey(a); const cb = parseCellKey(b);
          return ca.y - cb.y || ca.x - cb.x;
        }));
      }
    }

    const matches = [];
    components.forEach((cells, componentIndex) => {
      previousRooms.forEach((room, roomIndex) => {
        const overlap = cellsOverlap(cells, room.cells || []);
        if (overlap > 0) matches.push({ componentIndex, roomIndex, overlap, ratio: overlap / Math.max(cells.length, (room.cells || []).length, 1) });
      });
    });
    matches.sort((a, b) => b.overlap - a.overlap || b.ratio - a.ratio || a.componentIndex - b.componentIndex || a.roomIndex - b.roomIndex);
    const usedComponents = new Set();
    const usedRooms = new Set();
    const matched = new Map();
    matches.forEach((entry) => {
      if (usedComponents.has(entry.componentIndex) || usedRooms.has(entry.roomIndex)) return;
      usedComponents.add(entry.componentIndex);
      usedRooms.add(entry.roomIndex);
      matched.set(entry.componentIndex, previousRooms[entry.roomIndex]);
    });

    const rooms = components.map((cells, index) => {
      const points = cells.map(parseCellKey);
      const minX = Math.min(...points.map((point) => point.x));
      const minY = Math.min(...points.map((point) => point.y));
      const maxX = Math.max(...points.map((point) => point.x));
      const maxY = Math.max(...points.map((point) => point.y));
      const previous = matched.get(index);
      const purpose = previous?.purpose || 'flexible';
      const finish = previous?.finish || roomDefaultFinish(property, purpose);
      return {
        id: previous?.id || nextRoomId(property),
        name: previous?.name || `Room ${index + 1}`,
        purpose,
        purposeSource: previous?.purposeSource || (previous ? 'inferred' : 'unassigned'),
        cells,
        anchor: { x: minX, y: minY },
        bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
        area: cells.length,
        centroid: {
          x: Core.round(points.reduce((sum, point) => sum + point.x, 0) / cells.length, 2),
          y: Core.round(points.reduce((sum, point) => sum + point.y, 0) / cells.length, 2)
        },
        finish: {
          floorFinishId: finishById(finish.floorFinishId).id,
          wallFinishId: finishById(finish.wallFinishId).id,
          condition: Core.clamp(Core.safeNumber(finish.condition, 78), 0, 100)
        },
        utilityAccess: {
          power: Boolean(previous?.utilityAccess?.power),
          water: Boolean(previous?.utilityAccess?.water),
          waste: Boolean(previous?.utilityAccess?.waste)
        },
        permissionSnapshot: previous?.permissionSnapshot || { kind: 'resident_shared', holderIds: [], source: 'property' },
        history: Array.isArray(previous?.history) ? previous.history : []
      };
    });

    rooms.sort((a, b) => a.anchor.y - b.anchor.y || a.anchor.x - b.anchor.x || a.id.localeCompare(b.id));
    property.habitat.rooms = rooms;
    property.habitat.roomConnections = computeRoomConnections(property);
    property.habitat.layoutHash = layoutHash(property);
    return rooms;
  }

  function roomAtCell(property, x, y) {
    if (!property?.habitat?.rooms) return null;
    const key = cellKey(x, y);
    return property.habitat.rooms.find((room) => room.cells.includes(key)) || null;
  }

  function roomById(property, roomId) {
    return property?.habitat?.rooms?.find((room) => room.id === roomId) || null;
  }

  function computeRoomConnections(property) {
    const connections = [];
    (property.habitat?.partitions || []).filter((entry) => entry.kind === 'door').forEach((door) => {
      const cells = edgeCells(property, door.key);
      if (!cells) return;
      const roomA = roomAtCell(property, cells[0].x, cells[0].y);
      const roomB = roomAtCell(property, cells[1].x, cells[1].y);
      if (!roomA || !roomB || roomA.id === roomB.id) return;
      connections.push({
        id: `connection_${door.key}`,
        edgeKey: door.key,
        kind: 'door',
        roomIds: [roomA.id, roomB.id].sort(),
        passable: door.door?.open !== false,
        lockPolicy: door.door?.lockPolicy || 'household_members'
      });
    });
    return connections.sort((a, b) => a.id.localeCompare(b.id));
  }

  function layoutHash(property) {
    const source = (property.habitat?.partitions || []).map((entry) => `${entry.key}:${entry.kind}:${entry.materialId}`).sort().join('|');
    return Core.hashString(`${property.id}|${property.roomGrid.join('x')}|${source}`).toString(16).padStart(8, '0');
  }

  function buildTemplatePartitions(property) {
    const [w, h] = property.roomGrid;
    const entries = new Map();
    const put = (orientation, x, y, kind = 'wall') => {
      const key = edgeKey(orientation, x, y);
      if (!edgeCells(property, key)) return;
      entries.set(key, canonicalPartition(property, key, kind, {
        materialId: property.type === 'house' ? 'timber_frame' : 'light_metal',
        condition: Core.clamp(property.condition || 82, 58, 96),
        createdDay: 1
      }));
    };

    // Every home receives a compact wet room. This provides a real room and
    // utility anchor without pretending that high graphics are required.
    const wetWidth = w >= 14 ? 3 : 2;
    const wetHeight = h >= 9 ? 3 : 2;
    const wetX = w - wetWidth;
    const wetY = wetHeight;
    for (let y = 0; y < wetHeight; y += 1) put('V', wetX, y, 'wall');
    for (let x = wetX; x < w; x += 1) put('H', x, wetY, x === Math.min(w - 1, wetX + 1) ? 'door' : 'wall');

    if (property.capacity >= 2) {
      const splitX = Math.max(3, Math.min(w - 3, Math.floor(w * 0.55)));
      const doorY = Math.max(wetY + 1, Math.min(h - 2, Math.floor((wetY + h) / 2)));
      for (let y = wetY; y < h; y += 1) put('V', splitX, y, y === doorY ? 'door' : 'wall');
    }

    if (property.capacity >= 3 && h >= 8) {
      const splitX = Math.max(3, Math.min(w - 3, Math.floor(w * 0.55)));
      const splitY = Math.max(wetY + 2, Math.min(h - 2, Math.floor(h * 0.62)));
      const leftDoorX = Math.max(1, Math.floor(splitX / 2));
      const rightDoorX = Math.min(w - 2, splitX + Math.max(1, Math.floor((w - splitX) / 2)));
      for (let x = 0; x < w; x += 1) {
        const door = x === leftDoorX || x === rightDoorX;
        put('H', x, splitY, door ? 'door' : 'wall');
      }
    }

    if (property.capacity >= 4 && w >= 14) {
      const leftSplit = Math.max(2, Math.floor(w * 0.27));
      // This split belongs to the lower band. Starting it above the main
      // horizontal partition can leave the entrance room sealed behind a wall.
      const mainSplitY = property.capacity >= 3 && h >= 8
        ? Math.max(wetY + 2, Math.min(h - 2, Math.floor(h * 0.62)))
        : Math.max(wetY + 1, Math.floor(h * 0.45));
      const startY = mainSplitY;
      const doorY = Math.min(h - 2, startY + 1);
      for (let y = startY; y < h; y += 1) put('V', leftSplit, y, y === doorY ? 'door' : 'wall');
    }

    return Array.from(entries.values()).sort((a, b) => a.key.localeCompare(b.key));
  }

  function findRoomWithObject(property, predicate) {
    for (const object of property.furniture || []) {
      const definition = Content.furnitureById(object.catalogId);
      if (!predicate(object, definition)) continue;
      const room = roomAtCell(property, object.position.x, object.position.y);
      if (room) return room;
    }
    return null;
  }

  function assignInitialRoomMeaning(property) {
    const rooms = property.habitat.rooms;
    if (!rooms.length) return;
    const [w] = property.roomGrid;
    const isExplicit = (room) => ['player', 'agreement'].includes(room.purposeSource);
    const infer = (room, purpose, name) => {
      if (!room || isExplicit(room)) return false;
      room.purpose = purpose;
      room.name = name || roomPurpose(purpose).name;
      room.purposeSource = 'inferred';
      return true;
    };

    // Preserve an existing bathroom by stable room overlap. Only infer a new
    // one when the graph genuinely has none, and never overwrite an explicit
    // player/agreement purpose to manufacture it silently.
    let bathroom = rooms.find((room) => room.purpose === 'bathroom');
    if (!bathroom) {
      bathroom = rooms.slice()
        .sort((a, b) => a.area - b.area || b.centroid.x - a.centroid.x || a.centroid.y - b.centroid.y)
        .find((room) => !isExplicit(room));
      infer(bathroom, 'bathroom', property.sharedBathroom ? 'Shared Bathroom' : 'Bathroom');
    } else if (!bathroom.purposeSource || bathroom.purposeSource === 'unassigned') {
      bathroom.purposeSource = 'inferred';
    }
    if (bathroom?.purpose === 'bathroom' && !isExplicit(bathroom)) {
      bathroom.name = property.sharedBathroom ? 'Shared Bathroom' : 'Bathroom';
      bathroom.finish = roomDefaultFinish(property, 'bathroom');
    }

    const kitchenRoom = findRoomWithObject(property, (_object, definition) => definition?.category === 'food');
    if (kitchenRoom && kitchenRoom.id !== bathroom?.id && !isExplicit(kitchenRoom)
      && ['flexible', 'kitchen'].includes(kitchenRoom.purpose)) {
      infer(kitchenRoom, 'kitchen', 'Kitchen');
    }

    const entrance = property.habitat.entrance;
    const entryRoom = roomAtCell(property, entrance.x, entrance.y);
    if (entryRoom && !['bathroom', 'kitchen'].includes(entryRoom.purpose) && !isExplicit(entryRoom)
      && ['flexible', 'entry', 'living'].includes(entryRoom.purpose)) {
      const purpose = entryRoom.area >= Math.max(18, w * 1.5) ? 'living' : 'entry';
      infer(entryRoom, purpose, purpose === 'living' ? 'Living Room' : 'Entry');
    }

    // Only newly created/unassigned flexible rooms receive inferred sleep/work
    // meaning. Existing inferred meanings and explicit human choices survive a
    // later wall or door recompute by overlap.
    const remaining = rooms.filter((room) => room.purpose === 'flexible' && !isExplicit(room));
    const sleepRooms = remaining.slice().sort((a, b) => b.area - a.area || a.centroid.x - b.centroid.x);
    sleepRooms.forEach((room, index) => {
      if (index < Math.max(1, Math.min(property.capacity, sleepRooms.length - 1))) {
        infer(room, 'sleep', sleepRooms.length > 1 ? `Sleeping Room ${index + 1}` : 'Sleeping Room');
      } else {
        const purpose = index % 2 ? 'work' : 'flexible';
        if (purpose === 'work') infer(room, 'work', 'Work or Study Room');
        else if (!room.purposeSource || room.purposeSource === 'unassigned') room.purposeSource = 'inferred';
      }
    });

    // Actual possessions may refine only still-flexible inferred rooms. They do
    // not overrule a purpose explicitly chosen by the player or an agreement.
    rooms.forEach((room) => {
      if (isExplicit(room) || room.purpose !== 'flexible') return;
      const objects = (property.furniture || []).filter((object) => room.cells.includes(cellKey(object.position.x, object.position.y)));
      const categories = objects.map((object) => Content.furnitureById(object.catalogId)?.category);
      if (categories.filter((category) => category === 'sleep').length >= 1) {
        infer(room, 'sleep', 'Sleeping Room');
      } else if (categories.filter((category) => category === 'work' || category === 'activity').length >= 2) {
        infer(room, 'work', 'Work or Study Room');
      }
    });
  }

  function seedUtilities(property) {
    const rooms = property.habitat.rooms;
    rooms.forEach((room) => {
      room.utilityAccess.power = true;
      const wet = ['bathroom', 'kitchen'].includes(room.purpose);
      room.utilityAccess.water = wet;
      room.utilityAccess.waste = wet;
    });
    property.habitat.utilities = {
      serviceEntry: { x: property.habitat.entrance.x, y: property.habitat.entrance.y },
      services: {
        power: { level: 1, condition: Core.clamp((property.condition || 80) + 2, 0, 100), capacity: Math.max(2, Math.ceil(property.capacity * 1.5)) },
        water: { level: 1, condition: Core.clamp((property.condition || 80) - 2, 0, 100), capacity: Math.max(1, property.capacity) },
        waste: { level: 1, condition: Core.clamp((property.condition || 80) - 4, 0, 100), capacity: Math.max(1, property.capacity) }
      },
      history: []
    };
  }

  function footprintRespectsPartitions(property, x, y, footprint) {
    if (!property?.habitat?.partitions) return true;
    const map = partitionMap(property);
    for (let dy = 0; dy < footprint[1]; dy += 1) {
      for (let dx = 0; dx < footprint[0]; dx += 1) {
        const cell = { x: x + dx, y: y + dy };
        if (dx > 0) {
          const key = edgeKey('V', cell.x, cell.y);
          if (map.has(key)) return false;
        }
        if (dy > 0) {
          const key = edgeKey('H', cell.x, cell.y);
          if (map.has(key)) return false;
        }
      }
    }
    return true;
  }

  function objectUtilityNeeds(object) {
    const definition = Content.furnitureById(object.catalogId);
    if (!definition) return [];
    if (definition.category === 'food') return ['power', 'water', 'waste'];
    if (['activity', 'light'].includes(definition.category)) return ['power'];
    return [];
  }

  function objectFitsAt(property, object, x, y, footprint = object.footprint, options = {}) {
    if (!footprintRespectsPartitions(property, x, y, footprint)) return false;
    const firstRoom = roomAtCell(property, x, y);
    if (!firstRoom) return false;
    for (let dy = 0; dy < footprint[1]; dy += 1) {
      for (let dx = 0; dx < footprint[0]; dx += 1) {
        if (roomAtCell(property, x + dx, y + dy)?.id !== firstRoom.id) return false;
      }
    }
    if (options.ignoreUtilities) return true;
    return objectUtilityNeeds(object).every((type) => firstRoom.utilityAccess[type]);
  }

  function storageFor(world, ownerId) {
    const person = World.getPerson(world, ownerId);
    if (!person) return null;
    if (!Array.isArray(person.storedFurniture)) person.storedFurniture = [];
    return person.storedFurniture;
  }

  function reflowObjects(world, property, reason = 'structural room graph') {
    const original = property.furniture.slice();
    const idsBefore = new Set(original.map((object) => object.id));
    property.furniture = [];
    let moved = 0;
    let stored = 0;
    const sorted = original.slice().sort((a, b) => {
      const fixtureA = a.ownershipMode === 'property_fixture' ? 0 : 1;
      const fixtureB = b.ownershipMode === 'property_fixture' ? 0 : 1;
      return fixtureA - fixtureB || (b.footprint[0] * b.footprint[1]) - (a.footprint[0] * a.footprint[1]) || a.id.localeCompare(b.id);
    });

    sorted.forEach((object) => {
      const old = { x: object.position.x, y: object.position.y };
      const rule = (x, y, footprint) => objectFitsAt(property, object, x, y, footprint);
      const placed = World.addFurnitureToProperty(world, property, object, old, rule);
      if (placed) {
        if (object.position.x !== old.x || object.position.y !== old.y) {
          moved += 1;
          Core.appendObjectHistory(world, object, 'structural_reflow', `The object moved from ${old.x},${old.y} to ${object.position.x},${object.position.y} so it remained inside one reachable room.`, {
            actorId: object.ownerId,
            causes: [reason, 'object identity preserved']
          });
        }
        return;
      }

      if (object.ownershipMode === 'property_fixture') {
        // A normal project should never exhaust this much floor area. Fail
        // loudly so the caller can roll back instead of silently deleting or
        // transferring a building fixture.
        throw new Error(`No legal room position remained for property fixture ${object.id}.`);
      }
      const storage = storageFor(world, object.ownerId);
      if (!storage) throw new Error(`No lawful storage owner exists for ${object.id}.`);
      storage.push(object);
      stored += 1;
      Core.appendObjectHistory(world, object, 'structural_storage', 'The object entered its owner’s storage because no legal room position remained after construction.', {
        actorId: object.ownerId,
        causes: [reason, 'no-loss storage fallback']
      });
    });

    const idsAfter = new Set(property.furniture.map((object) => object.id));
    [world.player].concat(world.people || []).forEach((person) => (person.storedFurniture || []).forEach((object) => idsAfter.add(object.id)));
    const lost = Array.from(idsBefore).filter((id) => !idsAfter.has(id));
    if (lost.length) throw new Error(`Construction would lose object identities: ${lost.join(', ')}.`);
    world.metrics.habitatObjectsReflowed += moved;
    world.metrics.habitatObjectsStored += stored;
    return { moved, stored, objectIds: Array.from(idsBefore).sort() };
  }

  function initializeProperty(world, property, options = {}) {
    if (!isResidential(property)) return null;
    if (property.habitat?.schema === HABITAT_SCHEMA && Array.isArray(property.habitat.rooms)) {
      ensurePropertyState(world, property);
      return property.habitat;
    }

    const [w, h] = property.roomGrid;
    property.habitat = {
      schema: HABITAT_SCHEMA,
      revision: 1,
      nextRoomCounter: 0,
      entrance: { x: 0, y: h - 1, side: 'west', kind: 'exterior_door' },
      structuralCondition: Core.clamp(Core.safeNumber(property.condition, 80), 0, 100),
      partitions: buildTemplatePartitions(property),
      rooms: [],
      roomConnections: [],
      utilities: null,
      projects: [],
      layoutHash: null,
      migratedFromZones: false,
      history: []
    };
    computeRooms(property, { previousRooms: [] });
    assignInitialRoomMeaning(property);
    seedUtilities(property);
    const reflow = reflowObjects(world, property, options.reason || 'initial structural habitat generation');
    assignInitialRoomMeaning(property);
    seedUtilities(property);
    property.habitat.roomConnections = computeRoomConnections(property);
    property.habitat.layoutHash = layoutHash(property);
    property.habitat.history.push({
      id: Core.uniqueId(world, 'habitat_event'),
      day: world.time.day,
      hour: world.time.hour,
      type: options.migration ? 'migration' : 'foundation',
      message: `${property.name} received a deterministic wall, door, room, surface, and utility graph.`,
      evidence: { rooms: property.habitat.rooms.length, partitions: property.habitat.partitions.length, reflow }
    });
    if (options.migration) world.metrics.habitatMigrations += 1;
    return property.habitat;
  }

  function ensurePropertyState(world, property) {
    const habitat = property.habitat;
    if (!habitat) return initializeProperty(world, property, { migration: true });
    habitat.schema = HABITAT_SCHEMA;
    if (!Number.isInteger(habitat.revision) || habitat.revision < 1) habitat.revision = 1;
    if (!Number.isInteger(habitat.nextRoomCounter) || habitat.nextRoomCounter < 0) habitat.nextRoomCounter = 0;
    if (!Array.isArray(habitat.partitions)) habitat.partitions = [];
    if (!Array.isArray(habitat.rooms)) habitat.rooms = [];
    if (!Array.isArray(habitat.roomConnections)) habitat.roomConnections = [];
    if (!Array.isArray(habitat.projects)) habitat.projects = [];
    if (!Array.isArray(habitat.history)) habitat.history = [];
    if (!habitat.entrance) habitat.entrance = { x: 0, y: property.roomGrid[1] - 1, side: 'west', kind: 'exterior_door' };
    if (!habitat.utilities) seedUtilities(property);
    if (!habitat.rooms.length) computeRooms(property, { previousRooms: [] });
    habitat.rooms.forEach((room) => {
      if (!ROOM_PURPOSES.some((entry) => entry.id === room.purpose)) room.purpose = 'flexible';
      if (!['unassigned', 'inferred', 'player', 'agreement', 'resident', 'stewardship', 'migration'].includes(room.purposeSource)) room.purposeSource = 'inferred';
      if (!room.finish) room.finish = roomDefaultFinish(property, room.purpose);
      if (!room.utilityAccess) room.utilityAccess = { power: true, water: false, waste: false };
      if (!room.permissionSnapshot) room.permissionSnapshot = { kind: 'resident_shared', holderIds: property.tenants.slice(), source: 'property' };
      if (!Array.isArray(room.history)) room.history = [];
    });
    habitat.projects.forEach((project) => {
      project.schema = PROJECT_SCHEMA;
      if (!PROJECT_STATUSES.includes(project.status)) project.status = 'failed';
      if (!Array.isArray(project.history)) project.history = [];
      if (!Array.isArray(project.phases)) project.phases = [];
      if (!Array.isArray(project.completedPhaseIds)) project.completedPhaseIds = [];
      if (!project.creatorId) project.creatorId = 'player';
      if (!project.authority || typeof project.authority !== 'object') project.authority = { mode: 'migration', householdId: null, proposalId: null, evidence: null };
      if (!project.resourceMode) project.resourceMode = project.creatorId === 'player' ? 'player_inventory' : 'resident_escrow';
      if (!project.stewardshipIntentionId) project.stewardshipIntentionId = null;
      if (!project.stewardshipRequestId) project.stewardshipRequestId = null;
    });
    habitat.layoutHash = layoutHash(property);
    return habitat;
  }

  function ensureState(world) {
    if (!world.metrics || typeof world.metrics !== 'object') world.metrics = {};
    Object.entries(METRIC_DEFAULTS).forEach(([key, value]) => {
      if (!Number.isFinite(world.metrics[key])) world.metrics[key] = value;
    });
    if (!world.ui || typeof world.ui !== 'object') world.ui = {};
    if (world.ui.selectedRoomId === undefined) world.ui.selectedRoomId = null;
    if (world.ui.selectedHabitatProjectId === undefined) world.ui.selectedHabitatProjectId = null;
    if (world.ui.selectedHabitatEdgeKey === undefined) world.ui.selectedHabitatEdgeKey = null;
    (world.places || []).filter(isResidential).forEach((property) => initializeProperty(world, property, { migration: Boolean(world.schema !== 'axm.living-city-sim.world/v0.3.0') }));

    if (AXM.Households) {
      (world.households || []).filter((household) => household.status === 'active' && household.homePropertyId && AXM.Households.isCohabiting(world, household))
        .forEach((household) => syncHouseholdRoomPermissions(world, household, household.agreement?.space?.mode || 'private_edges_shared_center'));
    }
    const home = World.homeOf(world, 'player');
    if (home?.habitat?.rooms?.length && !roomById(home, world.ui.selectedRoomId)) world.ui.selectedRoomId = home.habitat.rooms[0].id;
    return world;
  }

  function initializeWorld(world, options = {}) {
    ensureState(world);
    if (!world.flags) world.flags = {};
    if (world.flags.structuralHabitatsAnnounced === undefined) world.flags.structuralHabitatsAnnounced = false;
    if (!options.silent && !world.flags.structuralHabitatsAnnounced) {
      Core.appendLedger(world, 'habitat', 'Residential interiors now have deterministic walls, doors, real rooms, surfaces, utilities, construction phases, and graph-based permissions.', {
        causes: ['structural habitat foundation v0.3.0', 'low-graphic deep simulation'],
        evidence: { residentialProperties: (world.places || []).filter(isResidential).length, schema: HABITAT_SCHEMA }
      });
      world.flags.structuralHabitatsAnnounced = true;
    }
    return world;
  }

  function reachableCells(property, options = {}) {
    const habitat = property.habitat;
    if (!habitat) return new Set();
    const start = options.start || habitat.entrance;
    const startKey = cellKey(start.x, start.y);
    const visited = new Set([startKey]);
    const queue = [{ x: start.x, y: start.y }];
    const map = partitionMap(property);
    while (queue.length) {
      const cell = queue.shift();
      neighbors(property, cell).forEach((neighbor) => {
        const key = cellKey(neighbor.x, neighbor.y);
        if (visited.has(key)) return;
        const partition = map.get(boundaryKeyBetween(cell, neighbor));
        if (partition?.kind === 'wall') return;
        if (partition?.kind === 'door' && partition.door?.open === false && options.closedDoorsBlock) return;
        visited.add(key);
        queue.push(neighbor);
      });
    }
    return visited;
  }

  function facilityReport(property) {
    const reachable = reachableCells(property);
    const rooms = property.habitat?.rooms || [];
    const bathroom = rooms.find((room) => room.purpose === 'bathroom');
    const kitchen = rooms.find((room) => room.purpose === 'kitchen');
    const sleepObjects = (property.furniture || []).filter((object) => Content.furnitureById(object.catalogId)?.category === 'sleep');
    return {
      reachableCellCount: reachable.size,
      totalCellCount: property.roomGrid[0] * property.roomGrid[1],
      allRoomsReachable: rooms.every((room) => room.cells.some((key) => reachable.has(key))),
      bathroom: bathroom ? { roomId: bathroom.id, reachable: bathroom.cells.some((key) => reachable.has(key)), utilities: Core.deepClone(bathroom.utilityAccess) } : null,
      kitchen: kitchen ? { roomId: kitchen.id, reachable: kitchen.cells.some((key) => reachable.has(key)), utilities: Core.deepClone(kitchen.utilityAccess) } : null,
      sleepObjectsReachable: sleepObjects.every((object) => reachable.has(cellKey(object.position.x, object.position.y))),
      sleepObjectCount: sleepObjects.length
    };
  }

  function roomSuggestions(property, roomId) {
    const room = roomById(property, roomId);
    if (!room) return [];
    const objects = (property.furniture || []).filter((object) => room.cells.includes(cellKey(object.position.x, object.position.y)));
    const categories = objects.map((object) => Content.furnitureById(object.catalogId)?.category);
    const score = new Map(ROOM_PURPOSES.map((entry) => [entry.id, 0]));
    const add = (id, amount, reason) => {
      const current = score.get(id) || 0;
      score.set(id, current + amount);
      return reason;
    };
    if (room.utilityAccess.water && room.utilityAccess.waste) {
      add('bathroom', 18, 'wet services');
      add('kitchen', 15, 'wet services');
    }
    if (room.utilityAccess.power) {
      add('work', 5, 'power access');
      add('hobby', 4, 'power access');
    }
    add('living', Math.min(20, room.area / 2), 'room area');
    add('storage', room.area < 12 ? 10 : 2, 'compact area');
    add('sleep', categories.filter((category) => category === 'sleep').length * 18, 'sleep objects');
    add('work', categories.filter((category) => ['work', 'activity'].includes(category)).length * 10, 'work/activity objects');
    add('kitchen', categories.filter((category) => category === 'food').length * 24, 'food equipment');
    add('living', categories.filter((category) => ['seat', 'surface', 'decor'].includes(category)).length * 4, 'social objects');
    add('workshop', categories.filter((category) => category === 'work').length * 7 + (room.utilityAccess.power ? 4 : 0), 'work surfaces');
    add('flexible', 8, 'no forced role');
    return Array.from(score.entries()).map(([id, value]) => ({
      id,
      name: roomPurpose(id).name,
      score: Core.round(value, 1),
      note: roomPurpose(id).note
    })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 4);
  }

  function zonesOverlapRoom(room, zone) {
    if (!zone?.rect) return 0;
    return room.cells.reduce((sum, key) => {
      const cell = parseCellKey(key);
      return sum + (cell.x >= zone.rect.x && cell.x < zone.rect.x + zone.rect.w && cell.y >= zone.rect.y && cell.y < zone.rect.y + zone.rect.h ? 1 : 0);
    }, 0);
  }

  function syncHouseholdRoomPermissions(world, household, mode = null) {
    if (!AXM.Households || !household?.homePropertyId) return [];
    const property = World.getProperty(world, household.homePropertyId);
    if (!property?.habitat || !AXM.Households.isCohabiting(world, household)) return [];
    const partnerId = AXM.Households.partnerIdFor(household);
    const partner = World.getPerson(world, partnerId);
    if (!household.agreement.space) household.agreement.space = { mode: mode || 'private_edges_shared_center', zones: [] };
    if (!Array.isArray(household.agreement.space.zones) || !household.agreement.space.zones.length) {
      // refreshSpaceZones will call back into this function after producing the
      // legacy rectangles. Avoid recursion by making a temporary local model.
      const [gridW, gridH] = property.roomGrid;
      const selectedMode = mode || household.agreement.space.mode || 'private_edges_shared_center';
      let privateWidth = selectedMode === 'mostly_shared' ? 1 : selectedMode === 'strong_private' ? Math.max(1, Math.floor(gridW * 0.34)) : Math.max(1, Math.floor(gridW * 0.23));
      privateWidth = Math.min(privateWidth, Math.max(1, Math.floor((gridW - 1) / 2)));
      const commonWidth = Math.max(1, gridW - privateWidth * 2);
      household.agreement.space.zones = [
        { id: `${household.id}_zone_player`, kind: 'player_private', label: 'Your private zone', holderIds: ['player'], rect: { x: 0, y: 0, w: privateWidth, h: gridH } },
        { id: `${household.id}_zone_common`, kind: 'common', label: 'Common zone', holderIds: ['player', partnerId], rect: { x: privateWidth, y: 0, w: commonWidth, h: gridH } },
        { id: `${household.id}_zone_partner`, kind: 'partner_private', label: `${partner?.name || 'Partner'}'s private zone`, holderIds: [partnerId], rect: { x: privateWidth + commonWidth, y: 0, w: privateWidth, h: gridH } }
      ];
    }
    const zones = household.agreement.space.zones;
    const permissions = property.habitat.rooms.map((room) => {
      if (room.purpose === 'bathroom' || room.purpose === 'entry') {
        return { roomId: room.id, kind: 'common', label: room.purpose === 'bathroom' ? 'Shared bathroom' : 'Shared entry', holderIds: ['player', partnerId], source: 'room_graph' };
      }
      const ranked = zones.map((zone) => ({ zone, overlap: zonesOverlapRoom(room, zone) })).sort((a, b) => b.overlap - a.overlap);
      const chosen = ranked[0]?.overlap > 0 ? ranked[0].zone : zones.find((zone) => zone.kind === 'common');
      return { roomId: room.id, kind: chosen.kind, label: chosen.kind === 'player_private' ? 'Your private room' : chosen.kind === 'partner_private' ? `${partner?.name || 'Partner'}'s private room` : 'Common room', holderIds: chosen.holderIds.slice(), source: 'room_graph' };
    });

    const nonService = permissions.filter((permission) => {
      const room = roomById(property, permission.roomId);
      return room && !['bathroom', 'entry'].includes(room.purpose);
    });
    if (nonService.length >= 2) {
      if (!nonService.some((permission) => permission.kind === 'player_private')) {
        const left = nonService.slice().sort((a, b) => roomById(property, a.roomId).centroid.x - roomById(property, b.roomId).centroid.x)[0];
        Object.assign(left, { kind: 'player_private', label: 'Your private room', holderIds: ['player'] });
      }
      if (!nonService.some((permission) => permission.kind === 'partner_private')) {
        const right = nonService.slice().sort((a, b) => roomById(property, b.roomId).centroid.x - roomById(property, a.roomId).centroid.x)[0];
        if (right.kind !== 'player_private' || nonService.length > 2) Object.assign(right, { kind: 'partner_private', label: `${partner?.name || 'Partner'}'s private room`, holderIds: [partnerId] });
      }
    }
    household.agreement.space.roomPermissions = permissions;
    household.agreement.space.roomGraphRevision = property.habitat.revision;
    permissions.forEach((permission) => {
      const room = roomById(property, permission.roomId);
      if (room) room.permissionSnapshot = Core.deepClone(permission);
    });
    property.habitat.migratedFromZones = true;
    return permissions;
  }

  function roomPermissionsForProperty(world, propertyId) {
    const household = AXM.Households?.playerHousehold(world);
    if (!household || household.homePropertyId !== propertyId || !AXM.Households.isCohabiting(world, household)) return [];
    const property = World.getProperty(world, propertyId);
    if (!property?.habitat) return [];
    const current = household.agreement.space.roomPermissions;
    if (!Array.isArray(current) || household.agreement.space.roomGraphRevision !== property.habitat.revision || current.some((entry) => !roomById(property, entry.roomId))) {
      return syncHouseholdRoomPermissions(world, household, household.agreement.space.mode);
    }
    return current;
  }

  function permissionAtCell(world, property, x, y) {
    const room = roomAtCell(property, x, y);
    if (!room) return null;
    return roomPermissionsForProperty(world, property.id).find((entry) => entry.roomId === room.id) || room.permissionSnapshot || null;
  }

  function placementPermission(world, property, actorId, object, x, y, footprint = object.footprint) {
    if (!objectFitsAt(property, object, x, y, footprint)) {
      return { ok: false, reason: 'The object must stay inside one room and any powered/wet fixture needs the matching room utilities.', roomIds: [] };
    }
    const familyPermission = AXM.Family?.placementPermission(world, property, actorId, object, x, y, footprint);
    if (familyPermission && !familyPermission.ok) return familyPermission;
    const permissions = roomPermissionsForProperty(world, property.id);
    if (!permissions.length) return { ok: true, roomIds: [roomAtCell(property, x, y)?.id].filter(Boolean) };
    const household = AXM.Households.playerHousehold(world);
    if (!household?.memberIds.includes(actorId)) return { ok: true, roomIds: [] };
    const partnerId = AXM.Households.partnerIdFor(household);
    const forbidden = actorId === 'player' ? 'partner_private' : actorId === partnerId ? 'player_private' : null;
    const roomIds = new Set();
    for (let dy = 0; dy < footprint[1]; dy += 1) {
      for (let dx = 0; dx < footprint[0]; dx += 1) {
        const room = roomAtCell(property, x + dx, y + dy);
        if (room) roomIds.add(room.id);
        const permission = permissionAtCell(world, property, x + dx, y + dy);
        if (permission?.kind === forbidden) {
          return { ok: false, reason: actorId === 'player' ? `${AXM.Households.partnerFor(world, household)?.name || 'Your partner'}'s private room requires their agreement.` : 'The placement would cross into the player-private room.', roomIds: Array.from(roomIds) };
        }
      }
    }
    return { ok: true, roomIds: Array.from(roomIds) };
  }

  function projectAuthority(world, property, spec, options = {}) {
    const currentHome = World.homeOf(world, 'player');
    if (!property || property.id !== currentHome?.id) return { mode: 'denied', reason: 'Property ownership does not grant remote control over a resident-authored home.' };
    const familyAuthority = AXM.Family?.projectAuthority(world, property, spec, options);
    if (familyAuthority?.mode === 'family_proposal') return familyAuthority;
    const household = AXM.Households?.playerHousehold(world);
    const cohabiting = household && household.homePropertyId === property.id && AXM.Households.isCohabiting(world, household);
    const approved = Boolean(options.approvedProposalId || options.approvedFamilyProposalId);
    const roomId = spec.target?.roomId;
    const permission = roomId ? roomPermissionsForProperty(world, property.id).find((entry) => entry.roomId === roomId) : null;

    if (spec.type === 'surface') {
      if (cohabiting && !approved && permission?.kind !== 'player_private') {
        return { mode: 'proposal', householdId: household.id, reason: 'A common or partner-private room needs an accepted household proposal.' };
      }
      return { mode: approved ? 'approved_proposal' : 'direct', householdId: household?.id || null };
    }

    if (property.ownerId !== 'player') {
      return { mode: 'denied', reason: 'Structural walls, doors, and utilities require property ownership; household consent cannot invent landlord authority.' };
    }
    if (cohabiting && !approved) return { mode: 'proposal', householdId: household.id, reason: 'Shared-home structure requires an accepted household proposal before construction starts.' };
    return { mode: approved ? 'approved_proposal' : 'direct', householdId: household?.id || null };
  }

  function clonePropertyForPreview(property) {
    const clone = Core.deepClone(property);
    clone.habitat.projects = [];
    return clone;
  }

  function applySpecToPreview(property, spec) {
    const target = spec.target || {};
    if (spec.type === 'partition') {
      setPartition(property, target.edgeKey, target.kind, { materialId: target.materialId || 'timber_frame', createdDay: 0 });
      computeRooms(property, { previousRooms: property.habitat.rooms });
    } else if (spec.type === 'surface') {
      const room = roomById(property, target.roomId);
      if (room) room.finish[target.surface === 'walls' ? 'wallFinishId' : 'floorFinishId'] = target.finishId;
    } else if (spec.type === 'utility') {
      const room = roomById(property, target.roomId);
      if (room) room.utilityAccess[target.utilityType] = true;
    } else if (spec.type === 'repair') {
      property.habitat.structuralCondition = 100;
    }
  }

  function validateProjectSpec(world, property, spec, options = {}) {
    if (!isResidential(property) || !property.habitat) return { ok: false, reason: 'Residential habitat not found.' };
    if (!spec || typeof spec !== 'object' || Array.isArray(spec) || !PROJECT_TYPES.includes(spec.type)) return { ok: false, reason: 'Unknown construction project type.' };
    const target = spec.target;
    if (!target || typeof target !== 'object' || Array.isArray(target)) return { ok: false, reason: 'Construction project needs a readable target.' };

    if (spec.type === 'partition') {
      if (!edgeCells(property, target.edgeKey)) return { ok: false, reason: 'Choose a valid internal room edge.' };
      if (!PARTITION_KINDS.includes(target.kind)) return { ok: false, reason: 'Partition must become a wall, door, or open connection.' };
      if (target.kind !== 'open' && !WALL_MATERIALS.some((entry) => entry.id === target.materialId)) return { ok: false, reason: 'Unknown wall material.' };
      const current = partitionAt(property, target.edgeKey)?.kind || 'open';
      if (current === target.kind) return { ok: false, reason: `That edge is already ${target.kind}.` };
      const preview = clonePropertyForPreview(property);
      applySpecToPreview(preview, spec);
      const reach = facilityReport(preview);
      if (!reach.allRoomsReachable) return { ok: false, reason: 'That edit would create an inaccessible room. Use a door edge or open a second connection.' };
      const crossing = (preview.furniture || []).find((object) => !footprintRespectsPartitions(preview, object.position.x, object.position.y, object.footprint));
      // Crossing furniture is legal to plan because completion has a no-loss
      // deterministic reflow. Keep this as evidence rather than rejecting it.
      return { ok: true, preview: { rooms: preview.habitat.rooms.length, layoutHash: preview.habitat.layoutHash, reflowNeeded: Boolean(crossing) } };
    }

    if (spec.type === 'surface') {
      const room = roomById(property, target.roomId);
      if (!room) return { ok: false, reason: 'Choose an existing room.' };
      if (!['floor', 'walls'].includes(target.surface)) return { ok: false, reason: 'Surface must be floor or walls.' };
      if (!FINISHES.some((entry) => entry.id === target.finishId)) return { ok: false, reason: 'Unknown finish.' };
      const key = target.surface === 'walls' ? 'wallFinishId' : 'floorFinishId';
      if (room.finish[key] === target.finishId) return { ok: false, reason: 'That room already has this finish.' };
    }

    if (spec.type === 'utility') {
      const room = roomById(property, target.roomId);
      if (!room) return { ok: false, reason: 'Choose an existing room.' };
      if (!UTILITY_TYPES.includes(target.utilityType)) return { ok: false, reason: 'Unknown utility type.' };
      if (room.utilityAccess[target.utilityType]) return { ok: false, reason: `${Core.titleCase(target.utilityType)} already reaches this room.` };
      if (target.utilityType === 'waste' && !room.utilityAccess.water && !options.forProposal) {
        // Waste without water is not impossible, but the UI should make the
        // dependency visible. It remains technically buildable through an
        // accepted proposal or a second explicit project.
        return { ok: false, reason: 'Add water access before a normal waste-line project.' };
      }
    }

    if (spec.type === 'repair' && property.habitat.structuralCondition >= 99) return { ok: false, reason: 'The structure is already fully repaired.' };
    return { ok: true };
  }

  function phase(id, name, hours, money, materials, note) {
    return { id, name, hours, money, materials, note };
  }

  function projectPhases(property, spec) {
    const target = spec.target || {};
    if (spec.type === 'partition') {
      if (target.kind === 'open') return [
        phase('survey', 'Trace structure and services', 1, 0, {}, 'Confirm that the edge is safe to open.'),
        phase('protect', 'Protect objects and history', 1, 5, {}, 'Stage nearby objects without deleting them.'),
        phase('open', 'Open the connection', 2, 18, { parts: 1 }, 'Remove the partition with recoverable work.'),
        phase('finish', 'Finish both room edges', 1, 8, { paint: 1 }, 'Repair the visible surfaces.'),
        phase('inspect', 'Validate paths and ownership', 1, 0, {}, 'Run reachability and no-loss checks.')
      ];
      const material = materialById(target.materialId);
      const baseMaterial = target.kind === 'door' ? { wood: 1, metal: 1, parts: 1 } : { [material.material]: 2, paint: 1 };
      return [
        phase('survey', 'Trace structure and services', 1, 0, {}, 'Record the existing layout revision.'),
        phase('protect', 'Protect objects and prepare floor', 1, 7, {}, 'Move loose items out of the work edge.'),
        phase('rough', target.kind === 'door' ? 'Frame the doorway' : 'Build the wall frame', 2, Math.round(28 * material.costFactor), baseMaterial, 'Create the real partition without replacing objects.'),
        phase('surface', 'Close and finish the partition', 1, 12, { paint: 1 }, 'Give both sides a usable finish.'),
        phase('inspect', 'Validate rooms and paths', 1, 0, {}, 'Recompute room identity and reachability.')
      ];
    }
    if (spec.type === 'surface') {
      const room = roomById(property, target.roomId);
      const finish = finishById(target.finishId);
      const area = Math.max(1, room?.area || 1);
      const units = Math.max(1, Math.ceil(area / (target.surface === 'floor' ? 12 : 18)));
      return [
        phase('measure', 'Measure and preserve room state', 1, 0, {}, 'Record objects, permissions, and surface history.'),
        phase('prepare', 'Prepare the existing surface', 1, Math.round(4 * units), { paint: Math.max(1, Math.ceil(units / 2)) }, 'Repair rather than erase the surface.'),
        phase('apply', `Apply ${finish.name}`, 2, Math.round(13 * units * finish.costFactor), target.finishId === 'reclaimed_wood' ? { wood: units } : { paint: units }, 'Appearance changes without forcing a stat-optimal room.'),
        phase('cure', 'Let the finish settle', 1, 0, {}, 'Complete a visible construction phase.')
      ];
    }
    if (spec.type === 'utility') {
      return [
        phase('survey', 'Map the service route', 1, 0, {}, 'Check the room graph before cutting anything.'),
        phase('route', `Route ${target.utilityType}`, 2, 24, { parts: 1, metal: 1 }, 'Add a bounded service path.'),
        phase('connect', `Connect room ${target.utilityType}`, 2, 32, { parts: 2 }, 'Make the room utility-capable.'),
        phase('test', 'Test capacity and safety', 1, 0, {}, 'Validate that the service is explicit and reachable.')
      ];
    }
    return [
      phase('inspect', 'Inspect structural condition', 1, 0, {}, 'Find the causes rather than buying a replacement building.'),
      phase('stabilize', 'Stabilize weak structure', 2, 35, { wood: 2, metal: 1 }, 'Repair the underlying frame.'),
      phase('seal', 'Seal and finish repaired areas', 1, 15, { paint: 1, parts: 1 }, 'Restore condition while preserving the home identity.'),
      phase('verify', 'Verify the whole habitat', 1, 0, {}, 'Run structural and reachability validation.')
    ];
  }

  function projectSummary(property, spec) {
    const target = spec.target || {};
    if (spec.type === 'partition') return `${Core.titleCase(target.kind)} at ${target.edgeKey}`;
    if (spec.type === 'surface') return `${finishById(target.finishId).name} on ${roomById(property, target.roomId)?.name || 'room'} ${target.surface}`;
    if (spec.type === 'utility') return `${Core.titleCase(target.utilityType)} access for ${roomById(property, target.roomId)?.name || 'room'}`;
    return 'Structural repair';
  }

  function createProject(world, property, spec, authority = {}) {
    const validation = validateProjectSpec(world, property, spec, { forProposal: Boolean(authority.proposalId || authority.requestId) });
    if (!validation.ok) return validation;
    const actorId = authority.actorId || 'player';
    const targetKey = spec.type === 'partition' ? spec.target.edgeKey : spec.type === 'repair' ? 'structure' : `${spec.target.roomId}:${spec.type}:${spec.target.surface || spec.target.utilityType || ''}`;
    const conflicting = property.habitat.projects.find((project) => ['planned', 'active'].includes(project.status) && project.targetKey === targetKey);
    if (conflicting) return { ok: false, reason: 'A construction project already controls that target.' };
    const project = {
      id: Core.uniqueId(world, 'construction'),
      schema: PROJECT_SCHEMA,
      propertyId: property.id,
      creatorId: actorId,
      createdDay: world.time.day,
      createdHour: world.time.hour,
      status: 'planned',
      spec: Core.deepClone(spec),
      summary: projectSummary(property, spec),
      targetKey,
      authority: {
        mode: authority.mode || 'direct',
        householdId: authority.householdId || null,
        proposalId: authority.proposalId || null,
        requestId: authority.requestId || null,
        evidence: authority.evidence || null
      },
      resourceMode: authority.resourceMode || (actorId === 'player' ? 'player_inventory' : 'resident_escrow'),
      stewardshipIntentionId: authority.intentionId || null,
      stewardshipRequestId: authority.requestId || null,
      layoutRevisionAtPlan: property.habitat.revision,
      phaseIndex: 0,
      phases: projectPhases(property, spec),
      completedPhaseIds: [],
      spent: { money: 0, materials: {} },
      completedDay: null,
      failureReason: null,
      history: []
    };
    project.history.push({ day: world.time.day, hour: world.time.hour, type: 'planned', message: `${project.summary} entered the construction queue.`, evidence: { authority: Core.deepClone(project.authority), layoutRevision: project.layoutRevisionAtPlan, creatorId: actorId, resourceMode: project.resourceMode } });
    property.habitat.projects.push(project);
    world.metrics.habitatProjectsPlanned += 1;
    const actorName = World.personName(world, actorId);
    Core.appendPropertyHistory(world, property, 'construction_planned', `${project.summary} was planned by ${actorName} as phased work rather than an instant build-menu mutation.`, {
      actorIds: [actorId], causes: [actorId === 'player' ? 'explicit construction plan' : 'authorized resident habitat intention', authority.proposalId || authority.requestId ? 'accepted permission record' : 'direct authority']
    });
    Core.appendLedger(world, 'habitat', `${project.summary} was added to ${property.name}'s construction queue for ${actorName}.`, {
      actorIds: [actorId], placeId: property.id, causes: ['phased construction', 'no silent structure rewrite'], evidence: { projectId: project.id, phases: project.phases.map((entry) => entry.id), authority: project.authority, resourceMode: project.resourceMode }
    });
    if (actorId === 'player') {
      Systems.toast(world, authority.proposalId ? 'The accepted renovation became a real construction project.' : 'Construction project planned.', 'success');
      world.ui.selectedHabitatProjectId = project.id;
    }
    return { ok: true, project };
  }

  function requestHabitatProject(world, propertyId, spec) {
    ensureState(world);
    const property = World.getProperty(world, propertyId);
    const validation = validateProjectSpec(world, property, spec);
    if (!validation.ok) return validation;
    const authority = projectAuthority(world, property, spec);
    if (authority.mode === 'denied') return { ok: false, reason: authority.reason };
    if (authority.mode === 'family_proposal') {
      const unit = AXM.Family?.familyUnitById(world, authority.familyUnitId);
      const affected = (unit?.roomAssignments || []).find((entry) => entry.roomId === spec.target?.roomId)
        || (unit?.roomAssignments || []).find((entry) => entry.kind === 'dependent_private');
      if (!unit || !affected) return { ok: false, reason: 'The affected family room could not be identified.' };
      const result = Systems.proposeFamilyChange(world, unit.id, 'room_plan', {
        personId: affected.personId,
        roomId: affected.roomId,
        kind: affected.kind,
        projectSpec: Core.deepClone(spec),
        propertyId: property.id,
        summary: projectSummary(property, spec)
      });
      if (result.ok) result.requiresFamilyProposal = true;
      return result;
    }
    if (authority.mode === 'proposal') {
      const household = AXM.Households?.householdById(world, authority.householdId);
      if (!household) return { ok: false, reason: 'Shared-home agreement not found.' };
      const result = Systems.proposeHouseholdChange(world, household.id, 'renovation', {
        kind: 'structural_project',
        projectSpec: Core.deepClone(spec),
        propertyId: property.id,
        summary: projectSummary(property, spec)
      });
      if (result.ok) result.requiresProposal = true;
      return result;
    }
    return createProject(world, property, spec, authority);
  }

  function createAuthorizedProject(world, household, proposal) {
    const property = World.getProperty(world, proposal.terms.propertyId || household.homePropertyId);
    if (!property || property.id !== household.homePropertyId) return { ok: false, reason: 'The accepted project no longer targets the shared home.' };
    const authority = projectAuthority(world, property, proposal.terms.projectSpec, { approvedProposalId: proposal.id });
    if (authority.mode === 'denied') return { ok: false, reason: authority.reason };
    return createProject(world, property, proposal.terms.projectSpec, {
      mode: 'approved_proposal', householdId: household.id, proposalId: proposal.id,
      evidence: { acceptedBy: household.memberIds.slice(), acceptedDay: world.time.day }
    });
  }

  function createFamilyAuthorizedProject(world, unit, proposal) {
    const property = World.getProperty(world, proposal.terms.propertyId || unit.homePropertyId);
    if (!property || property.id !== unit.homePropertyId) return { ok: false, reason: 'The accepted family project no longer targets the family home.' };
    const authority = projectAuthority(world, property, proposal.terms.projectSpec, { approvedFamilyProposalId: proposal.id });
    if (authority.mode === 'denied' || authority.mode === 'family_proposal' || authority.mode === 'proposal') return { ok: false, reason: authority.reason || 'The accepted family authority is no longer sufficient.' };
    return createProject(world, property, proposal.terms.projectSpec, {
      mode: 'approved_family_proposal', householdId: unit.linkedHouseholdId || null, proposalId: proposal.id,
      evidence: { familyUnitId: unit.id, acceptedDay: world.time.day, affectedPersonId: proposal.terms.personId }
    });
  }

  function projectBudget(property, spec) {
    const phases = projectPhases(property, spec);
    const materials = {};
    let phaseMoney = 0;
    let hours = 0;
    phases.forEach((entry) => {
      phaseMoney += Core.safeNumber(entry.money, 0);
      hours += Core.safeNumber(entry.hours, 0);
      Object.entries(entry.materials || {}).forEach(([key, amount]) => { materials[key] = (materials[key] || 0) + amount; });
    });
    const materialMoney = Object.entries(materials).reduce((sum, [key, amount]) => sum + (Content.MATERIALS[key]?.unitPrice || 0) * amount, 0);
    return {
      phases: Core.deepClone(phases),
      phaseMoney: Core.round(phaseMoney, 2),
      materialMoney: Core.round(materialMoney, 2),
      totalMoney: Core.round(phaseMoney + materialMoney, 2),
      materials,
      hours
    };
  }

  function createStewardshipProject(world, propertyId, spec, options = {}) {
    ensureState(world);
    const property = World.getProperty(world, propertyId);
    const actorId = options.actorId;
    const actor = World.getPerson(world, actorId);
    if (!property || !actor || actorId === 'player') return { ok: false, reason: 'A valid autonomous resident and property are required.' };
    if (!property.tenants.includes(actorId) || actor.homePropertyId !== property.id) return { ok: false, reason: 'The resident no longer lives at the target property.' };
    if (!options.requestId || !options.intentionId) return { ok: false, reason: 'Resident construction requires linked intention and permission evidence.' };
    return createProject(world, property, spec, {
      mode: 'resident_stewardship',
      actorId,
      requestId: options.requestId,
      intentionId: options.intentionId,
      resourceMode: 'resident_escrow',
      evidence: Core.deepClone(options.evidence || {})
    });
  }

  function findProject(world, projectId) {
    for (const property of (world.places || []).filter(isResidential)) {
      const project = property.habitat?.projects?.find((entry) => entry.id === projectId);
      if (project) return { property, project };
    }
    return null;
  }

  function snapshotStorages(world) {
    return {
      player: Core.deepClone(world.player.storedFurniture || []),
      people: Object.fromEntries((world.people || []).map((person) => [person.id, Core.deepClone(person.storedFurniture || [])]))
    };
  }

  function restoreStorages(world, snapshot) {
    world.player.storedFurniture = snapshot.player;
    (world.people || []).forEach((person) => { person.storedFurniture = snapshot.people[person.id] || []; });
  }

  function applyCompletedProject(world, property, projectId) {
    const project = property.habitat.projects.find((entry) => entry.id === projectId);
    if (!project) return { ok: false, reason: 'Construction project disappeared.' };
    const backupHabitat = Core.deepClone(property.habitat);
    const backupFurniture = Core.deepClone(property.furniture);
    const backupStorages = snapshotStorages(world);
    const beforeObjectIds = new Set(property.furniture.map((object) => object.id));
    const previousRooms = Core.deepClone(property.habitat.rooms);
    let reflow = { moved: 0, stored: 0 };
    try {
      if (project.spec.type === 'partition') {
        const target = project.spec.target;
        setPartition(property, target.edgeKey, target.kind, { materialId: target.materialId, createdDay: world.time.day, condition: 100 });
        property.habitat.revision += 1;
        computeRooms(property, { previousRooms });
        assignInitialRoomMeaning(property);
        // Preserve existing utility access by overlap; new wet-room meaning can
        // add access, but never silently remove a service from a surviving room.
        property.habitat.rooms.forEach((room) => {
          if (['bathroom', 'kitchen'].includes(room.purpose)) {
            room.utilityAccess.power = true;
            room.utilityAccess.water = true;
            room.utilityAccess.waste = true;
          }
        });
        reflow = reflowObjects(world, property, `completed project ${project.id}`);
        world.metrics.structuralChanges += 1;
      } else if (project.spec.type === 'surface') {
        const room = roomById(property, project.spec.target.roomId);
        if (!room) throw new Error('The target room no longer exists.');
        const key = project.spec.target.surface === 'walls' ? 'wallFinishId' : 'floorFinishId';
        const oldFinish = room.finish[key];
        room.finish[key] = project.spec.target.finishId;
        room.finish.condition = Core.clamp(room.finish.condition + 8, 0, 100);
        room.history.push({ day: world.time.day, hour: world.time.hour, type: 'surface', message: `${project.spec.target.surface} changed from ${finishById(oldFinish).name} to ${finishById(project.spec.target.finishId).name}.`, projectId });
        world.metrics.surfaceProjects += 1;
      } else if (project.spec.type === 'utility') {
        const room = roomById(property, project.spec.target.roomId);
        if (!room) throw new Error('The target room no longer exists.');
        room.utilityAccess[project.spec.target.utilityType] = true;
        room.history.push({ day: world.time.day, hour: world.time.hour, type: 'utility', message: `${Core.titleCase(project.spec.target.utilityType)} access was added.`, projectId });
        world.metrics.utilityProjects += 1;
      } else {
        property.habitat.structuralCondition = 100;
        property.condition = Core.clamp(Math.max(property.condition, 94), 0, 100);
        world.metrics.habitatRepairs += 1;
      }

      property.habitat.layoutHash = layoutHash(property);
      property.habitat.roomConnections = computeRoomConnections(property);
      const household = AXM.Households?.playerHousehold(world);
      if (household && household.homePropertyId === property.id && AXM.Households.isCohabiting(world, household)) {
        syncHouseholdRoomPermissions(world, household, household.agreement.space.mode);
        AXM.Households.rebalanceHouseholdObjects(world, household, 'completed structural habitat project');
      }
      const validation = validateProperty(world, property);
      if (!validation.ok) throw new Error(validation.errors.join(' | '));
      const afterIds = new Set(property.furniture.map((object) => object.id));
      [world.player].concat(world.people || []).forEach((person) => (person.storedFurniture || []).forEach((object) => afterIds.add(object.id)));
      const lost = Array.from(beforeObjectIds).filter((id) => !afterIds.has(id));
      if (lost.length) throw new Error(`Object identity loss detected: ${lost.join(', ')}.`);
    } catch (error) {
      property.habitat = backupHabitat;
      property.furniture = backupFurniture;
      restoreStorages(world, backupStorages);
      const restored = property.habitat.projects.find((entry) => entry.id === projectId);
      restored.status = 'failed';
      restored.failureReason = error.message;
      restored.history.push({ day: world.time.day, hour: world.time.hour, type: 'failed', message: error.message, evidence: { rollback: true } });
      world.metrics.habitatProjectsFailed += 1;
      return { ok: false, reason: `Construction rolled back safely: ${error.message}`, project: restored };
    }

    const completed = property.habitat.projects.find((entry) => entry.id === projectId);
    completed.status = 'completed';
    completed.completedDay = world.time.day;
    completed.history.push({ day: world.time.day, hour: world.time.hour, type: 'completed', message: `${completed.summary} completed with room, path, permission, and no-loss validation.`, evidence: { reflow, layoutRevision: property.habitat.revision, layoutHash: property.habitat.layoutHash } });
    property.habitat.history.push({ id: Core.uniqueId(world, 'habitat_event'), day: world.time.day, hour: world.time.hour, type: 'construction_completed', message: completed.summary, projectId, evidence: { reflow } });
    world.metrics.habitatProjectsCompleted += 1;
    const actorId = completed.creatorId || 'player';
    const actorName = World.personName(world, actorId);
    Core.appendPropertyHistory(world, property, 'construction_completed', `${completed.summary} completed by ${actorName} after ${completed.phases.length} recorded phases.`, {
      actorIds: [actorId], causes: ['phased construction', 'reachability validation', 'object identity preserved']
    });
    Core.appendLedger(world, 'habitat', `${completed.summary} completed at ${property.name} through ${actorName}'s recorded work.`, {
      actorIds: [actorId], placeId: property.id, causes: ['validated construction completion'], evidence: { projectId, reflow, habitatRevision: property.habitat.revision, layoutHash: property.habitat.layoutHash, stewardshipIntentionId: completed.stewardshipIntentionId }
    });
    if (actorId === 'player') Systems.toast(world, 'Construction completed and validated.', 'success');
    return { ok: true, project: completed, reflow };
  }

  function workHabitatProject(world, projectId) {
    ensureState(world);
    if (world.activeShift) return { ok: false, reason: 'Finish the active workday before doing construction.' };
    const located = findProject(world, projectId);
    if (!located) return { ok: false, reason: 'Construction project not found.' };
    const { property, project } = located;
    if (!['planned', 'active'].includes(project.status)) return { ok: false, reason: `This project is ${project.status}.` };
    if (World.homeOf(world, 'player')?.id !== property.id) return { ok: false, reason: 'You must be at your current home to work on this project.' };
    if (['partition'].includes(project.spec.type) && project.layoutRevisionAtPlan !== property.habitat.revision) {
      project.status = 'failed';
      project.failureReason = 'The room graph changed after planning.';
      project.history.push({ day: world.time.day, hour: world.time.hour, type: 'failed', message: project.failureReason, evidence: { plannedRevision: project.layoutRevisionAtPlan, currentRevision: property.habitat.revision } });
      world.metrics.habitatProjectsFailed += 1;
      return { ok: false, reason: 'The room graph changed after planning; the stale project was stopped instead of guessing.' };
    }
    const current = project.phases[project.phaseIndex];
    if (!current) return applyCompletedProject(world, property, project.id);
    if (world.player.money < current.money) return { ok: false, reason: `${current.name} needs ${Core.formatMoney(current.money)}.` };
    const missing = Core.availableMaterialCheck(world.player.materials, current.materials);
    if (Core.hasMissingMaterials(missing)) return { ok: false, reason: `Missing materials: ${Object.entries(missing).map(([key, amount]) => `${key} ${amount}`).join(', ')}.` };

    world.player.money -= current.money;
    world.player.lifetimeSpend += current.money;
    Core.consumeMaterials(world.player.materials, current.materials);
    project.spent.money = Core.round(project.spent.money + current.money, 2);
    Object.entries(current.materials).forEach(([key, amount]) => { project.spent.materials[key] = (project.spent.materials[key] || 0) + amount; });
    project.status = 'active';
    project.completedPhaseIds.push(current.id);
    project.phaseIndex += 1;
    project.history.push({ day: world.time.day, hour: world.time.hour, type: 'phase_completed', message: `${current.name} completed.`, evidence: { money: current.money, materials: current.materials, hours: current.hours } });
    Systems.applyNeedEffects(world.player, { energy: -4 - current.hours * 2, hygiene: -2 - current.hours, mood: current.id === 'inspect' || current.id === 'verify' ? 2 : 0 });
    Systems.applySkillEffects(world.player, { repair: 0.35 * current.hours, creativity: project.spec.type === 'surface' ? 0.2 * current.hours : 0.05 * current.hours });
    Systems.advanceHours(world, current.hours);
    if (project.phaseIndex >= project.phases.length) return applyCompletedProject(world, property, project.id);
    Systems.toast(world, `${current.name} complete. Next: ${project.phases[project.phaseIndex].name}.`, 'info');
    return { ok: true, project, phase: current };
  }

  function workStewardshipProject(world, projectId, actorId, reserve) {
    ensureState(world);
    const located = findProject(world, projectId);
    if (!located) return { ok: false, reason: 'Construction project not found.' };
    const { property, project } = located;
    if (project.creatorId !== actorId || project.resourceMode !== 'resident_escrow') return { ok: false, reason: 'The resident is not authorized to work this project.' };
    const actor = World.getPerson(world, actorId);
    if (!actor || actorId === 'player' || actor.homePropertyId !== property.id || !property.tenants.includes(actorId)) return { ok: false, reason: 'The resident no longer occupies this home.' };
    if (!reserve || typeof reserve !== 'object' || !Number.isFinite(reserve.money) || !reserve.materials) return { ok: false, reason: 'Resident project escrow is malformed.' };
    if (!['planned', 'active'].includes(project.status)) return { ok: false, reason: `This project is ${project.status}.` };
    if (project.spec.type === 'partition' && project.layoutRevisionAtPlan !== property.habitat.revision) {
      project.status = 'failed';
      project.failureReason = 'The room graph changed after planning.';
      project.history.push({ day: world.time.day, hour: world.time.hour, type: 'failed', message: project.failureReason, evidence: { plannedRevision: project.layoutRevisionAtPlan, currentRevision: property.habitat.revision, actorId } });
      world.metrics.habitatProjectsFailed += 1;
      return { ok: false, reason: project.failureReason, project };
    }
    const current = project.phases[project.phaseIndex];
    if (!current) return applyCompletedProject(world, property, project.id);
    if (reserve.money + 1e-9 < current.money) return { ok: false, reason: `${current.name} needs ${Core.formatMoney(current.money)} in escrow.` };
    const missing = Core.availableMaterialCheck(reserve.materials, current.materials);
    if (Core.hasMissingMaterials(missing)) return { ok: false, reason: `Escrow lacks materials: ${Object.entries(missing).map(([key, amount]) => `${key} ${amount}`).join(', ')}.` };

    reserve.money = Core.round(reserve.money - current.money, 2);
    Core.consumeMaterials(reserve.materials, current.materials);
    project.spent.money = Core.round(project.spent.money + current.money, 2);
    Object.entries(current.materials).forEach(([key, amount]) => { project.spent.materials[key] = (project.spent.materials[key] || 0) + amount; });
    project.status = 'active';
    project.completedPhaseIds.push(current.id);
    project.phaseIndex += 1;
    project.history.push({ day: world.time.day, hour: world.time.hour, type: 'phase_completed', message: `${current.name} completed by ${actor.name}.`, evidence: { actorId, money: current.money, materials: current.materials, hours: current.hours, escrowMoneyRemaining: reserve.money } });
    actor.needs.energy = Core.clamp(actor.needs.energy - 1.5 - current.hours * 0.6, 0, 100);
    actor.needs.hygiene = Core.clamp(actor.needs.hygiene - 0.7 - current.hours * 0.25, 0, 100);
    actor.skills.repair = Core.clamp(actor.skills.repair + 0.18 * current.hours, 0, 100);
    if (project.spec.type === 'surface') actor.skills.creativity = Core.clamp(actor.skills.creativity + 0.16 * current.hours, 0, 100);
    if (project.phaseIndex >= project.phases.length) return applyCompletedProject(world, property, project.id);
    return { ok: true, project, phase: current };
  }

  function cancelHabitatProject(world, projectId) {
    const located = findProject(world, projectId);
    if (!located) return { ok: false, reason: 'Construction project not found.' };
    const { property, project } = located;
    if (!['planned', 'active'].includes(project.status)) return { ok: false, reason: `A ${project.status} project cannot be cancelled.` };
    project.status = 'cancelled';
    project.history.push({ day: world.time.day, hour: world.time.hour, type: 'cancelled', message: 'The remaining work was cancelled explicitly. Already used time and materials were not fabricated back into inventory.', evidence: { completedPhaseIds: project.completedPhaseIds.slice(), spent: Core.deepClone(project.spent) } });
    world.metrics.habitatProjectsCancelled += 1;
    Core.appendPropertyHistory(world, property, 'construction_cancelled', `${project.summary} was cancelled after ${project.completedPhaseIds.length} phases.`, {
      actorIds: ['player'], causes: ['explicit cancellation', 'no fake resource rollback']
    });
    Systems.toast(world, 'Construction project cancelled.', 'warning');
    return { ok: true, project };
  }

  function setRoomPurpose(world, propertyId, roomId, purposeId) {
    ensureState(world);
    const property = World.getProperty(world, propertyId);
    const room = roomById(property, roomId);
    if (!room) return { ok: false, reason: 'Room not found.' };
    if (!ROOM_PURPOSES.some((entry) => entry.id === purposeId)) return { ok: false, reason: 'Unknown room purpose.' };
    if (World.homeOf(world, 'player')?.id !== property.id) return { ok: false, reason: 'Observation does not grant remote room authorship.' };
    const permission = roomPermissionsForProperty(world, property.id).find((entry) => entry.roomId === roomId);
    if (permission && permission.kind === 'partner_private') return { ok: false, reason: 'Your partner keeps authorship of their private room.' };
    if (room.purpose === 'bathroom' && purposeId !== 'bathroom'
      && !property.habitat.rooms.some((entry) => entry.id !== room.id && entry.purpose === 'bathroom')) {
      return { ok: false, reason: 'This is the habitat’s only bathroom. Establish another reachable wet bathroom before changing its purpose.' };
    }
    if (purposeId === 'bathroom' && (!room.utilityAccess.water || !room.utilityAccess.waste)) {
      return { ok: false, reason: 'A bathroom purpose requires explicit water and waste access in this room first.' };
    }
    const previous = { purpose: room.purpose, name: room.name, purposeSource: room.purposeSource };
    room.purpose = purposeId;
    room.name = roomPurpose(purposeId).name;
    room.purposeSource = 'player';
    const validation = validateProperty(world, property);
    if (!validation.ok) {
      Object.assign(room, previous);
      return { ok: false, reason: `Purpose change rejected without rewriting the habitat: ${validation.errors.join(' | ')}` };
    }
    room.history.push({ day: world.time.day, hour: world.time.hour, type: 'purpose', message: `Room purpose changed from ${roomPurpose(previous.purpose).name} to ${roomPurpose(purposeId).name}.`, actorId: 'player', evidence: { source: 'explicit_player_choice' } });
    world.metrics.roomPurposeChanges += 1;
    Core.appendPropertyHistory(world, property, 'room_purpose', `${room.name} was chosen as a descriptive purpose, not a forced optimal layout.`, {
      actorIds: ['player'], causes: ['explicit player choice', 'suggestions remain non-binding', 'purpose provenance preserved']
    });
    Systems.toast(world, `${room.name} is now the chosen room purpose.`, 'success');
    return { ok: true, room };
  }

  function listEdges(property) {
    if (!isResidential(property)) return [];
    const [w, h] = property.roomGrid;
    const result = [];
    for (let y = 0; y < h; y += 1) {
      for (let x = 1; x < w; x += 1) {
        const key = edgeKey('V', x, y);
        const rooms = edgeCells(property, key).map((cell) => roomAtCell(property, cell.x, cell.y));
        const current = partitionAt(property, key)?.kind || 'open';
        result.push({ key, orientation: 'vertical', x, y, current, roomIds: rooms.map((room) => room?.id || null), label: `V ${x},${y} · ${current} · ${rooms.map((room) => room?.name || '?').join(' / ')}` });
      }
    }
    for (let y = 1; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const key = edgeKey('H', x, y);
        const rooms = edgeCells(property, key).map((cell) => roomAtCell(property, cell.x, cell.y));
        const current = partitionAt(property, key)?.kind || 'open';
        result.push({ key, orientation: 'horizontal', x, y, current, roomIds: rooms.map((room) => room?.id || null), label: `H ${x},${y} · ${current} · ${rooms.map((room) => room?.name || '?').join(' / ')}` });
      }
    }
    return result.sort((a, b) => a.current.localeCompare(b.current) || a.key.localeCompare(b.key));
  }

  function recommendedEdits(property) {
    const edges = listEdges(property);
    const doorToOpen = edges.filter((entry) => entry.current === 'door').slice(0, 3).map((entry) => ({ ...entry, suggestion: 'Open two rooms into one larger room' }));
    const wallToDoor = edges.filter((entry) => entry.current === 'wall').slice(0, 3).map((entry) => ({ ...entry, suggestion: 'Create a reachable doorway' }));
    const openBetweenSameRoom = edges.filter((entry) => entry.current === 'open' && entry.roomIds[0] === entry.roomIds[1]).filter((entry, index) => index % Math.max(1, Math.floor(edges.length / 5)) === 0).slice(0, 3).map((entry) => ({ ...entry, suggestion: 'Split a large room with a door' }));
    return wallToDoor.concat(openBetweenSameRoom, doorToOpen).slice(0, 6);
  }

  function validateProperty(world, property) {
    const errors = [];
    const add = (message) => { if (errors.length < 120) errors.push(message); };
    if (!isResidential(property)) return { ok: false, errors: ['Not a residential property.'] };
    const habitat = property.habitat;
    if (!habitat || habitat.schema !== HABITAT_SCHEMA) return { ok: false, errors: [`${property.id} has no v0.4 structural habitat.`] };
    if (!Number.isInteger(habitat.revision) || habitat.revision < 1) add(`${property.id} has invalid habitat revision.`);
    if (!Array.isArray(habitat.partitions)) add(`${property.id} partitions must be an array.`);
    if (!Array.isArray(habitat.rooms) || !habitat.rooms.length) add(`${property.id} needs at least one room.`);
    const partitionKeys = new Set();
    (habitat.partitions || []).forEach((partition) => {
      if (!edgeCells(property, partition.key)) add(`${property.id} has invalid partition edge ${String(partition.key)}.`);
      if (partitionKeys.has(partition.key)) add(`${property.id} duplicates partition ${partition.key}.`);
      partitionKeys.add(partition.key);
      if (!['wall', 'door'].includes(partition.kind)) add(`${partition.key} has invalid stored kind ${String(partition.kind)}.`);
      if (!WALL_MATERIALS.some((entry) => entry.id === partition.materialId)) add(`${partition.key} has unknown material.`);
      if (!Number.isFinite(partition.condition) || partition.condition < 0 || partition.condition > 100) add(`${partition.key} has invalid condition.`);
      if (partition.kind === 'door' && (!partition.door || typeof partition.door.open !== 'boolean')) add(`${partition.key} has malformed door state.`);
    });
    const roomIds = new Set();
    const coveredCells = new Set();
    (habitat.rooms || []).forEach((room) => {
      if (!room.id || roomIds.has(room.id)) add(`${property.id} has duplicate or missing room id.`);
      roomIds.add(room.id);
      if (!Array.isArray(room.cells) || !room.cells.length) add(`${room.id || 'room'} has no cells.`);
      (room.cells || []).forEach((key) => {
        const cell = parseCellKey(key);
        if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y) || cell.x < 0 || cell.y < 0 || cell.x >= property.roomGrid[0] || cell.y >= property.roomGrid[1]) add(`${room.id} contains invalid cell ${key}.`);
        if (coveredCells.has(key)) add(`${key} appears in multiple rooms.`);
        coveredCells.add(key);
      });
      if (!ROOM_PURPOSES.some((entry) => entry.id === room.purpose)) add(`${room.id} has unknown purpose.`);
      if (!['unassigned', 'inferred', 'player', 'agreement', 'resident', 'stewardship', 'migration'].includes(room.purposeSource)) add(`${room.id} has invalid purpose provenance.`);
      if (!FINISHES.some((entry) => entry.id === room.finish?.floorFinishId) || !FINISHES.some((entry) => entry.id === room.finish?.wallFinishId)) add(`${room.id} has invalid finishes.`);
      UTILITY_TYPES.forEach((type) => { if (typeof room.utilityAccess?.[type] !== 'boolean') add(`${room.id} has invalid ${type} access.`); });
    });
    if (coveredCells.size !== property.roomGrid[0] * property.roomGrid[1]) add(`${property.id} room graph covers ${coveredCells.size}/${property.roomGrid[0] * property.roomGrid[1]} cells.`);
    (property.furniture || []).forEach((object) => {
      if (!objectFitsAt(property, object, object.position.x, object.position.y, object.footprint)) add(`${object.id} crosses a room boundary or lacks required room utilities.`);
    });
    const facilities = facilityReport(property);
    if (!facilities.allRoomsReachable) add(`${property.id} contains an inaccessible room.`);
    if (!facilities.bathroom) add(`${property.id} has no bathroom-purpose room.`);
    else {
      if (!facilities.bathroom.reachable) add(`${property.id} bathroom is inaccessible.`);
      if (!facilities.bathroom.utilities.water || !facilities.bathroom.utilities.waste) add(`${property.id} bathroom lacks water or waste access.`);
    }
    if (!facilities.sleepObjectsReachable) add(`${property.id} contains an unreachable sleeping object.`);
    (habitat.projects || []).forEach((project) => {
      if (project.schema !== PROJECT_SCHEMA) add(`${project.id || 'project'} has invalid project schema.`);
      if (!PROJECT_TYPES.includes(project.spec?.type)) add(`${project.id || 'project'} has invalid project type.`);
      if (!PROJECT_STATUSES.includes(project.status)) add(`${project.id || 'project'} has invalid status.`);
      if (!Array.isArray(project.phases) || !Array.isArray(project.completedPhaseIds) || !Array.isArray(project.history)) add(`${project.id || 'project'} has malformed phase/history records.`);
    });
    return { ok: errors.length === 0, errors, facilities };
  }

  function validate(world, add) {
    if (!Array.isArray(world.places)) return;
    world.places.filter(isResidential).forEach((property) => {
      const result = validateProperty(world, property);
      result.errors.forEach(add);
    });
    const household = AXM.Households?.playerHousehold(world);
    if (household && household.homePropertyId && AXM.Households.isCohabiting(world, household)) {
      const property = World.getProperty(world, household.homePropertyId);
      const permissions = roomPermissionsForProperty(world, property.id);
      if (!permissions.length) add(`${household.id} has no room-graph permissions.`);
      permissions.forEach((permission) => {
        if (!roomById(property, permission.roomId)) add(`${household.id} references unknown room ${permission.roomId}.`);
        if (!['player_private', 'common', 'partner_private'].includes(permission.kind)) add(`${household.id} has invalid room permission ${String(permission.kind)}.`);
      });
      property.furniture.filter((object) => object.ownershipMode !== 'property_fixture' && household.memberIds.includes(object.ownerId)).forEach((object) => {
        const result = placementPermission(world, property, object.ownerId, object, object.position.x, object.position.y, object.footprint);
        if (!result.ok) add(`${object.id} violates graph-based household room permissions.`);
      });
    }
  }

  Object.assign(Systems, {
    requestHabitatProject,
    workHabitatProject,
    cancelHabitatProject,
    setRoomPurpose
  });

  AXM.Habitats = {
    HABITAT_SCHEMA,
    PROJECT_SCHEMA,
    PROJECT_TYPES,
    PROJECT_STATUSES,
    PARTITION_KINDS,
    UTILITY_TYPES,
    ROOM_PURPOSES,
    WALL_MATERIALS,
    FINISHES,
    ensureState,
    initializeWorld,
    initializeProperty,
    ensurePropertyState,
    cellKey,
    parseCellKey,
    edgeKey,
    parseEdgeKey,
    edgeCells,
    partitionAt,
    setPartition,
    roomAtCell,
    roomById,
    computeRooms,
    computeRoomConnections,
    layoutHash,
    footprintRespectsPartitions,
    objectFitsAt,
    objectUtilityNeeds,
    reachableCells,
    facilityReport,
    roomSuggestions,
    roomPermissionsForProperty,
    syncHouseholdRoomPermissions,
    permissionAtCell,
    placementPermission,
    projectAuthority,
    validateProjectSpec,
    projectSummary,
    projectPhases,
    projectBudget,
    createProject,
    requestHabitatProject,
    createAuthorizedProject,
    createFamilyAuthorizedProject,
    createStewardshipProject,
    findProject,
    workHabitatProject,
    workStewardshipProject,
    cancelHabitatProject,
    setRoomPurpose,
    listEdges,
    recommendedEdits,
    validateProperty,
    validate,
    finishById,
    materialById,
    roomPurpose
  };
}(typeof window !== 'undefined' ? window : globalThis));
