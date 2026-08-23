(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const World = AXM.World;
  const Systems = AXM.Systems;

  const EXTERIOR_SCHEMA = 'axm.living-city.place-exterior/v0.9.0';
  const NETWORK_SCHEMA = 'axm.living-city.street-network/v0.9.0';
  const TRAVEL_SCHEMA = 'axm.living-city.travel-record/v0.9.0';
  const STREET_MOMENT_SCHEMA = 'axm.living-city.street-moment/v0.9.0';
  const TRAVEL_MODES = ['visible', 'compressed', 'schedule', 'bundled'];
  const TRAVEL_STATUSES = ['active', 'completed', 'ended_early'];

  // Route finding is pure for the lifetime of a generated street-network object.
  // Keep the cache outside world state so saves remain source-honest and replayable.
  // This turns long observer runs from repeated graph searches into bounded lookups
  // without granting the cache any simulation authority.
  const ROUTE_CACHE = new WeakMap();

  const LANE_DEFINITIONS = [
    { id: 'north_walk', name: 'Canal Backwalk', y: 3.55, color: '#8a9b94' },
    { id: 'main_street', name: 'Small Square Street', y: 5.82, color: '#b3a47d' },
    { id: 'old_lane', name: 'Old Lane', y: 9.28, color: '#9c866c' },
    { id: 'river_walk', name: 'River Edge Walk', y: 12.28, color: '#71959c' }
  ];

  const CONNECTORS = [
    { id: 'courtyard_cut', name: 'Courtyard Cut', x: 2.75 },
    { id: 'market_passage', name: 'Market Passage', x: 8.9 },
    { id: 'arcade_link', name: 'Arcade Link', x: 15.45 }
  ];

  const FACADE_MATERIALS = ['soft brick', 'patched brick', 'painted plaster', 'weathered timber', 'honest concrete', 'reused tile'];
  const WINDOW_STYLES = ['deep sill', 'small-paned', 'wide shop window', 'mismatched frames', 'simple casement', 'high workshop glass'];
  const ROOFLINES = ['flat parapet', 'shallow pitch', 'stepped row', 'patched ridge', 'small dormer line'];
  const ACCESS_TYPES = ['level threshold', 'one low step', 'short ramp'];
  const DOOR_COLORS = ['#6e8d74', '#745c4f', '#526e80', '#8b7651', '#645978', '#8f6b64'];

  const STREET_OBSERVATIONS = [
    'A repaired chair waited beside a frontage instead of being thrown away.',
    'A window showed a room that had clearly been shaped over time, not bought as a finished set.',
    'Someone paused to read a small hand-written notice and then kept walking.',
    'Light from a workshop made the street feel occupied without demanding attention.',
    'Two neighbors crossed paths, exchanged a few words, and continued in different directions.',
    'A plant had been moved into the sun beside an old doorway.',
    'A delivery was left where the resident could actually reach it.',
    'An open window carried the sound of someone making something slowly.',
    'A shopfront stayed closed today without the town treating that as failure.',
    'The same old object appeared in a different window, repaired again rather than replaced.'
  ];

  function stableNumber(world, key, maxExclusive) {
    if (!maxExclusive) return 0;
    return Core.hashString(`${world.seed}|walkable-v0.9|${key}`) % maxExclusive;
  }

  function exteriorUniqueId(world, prefix) {
    world.exteriorIdCounter = (world.exteriorIdCounter || 0) + 1;
    return `${prefix}_${String(world.exteriorIdCounter).padStart(6, '0')}`;
  }

  function nowStamp(world) {
    return { day: world.time.day, hour: world.time.hour, minute: world.time.minute || 0 };
  }

  function absoluteMinutes(stamp) {
    if (!stamp) return 0;
    return ((Number(stamp.day) || 1) - 1) * 1440 + (Number(stamp.hour) || 0) * 60 + (Number(stamp.minute) || 0);
  }

  function laneForPlace(place) {
    const centerY = Number(place.y || 0) + Number(place.h || 1) / 2;
    return LANE_DEFINITIONS.slice().sort((a, b) => Math.abs(centerY - a.y) - Math.abs(centerY - b.y))[0];
  }

  function frontageType(place) {
    if (place.kind === 'commercial') return 'shopfront';
    if (place.kind === 'residential') {
      if (place.type === 'house') return place.name.toLowerCase().includes('garden') ? 'small front garden' : 'street stoop';
      if (place.type === 'student_house') return 'shared entry';
      return 'shared stair entry';
    }
    if (place.type === 'park') return 'open green edge';
    if (place.type === 'public') return 'open square edge';
    if (place.type === 'learning') return 'community doorway';
    if (place.type === 'shop') return 'market frontage';
    return 'working frontage';
  }

  function entranceSide(place, lane) {
    const centerY = Number(place.y || 0) + Number(place.h || 1) / 2;
    return centerY < lane.y ? 'south' : 'north';
  }

  function doorPosition(place, lane) {
    const side = entranceSide(place, lane);
    const x = Number(place.x || 0) + Number(place.w || 1) / 2;
    const y = side === 'south' ? Number(place.y || 0) + Number(place.h || 1) : Number(place.y || 0);
    return { x: Core.round(x, 3), y: Core.round(y, 3), side };
  }

  function exteriorAddress(world, place, lane, usedAddresses) {
    const side = entranceSide(place, lane);
    const laneIndex = LANE_DEFINITIONS.findIndex((entry) => entry.id === lane.id);
    let number = (laneIndex + 1) * 100 + Math.round((Number(place.x || 0) + Number(place.w || 1) / 2) * 4) * 2 + (side === 'south' ? 1 : 0);
    let label = `${number} ${lane.name}`;
    while (usedAddresses.has(label)) {
      number += 2;
      label = `${number} ${lane.name}`;
    }
    usedAddresses.add(label);
    return { number, streetName: lane.name, label };
  }

  function makeExterior(world, place, usedAddresses) {
    const lane = laneForPlace(place);
    const address = exteriorAddress(world, place, lane, usedAddresses);
    const door = doorPosition(place, lane);
    const key = place.id;
    const signText = place.kind === 'residential' ? String(address.number) : (place.name || place.symbol || 'Open place');
    return {
      schema: EXTERIOR_SCHEMA,
      placeId: place.id,
      address,
      streetId: lane.id,
      entrance: {
        side: door.side,
        position: { x: door.x, y: door.y },
        access: ACCESS_TYPES[stableNumber(world, `${key}:access`, ACCESS_TYPES.length)],
        doorColor: DOOR_COLORS[stableNumber(world, `${key}:door`, DOOR_COLORS.length)],
        publicWhenOpen: place.kind !== 'residential'
      },
      facade: {
        material: FACADE_MATERIALS[stableNumber(world, `${key}:material`, FACADE_MATERIALS.length)],
        windowStyle: WINDOW_STYLES[stableNumber(world, `${key}:windows`, WINDOW_STYLES.length)],
        windowCount: Math.max(1, Math.min(9, Math.round((Number(place.w || 1) * 2.1) + (Number(place.h || 1) * 0.7)))),
        roofline: ROOFLINES[stableNumber(world, `${key}:roof`, ROOFLINES.length)],
        frontageType: frontageType(place),
        signText,
        signVisible: place.kind !== 'residential' || Boolean(place.symbol)
      },
      source: {
        kind: 'deterministic_map_derivation',
        seed: world.seed,
        mapPosition: { x: place.x, y: place.y, w: place.w, h: place.h }
      },
      history: Array.isArray(place.exterior?.history) ? place.exterior.history : []
    };
  }

  function coordKey(x, y) {
    return `${Number(x).toFixed(3)}|${Number(y).toFixed(3)}`;
  }

  function buildStreetNetwork(world) {
    const nodes = [];
    const edges = [];
    const nodeByCoordinate = new Map();
    const nodeById = new Map();
    const addNode = (node) => {
      if (nodeById.has(node.id)) return nodeById.get(node.id);
      nodes.push(node);
      nodeById.set(node.id, node);
      if (node.kind !== 'door') nodeByCoordinate.set(coordKey(node.x, node.y), node);
      return node;
    };
    const laneNode = (lane, x) => {
      const key = coordKey(x, lane.y);
      if (nodeByCoordinate.has(key)) return nodeByCoordinate.get(key);
      const node = addNode({
        id: `street_${lane.id}_${String(x).replace(/\./g, '_')}`,
        kind: 'street', streetId: lane.id, streetName: lane.name,
        x: Core.round(x, 3), y: lane.y
      });
      return node;
    };
    const addEdge = (a, b, streetId, streetName, kind = 'street') => {
      if (!a || !b || a.id === b.id) return null;
      const dx = Number(a.x) - Number(b.x);
      const dy = Number(a.y) - Number(b.y);
      const distanceTiles = Math.sqrt(dx * dx + dy * dy);
      const distanceMeters = Math.max(5, Math.round(distanceTiles * 42));
      const durationMinutes = Math.max(1, Math.ceil(distanceMeters / 78));
      const id = `edge_${edges.length + 1}`;
      const edge = { id, from: a.id, to: b.id, kind, streetId, streetName, distanceMeters, durationMinutes };
      edges.push(edge);
      return edge;
    };

    const placeAssignments = new Map();
    world.places.forEach((place) => {
      const lane = laneForPlace(place);
      const door = doorPosition(place, lane);
      placeAssignments.set(place.id, { lane, door });
    });

    LANE_DEFINITIONS.forEach((lane) => {
      const xs = new Set([0.35, world.map.width - 0.35, ...CONNECTORS.map((entry) => entry.x)]);
      placeAssignments.forEach((assignment) => {
        if (assignment.lane.id === lane.id) xs.add(assignment.door.x);
      });
      const sorted = Array.from(xs).sort((a, b) => a - b);
      const lineNodes = sorted.map((x) => laneNode(lane, x));
      for (let index = 1; index < lineNodes.length; index += 1) {
        addEdge(lineNodes[index - 1], lineNodes[index], lane.id, lane.name, 'street');
      }
    });

    CONNECTORS.forEach((connector) => {
      const connectorNodes = LANE_DEFINITIONS.map((lane) => laneNode(lane, connector.x));
      for (let index = 1; index < connectorNodes.length; index += 1) {
        addEdge(connectorNodes[index - 1], connectorNodes[index], connector.id, connector.name, 'passage');
      }
    });

    world.places.forEach((place) => {
      const assignment = placeAssignments.get(place.id);
      const access = laneNode(assignment.lane, assignment.door.x);
      const door = addNode({
        id: `door_${place.id}`,
        kind: 'door', placeId: place.id, streetId: assignment.lane.id, streetName: assignment.lane.name,
        x: assignment.door.x, y: assignment.door.y
      });
      addEdge(door, access, `frontage_${place.id}`, place.exterior?.address?.label || assignment.lane.name, 'frontage');
      if (place.exterior) {
        place.exterior.entrance.doorNodeId = door.id;
        place.exterior.entrance.accessNodeId = access.id;
      }
    });

    const adjacency = {};
    nodes.forEach((node) => { adjacency[node.id] = []; });
    edges.forEach((edge) => {
      adjacency[edge.from].push({ edgeId: edge.id, nodeId: edge.to, weight: edge.distanceMeters });
      adjacency[edge.to].push({ edgeId: edge.id, nodeId: edge.from, weight: edge.distanceMeters });
    });

    return {
      schema: NETWORK_SCHEMA,
      generatedFrom: { seed: world.seed, mapWidth: world.map.width, mapHeight: world.map.height },
      lanes: LANE_DEFINITIONS.map((entry) => ({ ...entry })),
      connectors: CONNECTORS.map((entry) => ({ ...entry })),
      nodes,
      edges,
      adjacency
    };
  }

  function networkNode(world, nodeId) {
    return world.streetNetwork?.nodes?.find((entry) => entry.id === nodeId) || null;
  }

  function networkEdge(world, edgeId) {
    return world.streetNetwork?.edges?.find((entry) => entry.id === edgeId) || null;
  }

  function routeFromNodes(world, originNodeId, destinationNodeId) {
    const network = world.streetNetwork;
    if (!network?.adjacency?.[originNodeId] || !network.adjacency[destinationNodeId]) return null;
    let cache = ROUTE_CACHE.get(network);
    if (!cache) {
      cache = new Map();
      ROUTE_CACHE.set(network, cache);
    }
    const cacheKey = `${originNodeId}->${destinationNodeId}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      return cached ? {
        ...cached,
        nodeIds: cached.nodeIds.slice(),
        edgeIds: cached.edgeIds.slice(),
        streetNames: cached.streetNames.slice()
      } : null;
    }
    const distances = new Map([[originNodeId, 0]]);
    const previous = new Map();
    const unvisited = new Set(network.nodes.map((entry) => entry.id));

    while (unvisited.size) {
      let current = null;
      let best = Infinity;
      unvisited.forEach((nodeId) => {
        const distance = distances.get(nodeId);
        if (distance != null && distance < best) {
          current = nodeId;
          best = distance;
        }
      });
      if (!current) break;
      if (current === destinationNodeId) break;
      unvisited.delete(current);
      (network.adjacency[current] || []).forEach((link) => {
        if (!unvisited.has(link.nodeId)) return;
        const candidate = best + link.weight;
        if (candidate < (distances.get(link.nodeId) ?? Infinity)) {
          distances.set(link.nodeId, candidate);
          previous.set(link.nodeId, { nodeId: current, edgeId: link.edgeId });
        }
      });
    }

    if (!distances.has(destinationNodeId)) {
      cache.set(cacheKey, null);
      return null;
    }
    const nodeIds = [destinationNodeId];
    const edgeIds = [];
    let cursor = destinationNodeId;
    while (cursor !== originNodeId) {
      const step = previous.get(cursor);
      if (!step) {
        cache.set(cacheKey, null);
        return null;
      }
      edgeIds.unshift(step.edgeId);
      nodeIds.unshift(step.nodeId);
      cursor = step.nodeId;
    }
    const edges = edgeIds.map((id) => networkEdge(world, id)).filter(Boolean);
    const distanceMeters = edges.reduce((sum, edge) => sum + edge.distanceMeters, 0);
    const durationMinutes = edges.reduce((sum, edge) => sum + edge.durationMinutes, 0);
    const streetNames = [];
    edges.forEach((edge) => {
      if (edge.kind === 'frontage') return;
      if (!streetNames.includes(edge.streetName)) streetNames.push(edge.streetName);
    });
    const route = { nodeIds, edgeIds, distanceMeters, durationMinutes, streetNames };
    cache.set(cacheKey, {
      ...route,
      nodeIds: route.nodeIds.slice(),
      edgeIds: route.edgeIds.slice(),
      streetNames: route.streetNames.slice()
    });
    return route;
  }

  function routeBetween(world, originPlaceId, destinationPlaceId) {
    ensureState(world);
    const origin = World.getPlace(world, originPlaceId);
    const destination = World.getPlace(world, destinationPlaceId);
    if (!origin || !destination) return null;
    const originNodeId = origin.exterior?.entrance?.doorNodeId;
    const destinationNodeId = destination.exterior?.entrance?.doorNodeId;
    if (!originNodeId || !destinationNodeId) return null;
    const route = routeFromNodes(world, originNodeId, destinationNodeId);
    return route ? { ...route, originPlaceId, destinationPlaceId } : null;
  }

  function createTravelRecord(world, actorId, originPlaceId, destinationPlaceId, mode, purpose = 'move through the neighborhood') {
    const route = routeBetween(world, originPlaceId, destinationPlaceId);
    if (!route) return null;
    const record = {
      schema: TRAVEL_SCHEMA,
      id: exteriorUniqueId(world, 'travel'),
      actorId,
      originPlaceId,
      destinationPlaceId,
      intendedDestinationPlaceId: destinationPlaceId,
      mode,
      purpose,
      status: mode === 'visible' ? 'active' : 'completed',
      startedAt: nowStamp(world),
      completedAt: mode === 'visible' ? null : nowStamp(world),
      route: {
        nodeIds: route.nodeIds,
        edgeIds: route.edgeIds,
        streetNames: route.streetNames,
        distanceMeters: route.distanceMeters,
        durationMinutes: route.durationMinutes
      },
      currentNodeIndex: mode === 'visible' ? 0 : route.nodeIds.length - 1,
      elapsedMinutes: mode === 'visible' ? 0 : route.durationMinutes,
      timeAccounting: mode === 'schedule' ? 'hourly_schedule_resolution' : mode === 'bundled' ? 'inside_existing_action_budget' : 'minute_level',
      observations: [],
      history: []
    };
    world.travelRecords.push(record);
    trimTravelRecords(world);
    return record;
  }

  function trimTravelRecords(world) {
    if (world.travelRecords.length <= 500) return;
    const activeId = world.activeTravel?.recordId;
    let excess = world.travelRecords.length - 500;
    if (!activeId) {
      world.travelRecords.splice(0, excess);
      return;
    }
    // The active visible route is normally the newest record. Keep the fallback
    // exact for unusual imported states where it is not.
    for (let index = 0; index < world.travelRecords.length && excess > 0;) {
      if (world.travelRecords[index].id === activeId) {
        index += 1;
      } else {
        world.travelRecords.splice(index, 1);
        excess -= 1;
      }
    }
  }

  function recordById(world, recordId) {
    return (world.travelRecords || []).find((entry) => entry.id === recordId) || null;
  }

  function travelEffect(world, minutes) {
    const amount = Math.max(0, Number(minutes) || 0);
    if (!amount) return;
    // Travel cost is deliberately linear so resolving a route segment-by-segment
    // or all at once produces the same state. Walking is not granted a hidden
    // mood reward that would make the visible route the statistically correct choice.
    Systems.applyNeedEffects(world.player, {
      energy: -amount * 0.045,
      hunger: -amount * 0.018
    });
    world.player.needs.energy = Core.round(world.player.needs.energy, 6);
    world.player.needs.hunger = Core.round(world.player.needs.hunger, 6);
  }

  function spendTravelMinutes(world, minutes) {
    const amount = Math.max(0, Math.round(Number(minutes) || 0));
    if (!amount) return;
    Systems.advanceMinutes(world, amount, { travel: true });
    travelEffect(world, amount);
  }

  function streetMoment(world, record, nodeIndex) {
    const nodeId = record.route.nodeIds[nodeIndex];
    const node = networkNode(world, nodeId);
    if (!node) return null;
    const nearby = (world.travelRecords || []).slice().reverse().find((entry) => {
      if (entry.id === record.id || entry.actorId === 'player' || entry.status !== 'completed') return false;
      const age = absoluteMinutes(nowStamp(world)) - absoluteMinutes(entry.completedAt);
      return age >= 0 && age <= 180 && entry.route?.streetNames?.some((name) => record.route.streetNames.includes(name));
    });
    let text;
    let actorIds = ['player'];
    if (nearby) {
      const person = World.getPerson(world, nearby.actorId);
      text = person
        ? `You noticed ${person.name} moving through ${node.streetName || record.route.streetNames[0] || 'the neighborhood'} on their own route.`
        : STREET_OBSERVATIONS[stableNumber(world, `${record.id}:${nodeIndex}`, STREET_OBSERVATIONS.length)];
      if (person) actorIds.push(person.id);
    } else {
      text = STREET_OBSERVATIONS[stableNumber(world, `${record.id}:${nodeIndex}`, STREET_OBSERVATIONS.length)];
    }
    const moment = {
      schema: STREET_MOMENT_SCHEMA,
      id: exteriorUniqueId(world, 'street_moment'),
      day: world.time.day,
      hour: world.time.hour,
      minute: world.time.minute || 0,
      nodeId,
      streetName: node.streetName || record.route.streetNames[0] || null,
      actorIds,
      text,
      consequence: 'observation_only'
    };
    record.observations.push(moment.id);
    world.streetMoments.push(moment);
    if (world.streetMoments.length > 160) world.streetMoments.splice(0, world.streetMoments.length - 160);
    world.metrics.streetMomentsObserved += 1;
    return moment;
  }

  function finishRecord(world, record, status = 'completed', actualDestinationId = null) {
    const destinationId = actualDestinationId || record.destinationPlaceId;
    record.status = status;
    record.destinationPlaceId = destinationId;
    record.completedAt = nowStamp(world);
    record.currentNodeIndex = record.route.nodeIds.length - 1;
    world.player.locationId = destinationId;
    world.activeTravel = null;
    world.exteriorState.lastPlayerPlaceId = destinationId;
    world.metrics.playerJourneysCompleted += 1;
    world.metrics.playerWalkingMinutes += record.elapsedMinutes;
    world.metrics.playerWalkingDistanceMeters += record.route.distanceMeters;
    if (record.mode === 'visible') world.metrics.playerVisibleJourneys += 1;
    if (record.mode === 'compressed') world.metrics.playerCompressedJourneys += 1;
    const destination = World.getPlace(world, destinationId);
    Core.appendLedger(world, 'travel', status === 'ended_early'
      ? `You ended the route early at ${destination?.name || 'the nearest reachable place'} without a failure label.`
      : `You reached ${destination?.name || destinationId} through ${record.route.streetNames.join(', ') || 'the local walkways'}.`, {
      actorIds: ['player'], placeId: destinationId,
      causes: [record.mode === 'visible' ? 'visible walking chosen' : 'travel compressed by player choice', 'same route cost in either mode', 'no walking obligation'],
      evidence: { mode: record.mode, durationMinutes: record.elapsedMinutes, distanceMeters: record.route.distanceMeters, routeId: record.id }
    });
    const thresholdPresence = AXM.Presence?.arriveFromStreetTravel?.(world, destinationId, {
      travelRecordId: record.id,
      mode: record.mode,
      endedEarly: status === 'ended_early'
    }) || null;
    Systems.toast(world, status === 'ended_early'
      ? `Route ended at ${destination?.name || 'a nearby place'}.`
      : `Reached ${destination?.name || 'destination'}. Entering remains a separate lawful choice.`, 'success');
    return { ok: true, record, thresholdPresence };
  }

  function startPlayerTravel(world, destinationPlaceId, mode = 'visible') {
    ensureState(world);
    if (!['visible', 'compressed'].includes(mode)) return { ok: false, reason: 'Travel must be visible or compressed.' };
    if (world.activeShift) return { ok: false, reason: 'Finish or leave the active workday before starting another route.' };
    if (world.activeEnterpriseSessionId) return { ok: false, reason: 'Finish the active enterprise session before starting another route.' };
    if (world.activeTravel) return { ok: false, reason: 'A visible route is already active.' };
    if (world.activeIndoorMovement) return { ok: false, reason: 'Finish or compress the active indoor route first.' };
    const originPlaceId = world.player.locationId;
    if (originPlaceId === destinationPlaceId) return { ok: false, reason: 'You are already at that place.' };
    const destination = World.getPlace(world, destinationPlaceId);
    if (!destination) return { ok: false, reason: 'Unknown destination.' };
    const record = createTravelRecord(world, 'player', originPlaceId, destinationPlaceId, mode, 'player-chosen neighborhood travel');
    if (!record) return { ok: false, reason: 'No walkable route connects those places.' };

    if (mode === 'compressed') {
      spendTravelMinutes(world, record.route.durationMinutes);
      record.elapsedMinutes = record.route.durationMinutes;
      record.history.push({ at: nowStamp(world), type: 'compressed', note: 'The route was resolved at once without changing its time or need cost.' });
      return finishRecord(world, record, 'completed');
    }

    record.status = 'active';
    record.completedAt = null;
    record.elapsedMinutes = 0;
    record.currentNodeIndex = 0;
    world.activeTravel = { recordId: record.id };
    world.exteriorState.lastPlayerPlaceId = originPlaceId;
    Core.appendLedger(world, 'travel', `You began walking from ${World.getPlace(world, originPlaceId)?.name || originPlaceId} toward ${destination.name}.`, {
      actorIds: ['player'], placeId: originPlaceId,
      causes: ['visible route chosen', 'no mandatory walking'],
      evidence: { routeId: record.id, durationMinutes: record.route.durationMinutes, distanceMeters: record.route.distanceMeters }
    });
    Systems.toast(world, `Route started: ${record.route.durationMinutes} minutes. Walk it in stretches or finish it compressed.`, 'info');
    return { ok: true, record };
  }

  function stepPlayerTravel(world) {
    ensureState(world);
    const record = recordById(world, world.activeTravel?.recordId);
    if (!record || record.status !== 'active') return { ok: false, reason: 'No visible route is active.' };
    if (record.currentNodeIndex >= record.route.nodeIds.length - 1) return finishRecord(world, record, 'completed');
    const edgeId = record.route.edgeIds[record.currentNodeIndex];
    const edge = networkEdge(world, edgeId);
    if (!edge) return { ok: false, reason: 'The next street segment is missing.' };
    spendTravelMinutes(world, edge.durationMinutes);
    record.elapsedMinutes += edge.durationMinutes;
    record.currentNodeIndex += 1;
    record.history.push({ at: nowStamp(world), type: 'segment', edgeId, streetName: edge.streetName, minutes: edge.durationMinutes });
    const observation = streetMoment(world, record, record.currentNodeIndex);
    if (record.currentNodeIndex >= record.route.nodeIds.length - 1) return finishRecord(world, record, 'completed');
    const remaining = record.route.edgeIds.slice(record.currentNodeIndex).reduce((sum, id) => sum + (networkEdge(world, id)?.durationMinutes || 0), 0);
    Systems.toast(world, observation ? `${observation.text} ${remaining} minutes remain.` : `${remaining} minutes remain.`, 'info');
    return { ok: true, record, observation, remainingMinutes: remaining };
  }

  function finishPlayerTravelCompressed(world) {
    ensureState(world);
    const record = recordById(world, world.activeTravel?.recordId);
    if (!record || record.status !== 'active') return { ok: false, reason: 'No visible route is active.' };
    const remainingEdges = record.route.edgeIds.slice(record.currentNodeIndex);
    const remaining = remainingEdges.reduce((sum, id) => sum + (networkEdge(world, id)?.durationMinutes || 0), 0);
    spendTravelMinutes(world, remaining);
    record.elapsedMinutes += remaining;
    record.currentNodeIndex = record.route.nodeIds.length - 1;
    record.history.push({ at: nowStamp(world), type: 'remaining_route_compressed', minutes: remaining });
    return finishRecord(world, record, 'completed');
  }

  function endPlayerTravelEarly(world) {
    ensureState(world);
    const record = recordById(world, world.activeTravel?.recordId);
    if (!record || record.status !== 'active') return { ok: false, reason: 'No visible route is active.' };
    const currentNodeId = record.route.nodeIds[record.currentNodeIndex];
    const originNodeId = record.route.nodeIds[0];
    const destinationNodeId = record.route.nodeIds[record.route.nodeIds.length - 1];
    const back = routeFromNodes(world, currentNodeId, originNodeId);
    const onward = routeFromNodes(world, currentNodeId, destinationNodeId);
    const chooseOrigin = !onward || (back && back.distanceMeters <= onward.distanceMeters);
    const chosen = chooseOrigin ? back : onward;
    const chosenPlaceId = chooseOrigin ? record.originPlaceId : record.intendedDestinationPlaceId;
    if (chosen) {
      spendTravelMinutes(world, chosen.durationMinutes);
      record.elapsedMinutes += chosen.durationMinutes;
    }
    record.history.push({ at: nowStamp(world), type: 'ended_early', nearestEnd: chosenPlaceId, minutes: chosen?.durationMinutes || 0 });
    return finishRecord(world, record, 'ended_early', chosenPlaceId);
  }

  function recordScheduledTravel(world, actorId, originPlaceId, destinationPlaceId, purpose = 'autonomous schedule') {
    ensureState(world);
    if (!originPlaceId || !destinationPlaceId || originPlaceId === destinationPlaceId) return null;
    const recent = world.travelRecords[world.travelRecords.length - 1];
    if (recent && recent.actorId === actorId && recent.originPlaceId === originPlaceId && recent.destinationPlaceId === destinationPlaceId
      && recent.startedAt.day === world.time.day && recent.startedAt.hour === world.time.hour && recent.mode === 'schedule') return recent;
    const record = createTravelRecord(world, actorId, originPlaceId, destinationPlaceId, 'schedule', purpose);
    if (!record) return null;
    record.status = 'completed';
    record.completedAt = nowStamp(world);
    record.history.push({ at: nowStamp(world), type: 'schedule_resolution', note: 'Resolved inside the existing hourly NPC schedule.' });
    world.metrics.npcRoutesObserved += 1;
    world.metrics.npcRouteDistanceMeters += record.route.distanceMeters;
    const person = World.getPerson(world, actorId);
    if (person) person.lastTravelRecordId = record.id;
    return record;
  }

  function recordBundledTravel(world, actorId, originPlaceId, destinationPlaceId, purpose = 'travel bundled inside an existing action') {
    ensureState(world);
    if (!originPlaceId || !destinationPlaceId || originPlaceId === destinationPlaceId) return null;
    const record = createTravelRecord(world, actorId, originPlaceId, destinationPlaceId, 'bundled', purpose);
    if (!record) return null;
    record.status = 'completed';
    record.completedAt = nowStamp(world);
    record.history.push({ at: nowStamp(world), type: 'bundled', note: 'Route provenance was retained while time remained inside the parent action budget.' });
    world.metrics.bundledRoutesRecorded += 1;
    return record;
  }

  function reconcilePlayerLocation(world, reason = 'system action') {
    ensureState(world);
    if (world.activeTravel) return null;
    const current = world.player.locationId;
    const previous = world.exteriorState.lastPlayerPlaceId;
    if (previous && current && previous !== current) {
      const record = recordBundledTravel(world, 'player', previous, current, reason);
      world.exteriorState.lastPlayerPlaceId = current;
      return record;
    }
    world.exteriorState.lastPlayerPlaceId = current;
    return null;
  }

  function previewRoute(world, destinationPlaceId) {
    ensureState(world);
    if (world.activeTravel) {
      const record = recordById(world, world.activeTravel.recordId);
      if (record) return {
        ...record.route,
        originPlaceId: record.originPlaceId,
        destinationPlaceId: record.destinationPlaceId,
        active: true,
        currentNodeIndex: record.currentNodeIndex
      };
    }
    return routeBetween(world, world.player.locationId, destinationPlaceId);
  }

  function initializeWorld(world, options = {}) {
    ensureState(world);
    const preservedLastPlayerPlaceId = world.exteriorState.lastPlayerPlaceId;
    const usedAddresses = new Set();
    world.places.forEach((place) => {
      const priorHistory = Array.isArray(place.exterior?.history) ? place.exterior.history : [];
      place.exterior = makeExterior(world, place, usedAddresses);
      place.exterior.history = priorHistory;
    });
    world.streetNetwork = buildStreetNetwork(world);
    world.exteriorState.networkHash = Core.hashString(JSON.stringify({
      seed: world.seed,
      places: world.places.map((place) => [place.id, place.x, place.y, place.w, place.h, place.exterior.address.label])
    })).toString(16);
    world.exteriorState.lastPlayerPlaceId = options.migration
      && preservedLastPlayerPlaceId
      && World.getPlace(world, preservedLastPlayerPlaceId)
      ? preservedLastPlayerPlaceId
      : world.player.locationId;
    if (!options.silent && !world.flags.exteriorFoundationLogged) {
      Core.appendLedger(world, 'travel', 'The neighborhood gained persistent exterior identities, addresses, connected pedestrian routes, and equal visible or compressed travel. Walking remains an option, never a daily obligation.', {
        causes: ['v0.9 walkable places foundation', 'casual realism', 'travel compression preserved'],
        evidence: { places: world.places.length, nodes: world.streetNetwork.nodes.length, edges: world.streetNetwork.edges.length }
      });
      world.flags.exteriorFoundationLogged = true;
    }
    return world;
  }

  function ensureState(world) {
    if (!world.time || typeof world.time !== 'object') world.time = { day: 1, hour: 7, minute: 0 };
    if (!Number.isInteger(world.time.minute) || world.time.minute < 0 || world.time.minute > 59) world.time.minute = 0;
    if (!Number.isInteger(world.exteriorIdCounter) || world.exteriorIdCounter < 0) world.exteriorIdCounter = 0;
    if (!Array.isArray(world.travelRecords)) world.travelRecords = [];
    if (!Array.isArray(world.streetMoments)) world.streetMoments = [];
    if (!world.exteriorState || typeof world.exteriorState !== 'object') world.exteriorState = {};
    if (world.activeTravel === undefined) world.activeTravel = null;
    if (!world.settings || typeof world.settings !== 'object') world.settings = {};
    if (!['visible', 'compressed'].includes(world.settings.defaultTravelMode)) world.settings.defaultTravelMode = 'compressed';
    world.settings.travelCompressionAllowed = true;
    world.settings.walkingObligation = false;
    if (!world.ui || typeof world.ui !== 'object') world.ui = {};
    if (world.ui.selectedStreetMomentId === undefined) world.ui.selectedStreetMomentId = null;
    if (world.ui.streetRouteDestinationId === undefined) world.ui.streetRouteDestinationId = world.ui.selectedPlaceId || world.player?.locationId || null;
    if (!world.flags || typeof world.flags !== 'object') world.flags = {};
    if (world.flags.exteriorFoundationLogged === undefined) world.flags.exteriorFoundationLogged = false;
    if (world.flags.walkableExperimentPrepared === undefined) world.flags.walkableExperimentPrepared = false;
    if (!world.metrics || typeof world.metrics !== 'object') world.metrics = {};
    [
      'playerJourneysCompleted', 'playerVisibleJourneys', 'playerCompressedJourneys', 'playerWalkingMinutes',
      'playerWalkingDistanceMeters', 'npcRoutesObserved', 'npcRouteDistanceMeters', 'bundledRoutesRecorded',
      'streetMomentsObserved', 'walkableExperimentRuns'
    ].forEach((key) => {
      if (!Number.isFinite(world.metrics[key])) world.metrics[key] = 0;
    });
    [world.player].concat(world.people || []).forEach((person) => {
      if (!person) return;
      if (person.lastTravelRecordId === undefined) person.lastTravelRecordId = null;
    });
    return world;
  }

  function hourlyTick(world) {
    ensureState(world);
    const cutoff = absoluteMinutes(nowStamp(world)) - 1440 * 14;
    if (world.streetMoments.length > 80) {
      world.streetMoments = world.streetMoments.filter((entry) => absoluteMinutes(entry) >= cutoff).slice(-160);
    }
  }

  function prepareWalkableExperiment(world) {
    ensureState(world);
    if (world.flags.walkableExperimentPrepared) return { ok: false, reason: 'The labeled walkable-place experiment was already prepared.' };
    const destination = World.getPlace(world, 'place_market') || world.places.find((place) => place.id !== world.player.locationId);
    if (!destination) return { ok: false, reason: 'No destination is available.' };
    const start = startPlayerTravel(world, destination.id, 'visible');
    if (!start.ok) return start;
    const first = stepPlayerTravel(world);
    world.flags.walkableExperimentPrepared = true;
    world.metrics.walkableExperimentRuns += 1;
    Core.appendLedger(world, 'research', 'A labeled walkable-place experiment started a genuine visible route and completed one real street segment. It is a QA shortcut, not normal progression.', {
      actorIds: ['player'], placeId: world.player.locationId,
      causes: ['explicit QA shortcut'],
      evidence: { routeId: start.record.id, firstMomentId: first.observation?.id || null }
    });
    return { ok: true, recordId: start.record.id, destinationId: destination.id };
  }

  function metrics(world) {
    ensureState(world);
    const completed = world.travelRecords.filter((entry) => entry.status !== 'active');
    const playerRecords = completed.filter((entry) => entry.actorId === 'player');
    const recentCutoff = absoluteMinutes(nowStamp(world)) - 180;
    const recentNpcRoutes = completed.filter((entry) => entry.actorId !== 'player' && absoluteMinutes(entry.completedAt) >= recentCutoff);
    return {
      exteriorPlaces: world.places.filter((place) => place.exterior?.schema === EXTERIOR_SCHEMA).length,
      addresses: new Set(world.places.map((place) => place.exterior?.address?.label).filter(Boolean)).size,
      networkNodes: world.streetNetwork?.nodes?.length || 0,
      networkEdges: world.streetNetwork?.edges?.length || 0,
      activeTravel: Boolean(world.activeTravel),
      playerJourneys: playerRecords.length,
      playerVisibleJourneys: world.metrics.playerVisibleJourneys || 0,
      playerCompressedJourneys: world.metrics.playerCompressedJourneys || 0,
      playerWalkingMinutes: world.metrics.playerWalkingMinutes || 0,
      playerDistanceMeters: world.metrics.playerWalkingDistanceMeters || 0,
      npcRoutesObserved: world.metrics.npcRoutesObserved || 0,
      recentNpcRoutes: recentNpcRoutes.length,
      streetMoments: world.streetMoments.length,
      compressionAllowed: world.settings.travelCompressionAllowed === true,
      walkingObligation: world.settings.walkingObligation === true
    };
  }

  function validate(world, add) {
    if (!world.streetNetwork || world.streetNetwork.schema !== NETWORK_SCHEMA) add('Street network is missing or has the wrong schema.');
    if (!Array.isArray(world.travelRecords)) add('travelRecords must be an array.');
    if (!Array.isArray(world.streetMoments)) add('streetMoments must be an array.');
    if (world.settings?.travelCompressionAllowed !== true) add('Travel compression must remain available.');
    if (world.settings?.walkingObligation !== false) add('Walking cannot become an obligation flag.');
    if (!Number.isInteger(world.time?.minute) || world.time.minute < 0 || world.time.minute > 59) add('World minute must be an integer from 0 to 59.');
    const placeIds = new Set((world.places || []).map((entry) => entry.id));
    const personIds = new Set(['player'].concat((world.people || []).map((entry) => entry.id)));
    const nodeIds = new Set(world.streetNetwork?.nodes?.map((entry) => entry.id) || []);
    const edgeIds = new Set(world.streetNetwork?.edges?.map((entry) => entry.id) || []);
    const addresses = new Set();
    (world.places || []).forEach((place) => {
      const exterior = place.exterior;
      if (!exterior || exterior.schema !== EXTERIOR_SCHEMA || exterior.placeId !== place.id) add(`${place.id} has invalid exterior identity.`);
      const address = exterior?.address?.label;
      if (!address) add(`${place.id} has no exterior address.`);
      else if (addresses.has(address)) add(`Exterior address ${address} is duplicated.`);
      else addresses.add(address);
      if (!nodeIds.has(exterior?.entrance?.doorNodeId) || !nodeIds.has(exterior?.entrance?.accessNodeId)) add(`${place.id} has invalid entrance nodes.`);
    });
    const travelIds = new Set();
    (world.travelRecords || []).forEach((record) => {
      if (!record.id || travelIds.has(record.id)) add(`Duplicate or missing travel record id ${String(record.id)}.`);
      travelIds.add(record.id);
      if (record.schema !== TRAVEL_SCHEMA) add(`${record.id} has invalid travel schema.`);
      if (!personIds.has(record.actorId)) add(`${record.id} has unknown traveler ${String(record.actorId)}.`);
      if (!placeIds.has(record.originPlaceId) || !placeIds.has(record.destinationPlaceId)) add(`${record.id} has invalid place endpoints.`);
      if (!TRAVEL_MODES.includes(record.mode)) add(`${record.id} has invalid mode.`);
      if (!TRAVEL_STATUSES.includes(record.status)) add(`${record.id} has invalid status.`);
      if (!Array.isArray(record.route?.nodeIds) || record.route.nodeIds.some((id) => !nodeIds.has(id))) add(`${record.id} has invalid route nodes.`);
      if (!Array.isArray(record.route?.edgeIds) || record.route.edgeIds.some((id) => !edgeIds.has(id))) add(`${record.id} has invalid route edges.`);
      if (!Number.isFinite(record.route?.distanceMeters) || record.route.distanceMeters < 0) add(`${record.id} has invalid distance.`);
      if (!Number.isFinite(record.route?.durationMinutes) || record.route.durationMinutes < 0) add(`${record.id} has invalid duration.`);
      if (record.status === 'active' && world.activeTravel?.recordId !== record.id) add(`${record.id} is active without the world activeTravel pointer.`);
    });
    if (world.activeTravel && !travelIds.has(world.activeTravel.recordId)) add('activeTravel points to an unknown record.');
    (world.streetMoments || []).forEach((moment) => {
      if (moment.schema !== STREET_MOMENT_SCHEMA) add(`${moment.id || 'street moment'} has invalid schema.`);
      if (!nodeIds.has(moment.nodeId)) add(`${moment.id || 'street moment'} points to an unknown node.`);
      if (moment.consequence !== 'observation_only') add(`${moment.id || 'street moment'} creates an invalid forced consequence.`);
    });
  }

  AXM.Exteriors = {
    EXTERIOR_SCHEMA,
    NETWORK_SCHEMA,
    TRAVEL_SCHEMA,
    STREET_MOMENT_SCHEMA,
    LANE_DEFINITIONS,
    CONNECTORS,
    initializeWorld,
    ensureState,
    hourlyTick,
    routeBetween,
    routeFromNodes,
    previewRoute,
    networkNode,
    networkEdge,
    recordById,
    startPlayerTravel,
    stepPlayerTravel,
    finishPlayerTravelCompressed,
    endPlayerTravelEarly,
    recordScheduledTravel,
    recordBundledTravel,
    reconcilePlayerLocation,
    prepareWalkableExperiment,
    metrics,
    validate,
    nowStamp,
    absoluteMinutes
  };
}(typeof window !== 'undefined' ? window : globalThis));
