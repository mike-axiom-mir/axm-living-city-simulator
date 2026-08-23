(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const ObjectUse = AXM.ObjectUse;
  const Content = AXM.Content;
  const Expansion = AXM.ContentExpansion;
  const ItemInteractions = AXM.ItemInteractions;

  if (!ObjectUse?.OBJECT_RULES || !Expansion || !ItemInteractions) {
    throw new Error('Living City object-use item expansion requires ObjectUse, ContentExpansion and ItemInteractions.');
  }

  const additions = [
    {
      actionId: 'play_device',
      catalogIds: ['refurbished_laptop', 'compact_computer', 'handheld_game_screen'],
      reason: 'A real game-capable device already placed in the room can ground leisure play.'
    },
    {
      actionId: 'watch_tv',
      catalogIds: ['tv_screen'],
      reason: 'A real TV already placed in the room can ground television leisure without pretending it is a work computer.'
    },
    {
      actionId: 'study_focus',
      catalogIds: ['refurbished_laptop', 'compact_computer'],
      reason: 'A real laptop or compact computer can ground focused study.'
    },
    {
      actionId: 'creative_time',
      catalogIds: ['refurbished_laptop', 'compact_computer', 'record_music_player'],
      reason: 'A real creative device already present can ground open-ended creative time.'
    },
    {
      actionId: 'practice_repair',
      catalogIds: ['maker_workbench'],
      reason: 'A real maker workbench can ground repair practice.'
    }
  ];

  additions.forEach((addition) => {
    if (!Content.activityById(addition.actionId)) throw new Error(`Object-use expansion cannot find activity ${addition.actionId}.`);
    addition.catalogIds.forEach((id) => {
      if (!Content.furnitureById(id)) throw new Error(`Object-use expansion references missing catalogue item ${id}.`);
    });
    let rule = ObjectUse.OBJECT_RULES.find((entry) => entry.actionId === addition.actionId);
    if (!rule) {
      rule = { actionId: addition.actionId, catalogIds: [], reason: addition.reason };
      ObjectUse.OBJECT_RULES.push(rule);
    }
    rule.catalogIds = Array.from(new Set([...(rule.catalogIds || []), ...addition.catalogIds])).sort();
    rule.reason = addition.reason;
  });

  AXM.ObjectUseItemExpansion = Object.freeze({
    id: 'axm.living-city.object-use-item-expansion/v2',
    additions: Object.freeze(additions.map((entry) => Object.freeze({
      actionId: entry.actionId,
      catalogIds: Object.freeze(entry.catalogIds.slice()),
      reason: entry.reason
    })))
  });
}(typeof window !== 'undefined' ? window : globalThis));
