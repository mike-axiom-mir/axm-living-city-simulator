(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};

  const PALETTE = [
    { id: 'moss', name: 'Moss', hex: '#6f8f72' },
    { id: 'clay', name: 'Clay', hex: '#b76d55' },
    { id: 'night', name: 'Night Blue', hex: '#415a77' },
    { id: 'mustard', name: 'Mustard', hex: '#c6a94b' },
    { id: 'plum', name: 'Plum', hex: '#76526f' },
    { id: 'cream', name: 'Cream', hex: '#e8dfcb' },
    { id: 'charcoal', name: 'Charcoal', hex: '#42474f' },
    { id: 'sea', name: 'Sea Glass', hex: '#6ca7a1' },
    { id: 'brick', name: 'Brick', hex: '#8f4a42' },
    { id: 'lilac', name: 'Lilac', hex: '#9a8fb3' },
    { id: 'copper', name: 'Copper', hex: '#ad7b4f' },
    { id: 'white', name: 'Soft White', hex: '#e9edf0' }
  ];

  const STYLES = [
    { id: 'patched', name: 'Patched & Personal' },
    { id: 'minimal', name: 'Quiet Minimal' },
    { id: 'warm', name: 'Warm & Lived-in' },
    { id: 'industrial', name: 'Small Industrial' },
    { id: 'playful', name: 'Playful Mix' },
    { id: 'green', name: 'Plant-filled' },
    { id: 'vintage', name: 'Secondhand Vintage' },
    { id: 'clean', name: 'Clean Practical' }
  ];

  const MATERIALS = {
    wood: { id: 'wood', name: 'Wood', icon: 'W', unitPrice: 14 },
    metal: { id: 'metal', name: 'Metal', icon: 'M', unitPrice: 18 },
    fabric: { id: 'fabric', name: 'Fabric', icon: 'F', unitPrice: 12 },
    parts: { id: 'parts', name: 'Parts', icon: 'P', unitPrice: 20 },
    paint: { id: 'paint', name: 'Paint', icon: 'C', unitPrice: 10 }
  };

  const FURNITURE_CATALOG = [
    {
      id: 'secondhand_chair', name: 'Secondhand Chair', category: 'seat', symbol: 'CH',
      price: 25, footprint: [1, 1], styleTags: ['patched', 'vintage'],
      baseStats: { comfort: 22, beauty: 17, utility: 28, durability: 36, efficiency: 26 },
      signature: ['compact', 'easy to repair', 'keeps its scars'],
      purchaseMaterials: {}
    },
    {
      id: 'folding_chair', name: 'Folding Chair', category: 'seat', symbol: 'FC',
      price: 40, footprint: [1, 1], styleTags: ['minimal', 'industrial'],
      baseStats: { comfort: 18, beauty: 24, utility: 36, durability: 44, efficiency: 42 },
      signature: ['foldable', 'portable'], purchaseMaterials: {}
    },
    {
      id: 'deep_sofa', name: 'Deep Sofa', category: 'seat', symbol: 'SO',
      price: 420, footprint: [2, 1], styleTags: ['warm', 'clean'],
      baseStats: { comfort: 58, beauty: 48, utility: 48, durability: 46, efficiency: 32 },
      signature: ['three seats', 'social anchor'], purchaseMaterials: {}
    },
    {
      id: 'simple_bed', name: 'Simple Bed', category: 'sleep', symbol: 'BD',
      price: 120, footprint: [2, 1], styleTags: ['minimal', 'clean'],
      baseStats: { comfort: 37, beauty: 28, utility: 42, durability: 44, efficiency: 34 },
      signature: ['single sleeper', 'modular frame'], purchaseMaterials: {}
    },
    {
      id: 'floor_mattress', name: 'Floor Mattress', category: 'sleep', symbol: 'FM',
      price: 55, footprint: [2, 1], styleTags: ['patched', 'minimal'],
      baseStats: { comfort: 31, beauty: 18, utility: 38, durability: 25, efficiency: 37 },
      signature: ['easy to move', 'low profile'], purchaseMaterials: {}
    },
    {
      id: 'tiny_desk', name: 'Tiny Desk', category: 'work', symbol: 'DK',
      price: 70, footprint: [2, 1], styleTags: ['minimal', 'patched'],
      baseStats: { comfort: 24, beauty: 25, utility: 46, durability: 38, efficiency: 47 },
      signature: ['small footprint', 'study surface'], purchaseMaterials: {}
    },
    {
      id: 'workbench', name: 'Repair Workbench', category: 'work', symbol: 'WB',
      price: 360, footprint: [2, 1], styleTags: ['industrial', 'patched'],
      baseStats: { comfort: 20, beauty: 30, utility: 64, durability: 67, efficiency: 55 },
      signature: ['repair bonus', 'material storage'], purchaseMaterials: {}
    },
    {
      id: 'old_laptop', name: 'Old Laptop', category: 'activity', symbol: 'PC',
      price: 160, footprint: [1, 1], styleTags: ['patched', 'minimal'],
      baseStats: { comfort: 20, beauty: 24, utility: 58, durability: 28, efficiency: 40 },
      signature: ['games', 'study', 'slow but faithful'], purchaseMaterials: {}
    },
    {
      id: 'fast_computer', name: 'Fast Computer', category: 'activity', symbol: 'CP',
      price: 1150, footprint: [1, 1], styleTags: ['clean', 'playful'],
      baseStats: { comfort: 30, beauty: 50, utility: 82, durability: 50, efficiency: 84 },
      signature: ['fast creation', 'high power use'], purchaseMaterials: {}
    },
    {
      id: 'basic_lamp', name: 'Basic Lamp', category: 'light', symbol: 'LP',
      price: 18, footprint: [1, 1], styleTags: ['minimal', 'patched'],
      baseStats: { comfort: 18, beauty: 25, utility: 38, durability: 35, efficiency: 42 },
      signature: ['low power', 'small glow'], purchaseMaterials: {}
    },
    {
      id: 'standing_lamp', name: 'Standing Lamp', category: 'light', symbol: 'SL',
      price: 120, footprint: [1, 1], styleTags: ['warm', 'vintage'],
      baseStats: { comfort: 36, beauty: 49, utility: 48, durability: 42, efficiency: 47 },
      signature: ['room glow', 'reading light'], purchaseMaterials: {}
    },
    {
      id: 'crate_shelf', name: 'Crate Shelf', category: 'storage', symbol: 'CR',
      price: 32, footprint: [1, 1], styleTags: ['patched', 'industrial'],
      baseStats: { comfort: 16, beauty: 20, utility: 45, durability: 39, efficiency: 47 },
      signature: ['stackable', 'reclaimed'], purchaseMaterials: {}
    },
    {
      id: 'wardrobe', name: 'Wardrobe', category: 'storage', symbol: 'WR',
      price: 260, footprint: [1, 2], styleTags: ['clean', 'warm'],
      baseStats: { comfort: 26, beauty: 43, utility: 61, durability: 56, efficiency: 56 },
      signature: ['large storage', 'visual anchor'], purchaseMaterials: {}
    },
    {
      id: 'small_table', name: 'Small Table', category: 'surface', symbol: 'TB',
      price: 65, footprint: [1, 1], styleTags: ['minimal', 'vintage'],
      baseStats: { comfort: 24, beauty: 30, utility: 45, durability: 42, efficiency: 44 },
      signature: ['multi-use surface', 'two places'], purchaseMaterials: {}
    },
    {
      id: 'family_table', name: 'Long Table', category: 'surface', symbol: 'LT',
      price: 390, footprint: [2, 1], styleTags: ['warm', 'vintage'],
      baseStats: { comfort: 42, beauty: 54, utility: 61, durability: 62, efficiency: 45 },
      signature: ['six places', 'gathers people'], purchaseMaterials: {}
    },
    {
      id: 'threadbare_rug', name: 'Threadbare Rug', category: 'decor', symbol: 'RG',
      price: 22, footprint: [2, 1], styleTags: ['patched', 'vintage'],
      baseStats: { comfort: 28, beauty: 22, utility: 20, durability: 25, efficiency: 18 },
      signature: ['softens a room', 'visible history'], purchaseMaterials: {}
    },
    {
      id: 'wall_print', name: 'Wall Print', category: 'decor', symbol: 'AR',
      price: 35, footprint: [1, 1], styleTags: ['playful', 'minimal'],
      baseStats: { comfort: 18, beauty: 42, utility: 16, durability: 40, efficiency: 28 },
      signature: ['personal statement', 'wall-mounted'], purchaseMaterials: {}
    },
    {
      id: 'plant', name: 'House Plant', category: 'decor', symbol: 'PL',
      price: 28, footprint: [1, 1], styleTags: ['green', 'warm'],
      baseStats: { comfort: 32, beauty: 40, utility: 22, durability: 22, efficiency: 25 },
      signature: ['grows slowly', 'needs care'], purchaseMaterials: {}
    },
    {
      id: 'kitchenette', name: 'Compact Kitchenette', category: 'food', symbol: 'KT',
      price: 520, footprint: [2, 1], styleTags: ['clean', 'industrial'],
      baseStats: { comfort: 34, beauty: 45, utility: 76, durability: 58, efficiency: 56 },
      signature: ['home meals', 'compact appliances'], purchaseMaterials: {}
    },
    {
      id: 'small_child_bed', name: 'Small Growing Bed', category: 'sleep', symbol: 'SB',
      price: 95, footprint: [2, 1], styleTags: ['warm', 'playful', 'patched'],
      baseStats: { comfort: 34, beauty: 30, utility: 43, durability: 45, efficiency: 40 },
      signature: ['adjustable frame', 'personal sleeping space', 'keeps its history'], purchaseMaterials: {}
    },
    {
      id: 'keepsake_chest', name: 'Keepsake Chest', category: 'storage', symbol: 'KC',
      price: 48, footprint: [1, 1], styleTags: ['vintage', 'patched', 'warm'],
      baseStats: { comfort: 22, beauty: 34, utility: 47, durability: 48, efficiency: 42 },
      signature: ['personal treasures', 'portable history', 'repairable'], purchaseMaterials: {}
    },
    {
      id: 'play_mat', name: 'Activity Mat', category: 'decor', symbol: 'PM',
      price: 34, footprint: [2, 1], styleTags: ['playful', 'warm'],
      baseStats: { comfort: 38, beauty: 31, utility: 37, durability: 29, efficiency: 33 },
      signature: ['open-ended play', 'soft floor space', 'recolorable'], purchaseMaterials: {}
    },
    {
      id: 'story_shelf', name: 'Story and Project Shelf', category: 'storage', symbol: 'SS',
      price: 72, footprint: [1, 1], styleTags: ['playful', 'green', 'warm'],
      baseStats: { comfort: 27, beauty: 39, utility: 54, durability: 43, efficiency: 48 },
      signature: ['books and projects', 'interest-led learning', 'upgradeable'], purchaseMaterials: {}
    },
    {
      id: 'music_player', name: 'Music Player', category: 'activity', symbol: 'MU',
      price: 90, footprint: [1, 1], styleTags: ['playful', 'vintage'],
      baseStats: { comfort: 39, beauty: 35, utility: 43, durability: 35, efficiency: 40 },
      signature: ['shared listening', 'mood anchor'], purchaseMaterials: {}
    }
  ];

  const JOBS = [
    {
      id: 'corner_cafe', name: 'Corner Café', placeId: 'place_cafe', wage: 13, shiftStart: 9, hours: 6,
      primarySkill: 'social', requirement: 0, slots: 6,
      summary: 'Serve people, keep the room moving, and learn the neighborhood by name.',
      actions: [
        { id: 'serve_carefully', name: 'Serve carefully', note: 'Steady performance and social practice.', performance: 10, skill: { social: 1.2 }, needs: { energy: -7, mood: 1 } },
        { id: 'rush_counter', name: 'Push the rush', note: 'More output, more fatigue.', performance: 15, skill: { focus: 1 }, needs: { energy: -11, hunger: -5 } },
        { id: 'help_coworker', name: 'Help a coworker', note: 'Builds trust without taking control.', performance: 8, skill: { social: 0.8 }, coworker: true, needs: { energy: -7, mood: 2 } },
        { id: 'improve_flow', name: 'Improve the flow', note: 'Small process experiment.', performance: 12, skill: { creativity: 0.8, focus: 0.6 }, innovation: 1, needs: { energy: -8 } }
      ]
    },
    {
      id: 'parcel_depot', name: 'Parcel Depot', placeId: 'place_depot', wage: 15, shiftStart: 8, hours: 7,
      primarySkill: 'focus', requirement: 8, slots: 8,
      summary: 'Sort, route, repair small mistakes, and keep deliveries understandable.',
      actions: [
        { id: 'sort_route', name: 'Sort a route', note: 'Reliable focused work.', performance: 11, skill: { focus: 1.4 }, needs: { energy: -8 } },
        { id: 'repair_label', name: 'Repair a broken label', note: 'Prevents a package from vanishing into the system.', performance: 12, skill: { repair: 0.8, focus: 0.6 }, needs: { energy: -8 } },
        { id: 'help_loader', name: 'Help a loader', note: 'Builds a coworker relationship.', performance: 8, skill: { social: 0.6 }, coworker: true, needs: { energy: -9 } },
        { id: 'map_bottleneck', name: 'Map a bottleneck', note: 'Slower now, useful later.', performance: 9, skill: { creativity: 0.8, focus: 0.8 }, innovation: 1, needs: { energy: -7 } }
      ]
    },
    {
      id: 'repair_workshop', name: 'Repair Workshop', placeId: 'place_workshop', wage: 18, shiftStart: 10, hours: 6,
      primarySkill: 'repair', requirement: 18, slots: 5,
      summary: 'Restore useful objects instead of treating replacement as progress.',
      actions: [
        { id: 'diagnose_item', name: 'Diagnose an item', note: 'Find the actual failure before replacing parts.', performance: 11, skill: { repair: 1.4, focus: 0.5 }, needs: { energy: -8 } },
        { id: 'restore_piece', name: 'Restore a piece', note: 'Builds repair skill and sometimes yields materials.', performance: 13, skill: { repair: 1.5 }, materialChance: 0.25, needs: { energy: -10 } },
        { id: 'teach_customer', name: 'Teach a customer', note: 'Gives agency instead of dependency.', performance: 8, skill: { social: 0.9, repair: 0.5 }, needs: { energy: -7, mood: 2 } },
        { id: 'design_jig', name: 'Design a small jig', note: 'Improves future work without hidden automation.', performance: 10, skill: { creativity: 1, repair: 0.7 }, innovation: 2, needs: { energy: -8 } }
      ]
    },
    {
      id: 'neighborhood_library', name: 'Neighborhood Library', placeId: 'place_library', wage: 16, shiftStart: 10, hours: 6,
      primarySkill: 'social', requirement: 15, slots: 4,
      summary: 'Help people find information, maintain quiet systems, and host small activities.',
      actions: [
        { id: 'help_reader', name: 'Help a reader', note: 'Human-facing guidance.', performance: 10, skill: { social: 1, focus: 0.5 }, needs: { energy: -6, mood: 1 } },
        { id: 'catalogue', name: 'Catalogue a shelf', note: 'Precise quiet work.', performance: 11, skill: { focus: 1.3 }, needs: { energy: -6 } },
        { id: 'host_table', name: 'Host a small table', note: 'Creates new neighborhood links.', performance: 9, skill: { social: 1.2, creativity: 0.5 }, coworker: true, needs: { energy: -8, mood: 2 } },
        { id: 'repair_archive', name: 'Repair an archive box', note: 'Preserve source history.', performance: 10, skill: { repair: 0.7, focus: 0.7 }, needs: { energy: -7 } }
      ]
    },
    {
      id: 'design_coop', name: 'Small Design Co-op', placeId: 'place_design', wage: 22, shiftStart: 11, hours: 6,
      primarySkill: 'creativity', requirement: 30, slots: 4,
      summary: 'Turn practical needs into visual and spatial experiments.',
      actions: [
        { id: 'draft_layout', name: 'Draft a layout', note: 'Focused design work.', performance: 11, skill: { creativity: 1.4, focus: 0.5 }, needs: { energy: -8 } },
        { id: 'prototype', name: 'Prototype a piece', note: 'Turns an idea into something testable.', performance: 12, skill: { creativity: 1.1, repair: 0.7 }, innovation: 1, needs: { energy: -9 } },
        { id: 'review_with_peer', name: 'Review with a peer', note: 'Improves work through mutual explanation.', performance: 9, skill: { social: 0.8, creativity: 0.6 }, coworker: true, needs: { energy: -7 } },
        { id: 'document_source', name: 'Document the source', note: 'Keeps decisions traceable.', performance: 10, skill: { focus: 1, creativity: 0.4 }, needs: { energy: -6 } }
      ]
    }
  ];

  const RESIDENTIAL_TEMPLATES = [
    { id: 'home_student', name: 'Canal Student House', type: 'student_house', x: 1, y: 1, w: 2, h: 2, capacity: 4, rent: 180, purchasePrice: 0, style: 'patched', color: '#8d6f58', roomGrid: [10, 8], sharedBathroom: true, forSale: false },
    { id: 'home_courtyard_1', name: 'Courtyard Studio 1', type: 'studio', x: 4, y: 1, w: 2, h: 2, capacity: 1, rent: 410, purchasePrice: 76000, style: 'minimal', color: '#7d91a6', roomGrid: [10, 8], forSale: false },
    { id: 'home_courtyard_2', name: 'Courtyard Studio 2', type: 'studio', x: 6, y: 1, w: 2, h: 2, capacity: 1, rent: 435, purchasePrice: 81000, style: 'clean', color: '#879b91', roomGrid: [10, 8], forSale: true },
    { id: 'home_bakery_flat', name: 'Flat Above the Bakery', type: 'apartment', x: 10, y: 1, w: 2, h: 2, capacity: 2, rent: 610, purchasePrice: 119000, style: 'warm', color: '#ad7b64', roomGrid: [12, 8], forSale: false },
    { id: 'home_rooftop', name: 'Rooftop Walk-up', type: 'apartment', x: 13, y: 1, w: 2, h: 2, capacity: 2, rent: 680, purchasePrice: 132000, style: 'playful', color: '#826f9c', roomGrid: [12, 8], forSale: true },
    { id: 'home_lane_1', name: 'Old Lane House 1', type: 'house', x: 1, y: 7, w: 2, h: 2, capacity: 3, rent: 820, purchasePrice: 168000, style: 'vintage', color: '#9a684f', roomGrid: [14, 9], forSale: false },
    { id: 'home_lane_2', name: 'Old Lane House 2', type: 'house', x: 4, y: 7, w: 2, h: 2, capacity: 3, rent: 850, purchasePrice: 176000, style: 'green', color: '#6f8c72', roomGrid: [14, 9], forSale: true },
    { id: 'home_lane_3', name: 'Old Lane House 3', type: 'house', x: 7, y: 7, w: 2, h: 2, capacity: 3, rent: 780, purchasePrice: 161000, style: 'patched', color: '#866b57', roomGrid: [14, 9], forSale: false },
    { id: 'home_station_1', name: 'Station Apartment A', type: 'apartment', x: 11, y: 7, w: 2, h: 2, capacity: 2, rent: 590, purchasePrice: 115000, style: 'industrial', color: '#707c86', roomGrid: [12, 8], forSale: false },
    { id: 'home_station_2', name: 'Station Apartment B', type: 'apartment', x: 14, y: 7, w: 2, h: 2, capacity: 2, rent: 625, purchasePrice: 121000, style: 'minimal', color: '#8796a0', roomGrid: [12, 8], forSale: true },
    { id: 'home_garden_1', name: 'Small Garden Home', type: 'house', x: 1, y: 10, w: 2, h: 2, capacity: 4, rent: 1030, purchasePrice: 218000, style: 'green', color: '#788f68', roomGrid: [15, 10], forSale: false },
    { id: 'home_garden_2', name: 'Brick End House', type: 'house', x: 5, y: 10, w: 2, h: 2, capacity: 4, rent: 990, purchasePrice: 207000, style: 'warm', color: '#8f5549', roomGrid: [15, 10], forSale: true },
    { id: 'home_quiet_flat', name: 'Quiet Corner Flat', type: 'apartment', x: 10, y: 10, w: 2, h: 2, capacity: 2, rent: 555, purchasePrice: 108000, style: 'clean', color: '#8f9a8d', roomGrid: [12, 8], forSale: false },
    { id: 'home_river_room', name: 'River Room', type: 'studio', x: 14, y: 10, w: 2, h: 2, capacity: 1, rent: 470, purchasePrice: 92000, style: 'minimal', color: '#668a99', roomGrid: [10, 8], forSale: true }
  ];

  const PUBLIC_PLACES = [
    { id: 'place_cafe', name: 'Corner Café', type: 'work', x: 4, y: 4, w: 2, h: 1, color: '#b36f52', symbol: 'CA', description: 'Coffee, short shifts, regulars, and local gossip.' },
    { id: 'place_depot', name: 'Parcel Depot', type: 'work', x: 7, y: 4, w: 2, h: 1, color: '#667c8f', symbol: 'PD', description: 'A practical workplace where the town passes through in boxes.' },
    { id: 'place_workshop', name: 'Repair Workshop', type: 'work', x: 10, y: 4, w: 2, h: 1, color: '#8f6b45', symbol: 'RW', description: 'Restore furniture, recover materials, and learn why things fail.' },
    { id: 'place_library', name: 'Neighborhood Library', type: 'work', x: 13, y: 4, w: 2, h: 1, color: '#786c91', symbol: 'LI', description: 'A quiet civic room for knowledge and small gatherings.' },
    { id: 'place_design', name: 'Small Design Co-op', type: 'work', x: 16, y: 4, w: 1, h: 1, color: '#5f8b89', symbol: 'DC', description: 'A tiny co-op for spatial and visual work.' },
    { id: 'place_market', name: 'Material Market', type: 'shop', x: 8, y: 6, w: 2, h: 1, color: '#9b8654', symbol: 'MM', description: 'Paint, parts, wood, fabric, and secondhand household items.' },
    { id: 'place_park', name: 'Pocket Park', type: 'park', x: 12, y: 6, w: 3, h: 1, color: '#5d8d67', symbol: 'PK', description: 'A thin strip of trees, benches, and accidental meetings.' },
    { id: 'place_square', name: 'Small Square', type: 'public', x: 4, y: 6, w: 2, h: 1, color: '#8f8a7c', symbol: 'SQ', description: 'A simple shared space used for markets and waiting.' },
    { id: 'place_school', name: 'Neighborhood Learning House', type: 'learning', x: 16, y: 6, w: 1, h: 1, color: '#8f7f5d', symbol: 'LH', description: 'A small learning house that mixes study, practical projects, play, and community support.' }
  ];

  const FIRST_NAMES = [
    'Ari', 'Bram', 'Cleo', 'Daan', 'Elin', 'Farah', 'Gio', 'Hana', 'Iris', 'Jules', 'Kian', 'Lena',
    'Mara', 'Noah', 'Omar', 'Pia', 'Quin', 'Ravi', 'Sana', 'Tess', 'Uma', 'Viktor', 'Wes', 'Yara',
    'Zeno', 'Liv', 'Milo', 'Nora', 'Sam', 'Roos', 'Imani', 'Bo', 'Nika', 'Sven', 'Ayla', 'Joost'
  ];

  const LAST_NAMES = [
    'de Wit', 'Bakker', 'Vermeer', 'Jansen', 'Smit', 'Vos', 'Mulder', 'Meijer', 'Bos', 'Dekker',
    'van Dijk', 'Koster', 'Prins', 'Kuiper', 'Martens', 'Hendriks', 'de Boer', 'Groen', 'Jacobs', 'Visser'
  ];

  const PERSONAL_GOALS = [
    'build a calm home', 'become excellent at a craft', 'know the whole street', 'save for freedom',
    'make a family on their own terms', 'restore old things', 'create a beautiful room', 'find meaningful work',
    'live with fewer obligations', 'become part of the neighborhood', 'own a small garden', 'keep changing directions'
  ];

  const ACTIVITIES = [
    { id: 'gentle_routine', name: 'Take care of the basics', hours: 2, cost: 4, description: 'Eat something simple, wash, breathe, and reset in one choice instead of four maintenance clicks.', effects: { hunger: 38, hygiene: 42, energy: 10, mood: 9, social: 2 }, skill: { cooking: 0.25 } },
    { id: 'eat_home', name: 'Make a basic meal', hours: 1, cost: 4, description: 'Cheap, practical, and slowly trains cooking.', effects: { hunger: 48, energy: 2, mood: 2 }, skill: { cooking: 0.9 } },
    { id: 'eat_out', name: 'Eat at the café', hours: 1, cost: 14, description: 'More expensive, more social atmosphere.', effects: { hunger: 60, mood: 7, social: 4 }, skill: {} },
    { id: 'shower', name: 'Use the bathroom', hours: 1, cost: 0, description: 'The student house bathroom is shared and may be occupied.', effects: { hygiene: 68, mood: 2 }, skill: {} },
    { id: 'sleep', name: 'Sleep', hours: 8, cost: 0, description: 'Advance through the night and recover energy.', effects: { energy: 90, mood: 4, hunger: -12, hygiene: -8 }, skill: {} },
    { id: 'play_pc', name: 'Play on the computer', hours: 2, cost: 0, description: 'A proper side activity, not merely a mood button.', effects: { mood: 20, social: -2, energy: -6 }, skill: { creativity: 0.4 } },
    { id: 'study_focus', name: 'Study a practical topic', hours: 2, cost: 0, description: 'Improves focus and creates access to more jobs.', effects: { mood: -2, energy: -8 }, skill: { focus: 1.8 } },
    { id: 'practice_repair', name: 'Practice repairs', hours: 2, cost: 3, description: 'Work on discarded parts and learn by doing.', effects: { mood: 2, energy: -9 }, skill: { repair: 1.7 } },
    { id: 'walk_park', name: 'Walk through the park', hours: 2, cost: 0, description: 'Restores mood and creates a chance encounter.', effects: { mood: 14, energy: -5, social: 3 }, skill: {} },
    { id: 'clean_home', name: 'Clean and maintain home', hours: 1, cost: 0, description: 'Improves the space without buying a replacement.', effects: { mood: 3, energy: -5, hygiene: -3 }, skill: { repair: 0.3 } },
    { id: 'salvage', name: 'Search for reusable materials', hours: 2, cost: 0, description: 'Find a small, deterministic mix of repair materials.', effects: { mood: 4, energy: -10, hygiene: -9 }, skill: { repair: 0.7 } },
    { id: 'creative_time', name: 'Make something small', hours: 2, cost: 2, description: 'Train creativity without turning it into a career requirement.', effects: { mood: 12, energy: -7 }, skill: { creativity: 1.4 } }
  ];

  const TUTORIAL_GOALS = [
    { id: 'inspect_homes', label: 'Inspect three homes on the living map', target: 3 },
    { id: 'earn_money', label: 'Earn €400 through work', target: 400 },
    { id: 'upgrade_object', label: 'Upgrade an object you actually like', target: 1 },
    { id: 'make_friend', label: 'Build one friendship without controlling the other person', target: 1 },
    { id: 'rent_home', label: 'Choose and rent a home when one is genuinely vacant', target: 1 }
  ];

  function paletteById(id) {
    return PALETTE.find((entry) => entry.id === id) || PALETTE[0];
  }

  function furnitureById(id) {
    return FURNITURE_CATALOG.find((entry) => entry.id === id) || null;
  }

  function jobById(id) {
    return JOBS.find((entry) => entry.id === id) || null;
  }

  function activityById(id) {
    return ACTIVITIES.find((entry) => entry.id === id) || null;
  }

  function placeTemplateById(id) {
    return RESIDENTIAL_TEMPLATES.concat(PUBLIC_PLACES).find((entry) => entry.id === id) || null;
  }

  AXM.Content = {
    PALETTE,
    STYLES,
    MATERIALS,
    FURNITURE_CATALOG,
    JOBS,
    RESIDENTIAL_TEMPLATES,
    PUBLIC_PLACES,
    FIRST_NAMES,
    LAST_NAMES,
    PERSONAL_GOALS,
    ACTIVITIES,
    TUTORIAL_GOALS,
    paletteById,
    furnitureById,
    jobById,
    activityById,
    placeTemplateById
  };
}(typeof window !== 'undefined' ? window : globalThis));
