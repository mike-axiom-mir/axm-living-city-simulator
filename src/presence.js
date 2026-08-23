(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const World = AXM.World;
  const Systems = AXM.Systems;
  const Habitats = AXM.Habitats;
  const Shells = AXM.Shells;

  const PRESENCE_SCHEMA = 'axm.living-city.lived-presence/v0.11.0';
  const MOVEMENT_SCHEMA = 'axm.living-city.indoor-movement/v0.11.0';
  const ENCOUNTER_SCHEMA = 'axm.living-city.ordinary-encounter/v0.11.0';
  const ACCESS_GRANT_SCHEMA = 'axm.living-city.presence-access-grant/v0.11.0';

  const PRESENCE_KINDS = [
    'street_threshold',
    'building_route',
    'place_entry',
    'room',
    'public_interior',
    'private_interior_coarse'
  ];
  const MOVEMENT_KINDS = ['arrival', 'departure', 'room_transition'];
  const MOVEMENT_MODES = ['visible', 'compressed', 'schedule', 'bundled'];
  const MOVEMENT_STATUSES = ['active', 'completed', 'ended_early', 'cancelled', 'failed'];
  const ENCOUNTER_STATUSES = ['awaiting_player', 'greeted', 'quietly_acknowledged', 'declined', 'passed'];
  const ACCESS_STATUSES = ['accepted', 'withdrawn', 'expired', 'used'];

  const ENCOUNTER_KINDS = [
    {
      id: 'ordinary_hello',
      title: 'A small hello',
      text: 'You notice each other in the same ordinary place. A greeting is possible, never required.'
    },
    {
      id: 'shared_landing',
      title: 'Sharing the landing',
      text: 'You briefly share the landing. Either person can continue without turning it into a social task.'
    },
    {
      id: 'doorway_pause',
      title: 'A doorway pause',
      text: 'There is a natural moment to acknowledge one another, stay quiet, or keep moving.'
    },
    {
      id: 'same_room_moment',
      title: 'The same room for a moment',
      text: 'You are both present in a shared room. Presence alone creates no obligation or authority.'
    }
  ];

  const METRIC_DEFAULTS = {
    presenceSnapshotsInitialized: 0,
    indoorMovementsStarted: 0,
    indoorMovementsCompleted: 0,
    indoorVisibleMovements: 0,
    indoorCompressedMovements: 0,
    indoorScheduleMovements: 0,
    indoorMovementMinutes: 0,
    indoorStairUses: 0,
    lawfulArrivals: 0,
    lawfulDepartures: 0,
    roomTransitions: 0,
    accessGrantsCreated: 0,
    accessDenials: 0,
    encountersOffered: 0,
    encountersGreeted: 0,
    encountersQuiet: 0,
    encountersDeclined: 0,
    encountersPassed: 0,
    privacyCoarsenings: 0,
    presenceExperimentRuns: 0
  };

  function stamp(world) {
    return { day: world.time.day, hour: world.time.hour, minute: world.time.minute || 0 };
  }

  function absoluteMinutes(value) {
    if (!value) return 0;
    return (Number(value.day || 1) - 1) * 1440 + Number(value.hour || 0) * 60 + Number(value.minute || 0);
  }

  function stableRoll(text) {
    return Core.hashString(String(text)) / 4294967296;
  }

  function presenceUniqueId(world, prefix) {
    world.presenceIdCounter = Math.max(0, Math.floor(Core.safeNumber(world.presenceIdCounter, 0))) + 1;
    return `${prefix}_${String(world.presenceIdCounter).padStart(6, '0')}`;
  }

  function personIds(world) {
    return ['player'].concat((world.people || []).map((person) => person.id));
  }

  function trackedBuildingIds(world) {
    const wantedPlaces = [
      world.player?.homePropertyId,
      'home_lane_1',
      'home_rooftop',
      'place_school',
      'place_market',
      'place_square_kiosk'
    ].filter(Boolean);
    return Array.from(new Set(wantedPlaces.map((placeId) => Shells?.buildingForPlace(world, placeId)?.id).filter(Boolean)));
  }

  function ensureState(world) {
    if (!world.presenceState || typeof world.presenceState !== 'object') world.presenceState = {};
    if (!world.presenceByPerson || typeof world.presenceByPerson !== 'object' || Array.isArray(world.presenceByPerson)) world.presenceByPerson = {};
    if (!Array.isArray(world.presenceRecords)) world.presenceRecords = [];
    if (!Array.isArray(world.indoorMovements)) world.indoorMovements = [];
    if (!Array.isArray(world.ordinaryEncounters)) world.ordinaryEncounters = [];
    if (!Array.isArray(world.presenceAccessGrants)) world.presenceAccessGrants = [];
    if (world.activeIndoorMovement === undefined) world.activeIndoorMovement = null;
    if (!Number.isInteger(world.presenceIdCounter) || world.presenceIdCounter < 0) world.presenceIdCounter = 0;
    if (!world.settings || typeof world.settings !== 'object') world.settings = {};
    if (!['visible', 'compressed'].includes(world.settings.defaultIndoorMovementMode)) world.settings.defaultIndoorMovementMode = 'compressed';
    world.settings.presenceCompressionAllowed = true;
    world.settings.compulsoryGreetings = false;
    world.settings.presenceWatchingReward = false;
    world.settings.presenceSurveillance = false;
    world.settings.minuteByMinutePresenceTax = false;
    world.settings.presenceGrantsAuthority = false;
    world.settings.socialChecklist = false;
    world.settings.presenceMovementObligation = false;
    // Read-compatible aliases from early v0.11 drafts remain fixed to the same roots.
    world.settings.indoorMovementCompressionAllowed = true;
    world.settings.continuousRoomTracking = false;
    world.settings.presenceViewCreatesRewards = false;
    world.settings.remotePrivateRoomVisibility = false;
    if (!world.ui || typeof world.ui !== 'object') world.ui = {};
    if (world.ui.selectedPresenceBuildingId === undefined) world.ui.selectedPresenceBuildingId = null;
    if (world.ui.selectedPresencePlaceId === undefined) world.ui.selectedPresencePlaceId = null;
    if (world.ui.selectedEncounterId === undefined) world.ui.selectedEncounterId = null;
    if (!world.flags || typeof world.flags !== 'object') world.flags = {};
    if (world.flags.presenceFoundationLogged === undefined) world.flags.presenceFoundationLogged = false;
    if (world.flags.presenceExperimentPrepared === undefined) world.flags.presenceExperimentPrepared = false;
    if (!world.metrics || typeof world.metrics !== 'object') world.metrics = {};
    Object.entries(METRIC_DEFAULTS).forEach(([key, value]) => {
      if (!Number.isFinite(world.metrics[key])) world.metrics[key] = value;
    });
    if (!Array.isArray(world.presenceState.trackedBuildingIds) || !world.presenceState.trackedBuildingIds.length) {
      world.presenceState.trackedBuildingIds = trackedBuildingIds(world);
    }
    if (!Number.isFinite(world.presenceState.lastSpontaneousEncounterAt)) world.presenceState.lastSpontaneousEncounterAt = -999999;
    if (world.presenceState.experimentHostId === undefined) world.presenceState.experimentHostId = null;
    if (world.presenceState.experimentPlaceId === undefined) world.presenceState.experimentPlaceId = null;
    if (!Number.isFinite(world.presenceState.experimentHostUntil)) world.presenceState.experimentHostUntil = -1;
    if (world.presenceState.pendingStreetJourney === undefined) world.presenceState.pendingStreetJourney = null;
    return world;
  }

  function presenceFor(world, personId) {
    ensureState(world);
    return world.presenceByPerson[personId] || null;
  }

  function buildingContext(world, placeId) {
    const place = World.getPlace(world, placeId);
    const building = Shells?.buildingForPlace(world, placeId);
    const continuity = building?.interiorContinuity?.find((entry) => entry.placeId === placeId) || null;
    const storey = building?.storeys?.find((entry) => entry.id === continuity?.primaryStoreyId) || null;
    return { place, building, continuity, storey };
  }

  function defaultEntryRoom(world, placeId) {
    const { place, continuity } = buildingContext(world, placeId);
    if (!place || place.kind !== 'residential') return null;
    if (continuity?.habitatEntryRoomId && Habitats?.roomById(place, continuity.habitatEntryRoomId)) return continuity.habitatEntryRoomId;
    const entrance = place.habitat?.entrance;
    return entrance ? Habitats?.roomAtCell(place, entrance.x, entrance.y)?.id || null : place.habitat?.rooms?.[0]?.id || null;
  }

  function permissionForRoom(world, property, roomId) {
    if (!property || property.kind !== 'residential') return null;
    return Habitats?.roomPermissionsForProperty(world, property.id)?.find((entry) => entry.roomId === roomId)
      || Habitats?.roomById(property, roomId)?.permissionSnapshot
      || null;
  }

  function activeAcceptedVisit(world, personId, placeId) {
    return (world.communityOpportunities || []).find((entry) => {
      if (entry.kind !== 'home_visit' || entry.placeId !== placeId) return false;
      if (!['available', 'in_progress'].includes(entry.status)) return false;
      const involved = [entry.hostId, entry.inviteeId].includes(personId) || (entry.participantIds || []).includes(personId);
      if (!involved) return false;
      return world.time.day >= entry.eventDay && world.time.day <= entry.expiresDay;
    }) || null;
  }

  function activeAccessGrant(world, personId, placeId) {
    const now = absoluteMinutes(stamp(world));
    return (world.presenceAccessGrants || []).find((entry) => entry.guestId === personId && entry.placeId === placeId
      && entry.status === 'accepted' && absoluteMinutes(entry.expiresAt) >= now) || null;
  }

  function accessFor(world, personId, placeId) {
    ensureState(world);
    const person = World.getPerson(world, personId);
    const place = World.getPlace(world, placeId);
    if (!person || !place) return { ok: false, basis: 'unknown', reason: 'The person or place is unavailable.' };
    if (place.kind !== 'residential') {
      return {
        ok: true,
        basis: 'public_or_scheduled_place',
        reason: 'Public, working, institutional, and customer places are enterable through their ordinary access path.',
        authority: { tenancy: false, ownership: false, edit: false, storage: false, household: false, care: false, surveillance: false }
      };
    }
    if ((place.tenants || []).includes(personId) || person.homePropertyId === placeId) {
      return {
        ok: true,
        basis: 'resident',
        reason: 'The person lawfully lives here.',
        authority: { tenancy: true, ownership: place.ownerId === personId, edit: false, storage: true, household: false, care: false, surveillance: false }
      };
    }
    if (place.ownerId === personId && !(place.tenants || []).length) {
      return {
        ok: true,
        basis: 'owner_of_vacant_place',
        reason: 'The owner may enter a genuinely vacant property; ownership does not grant entry over an occupying tenant.',
        authority: { tenancy: false, ownership: true, edit: false, storage: false, household: false, care: false, surveillance: false }
      };
    }
    const visit = activeAcceptedVisit(world, personId, placeId);
    if (visit) {
      return {
        ok: true,
        basis: 'accepted_home_visit',
        reason: 'A bounded accepted visit grants entry to shared visit space only.',
        sourceId: visit.id,
        authority: { tenancy: false, ownership: false, edit: false, storage: false, household: false, care: false, surveillance: false }
      };
    }
    const grant = activeAccessGrant(world, personId, placeId);
    if (grant) {
      return {
        ok: true,
        basis: 'accepted_presence_grant',
        reason: 'A bounded accepted invitation grants entry to the listed shared space only.',
        sourceId: grant.id,
        authority: Core.deepClone(grant.authority)
      };
    }
    return {
      ok: false,
      basis: 'threshold_only',
      reason: 'Reaching an address does not create permission to enter an occupied private home.',
      authority: { tenancy: false, ownership: false, edit: false, storage: false, household: false, care: false, surveillance: false }
    };
  }

  function roomAccessFor(world, personId, property, roomId, access = null) {
    if (!property || property.kind !== 'residential') return { ok: false, reason: 'This place has no residential room graph.' };
    const room = Habitats?.roomById(property, roomId);
    if (!room) return { ok: false, reason: 'That room is not part of the current habitat graph.' };
    const basis = access || accessFor(world, personId, property.id);
    if (!basis.ok) return basis;
    const permission = permissionForRoom(world, property, roomId);
    if (basis.basis === 'resident' || basis.basis === 'owner_of_vacant_place') {
      if (permission?.kind === 'partner_private' && personId === 'player' && !(permission.holderIds || []).includes('player')) {
        return { ok: false, reason: 'A partner-private room remains private even when both people live in the same home.' };
      }
      if (permission?.kind === 'player_private' && personId !== 'player' && !(permission.holderIds || []).includes(personId)) {
        return { ok: false, reason: 'The player-private room is not ordinary shared circulation.' };
      }
      return { ok: true, basis: basis.basis, room, permission };
    }
    const sharedPurposes = new Set(['entry', 'living', 'kitchen', 'hobby', 'flexible']);
    const commonPermission = !permission || permission.kind === 'common' || (permission.holderIds || []).includes(personId);
    if (!sharedPurposes.has(room.purpose) || !commonPermission) {
      return { ok: false, reason: 'A visitor invitation grants shared visit space, not sleeping rooms, bathrooms, storage, workshops, or private rooms.' };
    }
    return { ok: true, basis: basis.basis, room, permission };
  }

  function setPresence(world, personId, next, options = {}) {
    ensureState(world);
    const previous = world.presenceByPerson[personId] || null;
    const place = World.getPlace(world, next.placeId);
    const building = Shells?.buildingForPlace(world, next.placeId);
    const value = {
      schema: PRESENCE_SCHEMA,
      personId,
      kind: PRESENCE_KINDS.includes(next.kind) ? next.kind : 'street_threshold',
      placeId: next.placeId,
      buildingId: next.buildingId || building?.id || null,
      storeyId: next.storeyId || null,
      level: Number.isInteger(next.level) ? next.level : null,
      routeNodeId: next.routeNodeId || null,
      roomId: next.roomId || null,
      activity: next.activity || null,
      accessBasis: next.accessBasis || 'unknown',
      privacy: next.privacy || (place?.kind === 'residential' ? 'private' : 'public'),
      observableScope: next.observableScope || (personId === 'player' ? 'self' : 'coarse'),
      updatedAt: stamp(world),
      source: next.source || options.source || 'presence_reconciliation'
    };
    world.presenceByPerson[personId] = value;
    if (options.recordTransition && previous && JSON.stringify({ kind: previous.kind, placeId: previous.placeId, roomId: previous.roomId, routeNodeId: previous.routeNodeId })
      !== JSON.stringify({ kind: value.kind, placeId: value.placeId, roomId: value.roomId, routeNodeId: value.routeNodeId })) {
      world.metrics.roomTransitions += previous.placeId === value.placeId && previous.roomId !== value.roomId ? 1 : 0;
    }
    return value;
  }

  function chooseHomeRoom(world, person) {
    const property = World.getProperty(world, person.homePropertyId);
    if (!property?.habitat?.rooms?.length) return null;
    const hour = world.time.hour;
    const rooms = property.habitat.rooms;
    let desired = 'living';
    if (hour < 7 || hour >= 23) desired = 'sleep';
    else if (hour === 7) desired = stableRoll(`${world.seed}|${world.time.day}|${person.id}|morning-room`) < 0.5 ? 'bathroom' : 'kitchen';
    else if (hour >= 8 && hour < 17) desired = person.activity?.includes('home') ? 'work' : 'entry';
    else if (hour >= 21) desired = 'sleep';
    else if (stableRoll(`${world.seed}|${world.time.day}|${world.time.hour}|${person.id}|home-room`) < 0.25) desired = 'hobby';
    const candidates = rooms.filter((room) => room.purpose === desired);
    const pool = candidates.length ? candidates : rooms.filter((room) => ['living', 'flexible', 'entry'].includes(room.purpose));
    const ordered = (pool.length ? pool : rooms).slice().sort((a, b) => a.id.localeCompare(b.id));
    return ordered[Core.hashString(`${world.seed}|${world.time.day}|${world.time.hour}|${person.id}|room-choice`) % ordered.length] || rooms[0];
  }

  function coarsePresenceForPerson(world, person, options = {}) {
    const placeId = person.locationId || person.homePropertyId;
    const { place, building, continuity, storey } = buildingContext(world, placeId);
    if (!place) return null;
    if (place.kind !== 'residential') {
      return {
        kind: 'public_interior', placeId, buildingId: building?.id || null, storeyId: storey?.id || null,
        level: storey?.level ?? null, routeNodeId: continuity?.unitRouteNodeId || null, roomId: null,
        activity: person.activity || 'present', accessBasis: 'public_or_scheduled_place', privacy: 'public', observableScope: 'co_present', source: options.source || 'hourly_schedule'
      };
    }
    const lawfulResident = (place.tenants || []).includes(person.id) || person.homePropertyId === placeId;
    if (!lawfulResident) {
      return {
        kind: 'street_threshold', placeId, buildingId: building?.id || null, storeyId: storey?.id || null,
        level: 0, routeNodeId: place.shellRef?.streetAccessNodeId || null, roomId: null,
        activity: person.activity || 'outside', accessBasis: 'threshold_only', privacy: 'public', observableScope: 'co_present', source: options.source || 'hourly_schedule'
      };
    }
    return {
      kind: 'private_interior_coarse', placeId, buildingId: building?.id || null, storeyId: storey?.id || null,
      level: storey?.level ?? null, routeNodeId: continuity?.unitRouteNodeId || null, roomId: null,
      activity: person.activity || 'at home', accessBasis: 'resident', privacy: 'private', observableScope: 'private_coarse', source: options.source || 'hourly_schedule'
    };
  }

  function initializePersonPresence(world, person, options = {}) {
    if (!person) return null;
    if (person.id === 'player') {
      const place = World.getPlace(world, person.locationId || person.homePropertyId);
      const { building, continuity, storey } = buildingContext(world, place?.id);
      const roomId = place?.kind === 'residential' && (place.tenants || []).includes('player') ? defaultEntryRoom(world, place.id) : null;
      return setPresence(world, 'player', {
        kind: roomId ? 'room' : 'public_interior',
        placeId: place?.id || person.homePropertyId,
        buildingId: building?.id || null,
        storeyId: storey?.id || null,
        level: storey?.level ?? null,
        routeNodeId: continuity?.unitRouteNodeId || null,
        roomId,
        activity: roomId ? 'at home' : 'present',
        accessBasis: roomId ? 'resident' : 'public_or_scheduled_place',
        privacy: roomId ? 'private' : 'public',
        observableScope: 'self',
        source: options.source || 'present_day_initialization'
      });
    }
    return setPresence(world, person.id, coarsePresenceForPerson(world, person, options));
  }

  function initializeWorld(world, options = {}) {
    ensureState(world);
    const ids = personIds(world);
    ids.forEach((id) => {
      const person = World.getPerson(world, id);
      const current = world.presenceByPerson[id];
      const valid = current?.schema === PRESENCE_SCHEMA && World.getPlace(world, current.placeId);
      if (!valid) initializePersonPresence(world, person, { source: options.migration ? 'migration_present_snapshot' : 'present_day_initialization' });
    });
    Object.keys(world.presenceByPerson).forEach((id) => {
      if (!ids.includes(id)) delete world.presenceByPerson[id];
    });
    world.metrics.presenceSnapshotsInitialized = ids.length;
    if (!world.ui.selectedPresenceBuildingId || !Shells?.buildingById(world, world.ui.selectedPresenceBuildingId)) {
      world.ui.selectedPresenceBuildingId = Shells?.buildingForPlace(world, world.player.homePropertyId)?.id || world.buildings?.[0]?.id || null;
    }
    if (!world.ui.selectedPresencePlaceId || !World.getPlace(world, world.ui.selectedPresencePlaceId)) {
      world.ui.selectedPresencePlaceId = world.player.locationId;
    }
    if (!options.silent && !world.flags.presenceFoundationLogged) {
      Core.appendLedger(world, 'lived_presence', 'Buildings gained bounded arrival, departure, landing, stair, room-presence, and ordinary encounter evidence. Presence remains local and purpose-bound: no compulsory greetings, watching reward, surveillance view, or minute-by-minute simulation tax was created.', {
        causes: ['v0.11 lived buildings foundation', 'casual realism', 'privacy before spectacle'],
        evidence: metrics(world)
      });
      world.flags.presenceFoundationLogged = true;
    }
    return world;
  }

  function routeRoomGraph(property, fromRoomId, toRoomId) {
    if (!property?.habitat || !fromRoomId || !toRoomId) return null;
    if (fromRoomId === toRoomId) return { roomIds: [fromRoomId], connectionIds: [], minutes: 0 };
    const rooms = new Set(property.habitat.rooms.map((room) => room.id));
    if (!rooms.has(fromRoomId) || !rooms.has(toRoomId)) return null;
    const adjacency = new Map(Array.from(rooms).map((id) => [id, []]));
    (property.habitat.roomConnections || []).filter((entry) => entry.passable !== false).forEach((connection) => {
      const [a, b] = connection.roomIds;
      adjacency.get(a)?.push({ roomId: b, connection });
      adjacency.get(b)?.push({ roomId: a, connection });
    });
    const queue = [fromRoomId];
    const previous = new Map([[fromRoomId, null]]);
    while (queue.length) {
      const current = queue.shift();
      if (current === toRoomId) break;
      (adjacency.get(current) || []).forEach((entry) => {
        if (previous.has(entry.roomId)) return;
        previous.set(entry.roomId, { roomId: current, connection: entry.connection });
        queue.push(entry.roomId);
      });
    }
    if (!previous.has(toRoomId)) return null;
    const roomIds = [];
    const connectionIds = [];
    let cursor = toRoomId;
    while (cursor) {
      roomIds.push(cursor);
      const step = previous.get(cursor);
      if (!step) break;
      connectionIds.push(step.connection.id);
      cursor = step.roomId;
    }
    roomIds.reverse();
    connectionIds.reverse();
    return { roomIds, connectionIds, minutes: connectionIds.length };
  }

  function shellRouteSteps(world, placeId, direction = 'arrival') {
    const place = World.getPlace(world, placeId);
    const building = Shells?.buildingForPlace(world, placeId);
    const route = Shells?.routeFromStreetToPlace(world, placeId);
    if (!place || !building || !route) return null;
    const edges = route.edgeIds.map((edgeId) => building.routeNetwork.edges.find((edge) => edge.id === edgeId)).filter(Boolean);
    const nodeMap = new Map(building.routeNetwork.nodes.map((node) => [node.id, node]));
    const nodeIds = route.nodeIds.slice();
    const orderedEdges = direction === 'arrival' ? edges : edges.slice().reverse();
    const orderedNodes = direction === 'arrival' ? nodeIds : nodeIds.slice().reverse();
    const steps = orderedEdges.map((edge, index) => {
      const toNodeId = orderedNodes[index + 1];
      const toNode = nodeMap.get(toNodeId);
      return {
        id: `${direction}_${edge.id}`,
        kind: edge.kind,
        edgeId: edge.id,
        fromNodeId: orderedNodes[index],
        toNodeId,
        minutes: Math.max(1, Math.round(Core.safeNumber(edge.minutes, 0))),
        level: Number.isInteger(toNode?.level) ? toNode.level : null,
        label: edge.kind === 'stairs'
          ? `${direction === 'arrival' ? 'Climb' : 'Descend'} the stairs to ${toNode?.label || `level ${(toNode?.level || 0) + 1}`}`
          : edge.kind === 'unit_entry' ? `${direction === 'arrival' ? 'Reach' : 'Leave'} ${place.name}`
            : `${direction === 'arrival' ? 'Move through' : 'Return through'} ${toNode?.label || Core.titleCase(edge.kind)}`
      };
    });
    const entryRoomId = defaultEntryRoom(world, placeId);
    if (place.kind === 'residential' && entryRoomId) {
      if (direction === 'arrival') {
        steps.push({
          id: `arrival_room_${entryRoomId}`, kind: 'room_entry', edgeId: null,
          fromNodeId: orderedNodes[orderedNodes.length - 1], toNodeId: null, minutes: 1,
          roomId: entryRoomId, level: Number(place.shellRef?.primaryStoreyId?.match(/_s(\d+)_/)?.[1] || 0),
          label: `Enter ${Habitats.roomById(place, entryRoomId)?.name || 'the entry room'}`
        });
      } else {
        steps.unshift({
          id: `departure_room_${entryRoomId}`, kind: 'room_exit', edgeId: null,
          fromNodeId: null, toNodeId: orderedNodes[0], minutes: 1,
          roomId: entryRoomId, level: Number(place.shellRef?.primaryStoreyId?.match(/_s(\d+)_/)?.[1] || 0),
          label: `Leave ${Habitats.roomById(place, entryRoomId)?.name || 'the entry room'}`
        });
      }
    }
    return {
      buildingId: building.id,
      placeId,
      direction,
      steps,
      totalMinutes: steps.reduce((sum, step) => sum + step.minutes, 0),
      stairSteps: steps.filter((step) => step.kind === 'stairs').length,
      sourceShellRoute: route
    };
  }

  function roomRouteSteps(world, placeId, fromRoomId, toRoomId) {
    const property = World.getProperty(world, placeId);
    const route = routeRoomGraph(property, fromRoomId, toRoomId);
    if (!property || !route) return null;
    const steps = route.connectionIds.map((connectionId, index) => ({
      id: `room_step_${connectionId}_${index + 1}`,
      kind: 'room_door',
      connectionId,
      fromRoomId: route.roomIds[index],
      toRoomId: route.roomIds[index + 1],
      roomId: route.roomIds[index + 1],
      minutes: 1,
      label: `Move into ${Habitats.roomById(property, route.roomIds[index + 1])?.name || 'the next room'}`
    }));
    return { buildingId: Shells.buildingForPlace(world, placeId)?.id || null, placeId, direction: 'room_transition', steps, totalMinutes: steps.length, stairSteps: 0 };
  }

  function createMovement(world, personId, kind, mode, route, access, options = {}) {
    const movement = {
      schema: MOVEMENT_SCHEMA,
      id: presenceUniqueId(world, 'indoor_movement'),
      actorId: personId,
      kind,
      mode,
      status: mode === 'visible' ? 'active' : 'completed',
      placeId: route.placeId,
      buildingId: route.buildingId,
      startedAt: stamp(world),
      completedAt: mode === 'visible' ? null : stamp(world),
      currentStepIndex: 0,
      elapsedMinutes: 0,
      route: Core.deepClone(route),
      access: {
        basis: access?.basis || options.accessBasis || 'schedule',
        sourceId: access?.sourceId || null,
        authority: Core.deepClone(access?.authority || {
          tenancy: false, ownership: false, edit: false, storage: false, household: false, care: false, surveillance: false
        })
      },
      noWatchingReward: true,
      noAuthorityFromPresence: true,
      history: [{ at: stamp(world), type: 'created', message: `${Core.titleCase(kind)} route created in ${mode} mode.` }]
    };
    world.presenceRecords.push(movement);
    if (world.presenceRecords.length > 600) world.presenceRecords.splice(0, world.presenceRecords.length - 600);
    world.metrics.indoorMovementsStarted += 1;
    if (mode === 'visible') world.metrics.indoorVisibleMovements += 1;
    if (mode === 'compressed') world.metrics.indoorCompressedMovements += 1;
    if (mode === 'schedule') world.metrics.indoorScheduleMovements += 1;
    return movement;
  }

  function movementById(world, movementId) {
    return (world.presenceRecords || []).find((entry) => entry.id === movementId) || null;
  }

  function spendMovementMinutes(world, movement, minutes) {
    const amount = Math.max(0, Math.round(Core.safeNumber(minutes, 0)));
    if (!amount) return;
    Systems.advanceMinutes(world, amount, { indoorMovement: true });
    movement.elapsedMinutes += amount;
    world.metrics.indoorMovementMinutes += amount;
  }

  function applyMovementStep(world, movement, step) {
    const current = presenceFor(world, movement.actorId);
    const { place, building, continuity } = buildingContext(world, movement.placeId);
    if (step.kind === 'room_entry' || step.kind === 'room_door') {
      setPresence(world, movement.actorId, {
        kind: 'room', placeId: movement.placeId, buildingId: building?.id || null,
        storeyId: continuity?.primaryStoreyId || null, level: step.level ?? current?.level ?? null,
        routeNodeId: continuity?.unitRouteNodeId || null, roomId: step.roomId || step.toRoomId,
        activity: 'moving through the interior', accessBasis: movement.access.basis,
        privacy: place?.kind === 'residential' ? 'private' : 'public', observableScope: movement.actorId === 'player' ? 'self' : 'private_unless_co_present',
        source: movement.id
      }, { recordTransition: true });
    } else if (step.kind === 'room_exit') {
      setPresence(world, movement.actorId, {
        kind: 'place_entry', placeId: movement.placeId, buildingId: building?.id || null,
        storeyId: continuity?.primaryStoreyId || null, level: step.level ?? current?.level ?? null,
        routeNodeId: step.toNodeId || continuity?.unitRouteNodeId || null, roomId: null,
        activity: 'leaving the interior', accessBasis: movement.access.basis,
        privacy: 'shared_route', observableScope: 'co_present', source: movement.id
      }, { recordTransition: true });
    } else {
      const node = building?.routeNetwork?.nodes?.find((entry) => entry.id === step.toNodeId) || null;
      setPresence(world, movement.actorId, {
        kind: step.kind === 'unit_entry' ? 'place_entry' : 'building_route',
        placeId: movement.placeId, buildingId: building?.id || null,
        storeyId: node?.level == null ? current?.storeyId || null : `${building.id}_s${node.level}_storey`,
        level: node?.level ?? current?.level ?? 0,
        routeNodeId: step.toNodeId || null, roomId: null,
        activity: step.kind === 'stairs' ? 'using the stairs' : 'moving through the building',
        accessBasis: movement.access.basis, privacy: 'shared_route', observableScope: 'co_present', source: movement.id
      }, { recordTransition: true });
    }
    if (step.kind === 'stairs') world.metrics.indoorStairUses += 1;
    movement.history.push({ at: stamp(world), type: 'step', stepId: step.id, kind: step.kind, minutes: step.minutes, message: step.label });
  }

  function completeMovement(world, movement) {
    const { place, building, continuity, storey } = buildingContext(world, movement.placeId);
    movement.status = 'completed';
    movement.completedAt = stamp(world);
    movement.currentStepIndex = movement.route.steps.length;
    world.activeIndoorMovement = null;
    world.metrics.indoorMovementsCompleted += 1;
    if (movement.kind === 'arrival') {
      world.metrics.lawfulArrivals += 1;
      if (place.kind === 'residential') {
        const roomId = defaultEntryRoom(world, place.id);
        setPresence(world, movement.actorId, {
          kind: 'room', placeId: place.id, buildingId: building?.id || null, storeyId: continuity?.primaryStoreyId || null,
          level: storey?.level ?? Number(place.shellRef?.primaryStoreyId?.match(/_s(\d+)_/)?.[1] || 0),
          routeNodeId: continuity?.unitRouteNodeId || null, roomId,
          activity: 'inside the building', accessBasis: movement.access.basis,
          privacy: 'private', observableScope: movement.actorId === 'player' ? 'self' : 'private_unless_co_present', source: movement.id
        });
      } else {
        setPresence(world, movement.actorId, {
          kind: 'public_interior', placeId: place.id, buildingId: building?.id || null, storeyId: continuity?.primaryStoreyId || null,
          level: storey?.level ?? 0, routeNodeId: continuity?.unitRouteNodeId || null, roomId: null,
          activity: 'inside the place', accessBasis: movement.access.basis,
          privacy: 'public', observableScope: 'co_present', source: movement.id
        });
      }
      maybeOfferEncounter(world, { preferredPersonId: world.presenceState.experimentHostId, cause: 'lawful arrival completed' });
    } else if (movement.kind === 'departure') {
      world.metrics.lawfulDepartures += 1;
      setPresence(world, movement.actorId, {
        kind: 'street_threshold', placeId: place.id, buildingId: building?.id || null, storeyId: null,
        level: 0, routeNodeId: place.shellRef?.streetAccessNodeId || null, roomId: null,
        activity: 'outside the entrance', accessBasis: 'threshold_only',
        privacy: 'public', observableScope: 'co_present', source: movement.id
      });
      if (movement.actorId === 'player' && movement.mode === 'visible' && world.presenceState.pendingStreetJourney) {
        const pending = world.presenceState.pendingStreetJourney;
        world.presenceState.pendingStreetJourney = null;
        const continued = AXM.Exteriors?.startPlayerTravel(world, pending.destinationPlaceId, pending.mode) || null;
        movement.continuedStreetJourneyId = continued?.record?.id || null;
        movement.history.push({ at: stamp(world), type: 'street_journey_continued', message: 'The queued street route began only after the lawful indoor departure completed.' });
      }
    }
    movement.history.push({ at: stamp(world), type: 'completed', message: `${Core.titleCase(movement.kind)} completed without changing legal home, ownership, or authority.` });
    Core.appendLedger(world, 'lived_presence', `${World.personName(world, movement.actorId)} completed ${movement.kind.replace('_', ' ')} through ${place?.name || movement.placeId}${movement.route.stairSteps ? ` using ${movement.route.stairSteps} stair link${movement.route.stairSteps === 1 ? '' : 's'}` : ''}.`, {
      actorIds: [movement.actorId], placeId: movement.placeId,
      causes: [movement.mode === 'visible' ? 'visible indoor route chosen' : movement.mode === 'compressed' ? 'indoor route compressed by choice' : 'bounded schedule resolution', 'presence creates no authority', 'watching grants no reward'],
      evidence: { movementId: movement.id, mode: movement.mode, minutes: movement.elapsedMinutes, steps: movement.route.steps.length, stairSteps: movement.route.stairSteps }
    });
    return { ok: true, movement };
  }

  function runCompressedMovement(world, movement) {
    movement.route.steps.forEach((step) => {
      spendMovementMinutes(world, movement, step.minutes);
      applyMovementStep(world, movement, step);
      maybeOfferEncounter(world, { preferredPersonId: world.presenceState.experimentHostId, cause: 'shared indoor route moment' });
    });
    movement.history.push({ at: stamp(world), type: 'compressed_resolution', message: 'The same route, minutes, stairs, access checks, and encounter opportunity were resolved without requiring the player to watch every step.' });
    return completeMovement(world, movement);
  }

  function startPlayerJourney(world, destinationPlaceId, mode = 'visible') {
    ensureState(world);
    if (!['visible', 'compressed'].includes(mode)) return { ok: false, reason: 'Travel must be visible or compressed.' };
    if (world.activeTravel || world.activeIndoorMovement) return { ok: false, reason: 'Finish the active route before starting another journey.' };
    const current = presenceFor(world, 'player');
    const insideCurrentPlace = current && current.placeId === world.player.locationId && current.kind !== 'street_threshold';
    if (!insideCurrentPlace) {
      return AXM.Exteriors?.startPlayerTravel(world, destinationPlaceId, mode)
        || { ok: false, reason: 'Walkable-place engine unavailable.' };
    }
    if (mode === 'compressed') {
      const departure = startIndoorDeparture(world, 'compressed');
      if (!departure?.ok) return departure;
      const travel = AXM.Exteriors?.startPlayerTravel(world, destinationPlaceId, 'compressed')
        || { ok: false, reason: 'Walkable-place engine unavailable.' };
      return { ok: travel.ok !== false, departure: departure.movement || null, travel };
    }
    world.presenceState.pendingStreetJourney = { destinationPlaceId, mode, requestedAt: stamp(world) };
    const departure = startIndoorDeparture(world, 'visible');
    if (!departure?.ok) {
      world.presenceState.pendingStreetJourney = null;
      return departure;
    }
    Systems.toast(world, 'You are leaving the building first. The street route will begin after the final indoor step.', 'info');
    return { ok: true, departure: departure.movement || null, queuedJourney: Core.deepClone(world.presenceState.pendingStreetJourney) };
  }

  function startIndoorArrival(world, placeId, mode = 'visible') {
    ensureState(world);
    if (!['visible', 'compressed'].includes(mode)) return { ok: false, reason: 'Indoor movement must be visible or compressed.' };
    if (world.activeIndoorMovement) return { ok: false, reason: 'An indoor route is already active.' };
    if (world.activeTravel) return { ok: false, reason: 'Finish the street route before entering a building.' };
    if (world.player.locationId !== placeId) return { ok: false, reason: 'Reach the address before entering its building.' };
    const current = presenceFor(world, 'player');
    if (current?.placeId === placeId && !['street_threshold'].includes(current.kind)) return { ok: false, reason: 'You are already inside this place.' };
    const access = accessFor(world, 'player', placeId);
    if (!access.ok) {
      world.metrics.accessDenials += 1;
      return { ok: false, reason: access.reason };
    }
    const route = shellRouteSteps(world, placeId, 'arrival');
    if (!route) return { ok: false, reason: 'The building has no valid street-to-interior route.' };
    const movement = createMovement(world, 'player', 'arrival', mode, route, access);
    if (mode === 'visible') {
      world.activeIndoorMovement = { recordId: movement.id };
      Systems.toast(world, `Indoor route started: ${route.totalMinutes} minutes. You may watch each landing or compress the remainder.`, 'info');
      return { ok: true, movement };
    }
    return runCompressedMovement(world, movement);
  }

  function startIndoorDeparture(world, mode = 'visible') {
    ensureState(world);
    if (!['visible', 'compressed'].includes(mode)) return { ok: false, reason: 'Indoor movement must be visible or compressed.' };
    if (world.activeIndoorMovement) return { ok: false, reason: 'An indoor route is already active.' };
    const current = presenceFor(world, 'player');
    if (!current || ['street_threshold'].includes(current.kind)) return { ok: false, reason: 'You are already outside the entrance.' };
    const route = shellRouteSteps(world, current.placeId, 'departure');
    if (!route) return { ok: false, reason: 'The building has no valid interior-to-street route.' };
    const access = accessFor(world, 'player', current.placeId);
    const movement = createMovement(world, 'player', 'departure', mode, route, access.ok ? access : { basis: current.accessBasis, authority: {} });
    if (mode === 'visible') {
      world.activeIndoorMovement = { recordId: movement.id };
      Systems.toast(world, `Departure route started: ${route.totalMinutes} minutes. It may be compressed at any point.`, 'info');
      return { ok: true, movement };
    }
    return runCompressedMovement(world, movement);
  }

  function startRoomTransition(world, roomId, mode = 'visible') {
    ensureState(world);
    if (!['visible', 'compressed'].includes(mode)) return { ok: false, reason: 'Room movement must be visible or compressed.' };
    if (world.activeIndoorMovement) return { ok: false, reason: 'An indoor route is already active.' };
    const current = presenceFor(world, 'player');
    const property = World.getProperty(world, current?.placeId);
    if (!property || current.kind !== 'room' || !current.roomId) return { ok: false, reason: 'Room movement is available only while you are inside a residential room graph.' };
    const access = accessFor(world, 'player', property.id);
    const roomAccess = roomAccessFor(world, 'player', property, roomId, access);
    if (!roomAccess.ok) return roomAccess;
    if (current.roomId === roomId) return { ok: false, reason: 'You are already in that room.' };
    const route = roomRouteSteps(world, property.id, current.roomId, roomId);
    if (!route) return { ok: false, reason: 'No passable door route connects those rooms.' };
    const movement = createMovement(world, 'player', 'room_transition', mode, route, access);
    if (mode === 'visible') {
      world.activeIndoorMovement = { recordId: movement.id };
      Systems.toast(world, `${route.totalMinutes} minute room route started.`, 'info');
      return { ok: true, movement };
    }
    return runCompressedMovement(world, movement);
  }

  function stepIndoorMovement(world) {
    ensureState(world);
    const movement = movementById(world, world.activeIndoorMovement?.recordId);
    if (!movement || movement.status !== 'active') return { ok: false, reason: 'No visible indoor route is active.' };
    const step = movement.route.steps[movement.currentStepIndex];
    if (!step) return completeMovement(world, movement);
    spendMovementMinutes(world, movement, step.minutes);
    applyMovementStep(world, movement, step);
    movement.currentStepIndex += 1;
    if (movement.currentStepIndex >= movement.route.steps.length) return completeMovement(world, movement);
    Systems.toast(world, `${step.label}. ${movement.route.steps.length - movement.currentStepIndex} step${movement.route.steps.length - movement.currentStepIndex === 1 ? '' : 's'} remain.`, 'info');
    maybeOfferEncounter(world, { preferredPersonId: world.presenceState.experimentHostId, cause: 'shared indoor route moment' });
    return { ok: true, movement, step };
  }

  function finishIndoorMovementCompressed(world) {
    ensureState(world);
    const movement = movementById(world, world.activeIndoorMovement?.recordId);
    if (!movement || movement.status !== 'active') return { ok: false, reason: 'No visible indoor route is active.' };
    const remaining = movement.route.steps.slice(movement.currentStepIndex);
    remaining.forEach((step) => {
      spendMovementMinutes(world, movement, step.minutes);
      applyMovementStep(world, movement, step);
      movement.currentStepIndex += 1;
      maybeOfferEncounter(world, { preferredPersonId: world.presenceState.experimentHostId, cause: 'shared indoor route moment' });
    });
    movement.history.push({ at: stamp(world), type: 'remaining_route_compressed', message: 'The remaining lawful indoor route was compressed with unchanged time, stair, presence, and encounter evidence.' });
    return completeMovement(world, movement);
  }

  function arriveFromStreetTravel(world, placeId, details = {}) {
    ensureState(world);
    const place = World.getPlace(world, placeId);
    const building = Shells?.buildingForPlace(world, placeId);
    if (!place) return null;
    const value = setPresence(world, 'player', {
      kind: 'street_threshold', placeId, buildingId: building?.id || null, storeyId: null, level: 0,
      routeNodeId: place.shellRef?.streetAccessNodeId || null, roomId: null,
      activity: 'outside the entrance', accessBasis: 'threshold_only', privacy: 'public', observableScope: 'self',
      source: details.travelRecordId || 'street_travel'
    });
    const record = {
      schema: MOVEMENT_SCHEMA,
      id: presenceUniqueId(world, 'threshold_arrival'),
      actorId: 'player', kind: 'arrival', mode: details.mode || 'bundled', status: 'completed',
      placeId, buildingId: building?.id || null, startedAt: stamp(world), completedAt: stamp(world),
      currentStepIndex: 0, elapsedMinutes: 0,
      route: { buildingId: building?.id || null, placeId, direction: 'street_threshold_only', steps: [], totalMinutes: 0, stairSteps: 0 },
      access: { basis: 'threshold_only', sourceId: details.travelRecordId || null, authority: { tenancy: false, ownership: false, edit: false, storage: false, household: false, care: false, surveillance: false } },
      noWatchingReward: true, noAuthorityFromPresence: true,
      history: [{ at: stamp(world), type: 'threshold_arrival', message: 'Street travel reached the address. Interior permission was not assumed.' }]
    };
    world.presenceRecords.push(record);
    if (world.presenceRecords.length > 600) world.presenceRecords.splice(0, world.presenceRecords.length - 600);
    return value;
  }

  function reconcilePlayerPresence(world, reason = 'system action') {
    ensureState(world);
    if (world.activeTravel || world.activeIndoorMovement) return presenceFor(world, 'player');
    const current = presenceFor(world, 'player');
    const placeId = world.player.locationId || world.player.homePropertyId;
    const place = World.getPlace(world, placeId);
    if (!place) return current;
    if (current?.placeId === placeId && current.schema === PRESENCE_SCHEMA) return current;
    const { building, continuity, storey } = buildingContext(world, placeId);
    if (place.kind !== 'residential') {
      return setPresence(world, 'player', {
        kind: 'public_interior', placeId, buildingId: building?.id || null, storeyId: continuity?.primaryStoreyId || null,
        level: storey?.level ?? 0, routeNodeId: continuity?.unitRouteNodeId || null, roomId: null,
        activity: reason.replace(/[-_]/g, ' '), accessBasis: 'public_or_scheduled_place', privacy: 'public', observableScope: 'self', source: reason
      });
    }
    const access = accessFor(world, 'player', placeId);
    if (access.ok && ['resident', 'owner_of_vacant_place', 'accepted_home_visit', 'accepted_presence_grant'].includes(access.basis)) {
      const roomId = defaultEntryRoom(world, placeId);
      return setPresence(world, 'player', {
        kind: 'room', placeId, buildingId: building?.id || null, storeyId: continuity?.primaryStoreyId || null,
        level: storey?.level ?? 0, routeNodeId: continuity?.unitRouteNodeId || null, roomId,
        activity: reason.replace(/[-_]/g, ' '), accessBasis: access.basis, privacy: 'private', observableScope: 'self', source: reason
      });
    }
    return setPresence(world, 'player', {
      kind: 'street_threshold', placeId, buildingId: building?.id || null, storeyId: null, level: 0,
      routeNodeId: place.shellRef?.streetAccessNodeId || null, roomId: null,
      activity: 'outside the entrance', accessBasis: 'threshold_only', privacy: 'public', observableScope: 'self', source: reason
    });
  }

  function reconcileNpcPresence(world, npc, previousPlaceId = null, options = {}) {
    ensureState(world);
    if (!npc) return null;
    const before = presenceFor(world, npc.id);
    const next = coarsePresenceForPerson(world, npc, { source: options.source || 'hourly_schedule' });
    if (!next) return before;
    const changedPlace = before?.placeId && before.placeId !== next.placeId;
    const tracked = world.presenceState.trackedBuildingIds.includes(next.buildingId) || world.presenceState.trackedBuildingIds.includes(before?.buildingId);
    const value = setPresence(world, npc.id, next, { recordTransition: tracked });
    if (changedPlace && tracked) {
      const route = shellRouteSteps(world, next.placeId, 'arrival');
      if (route) {
        const access = accessFor(world, npc.id, next.placeId);
        const record = createMovement(world, npc.id, 'arrival', 'schedule', route, access.ok ? access : { basis: next.accessBasis, authority: {} });
        record.elapsedMinutes = route.totalMinutes;
        record.completedAt = stamp(world);
        record.status = 'completed';
        record.currentStepIndex = route.steps.length;
        record.history.push({ at: stamp(world), type: 'schedule_resolution', message: 'Arrival was resolved at hourly schedule scale rather than minute-by-minute animation.' });
        world.metrics.indoorMovementMinutes += route.totalMinutes;
        world.metrics.indoorStairUses += route.stairSteps;
        world.metrics.indoorMovementsCompleted += 1;
      }
    }
    return value;
  }

  function presenceLabel(world, presence, options = {}) {
    if (!presence) return 'No current presence evidence';
    const place = World.getPlace(world, presence.placeId);
    const building = Shells?.buildingById(world, presence.buildingId);
    const room = place?.kind === 'residential' && presence.roomId ? Habitats?.roomById(place, presence.roomId) : null;
    if (options.coarsePrivate) return `${place?.name || presence.placeId} · inside private space (room not disclosed)`;
    if (presence.kind === 'street_threshold') return `${place?.name || presence.placeId} · outside the entrance`;
    if (presence.kind === 'building_route') return `${building?.name || 'Building'} · ${presence.activity || 'shared route'}${presence.level == null ? '' : ` · storey ${presence.level + 1}`}`;
    if (presence.kind === 'place_entry') return `${place?.name || presence.placeId} · entry`;
    if (presence.kind === 'room') return `${place?.name || presence.placeId} · ${room?.name || 'room'}`;
    if (presence.kind === 'private_interior_coarse') return `${place?.name || presence.placeId} · inside private space (room not recorded)`;
    return `${place?.name || presence.placeId} · inside`;
  }

  function sameObservableSpace(world, a, b) {
    if (!a || !b || a.placeId !== b.placeId) return false;
    const place = World.getPlace(world, a.placeId);
    if (!place) return false;
    if (place.kind !== 'residential') return true;
    if (a.kind === 'building_route' && b.kind === 'building_route') return a.routeNodeId === b.routeNodeId || (a.level != null && a.level === b.level);
    if (a.kind === 'street_threshold' && b.kind === 'street_threshold') return true;
    if (a.kind === 'private_interior_coarse' || b.kind === 'private_interior_coarse') return false;
    if (a.kind === 'room' && b.kind === 'room') {
      if (a.roomId !== b.roomId) return false;
      const permission = permissionForRoom(world, place, a.roomId);
      return !permission || permission.kind === 'common' || (permission.holderIds || []).includes('player');
    }
    return ['place_entry', 'public_interior'].includes(a.kind) && ['place_entry', 'public_interior'].includes(b.kind);
  }

  function visiblePresencesForPlayer(world) {
    ensureState(world);
    const playerPresence = presenceFor(world, 'player');
    const results = [];
    (world.people || []).forEach((person) => {
      const presence = presenceFor(world, person.id);
      if (!presence) return;
      if (sameObservableSpace(world, playerPresence, presence)) {
        results.push({ person, presence, disclosure: 'co_present', label: presenceLabel(world, presence) });
        return;
      }
      if (presence.placeId === playerPresence?.placeId && World.getProperty(world, presence.placeId)) {
        const property = World.getProperty(world, presence.placeId);
        const lawfulSharedHome = (property.tenants || []).includes('player') && (property.tenants || []).includes(person.id);
        if (lawfulSharedHome) {
          results.push({ person, presence, disclosure: 'private_coarse', label: presenceLabel(world, presence, { coarsePrivate: true }) });
        }
      }
    });
    return results.sort((a, b) => a.person.name.localeCompare(b.person.name));
  }

  function openEncounter(world) {
    return (world.ordinaryEncounters || []).find((entry) => entry.status === 'awaiting_player') || null;
  }

  function encounterById(world, encounterId) {
    return (world.ordinaryEncounters || []).find((entry) => entry.id === encounterId) || null;
  }

  function offerEncounter(world, personId, options = {}) {
    ensureState(world);
    if (openEncounter(world)) return null;
    const person = World.getPerson(world, personId);
    const playerPresence = presenceFor(world, 'player');
    const otherPresence = presenceFor(world, personId);
    if (!person || !sameObservableSpace(world, playerPresence, otherPresence)) return null;
    const template = ENCOUNTER_KINDS[Core.hashString(`${world.seed}|${world.time.day}|${world.time.hour}|${personId}|${options.cause || 'ordinary'}`) % ENCOUNTER_KINDS.length];
    const encounter = {
      schema: ENCOUNTER_SCHEMA,
      id: presenceUniqueId(world, 'ordinary_encounter'),
      kind: template.id,
      title: template.title,
      text: template.text,
      actorIds: ['player', personId],
      placeId: playerPresence.placeId,
      buildingId: playerPresence.buildingId,
      roomId: playerPresence.roomId && playerPresence.roomId === otherPresence.roomId ? playerPresence.roomId : null,
      routeNodeId: playerPresence.routeNodeId && playerPresence.routeNodeId === otherPresence.routeNodeId ? playerPresence.routeNodeId : null,
      offeredAt: stamp(world),
      status: 'awaiting_player',
      response: null,
      resolvedAt: null,
      noResponseRequired: true,
      noRelationshipPenalty: true,
      noWatchingReward: true,
      authority: { tenancy: false, ownership: false, edit: false, storage: false, household: false, care: false, surveillance: false },
      history: [{ at: stamp(world), type: 'offered', message: 'A bounded ordinary encounter became available. Ignoring or declining it changes no relationship score.' }]
    };
    world.ordinaryEncounters.push(encounter);
    if (world.ordinaryEncounters.length > 180) world.ordinaryEncounters.splice(0, world.ordinaryEncounters.length - 180);
    world.ui.selectedEncounterId = encounter.id;
    world.metrics.encountersOffered += 1;
    world.presenceState.lastSpontaneousEncounterAt = absoluteMinutes(stamp(world));
    Core.appendLedger(world, 'ordinary_encounter', `${person.name} and ${world.player.name} briefly shared the same ordinary space. A greeting was optional and created no authority.`, {
      actorIds: encounter.actorIds, placeId: encounter.placeId,
      causes: [options.cause || 'lawful co-presence', 'no compulsory greeting'], evidence: { encounterId: encounter.id }
    });
    return encounter;
  }

  function maybeOfferEncounter(world, options = {}) {
    ensureState(world);
    if (openEncounter(world)) return null;
    const visible = visiblePresencesForPlayer(world).filter((entry) => entry.disclosure === 'co_present' && !AXM.Family?.isDependent(entry.person));
    if (!visible.length) return null;
    let chosen = options.preferredPersonId ? visible.find((entry) => entry.person.id === options.preferredPersonId) : null;
    const now = absoluteMinutes(stamp(world));
    if (!chosen) {
      if (now - world.presenceState.lastSpontaneousEncounterAt < 360) return null;
      const chance = stableRoll(`${world.seed}|${world.time.day}|${world.time.hour}|${visible.map((entry) => entry.person.id).join('|')}|encounter`);
      if (chance > 0.14) return null;
      chosen = visible[Core.hashString(`${world.seed}|${world.time.day}|${world.time.hour}|encounter-choice`) % visible.length];
    }
    return offerEncounter(world, chosen.person.id, options);
  }

  function respondToOrdinaryEncounter(world, encounterId, response) {
    ensureState(world);
    const encounter = encounterById(world, encounterId);
    if (!encounter || encounter.status !== 'awaiting_player') return { ok: false, reason: 'That ordinary encounter is no longer awaiting a response.' };
    if (!['greet', 'quiet', 'decline'].includes(response)) return { ok: false, reason: 'Choose greet, quiet acknowledgment, or decline.' };
    const personId = encounter.actorIds.find((id) => id !== 'player');
    const hadRelationBefore = Object.prototype.hasOwnProperty.call(world.player.relationships || {}, personId);
    const relationBefore = hadRelationBefore ? Core.deepClone(world.player.relationships[personId]) : null;
    const playerBefore = { money: world.player.money, needs: Core.deepClone(world.player.needs), time: stamp(world) };
    encounter.response = response;
    encounter.resolvedAt = stamp(world);
    if (response === 'greet') {
      encounter.status = 'greeted';
      Systems.advanceMinutes(world, 5, { ordinaryEncounter: true });
      const relation = Systems.getRelation(world.player, personId);
      relation.friendship = Core.clamp((relation.friendship || 0) + 1.2, -100, 100);
      relation.trust = Core.clamp((relation.trust || 0) + 0.4, -100, 100);
      relation.interactions = (relation.interactions || 0) + 1;
      relation.lastInteractionDay = world.time.day;
      world.player.needs.social = Core.clamp(world.player.needs.social + 3, 0, 100);
      world.player.needs.mood = Core.clamp(world.player.needs.mood + 1.5, 0, 100);
      world.metrics.encountersGreeted += 1;
      encounter.history.push({ at: stamp(world), type: 'greeted', message: 'The player explicitly chose a five-minute hello. Any social effect came from that choice, not from watching movement.' });
      Systems.toast(world, 'You shared a small hello. Nothing became a recurring duty.', 'success');
    } else if (response === 'quiet') {
      encounter.status = 'quietly_acknowledged';
      world.metrics.encountersQuiet += 1;
      encounter.history.push({ at: stamp(world), type: 'quiet', message: 'A quiet acknowledgment was recorded without time, reward, or relationship manipulation.' });
      Systems.toast(world, 'A quiet acknowledgment was enough.', 'info');
    } else {
      encounter.status = 'declined';
      world.metrics.encountersDeclined += 1;
      encounter.history.push({ at: stamp(world), type: 'declined', message: 'The encounter was declined without time, need, money, reputation, or relationship effects.' });
      Systems.toast(world, 'Not now was accepted without a hidden penalty.', 'info');
    }
    if (response !== 'greet') {
      const hasRelationAfter = Object.prototype.hasOwnProperty.call(world.player.relationships || {}, personId);
      const relationAfter = hasRelationAfter ? world.player.relationships[personId] : null;
      if (hasRelationAfter !== hadRelationBefore
        || JSON.stringify(relationAfter) !== JSON.stringify(relationBefore)
        || world.player.money !== playerBefore.money
        || JSON.stringify(world.player.needs) !== JSON.stringify(playerBefore.needs)
        || JSON.stringify(stamp(world)) !== JSON.stringify(playerBefore.time)) {
        throw new Error('A refusal-safe ordinary encounter changed protected state. The response was blocked.');
      }
    }
    return { ok: true, encounter };
  }

  function passEncounter(world, encounter, reason = 'the ordinary moment passed') {
    if (!encounter || encounter.status !== 'awaiting_player') return false;
    encounter.status = 'passed';
    encounter.resolvedAt = stamp(world);
    encounter.response = 'none_required';
    encounter.history.push({ at: stamp(world), type: 'passed', message: `${reason}. No relationship, need, money, reputation, or progression effect occurred.` });
    world.metrics.encountersPassed += 1;
    return true;
  }

  function createAccessGrant(world, hostId, guestId, placeId, options = {}) {
    ensureState(world);
    const host = World.getPerson(world, hostId);
    const guest = World.getPerson(world, guestId);
    const property = World.getProperty(world, placeId);
    if (!host || !guest || !property || !(property.tenants || []).includes(hostId)) return { ok: false, reason: 'A valid resident host, guest, and occupied home are required.' };
    const grant = {
      schema: ACCESS_GRANT_SCHEMA,
      id: presenceUniqueId(world, 'presence_access'),
      hostId,
      guestId,
      placeId,
      status: 'accepted',
      createdAt: stamp(world),
      expiresAt: { day: world.time.day + Math.max(1, Math.floor(options.days || 2)), hour: 23, minute: 59 },
      purpose: options.purpose || 'ordinary_visit',
      sharedRoomPurposes: ['entry', 'living', 'kitchen', 'hobby', 'flexible'],
      authority: { tenancy: false, ownership: false, edit: false, storage: false, household: false, care: false, surveillance: false },
      history: [{ at: stamp(world), type: 'accepted', message: 'A bounded visit access grant was recorded. It grants shared-space entry only.' }]
    };
    world.presenceAccessGrants.push(grant);
    world.metrics.accessGrantsCreated += 1;
    return { ok: true, grant };
  }

  function prepareLivedBuildingExperiment(world) {
    ensureState(world);
    if (world.flags.presenceExperimentPrepared) return { ok: false, reason: 'The labeled lived-building experiment was already prepared.' };
    const property = World.getProperty(world, 'home_rooftop');
    const hostId = property?.tenants?.[0];
    const host = World.getPerson(world, hostId);
    if (!property || !host) return { ok: false, reason: 'The occupied upper walk-up needed for the experiment is unavailable.' };
    const grantResult = createAccessGrant(world, host.id, 'player', property.id, { days: 2, purpose: 'labeled_lived_building_qa' });
    if (!grantResult.ok) return grantResult;
    const origin = world.player.locationId;
    if (origin !== property.id) AXM.Exteriors?.recordBundledTravel(world, 'player', origin, property.id, 'labeled lived-building experiment setup');
    world.player.locationId = property.id;
    arriveFromStreetTravel(world, property.id, { mode: 'bundled', travelRecordId: null });
    host.locationId = property.id;
    host.activity = 'briefly using the shared landing';
    const { building, continuity, storey } = buildingContext(world, property.id);
    const experimentRoute = shellRouteSteps(world, property.id, 'arrival');
    const sharedStep = experimentRoute?.steps?.find((step) => step.kind === 'stairs')
      || experimentRoute?.steps?.find((step) => step.kind === 'landing')
      || experimentRoute?.steps?.[Math.max(0, (experimentRoute?.steps?.length || 1) - 2)]
      || null;
    setPresence(world, host.id, {
      kind: 'building_route', placeId: property.id, buildingId: building?.id || null, storeyId: continuity?.primaryStoreyId || null,
      level: sharedStep?.level ?? storey?.level ?? 1, routeNodeId: sharedStep?.toNodeId || continuity?.unitRouteNodeId || null, roomId: null,
      activity: 'briefly using the shared landing', accessBasis: 'resident', privacy: 'shared_route', observableScope: 'co_present', source: 'labeled_presence_experiment'
    });
    world.presenceState.experimentHostId = host.id;
    world.presenceState.experimentPlaceId = property.id;
    world.presenceState.experimentHostUntil = absoluteMinutes(stamp(world)) + 60;
    world.flags.presenceExperimentPrepared = true;
    world.metrics.presenceExperimentRuns += 1;
    world.ui.selectedPresenceBuildingId = building?.id || null;
    world.ui.selectedPresencePlaceId = property.id;
    Core.appendLedger(world, 'research', 'A labeled lived-building experiment prepared a bounded accepted visit to an occupied upper walk-up and placed the player outside its real entrance route. No tenancy, ownership, edit, storage, household, care, or surveillance authority was granted.', {
      actorIds: ['player', host.id], placeId: property.id,
      causes: ['explicit QA shortcut', 'real stair route', 'refusal-safe encounter test'],
      evidence: { accessGrantId: grantResult.grant.id, buildingId: building?.id || null, hostId: host.id }
    });
    Systems.toast(world, 'Lived-building experiment prepared outside an occupied upper walk-up. Enter visibly or compressed.', 'warning');
    return { ok: true, propertyId: property.id, buildingId: building?.id || null, hostId: host.id, grantId: grantResult.grant.id };
  }

  function hourlyTick(world) {
    ensureState(world);
    const playerPresence = presenceFor(world, 'player');
    const pending = openEncounter(world);
    if (pending) {
      const otherId = pending.actorIds.find((id) => id !== 'player');
      if (!sameObservableSpace(world, playerPresence, presenceFor(world, otherId))
        || absoluteMinutes(stamp(world)) - absoluteMinutes(pending.offeredAt) > 360) {
        passEncounter(world, pending, 'The shared moment passed while ordinary life continued');
      }
    }
    maybeOfferEncounter(world, { cause: 'bounded hourly co-presence' });
    const cutoff = absoluteMinutes(stamp(world)) - 1440 * 21;
    if (world.presenceRecords.length > 500) {
      const keep = world.presenceRecords.filter((entry) => entry.status === 'active' || absoluteMinutes(entry.completedAt || entry.startedAt) >= cutoff);
      world.presenceRecords = keep.slice(-600);
    }
  }

  function dailyTick(world) {
    ensureState(world);
    const now = absoluteMinutes(stamp(world));
    world.presenceAccessGrants.forEach((grant) => {
      if (grant.status === 'accepted' && absoluteMinutes(grant.expiresAt) < now) {
        grant.status = 'expired';
        grant.history.push({ at: stamp(world), type: 'expired', message: 'The bounded access window ended without changing any relationship or legal authority.' });
      }
    });
    const pending = openEncounter(world);
    if (pending && absoluteMinutes(stamp(world)) - absoluteMinutes(pending.offeredAt) > 360) passEncounter(world, pending, 'The ordinary moment passed without requiring a response');
  }

  function handleOutdoorArrival(world, destinationPlaceId, details = {}) {
    const presence = arriveFromStreetTravel(world, destinationPlaceId, {
      mode: details.outdoorMode || 'bundled',
      travelRecordId: details.externalTravelId || null
    });
    return { ok: Boolean(presence), presence };
  }

  function syncNpcSchedule(world, personId, previousPlaceId, nextPlaceId, activity, externalRecordId = null) {
    ensureState(world);
    const person = World.getPerson(world, personId);
    if (!person) return null;
    if (personId === world.presenceState.experimentHostId
      && absoluteMinutes(stamp(world)) <= world.presenceState.experimentHostUntil
      && !world.ordinaryEncounters.some((entry) => entry.actorIds?.includes(personId) && entry.status !== 'awaiting_player')) {
      return presenceFor(world, personId);
    }
    const value = reconcileNpcPresence(world, person, previousPlaceId, { source: externalRecordId || 'hourly_schedule' });
    if (value && previousPlaceId && previousPlaceId !== nextPlaceId) {
      world.metrics.npcIndoorTransitions = (world.metrics.npcIndoorTransitions || 0) + 1;
    }
    return value;
  }

  function reconcileAll(world, reason = 'presence reconciliation') {
    ensureState(world);
    reconcilePlayerPresence(world, reason);
    (world.people || []).forEach((person) => reconcileNpcPresence(world, person, person.locationId, { source: reason }));
    return world;
  }

  function metrics(world) {
    ensureState(world);
    const playerPresence = presenceFor(world, 'player');
    const visible = visiblePresencesForPlayer(world);
    const completed = world.metrics.indoorMovementsCompleted || 0;
    const awaiting = world.ordinaryEncounters.filter((entry) => entry.status === 'awaiting_player').length;
    const accepted = (world.metrics.encountersGreeted || 0) + (world.metrics.encountersQuiet || 0);
    const declined = world.metrics.encountersDeclined || 0;
    return {
      trackedBuildings: world.presenceState.trackedBuildingIds.length,
      presenceSnapshots: Object.keys(world.presenceByPerson).length,
      presenceRecords: world.presenceRecords.length,
      playerInside: Boolean(playerPresence && playerPresence.kind !== 'street_threshold'),
      playerPresenceKind: playerPresence?.kind || null,
      visiblePeople: visible.length,
      exactCoPresentPeople: visible.filter((entry) => entry.disclosure === 'co_present').length,
      privacyCoarsenedPeople: visible.filter((entry) => entry.disclosure === 'private_coarse').length,
      activeIndoorMovement: Boolean(world.activeIndoorMovement),
      indoorMovements: completed,
      playerIndoorMovements: (world.presenceRecords || []).filter((entry) => entry.actorId === 'player').length,
      playerVisibleIndoorMovements: world.metrics.indoorVisibleMovements || 0,
      playerCompressedIndoorMovements: world.metrics.indoorCompressedMovements || 0,
      npcIndoorTransitions: world.metrics.npcIndoorTransitions || 0,
      stairUses: world.metrics.indoorStairUses || 0,
      encountersAwaiting: awaiting,
      pendingEncounters: awaiting,
      encountersOffered: world.metrics.encountersOffered || 0,
      encountersAccepted: accepted,
      encountersDeclined: declined,
      presenceCompressionAllowed: world.settings.presenceCompressionAllowed === true,
      compressionAllowed: world.settings.presenceCompressionAllowed === true,
      compulsoryGreetings: world.settings.compulsoryGreetings === true,
      watchingReward: world.settings.presenceWatchingReward === true,
      surveillance: world.settings.presenceSurveillance === true,
      minuteByMinuteTax: world.settings.minuteByMinutePresenceTax === true
    };
  }

  function validate(world, add) {
    if (!world.presenceState || typeof world.presenceState !== 'object') add('presenceState must be an object.');
    if (!world.presenceByPerson || typeof world.presenceByPerson !== 'object' || Array.isArray(world.presenceByPerson)) add('presenceByPerson must be an object.');
    if (!Array.isArray(world.presenceRecords)) add('presenceRecords must be an array.');
    if (!Array.isArray(world.ordinaryEncounters)) add('ordinaryEncounters must be an array.');
    if (!Array.isArray(world.presenceAccessGrants)) add('presenceAccessGrants must be an array.');
    if (world.settings?.indoorMovementCompressionAllowed !== true || world.settings?.presenceCompressionAllowed !== true) add('Indoor presence compression must remain available.');
    if (world.settings?.compulsoryGreetings !== false) add('Greetings cannot become compulsory.');
    if (world.settings?.presenceViewCreatesRewards !== false || world.settings?.presenceWatchingReward !== false) add('Watching indoor movement cannot gain a hidden reward flag.');
    if (world.settings?.remotePrivateRoomVisibility !== false || world.settings?.presenceSurveillance !== false) add('Presence cannot become a remote private-room surveillance view.');
    if (world.settings?.continuousRoomTracking !== false || world.settings?.minuteByMinutePresenceTax !== false) add('Distant residents cannot require minute-by-minute room tracking.');
    if (world.settings?.presenceGrantsAuthority !== false) add('Presence cannot grant authority.');
    if (world.settings?.socialChecklist !== false) add('Ordinary presence cannot become a social checklist.');
    if (world.settings?.presenceMovementObligation !== false) add('Indoor movement cannot become an obligation.');
    const people = new Set(personIds(world));
    const places = new Set((world.places || []).map((place) => place.id));
    const buildings = new Set((world.buildings || []).map((building) => building.id));
    if (!world.presenceByPerson?.player) add('The player must retain a current presence snapshot.');
    // Autonomous residents may briefly lack a snapshot immediately after a new person is created.
    // The next bounded schedule reconciliation adds one without requiring continuous tracking.
    Object.entries(world.presenceByPerson || {}).forEach(([personId, presence]) => {
      if (!people.has(personId)) add(`Presence snapshot references unknown person ${personId}.`);
      if (presence?.schema !== PRESENCE_SCHEMA) add(`${personId} has invalid presence schema.`);
      if (!PRESENCE_KINDS.includes(presence?.kind)) add(`${personId} has invalid presence kind.`);
      if (!places.has(presence?.placeId)) add(`${personId} presence points to unknown place.`);
      if (presence?.buildingId && !buildings.has(presence.buildingId)) add(`${personId} presence points to unknown building.`);
      const place = World.getPlace(world, presence?.placeId);
      if (presence?.roomId && (!place || place.kind !== 'residential' || !Habitats?.roomById(place, presence.roomId))) add(`${personId} presence points to an unknown room.`);
      if (presence?.privacy === 'private' && presence?.observableScope === 'public') add(`${personId} private presence is incorrectly marked public.`);
      if (personId !== 'player' && World.getProperty(world, presence?.placeId) && presence?.privacy === 'private' && presence?.roomId) add(`${personId} retains a private room ID despite continuous private tracking being disabled.`);
    });
    const movementIds = new Set();
    (world.presenceRecords || []).forEach((movement) => {
      if (!movement.id || movementIds.has(movement.id)) add(`Duplicate or missing indoor movement id ${String(movement.id)}.`);
      movementIds.add(movement.id);
      if (movement.schema !== MOVEMENT_SCHEMA) add(`${movement.id} has invalid indoor movement schema.`);
      if (!people.has(movement.actorId)) add(`${movement.id} has unknown actor.`);
      if (!MOVEMENT_KINDS.includes(movement.kind)) add(`${movement.id} has invalid movement kind.`);
      if (!MOVEMENT_MODES.includes(movement.mode)) add(`${movement.id} has invalid movement mode.`);
      if (!MOVEMENT_STATUSES.includes(movement.status)) add(`${movement.id} has invalid movement status.`);
      if (!places.has(movement.placeId) || !buildings.has(movement.buildingId)) add(`${movement.id} has invalid place or building.`);
      if (!Array.isArray(movement.route?.steps)) add(`${movement.id} route steps must be an array.`);
      if (!Number.isFinite(movement.elapsedMinutes) || movement.elapsedMinutes < 0) add(`${movement.id} has invalid elapsed minutes.`);
      if (movement.noWatchingReward !== true || movement.noAuthorityFromPresence !== true) add(`${movement.id} does not preserve no-watching-reward and no-authority roots.`);
      if (movement.status === 'active' && world.activeIndoorMovement?.recordId !== movement.id) add(`${movement.id} is active without the activeIndoorMovement pointer.`);
      if (movement.access?.authority?.surveillance === true || (movement.access?.authority?.edit === true && movement.access?.basis?.includes('visit'))) add(`${movement.id} grants invalid authority from presence.`);
    });
    if (world.activeIndoorMovement && !movementIds.has(world.activeIndoorMovement.recordId)) add('activeIndoorMovement points to an unknown movement record.');
    const encounterIds = new Set();
    (world.ordinaryEncounters || []).forEach((encounter) => {
      if (!encounter.id || encounterIds.has(encounter.id)) add(`Duplicate or missing encounter id ${String(encounter.id)}.`);
      encounterIds.add(encounter.id);
      if (encounter.schema !== ENCOUNTER_SCHEMA) add(`${encounter.id} has invalid encounter schema.`);
      if (!ENCOUNTER_STATUSES.includes(encounter.status)) add(`${encounter.id} has invalid encounter status.`);
      if (!Array.isArray(encounter.actorIds) || encounter.actorIds.length !== 2 || encounter.actorIds.some((id) => !people.has(id))) add(`${encounter.id} has invalid actors.`);
      if (!places.has(encounter.placeId)) add(`${encounter.id} has invalid place.`);
      if (encounter.noRelationshipPenalty !== true || encounter.noResponseRequired !== true || encounter.noWatchingReward !== true) add(`${encounter.id} violates refusal-safe encounter roots.`);
      if (Object.values(encounter.authority || {}).some(Boolean)) add(`${encounter.id} grants authority through ordinary presence.`);
    });
    const grantIds = new Set();
    (world.presenceAccessGrants || []).forEach((grant) => {
      if (!grant.id || grantIds.has(grant.id)) add(`Duplicate or missing presence access grant id ${String(grant.id)}.`);
      grantIds.add(grant.id);
      if (grant.schema !== ACCESS_GRANT_SCHEMA) add(`${grant.id} has invalid access grant schema.`);
      if (!people.has(grant.hostId) || !people.has(grant.guestId) || !places.has(grant.placeId)) add(`${grant.id} has invalid people or place.`);
      if (!ACCESS_STATUSES.includes(grant.status)) add(`${grant.id} has invalid access status.`);
      if (Object.values(grant.authority || {}).some(Boolean)) add(`${grant.id} grants prohibited authority.`);
    });
  }

  Object.assign(Systems, {
    startPlayerJourney,
    startIndoorArrival,
    startIndoorDeparture,
    startRoomTransition,
    stepIndoorMovement,
    finishIndoorMovementCompressed,
    respondToOrdinaryEncounter,
    prepareLivedBuildingExperiment
  });

  AXM.Presence = {
    PRESENCE_SCHEMA,
    MOVEMENT_SCHEMA,
    ENCOUNTER_SCHEMA,
    ACCESS_GRANT_SCHEMA,
    PRESENCE_KINDS,
    MOVEMENT_KINDS,
    MOVEMENT_MODES,
    MOVEMENT_STATUSES,
    ENCOUNTER_STATUSES,
    ACCESS_STATUSES,
    initializeWorld,
    ensureState,
    hourlyTick,
    dailyTick,
    presenceFor,
    setPresence,
    accessFor,
    roomAccessFor,
    accessibleRooms(world, personId, propertyId) {
      const property = World.getProperty(world, propertyId);
      const access = accessFor(world, personId, propertyId);
      return (property?.habitat?.rooms || []).filter((room) => roomAccessFor(world, personId, property, room.id, access).ok);
    },
    routeRoomGraph,
    shellRouteSteps,
    roomRouteSteps,
    movementById,
    encounterById,
    openEncounter,
    startPlayerJourney,
    startIndoorArrival,
    startIndoorDeparture,
    startRoomTransition,
    stepIndoorMovement,
    finishIndoorMovementCompressed,
    arriveFromStreetTravel,
    handleOutdoorArrival,
    reconcilePlayerPresence,
    reconcileNpcPresence,
    syncNpcSchedule,
    reconcileAll,
    visiblePresencesForPlayer,
    presenceLabel,
    sameObservableSpace,
    offerEncounter,
    maybeOfferEncounter,
    respondToOrdinaryEncounter,
    createAccessGrant,
    prepareLivedBuildingExperiment,
    metrics,
    validate,
    stamp,
    absoluteMinutes
  };
}(typeof window !== 'undefined' ? window : globalThis));
