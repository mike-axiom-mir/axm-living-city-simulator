(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const ObjectUse = AXM.ObjectUse;
  const Content = AXM.Content;
  const Expansion = AXM.ContentExpansion;

  if (!ObjectUse?.OBJECT_RULES || !Expansion) {
    throw new Error('Living City object-use item expansion requires ObjectUse and ContentExpansion.');
  }

  const additions = {
    play_pc: ['refurbished_laptop', 'compact_computer', 'handheld_game_screen'],
    study_focus: ['refurbished_laptop', 'compact_computer'],
    creative_time: ['refurbished_laptop', 'compact_computer', 'record_music_player'],
    practice_repair: ['maker_workbench']
  };

  Object.entries(additions).forEach(([actionId, ids]) => {
    const rule = ObjectUse.OBJECT_RULES.find((entry) => entry.actionId === actionId);
    if (!rule) throw new Error(`Object-use expansion cannot find ${actionId}.`);
    rule.catalogIds = Array.from(new Set([...(rule.catalogIds || []), ...ids])).sort();
    ids.forEach((id) => {
      if (!Content.furnitureById(id)) throw new Error(`Object-use expansion references missing catalogue item ${id}.`);
    });
  });

  AXM.ObjectUseItemExpansion = Object.freeze({
    id: 'axm.living-city.object-use-item-expansion/v1',
    additions: Object.freeze(Object.fromEntries(Object.entries(additions).map(([key, value]) => [key, Object.freeze(value.slice())])))
  });
}(typeof window !== 'undefined' ? window : globalThis));
