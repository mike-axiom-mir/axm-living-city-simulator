(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Content = AXM.Content;
  const World = AXM.World;
  const Habitats = AXM.Habitats;
  const Visuals = AXM.Visuals;
  const ItemInteractions = AXM.ItemInteractions;

  if (!Content || !World || !Habitats || !Visuals || !ItemInteractions) {
    throw new Error('Living City visual item interactions require Content, World, Habitats, Visuals and ItemInteractions.');
  }
  if (AXM.ItemVisualInteractions) return;

  const originalRoomActivityOptions = Visuals.roomActivityOptions;
  const LEGACY_PLAY_IDS = new Set(['old_laptop', 'fast_computer']);
  const PRECISE_ACTIONS = [
    'play_device', 'watch_tv', 'relax_seated', 'read_books', 'listen_music',
    'read_by_lamp', 'care_plant', 'organize_storage', 'repair_at_bench'
  ];

  function persistentObject(world, visualObject) {
    const home = World.homeOf(world, 'player');
    return home?.furniture?.find((object) => object.id === visualObject?.id) || null;
  }

  function actionName(activityId, object) {
    const names = {
      play_device: `Play on ${object.name}`,
      watch_tv: `Watch ${object.name}`,
      relax_seated: `Relax on ${object.name}`,
      read_books: `Read from ${object.name}`,
      listen_music: `Listen on ${object.name}`,
      read_by_lamp: `Read by ${object.name}`,
      care_plant: `Care for ${object.name}`,
      organize_storage: `Organize ${object.name}`,
      repair_at_bench: `Repair at ${object.name}`
    };
    return names[activityId] || Content.activityById(activityId)?.name || activityId;
  }

  function reasonFor(activityId) {
    const reasons = {
      play_device: 'Use this real game-capable device for leisure.',
      watch_tv: 'Watch the real TV in this room; it remains leisure rather than a study shortcut.',
      relax_seated: 'Use this real chair or sofa to rest for a while.',
      read_books: 'Use this real shelf as the source for a quiet reading hour.',
      listen_music: 'Use this real music device for listening time.',
      read_by_lamp: 'Use this real lamp as a reading light.',
      care_plant: 'Spend optional time tending this real plant; no daily care streak is created.',
      organize_storage: 'Use this real storage object without creating a cleanliness quota.',
      repair_at_bench: 'Use this real home workbench instead of teleporting to the public workshop.'
    };
    return reasons[activityId] || 'Use the real object already present in this room.';
  }

  function activityOption(activityId, object) {
    const activity = Content.activityById(activityId);
    if (!activity || !object) return null;
    return {
      id: activity.id,
      name: actionName(activityId, object),
      hours: activity.hours,
      cost: activity.cost,
      description: activity.description,
      reason: reasonFor(activityId),
      objectId: object.id,
      objectName: object.name
    };
  }

  function allowedVisualObject(world, visualObject, actionId) {
    const persistent = persistentObject(world, visualObject);
    return Boolean(
      persistent
      && ItemInteractions.objectMatchesAction(persistent, actionId)
      && ItemInteractions.directUseAllowed(persistent)
    );
  }

  function roomActivityOptions(world, scene) {
    const base = originalRoomActivityOptions(world, scene);
    if (!scene || scene.kind !== 'room' || scene.placeId !== world.player.homePropertyId) return base;

    const out = base.filter((entry) => {
      if (entry.id === 'play_pc') return Boolean((scene.objects || []).find((object) => object.id === entry.objectId && LEGACY_PLAY_IDS.has(object.catalogId)));
      if (['study_focus', 'creative_time', 'eat_home', 'sleep'].includes(entry.id) && entry.objectId) {
        const visualObject = (scene.objects || []).find((object) => object.id === entry.objectId);
        return Boolean(visualObject && allowedVisualObject(world, visualObject, entry.id));
      }
      return true;
    });

    PRECISE_ACTIONS.forEach((actionId) => {
      (scene.objects || []).forEach((object) => {
        if (!allowedVisualObject(world, object, actionId)) return;
        const option = activityOption(actionId, object);
        if (option) out.push(option);
      });
    });

    const seen = new Set();
    return out.filter((entry) => {
      const key = `${entry.id}|${entry.objectId || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
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
      objects: Visuals.objectsInRoom(property, room)
    };
    return roomActivityOptions(world, scene)
      .find((entry) => entry.id === actionId && (entry.objectId || null) === (objectId || null)) || null;
  }

  Visuals.roomActivityOptions = roomActivityOptions;
  Visuals.groundedActivityForRoom = groundedActivityForRoom;

  AXM.ItemVisualInteractions = Object.freeze({
    id: 'axm.living-city.item-visual-interactions/v0.12.0-draft',
    roomActivityOptions,
    groundedActivityForRoom
  });
}(typeof window !== 'undefined' ? window : globalThis));
