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
    },
    {
      id: 'relax_seated',
      name: 'Sit and unwind',
      hours: 1,
      cost: 0,
      description: 'Spend a quiet hour on a real chair or sofa instead of treating seating as passive decoration.',
      effects: { mood: 7, energy: 5 },
      skill: {}
    },
    {
      id: 'read_books',
      name: 'Browse some books',
      hours: 1,
      cost: 0,
      description: 'Read from a real book or story shelf already present in the room.',
      effects: { mood: 5, energy: -2 },
      skill: { focus: 0.45 }
    },
    {
      id: 'listen_music',
      name: 'Listen to music',
      hours: 1,
      cost: 0,
      description: 'Put on music using a real music player or record player in the room.',
      effects: { mood: 10, energy: 1 },
      skill: { creativity: 0.2 }
    },
    {
      id: 'read_by_lamp',
      name: 'Read under the light',
      hours: 1,
      cost: 0,
      description: 'Use a real lamp as a quiet reading light for an hour.',
      effects: { mood: 4, energy: -1 },
      skill: { focus: 0.3 }
    },
    {
      id: 'care_plant',
      name: 'Care for the plant',
      hours: 1,
      cost: 0,
      description: 'Spend a little optional time tending a real house plant. Plants do not create a daily maintenance obligation.',
      effects: { mood: 6, energy: -2 },
      skill: {}
    },
    {
      id: 'organize_storage',
      name: 'Browse and organize',
      hours: 1,
      cost: 0,
      description: 'Use a real shelf, wardrobe, chest, or drawer to sort things for a while. This is optional, not a cleanliness quota.',
      effects: { mood: 2, energy: -3 },
      skill: { focus: 0.2 }
    },
    {
      id: 'repair_at_bench',
      name: 'Repair at the home bench',
      hours: 2,
      cost: 2,
      description: 'Practice a small repair at a real workbench in your current home instead of teleporting to the public workshop.',
      effects: { mood: 2, energy: -9 },
      skill: { repair: 1.5 }
    }
  ];

  ACTIVITY_DEFINITIONS.forEach((definition) => {
    if (!Content.activityById(definition.id)) Content.ACTIVITIES.push(definition);
  });

  const ACTION_CATALOGS = Object.freeze({
    play_device: Object.freeze(['refurbished_laptop', 'compact_computer', 'handheld_game_screen']),
    watch_tv: Object.freeze(['tv_screen']),
    relax_seated: Object.freeze([
      'secondhand_chair', 'folding_chair', 'deep_sofa', 'patched_armchair', 'reading_chair',
      'loveseat_sofa', 'modular_sofa', 'kitchen_chair'
    ]),
    read_books: Object.freeze(['story_shelf', 'book_shelf']),
    listen_music: Object.freeze(['music_player', 'record_music_player']),
    read_by_lamp: Object.freeze(['basic_lamp', 'standing_lamp', 'desk_lamp', 'paper_lamp', 'clip_lamp', 'industrial_lamp']),
    care_plant: Object.freeze(['plant', 'large_plant', 'hanging_plant']),
    organize_storage: Object.freeze([
      'crate_shelf', 'wardrobe', 'keepsake_chest', 'story_shelf', 'book_shelf',
      'metal_shelf', 'wall_shelf', 'drawer_crate'
    ]),
    repair_at_bench: Object.freeze(['workbench', 'maker_workbench']),
    sleep: Object.freeze(['simple_bed', 'floor_mattress', 'small_child_bed', 'double_bed', 'bunk_bed', 'futon_bed', 'reclaimed_bed']),
    eat_home: Object.freeze(['kitchenette', 'mini_kitchen', 'induction_stove', 'mini_fridge']),
    study_focus: Object.freeze([
      'old_laptop', 'fast_computer', 'refurbished_laptop', 'compact_computer',
      'tiny_desk', 'writing_desk', 'drawing_desk', 'small_table', 'family_table',
      'dining_table', 'side_table', 'story_shelf', 'book_shelf'
    ]),
    creative_time: Object.freeze([
      'old_laptop', 'fast_computer', 'refurbished_laptop', 'compact_computer',
      'music_player', 'record_music_player', 'tiny_desk', 'writing_desk', 'drawing_desk',
      'sewing_table', 'small_table', 'family_table', 'coffee_table', 'dining_table',
      'side_table', 'story_shelf'
    ])
  });

  const REQUIRED_OBJECT_ACTIONS = new Set([
    'play_device', 'watch_tv', 'relax_seated', 'read_books', 'listen_music',
    'read_by_lamp', 'care_plant', 'organize_storage', 'repair_at_bench'
  ]);
  const REQUIRED_MESSAGES = Object.freeze({
    play_device: 'There is no usable game-capable device in your current home.',
    watch_tv: 'There is no usable TV in your current home.',
    relax_seated: 'There is no usable chair or sofa in your current home.',
    read_books: 'There is no usable book or story shelf in your current home.',
    listen_music: 'There is no usable music player in your current home.',
    read_by_lamp: 'There is no usable lamp in your current home.',
    care_plant: 'There is no usable house plant in your current home.',
    organize_storage: 'There is no usable storage object in your current home.',
    repair_at_bench: 'There is no usable workbench in your current home.'
  });
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
        return { object: null, reason: 'The selected object cannot perform that activity.' };
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
      reason: REQUIRED_OBJECT_ACTIONS.has(actionId) ? REQUIRED_MESSAGES[actionId] : null
    };
  }

  function usageSnapshot(object) {
    return object ? {
      usageHours: Number(object.usageHours) || 0,
      sentimental: Number(object.sentimental) || 0
    } : null;
  }

  function familiarityFor(actionId) {
    const values = {
      play_device: 0.55,
      watch_tv: 0.25,
      relax_seated: 0.2,
      read_books: 0.3,
      listen_music: 0.3,
      read_by_lamp: 0.12,
      care_plant: 0.18,
      organize_storage: 0.12,
      repair_at_bench: 0.35,
      sleep: 0.3,
      eat_home: 0.2,
      study_focus: 0.35,
      creative_time: 0.35
    };
    return values[actionId] ?? 0.2;
  }

  function recordUse(object, activity) {
    if (!object || !activity) return null;
    const before = usageSnapshot(object);
    object.usageHours = Core.round(before.usageHours + activity.hours, 2);
    object.sentimental = Core.clamp(Core.round(before.sentimental + familiarityFor(activity.id), 2), 0, 100);
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
    resolveActionObject,
    directUseAllowed
  });
}(typeof window !== 'undefined' ? window : globalThis));
