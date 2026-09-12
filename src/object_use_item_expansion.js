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
    ['play_device', ['refurbished_laptop', 'compact_computer', 'handheld_game_screen'], 'A real game-capable device can ground leisure play.'],
    ['watch_tv', ['tv_screen'], 'A real TV can ground television leisure without pretending it is a work computer.'],
    ['relax_seated', ['secondhand_chair', 'folding_chair', 'deep_sofa', 'patched_armchair', 'reading_chair', 'loveseat_sofa', 'modular_sofa', 'kitchen_chair'], 'A real chair or sofa can ground a quiet rest.'],
    ['read_books', ['story_shelf', 'book_shelf'], 'A real book or story shelf can ground reading.'],
    ['listen_music', ['music_player', 'record_music_player'], 'A real music device can ground listening time.'],
    ['read_by_lamp', ['basic_lamp', 'standing_lamp', 'desk_lamp', 'paper_lamp', 'clip_lamp', 'industrial_lamp'], 'A real lamp can ground a reading-light activity.'],
    ['care_plant', ['plant', 'large_plant', 'hanging_plant'], 'A real plant can ground optional care without creating a maintenance streak.'],
    ['organize_storage', ['crate_shelf', 'wardrobe', 'keepsake_chest', 'story_shelf', 'book_shelf', 'metal_shelf', 'wall_shelf', 'drawer_crate'], 'A real storage object can ground optional sorting without a cleanliness quota.'],
    ['repair_at_bench', ['workbench', 'maker_workbench'], 'A real home workbench can ground repair practice without routing to the public workshop.'],
    ['sleep', ['double_bed', 'bunk_bed', 'futon_bed', 'reclaimed_bed'], 'Expanded sleeping objects ground the same ordinary sleep action.'],
    ['eat_home', ['mini_kitchen', 'induction_stove', 'mini_fridge'], 'Expanded kitchen objects can ground the ordinary home-meal action.'],
    ['study_focus', ['refurbished_laptop', 'compact_computer', 'writing_desk', 'drawing_desk', 'dining_table', 'side_table', 'book_shelf'], 'Real study-capable devices and surfaces can ground focused study.'],
    ['creative_time', ['refurbished_laptop', 'compact_computer', 'record_music_player', 'writing_desk', 'drawing_desk', 'sewing_table', 'coffee_table', 'dining_table', 'side_table'], 'Real creative devices and surfaces can ground open-ended creative time.']
  ].map(([actionId, catalogIds, reason]) => ({ actionId, catalogIds, reason }));

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

  // v0.11.x's generic repair activity routes to the public workshop. Once a
  // real home-bench action exists, the object-use projection must not claim
  // that the old public-workshop activity happens at the home workbench.
  const publicRepairRule = ObjectUse.OBJECT_RULES.find((entry) => entry.actionId === 'practice_repair');
  if (publicRepairRule?.catalogIds) {
    publicRepairRule.catalogIds = publicRepairRule.catalogIds.filter((id) => !['workbench', 'maker_workbench'].includes(id));
  }

  AXM.ObjectUseItemExpansion = Object.freeze({
    id: 'axm.living-city.object-use-item-expansion/v3',
    additions: Object.freeze(additions.map((entry) => Object.freeze({
      actionId: entry.actionId,
      catalogIds: Object.freeze(entry.catalogIds.slice()),
      reason: entry.reason
    })))
  });
}(typeof window !== 'undefined' ? window : globalThis));
