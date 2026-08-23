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
  const EXPANDED_PLAY_IDS = new Set(ItemInteractions.ACTION_CATALOGS.play_device || []);
  const TV_IDS = new Set(ItemInteractions.ACTION_CATALOGS.watch_tv || []);

  function activityOption(activityId, object, reason) {
    const activity = Content.activityById(activityId);
    if (!activity || !object) return null;
    return {
      id: activity.id,
      name: activityId === 'play_device' ? `Play on ${object.name}` : activity.name,
      hours: activity.hours,
      cost: activity.cost,
      description: activity.description,
      reason,
      objectId: object.id,
      objectName: object.name
    };
  }

  function roomActivityOptions(world, scene) {
    const base = originalRoomActivityOptions(world, scene);
    if (!scene || scene.kind !== 'room' || scene.placeId !== world.player.homePropertyId) return base;

    const legacy = (scene.objects || []).find((object) => LEGACY_PLAY_IDS.has(object.catalogId)) || null;
    const expanded = (scene.objects || []).find((object) => EXPANDED_PLAY_IDS.has(object.catalogId)) || null;
    const tv = (scene.objects || []).find((object) => TV_IDS.has(object.catalogId)) || null;

    const out = base.filter((entry) => entry.id !== 'play_pc');
    if (legacy) {
      const activity = Content.activityById('play_pc');
      if (activity) out.push({
        id: activity.id,
        name: activity.name,
        hours: activity.hours,
        cost: activity.cost,
        description: activity.description,
        reason: 'Use a real computer already placed in this room.',
        objectId: legacy.id,
        objectName: legacy.name
      });
    }
    if (expanded) {
      const option = activityOption('play_device', expanded, 'Use this real laptop, compact computer, or handheld game system for leisure.');
      if (option) out.push(option);
    }
    if (tv && scene.purpose !== 'bathroom') {
      const option = activityOption('watch_tv', tv, 'Watch the real TV placed in this room; it remains leisure rather than a study shortcut.');
      if (option) out.push(option);
    }

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
    const option = roomActivityOptions(world, scene).find((entry) => entry.id === actionId && (entry.objectId || null) === (objectId || null)) || null;
    return option;
  }

  Visuals.roomActivityOptions = roomActivityOptions;
  Visuals.groundedActivityForRoom = groundedActivityForRoom;

  AXM.ItemVisualInteractions = Object.freeze({
    id: 'axm.living-city.item-visual-interactions/v0.12.0-draft',
    roomActivityOptions,
    groundedActivityForRoom
  });
}(typeof window !== 'undefined' ? window : globalThis));
