(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Content = AXM.Content;

  if (!Content || !Array.isArray(Content.FURNITURE_CATALOG)) {
    throw new Error('Living City content expansion requires the base furniture catalogue.');
  }

  const EXPANSION_ID = 'axm.living-city.content-expansion/items-60/v1';
  const VALID_CATEGORIES = new Set(['seat', 'sleep', 'work', 'activity', 'light', 'storage', 'surface', 'decor', 'food']);
  const VALID_STYLES = new Set((Content.STYLES || []).map((entry) => entry.id));
  const STAT_KEYS = ['comfort', 'beauty', 'utility', 'durability', 'efficiency'];

  const ITEMS = [
    { id: 'patched_armchair', name: 'Patched Armchair', category: 'seat', symbol: 'PA', price: 58, footprint: [1, 1], styleTags: ['patched', 'vintage'], baseStats: { comfort: 42, beauty: 26, utility: 30, durability: 33, efficiency: 25 }, signature: ['deep seat', 'visible repair patches', 'easy to keep'], purchaseMaterials: {} },
    { id: 'reading_chair', name: 'Reading Chair', category: 'seat', symbol: 'RC', price: 145, footprint: [1, 1], styleTags: ['warm', 'green'], baseStats: { comfort: 49, beauty: 41, utility: 37, durability: 43, efficiency: 31 }, signature: ['upright comfort', 'quiet corner', 'good with a lamp'], purchaseMaterials: {} },
    { id: 'loveseat_sofa', name: 'Compact Loveseat Sofa', category: 'seat', symbol: 'LS', price: 235, footprint: [2, 1], styleTags: ['warm', 'minimal'], baseStats: { comfort: 51, beauty: 43, utility: 43, durability: 40, efficiency: 37 }, signature: ['two seats', 'small-room social anchor'], purchaseMaterials: {} },
    { id: 'modular_sofa', name: 'Modular Sofa', category: 'seat', symbol: 'MS', price: 690, footprint: [2, 2], styleTags: ['clean', 'playful'], baseStats: { comfort: 67, beauty: 58, utility: 60, durability: 54, efficiency: 36 }, signature: ['reconfigurable', 'four-seat corner', 'large footprint'], purchaseMaterials: {} },
    { id: 'kitchen_chair', name: 'Plain Kitchen Chair', category: 'seat', symbol: 'KI', price: 32, footprint: [1, 1], styleTags: ['clean', 'minimal'], baseStats: { comfort: 21, beauty: 23, utility: 35, durability: 52, efficiency: 48 }, signature: ['sturdy', 'cheap to replace parts', 'fits almost anywhere'], purchaseMaterials: {} },

    { id: 'double_bed', name: 'Double Bed', category: 'sleep', symbol: 'DB', price: 390, footprint: [2, 2], styleTags: ['warm', 'clean'], baseStats: { comfort: 63, beauty: 49, utility: 52, durability: 55, efficiency: 39 }, signature: ['two sleepers', 'large footprint', 'solid frame'], purchaseMaterials: {} },
    { id: 'bunk_bed', name: 'Bunk Bed', category: 'sleep', symbol: 'BB', price: 310, footprint: [2, 1], styleTags: ['playful', 'minimal'], baseStats: { comfort: 42, beauty: 31, utility: 68, durability: 57, efficiency: 66 }, signature: ['two sleepers', 'space saving', 'shared-room friendly'], purchaseMaterials: {} },
    { id: 'futon_bed', name: 'Fold-out Futon Bed', category: 'sleep', symbol: 'FT', price: 175, footprint: [2, 1], styleTags: ['patched', 'minimal'], baseStats: { comfort: 38, beauty: 29, utility: 57, durability: 35, efficiency: 53 }, signature: ['seat by day', 'bed by night', 'small-home compromise'], purchaseMaterials: {} },
    { id: 'reclaimed_bed', name: 'Reclaimed Wood Bed', category: 'sleep', symbol: 'RB', price: 245, footprint: [2, 1], styleTags: ['vintage', 'patched', 'green'], baseStats: { comfort: 45, beauty: 52, utility: 44, durability: 67, efficiency: 35 }, signature: ['reclaimed frame', 'repairable', 'visible grain'], purchaseMaterials: {} },

    { id: 'writing_desk', name: 'Writing Desk', category: 'work', symbol: 'WD', price: 130, footprint: [2, 1], styleTags: ['vintage', 'warm'], baseStats: { comfort: 31, beauty: 45, utility: 55, durability: 48, efficiency: 46 }, signature: ['drawer space', 'paper work', 'quiet study'], purchaseMaterials: {} },
    { id: 'drawing_desk', name: 'Tilt Drawing Desk', category: 'work', symbol: 'DD', price: 260, footprint: [2, 1], styleTags: ['playful', 'industrial'], baseStats: { comfort: 29, beauty: 46, utility: 65, durability: 51, efficiency: 52 }, signature: ['tilting surface', 'art and plans', 'tool rail'], purchaseMaterials: {} },
    { id: 'sewing_table', name: 'Sewing Table', category: 'work', symbol: 'SW', price: 215, footprint: [2, 1], styleTags: ['vintage', 'patched'], baseStats: { comfort: 25, beauty: 39, utility: 61, durability: 56, efficiency: 50 }, signature: ['fabric work', 'folding leaf', 'small storage'], purchaseMaterials: {} },
    { id: 'maker_workbench', name: 'Maker Workbench', category: 'work', symbol: 'MW', price: 620, footprint: [2, 1], styleTags: ['industrial', 'patched'], baseStats: { comfort: 18, beauty: 37, utility: 78, durability: 76, efficiency: 63 }, signature: ['repair surface', 'clamps and drawers', 'heavy but durable'], purchaseMaterials: {} },

    { id: 'refurbished_laptop', name: 'Refurbished Laptop', category: 'activity', symbol: 'RL', price: 360, footprint: [1, 1], styleTags: ['patched', 'clean'], baseStats: { comfort: 22, beauty: 32, utility: 67, durability: 42, efficiency: 62 }, signature: ['games', 'study', 'replaceable battery'], purchaseMaterials: {} },
    { id: 'compact_computer', name: 'Compact Computer', category: 'activity', symbol: 'CM', price: 720, footprint: [1, 1], styleTags: ['minimal', 'clean'], baseStats: { comfort: 27, beauty: 44, utility: 74, durability: 50, efficiency: 73 }, signature: ['small desktop', 'quiet fan', 'creation and games'], purchaseMaterials: {} },
    { id: 'tv_screen', name: 'Small TV Screen', category: 'activity', symbol: 'TV', price: 280, footprint: [1, 1], styleTags: ['clean', 'minimal'], baseStats: { comfort: 36, beauty: 39, utility: 48, durability: 46, efficiency: 45 }, signature: ['shared viewing', 'compact screen', 'no smart-home dependency'], purchaseMaterials: {} },
    { id: 'record_music_player', name: 'Record Player', category: 'activity', symbol: 'RP', price: 240, footprint: [1, 1], styleTags: ['vintage', 'warm'], baseStats: { comfort: 44, beauty: 55, utility: 38, durability: 44, efficiency: 31 }, signature: ['records', 'shared listening', 'manual controls'], purchaseMaterials: {} },
    { id: 'handheld_game_screen', name: 'Handheld Game System', category: 'activity', symbol: 'HG', price: 190, footprint: [1, 1], styleTags: ['playful', 'minimal'], baseStats: { comfort: 28, beauty: 38, utility: 51, durability: 40, efficiency: 70 }, signature: ['portable games', 'battery powered', 'personal entertainment'], purchaseMaterials: {} },

    { id: 'desk_lamp', name: 'Desk Lamp', category: 'light', symbol: 'DL', price: 34, footprint: [1, 1], styleTags: ['industrial', 'minimal'], baseStats: { comfort: 24, beauty: 29, utility: 52, durability: 44, efficiency: 72 }, signature: ['focused light', 'adjustable arm', 'low power'], purchaseMaterials: {} },
    { id: 'paper_lamp', name: 'Paper Shade Lamp', category: 'light', symbol: 'PP', price: 45, footprint: [1, 1], styleTags: ['warm', 'playful'], baseStats: { comfort: 39, beauty: 47, utility: 34, durability: 24, efficiency: 56 }, signature: ['soft glow', 'lightweight', 'cheap shade'], purchaseMaterials: {} },
    { id: 'clip_lamp', name: 'Clip Lamp', category: 'light', symbol: 'CL', price: 16, footprint: [1, 1], styleTags: ['patched', 'industrial'], baseStats: { comfort: 17, beauty: 18, utility: 43, durability: 31, efficiency: 78 }, signature: ['clips to furniture', 'tiny footprint', 'task light'], purchaseMaterials: {} },
    { id: 'industrial_lamp', name: 'Industrial Floor Lamp', category: 'light', symbol: 'IL', price: 175, footprint: [1, 1], styleTags: ['industrial', 'vintage'], baseStats: { comfort: 33, beauty: 52, utility: 49, durability: 63, efficiency: 43 }, signature: ['metal shade', 'room light', 'repairable switch'], purchaseMaterials: {} },

    { id: 'book_shelf', name: 'Book Shelf', category: 'storage', symbol: 'BS', price: 115, footprint: [1, 2], styleTags: ['warm', 'vintage'], baseStats: { comfort: 27, beauty: 43, utility: 58, durability: 47, efficiency: 51 }, signature: ['books', 'display storage', 'tall footprint'], purchaseMaterials: {} },
    { id: 'metal_shelf', name: 'Metal Utility Shelf', category: 'storage', symbol: 'MT', price: 96, footprint: [1, 2], styleTags: ['industrial', 'clean'], baseStats: { comfort: 12, beauty: 25, utility: 64, durability: 70, efficiency: 69 }, signature: ['heavy storage', 'easy cleaning', 'modular shelves'], purchaseMaterials: {} },
    { id: 'wall_shelf', name: 'Wall Shelf', category: 'storage', symbol: 'WS', price: 38, footprint: [1, 1], styleTags: ['minimal', 'green'], baseStats: { comfort: 15, beauty: 35, utility: 41, durability: 39, efficiency: 72 }, signature: ['small display', 'keeps floor open', 'simple brackets'], purchaseMaterials: {} },
    { id: 'drawer_crate', name: 'Drawer Crate', category: 'storage', symbol: 'DR', price: 54, footprint: [1, 1], styleTags: ['patched', 'vintage'], baseStats: { comfort: 16, beauty: 28, utility: 50, durability: 46, efficiency: 55 }, signature: ['small-item storage', 'stackable', 'reclaimed drawer'], purchaseMaterials: {} },

    { id: 'coffee_table', name: 'Coffee Table', category: 'surface', symbol: 'CT', price: 85, footprint: [2, 1], styleTags: ['warm', 'minimal'], baseStats: { comfort: 25, beauty: 38, utility: 48, durability: 46, efficiency: 41 }, signature: ['low surface', 'social room', 'magazine shelf'], purchaseMaterials: {} },
    { id: 'dining_table', name: 'Dining Table', category: 'surface', symbol: 'DT', price: 250, footprint: [2, 1], styleTags: ['clean', 'warm'], baseStats: { comfort: 35, beauty: 47, utility: 62, durability: 58, efficiency: 48 }, signature: ['four places', 'meals and projects', 'solid top'], purchaseMaterials: {} },
    { id: 'side_table', name: 'Side Table', category: 'surface', symbol: 'ST', price: 42, footprint: [1, 1], styleTags: ['minimal', 'vintage'], baseStats: { comfort: 19, beauty: 32, utility: 39, durability: 40, efficiency: 58 }, signature: ['small surface', 'lamp stand', 'easy to move'], purchaseMaterials: {} },

    { id: 'large_plant', name: 'Large House Plant', category: 'decor', symbol: 'GP', price: 72, footprint: [1, 1], styleTags: ['green', 'warm'], baseStats: { comfort: 39, beauty: 53, utility: 23, durability: 25, efficiency: 23 }, signature: ['large leaves', 'living decor', 'slow growth'], purchaseMaterials: {} },
    { id: 'hanging_plant', name: 'Hanging Plant', category: 'decor', symbol: 'HP', price: 44, footprint: [1, 1], styleTags: ['green', 'playful'], baseStats: { comfort: 31, beauty: 49, utility: 20, durability: 20, efficiency: 28 }, signature: ['trailing leaves', 'small footprint', 'brightens corners'], purchaseMaterials: {} },
    { id: 'woven_rug', name: 'Woven Rug', category: 'decor', symbol: 'WG', price: 95, footprint: [2, 1], styleTags: ['warm', 'vintage'], baseStats: { comfort: 42, beauty: 51, utility: 23, durability: 38, efficiency: 21 }, signature: ['soft floor', 'patterned', 'repairable edge'], purchaseMaterials: {} },
    { id: 'photo_wall_print', name: 'Photo Wall Print', category: 'decor', symbol: 'PW', price: 28, footprint: [1, 1], styleTags: ['playful', 'minimal'], baseStats: { comfort: 21, beauty: 44, utility: 13, durability: 35, efficiency: 25 }, signature: ['personal image', 'wall-mounted', 'cheap expression'], purchaseMaterials: {} },

    { id: 'mini_kitchen', name: 'Mini Kitchen Unit', category: 'food', symbol: 'MK', price: 410, footprint: [2, 1], styleTags: ['minimal', 'clean'], baseStats: { comfort: 27, beauty: 37, utility: 67, durability: 52, efficiency: 65 }, signature: ['sinkless prep unit', 'small appliances', 'compact cooking'], purchaseMaterials: {} },
    { id: 'induction_stove', name: 'Induction Stove', category: 'food', symbol: 'IS', price: 330, footprint: [1, 1], styleTags: ['clean', 'industrial'], baseStats: { comfort: 18, beauty: 35, utility: 72, durability: 49, efficiency: 82 }, signature: ['fast heat', 'power required', 'small cooking station'], purchaseMaterials: {} },
    { id: 'mini_fridge', name: 'Mini Fridge', category: 'food', symbol: 'MF', price: 260, footprint: [1, 1], styleTags: ['clean', 'minimal'], baseStats: { comfort: 18, beauty: 30, utility: 66, durability: 50, efficiency: 59 }, signature: ['cold storage', 'small-home scale', 'low capacity'], purchaseMaterials: {} }
  ];

  function validateDefinition(item) {
    if (!item || typeof item !== 'object') return 'item is not an object';
    if (!item.id || !item.name || !item.symbol) return `${String(item.id)} is missing identity fields`;
    if (!VALID_CATEGORIES.has(item.category)) return `${item.id} has unsupported category ${String(item.category)}`;
    if (!Number.isFinite(item.price) || item.price < 0) return `${item.id} has invalid price`;
    if (!Array.isArray(item.footprint) || item.footprint.length !== 2 || item.footprint.some((value) => !Number.isInteger(value) || value < 1 || value > 3)) return `${item.id} has invalid footprint`;
    if (!Array.isArray(item.styleTags) || !item.styleTags.length || item.styleTags.some((style) => !VALID_STYLES.has(style))) return `${item.id} has invalid style tags`;
    if (!item.baseStats || STAT_KEYS.some((key) => !Number.isFinite(item.baseStats[key]) || item.baseStats[key] < 0 || item.baseStats[key] > 100)) return `${item.id} has invalid base stats`;
    if (!Array.isArray(item.signature) || !item.signature.length) return `${item.id} needs at least one signature trait`;
    return null;
  }

  const existingIds = new Set(Content.FURNITURE_CATALOG.map((entry) => entry.id));
  const expansionIds = new Set();
  ITEMS.forEach((item) => {
    const error = validateDefinition(item);
    if (error) throw new Error(`Living City content expansion rejected: ${error}.`);
    if (existingIds.has(item.id) || expansionIds.has(item.id)) throw new Error(`Living City content expansion duplicates ${item.id}.`);
    expansionIds.add(item.id);
  });

  Content.FURNITURE_CATALOG.push(...ITEMS);

  AXM.ContentExpansion = Object.freeze({
    id: EXPANSION_ID,
    itemCount: ITEMS.length,
    totalCatalogueItems: Content.FURNITURE_CATALOG.length,
    itemIds: Object.freeze(ITEMS.map((item) => item.id)),
    items: Object.freeze(ITEMS.slice())
  });
}(typeof window !== 'undefined' ? window : globalThis));
