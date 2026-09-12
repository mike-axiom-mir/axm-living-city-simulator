(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Habitats = AXM.Habitats;
  const Shells = AXM.Shells;
  const Presence = AXM.Presence;

  const VISUAL_SCHEMA = 'axm.living-city.visual-scene/v0.11.2';
  const VISUAL_ACTIVITY_RECEIPT_SCHEMA = 'axm.living-city.visual-activity-receipt/v0.11.2';
  const MODES = ['auto', 'room', 'building', 'street'];
  const MOTION_LEVELS = ['full', 'gentle', 'still'];
  const ROOM_ACTIVITY_RULES = [
    { actionId: 'sleep', kinds: ['bed'], purposes: ['sleep'], reason: 'Use a real bed placed in this sleeping room.' },
    { actionId: 'shower', kinds: ['water'], purposes: ['bathroom'], utility: 'water', reason: 'Use this room’s real water and waste access.' },
    { actionId: 'eat_home', kinds: ['kitchen'], purposes: ['living'], reason: 'Use the home’s existing basic meal setup; a real kitchenette anchors it when one is placed here.' },
    { actionId: 'play_pc', kinds: ['screen'], purposes: [], excludePurposes: ['bathroom'], reason: 'Use a computer already placed in this room.' },
    { actionId: 'study_focus', kinds: ['screen', 'table', 'storage'], purposes: ['work'], excludePurposes: ['bathroom'], reason: 'Settle at a real work surface or study object here.' },
    { actionId: 'creative_time', kinds: ['table', 'music', 'screen'], purposes: ['work', 'living'], excludePurposes: ['bathroom'], reason: 'Make something with the room and objects already available.' },
    { actionId: 'clean_home', kinds: [], purposes: ['sleep', 'bathroom', 'living', 'work'], reason: 'Begin whole-home care here; the existing activity maintains the home without replacing anything.' }
  ];

  function ensureUiState(world) {
    world.ui = world.ui || {};
    if (!MODES.includes(world.ui.visualSceneMode)) world.ui.visualSceneMode = 'auto';
    if (world.ui.selectedVisualRoomId === undefined) world.ui.selectedVisualRoomId = null;
    if (world.ui.selectedVisualObjectId === undefined) world.ui.selectedVisualObjectId = null;
    if (world.ui.pendingVisualActivity === undefined) world.ui.pendingVisualActivity = null;
    if (world.ui.lastVisualActivityReceipt === undefined) world.ui.lastVisualActivityReceipt = null;
    if (!MOTION_LEVELS.includes(world.settings?.visualMotion)) {
      world.settings = world.settings || {};
      world.settings.visualMotion = world.settings.reducedMotion ? 'still' : 'full';
    }
  }

  function motionLevel(world, systemPrefersReduced = false) {
    ensureUiState(world);
    if (world.settings.reducedMotion || systemPrefersReduced) return 'still';
    return MOTION_LEVELS.includes(world.settings.visualMotion) ? world.settings.visualMotion : 'full';
  }

  function stableUnit(seed) {
    return (Core.hashString(String(seed)) % 10000) / 10000;
  }

  function paletteColor(object) {
    return Content.paletteById(object?.colorId)?.hex || '#7f929b';
  }

  function catalogName(object) {
    return Content.furnitureById(object?.catalogId)?.name || Core.titleCase(object?.catalogId || 'object');
  }

  function objectKind(object) {
    const id = String(object?.catalogId || 'object');
    if (/bed|mattress/.test(id)) return 'bed';
    if (/chair|sofa/.test(id)) return 'seat';
    if (/table|desk/.test(id)) return 'table';
    if (/lamp/.test(id)) return 'lamp';
    if (/laptop|computer/.test(id)) return 'screen';
    if (/plant/.test(id)) return 'plant';
    if (/rug/.test(id)) return 'rug';
    if (/shelf|crate/.test(id)) return 'storage';
    if (/music/.test(id)) return 'music';
    if (/kitchen|stove|fridge/.test(id)) return 'kitchen';
    if (/sink|shower|bath|toilet/.test(id)) return 'water';
    if (/print|art/.test(id)) return 'wall';
    return 'object';
  }

  function roomBounds(room) {
    const cells = (room?.cells || []).map((key) => Habitats.parseCellKey(key));
    if (!cells.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 2, height: 2 };
    const xs = cells.map((cell) => cell.x);
    const ys = cells.map((cell) => cell.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { minX, minY, maxX, maxY, width: Math.max(1, maxX - minX + 1), height: Math.max(1, maxY - minY + 1) };
  }

  function objectsInRoom(property, room) {
    if (!property || !room) return [];
    const bounds = roomBounds(room);
    return (property.furniture || []).filter((object) => {
      const objectRoom = Habitats.roomAtCell(property, object.position?.x, object.position?.y);
      return objectRoom?.id === room.id;
    }).map((object) => ({
      id: object.id,
      catalogId: object.catalogId,
      name: catalogName(object),
      kind: objectKind(object),
      color: paletteColor(object),
      condition: Number(object.condition) || 0,
      sentimental: Number(object.sentimental) || 0,
      usageHours: Number(object.usageHours) || 0,
      ownerId: object.ownerId || null,
      ownershipMode: object.ownershipMode || null,
      historyCount: Array.isArray(object.history) ? object.history.length : 0,
      rotation: Number(object.rotation) || 0,
      nx: Core.clamp(((object.position?.x || bounds.minX) - bounds.minX + 0.5) / bounds.width, 0.05, 0.95),
      ny: Core.clamp(((object.position?.y || bounds.minY) - bounds.minY + 0.5) / bounds.height, 0.05, 0.95)
    }));
  }

  function roomChoices(world) {
    const property = World.getProperty(world, world.player.homePropertyId);
    return (property?.habitat?.rooms || []).map((room) => ({
      id: room.id,
      name: room.name || `${Core.titleCase(room.purpose)} room`,
      purpose: room.purpose,
      objectCount: objectsInRoom(property, room).length,
      utilities: { ...(room.utilityAccess || {}) }
    }));
  }

  function ruleObject(rule, objects) {
    if (!rule.kinds.length) return null;
    return objects.find((object) => {
      if (!rule.kinds.includes(object.kind)) return false;
      const itemInteractions = AXM.ItemInteractions;
      if (itemInteractions?.objectMatchesAction && !itemInteractions.objectMatchesAction(object, rule.actionId)) return false;
      if (itemInteractions?.directUseAllowed && !itemInteractions.directUseAllowed(object)) return false;
      return true;
    }) || null;
  }

  function roomActivityOptions(world, scene) {
    if (!scene || scene.kind !== 'room' || scene.placeId !== world.player.homePropertyId) return [];
    return ROOM_ACTIVITY_RULES.flatMap((rule) => {
      if ((rule.excludePurposes || []).includes(scene.purpose)) return [];
      const object = ruleObject(rule, scene.objects);
      const purposeMatch = rule.purposes.includes(scene.purpose);
      const utilityMatch = rule.utility && scene.utilities?.[rule.utility] === true;
      const objectMatch = Boolean(object);
      const itemObjectRequired = Boolean(AXM.ItemInteractions?.ACTION_CATALOGS?.[rule.actionId]?.length);
      if (itemObjectRequired && !objectMatch) return [];
      if (!objectMatch && !purposeMatch && !utilityMatch) return [];
      const activity = Content.activityById(rule.actionId);
      if (!activity) return [];
      return [{
        id: activity.id,
        name: activity.name,
        hours: activity.hours,
        cost: activity.cost,
        description: activity.description,
        reason: rule.reason,
        objectId: object?.id || null,
        objectName: object?.name || null
      }];
    });
  }

  function groundedActivityForRoom(world, roomId, actionId, objectId = null) {
    const property = World.getProperty(world, world.player.homePropertyId);
    const room = Habitats.roomById(property, roomId);
    if (!property || !room) return null;
    const scene = {
      kind: 'room',
      placeId: property.id,
      purpose: room.purpose,
      utilities: { ...(room.utilityAccess || {}) },
      objects: objectsInRoom(property, room)
    };
    const option = roomActivityOptions(world, scene).find((entry) => entry.id === actionId) || null;
    if (!option) return null;
    if ((option.objectId || null) !== (objectId || null)) return null;
    return option;
  }

  function recentMomentForRoom(world, placeId, roomId) {
    const receipt = world.ui?.lastVisualActivityReceipt;
    if (!receipt || receipt.schema !== VISUAL_ACTIVITY_RECEIPT_SCHEMA) return null;
    if (receipt.placeId !== placeId || receipt.roomId !== roomId) return null;
    return { ...receipt };
  }

  function actorAppearance(person) {
    const seed = person?.id || 'unknown';
    const colors = ['#82b79a', '#d7a86e', '#8eb4cf', '#c58da5', '#b5a4df', '#d1c27d'];
    return {
      color: person?.id === 'player' ? '#8be0af' : colors[Core.hashString(seed) % colors.length],
      phase: stableUnit(`${seed}:phase`) * Math.PI * 2,
      scale: 0.92 + stableUnit(`${seed}:scale`) * 0.16
    };
  }

  function lawfulActors(world, scenePlaceId, sceneRoomId = null) {
    const current = Presence.presenceFor(world, 'player');
    const actors = [];
    if (current?.placeId === scenePlaceId && (!sceneRoomId || current.roomId === sceneRoomId || current.kind !== 'room')) {
      actors.push({ id: 'player', name: world.player.name, role: 'you', exact: true, ...actorAppearance(world.player) });
    }
    Presence.visiblePresencesForPlayer(world).forEach((entry) => {
      if (entry.disclosure !== 'co_present') return;
      if (entry.presence?.placeId !== scenePlaceId) return;
      if (sceneRoomId && entry.presence?.roomId && entry.presence.roomId !== sceneRoomId) return;
      actors.push({ id: entry.person.id, name: entry.person.name, role: 'co-present resident', exact: true, ...actorAppearance(entry.person) });
    });
    return actors;
  }

  function homeRoomFallback(world, preferredId = null) {
    const property = World.getProperty(world, world.player.homePropertyId);
    const room = Habitats.roomById(property, preferredId)
      || Habitats.roomById(property, world.ui?.selectedVisualRoomId)
      || Habitats.roomById(property, world.ui?.selectedRoomId)
      || property?.habitat?.rooms?.find((entry) => entry.purpose === 'sleep')
      || property?.habitat?.rooms?.[0]
      || null;
    return { property, room };
  }

  function roomScene(world, options = {}) {
    const current = Presence.presenceFor(world, 'player');
    const selectedHomeRoom = options.preferSelection ? homeRoomFallback(world, world.ui?.selectedVisualRoomId) : null;
    let property = selectedHomeRoom?.property || (current?.kind === 'room' ? World.getProperty(world, current.placeId) : null);
    let room = selectedHomeRoom?.room || (property && current.roomId ? Habitats.roomById(property, current.roomId) : null);
    let currentPresence = Boolean(property && room && current?.kind === 'room' && current.placeId === property.id && current.roomId === room.id);
    if (!property || !room) {
      const fallback = homeRoomFallback(world, world.ui?.selectedVisualRoomId);
      property = fallback.property;
      room = fallback.room;
      currentPresence = false;
    }
    if (!property || !room) return null;
    const exactActors = currentPresence ? lawfulActors(world, property.id, room.id) : [];
    const objects = objectsInRoom(property, room);
    const selectedObjectId = objects.some((object) => object.id === world.ui?.selectedVisualObjectId)
      ? world.ui.selectedVisualObjectId
      : null;
    const scene = {
      schema: VISUAL_SCHEMA,
      kind: 'room',
      requestedMode: options.requestedMode || 'room',
      title: room.name || `${Core.titleCase(room.purpose)} room`,
      subtitle: `${property.name} · ${currentPresence ? 'current lawful presence' : 'persistent player-home room browser, not current presence'}`,
      placeId: property.id,
      roomId: room.id,
      currentPresence,
      privacy: currentPresence ? 'lawful self/co-presence only' : 'player-owned view without resident tracking',
      purpose: room.purpose,
      utilities: { ...(room.utilityAccess || {}) },
      finish: { ...(room.finish || {}) },
      objects,
      rooms: property.id === world.player.homePropertyId ? roomChoices(world) : [],
      selectedObjectId,
      actors: exactActors,
      hiddenPrivateResidents: Presence.visiblePresencesForPlayer(world).filter((entry) => entry.disclosure !== 'co_present').length,
      evidence: currentPresence ? 'current presence snapshot + room graph' : 'persistent player-home room graph',
      recentMoment: recentMomentForRoom(world, property.id, room.id),
      noAuthority: true,
      noReward: true
    };
    scene.activities = roomActivityOptions(world, scene);
    return scene;
  }

  function buildingScene(world, options = {}) {
    const current = Presence.presenceFor(world, 'player');
    const currentPlace = World.getPlace(world, current?.placeId || world.player.locationId);
    const building = (current?.buildingId && Shells.buildingById(world, current.buildingId))
      || Shells.buildingById(world, world.ui?.selectedBuildingId)
      || Shells.buildingForPlace(world, currentPlace?.id)
      || Shells.buildingForPlace(world, world.player.homePropertyId);
    if (!building) return null;
    const places = building.placeIds.map((id) => World.getPlace(world, id)).filter(Boolean);
    const active = Presence.movementById(world, world.activeIndoorMovement?.recordId);
    return {
      schema: VISUAL_SCHEMA,
      kind: 'building',
      requestedMode: options.requestedMode || 'building',
      title: building.name,
      subtitle: active?.buildingId === building.id ? 'your active lawful indoor route' : 'persistent shell and coarse occupancy',
      buildingId: building.id,
      storeys: building.storeys.map((storey) => ({
        id: storey.id,
        level: storey.level,
        label: storey.label,
        windows: (storey.openings || []).filter((entry) => entry.type === 'window').length,
        hasDoor: (storey.openings || []).some((entry) => entry.type === 'external_door')
      })),
      roof: building.roof?.style || 'simple',
      placeCount: places.length,
      coarseOccupants: places.reduce((sum, place) => sum + (place.tenants || []).length, 0),
      playerLevel: current?.buildingId === building.id ? current.level : null,
      activeMovement: active?.buildingId === building.id ? {
        kind: active.kind,
        index: active.currentStepIndex,
        total: active.route.steps.length,
        step: active.route.steps[active.currentStepIndex] || null
      } : null,
      evidence: 'building shell + bounded presence state',
      noPrivateRoomTracking: true,
      noAuthority: true,
      noReward: true
    };
  }

  function streetScene(world, options = {}) {
    const selected = World.getPlace(world, world.ui?.selectedPlaceId)
      || World.getPlace(world, world.player.locationId)
      || world.places[0];
    if (!selected) return null;
    const exterior = selected.exterior || {};
    const activeRecord = world.activeTravel ? AXM.Exteriors.recordById(world, world.activeTravel.recordId) : null;
    const recentPublicRoutes = (world.travelRecords || []).filter((record) => record.status !== 'active').slice(-6);
    return {
      schema: VISUAL_SCHEMA,
      kind: 'street',
      requestedMode: options.requestedMode || 'street',
      title: selected.exterior?.address?.street || 'Neighborhood street',
      subtitle: selected.name,
      placeId: selected.id,
      facade: {
        color: selected.color || '#758590',
        windows: exterior.facade?.windowCount || 2,
        roofline: exterior.facade?.roofline || 'flat',
        doorColor: exterior.entrance?.doorColor || '#6d4d3c',
        signText: exterior.facade?.signText || selected.name,
        kind: selected.kind
      },
      address: exterior.address?.label || selected.name,
      playerHere: world.player.locationId === selected.id,
      activeTravel: activeRecord ? {
        id: activeRecord.id,
        progress: activeRecord.route?.nodeIds?.length > 1
          ? activeRecord.currentNodeIndex / (activeRecord.route.nodeIds.length - 1)
          : 1,
        destination: activeRecord.intendedDestinationPlaceId
      } : null,
      ambientRouteCount: recentPublicRoutes.length,
      evidence: 'exterior identity + public route evidence',
      noAuthority: true,
      noReward: true
    };
  }

  function sceneFor(world, requestedMode = null) {
    ensureUiState(world);
    const requested = MODES.includes(requestedMode) ? requestedMode : world.ui.visualSceneMode;
    const current = Presence.presenceFor(world, 'player');
    let mode = requested;
    if (mode === 'auto') {
      if (world.activeIndoorMovement || current?.kind === 'building_route' || current?.kind === 'place_entry') mode = 'building';
      else if (current?.kind === 'room') mode = 'room';
      else mode = 'street';
    }
    const scene = mode === 'room'
      ? roomScene(world, { requestedMode: requested, preferSelection: requested === 'room' })
      : mode === 'building'
        ? buildingScene(world, { requestedMode: requested })
        : streetScene(world, { requestedMode: requested });
    return scene || streetScene(world, { requestedMode: requested });
  }

  function describeScene(scene) {
    if (!scene) return 'No visual scene is available.';
    if (scene.kind === 'room') {
      const actorText = scene.actors.length ? `${scene.actors.length} lawfully visible figure${scene.actors.length === 1 ? '' : 's'}` : 'no claimed present figure';
      const momentText = scene.recentMoment ? ` Last completed moment: ${scene.recentMoment.label}.` : '';
      return `${scene.title}: ${scene.objects.length} persistent objects, ${scene.activities.length} grounded choices, ${actorText}. ${scene.privacy}.${momentText}`;
    }
    if (scene.kind === 'building') {
      return `${scene.title}: ${scene.storeys.length} storeys and ${scene.coarseOccupants} coarse occupants. No private room is exposed.`;
    }
    return `${scene.title}: the persistent exterior of ${scene.subtitle}, with ${scene.ambientRouteCount} recent public route traces available as atmosphere.`;
  }

  function validateScene(scene) {
    const errors = [];
    if (!scene || scene.schema !== VISUAL_SCHEMA) errors.push('Visual scene has an invalid schema.');
    if (!['room', 'building', 'street'].includes(scene?.kind)) errors.push('Visual scene has an invalid kind.');
    if (scene?.noAuthority !== true || scene?.noReward !== true) errors.push('Visual scene must remain non-authoritative and reward-neutral.');
    if (scene?.kind === 'room' && scene.actors.some((actor) => actor.exact !== true)) errors.push('Room scene contains an inexact actor presented as exact.');
    if (scene?.kind === 'room' && scene.selectedObjectId && !scene.objects.some((object) => object.id === scene.selectedObjectId)) errors.push('Selected visual object is not present in the room.');
    if (scene?.kind === 'room' && scene.recentMoment && (
      scene.recentMoment.schema !== VISUAL_ACTIVITY_RECEIPT_SCHEMA
      || scene.recentMoment.source !== 'completed_activity'
      || scene.recentMoment.noExtraReward !== true
      || scene.recentMoment.notCurrentPresence !== true
    )) errors.push('Completed-moment echo is not grounded or reward-neutral.');
    if (scene?.kind === 'room' && scene.recentMoment?.observedEffects && (
      scene.recentMoment.observedEffects.effectsObserved !== true
      || scene.recentMoment.observedEffects.noAddedEffect !== true
      || scene.recentMoment.observedEffects.effectScope !== 'player_and_selected_home_context'
      || !Number.isFinite(scene.recentMoment.observedEffects.timeMinutes)
      || scene.recentMoment.observedEffects.timeMinutes < 0
    )) errors.push('Completed-moment effect summary is not a bounded factual receipt.');
    if (scene?.kind === 'building' && scene.noPrivateRoomTracking !== true) errors.push('Building scene does not preserve private-room coarsening.');
    return { ok: errors.length === 0, errors };
  }

  AXM.Visuals = {
    VISUAL_SCHEMA,
    VISUAL_ACTIVITY_RECEIPT_SCHEMA,
    MODES,
    MOTION_LEVELS,
    ROOM_ACTIVITY_RULES,
    ensureUiState,
    motionLevel,
    stableUnit,
    objectKind,
    roomBounds,
    objectsInRoom,
    roomChoices,
    roomActivityOptions,
    groundedActivityForRoom,
    recentMomentForRoom,
    lawfulActors,
    roomScene,
    buildingScene,
    streetScene,
    sceneFor,
    describeScene,
    validateScene
  };
}(typeof window !== 'undefined' ? window : globalThis));
