(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Systems = AXM.Systems;
  const Directions = AXM.Directions;

  const NEED_SCHEMA = 'axm.living-city.local-need/v0.8.0';
  const PREMISE_SCHEMA = 'axm.living-city.commercial-premise/v0.8.0';
  const ENTERPRISE_SCHEMA = 'axm.living-city.enterprise/v0.8.0';
  const EQUIPMENT_SCHEMA = 'axm.living-city.enterprise-equipment/v0.8.0';
  const SESSION_SCHEMA = 'axm.living-city.enterprise-session/v0.8.0';
  const WORK_OFFER_SCHEMA = 'axm.living-city.enterprise-work-offer/v0.8.0';

  const ENTERPRISE_PATHS = ['private_hobby', 'occasional_service', 'tiny_enterprise', 'cooperative'];
  const ENTERPRISE_STATUSES = ['private', 'occasional', 'open', 'paused', 'closed'];
  const PRICING_MODES = ['pay_what_fits', 'fixed_fair', 'free_exchange'];
  const SESSION_STATUSES = ['active', 'completed', 'cancelled'];
  const WORK_OFFER_STATUSES = ['pending_npc', 'accepted', 'declined', 'withdrawn', 'ended'];
  const EQUIPMENT_AXES = ['care', 'reliability', 'capacity', 'efficiency'];

  // The economy owns a deterministic substream so adding enterprise activity
  // cannot silently change unrelated household, family, housing, or community rolls.
  function ensureEconomyRng(world) {
    if (!Number.isInteger(world.economyRngState)) {
      world.economyRngState = Core.hashString(`${world.seed || 'AXM'}|economy-v0.8`) || 1;
    }
    return world.economyRngState;
  }

  function nextEconomyRandom(world) {
    ensureEconomyRng(world);
    world.economyRngState = (Math.imul(1664525, world.economyRngState >>> 0) + 1013904223) >>> 0;
    return world.economyRngState / 4294967296;
  }

  function economyChance(world, probability) {
    return nextEconomyRandom(world) < Core.clamp(probability, 0, 1);
  }

  function economyRandomInt(world, min, maxInclusive) {
    const low = Math.ceil(min);
    const high = Math.floor(maxInclusive);
    return low + Math.floor(nextEconomyRandom(world) * (high - low + 1));
  }

  function economyChoice(world, values) {
    if (!Array.isArray(values) || !values.length) return undefined;
    return values[economyRandomInt(world, 0, values.length - 1)];
  }

  function economyWeightedChoice(world, entries, weightAccessor = (entry) => entry.weight || 1) {
    if (!entries || !entries.length) return undefined;
    const weights = entries.map((entry) => Math.max(0, Number(weightAccessor(entry)) || 0));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return economyChoice(world, entries);
    let cursor = nextEconomyRandom(world) * total;
    for (let i = 0; i < entries.length; i += 1) {
      cursor -= weights[i];
      if (cursor <= 0) return entries[i];
    }
    return entries[entries.length - 1];
  }

  const COMMERCIAL_PREMISES = [
    {
      id: 'place_lane_workroom', name: 'Vacant Lane Workroom', x: 9, y: 8, w: 1, h: 1,
      color: '#7b6d5d', symbol: 'LW', weeklyLease: 42, deposit: 84, utilityBase: 11,
      description: 'A small street-level room with an honest window, one sink, and enough space for a very small direction.'
    },
    {
      id: 'place_square_kiosk', name: 'Square Kiosk', x: 6, y: 6, w: 1, h: 1,
      color: '#8b7d53', symbol: 'SK', weeklyLease: 31, deposit: 62, utilityBase: 8,
      description: 'A compact kiosk beside the square. Good for occasional opening rather than endless operating hours.'
    },
    {
      id: 'place_arcade_room', name: 'Old Arcade Room', x: 16, y: 8, w: 1, h: 1,
      color: '#6b7187', symbol: 'AR', weeklyLease: 53, deposit: 106, utilityBase: 14,
      description: 'A narrow former shop room with old marks on the walls and no obligation to become a chain.'
    },
    {
      id: 'place_river_workroom', name: 'River Workroom', x: 16, y: 11, w: 1, h: 1,
      color: '#587d83', symbol: 'RW', weeklyLease: 47, deposit: 94, utilityBase: 12,
      description: 'A quiet room near the river suited to repair, making, learning, or something not easily categorized.'
    }
  ];

  const LOCAL_NEED_TEMPLATES = [
    {
      id: 'repair_care', name: 'Repair and object care',
      description: 'Residents have useful things wearing out and would rather understand, maintain, or restore them than replace everything.',
      enterpriseTemplates: ['repair_table', 'reuse_nook']
    },
    {
      id: 'affordable_food', name: 'Affordable food and warm pauses',
      description: 'Some residents need simple food, a short place to sit, or a modest shared pause without premium pricing.',
      enterpriseTemplates: ['warm_counter']
    },
    {
      id: 'practical_learning', name: 'Practical learning and source help',
      description: 'Residents have questions, skills they want to grow, and moments where patient guidance is more useful than another opaque service.',
      enterpriseTemplates: ['learning_table', 'creative_studio']
    },
    {
      id: 'creative_support', name: 'Creative and visual support',
      description: 'People have small ideas, rooms, events, stories, and projects that could use help becoming visible without becoming corporate products.',
      enterpriseTemplates: ['creative_studio']
    },
    {
      id: 'reuse_access', name: 'Reuse and low-cost useful goods',
      description: 'The town contains underused objects and residents with limited budgets. Careful reuse can connect the two without artificial rarity.',
      enterpriseTemplates: ['reuse_nook', 'repair_table']
    },
    {
      id: 'local_connection', name: 'Small local connection',
      description: 'Residents sometimes need a reason to cross paths, ask for help, or discover a nearby person without being trapped in engagement mechanics.',
      enterpriseTemplates: ['neighborhood_desk', 'warm_counter', 'learning_table']
    }
  ];

  const ENTERPRISE_TEMPLATES = [
    {
      id: 'repair_table', name: 'Repair & Care Table', needTypes: ['repair_care', 'reuse_access'],
      description: 'Diagnose, repair, explain, and preserve useful objects. The customer keeps agency and the object keeps its identity.',
      basePrice: 18, starterCost: 85, baseCapacity: 3,
      equipment: [{ catalogId: 'workbench', label: 'Compact repair bench', condition: 68 }],
      actions: [
        { id: 'diagnose_first', name: 'Diagnose before replacing', note: 'Raises care and reliability.', quality: 10, capacity: 0, skill: { repair: 0.8, focus: 0.45 }, needs: { energy: -4, mood: 1 } },
        { id: 'restore_carefully', name: 'Restore carefully', note: 'Higher output with real fatigue and equipment wear.', quality: 12, capacity: 1, skill: { repair: 1.0 }, needs: { energy: -6, hunger: -2 } },
        { id: 'teach_owner', name: 'Teach the owner', note: 'Less throughput, more customer agency.', quality: 9, capacity: 0, agency: 4, skill: { social: 0.6, repair: 0.45 }, needs: { energy: -4, mood: 2 } }
      ]
    },
    {
      id: 'warm_counter', name: 'Warm Counter', needTypes: ['affordable_food', 'local_connection'],
      description: 'A tiny food or drink direction built around modest prices, a short welcome, and no requirement to operate all day.',
      basePrice: 8, starterCost: 70, baseCapacity: 4,
      equipment: [{ catalogId: 'kitchenette', label: 'Small service kitchenette', condition: 72 }],
      actions: [
        { id: 'prepare_simple', name: 'Prepare something simple', note: 'Reliable food without unnecessary complexity.', quality: 9, capacity: 2, skill: { cooking: 0.85, focus: 0.25 }, needs: { energy: -5, hunger: -2 } },
        { id: 'welcome_regulars', name: 'Welcome regulars', note: 'Improves care without forcing intimacy.', quality: 8, capacity: 0, skill: { social: 0.8 }, needs: { energy: -4, mood: 2 } },
        { id: 'reduce_waste', name: 'Use what is already here', note: 'Slower output, lower session cost.', quality: 9, capacity: 0, savings: 3, skill: { cooking: 0.4, creativity: 0.35 }, needs: { energy: -4 } }
      ]
    },
    {
      id: 'creative_studio', name: 'Small Creative Studio', needTypes: ['creative_support', 'practical_learning'],
      description: 'Help a person make an idea visible while keeping source, ownership, and authorship clear.',
      basePrice: 24, starterCost: 95, baseCapacity: 2,
      equipment: [{ catalogId: 'old_laptop', label: 'Faithful studio computer', condition: 66 }, { catalogId: 'tiny_desk', label: 'Compact work surface', condition: 76 }],
      actions: [
        { id: 'listen_brief', name: 'Listen before shaping', note: 'Improves fit and source integrity.', quality: 11, capacity: 0, skill: { social: 0.45, focus: 0.55 }, needs: { energy: -4 } },
        { id: 'prototype_visible', name: 'Make a visible prototype', note: 'Adds output without pretending the first version is final.', quality: 12, capacity: 1, skill: { creativity: 0.95, focus: 0.35 }, needs: { energy: -6 } },
        { id: 'document_source', name: 'Document the source', note: 'Preserves decisions and contributor ownership.', quality: 10, capacity: 0, agency: 3, skill: { focus: 0.75, creativity: 0.35 }, needs: { energy: -4, mood: 1 } }
      ]
    },
    {
      id: 'learning_table', name: 'Practical Learning Table', needTypes: ['practical_learning', 'local_connection'],
      description: 'Offer patient help with a skill or question. The aim is greater agency, not permanent dependency.',
      basePrice: 12, starterCost: 45, baseCapacity: 4,
      equipment: [{ catalogId: 'story_shelf', label: 'Shared reference shelf', condition: 78 }],
      actions: [
        { id: 'clarify_question', name: 'Clarify the real question', note: 'Prevents a generic answer from replacing the person’s actual need.', quality: 10, capacity: 0, agency: 3, skill: { focus: 0.6, social: 0.5 }, needs: { energy: -4 } },
        { id: 'practice_together', name: 'Practice together', note: 'Builds capability through doing.', quality: 11, capacity: 1, agency: 4, skill: { social: 0.65, focus: 0.5 }, needs: { energy: -5, mood: 1 } },
        { id: 'leave_sources', name: 'Leave usable sources', note: 'The person can continue without the service.', quality: 9, capacity: 0, agency: 5, skill: { focus: 0.7 }, needs: { energy: -3 } }
      ]
    },
    {
      id: 'reuse_nook', name: 'Reuse Nook', needTypes: ['reuse_access', 'repair_care'],
      description: 'Clean, repair, explain, and rehome useful things without manufacturing collector scarcity.',
      basePrice: 14, starterCost: 60, baseCapacity: 4,
      equipment: [{ catalogId: 'crate_shelf', label: 'Reused display shelves', condition: 64 }, { catalogId: 'small_table', label: 'Assessment table', condition: 69 }],
      actions: [
        { id: 'assess_honestly', name: 'Assess honestly', note: 'Separates condition, history, and uncertainty.', quality: 10, capacity: 1, skill: { focus: 0.6, repair: 0.4 }, needs: { energy: -4 } },
        { id: 'clean_repair', name: 'Clean and repair', note: 'Improves useful life before resale.', quality: 11, capacity: 1, skill: { repair: 0.8 }, needs: { energy: -5, hygiene: -2 } },
        { id: 'tell_history', name: 'Keep the object history visible', note: 'Adds provenance rather than fake prestige.', quality: 9, capacity: 0, agency: 3, skill: { social: 0.45, focus: 0.35 }, needs: { energy: -3, mood: 1 } }
      ]
    },
    {
      id: 'neighborhood_desk', name: 'Neighborhood Help Desk', needTypes: ['local_connection', 'practical_learning'],
      description: 'A bounded local service that helps people find a person, place, tool, or next step without harvesting attention.',
      basePrice: 6, starterCost: 35, baseCapacity: 5,
      equipment: [{ catalogId: 'tiny_desk', label: 'Local help desk', condition: 74 }],
      actions: [
        { id: 'listen_request', name: 'Listen to the request', note: 'Keeps the resident’s own goal authoritative.', quality: 9, capacity: 1, agency: 3, skill: { social: 0.7, focus: 0.35 }, needs: { energy: -3 } },
        { id: 'connect_locally', name: 'Connect locally', note: 'Uses existing town places and relationships.', quality: 10, capacity: 2, agency: 4, skill: { social: 0.8 }, needs: { energy: -4 } },
        { id: 'leave_space', name: 'Leave space to decide', note: 'No pressure to accept the suggested next step.', quality: 8, capacity: 0, agency: 5, skill: { focus: 0.45 }, needs: { energy: -2, mood: 1 } }
      ]
    }
  ];

  function ensureMetric(world, key) {
    if (!Number.isFinite(world.metrics[key])) world.metrics[key] = 0;
  }

  function economyUniqueId(world, prefix) {
    world.economyIdCounter = (world.economyIdCounter || 0) + 1;
    return `${prefix}_${String(world.economyIdCounter).padStart(5, '0')}`;
  }

  function economyRandom(world) {
    world.economyRngState = (Math.imul(1664525, world.economyRngState >>> 0) + 1013904223) >>> 0;
    return world.economyRngState / 4294967296;
  }

  function economyChance(world, probability) {
    return economyRandom(world) < Core.clamp(probability, 0, 1);
  }

  function economyRandomInt(world, min, maxInclusive) {
    const low = Math.ceil(min);
    const high = Math.floor(maxInclusive);
    return Math.floor(economyRandom(world) * (high - low + 1)) + low;
  }

  function economyChoice(world, values) {
    if (!Array.isArray(values) || !values.length) return undefined;
    return values[economyRandomInt(world, 0, values.length - 1)];
  }

  function economyWeightedChoice(world, entries, weightAccessor = (entry) => entry.weight || 1) {
    if (!Array.isArray(entries) || !entries.length) return undefined;
    const weights = entries.map((entry) => Math.max(0, Number(weightAccessor(entry)) || 0));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return economyChoice(world, entries);
    let cursor = economyRandom(world) * total;
    for (let index = 0; index < entries.length; index += 1) {
      cursor -= weights[index];
      if (cursor <= 0) return entries[index];
    }
    return entries[entries.length - 1];
  }

  function templateById(templateId) {
    return ENTERPRISE_TEMPLATES.find((entry) => entry.id === templateId) || null;
  }

  function needTemplateById(needId) {
    const clean = String(needId || '').replace(/^need_/, '');
    return LOCAL_NEED_TEMPLATES.find((entry) => entry.id === clean) || null;
  }

  function commercialPremises(world) {
    return (world.places || []).filter((place) => place.kind === 'commercial');
  }

  function premiseById(world, premiseId) {
    const place = World.getPlace(world, premiseId);
    return place?.kind === 'commercial' ? place : null;
  }

  function enterpriseById(world, enterpriseId) {
    return (world.enterprises || []).find((entry) => entry.id === enterpriseId) || null;
  }

  function sessionById(world, sessionId) {
    return (world.enterpriseSessions || []).find((entry) => entry.id === sessionId) || null;
  }

  function workOfferById(world, offerId) {
    return (world.enterpriseWorkOffers || []).find((entry) => entry.id === offerId) || null;
  }

  function enterprisesFor(world, ownerId) {
    return (world.enterprises || []).filter((entry) => entry.ownerId === ownerId);
  }

  function needById(world, needId) {
    return (world.localNeeds || []).find((entry) => entry.id === needId || entry.templateId === needId || entry.id === `need_${needId}`) || null;
  }

  function ownerRecord(world, ownerId) {
    return World.getPerson(world, ownerId);
  }

  function ownerMoney(world, ownerId) {
    return Core.safeNumber(ownerRecord(world, ownerId)?.money, 0);
  }

  function changeOwnerMoney(world, ownerId, delta) {
    const owner = ownerRecord(world, ownerId);
    if (!owner) return false;
    owner.money = Core.round(Core.safeNumber(owner.money, 0) + delta, 2);
    if (ownerId === 'player' && delta < 0) owner.lifetimeSpend = Core.safeNumber(owner.lifetimeSpend, 0) + Math.abs(delta);
    if (delta > 0) owner.lifetimeEarnings = Core.safeNumber(owner.lifetimeEarnings, 0) + delta;
    return true;
  }

  function appendEnterpriseHistory(world, enterprise, type, message, details = {}) {
    if (!Array.isArray(enterprise.history)) enterprise.history = [];
    const entry = {
      id: economyUniqueId(world, 'enterprise_event'), day: world.time.day, hour: world.time.hour,
      type, message,
      actorIds: Array.isArray(details.actorIds) ? details.actorIds.slice() : [],
      customerIds: Array.isArray(details.customerIds) ? details.customerIds.slice() : [],
      causes: Array.isArray(details.causes) ? details.causes.slice() : [],
      evidence: details.evidence || null
    };
    enterprise.history.push(entry);
    if (enterprise.history.length > 320) enterprise.history.splice(0, enterprise.history.length - 320);
    enterprise.updatedDay = world.time.day;
    return entry;
  }

  function appendPremiseHistory(world, premise, type, message, details = {}) {
    if (!Array.isArray(premise.history)) premise.history = [];
    const entry = {
      id: economyUniqueId(world, 'premise_event'), day: world.time.day, hour: world.time.hour,
      type, message,
      actorIds: Array.isArray(details.actorIds) ? details.actorIds.slice() : [],
      enterpriseId: details.enterpriseId || null,
      causes: Array.isArray(details.causes) ? details.causes.slice() : [],
      evidence: details.evidence || null
    };
    premise.history.push(entry);
    if (premise.history.length > 200) premise.history.splice(0, premise.history.length - 200);
    return entry;
  }

  function appendEquipmentHistory(world, equipment, type, message, details = {}) {
    if (!Array.isArray(equipment.history)) equipment.history = [];
    const entry = {
      id: economyUniqueId(world, 'equipment_event'), day: world.time.day, hour: world.time.hour,
      type, message, actorId: details.actorId || null,
      causes: Array.isArray(details.causes) ? details.causes.slice() : [],
      evidence: details.evidence || null
    };
    equipment.history.push(entry);
    if (equipment.history.length > 140) equipment.history.splice(0, equipment.history.length - 140);
    return entry;
  }

  function createPremise(world, template) {
    return {
      ...Core.deepClone(template),
      schema: PREMISE_SCHEMA,
      kind: 'commercial', type: 'commercial',
      ownerId: 'town_commercial_trust', ownerLabel: 'Town Commercial Trust',
      listedForLease: true, occupantEnterpriseId: null,
      condition: 74 + (Core.hashString(`${world.seed}:${template.id}:condition`) % 19),
      maintenanceReserve: 360 + (Core.hashString(`${world.seed}:${template.id}:reserve`) % 520),
      history: []
    };
  }

  function addCommercialPremises(world, options = {}) {
    const existing = new Set((world.places || []).map((place) => place.id));
    COMMERCIAL_PREMISES.forEach((template) => {
      if (existing.has(template.id)) return;
      const premise = createPremise(world, template);
      world.places.push(premise);
      appendPremiseHistory(world, premise, 'foundation', `${premise.name} entered the current town state as a real commercial room.`, {
        causes: [options.migration ? 'v0.8 present-day infrastructure migration' : 'deterministic starting state'],
        evidence: { listedForLease: true, weeklyLease: premise.weeklyLease }
      });
    });
  }

  function needEvidence(world, templateId) {
    const adults = (world.people || []).filter((person) => !AXM.Family?.isDependent(person));
    const low = (values) => values.filter((entry) => entry.value < entry.threshold).map((entry) => entry.person);
    let people = [];
    let raw = 20;
    const detail = {};

    if (templateId === 'repair_care') {
      const wornOwners = [];
      (world.places || []).filter((place) => place.kind === 'residential').forEach((property) => {
        (property.furniture || []).filter((object) => object.ownershipMode !== 'property_fixture' && object.condition < 72).forEach((object) => {
          const owner = World.getPerson(world, object.ownerId);
          if (owner && owner.id !== 'player') wornOwners.push(owner);
        });
      });
      people = Array.from(new Map(wornOwners.map((person) => [person.id, person])).values());
      raw = 28 + people.length * 3.8 + adults.filter((person) => String(person.personalGoal || '').includes('restore')).length * 5;
      detail.wornPersonalObjects = wornOwners.length;
    } else if (templateId === 'affordable_food') {
      people = low(adults.map((person) => ({ person, value: Core.safeNumber(person.needs?.hunger, 100), threshold: 62 })));
      const lowCooking = adults.filter((person) => Core.safeNumber(person.skills?.cooking, 0) < 15);
      people = Array.from(new Map(people.concat(lowCooking).map((person) => [person.id, person])).values());
      raw = 24 + people.length * 2.7 + adults.filter((person) => person.money < 700).length * 1.6;
      detail.lowHungerOrCooking = people.length;
    } else if (templateId === 'practical_learning') {
      people = adults.filter((person) => Core.safeNumber(person.skills?.focus, 0) < 25 || /learn|meaningful work|craft/.test(String(person.personalGoal || '')));
      raw = 22 + people.length * 2.6;
      detail.peopleWithLearningFit = people.length;
    } else if (templateId === 'creative_support') {
      people = adults.filter((person) => Core.safeNumber(person.traits?.creativity, 0) > 55 || Core.safeNumber(person.skills?.creativity, 0) > 24 || /beautiful|create/.test(String(person.personalGoal || '')));
      raw = 18 + people.length * 2.8;
      detail.peopleWithCreativeFit = people.length;
    } else if (templateId === 'reuse_access') {
      people = adults.filter((person) => Core.safeNumber(person.traits?.thrift, 0) > 55 || person.money < 800);
      raw = 25 + people.length * 2.4;
      detail.peopleWithReuseFit = people.length;
    } else if (templateId === 'local_connection') {
      people = adults.filter((person) => Core.safeNumber(person.needs?.social, 100) < 58 || /neighborhood/.test(String(person.personalGoal || '')));
      raw = 20 + people.length * 2.9;
      detail.peopleWithConnectionFit = people.length;
    }

    return {
      score: Core.clamp(Core.round(raw, 1), 10, 96),
      personIds: people.slice(0, 10).map((person) => person.id),
      evidenceCount: people.length,
      detail
    };
  }

  function refreshLocalNeeds(world, options = {}) {
    ensureState(world);
    LOCAL_NEED_TEMPLATES.forEach((template) => {
      let record = needById(world, template.id);
      const evidence = needEvidence(world, template.id);
      if (!record) {
        record = {
          schema: NEED_SCHEMA,
          id: `need_${template.id}`,
          templateId: template.id,
          name: template.name,
          description: template.description,
          enterpriseTemplates: template.enterpriseTemplates.slice(),
          score: evidence.score,
          satisfaction: 0,
          servedCount: 0,
          freeOrFlexibleCount: 0,
          lastServedDay: null,
          updatedDay: world.time.day,
          evidence,
          history: []
        };
        world.localNeeds.push(record);
      } else {
        record.schema = NEED_SCHEMA;
        record.name = template.name;
        record.description = template.description;
        record.enterpriseTemplates = template.enterpriseTemplates.slice();
        record.score = Core.clamp(Core.round(evidence.score - Core.safeNumber(record.satisfaction, 0) * 0.18, 1), 5, 96);
        record.updatedDay = world.time.day;
        record.evidence = evidence;
      }
      if (!Array.isArray(record.history)) record.history = [];
      if (options.log) {
        record.history.push({ day: world.time.day, score: record.score, evidenceCount: evidence.evidenceCount });
        if (record.history.length > 80) record.history.splice(0, record.history.length - 80);
      }
    });
    return world.localNeeds;
  }

  function createEquipment(world, enterprise, definition, options = {}) {
    const catalog = Content.furnitureById(definition.catalogId);
    const equipment = {
      schema: EQUIPMENT_SCHEMA,
      id: economyUniqueId(world, 'enterprise_equipment'),
      enterpriseId: enterprise.id,
      ownerId: enterprise.ownerId,
      catalogId: definition.catalogId,
      name: definition.label || catalog?.name || definition.catalogId,
      acquiredDay: world.time.day,
      acquisition: options.acquisition || 'starter kit purchased for this enterprise',
      condition: Core.clamp(options.condition ?? definition.condition ?? 72, 0, 100),
      usageSessions: 0,
      upgrades: { care: 0, reliability: 0, capacity: 0, efficiency: 0 },
      history: []
    };
    appendEquipmentHistory(world, equipment, 'acquired', `${equipment.name} became enterprise equipment without replacing an older object record.`, {
      actorId: enterprise.ownerId,
      causes: [equipment.acquisition]
    });
    return equipment;
  }

  function starterEquipment(world, enterprise, template, acquisition = 'starter kit purchased for this enterprise') {
    template.equipment.forEach((definition) => {
      enterprise.equipment.push(createEquipment(world, enterprise, definition, { acquisition }));
    });
  }

  function equipmentScore(enterprise) {
    if (!enterprise.equipment?.length) return { quality: 0, capacity: 0, efficiency: 0, condition: 0 };
    const condition = Core.average(enterprise.equipment.map((entry) => entry.condition));
    const quality = Core.average(enterprise.equipment.map((entry) => Core.safeNumber(entry.upgrades?.care, 0) + Core.safeNumber(entry.upgrades?.reliability, 0)));
    const capacity = enterprise.equipment.reduce((sum, entry) => sum + Core.safeNumber(entry.upgrades?.capacity, 0), 0);
    const efficiency = Core.average(enterprise.equipment.map((entry) => Core.safeNumber(entry.upgrades?.efficiency, 0)));
    return { quality, capacity, efficiency, condition };
  }

  function deriveNeedForTemplate(world, template) {
    const compatible = (world.localNeeds || []).filter((need) => template.needTypes.includes(need.templateId));
    return compatible.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0] || null;
  }

  function sourceProjectFor(world, ownerId, projectId) {
    if (!projectId || !Directions) return null;
    const project = Directions.projectById(world, projectId);
    if (!project || project.ownerId !== ownerId) return null;
    return project;
  }

  function createEnterprise(world, options = {}, ownerId = 'player') {
    ensureState(world);
    const owner = ownerRecord(world, ownerId);
    if (!owner) return { ok: false, reason: 'Enterprise owner is unknown.' };
    if (AXM.Family?.isDependent(owner)) return { ok: false, reason: 'A dependent cannot be assigned adult enterprise ownership.' };
    const template = templateById(options.templateId || 'repair_table');
    if (!template) return { ok: false, reason: 'Unknown enterprise direction.' };
    const path = ENTERPRISE_PATHS.includes(options.path) ? options.path : 'private_hobby';
    const sourceProject = sourceProjectFor(world, ownerId, options.sourceProjectId);
    if (options.sourceProjectId && !sourceProject) return { ok: false, reason: 'The source project must belong to the enterprise owner.' };
    const need = needById(world, options.needId) || deriveNeedForTemplate(world, template);
    const title = String(options.name || `${owner.name}'s ${template.name}`).trim().slice(0, 54) || template.name;
    const purpose = String(options.purpose || sourceProject?.meaning || template.description).trim().slice(0, 280) || template.description;
    const enterprise = {
      schema: ENTERPRISE_SCHEMA,
      id: economyUniqueId(world, 'enterprise'),
      ownerId,
      name: title,
      templateId: template.id,
      sourceProjectId: sourceProject?.id || null,
      needId: need?.id || null,
      path,
      status: path === 'private_hobby' ? 'private' : 'occasional',
      purpose,
      createdDay: world.time.day,
      updatedDay: world.time.day,
      premiseId: null,
      pricing: {
        mode: PRICING_MODES.includes(options.pricingMode) ? options.pricingMode : 'pay_what_fits',
        basePrice: Core.clamp(Core.safeNumber(options.basePrice, template.basePrice), 0, 500)
      },
      schedule: { openDays: [2, 5, 7], startHour: 17, durationHours: 3, sessionsPerWeekCap: 3 },
      funds: 0,
      reserveTarget: Math.max(15, template.basePrice * 3),
      reputation: { care: 50, reliability: 50, fit: 50 },
      equipment: [],
      collaboratorIds: [],
      workerIds: [],
      workOfferIds: [],
      sessionIds: [],
      currentSessionId: null,
      customerHistory: [],
      totals: { sessions: 0, customers: 0, revenue: 0, costs: 0, wages: 0, freeOrFlexibleServices: 0, hours: 0, pausedDays: 0 },
      optional: true,
      noAgeGate: true,
      ageGate: null,
      noGrowthRequirement: true,
      noFailureLabel: true,
      history: []
    };

    world.enterprises.push(enterprise);
    if (!Array.isArray(owner.enterpriseIds)) owner.enterpriseIds = [];
    owner.enterpriseIds.push(enterprise.id);
    world.metrics.enterprisesCreated += 1;
    if (ownerId !== 'player') world.metrics.npcEnterprisesCreated += 1;

    appendEnterpriseHistory(world, enterprise, 'created', `${owner.name} began ${enterprise.name} as ${Core.titleCase(path)}.`, {
      actorIds: [ownerId],
      causes: [sourceProject ? 'chosen personal project connection' : 'chosen enterprise direction', 'optional local economy path', 'no age gate'],
      evidence: { sourceProjectId: sourceProject?.id || null, needId: enterprise.needId, noGrowthRequirement: true }
    });
    Core.appendLedger(world, 'enterprise', `${owner.name} began ${enterprise.name}. It may remain private, become occasional work, grow, pause, pivot, or close without being labeled a failed life path.`, {
      actorIds: [ownerId], placeId: owner.homePropertyId,
      causes: ['optional enterprise choice', 'no age pressure'], evidence: { enterpriseId: enterprise.id, path }
    });

    if (path !== 'private_hobby') {
      const activated = activateStarterKit(world, enterprise);
      if (!activated.ok) {
        enterprise.status = 'private';
        enterprise.path = 'private_hobby';
        appendEnterpriseHistory(world, enterprise, 'activation_deferred', 'The direction remained private because the starter resources were not available.', {
          actorIds: [ownerId], causes: [activated.reason]
        });
      }
    }

    if (path === 'tiny_enterprise' && options.premiseId) {
      const leased = leasePremise(world, enterprise.id, options.premiseId);
      if (!leased.ok) {
        enterprise.path = 'occasional_service';
        enterprise.status = 'occasional';
        appendEnterpriseHistory(world, enterprise, 'premise_deferred', 'The direction stayed occasional because the chosen room was not lawfully leased.', {
          actorIds: [ownerId], causes: [leased.reason]
        });
      }
    }

    // Starting-town businesses are background world facts. Announce a new
    // direction only when it belongs to the directly controlled player; an
    // NPC seed must not masquerade as the player's latest action.
    if (ownerId === 'player') Systems.toast(world, `${enterprise.name} began as an optional direction.`, 'success');
    return { ok: true, enterprise };
  }

  function activateStarterKit(world, enterprise) {
    if (enterprise.equipment.length) return { ok: true };
    const template = templateById(enterprise.templateId);
    if (!template) return { ok: false, reason: 'Enterprise template is missing.' };
    const cost = template.starterCost;
    if (ownerMoney(world, enterprise.ownerId) < cost) return { ok: false, reason: `The starter kit needs ${Core.formatMoney(cost)}.` };
    changeOwnerMoney(world, enterprise.ownerId, -cost);
    enterprise.totals.costs += cost;
    starterEquipment(world, enterprise, template);
    appendEnterpriseHistory(world, enterprise, 'starter_kit', `${World.personName(world, enterprise.ownerId)} funded a bounded starter kit.`, {
      actorIds: [enterprise.ownerId], causes: ['explicit activation'], evidence: { cost, equipmentIds: enterprise.equipment.map((entry) => entry.id) }
    });
    return { ok: true };
  }

  function leasePremise(world, enterpriseId, premiseId) {
    const enterprise = enterpriseById(world, enterpriseId);
    const premise = premiseById(world, premiseId);
    if (!enterprise) return { ok: false, reason: 'Enterprise not found.' };
    if (!premise) return { ok: false, reason: 'Commercial room not found.' };
    if (premise.occupantEnterpriseId && premise.occupantEnterpriseId !== enterprise.id) return { ok: false, reason: 'That room is genuinely occupied by another enterprise.' };
    if (!premise.listedForLease && premise.occupantEnterpriseId !== enterprise.id) return { ok: false, reason: 'That room is not currently offered for lease.' };
    if (enterprise.premiseId === premise.id) return { ok: true, premise };
    if (enterprise.premiseId) return { ok: false, reason: 'Release the current room before taking another.' };
    const total = Core.safeNumber(premise.deposit, 0) + Core.safeNumber(premise.weeklyLease, 0);
    if (ownerMoney(world, enterprise.ownerId) < total) return { ok: false, reason: `Leasing this room needs ${Core.formatMoney(total)} for deposit and the first week.` };
    const kit = activateStarterKit(world, enterprise);
    if (!kit.ok) return kit;
    changeOwnerMoney(world, enterprise.ownerId, -total);
    enterprise.totals.costs += total;
    enterprise.premiseId = premise.id;
    enterprise.path = enterprise.path === 'cooperative' ? 'cooperative' : 'tiny_enterprise';
    enterprise.status = 'open';
    enterprise.lease = { depositHeld: premise.deposit, weeklyLease: premise.weeklyLease, utilityBase: premise.utilityBase, startedDay: world.time.day, arrears: 0 };
    premise.occupantEnterpriseId = enterprise.id;
    premise.listedForLease = false;
    appendEnterpriseHistory(world, enterprise, 'premise_leased', `${enterprise.name} lawfully leased ${premise.name}.`, {
      actorIds: [enterprise.ownerId], causes: ['explicit premise choice', 'real vacancy'], evidence: { premiseId, deposit: premise.deposit, firstWeek: premise.weeklyLease }
    });
    appendPremiseHistory(world, premise, 'lease_started', `${enterprise.name} began using the room.`, {
      actorIds: [enterprise.ownerId], enterpriseId: enterprise.id, causes: ['signed in-simulation lease']
    });
    world.metrics.enterprisePremisesLeased += 1;
    return { ok: true, premise };
  }

  function releasePremise(world, enterprise, reason = 'explicit release') {
    if (!enterprise?.premiseId) return { ok: true, returnedDeposit: 0 };
    const premise = premiseById(world, enterprise.premiseId);
    const held = Core.safeNumber(enterprise.lease?.depositHeld, 0);
    const damage = premise ? Math.max(0, 75 - Core.safeNumber(premise.condition, 75)) * 0.8 : 0;
    const returned = Core.round(Math.max(0, held - damage), 2);
    if (returned > 0) changeOwnerMoney(world, enterprise.ownerId, returned);
    if (premise) {
      premise.occupantEnterpriseId = null;
      premise.listedForLease = true;
      appendPremiseHistory(world, premise, 'lease_ended', `${enterprise.name} released the room.`, {
        actorIds: [enterprise.ownerId], enterpriseId: enterprise.id, causes: [reason], evidence: { depositReturned: returned, conditionDeduction: Core.round(damage, 2) }
      });
    }
    appendEnterpriseHistory(world, enterprise, 'premise_released', `${enterprise.name} released ${premise?.name || 'its room'} and received the attributable deposit remainder.`, {
      actorIds: [enterprise.ownerId], causes: [reason], evidence: { returnedDeposit: returned, conditionDeduction: Core.round(damage, 2) }
    });
    enterprise.premiseId = null;
    enterprise.lease = null;
    if (enterprise.status !== 'closed') {
      enterprise.path = 'occasional_service';
      enterprise.status = 'occasional';
    }
    return { ok: true, returnedDeposit: returned };
  }

  function changeEnterprisePath(world, enterpriseId, path, premiseId = null) {
    const enterprise = enterpriseById(world, enterpriseId);
    if (!enterprise) return { ok: false, reason: 'Enterprise not found.' };
    if (!ENTERPRISE_PATHS.includes(path)) return { ok: false, reason: 'Unknown enterprise path.' };
    if (enterprise.status === 'closed') return { ok: false, reason: 'A closed enterprise remains preserved history. Begin a new direction instead of silently reopening it.' };
    if (path === enterprise.path) return { ok: true, enterprise };
    if (path === 'private_hobby') {
      releasePremise(world, enterprise, 'chosen return to private practice');
      enterprise.path = path;
      enterprise.status = 'private';
    } else if (path === 'occasional_service') {
      const kit = activateStarterKit(world, enterprise);
      if (!kit.ok) return kit;
      releasePremise(world, enterprise, 'chosen occasional home-based direction');
      enterprise.path = path;
      enterprise.status = 'occasional';
    } else if (path === 'tiny_enterprise' || path === 'cooperative') {
      const kit = activateStarterKit(world, enterprise);
      if (!kit.ok) return kit;
      if (!enterprise.premiseId) {
        const leased = leasePremise(world, enterprise.id, premiseId);
        if (!leased.ok) return leased;
      }
      enterprise.path = path;
      enterprise.status = 'open';
    }
    appendEnterpriseHistory(world, enterprise, 'path_changed', `${enterprise.name} changed direction to ${Core.titleCase(path)}.`, {
      actorIds: [enterprise.ownerId], causes: ['explicit owner choice', 'no growth ladder'], evidence: { path }
    });
    return { ok: true, enterprise };
  }

  function pauseEnterprise(world, enterpriseId, releaseRoomOnPause = false) {
    const enterprise = enterpriseById(world, enterpriseId);
    if (!enterprise || enterprise.status === 'closed') return { ok: false, reason: 'That enterprise cannot be paused.' };
    if (enterprise.currentSessionId) return { ok: false, reason: 'Finish or cancel the active session first.' };
    const premise = premiseById(world, enterprise.premiseId);
    let releasedRoom = false;
    let returnedDeposit = 0;
    if (premise && releaseRoomOnPause) {
      const released = releasePremise(world, enterprise, 'chosen pause with room release');
      if (!released.ok) return released;
      releasedRoom = true;
      returnedDeposit = Core.safeNumber(released.returnedDeposit, 0);
    }
    enterprise.status = 'paused';
    enterprise.pausedDay = world.time.day;
    enterprise.pausePremisePolicy = releasedRoom ? 'released' : premise ? 'kept_with_costs' : 'none';
    world.metrics.enterprisesPaused += 1;
    appendEnterpriseHistory(world, enterprise, 'paused', releasedRoom
      ? `${enterprise.name} paused and released its commercial room, preserving its direction and stopping future room charges.`
      : premise
        ? `${enterprise.name} paused while deliberately keeping ${premise.name}; its visible weekly room and utility costs continue until the room is released or the direction closes.`
        : `${enterprise.name} paused without losing its history or being marked a failure.`, {
      actorIds: [enterprise.ownerId],
      causes: ['explicit owner choice', 'casual realism', releasedRoom ? 'stop ongoing room pressure' : premise ? 'keep commercial room deliberately' : 'no commercial room'],
      evidence: { releasedRoom, returnedDeposit, continuingWeeklyRoomCost: releasedRoom || !premise ? 0 : Core.round(Core.safeNumber(enterprise.lease?.weeklyLease, 0) + Core.safeNumber(enterprise.lease?.utilityBase, 0), 2) }
    });
    return { ok: true, releasedRoom, returnedDeposit };
  }

  function resumeEnterprise(world, enterpriseId) {
    const enterprise = enterpriseById(world, enterpriseId);
    if (!enterprise || enterprise.status !== 'paused') return { ok: false, reason: 'That enterprise is not paused.' };
    enterprise.status = enterprise.path === 'private_hobby' ? 'private' : enterprise.premiseId ? 'open' : 'occasional';
    appendEnterpriseHistory(world, enterprise, 'resumed', `${enterprise.name} resumed on its owner’s timetable.`, {
      actorIds: [enterprise.ownerId], causes: ['explicit owner choice', 'no streak requirement']
    });
    return { ok: true };
  }

  function closeEnterprise(world, enterpriseId) {
    const enterprise = enterpriseById(world, enterpriseId);
    if (!enterprise || enterprise.status === 'closed') return { ok: false, reason: 'That enterprise is already closed or missing.' };
    if (enterprise.currentSessionId) return { ok: false, reason: 'Finish or cancel the active session first.' };
    enterprise.workerIds.slice().forEach((personId) => endEnterpriseWorker(world, enterprise.id, personId, enterprise.ownerId));
    (world.enterpriseWorkOffers || []).filter((offer) => offer.enterpriseId === enterprise.id && offer.status === 'pending_npc').forEach((offer) => {
      offer.status = 'withdrawn';
      offer.response = { day: world.time.day, hour: world.time.hour, reason: 'enterprise closed before consent' };
    });
    releasePremise(world, enterprise, 'chosen closure');
    const returnedFunds = Core.round(Math.max(0, enterprise.funds), 2);
    if (returnedFunds) changeOwnerMoney(world, enterprise.ownerId, returnedFunds);
    enterprise.funds = 0;
    enterprise.status = 'closed';
    enterprise.closedDay = world.time.day;
    world.metrics.enterprisesClosed += 1;
    appendEnterpriseHistory(world, enterprise, 'closed', `${enterprise.name} closed by choice. Its work, equipment, customers, and reasons remain preserved without a failure label.`, {
      actorIds: [enterprise.ownerId], causes: ['explicit closure', 'history preserved'], evidence: { returnedFunds }
    });
    Core.appendLedger(world, 'enterprise', `${enterprise.name} closed. Closure was recorded as a life choice, not a failed route.`, {
      actorIds: [enterprise.ownerId], causes: ['explicit owner choice'], evidence: { enterpriseId, returnedFunds }
    });
    return { ok: true, returnedFunds };
  }

  function pivotEnterprise(world, enterpriseId, templateId, needId = null) {
    const enterprise = enterpriseById(world, enterpriseId);
    const next = templateById(templateId);
    if (!enterprise || enterprise.status === 'closed') return { ok: false, reason: 'That enterprise cannot pivot.' };
    if (!next) return { ok: false, reason: 'Unknown new direction.' };
    if (enterprise.currentSessionId) return { ok: false, reason: 'Finish the current session before pivoting.' };
    const oldTemplate = enterprise.templateId;
    enterprise.templateId = next.id;
    const chosenNeed = needById(world, needId) || deriveNeedForTemplate(world, next);
    enterprise.needId = chosenNeed?.id || null;
    const missing = next.equipment.filter((definition) => !enterprise.equipment.some((entry) => entry.catalogId === definition.catalogId));
    const cost = Math.round(next.starterCost * 0.45 * (missing.length / Math.max(1, next.equipment.length)));
    if (missing.length && ownerMoney(world, enterprise.ownerId) < cost) {
      enterprise.templateId = oldTemplate;
      return { ok: false, reason: `The pivot needs ${Core.formatMoney(cost)} for only the missing equipment; existing equipment is preserved.` };
    }
    if (cost > 0) {
      changeOwnerMoney(world, enterprise.ownerId, -cost);
      enterprise.totals.costs += cost;
      missing.forEach((definition) => enterprise.equipment.push(createEquipment(world, enterprise, definition, { acquisition: 'additional equipment purchased during explicit pivot' })));
    }
    enterprise.pricing.basePrice = next.basePrice;
    world.metrics.enterprisesPivoted += 1;
    appendEnterpriseHistory(world, enterprise, 'pivoted', `${enterprise.name} pivoted from ${Core.titleCase(oldTemplate)} to ${next.name}.`, {
      actorIds: [enterprise.ownerId], causes: ['explicit owner choice', 'existing equipment preserved'], evidence: { oldTemplate, newTemplate: next.id, addedEquipmentCost: cost }
    });
    return { ok: true, enterprise };
  }

  function eligibleEnterpriseWorker(world, enterprise, person) {
    if (!enterprise || !person || person.id === enterprise.ownerId || person.id === 'player') return false;
    if (AXM.Family?.isDependent(person)) return false;
    if (enterprise.workerIds?.includes(person.id)) return false;
    const existingAccepted = (world.enterpriseWorkOffers || []).some((offer) => offer.personId === person.id && offer.status === 'accepted');
    return !existingAccepted;
  }

  function inviteEnterpriseWorker(world, enterpriseId, personId, terms = {}) {
    ensureState(world);
    const enterprise = enterpriseById(world, enterpriseId);
    const person = World.getPerson(world, personId);
    if (!enterprise || enterprise.ownerId !== 'player') return { ok: false, reason: 'You can offer work only through your own enterprise.' };
    if (!['occasional', 'open'].includes(enterprise.status)) return { ok: false, reason: 'Open or resume the direction before offering bounded work.' };
    if (!eligibleEnterpriseWorker(world, enterprise, person)) return { ok: false, reason: 'That resident is not currently available for this bounded offer.' };
    const pending = (world.enterpriseWorkOffers || []).find((offer) => offer.enterpriseId === enterprise.id && offer.personId === person.id && offer.status === 'pending_npc');
    if (pending) return { ok: false, reason: 'A work offer is already awaiting that resident.' };
    const wagePerSession = Core.clamp(Core.round(Core.safeNumber(terms.wagePerSession, 24), 2), 6, 250);
    const sessionsPerWeek = Core.clamp(Math.round(Core.safeNumber(terms.sessionsPerWeek, 1)), 1, 3);
    const offer = {
      schema: WORK_OFFER_SCHEMA,
      id: economyUniqueId(world, 'enterprise_work_offer'),
      enterpriseId: enterprise.id,
      offeredById: 'player',
      personId: person.id,
      status: 'pending_npc',
      createdDay: world.time.day,
      createdHour: world.time.hour,
      dueDay: world.time.day + 1 + economyRandomInt(world, 0, 1),
      expiresDay: world.time.day + 8,
      wagePerSession,
      sessionsPerWeek,
      sessionsWorkedThisWeek: 0,
      weekMarker: Math.floor((world.time.day - 1) / 7),
      lastWorkedDay: null,
      response: null,
      authority: {
        enterpriseWork: true,
        enterpriseOwnership: false,
        personalMoney: false,
        household: false,
        tenancy: false,
        propertyEdit: false,
        familyCare: false,
        lifeDirection: false
      },
      history: [{ day: world.time.day, hour: world.time.hour, type: 'offered', message: `${person.name} received a bounded enterprise-work offer.` }]
    };
    world.enterpriseWorkOffers.push(offer);
    enterprise.workOfferIds.push(offer.id);
    world.metrics.enterpriseWorkOffersSent += 1;
    appendEnterpriseHistory(world, enterprise, 'worker_invited', `${person.name} was offered up to ${sessionsPerWeek} session${sessionsPerWeek === 1 ? '' : 's'} per week at ${Core.formatMoney(wagePerSession)} each.`, {
      actorIds: ['player', person.id], causes: ['explicit bounded offer', 'autonomous delayed response'], evidence: { offerId: offer.id, wagePerSession, sessionsPerWeek }
    });
    Core.appendLedger(world, 'enterprise_work', `${person.name} received a bounded work offer from ${enterprise.name}. No work or authority exists until they accept.`, {
      actorIds: ['player', person.id], causes: ['consent before work'], evidence: { offerId: offer.id, enterpriseId: enterprise.id }
    });
    return { ok: true, offer };
  }

  function workOfferDecision(world, enterprise, person, offer) {
    const relation = person.relationships?.[enterprise.ownerId] || {};
    const job = Content.jobById(person.jobId);
    const jobLoad = job ? Core.safeNumber(job.hours, 6) * 5 : 0;
    const score = Core.clamp(
      35
      + Core.safeNumber(relation.trust, 0) * 0.18
      + Core.safeNumber(relation.friendship, 0) * 0.12
      + Core.safeNumber(person.traits?.ambition, 50) * 0.12
      + Core.safeNumber(person.traits?.creativity, 50) * (enterprise.templateId === 'creative_studio' ? 0.12 : 0.03)
      + offer.wagePerSession * 0.6
      - jobLoad * 0.18
      - Math.max(0, offer.sessionsPerWeek - 1) * 7
      - Core.safeNumber(person.traits?.independence, 50) * 0.05,
      0,
      100
    );
    const roll = economyRandomInt(world, 0, 100);
    return { accepted: score >= 48 && score - roll >= -18, score: Core.round(score, 1), roll };
  }

  function resolveEnterpriseWorkOffers(world) {
    ensureState(world);
    (world.enterpriseWorkOffers || []).filter((offer) => offer.status === 'pending_npc').forEach((offer) => {
      const enterprise = enterpriseById(world, offer.enterpriseId);
      const person = World.getPerson(world, offer.personId);
      if (!enterprise || enterprise.status === 'closed' || !person) {
        offer.status = 'withdrawn';
        offer.response = { day: world.time.day, reason: 'enterprise or resident unavailable' };
        return;
      }
      if (world.time.day > offer.expiresDay) {
        offer.status = 'withdrawn';
        offer.response = { day: world.time.day, reason: 'offer expired without consent' };
        offer.history.push({ day: world.time.day, hour: world.time.hour, type: 'expired', message: 'The offer expired without inventing consent.' });
        return;
      }
      if (world.time.day < offer.dueDay) return;
      const decision = workOfferDecision(world, enterprise, person, offer);
      offer.status = decision.accepted ? 'accepted' : 'declined';
      offer.response = { day: world.time.day, hour: world.time.hour, decision: offer.status, score: decision.score, roll: decision.roll };
      offer.history.push({ day: world.time.day, hour: world.time.hour, type: offer.status, message: `${person.name} ${decision.accepted ? 'accepted' : 'declined'} the bounded work offer.`, evidence: decision });
      if (decision.accepted) {
        if (!enterprise.workerIds.includes(person.id)) enterprise.workerIds.push(person.id);
        world.metrics.enterpriseWorkOffersAccepted += 1;
      } else {
        world.metrics.enterpriseWorkOffersDeclined += 1;
      }
      appendEnterpriseHistory(world, enterprise, decision.accepted ? 'worker_accepted' : 'worker_declined', `${person.name} ${decision.accepted ? 'accepted' : 'declined'} the work offer.`, {
        actorIds: [enterprise.ownerId, person.id], causes: ['autonomous resident response'], evidence: { offerId: offer.id, score: decision.score, roll: decision.roll, relationshipPenalty: 0 }
      });
    });
  }

  function withdrawEnterpriseWorkOffer(world, offerId) {
    const offer = workOfferById(world, offerId);
    const enterprise = enterpriseById(world, offer?.enterpriseId);
    if (!offer || !enterprise || enterprise.ownerId !== 'player') return { ok: false, reason: 'Work offer not found or not yours to withdraw.' };
    if (offer.status !== 'pending_npc') return { ok: false, reason: 'Only a pending offer can be withdrawn.' };
    offer.status = 'withdrawn';
    offer.response = { day: world.time.day, hour: world.time.hour, reason: 'explicit owner withdrawal' };
    offer.history.push({ day: world.time.day, hour: world.time.hour, type: 'withdrawn', message: 'The offer was withdrawn before consent.' });
    return { ok: true };
  }

  function endEnterpriseWorker(world, enterpriseId, personId, actorId = 'player') {
    const enterprise = enterpriseById(world, enterpriseId);
    if (!enterprise || enterprise.ownerId !== actorId) return { ok: false, reason: 'Only the enterprise owner can end this bounded work agreement here.' };
    const index = enterprise.workerIds.indexOf(personId);
    if (index < 0) return { ok: false, reason: 'That resident is not an active enterprise worker.' };
    enterprise.workerIds.splice(index, 1);
    (world.enterpriseWorkOffers || []).filter((offer) => offer.enterpriseId === enterprise.id && offer.personId === personId && offer.status === 'accepted').forEach((offer) => {
      offer.status = 'ended';
      offer.response = { day: world.time.day, hour: world.time.hour, reason: 'explicit work agreement ended' };
      offer.history.push({ day: world.time.day, hour: world.time.hour, type: 'ended', message: 'The bounded work agreement ended without granting any wider authority.' });
    });
    appendEnterpriseHistory(world, enterprise, 'worker_agreement_ended', `${World.personName(world, personId)} no longer works sessions here.`, {
      actorIds: [actorId, personId], causes: ['explicit bounded agreement ended'], evidence: { relationshipPenalty: 0 }
    });
    return { ok: true };
  }

  function acceptedWorkerOffers(world, enterprise) {
    const weekMarker = Math.floor((world.time.day - 1) / 7);
    return (world.enterpriseWorkOffers || []).filter((offer) => {
      if (offer.enterpriseId !== enterprise.id || offer.status !== 'accepted' || !enterprise.workerIds.includes(offer.personId)) return false;
      if (offer.weekMarker !== weekMarker) {
        offer.weekMarker = weekMarker;
        offer.sessionsWorkedThisWeek = 0;
      }
      return offer.sessionsWorkedThisWeek < offer.sessionsPerWeek;
    });
  }

  function reserveSessionWorker(world, enterprise, session) {
    const offer = acceptedWorkerOffers(world, enterprise).sort((a, b) => a.sessionsWorkedThisWeek - b.sessionsWorkedThisWeek || a.id.localeCompare(b.id))[0];
    if (!offer || enterprise.funds < offer.wagePerSession) return null;
    const person = World.getPerson(world, offer.personId);
    if (!person) return null;
    const job = Content.jobById(person.jobId);
    const weekday = Core.weekdayIndex(world.time.day);
    const workingNow = job && weekday < 5 && world.time.hour >= job.shiftStart && world.time.hour < job.shiftStart + job.hours;
    if (workingNow) return null;
    enterprise.funds = Core.round(enterprise.funds - offer.wagePerSession, 2);
    session.workerIds.push(person.id);
    session.workerOfferIds.push(offer.id);
    session.wageReserve = Core.round(session.wageReserve + offer.wagePerSession, 2);
    session.capacityBonus += 1;
    session.quality += Core.clamp((Core.safeNumber(person.skills?.focus, 0) + Core.safeNumber(person.skills?.social, 0)) / 20, 1, 7);
    return { person, offer };
  }

  function settleSessionWages(world, enterprise, session) {
    if (!session.wageReserve || !session.workerIds.length) return 0;
    const perWorker = Core.round(session.wageReserve / session.workerIds.length, 2);
    session.workerIds.forEach((personId, index) => {
      const person = World.getPerson(world, personId);
      const offer = workOfferById(world, session.workerOfferIds[index]);
      if (person) {
        person.money = Core.round(Core.safeNumber(person.money, 0) + perWorker, 2);
        person.lifetimeEarnings = Core.round(Core.safeNumber(person.lifetimeEarnings, 0) + perWorker, 2);
      }
      if (offer) {
        offer.sessionsWorkedThisWeek += 1;
        offer.lastWorkedDay = world.time.day;
        offer.history.push({ day: world.time.day, hour: world.time.hour, type: 'worked', message: `${World.personName(world, personId)} completed one bounded session.`, evidence: { wage: perWorker, sessionId: session.id } });
      }
    });
    enterprise.totals.wages = Core.round(Core.safeNumber(enterprise.totals.wages, 0) + session.wageReserve, 2);
    world.metrics.enterpriseWagesPaid = Core.round(Core.safeNumber(world.metrics.enterpriseWagesPaid, 0) + session.wageReserve, 2);
    return session.wageReserve;
  }

  function setEnterprisePricing(world, enterpriseId, mode, basePrice = null) {
    const enterprise = enterpriseById(world, enterpriseId);
    if (!enterprise || enterprise.status === 'closed') return { ok: false, reason: 'Enterprise not available.' };
    if (!PRICING_MODES.includes(mode)) return { ok: false, reason: 'Unknown pricing mode.' };
    enterprise.pricing.mode = mode;
    if (basePrice != null) enterprise.pricing.basePrice = Core.clamp(Core.safeNumber(basePrice, enterprise.pricing.basePrice), 0, 500);
    appendEnterpriseHistory(world, enterprise, 'pricing_changed', `${enterprise.name} chose ${Core.titleCase(mode)} pricing.`, {
      actorIds: [enterprise.ownerId], causes: ['explicit pricing choice'], evidence: Core.deepClone(enterprise.pricing)
    });
    return { ok: true };
  }

  function enterpriseNeedFit(world, enterprise, person) {
    const need = needById(world, enterprise.needId);
    const templateId = need?.templateId;
    let fit = 30;
    if (templateId === 'repair_care') {
      const home = World.homeOf(world, person.id);
      const worn = (home?.furniture || []).filter((object) => object.ownerId === person.id && object.condition < 75).length;
      fit += worn * 15 + Math.max(0, 40 - Core.safeNumber(person.skills?.repair, 0)) * 0.3;
    } else if (templateId === 'affordable_food') {
      fit += Math.max(0, 72 - Core.safeNumber(person.needs?.hunger, 72)) * 0.7 + Math.max(0, 20 - Core.safeNumber(person.skills?.cooking, 0)) * 0.4;
    } else if (templateId === 'practical_learning') {
      fit += Math.max(0, 35 - Core.safeNumber(person.skills?.focus, 0)) * 0.7 + (/learn|craft|work/.test(String(person.personalGoal || '')) ? 15 : 0);
    } else if (templateId === 'creative_support') {
      fit += Core.safeNumber(person.traits?.creativity, 50) * 0.35 + Core.safeNumber(person.skills?.creativity, 0) * 0.25;
    } else if (templateId === 'reuse_access') {
      fit += Core.safeNumber(person.traits?.thrift, 50) * 0.35 + (person.money < 800 ? 18 : 0);
    } else if (templateId === 'local_connection') {
      fit += Math.max(0, 70 - Core.safeNumber(person.needs?.social, 70)) * 0.55 + Core.safeNumber(person.traits?.social, 50) * 0.15;
    }
    const location = enterprise.premiseId ? premiseById(world, enterprise.premiseId) : World.homeOf(world, enterprise.ownerId);
    const home = World.homeOf(world, person.id);
    fit -= Core.distance(location, home) * 1.8;
    const relation = person.relationships?.[enterprise.ownerId];
    fit += Math.max(-8, Math.min(12, Core.safeNumber(relation?.trust, 0) * 0.12));
    return Core.clamp(fit, 1, 120);
  }

  function quotedPrice(enterprise, customer) {
    const base = Math.max(0, Core.safeNumber(enterprise.pricing?.basePrice, 0));
    if (enterprise.pricing.mode === 'free_exchange') return 0;
    if (enterprise.pricing.mode === 'fixed_fair') return Core.round(base, 2);
    const money = Core.safeNumber(customer.money, 0);
    const ability = Core.clamp(money / 1200, 0.25, 1);
    return Core.round(base * (0.35 + ability * 0.65), 2);
  }

  function candidateCustomers(world, enterprise) {
    return (world.people || [])
      .filter((person) => !AXM.Family?.isDependent(person) && person.id !== enterprise.ownerId && person.money >= 0)
      .map((person) => ({
        person,
        fit: enterpriseNeedFit(world, enterprise, person),
        price: quotedPrice(enterprise, person)
      }))
      .filter((entry) => entry.price <= entry.person.money || entry.price === 0)
      .sort((a, b) => b.fit - a.fit || a.person.id.localeCompare(b.person.id));
  }

  function createSession(world, enterprise, mode, actorId) {
    const session = {
      schema: SESSION_SCHEMA,
      id: economyUniqueId(world, 'enterprise_session'),
      enterpriseId: enterprise.id,
      ownerId: enterprise.ownerId,
      actorId,
      mode,
      status: 'active',
      startedDay: world.time.day,
      startedHour: world.time.hour,
      endedDay: null,
      endedHour: null,
      taskActions: [],
      customers: [],
      workerIds: [],
      workerOfferIds: [],
      wageReserve: 0,
      quality: 50,
      capacityBonus: 0,
      agencyBonus: 0,
      sessionSavings: 0,
      revenue: 0,
      costs: 0,
      hours: 0,
      history: []
    };
    world.enterpriseSessions.push(session);
    enterprise.sessionIds.push(session.id);
    enterprise.currentSessionId = session.id;
    reserveSessionWorker(world, enterprise, session);
    return session;
  }

  function applyEnterpriseTask(world, enterprise, session, action, actor) {
    session.taskActions.push(action.id);
    session.quality += action.quality || 0;
    session.capacityBonus += action.capacity || 0;
    session.agencyBonus += action.agency || 0;
    session.sessionSavings += action.savings || 0;
    session.hours += 1;
    if (actor) {
      Systems.applySkillEffects(actor, action.skill || {});
      Object.entries(action.needs || {}).forEach(([key, delta]) => {
        if (actor.needs && Number.isFinite(actor.needs[key])) actor.needs[key] += delta;
      });
      if (actor.id === 'player') Systems.clampNeeds(actor);
    }
    session.history.push({ day: world.time.day, hour: world.time.hour, type: 'task', actionId: action.id, quality: action.quality || 0, capacity: action.capacity || 0, agency: action.agency || 0 });
  }

  function selectCustomers(world, enterprise, session, maxCustomers) {
    const candidates = candidateCustomers(world, enterprise);
    const selected = [];
    for (const entry of candidates) {
      if (selected.length >= maxCustomers) break;
      const probability = Core.clamp(0.28 + entry.fit / 150 + Core.safeNumber(enterprise.reputation?.fit, 50) / 300, 0.2, 0.92);
      if (economyChance(world, probability)) selected.push(entry);
    }
    if (!selected.length && candidates.length && economyChance(world, 0.72)) selected.push(candidates[0]);
    return selected;
  }

  function serveCustomer(world, enterprise, session, entry) {
    const customer = entry.person;
    const price = Math.min(entry.price, Core.safeNumber(customer.money, 0));
    customer.money = Core.round(customer.money - price, 2);
    const equipment = equipmentScore(enterprise);
    const satisfaction = Core.clamp(Core.round(35 + entry.fit * 0.28 + session.quality * 0.22 + session.agencyBonus * 1.4 + equipment.quality * 1.2 - (price / Math.max(1, customer.money + price)) * 18, 1), 0, 100);
    const transaction = {
      personId: customer.id,
      price,
      needId: enterprise.needId,
      fit: Core.round(entry.fit, 1),
      satisfaction,
      flexibleOrFree: price < enterprise.pricing.basePrice * 0.85,
      reasons: ['actual resident need fit', enterprise.pricing.mode, enterprise.premiseId ? 'real commercial room' : 'bounded home-based session']
    };
    session.customers.push(transaction);
    session.revenue += price;
    enterprise.customerHistory.push({ day: world.time.day, sessionId: session.id, ...transaction });
    if (enterprise.customerHistory.length > 260) enterprise.customerHistory.splice(0, enterprise.customerHistory.length - 260);
    enterprise.totals.customers += 1;
    if (transaction.flexibleOrFree) {
      enterprise.totals.freeOrFlexibleServices += 1;
      world.metrics.enterpriseFlexibleServices += 1;
    }
    customer.needs.mood = Core.clamp(Core.safeNumber(customer.needs?.mood, 50) + Math.max(1, satisfaction / 25), 0, 100);
    if (needById(world, enterprise.needId)?.templateId === 'affordable_food') customer.needs.hunger = Core.clamp(Core.safeNumber(customer.needs.hunger, 50) + 20, 0, 100);
    if (needById(world, enterprise.needId)?.templateId === 'local_connection') customer.needs.social = Core.clamp(Core.safeNumber(customer.needs.social, 50) + 9, 0, 100);
    return transaction;
  }

  function settleSession(world, enterprise, session, options = {}) {
    const template = templateById(enterprise.templateId);
    const equipment = equipmentScore(enterprise);
    const maxCustomers = Core.clamp(Math.floor(template.baseCapacity + session.capacityBonus + equipment.capacity + (enterprise.path === 'tiny_enterprise' || enterprise.path === 'cooperative' ? 1 : 0)), 1, 10);
    const selected = selectCustomers(world, enterprise, session, maxCustomers);
    selected.forEach((entry) => serveCustomer(world, enterprise, session, entry));
    const baseCost = Math.max(1, selected.length * (template.basePrice * 0.16) + (enterprise.premiseId ? Core.safeNumber(enterprise.lease?.utilityBase, 0) / 7 : 1) - session.sessionSavings);
    const wages = settleSessionWages(world, enterprise, session);
    session.costs = Core.round(baseCost + wages, 2);
    session.revenue = Core.round(session.revenue, 2);
    const net = Core.round(session.revenue - session.costs, 2);
    // Worker wages were reserved from enterprise funds when the session began.
    // Add only revenue minus non-wage operating cost here so wages are not charged twice.
    enterprise.funds = Core.round(enterprise.funds + session.revenue - baseCost, 2);
    enterprise.totals.revenue = Core.round(enterprise.totals.revenue + session.revenue, 2);
    enterprise.totals.costs = Core.round(enterprise.totals.costs + session.costs, 2);
    enterprise.totals.sessions += 1;
    enterprise.totals.hours += session.hours || 3;
    session.status = 'completed';
    session.endedDay = world.time.day;
    session.endedHour = world.time.hour;
    enterprise.currentSessionId = null;
    session.history.push({ day: world.time.day, hour: world.time.hour, type: 'settled', customers: selected.length, revenue: session.revenue, costs: session.costs, net });

    const satisfactionValues = session.customers.map((entry) => entry.satisfaction);
    const avgSatisfaction = satisfactionValues.length ? Core.average(satisfactionValues) : 45;
    enterprise.reputation.care = Core.clamp(Core.round(enterprise.reputation.care * 0.84 + (session.quality + session.agencyBonus * 2) * 0.16, 1), 0, 100);
    enterprise.reputation.reliability = Core.clamp(Core.round(enterprise.reputation.reliability * 0.88 + (equipment.condition || 60) * 0.12, 1), 0, 100);
    enterprise.reputation.fit = Core.clamp(Core.round(enterprise.reputation.fit * 0.84 + avgSatisfaction * 0.16, 1), 0, 100);

    enterprise.equipment.forEach((item) => {
      const wear = 0.6 + selected.length * 0.22 - Core.safeNumber(item.upgrades?.care, 0) * 0.08;
      item.condition = Core.clamp(Core.round(item.condition - Math.max(0.2, wear), 1), 0, 100);
      item.usageSessions = Core.safeNumber(item.usageSessions, 0) + 1;
    });

    const need = needById(world, enterprise.needId);
    if (need) {
      need.servedCount += selected.length;
      need.freeOrFlexibleCount += session.customers.filter((entry) => entry.flexibleOrFree).length;
      need.lastServedDay = world.time.day;
      need.satisfaction = Core.clamp(Core.round(need.satisfaction + selected.length * 1.4 + session.agencyBonus * 0.25, 1), 0, 100);
    }

    world.metrics.enterpriseSessionsCompleted += 1;
    world.metrics.enterpriseCustomersServed += selected.length;
    world.metrics.enterpriseRevenue += session.revenue;
    world.metrics.enterpriseOperatingCosts += session.costs;
    if (enterprise.ownerId !== 'player') world.metrics.npcEnterpriseSessions += 1;
    appendEnterpriseHistory(world, enterprise, 'session_completed', `${enterprise.name} completed a ${session.mode} session with ${selected.length} actual resident customer${selected.length === 1 ? '' : 's'}.`, {
      actorIds: [enterprise.ownerId], customerIds: selected.map((entry) => entry.person.id),
      causes: ['bounded session', 'actual resident demand', 'no spawned customer abstraction'],
      evidence: { sessionId: session.id, revenue: session.revenue, costs: session.costs, net, avgSatisfaction: Core.round(avgSatisfaction, 1) }
    });
    if (!options.silent) Systems.toast(world, `${enterprise.name}: ${selected.length} residents served · ${Core.formatMoney(net)} net.`, net >= 0 ? 'success' : 'info');
    return { ok: true, session, customers: selected.length, net };
  }

  function runCompressedSession(world, enterprise) {
    const template = templateById(enterprise.templateId);
    const session = createSession(world, enterprise, 'compressed', enterprise.ownerId);
    const actor = ownerRecord(world, enterprise.ownerId);
    const selectedActions = [template.actions[0], template.actions[1], template.actions[2] || template.actions[0]];
    selectedActions.forEach((action) => applyEnterpriseTask(world, enterprise, session, action, actor));
    session.quality -= 5; // Interactive influence is useful but not compulsory.
    if (enterprise.ownerId === 'player') Systems.advanceHours(world, 3);
    return settleSession(world, enterprise, session);
  }

  function startEnterpriseSession(world, enterpriseId, mode = 'compressed') {
    const enterprise = enterpriseById(world, enterpriseId);
    if (!enterprise || enterprise.ownerId !== 'player') return { ok: false, reason: 'You can enter only your own enterprise session.' };
    if (!['occasional', 'open'].includes(enterprise.status)) return { ok: false, reason: 'This direction must be occasional or open before serving residents.' };
    if (world.activeShift) return { ok: false, reason: 'Finish the current employed workday first.' };
    if (world.activeEnterpriseSessionId || enterprise.currentSessionId) return { ok: false, reason: 'An enterprise session is already active.' };
    const kit = activateStarterKit(world, enterprise);
    if (!kit.ok) return kit;
    if (mode === 'compressed') return runCompressedSession(world, enterprise);
    const session = createSession(world, enterprise, 'interactive', 'player');
    world.activeEnterpriseSessionId = session.id;
    world.player.locationId = enterprise.premiseId || world.player.homePropertyId;
    appendEnterpriseHistory(world, enterprise, 'session_entered', `You entered a work session at ${enterprise.name}.`, {
      actorIds: ['player'], causes: ['explicit interactive-work choice'], evidence: { sessionId: session.id }
    });
    return { ok: true, session };
  }

  function performEnterpriseTask(world, enterpriseId, actionId) {
    const enterprise = enterpriseById(world, enterpriseId);
    const session = sessionById(world, world.activeEnterpriseSessionId);
    if (!enterprise || !session || session.enterpriseId !== enterprise.id || session.status !== 'active') return { ok: false, reason: 'No matching interactive session is active.' };
    const template = templateById(enterprise.templateId);
    const action = template?.actions.find((entry) => entry.id === actionId);
    if (!action) return { ok: false, reason: 'Unknown enterprise task.' };
    if (session.taskActions.length >= 4) return { ok: false, reason: 'This bounded session already has enough tasks. Finish it rather than turning it into a chore.' };
    applyEnterpriseTask(world, enterprise, session, action, world.player);
    Systems.advanceHours(world, 1);
    if (session.taskActions.length >= 3) return finishEnterpriseSession(world, enterprise.id);
    return { ok: true, session };
  }

  function finishEnterpriseSession(world, enterpriseId) {
    const enterprise = enterpriseById(world, enterpriseId);
    const session = sessionById(world, world.activeEnterpriseSessionId);
    if (!enterprise || !session || session.enterpriseId !== enterprise.id) return { ok: false, reason: 'No matching enterprise session is active.' };
    if (!session.taskActions.length) return { ok: false, reason: 'Live at least one work moment before finishing, or cancel the session.' };
    while (session.hours < 3) {
      session.hours += 1;
      Systems.advanceHours(world, 1);
    }
    world.activeEnterpriseSessionId = null;
    world.player.locationId = world.player.homePropertyId;
    return settleSession(world, enterprise, session);
  }

  function cancelEnterpriseSession(world, enterpriseId) {
    const enterprise = enterpriseById(world, enterpriseId);
    const session = sessionById(world, world.activeEnterpriseSessionId);
    if (!enterprise || !session || session.enterpriseId !== enterprise.id) return { ok: false, reason: 'No matching enterprise session is active.' };
    session.status = 'cancelled';
    session.endedDay = world.time.day;
    session.endedHour = world.time.hour;
    if (session.wageReserve > 0) enterprise.funds = Core.round(enterprise.funds + session.wageReserve, 2);
    session.wageReserve = 0;
    session.workerIds = [];
    session.workerOfferIds = [];
    enterprise.currentSessionId = null;
    world.activeEnterpriseSessionId = null;
    world.player.locationId = world.player.homePropertyId;
    appendEnterpriseHistory(world, enterprise, 'session_cancelled', 'The interactive session ended without inventing customers or revenue.', {
      actorIds: ['player'], causes: ['explicit cancellation'], evidence: { completedTasks: session.taskActions.length }
    });
    return { ok: true };
  }

  function withdrawEnterpriseFunds(world, enterpriseId, amount = null) {
    const enterprise = enterpriseById(world, enterpriseId);
    if (!enterprise || enterprise.ownerId !== 'player') return { ok: false, reason: 'Only your enterprise funds can be withdrawn here.' };
    const requested = amount == null ? Math.max(0, enterprise.funds - enterprise.reserveTarget) : Math.max(0, Core.safeNumber(amount, 0));
    const value = Core.round(Math.min(requested, enterprise.funds), 2);
    if (value <= 0) return { ok: false, reason: 'There are no withdrawable funds beyond the chosen reserve.' };
    enterprise.funds = Core.round(enterprise.funds - value, 2);
    changeOwnerMoney(world, 'player', value);
    appendEnterpriseHistory(world, enterprise, 'owner_withdrawal', `${Core.formatMoney(value)} moved from enterprise funds to the owner’s personal account.`, {
      actorIds: ['player'], causes: ['explicit withdrawal'], evidence: { amount: value, remainingFunds: enterprise.funds }
    });
    return { ok: true, amount: value };
  }

  function equipmentById(enterprise, equipmentId) {
    return enterprise?.equipment?.find((entry) => entry.id === equipmentId) || null;
  }

  function repairEnterpriseEquipment(world, enterpriseId, equipmentId) {
    const enterprise = enterpriseById(world, enterpriseId);
    const equipment = equipmentById(enterprise, equipmentId);
    if (!enterprise || !equipment || enterprise.ownerId !== 'player') return { ok: false, reason: 'Equipment not found or not yours to repair.' };
    const missing = 100 - equipment.condition;
    if (missing < 1) return { ok: false, reason: 'That equipment is already in excellent condition.' };
    const cost = Math.max(3, Math.round(missing * 0.38));
    if (world.player.money < cost) return { ok: false, reason: `Repair needs ${Core.formatMoney(cost)}.` };
    world.player.money -= cost;
    world.player.lifetimeSpend += cost;
    equipment.condition = Core.clamp(Core.round(equipment.condition + Math.min(24, missing), 1), 0, 100);
    enterprise.totals.costs += cost;
    world.metrics.enterpriseEquipmentRepairs += 1;
    appendEquipmentHistory(world, equipment, 'repaired', `${equipment.name} was repaired rather than replaced.`, {
      actorId: 'player', causes: ['explicit equipment care'], evidence: { cost, condition: equipment.condition }
    });
    return { ok: true };
  }

  function upgradeEnterpriseEquipment(world, enterpriseId, equipmentId, axis) {
    const enterprise = enterpriseById(world, enterpriseId);
    const equipment = equipmentById(enterprise, equipmentId);
    if (!enterprise || !equipment || enterprise.ownerId !== 'player') return { ok: false, reason: 'Equipment not found or not yours to upgrade.' };
    if (!EQUIPMENT_AXES.includes(axis)) return { ok: false, reason: 'Unknown equipment improvement.' };
    const level = Core.safeNumber(equipment.upgrades?.[axis], 0);
    if (level >= 5) return { ok: false, reason: 'That improvement is already fully developed.' };
    const cost = Math.round(18 + (level + 1) ** 1.55 * 16);
    if (world.player.money < cost) return { ok: false, reason: `Improvement needs ${Core.formatMoney(cost)}.` };
    world.player.money -= cost;
    world.player.lifetimeSpend += cost;
    equipment.upgrades[axis] = level + 1;
    enterprise.totals.costs += cost;
    world.metrics.enterpriseEquipmentUpgrades += 1;
    appendEquipmentHistory(world, equipment, 'upgraded', `${equipment.name} gained ${axis} level ${level + 1}/5 without losing its identity.`, {
      actorId: 'player', causes: ['explicit investment', 'upgrade without replacement'], evidence: { axis, level: level + 1, cost }
    });
    return { ok: true };
  }

  function weeklyPremiseCosts(world, enterprise) {
    if (!enterprise.premiseId || !enterprise.lease || enterprise.status === 'closed') return;
    const due = Core.safeNumber(enterprise.lease.weeklyLease, 0) + Core.safeNumber(enterprise.lease.utilityBase, 0);
    if (enterprise.funds >= due) {
      enterprise.funds = Core.round(enterprise.funds - due, 2);
      enterprise.totals.costs += due;
      enterprise.lease.arrears = 0;
      appendEnterpriseHistory(world, enterprise, 'premise_cost_paid', `${enterprise.name} paid its attributable weekly room and utility cost.`, {
        actorIds: [enterprise.ownerId], causes: ['real occupied premise'], evidence: { due }
      });
      return;
    }
    const owner = ownerRecord(world, enterprise.ownerId);
    const gap = Core.round(due - enterprise.funds, 2);
    if (owner && owner.money >= gap) {
      const fromFunds = enterprise.funds;
      enterprise.funds = 0;
      changeOwnerMoney(world, enterprise.ownerId, -gap);
      enterprise.totals.costs += due;
      enterprise.lease.arrears = 0;
      appendEnterpriseHistory(world, enterprise, 'premise_cost_supported', `${World.personName(world, enterprise.ownerId)} covered the room-cost gap explicitly.`, {
        actorIds: [enterprise.ownerId], causes: ['enterprise funds below weekly cost'], evidence: { due, fromFunds, ownerContribution: gap }
      });
      return;
    }
    enterprise.lease.arrears = Core.safeNumber(enterprise.lease.arrears, 0) + due;
    enterprise.status = 'paused';
    appendEnterpriseHistory(world, enterprise, 'premise_cost_unpaid', `${enterprise.name} paused because the real room cost was not available. Closure was not assumed.`, {
      actorIds: [enterprise.ownerId], causes: ['insufficient enterprise and owner funds'], evidence: { due, arrears: enterprise.lease.arrears }
    });
    if (enterprise.lease.arrears >= due * 2) {
      releasePremise(world, enterprise, 'two unpaid room-cost cycles; enterprise preserved as occasional direction');
      enterprise.status = 'paused';
      appendEnterpriseHistory(world, enterprise, 'premise_released_after_arrears', `${enterprise.name} returned to a paused occasional direction instead of being erased.`, {
        actorIds: [enterprise.ownerId], causes: ['bounded arrears rule', 'history preservation']
      });
    }
  }

  function runNpcEnterpriseSession(world, enterprise) {
    if (!['occasional', 'open'].includes(enterprise.status)) return null;
    const owner = ownerRecord(world, enterprise.ownerId);
    if (!owner || AXM.Family?.isDependent(owner)) return null;
    const template = templateById(enterprise.templateId);
    const session = createSession(world, enterprise, 'autonomous', owner.id);
    const actionCount = 2 + (economyChance(world, 0.55) ? 1 : 0);
    for (let i = 0; i < actionCount; i += 1) {
      const action = economyWeightedChoice(world, template.actions, (entry) => 10 + (entry.quality || 0) + (owner.skills?.[Object.keys(entry.skill || {})[0]] || 0) * 0.12);
      applyEnterpriseTask(world, enterprise, session, action, owner);
    }
    session.hours = Math.max(2, actionCount);
    return settleSession(world, enterprise, session, { silent: true });
  }

  function maybeCreateNpcEnterprise(world, person) {
    if (AXM.Family?.isDependent(person)) return;
    if (enterprisesFor(world, person.id).some((entry) => entry.status !== 'closed')) return;
    if (world.time.day < Core.safeNumber(person.enterpriseCooldownUntil, 0)) return;
    const projects = Directions?.projectsFor(world, person.id) || [];
    const completed = projects.filter((entry) => entry.status === 'completed');
    const goal = String(person.personalGoal || '').toLowerCase();
    const goalPull = /craft|meaningful work|restore|neighborhood|changing directions|save for freedom/.test(goal) ? 16 : 0;
    const obligationResistance = /fewer obligations|calm home|family/.test(goal) ? 18 : 0;
    const inclination = Core.clamp(
      Core.safeNumber(person.traits?.independence, 50) * 0.34
      + Core.safeNumber(person.traits?.creativity, 50) * 0.24
      + Core.safeNumber(person.traits?.ambition, 50) * 0.22
      + Core.safeNumber(person.traits?.social, 50) * 0.08
      + goalPull - obligationResistance,
      0, 100
    );
    // A completed personal direction is evidence of capability, not an automatic
    // instruction to monetize it. Most residents should remain non-owners unless
    // their own traits, goal, timing, and a small deterministic chance align.
    if (inclination < 46) return;
    const emergenceChance = completed.length
      ? 0.00075 + Math.max(0, inclination - 46) * 0.000022
      : 0.00012 + Math.max(0, inclination - 58) * 0.000008;
    if (!economyChance(world, emergenceChance)) return;
    const mappings = {
      restoration: 'repair_table', making: 'repair_table', creative: 'creative_studio', collection: 'reuse_nook',
      garden: 'neighborhood_desk', research: 'learning_table', local_journey: 'neighborhood_desk', learning: 'learning_table'
    };
    const source = completed.length ? economyChoice(world, completed) : null;
    const templateId = source ? mappings[source.templateId] : economyChoice(world, ENTERPRISE_TEMPLATES).id;
    const path = person.money > 500 && inclination >= 58 ? 'occasional_service' : 'private_hobby';
    const result = createEnterprise(world, {
      templateId, path, sourceProjectId: source?.id || null,
      name: `${person.name.split(' ')[0]}'s ${templateById(templateId).name}`,
      purpose: source?.meaning || `A small direction connected to ${person.personalGoal}.`
    }, person.id);
    person.enterpriseCooldownUntil = world.time.day + 60;
    if (result.ok && path === 'occasional_service') {
      const first = economyRandomInt(world, 1, 7);
      const second = first === 7 ? 2 : first + 2;
      result.enterprise.schedule.openDays = [first, second];
    }
  }

  function seedNpcEnterprise(world, personId, templateId, premiseId = null) {
    const person = World.getPerson(world, personId);
    if (!person) return null;
    const template = templateById(templateId);
    const minimum = template.starterCost + (premiseId ? Core.safeNumber(premiseById(world, premiseId)?.deposit, 0) + Core.safeNumber(premiseById(world, premiseId)?.weeklyLease, 0) : 0) + 40;
    person.money = Math.max(person.money, minimum);
    const result = createEnterprise(world, {
      templateId, path: premiseId ? 'tiny_enterprise' : 'occasional_service', premiseId,
      name: `${person.name.split(' ')[0]}'s ${template.name}`,
      purpose: `A small existing direction in the starting town, connected to ${person.personalGoal}.`
    }, person.id);
    return result.ok ? result.enterprise : null;
  }

  function initializeWorld(world, options = {}) {
    ensureState(world);
    addCommercialPremises(world, options);
    refreshLocalNeeds(world, { log: false });
    if (options.newWorld && !world.flags.enterpriseSeeded) {
      // Seeded enterprise content must not perturb the shared simulation RNG stream.
      // This preserves deterministic behavior in inherited life, household, family,
      // housing, and community systems while the enterprise layer remains reproducible.
      const priorRngState = world.rngState;
      const adults = (world.people || []).filter((person) => !AXM.Family?.isDependent(person));
      if (adults[3]) seedNpcEnterprise(world, adults[3].id, 'reuse_nook', 'place_square_kiosk');
      if (adults[10]) seedNpcEnterprise(world, adults[10].id, 'learning_table', null);
      world.flags.enterpriseSeeded = true;
      world.rngState = priorRngState;
    }
    if (!options.silent && !world.flags.enterpriseFoundationLogged) {
      Core.appendLedger(world, 'enterprise', 'The living local economy was initialized as an optional layer. Private practice, occasional service, a tiny room, cooperation, pause, pivot, and closure remain different valid directions rather than a profit ladder.', {
        causes: ['v0.8 enterprise foundation', 'casual realism', 'no age gate', 'actual resident customers'],
        evidence: { premises: commercialPremises(world).length, localNeeds: world.localNeeds.length, enterprises: world.enterprises.length }
      });
      world.flags.enterpriseFoundationLogged = true;
    }
    return world;
  }

  function ensureState(world) {
    if (!Number.isInteger(world.economyIdCounter) || world.economyIdCounter < 0) world.economyIdCounter = 0;
    if (!Number.isInteger(world.economyRngState) || world.economyRngState < 0) world.economyRngState = Core.hashString(`${world.seed}:living-local-economy`) || 1;
    if (!Array.isArray(world.localNeeds)) world.localNeeds = [];
    if (!Array.isArray(world.enterprises)) world.enterprises = [];
    if (!Array.isArray(world.enterpriseSessions)) world.enterpriseSessions = [];
    if (!Array.isArray(world.enterpriseWorkOffers)) world.enterpriseWorkOffers = [];
    if (world.activeEnterpriseSessionId === undefined) world.activeEnterpriseSessionId = null;
    if (!world.ui || typeof world.ui !== 'object') world.ui = {};
    if (world.ui.selectedEnterpriseId === undefined) world.ui.selectedEnterpriseId = null;
    if (world.ui.selectedCommercialPremiseId === undefined) world.ui.selectedCommercialPremiseId = null;
    if (!world.flags || typeof world.flags !== 'object') world.flags = {};
    if (world.flags.enterpriseExperimentPrepared === undefined) world.flags.enterpriseExperimentPrepared = false;
    if (world.flags.enterpriseFoundationLogged === undefined) world.flags.enterpriseFoundationLogged = false;
    if (world.flags.enterpriseSeeded === undefined) world.flags.enterpriseSeeded = false;
    [
      'enterprisesCreated', 'npcEnterprisesCreated', 'enterprisePremisesLeased', 'enterprisesPaused', 'enterprisesClosed',
      'enterprisesPivoted', 'enterpriseSessionsCompleted', 'npcEnterpriseSessions', 'enterpriseCustomersServed',
      'enterpriseRevenue', 'enterpriseOperatingCosts', 'enterpriseFlexibleServices', 'enterpriseEquipmentRepairs',
      'enterpriseEquipmentUpgrades', 'enterpriseExperimentRuns', 'enterpriseWorkOffersSent', 'enterpriseWorkOffersAccepted',
      'enterpriseWorkOffersDeclined', 'enterpriseWagesPaid'
    ].forEach((key) => ensureMetric(world, key));
    [world.player].concat(world.people || []).forEach((person) => {
      if (!person) return;
      if (!Array.isArray(person.enterpriseIds)) person.enterpriseIds = [];
      if (!Number.isFinite(person.enterpriseCooldownUntil)) person.enterpriseCooldownUntil = 0;
    });
    world.enterprises.forEach((enterprise) => {
      if (!Array.isArray(enterprise.workerIds)) enterprise.workerIds = [];
      if (!Array.isArray(enterprise.workOfferIds)) enterprise.workOfferIds = [];
      if (!Array.isArray(enterprise.equipment)) enterprise.equipment = [];
      enterprise.equipment.forEach((item) => {
        if (!Number.isFinite(item.usageSessions)) item.usageSessions = 0;
        if (!item.upgrades || typeof item.upgrades !== 'object') item.upgrades = {};
        EQUIPMENT_AXES.forEach((axis) => {
          if (!Number.isFinite(item.upgrades[axis])) item.upgrades[axis] = 0;
        });
      });
      if (!enterprise.totals || typeof enterprise.totals !== 'object') enterprise.totals = {};
      if (!Number.isFinite(enterprise.totals.wages)) enterprise.totals.wages = 0;
    });
    return world;
  }

  function dailyTick(world, options = {}) {
    ensureState(world);
    resolveEnterpriseWorkOffers(world);
    if (world.time.day % 7 === 1) refreshLocalNeeds(world, { log: true });
    world.enterprises.forEach((enterprise) => {
      if (enterprise.status === 'paused') enterprise.totals.pausedDays += 1;
      if (world.time.day % 7 === 1) weeklyPremiseCosts(world, enterprise);
    });
    if (!options.freezePlayer) {
      world.people.forEach((person) => maybeCreateNpcEnterprise(world, person));
      world.enterprises.filter((entry) => entry.ownerId !== 'player' && ['occasional', 'open'].includes(entry.status)).forEach((enterprise) => {
        const openToday = enterprise.schedule?.openDays?.includes(Core.weekdayIndex(world.time.day) + 1);
        if (openToday && economyChance(world, enterprise.path === 'tiny_enterprise' ? 0.72 : 0.46)) runNpcEnterpriseSession(world, enterprise);
      });
    }
  }

  function hourlyTick(world) {
    const active = sessionById(world, world.activeEnterpriseSessionId);
    if (world.activeEnterpriseSessionId && (!active || active.status !== 'active')) world.activeEnterpriseSessionId = null;
  }

  function prepareEnterpriseExperiment(world) {
    ensureState(world);
    if (world.flags.enterpriseExperimentPrepared) return { ok: false, reason: 'The labeled enterprise experiment was already prepared.' };
    world.player.money += 650;
    Core.appendLedger(world, 'research', 'A labeled €650 enterprise experiment grant was added. It is not normal progression.', {
      actorIds: ['player'], causes: ['explicit QA shortcut'], evidence: { amount: 650 }
    });
    const project = (Directions?.projectsFor(world, 'player') || []).find((entry) => ['active', 'completed', 'paused'].includes(entry.status)) || null;
    const result = createEnterprise(world, {
      templateId: 'repair_table', path: 'occasional_service', sourceProjectId: project?.id || null,
      name: 'Keep-It-Going Table', purpose: 'A bounded repair service proving that one real project can become occasional work without becoming a required business identity.'
    });
    if (!result.ok) return result;
    const premise = commercialPremises(world).find((entry) => entry.listedForLease);
    if (premise) changeEnterprisePath(world, result.enterprise.id, 'tiny_enterprise', premise.id);
    const sessionResult = startEnterpriseSession(world, result.enterprise.id, 'compressed');
    world.flags.enterpriseExperimentPrepared = true;
    world.metrics.enterpriseExperimentRuns += 1;
    const experimentCustomerIds = sessionResult.session?.customers?.map((entry) => entry.personId) || [];
    appendEnterpriseHistory(world, result.enterprise, 'experiment_prepared', experimentCustomerIds.length
      ? 'A labeled local-economy experiment used real funds, a real room, actual resident customers, equipment wear, and the ordinary session engine.'
      : 'A labeled local-economy experiment used real funds, a real room, equipment wear, and the ordinary resident-customer selection engine. This session honestly found no customer instead of fabricating demand.', {
      actorIds: ['player'], customerIds: experimentCustomerIds,
      causes: ['explicit QA shortcut', 'not normal progression', experimentCustomerIds.length ? 'actual resident participation' : 'zero demand retained honestly'], evidence: { projectId: project?.id || null, premiseId: result.enterprise.premiseId, sessionId: sessionResult.session?.id || null, customerCount: experimentCustomerIds.length }
    });
    Systems.toast(world, 'Local-enterprise experiment prepared and one bounded session completed.', 'warning');
    return { ok: true, enterpriseId: result.enterprise.id, sessionId: sessionResult.session?.id || null };
  }

  function metrics(world) {
    ensureState(world);
    const player = enterprisesFor(world, 'player');
    const npc = world.enterprises.filter((entry) => entry.ownerId !== 'player');
    const openNeeds = world.localNeeds.filter((entry) => entry.score >= 35);
    const occupiedPremises = commercialPremises(world).filter((entry) => entry.occupantEnterpriseId);
    return {
      playerDirections: player.filter((entry) => entry.status !== 'closed').length,
      playerPrivate: player.filter((entry) => entry.status === 'private').length,
      playerOccasional: player.filter((entry) => entry.status === 'occasional').length,
      playerOpen: player.filter((entry) => entry.status === 'open').length,
      playerPaused: player.filter((entry) => entry.status === 'paused').length,
      playerClosed: player.filter((entry) => entry.status === 'closed').length,
      playerFunds: Core.round(player.reduce((sum, entry) => sum + Core.safeNumber(entry.funds, 0), 0), 2),
      npcDirections: npc.filter((entry) => entry.status !== 'closed').length,
      localNeeds: world.localNeeds.length,
      openNeeds: openNeeds.length,
      highestNeedScore: openNeeds.length ? Math.max(...openNeeds.map((entry) => entry.score)) : 0,
      premises: commercialPremises(world).length,
      occupiedPremises: occupiedPremises.length,
      vacantPremises: commercialPremises(world).length - occupiedPremises.length,
      activeSession: Boolean(world.activeEnterpriseSessionId),
      customersServed: world.metrics.enterpriseCustomersServed || 0,
      revenue: Core.round(world.metrics.enterpriseRevenue || 0, 2),
      flexibleServices: world.metrics.enterpriseFlexibleServices || 0,
      pendingWorkOffers: world.enterpriseWorkOffers.filter((offer) => offer.status === 'pending_npc' && enterpriseById(world, offer.enterpriseId)?.ownerId === 'player').length,
      activeWorkers: world.enterprises.reduce((sum, enterprise) => sum + (enterprise.workerIds?.length || 0), 0),
      wagesPaid: Core.round(world.metrics.enterpriseWagesPaid || 0, 2)
    };
  }

  function validate(world, add) {
    if (!Array.isArray(world.localNeeds)) add('localNeeds must be an array.');
    if (!Array.isArray(world.enterprises)) add('enterprises must be an array.');
    if (!Array.isArray(world.enterpriseSessions)) add('enterpriseSessions must be an array.');
    if (!Array.isArray(world.enterpriseWorkOffers)) add('enterpriseWorkOffers must be an array.');
    if (!Array.isArray(world.localNeeds) || !Array.isArray(world.enterprises) || !Array.isArray(world.enterpriseSessions) || !Array.isArray(world.enterpriseWorkOffers)) return;
    const people = new Set(['player'].concat((world.people || []).map((entry) => entry.id)));
    const placeIds = new Set((world.places || []).map((entry) => entry.id));
    const enterpriseIds = new Set();
    const equipmentIds = new Set();
    const sessionIds = new Set();

    commercialPremises(world).forEach((premise) => {
      if (premise.schema !== PREMISE_SCHEMA) add(`${premise.id} has invalid commercial premise schema.`);
      if (!Number.isFinite(premise.weeklyLease) || premise.weeklyLease < 0 || !Number.isFinite(premise.deposit) || premise.deposit < 0) add(`${premise.id} has invalid lease values.`);
      if (premise.occupantEnterpriseId && !world.enterprises.some((entry) => entry.id === premise.occupantEnterpriseId && entry.premiseId === premise.id)) add(`${premise.id} occupancy pointer is inconsistent.`);
      if (Boolean(premise.occupantEnterpriseId) === Boolean(premise.listedForLease)) add(`${premise.id} lease listing and occupancy must be opposite.`);
    });

    world.localNeeds.forEach((need) => {
      if (need.schema !== NEED_SCHEMA) add(`${need.id} has invalid local need schema.`);
      if (!needTemplateById(need.templateId)) add(`${need.id} has unknown local need template.`);
      if (!Number.isFinite(need.score) || need.score < 0 || need.score > 100) add(`${need.id} has invalid score.`);
      if (!Number.isFinite(need.satisfaction) || need.satisfaction < 0 || need.satisfaction > 100) add(`${need.id} has invalid satisfaction.`);
      if (!Array.isArray(need.enterpriseTemplates)) add(`${need.id} enterpriseTemplates must be an array.`);
    });

    world.enterprises.forEach((enterprise) => {
      if (!enterprise.id || enterpriseIds.has(enterprise.id)) add(`Duplicate or missing enterprise id ${String(enterprise.id)}.`);
      enterpriseIds.add(enterprise.id);
      if (enterprise.schema !== ENTERPRISE_SCHEMA) add(`${enterprise.id} has invalid enterprise schema.`);
      if (!people.has(enterprise.ownerId)) add(`${enterprise.id} has unknown owner.`);
      if (!templateById(enterprise.templateId)) add(`${enterprise.id} has unknown template.`);
      if (!ENTERPRISE_PATHS.includes(enterprise.path)) add(`${enterprise.id} has invalid path.`);
      if (!ENTERPRISE_STATUSES.includes(enterprise.status)) add(`${enterprise.id} has invalid status.`);
      if (!PRICING_MODES.includes(enterprise.pricing?.mode)) add(`${enterprise.id} has invalid pricing mode.`);
      if (enterprise.optional !== true || enterprise.noAgeGate !== true || enterprise.ageGate !== null || enterprise.noGrowthRequirement !== true || enterprise.noFailureLabel !== true) add(`${enterprise.id} violates choice-first enterprise roots.`);
      if (enterprise.sourceProjectId) {
        const source = Directions?.projectById(world, enterprise.sourceProjectId);
        if (!source || source.ownerId !== enterprise.ownerId) add(`${enterprise.id} has invalid source project provenance.`);
      }
      if (enterprise.needId && !needById(world, enterprise.needId)) add(`${enterprise.id} references an unknown local need.`);
      if (enterprise.premiseId) {
        const premise = premiseById(world, enterprise.premiseId);
        if (!premise || premise.occupantEnterpriseId !== enterprise.id) add(`${enterprise.id} premise authority is inconsistent.`);
        if (!['tiny_enterprise', 'cooperative'].includes(enterprise.path)) add(`${enterprise.id} occupies a premise outside a premise-based path.`);
      }
      if (!Array.isArray(enterprise.equipment) || !Array.isArray(enterprise.sessionIds) || !Array.isArray(enterprise.customerHistory) || !Array.isArray(enterprise.history)) add(`${enterprise.id} has malformed evidence containers.`);
      if (!Array.isArray(enterprise.workerIds) || enterprise.workerIds.some((id) => !people.has(id) || id === enterprise.ownerId || AXM.Family?.isFinancialDependent?.(world, id))) add(`${enterprise.id} has invalid worker authority.`);
      if (new Set(enterprise.workerIds || []).size !== (enterprise.workerIds || []).length) add(`${enterprise.id} has duplicate workers.`);
      if (!Array.isArray(enterprise.workOfferIds)) add(`${enterprise.id} workOfferIds must be an array.`);
      (enterprise.equipment || []).forEach((equipment) => {
        if (!equipment.id || equipmentIds.has(equipment.id)) add(`Duplicate or missing equipment id ${String(equipment.id)}.`);
        equipmentIds.add(equipment.id);
        if (equipment.schema !== EQUIPMENT_SCHEMA || equipment.enterpriseId !== enterprise.id || equipment.ownerId !== enterprise.ownerId) add(`${equipment.id} has inconsistent equipment authority.`);
        if (!Number.isFinite(equipment.condition) || equipment.condition < 0 || equipment.condition > 100) add(`${equipment.id} has invalid condition.`);
        EQUIPMENT_AXES.forEach((axis) => {
          const level = equipment.upgrades?.[axis];
          if (!Number.isInteger(level) || level < 0 || level > 5) add(`${equipment.id} has invalid ${axis} level.`);
        });
      });
      (enterprise.sessionIds || []).forEach((id) => {
        const session = world.enterpriseSessions.find((entry) => entry.id === id);
        if (!session || session.enterpriseId !== enterprise.id) add(`${enterprise.id} points to invalid session ${id}.`);
      });
      if (enterprise.currentSessionId) {
        const session = sessionById(world, enterprise.currentSessionId);
        if (!session || session.status !== 'active') add(`${enterprise.id} current session pointer is invalid.`);
      }
    });

    world.enterpriseSessions.forEach((session) => {
      if (!session.id || sessionIds.has(session.id)) add(`Duplicate or missing enterprise session id ${String(session.id)}.`);
      sessionIds.add(session.id);
      if (session.schema !== SESSION_SCHEMA) add(`${session.id} has invalid enterprise session schema.`);
      const enterprise = enterpriseById(world, session.enterpriseId);
      if (!enterprise || !enterprise.sessionIds.includes(session.id)) add(`${session.id} has invalid enterprise link.`);
      if (!SESSION_STATUSES.includes(session.status)) add(`${session.id} has invalid status.`);
      if (!Array.isArray(session.taskActions) || !Array.isArray(session.customers) || !Array.isArray(session.history)) add(`${session.id} has malformed session evidence.`);
      (session.customers || []).forEach((customer) => {
        if (!people.has(customer.personId) || customer.personId === session.ownerId) add(`${session.id} contains invalid actual resident customer.`);
        if (!Number.isFinite(customer.price) || customer.price < 0) add(`${session.id} contains invalid customer price.`);
      });
    });

    [world.player].concat(world.people || []).forEach((person) => {
      // People can be created by the family engine between economy ticks. An
      // absent pointer list means no enterprise links yet; a malformed present
      // list remains a validation error and is never silently rewritten here.
      if (person.enterpriseIds !== undefined && !Array.isArray(person.enterpriseIds)) add(`${person.id} enterpriseIds must be an array when present.`);
      (Array.isArray(person.enterpriseIds) ? person.enterpriseIds : []).forEach((id) => {
        const enterprise = enterpriseById(world, id);
        if (!enterprise || enterprise.ownerId !== person.id) add(`${person.id} points to invalid enterprise ${id}.`);
      });
    });

    const workOfferIds = new Set();
    world.enterpriseWorkOffers.forEach((offer) => {
      if (!offer.id || workOfferIds.has(offer.id)) add(`Duplicate or missing enterprise work-offer id ${String(offer.id)}.`);
      workOfferIds.add(offer.id);
      if (offer.schema !== WORK_OFFER_SCHEMA) add(`${offer.id} has invalid enterprise work-offer schema.`);
      const enterprise = enterpriseById(world, offer.enterpriseId);
      if (!enterprise || !people.has(offer.personId) || !people.has(offer.offeredById)) add(`${offer.id} references unknown enterprise or people.`);
      if (!WORK_OFFER_STATUSES.includes(offer.status)) add(`${offer.id} has invalid work-offer status.`);
      if (!offer.authority || offer.authority.enterpriseWork !== true || Object.entries(offer.authority).some(([key, value]) => key !== 'enterpriseWork' && value !== false)) add(`${offer.id} grants authority beyond bounded enterprise work.`);
      if (!Number.isFinite(offer.wagePerSession) || offer.wagePerSession < 0 || !Number.isInteger(offer.sessionsPerWeek) || offer.sessionsPerWeek < 1 || offer.sessionsPerWeek > 3) add(`${offer.id} has invalid wage or bounded commitment.`);
      if (offer.status === 'accepted' && !enterprise?.workerIds.includes(offer.personId)) add(`${offer.id} is accepted but the enterprise worker link is missing.`);
    });

    if (world.activeEnterpriseSessionId) {
      const active = sessionById(world, world.activeEnterpriseSessionId);
      if (!active || active.status !== 'active' || active.ownerId !== 'player') add('activeEnterpriseSessionId must point to an active player session.');
      if (world.activeShift) add('An employed shift and enterprise session cannot both be active.');
    }
    if (world.settings?.agePressure !== false) add('Enterprise layer requires agePressure=false.');
  }

  Object.assign(Systems, {
    createEnterprise,
    changeEnterprisePath,
    leasePremise: (world, enterpriseId, premiseId) => leasePremise(world, enterpriseId, premiseId),
    pauseEnterprise,
    resumeEnterprise,
    closeEnterprise,
    pivotEnterprise,
    setEnterprisePricing,
    inviteEnterpriseWorker,
    withdrawEnterpriseWorkOffer,
    endEnterpriseWorker,
    startEnterpriseSession,
    performEnterpriseTask,
    finishEnterpriseSession,
    cancelEnterpriseSession,
    withdrawEnterpriseFunds,
    repairEnterpriseEquipment,
    upgradeEnterpriseEquipment,
    prepareEnterpriseExperiment
  });

  AXM.Economy = {
    NEED_SCHEMA,
    PREMISE_SCHEMA,
    ENTERPRISE_SCHEMA,
    EQUIPMENT_SCHEMA,
    SESSION_SCHEMA,
    WORK_OFFER_SCHEMA,
    ENTERPRISE_PATHS,
    ENTERPRISE_STATUSES,
    PRICING_MODES,
    SESSION_STATUSES,
    WORK_OFFER_STATUSES,
    EQUIPMENT_AXES,
    ensureEconomyRng,
    nextEconomyRandom,
    COMMERCIAL_PREMISES,
    LOCAL_NEED_TEMPLATES,
    ENTERPRISE_TEMPLATES,
    templateById,
    needTemplateById,
    ensureState,
    initializeWorld,
    commercialPremises,
    premiseById,
    enterpriseById,
    sessionById,
    workOfferById,
    enterprisesFor,
    needById,
    refreshLocalNeeds,
    createEnterprise,
    changeEnterprisePath,
    leasePremise,
    releasePremise,
    pauseEnterprise,
    resumeEnterprise,
    closeEnterprise,
    pivotEnterprise,
    setEnterprisePricing,
    eligibleEnterpriseWorker,
    inviteEnterpriseWorker,
    withdrawEnterpriseWorkOffer,
    endEnterpriseWorker,
    resolveEnterpriseWorkOffers,
    startEnterpriseSession,
    performEnterpriseTask,
    finishEnterpriseSession,
    cancelEnterpriseSession,
    withdrawEnterpriseFunds,
    repairEnterpriseEquipment,
    upgradeEnterpriseEquipment,
    runNpcEnterpriseSession,
    prepareEnterpriseExperiment,
    dailyTick,
    hourlyTick,
    metrics,
    validate,
    equipmentScore
  };
}(typeof window !== 'undefined' ? window : globalThis));
