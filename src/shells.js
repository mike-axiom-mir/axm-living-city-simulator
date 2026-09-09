(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Systems = AXM.Systems;
  const Habitats = AXM.Habitats;

  const BUILDING_SCHEMA = 'axm.living-city.building-shell/v0.10.0';
  const FRONTAGE_PROPOSAL_SCHEMA = 'axm.living-city.frontage-proposal/v0.10.0';
  const FRONTAGE_PROJECT_SCHEMA = 'axm.living-city.frontage-project/v0.10.0';

  const PROPOSAL_STATUSES = ['pending_owner', 'awaiting_player', 'approved', 'declined', 'withdrawn', 'project_created', 'completed', 'failed'];
  const PROJECT_STATUSES = ['saving', 'planned', 'active', 'completed', 'failed', 'cancelled'];
  const CHANGE_TYPES = ['door_color', 'window_boxes', 'frame_style', 'entry_light', 'sign_text', 'facade_accent'];
  const FRAME_STYLES = ['deep sill', 'small-paned', 'simple casement', 'mismatched frames', 'reused timber frames', 'thin metal frames'];
  const ENTRY_LIGHTS = ['warm hood light', 'small globe light', 'reused enamel lamp', 'soft strip light', 'no permanent light'];
  const ACCENT_COLORS = ['#6f8f72', '#b76d55', '#415a77', '#c6a94b', '#76526f', '#6ca7a1', '#8f4a42', '#ad7b4f'];
  const CHANGE_COSTS = {
    door_color: 34,
    window_boxes: 48,
    frame_style: 65,
    entry_light: 42,
    sign_text: 28,
    facade_accent: 75
  };

  // One explicit shared shell proves real multi-storey continuity without
  // rewriting the earlier place identities or inventing a giant city model.
  const GROUP_DEFINITIONS = [
    {
      id: 'building_courtyard_walkup',
      name: 'Courtyard Walk-up',
      type: 'two_storey_apartment',
      placeIds: ['home_courtyard_1', 'home_courtyard_2'],
      assignments: [
        { level: 0, label: 'Ground floor', placeIds: ['home_courtyard_1'] },
        { level: 1, label: 'Upper floor', placeIds: ['home_courtyard_2'] }
      ]
    }
  ];

  function ensureShellRng(world) {
    if (!Number.isInteger(world.shellRngState)) {
      world.shellRngState = Core.hashString(`${world.seed || 'AXM'}|building-shells-v0.10`) || 1;
    }
    return world.shellRngState;
  }

  function nextShellRandom(world) {
    ensureShellRng(world);
    world.shellRngState = (Math.imul(1664525, world.shellRngState >>> 0) + 1013904223) >>> 0;
    return world.shellRngState / 4294967296;
  }

  function shellChance(world, probability) {
    return nextShellRandom(world) < Core.clamp(probability, 0, 1);
  }

  function shellRandomInt(world, min, maxInclusive) {
    const low = Math.ceil(min);
    const high = Math.floor(maxInclusive);
    return low + Math.floor(nextShellRandom(world) * (high - low + 1));
  }

  function shellChoice(world, values) {
    if (!Array.isArray(values) || !values.length) return undefined;
    return values[shellRandomInt(world, 0, values.length - 1)];
  }

  function shellUniqueId(world, prefix) {
    return Core.issueIdentity(world, 'shell', prefix);
  }

  function stamp(world) {
    return { day: world.time.day, hour: world.time.hour, minute: world.time.minute || 0 };
  }

  function appendHistory(world, target, type, message, details = {}) {
    if (!Array.isArray(target.history)) target.history = [];
    const entry = {
      id: shellUniqueId(world, 'shell_event'),
      ...stamp(world),
      type,
      message,
      actorIds: Array.isArray(details.actorIds) ? details.actorIds.slice() : [],
      causes: Array.isArray(details.causes) ? details.causes.slice() : [],
      evidence: details.evidence || null
    };
    target.history.push(entry);
    if (target.history.length > 260) target.history.splice(0, target.history.length - 260);
    return entry;
  }

  function buildingById(world, buildingId) {
    return (world.buildings || []).find((entry) => entry.id === buildingId) || null;
  }

  function buildingForPlace(world, placeId) {
    const place = World.getPlace(world, placeId);
    if (place?.shellRef?.buildingId) return buildingById(world, place.shellRef.buildingId);
    return (world.buildings || []).find((entry) => entry.placeIds.includes(placeId)) || null;
  }

  function frontageForPlace(world, placeId) {
    const building = buildingForPlace(world, placeId);
    return building?.frontages?.find((entry) => entry.placeId === placeId) || null;
  }

  function proposalById(world, proposalId) {
    return (world.frontageProposals || []).find((entry) => entry.id === proposalId) || null;
  }

  function projectById(world, projectId) {
    return (world.frontageProjects || []).find((entry) => entry.id === projectId) || null;
  }

  function shellTypeForPlace(place) {
    if (place.kind === 'commercial') return 'street_shop';
    if (place.kind === 'residential') {
      if (place.type === 'house') return 'small_house';
      if (place.type === 'student_house') return 'shared_house';
      if (place.type === 'apartment') return 'apartment_shell';
      return 'studio_shell';
    }
    if (place.type === 'park') return 'open_landscape_edge';
    if (place.type === 'public') return 'public_edge';
    if (place.type === 'learning') return 'community_building';
    if (place.type === 'shop') return 'market_building';
    return 'workplace_shell';
  }

  function derivedAssignments(place) {
    if (place.id === 'home_rooftop' || place.id === 'home_bakery_flat') {
      return [
        { level: 0, label: 'Shared street level', placeIds: [] },
        { level: 1, label: 'Upper floor', placeIds: [place.id] }
      ];
    }
    if (place.id === 'home_student') {
      return [
        { level: 0, label: 'Ground floor', placeIds: [place.id] },
        { level: 1, label: 'Upper rooms', placeIds: [place.id] }
      ];
    }
    return [{ level: 0, label: 'Ground floor', placeIds: [place.id] }];
  }

  function footprintForPlaces(places) {
    const minX = Math.min(...places.map((place) => Number(place.x) || 0));
    const minY = Math.min(...places.map((place) => Number(place.y) || 0));
    const maxX = Math.max(...places.map((place) => (Number(place.x) || 0) + (Number(place.w) || 1)));
    const maxY = Math.max(...places.map((place) => (Number(place.y) || 0) + (Number(place.h) || 1)));
    return { x: minX, y: minY, w: Core.round(maxX - minX, 3), h: Core.round(maxY - minY, 3) };
  }

  function edgeForSide(storey, side) {
    return storey.wallGraph.edges.find((edge) => edge.side === side) || null;
  }

  function makeStorey(world, buildingId, assignment, footprint, places, frontSide) {
    const level = assignment.level;
    const widthMeters = Math.max(4, Core.round(footprint.w * 4, 1));
    const depthMeters = Math.max(4, Core.round(footprint.h * 4, 1));
    const z = level * 3.1;
    const prefix = `${buildingId}_s${level}`;
    const nodes = [
      { id: `${prefix}_nw`, x: 0, y: 0, z },
      { id: `${prefix}_ne`, x: widthMeters, y: 0, z },
      { id: `${prefix}_se`, x: widthMeters, y: depthMeters, z },
      { id: `${prefix}_sw`, x: 0, y: depthMeters, z }
    ];
    const edges = [
      { id: `${prefix}_north`, from: nodes[0].id, to: nodes[1].id, side: 'north', lengthMeters: widthMeters, kind: 'exterior_wall', openingIds: [] },
      { id: `${prefix}_east`, from: nodes[1].id, to: nodes[2].id, side: 'east', lengthMeters: depthMeters, kind: 'exterior_wall', openingIds: [] },
      { id: `${prefix}_south`, from: nodes[2].id, to: nodes[3].id, side: 'south', lengthMeters: widthMeters, kind: 'exterior_wall', openingIds: [] },
      { id: `${prefix}_west`, from: nodes[3].id, to: nodes[0].id, side: 'west', lengthMeters: depthMeters, kind: 'exterior_wall', openingIds: [] }
    ];
    const storey = {
      id: `${prefix}_storey`,
      level,
      label: assignment.label || (level === 0 ? 'Ground floor' : `Storey ${level + 1}`),
      heightMeters: 3.1,
      placeIds: assignment.placeIds.slice(),
      wallGraph: { nodes, edges },
      openings: [],
      routeNodeIds: [],
      source: { kind: 'deterministic_shell_derivation', seed: world.seed }
    };

    const assignedPlaces = places.filter((place) => assignment.placeIds.includes(place.id));
    const desiredWindows = Math.max(1, assignedPlaces.reduce((sum, place) => sum + Core.safeNumber(place.exterior?.facade?.windowCount, 1), 0));
    const sides = [frontSide, frontSide === 'north' ? 'south' : 'north', 'east', 'west'];
    for (let index = 0; index < Math.min(12, desiredWindows); index += 1) {
      const side = sides[index % sides.length];
      const edge = edges.find((entry) => entry.side === side);
      const opening = {
        id: `${prefix}_window_${String(index + 1).padStart(2, '0')}`,
        type: 'window',
        wallEdgeId: edge.id,
        offsetRatio: Core.round(0.18 + ((index * 0.23) % 0.64), 3),
        widthMeters: 1.15,
        heightMeters: 1.35,
        sillMeters: level === 0 ? 0.9 : 0.85,
        sourcePlaceIds: assignedPlaces.map((place) => place.id)
      };
      storey.openings.push(opening);
      edge.openingIds.push(opening.id);
    }

    if (level === 0) {
      const edge = edges.find((entry) => entry.side === frontSide) || edges[0];
      const opening = {
        id: `${prefix}_street_door`,
        type: 'external_door',
        wallEdgeId: edge.id,
        offsetRatio: 0.5,
        widthMeters: 1.05,
        heightMeters: 2.1,
        access: assignedPlaces[0]?.exterior?.entrance?.access || 'level threshold'
      };
      storey.openings.push(opening);
      edge.openingIds.push(opening.id);
    }
    return storey;
  }

  function createRouteNetwork(world, building, assignments, places) {
    const nodes = [];
    const edges = [];
    const addNode = (node) => { nodes.push(node); return node; };
    const addEdge = (from, to, kind, minutes, details = {}) => {
      const edge = {
        id: `${building.id}_route_${String(edges.length + 1).padStart(3, '0')}`,
        from, to, kind, minutes,
        ...details
      };
      edges.push(edge);
      return edge;
    };

    const groundLanding = addNode({ id: `${building.id}_landing_0`, kind: 'landing', level: 0, label: 'Ground landing' });
    building.externalAccessNodeIds = [];
    places.forEach((place, index) => {
      const node = addNode({
        id: `${building.id}_street_access_${index + 1}`,
        kind: 'street_access',
        level: 0,
        placeId: place.id,
        exteriorDoorNodeId: place.exterior?.entrance?.doorNodeId || null,
        label: place.exterior?.address?.label || place.name
      });
      building.externalAccessNodeIds.push(node.id);
      addEdge(node.id, groundLanding.id, 'entry_passage', 0, { placeId: place.id });
    });

    const landingByLevel = new Map([[0, groundLanding]]);
    assignments.forEach((assignment) => {
      if (assignment.level === 0) return;
      const landing = addNode({ id: `${building.id}_landing_${assignment.level}`, kind: 'landing', level: assignment.level, label: assignment.label });
      landingByLevel.set(assignment.level, landing);
    });
    const sortedLevels = Array.from(landingByLevel.keys()).sort((a, b) => a - b);
    for (let index = 1; index < sortedLevels.length; index += 1) {
      const fromLevel = sortedLevels[index - 1];
      const toLevel = sortedLevels[index];
      addEdge(landingByLevel.get(fromLevel).id, landingByLevel.get(toLevel).id, 'stairs', 1, {
        fromLevel,
        toLevel,
        accessibleAlternative: false,
        note: 'Current low-graphic prototype stair; lifts and fuller accessibility remain future work.'
      });
    }

    const placePrimaryStorey = new Map();
    assignments.forEach((assignment) => {
      assignment.placeIds.forEach((placeId) => {
        if (!placePrimaryStorey.has(placeId)) placePrimaryStorey.set(placeId, assignment.level);
      });
    });
    places.forEach((place) => {
      const level = placePrimaryStorey.get(place.id) || 0;
      const landing = landingByLevel.get(level) || groundLanding;
      const unit = addNode({ id: `${building.id}_unit_${place.id}`, kind: 'place_entry', level, placeId: place.id, label: place.name });
      addEdge(landing.id, unit.id, 'unit_entry', 0, { placeId: place.id });
      const storeyIds = assignments.filter((entry) => entry.placeIds.includes(place.id)).map((entry) => `${building.id}_s${entry.level}_storey`);
      place.shellRef = {
        buildingId: building.id,
        primaryStoreyId: `${building.id}_s${level}_storey`,
        storeyIds,
        unitRouteNodeId: unit.id,
        streetAccessNodeId: building.externalAccessNodeIds[places.indexOf(place)]
      };
    });

    return { nodes, edges };
  }

  function createFrontage(world, building, place) {
    return {
      id: `${building.id}_frontage_${place.id}`,
      placeId: place.id,
      doorColor: place.exterior?.entrance?.doorColor || '#6e8d74',
      frameStyle: place.exterior?.facade?.windowStyle || 'simple casement',
      windowBoxes: false,
      entryLight: 'warm hood light',
      signText: place.exterior?.facade?.signText || place.name,
      accentColor: place.color || '#6f8f72',
      authoredBy: 'deterministic_foundation',
      revision: 1,
      history: []
    };
  }

  function createBuilding(world, definition, places) {
    const footprint = footprintForPlaces(places);
    const primary = places[0];
    const assignments = definition.assignments || derivedAssignments(primary);
    const frontSide = primary.exterior?.entrance?.side || 'south';
    const building = {
      schema: BUILDING_SCHEMA,
      id: definition.id,
      name: definition.name,
      type: definition.type,
      placeIds: places.map((place) => place.id),
      footprint,
      frontSide,
      storeys: [],
      verticalLinks: [],
      routeNetwork: { nodes: [], edges: [] },
      externalAccessNodeIds: [],
      frontages: [],
      roof: {
        style: primary.exterior?.facade?.roofline || 'shallow pitch',
        material: shellChoice(world, ['reused slate', 'patched tile', 'standing seam metal', 'flat planted edge']),
        condition: 76 + (Core.hashString(`${world.seed}|${definition.id}|roof`) % 21),
        maintenanceObligation: false,
        source: { kind: 'deterministic_shell_derivation', seed: world.seed }
      },
      interiorContinuity: [],
      revision: 1,
      history: []
    };
    building.storeys = assignments.map((assignment) => makeStorey(world, building.id, assignment, footprint, places, frontSide));
    building.routeNetwork = createRouteNetwork(world, building, assignments, places);
    building.verticalLinks = building.routeNetwork.edges.filter((edge) => edge.kind === 'stairs').map((edge) => ({
      id: `${edge.id}_link`, type: 'stairs', fromNodeId: edge.from, toNodeId: edge.to,
      fromLevel: edge.fromLevel, toLevel: edge.toLevel, routeMinutes: edge.minutes,
      accessibleAlternative: edge.accessibleAlternative
    }));
    building.frontages = places.map((place) => createFrontage(world, building, place));
    building.interiorContinuity = places.map((place) => ({
      placeId: place.id,
      primaryStoreyId: place.shellRef.primaryStoreyId,
      unitRouteNodeId: place.shellRef.unitRouteNodeId,
      streetAccessNodeId: place.shellRef.streetAccessNodeId,
      exteriorDoorNodeId: place.exterior?.entrance?.doorNodeId || null,
      habitatEntryRoomId: place.kind === 'residential' ? (place.habitat?.rooms?.[0]?.id || null) : null,
      status: 'connected',
      source: {
        exteriorSchema: place.exterior?.schema || null,
        habitatSchema: place.habitat?.schema || null,
        note: 'v0.10 links current exterior and interior state; it does not fabricate past routes or construction.'
      }
    }));
    appendHistory(world, building, 'foundation', `${building.name} received a deterministic exterior shell with real storeys, wall edges, openings, and internal routes.`, {
      causes: ['v0.10 present-day shell derivation'],
      evidence: { placeIds: building.placeIds, storeys: building.storeys.length, windows: building.storeys.flatMap((entry) => entry.openings).filter((entry) => entry.type === 'window').length }
    });
    return building;
  }

  function deriveBuildings(world) {
    const claimed = new Set();
    const buildings = [];
    GROUP_DEFINITIONS.forEach((definition) => {
      const places = definition.placeIds.map((id) => World.getPlace(world, id)).filter(Boolean);
      if (places.length !== definition.placeIds.length) return;
      places.forEach((place) => claimed.add(place.id));
      buildings.push(createBuilding(world, definition, places));
    });
    (world.places || []).forEach((place) => {
      if (claimed.has(place.id)) return;
      const id = `building_${place.id}`;
      buildings.push(createBuilding(world, {
        id,
        name: `${place.name} shell`,
        type: shellTypeForPlace(place),
        assignments: derivedAssignments(place)
      }, [place]));
      claimed.add(place.id);
    });
    return buildings;
  }

  function ensureState(world) {
    if (!Array.isArray(world.buildings)) world.buildings = [];
    if (!Array.isArray(world.frontageProposals)) world.frontageProposals = [];
    if (!Array.isArray(world.frontageProjects)) world.frontageProjects = [];
    if (!world.shellState || typeof world.shellState !== 'object') world.shellState = {};
    if (!Number.isInteger(world.shellIdCounter) || world.shellIdCounter < 0) world.shellIdCounter = 0;
    ensureShellRng(world);
    if (!world.settings || typeof world.settings !== 'object') world.settings = {};
    world.settings.facadeMaintenanceObligation = false;
    world.settings.frontageDailyDecay = false;
    world.settings.exteriorOptimizationScore = false;
    if (!world.ui || typeof world.ui !== 'object') world.ui = {};
    if (world.ui.selectedBuildingId === undefined) world.ui.selectedBuildingId = null;
    if (world.ui.selectedFrontageProposalId === undefined) world.ui.selectedFrontageProposalId = null;
    if (!world.flags || typeof world.flags !== 'object') world.flags = {};
    if (world.flags.shellFoundationLogged === undefined) world.flags.shellFoundationLogged = false;
    if (world.flags.shellExperimentPrepared === undefined) world.flags.shellExperimentPrepared = false;
    if (!world.metrics || typeof world.metrics !== 'object') world.metrics = {};
    [
      'buildingShellsCreated', 'frontageProposalsCreated', 'frontageProposalsApproved', 'frontageProposalsDeclined',
      'frontageProjectsCreated', 'frontageProjectsCompleted', 'frontageProjectsFailed', 'frontageProjectPhases',
      'frontageResidentSavings', 'shellExperimentRuns'
    ].forEach((key) => {
      if (!Number.isFinite(world.metrics[key])) world.metrics[key] = 0;
    });
    [world.player].concat(world.people || []).forEach((person) => {
      if (!person) return;
      if (!Number.isFinite(person.frontageProposalCooldownUntil)) person.frontageProposalCooldownUntil = 0;
    });
    return world;
  }

  function initializeWorld(world, options = {}) {
    ensureState(world);
    const validCurrent = world.buildings.length > 0
      && world.buildings.every((entry) => entry.schema === BUILDING_SCHEMA)
      && world.places.every((place) => place.shellRef?.buildingId && buildingById(world, place.shellRef.buildingId));
    if (!validCurrent) {
      // Preserve proposal/project history only when it already belongs to this schema.
      world.frontageProposals = world.frontageProposals.filter((entry) => entry.schema === FRONTAGE_PROPOSAL_SCHEMA);
      world.frontageProjects = world.frontageProjects.filter((entry) => entry.schema === FRONTAGE_PROJECT_SCHEMA);
      world.buildings = deriveBuildings(world);
      world.metrics.buildingShellsCreated = world.buildings.length;
      world.ui.selectedBuildingId = world.ui.selectedBuildingId && buildingById(world, world.ui.selectedBuildingId)
        ? world.ui.selectedBuildingId
        : (buildingForPlace(world, world.player?.homePropertyId)?.id || world.buildings[0]?.id || null);
    } else {
      // Reconnect current place pointers without changing authored shell state.
      world.buildings.forEach((building) => {
        building.placeIds.forEach((placeId) => {
          const place = World.getPlace(world, placeId);
          const continuity = building.interiorContinuity.find((entry) => entry.placeId === placeId);
          if (place && continuity) {
            place.shellRef = {
              buildingId: building.id,
              primaryStoreyId: continuity.primaryStoreyId,
              storeyIds: building.storeys.filter((entry) => entry.placeIds.includes(placeId)).map((entry) => entry.id),
              unitRouteNodeId: continuity.unitRouteNodeId,
              streetAccessNodeId: continuity.streetAccessNodeId
            };
          }
        });
      });
    }
    if (!options.silent && !world.flags.shellFoundationLogged) {
      Core.appendLedger(world, 'foundation', 'Building shells now connect street identity to real wall graphs, storeys, openings, stairs, and current interiors. Frontage changes require exact proposals, authority, funding, phases, and validation rather than instant owner control.', {
        causes: ['v0.10 building shell foundation', 'resident autonomy', 'no façade chores'],
        evidence: metrics(world)
      });
      world.flags.shellFoundationLogged = true;
    }
    return world;
  }

  function routeNodesForBuilding(building) {
    return new Map((building?.routeNetwork?.nodes || []).map((entry) => [entry.id, entry]));
  }

  function routeEdgesForBuilding(building) {
    return building?.routeNetwork?.edges || [];
  }

  function routeWithinBuilding(world, buildingId, fromNodeId, toNodeId) {
    const building = buildingById(world, buildingId);
    if (!building) return null;
    const nodes = routeNodesForBuilding(building);
    if (!nodes.has(fromNodeId) || !nodes.has(toNodeId)) return null;
    const adjacency = new Map();
    nodes.forEach((_, id) => adjacency.set(id, []));
    routeEdgesForBuilding(building).forEach((edge) => {
      adjacency.get(edge.from)?.push({ nodeId: edge.to, edge });
      adjacency.get(edge.to)?.push({ nodeId: edge.from, edge });
    });
    const queue = [fromNodeId];
    const previous = new Map([[fromNodeId, null]]);
    while (queue.length) {
      const current = queue.shift();
      if (current === toNodeId) break;
      (adjacency.get(current) || []).forEach(({ nodeId, edge }) => {
        if (previous.has(nodeId)) return;
        previous.set(nodeId, { nodeId: current, edge });
        queue.push(nodeId);
      });
    }
    if (!previous.has(toNodeId)) return null;
    const nodeIds = [];
    const edgeIds = [];
    let cursor = toNodeId;
    while (cursor) {
      nodeIds.push(cursor);
      const step = previous.get(cursor);
      if (!step) break;
      edgeIds.push(step.edge.id);
      cursor = step.nodeId;
    }
    nodeIds.reverse();
    edgeIds.reverse();
    const minutes = edgeIds.reduce((sum, edgeId) => sum + (building.routeNetwork.edges.find((entry) => entry.id === edgeId)?.minutes || 0), 0);
    return { buildingId, fromNodeId, toNodeId, nodeIds, edgeIds, minutes };
  }

  function routeFromStreetToPlace(world, placeId) {
    const place = World.getPlace(world, placeId);
    const building = buildingForPlace(world, placeId);
    if (!place || !building) return null;
    const ref = place.shellRef;
    return routeWithinBuilding(world, building.id, ref.streetAccessNodeId, ref.unitRouteNodeId);
  }

  function eligibleAuthorForPlace(world, place) {
    if (!place) return null;
    if (place.kind === 'residential') {
      const candidates = (place.tenants || []).map((id) => World.getPerson(world, id)).filter((person) => person && person.id !== 'player' && !AXM.Family?.isDependent(person));
      if (!candidates.length && (place.tenants || []).includes('player')) return world.player;
      return candidates.sort((a, b) => (Core.safeNumber(b.traits?.creativity, 0) + Core.safeNumber(b.traits?.independence, 0)) - (Core.safeNumber(a.traits?.creativity, 0) + Core.safeNumber(a.traits?.independence, 0)))[0] || null;
    }
    if (place.kind === 'commercial' && place.occupantEnterpriseId) {
      const enterprise = AXM.Economy?.enterpriseById(world, place.occupantEnterpriseId);
      return enterprise ? World.getPerson(world, enterprise.ownerId) : null;
    }
    return null;
  }

  function actorCanAuthor(world, place, actorId) {
    if (!place || !actorId) return false;
    if (place.kind === 'residential') {
      const occupied = (place.tenants || []).length > 0;
      if ((place.tenants || []).includes(actorId)) return true;
      if (!occupied && place.ownerId === actorId) return true;
      return false;
    }
    if (place.kind === 'commercial') {
      const enterprise = place.occupantEnterpriseId ? AXM.Economy?.enterpriseById(world, place.occupantEnterpriseId) : null;
      return Boolean(enterprise && enterprise.ownerId === actorId);
    }
    return false;
  }

  function chooseChange(world, place, actor, requestedType = null, requestedValue = undefined) {
    const frontage = frontageForPlace(world, place.id);
    const allowed = CHANGE_TYPES.filter((type) => place.kind === 'commercial' || type !== 'sign_text');
    const type = allowed.includes(requestedType) ? requestedType : shellChoice(world, allowed);
    let after;
    if (requestedValue !== undefined && requestedValue !== null && requestedValue !== '') {
      after = requestedValue;
    } else if (type === 'door_color') {
      const preferred = (actor.preferences?.preferredColors || []).map((id) => Content.paletteById(id).hex);
      after = preferred.find((hex) => hex !== frontage.doorColor) || ACCENT_COLORS.find((hex) => hex !== frontage.doorColor) || '#6f8f72';
    } else if (type === 'window_boxes') {
      after = !frontage.windowBoxes;
    } else if (type === 'frame_style') {
      after = FRAME_STYLES.find((entry) => entry !== frontage.frameStyle) || 'simple casement';
    } else if (type === 'entry_light') {
      after = ENTRY_LIGHTS.find((entry) => entry !== frontage.entryLight) || 'warm hood light';
    } else if (type === 'sign_text') {
      after = `${place.name.replace(/\b(Vacant|Old|Small)\b/g, '').trim()} · made locally`.slice(0, 56);
    } else {
      after = ACCENT_COLORS.find((hex) => hex !== frontage.accentColor) || '#6f8f72';
    }
    const before = {
      door_color: frontage.doorColor,
      window_boxes: frontage.windowBoxes,
      frame_style: frontage.frameStyle,
      entry_light: frontage.entryLight,
      sign_text: frontage.signText,
      facade_accent: frontage.accentColor
    }[type];
    return {
      type,
      before,
      after,
      description: `${Core.titleCase(type)}: ${String(before)} → ${String(after)}`
    };
  }

  function openProposalForPlace(world, placeId) {
    return (world.frontageProposals || []).find((entry) => entry.placeId === placeId && ['pending_owner', 'awaiting_player', 'approved', 'project_created'].includes(entry.status)) || null;
  }

  function openProjectForPlace(world, placeId) {
    return (world.frontageProjects || []).find((entry) => entry.placeId === placeId && ['saving', 'planned', 'active'].includes(entry.status)) || null;
  }

  function createFrontageProposal(world, placeId, authorId, requestedType = null, requestedValue = undefined, options = {}) {
    ensureState(world);
    const place = World.getPlace(world, placeId);
    const building = buildingForPlace(world, placeId);
    const actor = World.getPerson(world, authorId);
    if (!place || !building || !actor) return { ok: false, reason: 'The place, building shell, or author is unavailable.' };
    if (!actorCanAuthor(world, place, authorId)) return { ok: false, reason: 'A person may author a frontage idea only for a place they actually occupy or a vacant place they own.' };
    if (openProposalForPlace(world, placeId) || openProjectForPlace(world, placeId)) return { ok: false, reason: 'That frontage already has an open proposal or project.' };
    const change = chooseChange(world, place, actor, requestedType, requestedValue);
    if (change.before === change.after) return { ok: false, reason: 'The proposed frontage state is already present.' };
    const ownerId = place.ownerId || null;
    let status = 'pending_owner';
    let decisionMode = 'external_policy';
    if (ownerId === 'player' && authorId !== 'player') {
      status = 'awaiting_player';
      decisionMode = 'player_owner_response';
    } else if (ownerId === authorId) {
      status = 'approved';
      decisionMode = 'author_is_owner';
    }
    const proposal = {
      schema: FRONTAGE_PROPOSAL_SCHEMA,
      id: shellUniqueId(world, 'frontage_proposal'),
      buildingId: building.id,
      placeId,
      authorId,
      createdAt: stamp(world),
      decisionDueDay: world.time.day + (options.decisionDelayDays || shellRandomInt(world, 1, 3)),
      status,
      change,
      authority: {
        ownerId,
        decisionMode,
        decision: status === 'approved' ? 'approved' : null,
        decidedAt: status === 'approved' ? stamp(world) : null,
        reason: status === 'approved' ? 'The author also holds the relevant property authority.' : null
      },
      finance: {
        totalCost: CHANGE_COSTS[change.type] || 50,
        authorEscrow: 0,
        ownerContribution: 0,
        refunded: 0
      },
      noRelationshipPenalty: true,
      projectId: null,
      history: []
    };
    world.frontageProposals.push(proposal);
    actor.frontageProposalCooldownUntil = world.time.day + 24;
    world.metrics.frontageProposalsCreated += 1;
    appendHistory(world, proposal, 'created', `${actor.name} proposed ${change.description.toLowerCase()} for ${place.name}.`, {
      actorIds: [authorId], causes: options.causes || ['resident-authored frontage intention'], evidence: { status, ownerId }
    });
    Core.appendLedger(world, 'building_shell', `${actor.name} formed an exact frontage proposal for ${place.name}. No façade changed and no money moved yet.`, {
      actorIds: [authorId], placeId, causes: ['proposal is not permission', 'proposal is not construction'], evidence: { proposalId: proposal.id, change }
    });
    if (status === 'approved') approveProposal(world, proposal, 'author_is_owner');
    return { ok: true, proposal };
  }

  function createProjectFromProposal(world, proposal) {
    if (proposal.projectId) return projectById(world, proposal.projectId);
    const actor = World.getPerson(world, proposal.authorId);
    if (!actor) return null;
    const total = proposal.finance.totalCost;
    const available = Math.max(0, Core.safeNumber(actor.money, 0));
    const initial = Math.min(total, Math.max(0, Math.floor(Math.min(available, Math.max(8, total * 0.45)))));
    actor.money = Core.round(actor.money - initial, 2);
    proposal.finance.authorEscrow = Core.round(initial, 2);
    const project = {
      schema: FRONTAGE_PROJECT_SCHEMA,
      id: shellUniqueId(world, 'frontage_project'),
      proposalId: proposal.id,
      buildingId: proposal.buildingId,
      placeId: proposal.placeId,
      actorId: proposal.authorId,
      status: initial >= total ? 'planned' : 'saving',
      requiredMoney: total,
      escrow: initial,
      spent: 0,
      phases: [
        { id: 'confirm_design', label: 'Confirm the exact design', status: 'pending', costShare: 0 },
        { id: 'gather_materials', label: 'Gather the stated materials', status: 'pending', costShare: 0.65 },
        { id: 'install_and_check', label: 'Install and verify the frontage', status: 'pending', costShare: 0.35 }
      ],
      completedPhaseIds: [],
      createdAt: stamp(world),
      completedAt: null,
      failureReason: null,
      history: []
    };
    world.frontageProjects.push(project);
    proposal.projectId = project.id;
    proposal.status = 'project_created';
    world.metrics.frontageProjectsCreated += 1;
    appendHistory(world, project, 'created', `A phased project was created from ${proposal.id}; approval did not instantly alter the building.`, {
      actorIds: [proposal.authorId], causes: ['accepted exact proposal'], evidence: { initialEscrow: initial, requiredMoney: total }
    });
    return project;
  }

  function approveProposal(world, proposal, reason = 'approved') {
    if (!proposal || !['pending_owner', 'awaiting_player', 'approved'].includes(proposal.status)) return { ok: false, reason: 'That proposal cannot be approved from its current state.' };
    proposal.status = 'approved';
    proposal.authority.decision = 'approved';
    proposal.authority.decidedAt = stamp(world);
    proposal.authority.reason = reason;
    world.metrics.frontageProposalsApproved += 1;
    appendHistory(world, proposal, 'approved', `The exact frontage request was approved: ${reason}.`, {
      actorIds: [proposal.authorId], causes: ['specific project authority only']
    });
    const project = createProjectFromProposal(world, proposal);
    if (!project) {
      proposal.status = 'failed';
      return { ok: false, reason: 'The approved proposal could not create a project.' };
    }
    return { ok: true, proposal, project };
  }

  function declineProposal(world, proposal, reason = 'declined') {
    if (!proposal || !['pending_owner', 'awaiting_player'].includes(proposal.status)) return { ok: false, reason: 'That proposal cannot be declined from its current state.' };
    proposal.status = 'declined';
    proposal.authority.decision = 'declined';
    proposal.authority.decidedAt = stamp(world);
    proposal.authority.reason = reason;
    world.metrics.frontageProposalsDeclined += 1;
    appendHistory(world, proposal, 'declined', `The frontage request was declined: ${reason}.`, {
      actorIds: [proposal.authorId], causes: ['refusal is a valid outcome', 'no hidden relationship penalty']
    });
    Core.appendLedger(world, 'building_shell', `The frontage proposal for ${World.getPlace(world, proposal.placeId)?.name || proposal.placeId} was declined without changing the façade or silently punishing the relationship.`, {
      actorIds: [proposal.authorId], placeId: proposal.placeId, causes: ['bounded authority', 'refusal preserved'], evidence: { proposalId: proposal.id }
    });
    return { ok: true, proposal };
  }

  function respondToFrontageProposal(world, proposalId, response) {
    ensureState(world);
    const proposal = proposalById(world, proposalId);
    if (!proposal) return { ok: false, reason: 'Frontage proposal not found.' };
    if (proposal.status !== 'awaiting_player' || proposal.authority.ownerId !== 'player') return { ok: false, reason: 'This proposal is not awaiting the player as property owner.' };
    if (response === 'approve') return approveProposal(world, proposal, 'player approved the exact resident-authored request');
    if (response === 'decline') return declineProposal(world, proposal, 'player declined the exact request');
    return { ok: false, reason: 'Response must be approve or decline.' };
  }

  function externalOwnerDecision(world, proposal) {
    const base = {
      entry_light: 0.82,
      door_color: 0.72,
      window_boxes: 0.68,
      sign_text: 0.64,
      frame_style: 0.56,
      facade_accent: 0.48
    }[proposal.change.type] || 0.55;
    const place = World.getPlace(world, proposal.placeId);
    const affordability = proposal.finance.totalCost <= 50 ? 0.08 : proposal.finance.totalCost > 70 ? -0.08 : 0;
    const condition = Core.safeNumber(place?.condition, 80) < 65 ? 0.04 : 0;
    return shellChance(world, base + affordability + condition);
  }

  function saveTowardProject(world, project) {
    const actor = World.getPerson(world, project.actorId);
    if (!actor) return { ok: false, reason: 'Project author no longer exists.' };
    const shortfall = Core.round(project.requiredMoney - project.escrow, 2);
    if (shortfall <= 0) {
      project.status = 'planned';
      return { ok: true, saved: 0 };
    }
    const available = Math.max(0, Core.safeNumber(actor.money, 0));
    if (available <= 4) return { ok: true, saved: 0 };
    const amount = Core.round(Math.min(shortfall, Math.max(3, Math.min(18, available * 0.035))), 2);
    actor.money = Core.round(actor.money - amount, 2);
    project.escrow = Core.round(project.escrow + amount, 2);
    const proposal = proposalById(world, project.proposalId);
    if (proposal) proposal.finance.authorEscrow = project.escrow;
    world.metrics.frontageResidentSavings = Core.round(world.metrics.frontageResidentSavings + amount, 2);
    appendHistory(world, project, 'saving', `${actor.name} placed ${Core.formatMoney(amount)} into the exact frontage project escrow.`, {
      actorIds: [actor.id], causes: ['resident-funded optional project'], evidence: { escrow: project.escrow, required: project.requiredMoney }
    });
    if (project.escrow >= project.requiredMoney) project.status = 'planned';
    return { ok: true, saved: amount };
  }

  function applyFrontageChange(world, project) {
    const proposal = proposalById(world, project.proposalId);
    const place = World.getPlace(world, project.placeId);
    const building = buildingById(world, project.buildingId);
    const frontage = building?.frontages?.find((entry) => entry.placeId === project.placeId);
    if (!proposal || !place || !building || !frontage) throw new Error('The approved frontage target no longer exists.');
    const snapshot = {
      frontage: Core.deepClone(frontage),
      exterior: Core.deepClone(place.exterior),
      buildingRevision: building.revision
    };
    const { type, after } = proposal.change;
    if (type === 'door_color') {
      frontage.doorColor = String(after);
      place.exterior.entrance.doorColor = String(after);
    } else if (type === 'window_boxes') {
      frontage.windowBoxes = Boolean(after);
    } else if (type === 'frame_style') {
      frontage.frameStyle = String(after);
      place.exterior.facade.windowStyle = String(after);
    } else if (type === 'entry_light') {
      frontage.entryLight = String(after);
    } else if (type === 'sign_text') {
      const clean = String(after).trim().slice(0, 60);
      if (!clean) throw new Error('A sign cannot become an empty hidden rewrite.');
      frontage.signText = clean;
      place.exterior.facade.signText = clean;
    } else if (type === 'facade_accent') {
      frontage.accentColor = String(after);
    } else {
      throw new Error('Unknown frontage change type.');
    }
    frontage.revision += 1;
    frontage.authoredBy = project.actorId;
    building.revision += 1;
    appendHistory(world, frontage, 'changed', `${World.getPerson(world, project.actorId)?.name || project.actorId} completed ${proposal.change.description.toLowerCase()}.`, {
      actorIds: [project.actorId], causes: ['approved funded phased project'], evidence: { proposalId: proposal.id, projectId: project.id }
    });
    const errors = [];
    validateBuilding(world, building, (message) => errors.push(message));
    if (errors.length) {
      Object.keys(frontage).forEach((key) => { delete frontage[key]; });
      Object.assign(frontage, snapshot.frontage);
      place.exterior = snapshot.exterior;
      building.revision = snapshot.buildingRevision;
      throw new Error(`Frontage validation failed and was rolled back: ${errors[0]}`);
    }
    return { proposal, place, building, frontage };
  }

  function advanceFrontageProject(world, projectId, options = {}) {
    ensureState(world);
    const project = projectById(world, projectId);
    if (!project) return { ok: false, reason: 'Frontage project not found.' };
    if (!['saving', 'planned', 'active'].includes(project.status)) return { ok: false, reason: 'That frontage project is not active.' };
    if (project.status === 'saving') {
      const saved = saveTowardProject(world, project);
      if (!saved.ok) return saved;
      if (project.status === 'saving') return { ok: true, project, saved: saved.saved, phaseCompleted: null };
    }
    if (project.status === 'planned') project.status = 'active';
    const phase = project.phases.find((entry) => entry.status === 'pending');
    if (!phase) return { ok: false, reason: 'No incomplete phase remains.' };
    phase.status = 'completed';
    phase.completedAt = stamp(world);
    project.completedPhaseIds.push(phase.id);
    const phaseCost = phase.id === 'confirm_design' ? 0 : Core.round(project.requiredMoney * phase.costShare, 2);
    project.spent = Core.round(Math.min(project.escrow, project.spent + phaseCost), 2);
    world.metrics.frontageProjectPhases += 1;
    appendHistory(world, project, 'phase_completed', `${phase.label} was completed by ${World.getPerson(world, project.actorId)?.name || project.actorId}.`, {
      actorIds: [project.actorId], causes: options.causes || ['resident phased frontage work'], evidence: { phaseId: phase.id, spent: project.spent }
    });
    if (project.completedPhaseIds.length === project.phases.length) {
      try {
        const applied = applyFrontageChange(world, project);
        project.status = 'completed';
        project.completedAt = stamp(world);
        project.spent = project.requiredMoney;
        const proposal = proposalById(world, project.proposalId);
        if (proposal) proposal.status = 'completed';
        world.metrics.frontageProjectsCompleted += 1;
        appendHistory(world, project, 'completed', `${applied.place.name} kept its identity while the exact approved frontage change became part of its history.`, {
          actorIds: [project.actorId], causes: ['all phases completed', 'post-change validation passed']
        });
        Core.appendPropertyHistory?.(world, applied.place, 'frontage_change', `${applied.place.name} received a resident-authored frontage change through ${project.id}.`, {
          actorIds: [project.actorId], causes: ['approved exact proposal', 'resident-funded phased work']
        });
        Core.appendLedger(world, 'building_shell', `${World.getPerson(world, project.actorId)?.name || project.actorId} completed a frontage change at ${applied.place.name}; the place, resident, and proposal history were preserved.`, {
          actorIds: [project.actorId], placeId: applied.place.id, causes: ['resident-authored frontage'], evidence: { projectId: project.id, proposalId: project.proposalId }
        });
      } catch (error) {
        project.status = 'failed';
        project.failureReason = error.message;
        const proposal = proposalById(world, project.proposalId);
        if (proposal) proposal.status = 'failed';
        world.metrics.frontageProjectsFailed += 1;
        appendHistory(world, project, 'failed', error.message, {
          actorIds: [project.actorId], causes: ['validation rollback']
        });
        return { ok: false, reason: error.message, project };
      }
    }
    return { ok: true, project, phaseCompleted: phase.id };
  }

  function proposePlayerFrontageChange(world, placeId, changeType) {
    return createFrontageProposal(world, placeId, 'player', changeType, undefined, {
      causes: ['explicit player-authored optional frontage direction']
    });
  }

  function dailyTick(world, options = {}) {
    ensureState(world);
    (world.frontageProposals || []).filter((proposal) => proposal.status === 'pending_owner' && proposal.decisionDueDay <= world.time.day).forEach((proposal) => {
      if (externalOwnerDecision(world, proposal)) approveProposal(world, proposal, 'external owner policy approved the bounded request');
      else declineProposal(world, proposal, 'external owner policy declined the bounded request');
    });
    (world.frontageProjects || []).filter((project) => ['saving', 'planned', 'active'].includes(project.status)).forEach((project) => {
      if (shellChance(world, project.status === 'saving' ? 0.62 : 0.46)) advanceFrontageProject(world, project.id, { causes: ['autonomous resident project cadence'] });
    });
    if (options.freezePlayer && world.time.day < 7) return;
    if ((world.frontageProposals || []).length > 220) return;
    if (!shellChance(world, 0.12)) return;
    const candidates = (world.places || []).filter((place) => {
      const author = eligibleAuthorForPlace(world, place);
      return author && Core.safeNumber(author.frontageProposalCooldownUntil, 0) <= world.time.day
        && !openProposalForPlace(world, place.id) && !openProjectForPlace(world, place.id);
    });
    if (!candidates.length) return;
    const place = shellChoice(world, candidates);
    const author = eligibleAuthorForPlace(world, place);
    if (author) createFrontageProposal(world, place.id, author.id, null, undefined, { causes: ['autonomous resident frontage intention'] });
  }

  function transferPropertyToPlayerForExperiment(world, property) {
    if (property.ownerId === 'player') return;
    const previousOwnerId = property.ownerId;
    property.ownerId = 'player';
    property.ownerLabel = world.player.name;
    if (!Array.isArray(world.player.ownedPropertyIds)) world.player.ownedPropertyIds = [];
    if (!world.player.ownedPropertyIds.includes(property.id)) world.player.ownedPropertyIds.push(property.id);
    (property.furniture || []).forEach((object) => {
      if (object.ownershipMode === 'property_fixture') object.ownerId = 'player';
    });
    Core.appendPropertyHistory(world, property, 'experiment_ownership_transfer', `${property.name} was transferred to the player for the labeled v0.10 shell-authority experiment without evicting any tenant.`, {
      actorIds: ['player'], causes: ['explicit QA shortcut'], evidence: { previousOwnerId, tenantsPreserved: property.tenants.slice() }
    });
  }

  function prepareBuildingShellExperiment(world) {
    ensureState(world);
    if (world.flags.shellExperimentPrepared) return { ok: false, reason: 'The labeled building-shell experiment was already prepared.' };
    initializeWorld(world, { silent: true });
    let property = World.getProperty(world, 'home_garden_1');
    if (!property || !(property.tenants || []).some((id) => id !== 'player')) {
      property = world.places.find((place) => place.kind === 'residential' && place.type === 'house' && (place.tenants || []).some((id) => id !== 'player'));
    }
    if (!property) return { ok: false, reason: 'No occupied small house is available for the resident-authored frontage experiment.' };
    transferPropertyToPlayerForExperiment(world, property);
    const author = (property.tenants || []).map((id) => World.getPerson(world, id)).find((person) => person && person.id !== 'player');
    if (!author) return { ok: false, reason: 'The selected experiment house has no autonomous adult tenant.' };
    const created = createFrontageProposal(world, property.id, author.id, 'window_boxes', true, {
      decisionDelayDays: 1,
      causes: ['explicit v0.10 resident-authored shell experiment']
    });
    if (!created.ok) return created;
    created.proposal.status = 'awaiting_player';
    created.proposal.authority.ownerId = 'player';
    created.proposal.authority.decisionMode = 'player_owner_response';
    created.proposal.authority.decision = null;
    created.proposal.authority.decidedAt = null;
    created.proposal.authority.reason = null;
    world.flags.shellExperimentPrepared = true;
    world.metrics.shellExperimentRuns += 1;
    world.ui.selectedBuildingId = created.proposal.buildingId;
    world.ui.selectedFrontageProposalId = created.proposal.id;
    Core.appendLedger(world, 'research', 'A labeled v0.10 shell experiment transferred one occupied small house to the player without eviction and created a genuine tenant-authored frontage request. The two-storey Courtyard Walk-up and a real shop shell remain available for structural inspection.', {
      actorIds: ['player', author.id], placeId: property.id,
      causes: ['explicit QA shortcut', 'tenant agency preserved'],
      evidence: { proposalId: created.proposal.id, houseBuildingId: created.proposal.buildingId, apartmentBuildingId: 'building_courtyard_walkup', shopBuildingId: buildingForPlace(world, 'place_lane_workroom')?.id || null }
    });
    return { ok: true, proposal: created.proposal, buildingId: created.proposal.buildingId, authorId: author.id, propertyId: property.id };
  }

  function metrics(world) {
    ensureState(world);
    const storeys = (world.buildings || []).flatMap((entry) => entry.storeys || []);
    const openings = storeys.flatMap((entry) => entry.openings || []);
    const routes = (world.buildings || []).flatMap((entry) => entry.routeNetwork?.edges || []);
    const pending = (world.frontageProposals || []).filter((entry) => entry.status === 'awaiting_player');
    return {
      buildings: world.buildings.length,
      multiStoreyBuildings: world.buildings.filter((entry) => entry.storeys.length > 1).length,
      storeys: storeys.length,
      wallEdges: storeys.reduce((sum, entry) => sum + (entry.wallGraph?.edges?.length || 0), 0),
      windows: openings.filter((entry) => entry.type === 'window').length,
      externalDoors: openings.filter((entry) => entry.type === 'external_door').length,
      stairs: routes.filter((entry) => entry.kind === 'stairs').length,
      connectedPlaces: world.places.filter((place) => Boolean(routeFromStreetToPlace(world, place.id))).length,
      pendingPlayerRequests: pending.length,
      proposals: world.frontageProposals.length,
      activeProjects: world.frontageProjects.filter((entry) => ['saving', 'planned', 'active'].includes(entry.status)).length,
      completedProjects: world.frontageProjects.filter((entry) => entry.status === 'completed').length,
      facadeMaintenanceObligation: world.settings.facadeMaintenanceObligation === true,
      frontageDailyDecay: world.settings.frontageDailyDecay === true,
      optimizationScore: world.settings.exteriorOptimizationScore === true
    };
  }

  function validateBuilding(world, building, add) {
    if (!building || building.schema !== BUILDING_SCHEMA) {
      add(`${building?.id || 'building'} has an invalid building-shell schema.`);
      return;
    }
    const placeIds = new Set((world.places || []).map((entry) => entry.id));
    const routeNodeIds = new Set((building.routeNetwork?.nodes || []).map((entry) => entry.id));
    const routeEdgeIds = new Set();
    (building.routeNetwork?.edges || []).forEach((edge) => {
      if (!routeNodeIds.has(edge.from) || !routeNodeIds.has(edge.to)) add(`${building.id} route edge ${edge.id} has an unknown endpoint.`);
      if (routeEdgeIds.has(edge.id)) add(`${building.id} duplicates route edge ${edge.id}.`);
      routeEdgeIds.add(edge.id);
    });
    const storeyIds = new Set();
    (building.storeys || []).forEach((storey) => {
      if (storeyIds.has(storey.id)) add(`${building.id} duplicates storey ${storey.id}.`);
      storeyIds.add(storey.id);
      if ((storey.wallGraph?.nodes || []).length !== 4 || (storey.wallGraph?.edges || []).length !== 4) add(`${storey.id} does not have the expected closed four-edge low-graphic shell.`);
      const wallEdgeIds = new Set((storey.wallGraph?.edges || []).map((entry) => entry.id));
      (storey.openings || []).forEach((opening) => {
        if (!wallEdgeIds.has(opening.wallEdgeId)) add(`${storey.id} opening ${opening.id} references an unknown wall edge.`);
      });
    });
    if (building.storeys.length > 1 && !(building.routeNetwork?.edges || []).some((entry) => entry.kind === 'stairs')) add(`${building.id} has multiple storeys but no vertical route.`);
    building.placeIds.forEach((placeId) => {
      if (!placeIds.has(placeId)) add(`${building.id} references unknown place ${placeId}.`);
      const continuity = building.interiorContinuity.find((entry) => entry.placeId === placeId);
      if (!continuity) add(`${building.id} has no interior continuity record for ${placeId}.`);
      else {
        if (!routeNodeIds.has(continuity.unitRouteNodeId) || !routeNodeIds.has(continuity.streetAccessNodeId)) add(`${building.id} continuity for ${placeId} has unknown route nodes.`);
        const route = routeWithinBuilding(world, building.id, continuity.streetAccessNodeId, continuity.unitRouteNodeId);
        if (!route) add(`${building.id} cannot route from the street to ${placeId}.`);
        const place = World.getPlace(world, placeId);
        if (place?.kind === 'residential' && place.habitat && !place.habitat.rooms.some((room) => room.id === continuity.habitatEntryRoomId)) add(`${building.id} continuity for ${placeId} points to an unknown habitat room.`);
      }
      if (!building.frontages.some((entry) => entry.placeId === placeId)) add(`${building.id} has no frontage state for ${placeId}.`);
    });
  }

  function validate(world, add) {
    // Validation is diagnostic-only. Never normalize or repair the world here.
    if (world.settings.facadeMaintenanceObligation !== false) add('Façade maintenance cannot become an obligation flag.');
    if (world.settings.frontageDailyDecay !== false) add('Frontages cannot gain hidden daily decay.');
    if (world.settings.exteriorOptimizationScore !== false) add('The shell system cannot create one exterior optimization score.');
    const buildingIds = new Set();
    const assignedPlaces = new Map();
    (world.buildings || []).forEach((building) => {
      if (buildingIds.has(building.id)) add(`Duplicate building id ${building.id}.`);
      buildingIds.add(building.id);
      validateBuilding(world, building, add);
      building.placeIds.forEach((placeId) => {
        if (assignedPlaces.has(placeId)) add(`${placeId} appears in both ${assignedPlaces.get(placeId)} and ${building.id}.`);
        else assignedPlaces.set(placeId, building.id);
      });
    });
    (world.places || []).forEach((place) => {
      if (!assignedPlaces.has(place.id)) add(`${place.id} has no building shell.`);
      if (place.shellRef?.buildingId !== assignedPlaces.get(place.id)) add(`${place.id} shell pointer does not match its building.`);
    });
    const personIds = new Set(['player'].concat((world.people || []).map((entry) => entry.id)));
    const proposalIds = new Set();
    (world.frontageProposals || []).forEach((proposal) => {
      if (proposal.schema !== FRONTAGE_PROPOSAL_SCHEMA) add(`${proposal.id || 'frontage proposal'} has invalid schema.`);
      if (proposalIds.has(proposal.id)) add(`Duplicate frontage proposal ${proposal.id}.`);
      proposalIds.add(proposal.id);
      if (!PROPOSAL_STATUSES.includes(proposal.status)) add(`${proposal.id} has invalid proposal status.`);
      if (!personIds.has(proposal.authorId)) add(`${proposal.id} has unknown author ${proposal.authorId}.`);
      if (!buildingIds.has(proposal.buildingId) || !World.getPlace(world, proposal.placeId)) add(`${proposal.id} has an invalid building or place target.`);
      if (!CHANGE_TYPES.includes(proposal.change?.type)) add(`${proposal.id} has invalid change type.`);
      if (proposal.noRelationshipPenalty !== true) add(`${proposal.id} does not preserve refusal without hidden relationship punishment.`);
      if (proposal.projectId && !projectById(world, proposal.projectId)) add(`${proposal.id} points to missing project ${proposal.projectId}.`);
    });
    const projectIds = new Set();
    (world.frontageProjects || []).forEach((project) => {
      if (project.schema !== FRONTAGE_PROJECT_SCHEMA) add(`${project.id || 'frontage project'} has invalid schema.`);
      if (projectIds.has(project.id)) add(`Duplicate frontage project ${project.id}.`);
      projectIds.add(project.id);
      if (!PROJECT_STATUSES.includes(project.status)) add(`${project.id} has invalid project status.`);
      if (!proposalIds.has(project.proposalId)) add(`${project.id} points to an unknown proposal.`);
      if (!personIds.has(project.actorId)) add(`${project.id} has unknown actor.`);
      if (!Array.isArray(project.phases) || project.phases.length !== 3) add(`${project.id} has malformed phases.`);
      if (!Number.isFinite(project.escrow) || project.escrow < 0 || !Number.isFinite(project.spent) || project.spent < 0) add(`${project.id} has invalid finance evidence.`);
    });
  }

  Object.assign(Systems, {
    proposePlayerFrontageChange,
    respondToFrontageProposal,
    advanceFrontageProject,
    prepareBuildingShellExperiment
  });

  AXM.Shells = {
    BUILDING_SCHEMA,
    FRONTAGE_PROPOSAL_SCHEMA,
    FRONTAGE_PROJECT_SCHEMA,
    PROPOSAL_STATUSES,
    PROJECT_STATUSES,
    CHANGE_TYPES,
    initializeWorld,
    ensureState,
    dailyTick,
    buildingById,
    buildingForPlace,
    frontageForPlace,
    proposalById,
    projectById,
    routeWithinBuilding,
    routeFromStreetToPlace,
    createFrontageProposal,
    proposePlayerFrontageChange,
    respondToFrontageProposal,
    advanceFrontageProject,
    prepareBuildingShellExperiment,
    metrics,
    validateBuilding,
    validate
  };
}(typeof window !== 'undefined' ? window : globalThis));
