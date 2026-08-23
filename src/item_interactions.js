(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Systems = AXM.Systems;

  if (!Core || !Content || !World || !Systems?.performActivity) {
    throw new Error('Living City item interactions require Core, Content, World and Systems.');
  }
  if (AXM.ItemInteractions) return;

  const INTERACTION_SCHEMA = 'axm.living-city.item-interactions/v0.12.0-draft';
  const ACTIVITY_DEFINITIONS = [
    {
      id: 'play_device',
      name: 'Play on the device',
      hours: 2,
      cost: 0,
      description: 'Use a real laptop, compact computer, or handheld game system already present in your home.',
      effects: { mood: 20, social: -2, energy: -6 },
      skill: { creativity: 0.4 }
    },
    {
      id: 'watch_tv',
      name: 'Watch TV',
      hours: 2,
      cost: 0,
      description: 'Watch something on a real TV in the room. It is leisure time, not a disguised study computer.',
      effects: { mood: 14, energy: -4, hunger: -3 },
      skill: {}
    }
  ];

  ACTIVITY_DEFINITIONS.forEach((definition) => {
    if (!Content.activityById(definition.id)) Content.ACTIVITIES.push(definition);
  });

  const ACTION_CATALOGS = Object.freeze({
    play_device: Object.freeze(['refurbished_laptop', 'compact_computer', 'handheld_game_screen']),
    watch_tv: Object.freeze(['tv_screen']),
    study_focus: Object.freeze(['refurbished_laptop', 'compact_computer']),
    creative_time: Object.freeze(['refurbished_laptop', 'compact_computer', 'record_music_player'])
  });

  const REQUIRED_OBJECT_ACTIONS = new Set(['play_device', 'watch_tv']);
  const originalPerformActivity = Systems.performActivity;

  function objectInCurrentHome(world, objectId) {
    const home = World.homeOf(world, 'player');
    if (!home || !objectId) return null;
    return (home.furniture || []).find((object) => object.id === objectId) || null;
  }

  function directUseAllowed(object) {
    if (!object) return false;
    return object.ownerId === 'player' || object.ownershipMode === 'property_fixture';
  }

  function objectMatchesAction(object, actionId) {
    return Boolean(object && (ACTION_CATALOGS[actionId] || []).includes(object.catalogId));
  }

  function resolveActionObject(world, actionId, request = null) {
    const home = World.homeOf(world, 'player');
    if (!home) return { object: null, reason: 'No current home is available.' };
    const allowed = ACTION_CATALOGS[actionId] || [];
    if (!allowed.length) return { object: null, reason: null };

    if (request?.objectId) {
      const selected = objectInCurrentHome(world, request.objectId);
      if (!selected || !objectMatchesAction(selected, actionId)) {
        return { object: null, reason: REQUIRED_OBJECT_ACTIONS.has(actionId) ? 'The selected object cannot perform that activity.' : null };
      }
      if (!directUseAllowed(selected)) {
        return { object: null, reason: 'That object is personal to another resident; permission is not assumed.' };
      }
      return { object: selected, reason: null };
    }

    const candidate = (home.furniture || []).find((object) => objectMatchesAction(object, actionId) && directUseAllowed(object)) || null;
    if (candidate) return { object: candidate, reason: null };
    return {
      object: null,
      reason: REQUIRED_OBJECT_ACTIONS.has(actionId)
        ? actionId === 'watch_tv' ? 'There is no usable TV in your current home.' : 'There is no usable game-capable device in your current home.'
        : null
    };
  }

  function usageSnapshot(object) {
    return object ? {
      usageHours: Number(object.usageHours) || 0,
      sentimental: Number(object.sentimental) || 0
    } : null;
  }

  function recordUse(object, activity) {
    if (!object || !activity) return null;
    const before = usageSnapshot(object);
    object.usageHours = Core.round(before.usageHours + activity.hours, 2);
    const familiarity = activity.id === 'watch_tv' ? 0.25 : activity.id === 'play_device' ? 0.55 : 0.35;
    object.sentimental = Core.clamp(Core.round(before.sentimental + familiarity, 2), 0, 100);
    return {
      id: object.id,
      catalogId: object.catalogId,
      usageHours: Core.round(object.usageHours - before.usageHours, 2),
      sentimental: Core.round(object.sentimental - before.sentimental, 2)
    };
  }

  function mergeReceiptObjectDelta(world, result, delta) {
    if (!delta || !result?.visualReceipt?.observedEffects) return;
    const observed = result.visualReceipt.observedEffects;
    const existing = observed.object?.id === delta.id ? observed.object : { id: delta.id };
    observed.object = {
      ...existing,
      usageHours: Core.round((Number(existing.usageHours) || 0) + delta.usageHours, 2),
      sentimental: Core.round((Number(existing.sentimental) || 0) + delta.sentimental, 2)
    };
    result.visualReceipt.itemInteraction = {
      schema: INTERACTION_SCHEMA,
      objectId: delta.id,
      catalogId: delta.catalogId,
      noExtraReward: true
    };
    if (world.ui) world.ui.lastVisualActivityReceipt = result.visualReceipt;
  }

  function performActivity(world, actionId) {
    const request = world.ui?.pendingVisualActivity ? Core.deepClone(world.ui.pendingVisualActivity) : null;
    const resolved = resolveActionObject(world, actionId, request);
    if (resolved.reason) return { ok: false, reason: resolved.reason };

    const result = originalPerformActivity(world, actionId);
    if (!result?.ok) return result;

    const activity = Content.activityById(actionId);
    const shouldRecord = Boolean(
      resolved.object
      && (REQUIRED_OBJECT_ACTIONS.has(actionId) || (request?.objectId && objectMatchesAction(resolved.object, actionId)))
    );
    const delta = shouldRecord ? recordUse(resolved.object, activity) : null;
    mergeReceiptObjectDelta(world, result, delta);
    if (delta) {
      result.itemInteraction = {
        schema: INTERACTION_SCHEMA,
        actionId,
        objectId: delta.id,
        catalogId: delta.catalogId,
        usageHoursAdded: delta.usageHours,
        sentimentalAdded: delta.sentimental,
        noExtraReward: true
      };
    }
    return result;
  }

  Systems.performActivity = performActivity;

  AXM.ItemInteractions = Object.freeze({
    INTERACTION_SCHEMA,
    ACTION_CATALOGS,
    activities: Object.freeze(ACTIVITY_DEFINITIONS.map((entry) => entry.id)),
    objectMatchesAction,
    resolveActionObject
  });
}(typeof window !== 'undefined' ? window : globalThis));
