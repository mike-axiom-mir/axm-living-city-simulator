(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Systems = AXM.Systems;
  const Habitats = AXM.Habitats;

  const INTENTION_SCHEMA = 'axm.habitat-intention/v0.4.0';
  const REQUEST_SCHEMA = 'axm.stewardship-request/v0.4.0';
  const PROPERTY_SCHEMA = 'axm.property-stewardship/v0.4.0';
  const INTENTION_STATUSES = ['saving', 'awaiting_permission', 'approved_saving', 'ready', 'working', 'completed', 'declined', 'withdrawn', 'failed'];
  const REQUEST_STATUSES = ['pending_player', 'pending_external', 'approved', 'declined', 'withdrawn', 'completed', 'expired'];
  const TERMINAL_INTENTION = new Set(['completed', 'declined', 'withdrawn', 'failed']);
  const TERMINAL_REQUEST = new Set(['declined', 'withdrawn', 'completed', 'expired']);

  const METRIC_DEFAULTS = {
    habitatIntentionsFormed: 0,
    habitatIntentionsCompleted: 0,
    habitatIntentionsDeclined: 0,
    habitatIntentionsWithdrawn: 0,
    habitatIntentionsFailed: 0,
    stewardshipRequestsSubmitted: 0,
    stewardshipRequestsApproved: 0,
    stewardshipRequestsDeclined: 0,
    stewardshipPlayerApprovals: 0,
    stewardshipPlayerDeclines: 0,
    stewardshipExternalApprovals: 0,
    stewardshipExternalDeclines: 0,
    stewardshipCotenantApprovals: 0,
    stewardshipCotenantDeclines: 0,
    stewardshipResidentSavings: 0,
    stewardshipOwnerContributions: 0,
    stewardshipMaterialsPurchased: 0,
    stewardshipProjectPhases: 0,
    stewardshipProjectsCompleted: 0,
    stewardshipEscrowRefunded: 0,
    stewardshipMaterialResaleLoss: 0
  };

  const FINISH_BY_COLOR = {
    moss: 'moss_wash',
    clay: 'warm_clay',
    night: 'night_blue',
    mustard: 'warm_clay',
    plum: 'plum_lime',
    cream: 'soft_white',
    charcoal: 'painted_concrete',
    sea: 'small_tile',
    brick: 'warm_clay',
    lilac: 'plum_lime',
    copper: 'reclaimed_wood',
    white: 'soft_white'
  };

  function stableUnit(world, key) {
    return (Core.hashString(`${world.seed}|stewardship|${key}`) >>> 0) / 4294967295;
  }

  function stableRange(world, key, min, max) {
    return min + stableUnit(world, key) * (max - min);
  }

  function emptyMaterials() {
    return Object.fromEntries(Object.keys(Content.MATERIALS).map((key) => [key, 0]));
  }

  function policyTemplate(property) {
    if (property.ownerId === 'player') {
      return {
        id: 'player_steward',
        name: 'Human owner decision',
        ownerMode: 'player_decides',
        responseDelayDays: 0,
        generosity: 50,
        alterationTolerance: 62,
        repairPriority: 78
      };
    }
    if (property.ownerId === 'canal_student_coop') {
      return {
        id: 'cooperative_caretaker',
        name: 'Cooperative caretaker policy',
        ownerMode: 'external_policy',
        responseDelayDays: 1,
        generosity: 66,
        alterationTolerance: 58,
        repairPriority: 86
      };
    }
    return {
      id: 'town_housing_network',
      name: 'Town Housing Network policy',
      ownerMode: 'external_policy',
      responseDelayDays: 2,
      generosity: 46,
      alterationTolerance: 51,
      repairPriority: 72
    };
  }

  function ensurePropertyPolicy(property) {
    const template = policyTemplate(property);
    if (!property.stewardship || typeof property.stewardship !== 'object') {
      property.stewardship = {
        schema: PROPERTY_SCHEMA,
        policy: template,
        requestIds: [],
        completedIntentionIds: [],
        history: []
      };
    }
    property.stewardship.schema = PROPERTY_SCHEMA;
    property.stewardship.policy = { ...template, ...(property.stewardship.policy || {}) };
    if (property.ownerId === 'player') {
      property.stewardship.policy.id = template.id;
      property.stewardship.policy.name = template.name;
      property.stewardship.policy.ownerMode = template.ownerMode;
      property.stewardship.policy.responseDelayDays = template.responseDelayDays;
    } else {
      property.stewardship.policy.ownerMode = 'external_policy';
      if (property.stewardship.policy.id === 'player_steward') {
        property.stewardship.policy = { ...template };
      }
    }
    if (!Array.isArray(property.stewardship.requestIds)) property.stewardship.requestIds = [];
    if (!Array.isArray(property.stewardship.completedIntentionIds)) property.stewardship.completedIntentionIds = [];
    if (!Array.isArray(property.stewardship.history)) property.stewardship.history = [];
    return property.stewardship;
  }

  function ensureState(world) {
    if (!Array.isArray(world.habitatIntentions)) world.habitatIntentions = [];
    if (!Array.isArray(world.stewardshipRequests)) world.stewardshipRequests = [];
    if (!world.metrics || typeof world.metrics !== 'object') world.metrics = {};
    Object.entries(METRIC_DEFAULTS).forEach(([key, value]) => {
      if (!Number.isFinite(world.metrics[key])) world.metrics[key] = value;
    });
    if (!world.ui || typeof world.ui !== 'object') world.ui = {};
    if (world.ui.selectedHabitatIntentionId === undefined) world.ui.selectedHabitatIntentionId = null;
    if (world.ui.selectedStewardshipRequestId === undefined) world.ui.selectedStewardshipRequestId = null;
    if (!world.flags || typeof world.flags !== 'object') world.flags = {};
    if (world.flags.stewardshipExperimentPrepared === undefined) world.flags.stewardshipExperimentPrepared = false;
    if (world.flags.autonomousStewardshipAnnounced === undefined) world.flags.autonomousStewardshipAnnounced = false;

    (world.people || []).forEach((npc) => {
      if (!Number.isFinite(npc.habitatIntentionCooldownUntil)) {
        npc.habitatIntentionCooldownUntil = 3 + (Core.hashString(`${world.seed}|${npc.id}|first-habitat-intention`) % 19);
      }
      if (!Number.isFinite(npc.stewardshipReliability)) {
        npc.stewardshipReliability = Core.clamp(40 + npc.traits.stability * 0.35 + npc.traits.neatness * 0.2 - Math.min(25, npc.rentArrears || 0), 0, 100);
      }
    });
    (world.places || []).filter((place) => place.kind === 'residential').forEach(ensurePropertyPolicy);

    world.habitatIntentions.forEach((intention) => {
      intention.schema = INTENTION_SCHEMA;
      if (!INTENTION_STATUSES.includes(intention.status)) intention.status = 'failed';
      if (!Array.isArray(intention.history)) intention.history = [];
      if (!intention.funding || typeof intention.funding !== 'object') intention.funding = {};
      if (!intention.funding.escrow || typeof intention.funding.escrow !== 'object') intention.funding.escrow = { money: 0, materials: emptyMaterials() };
      intention.funding.escrow.money = Math.max(0, Core.safeNumber(intention.funding.escrow.money, 0));
      intention.funding.escrow.materials = { ...emptyMaterials(), ...(intention.funding.escrow.materials || {}) };
      if (!intention.funding.contributionTotals) intention.funding.contributionTotals = { resident: 0, propertyReserve: 0 };
      if (!Array.isArray(intention.funding.history)) intention.funding.history = [];
      if (!Number.isFinite(intention.funding.lastMilestone)) intention.funding.lastMilestone = 0;
      if (typeof intention.funding.materialsPurchased !== 'boolean') intention.funding.materialsPurchased = false;
    });
    world.stewardshipRequests.forEach((request) => {
      request.schema = REQUEST_SCHEMA;
      if (!REQUEST_STATUSES.includes(request.status)) request.status = 'declined';
      if (!Array.isArray(request.history)) request.history = [];
      if (!request.authorities || typeof request.authorities !== 'object') request.authorities = {};
      if (!Array.isArray(request.authorities.coTenants)) request.authorities.coTenants = [];
    });
    return world;
  }

  function initializeWorld(world, options = {}) {
    ensureState(world);
    if (!options.silent && !world.flags.autonomousStewardshipAnnounced) {
      Core.appendLedger(world, 'stewardship', 'Residents can now form habitat intentions, save visible resources, request co-tenant and owner permission, perform phased work, refuse proposals, and leave persistent property history.', {
        causes: ['autonomous habitat shaper v0.4.0', 'deterministic authority-bound simulation'],
        evidence: { intentionSchema: INTENTION_SCHEMA, requestSchema: REQUEST_SCHEMA, propertySchema: PROPERTY_SCHEMA }
      });
      world.flags.autonomousStewardshipAnnounced = true;
    }
    return world;
  }

  function intentionById(world, id) {
    return (world.habitatIntentions || []).find((entry) => entry.id === id) || null;
  }

  function requestById(world, id) {
    return (world.stewardshipRequests || []).find((entry) => entry.id === id) || null;
  }

  function activeIntentionForResident(world, residentId) {
    return (world.habitatIntentions || []).find((entry) => entry.residentId === residentId && !TERMINAL_INTENTION.has(entry.status)) || null;
  }

  function intentionRequest(world, intention) {
    return intention?.requestId ? requestById(world, intention.requestId) : null;
  }

  function intentionProject(world, intention) {
    if (!intention?.projectId) return null;
    return Habitats.findProject(world, intention.projectId)?.project || null;
  }

  function recordIntention(world, intention, type, message, evidence = null) {
    const entry = { day: world.time.day, hour: world.time.hour, type, message, evidence };
    intention.history.push(entry);
    if (intention.history.length > 100) intention.history.splice(0, intention.history.length - 100);
    return entry;
  }

  function recordRequest(world, request, type, message, evidence = null) {
    const entry = { day: world.time.day, hour: world.time.hour, type, message, evidence };
    request.history.push(entry);
    if (request.history.length > 100) request.history.splice(0, request.history.length - 100);
    return entry;
  }

  function preferredResidentRooms(npc, property) {
    const scores = new Map();
    (property.habitat?.rooms || []).forEach((room) => scores.set(room.id, 0));
    (property.furniture || []).filter((object) => object.ownerId === npc.id).forEach((object) => {
      const room = Habitats.roomAtCell(property, object.position.x, object.position.y);
      if (room) scores.set(room.id, (scores.get(room.id) || 0) + 2 + (Content.furnitureById(object.catalogId)?.category === 'sleep' ? 3 : 0));
    });
    return (property.habitat?.rooms || []).slice().sort((a, b) => {
      const scoreA = (scores.get(a.id) || 0) + (a.purpose === 'sleep' ? 1 : 0);
      const scoreB = (scores.get(b.id) || 0) + (b.purpose === 'sleep' ? 1 : 0);
      return scoreB - scoreA || b.area - a.area || a.id.localeCompare(b.id);
    });
  }

  function candidateSpecs(world, npc, property) {
    const candidates = [];
    const add = (kind, spec, score, reasons) => {
      const validation = Habitats.validateProjectSpec(world, property, spec, { forProposal: true });
      if (!validation.ok) return;
      const budget = Habitats.projectBudget(property, spec);
      const activeTarget = (property.habitat.projects || []).some((project) => ['planned', 'active'].includes(project.status)
        && project.targetKey === (spec.type === 'partition' ? spec.target.edgeKey : spec.type === 'repair' ? 'structure' : `${spec.target.roomId}:${spec.type}:${spec.target.surface || spec.target.utilityType || ''}`));
      if (activeTarget) return;
      candidates.push({ kind, spec, score: Core.round(score, 2), reasons, budget });
    };

    const structuralCondition = Core.safeNumber(property.habitat?.structuralCondition, property.condition);
    if (structuralCondition < 91 || property.condition < 80) {
      const score = (100 - structuralCondition) * 1.9 + (100 - property.condition) * 0.55 + npc.skills.repair * 0.22
        + (npc.personalGoal === 'restore old things' ? 28 : 0) + stableRange(world, `${npc.id}|repair|${world.time.day}`, -6, 10);
      add('repair', { type: 'repair', target: { structure: 'whole_habitat' } }, score, [
        `structure ${Core.round(structuralCondition, 1)}/100`,
        `property condition ${Core.round(property.condition, 1)}/100`,
        npc.personalGoal === 'restore old things' ? 'personal goal favors restoration' : 'maintenance need'
      ]);
    }

    const rooms = preferredResidentRooms(npc, property).filter((room) => room.purpose !== 'bathroom');
    const preferredFinish = FINISH_BY_COLOR[npc.preferences.colors[0]] || 'soft_white';
    rooms.slice(0, 3).forEach((room, index) => {
      ['walls', 'floor'].forEach((surface, surfaceIndex) => {
        const current = surface === 'walls' ? room.finish.wallFinishId : room.finish.floorFinishId;
        let finishId = preferredFinish;
        if (current === finishId) {
          const alternatives = ['soft_white', 'warm_clay', 'moss_wash', 'night_blue', 'plum_lime', 'reclaimed_wood', 'dark_cork', 'painted_concrete'];
          finishId = alternatives[(Core.hashString(`${npc.id}|${room.id}|${surface}`) + world.time.day) % alternatives.length];
        }
        const score = 32 + npc.traits.creativity * 0.42 + (100 - Core.safeNumber(room.finish.condition, 78)) * 0.55
          + (npc.personalGoal === 'create a beautiful room' ? 30 : 0) + (index === 0 ? 14 : 0)
          + (surfaceIndex === 0 ? 2 : 0) + stableRange(world, `${npc.id}|surface|${room.id}|${surface}|${world.time.day}`, -12, 12);
        add('surface', { type: 'surface', target: { roomId: room.id, surface, finishId } }, score, [
          `${room.name} contains ${index === 0 ? 'the strongest share' : 'some'} of the resident's belongings`,
          `creativity ${Core.round(npc.traits.creativity, 0)}/100`,
          `preferred color family ${npc.preferences.colors[0]}`
        ]);
      });
    });

    const utilityRooms = rooms.filter((room) => ['work', 'workshop', 'hobby', 'flexible', 'kitchen'].includes(room.purpose));
    utilityRooms.slice(0, 2).forEach((room) => {
      const wanted = npc.skills.cooking > 30 || npc.personalGoal === 'become excellent at a craft' ? 'water' : 'power';
      if (!room.utilityAccess[wanted]) {
        const score = 28 + npc.traits.ambition * 0.28 + npc.skills.repair * 0.2 + npc.skills.cooking * 0.18
          + stableRange(world, `${npc.id}|utility|${room.id}|${wanted}|${world.time.day}`, -8, 14);
        add('utility', { type: 'utility', target: { roomId: room.id, utilityType: wanted } }, score, [
          `${room.name} lacks ${wanted}`,
          'utility supports a chosen activity rather than a universal best room'
        ]);
      }
    });

    const recommended = Habitats.recommendedEdits(property);
    const circulation = recommended.find((edge) => edge.current === 'wall');
    if (circulation && (npc.traits.independence + npc.traits.creativity > 105)) {
      const score = 20 + npc.traits.independence * 0.22 + npc.traits.creativity * 0.16
        + stableRange(world, `${npc.id}|door|${circulation.key}|${world.time.day}`, -12, 12);
      add('partition', { type: 'partition', target: { edgeKey: circulation.key, kind: 'door', materialId: npc.traits.thrift > 60 ? 'reclaimed_timber' : 'timber_frame' } }, score, [
        'existing wall can become a validated doorway',
        `independence ${Core.round(npc.traits.independence, 0)}/100`
      ]);
    }
    const openPlan = recommended.find((edge) => edge.current === 'door');
    if (openPlan && property.tenants.length <= 2 && npc.traits.creativity > 65) {
      const score = 18 + npc.traits.creativity * 0.25 + (100 - npc.traits.stability) * 0.12
        + stableRange(world, `${npc.id}|open|${openPlan.key}|${world.time.day}`, -14, 10);
      add('partition', { type: 'partition', target: { edgeKey: openPlan.key, kind: 'open', materialId: 'timber_frame' } }, score, [
        'resident prefers a more open connection',
        'completion still requires room reachability and object no-loss checks'
      ]);
    }

    return candidates.sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind));
  }

  function summarizeSpec(property, spec) {
    return Habitats.projectSummary(property, spec);
  }

  function formIntention(world, residentId, forcedSpec = null, options = {}) {
    ensureState(world);
    const npc = World.getPerson(world, residentId);
    if (!npc || residentId === 'player') return { ok: false, reason: 'Autonomous resident not found.' };
    if (activeIntentionForResident(world, residentId)) return { ok: false, reason: 'This resident already has an active habitat intention.' };
    const property = World.getProperty(world, npc.homePropertyId);
    if (!property?.habitat) return { ok: false, reason: 'Resident home has no structural habitat.' };

    if (!options.force && property.tenants.includes('player')) {
      const household = AXM.Households?.playerHousehold(world);
      const partnerAllowed = household && household.memberIds.includes(npc.id) && household.homePropertyId === property.id && AXM.Households.isCohabiting(world, household);
      if (!partnerAllowed) return { ok: false, reason: 'Non-partner roommates do not structurally rewrite the player home through background autonomy.' };
    }

    let candidate;
    if (forcedSpec) {
      const validation = Habitats.validateProjectSpec(world, property, forcedSpec, { forProposal: true });
      if (!validation.ok) return validation;
      candidate = {
        kind: forcedSpec.type,
        spec: Core.deepClone(forcedSpec),
        score: 100,
        reasons: ['explicit labeled experiment setup'],
        budget: Habitats.projectBudget(property, forcedSpec)
      };
    } else {
      candidate = candidateSpecs(world, npc, property)[0];
      if (!candidate || candidate.score < 35) return { ok: false, reason: 'No grounded habitat intention scored strongly enough.' };
    }

    const requestThreshold = Core.round(Math.max(18, candidate.budget.totalMoney * 0.3), 2);
    const intention = {
      id: Core.uniqueId(world, 'habitat_intention'),
      schema: INTENTION_SCHEMA,
      residentId: npc.id,
      propertyId: property.id,
      createdDay: world.time.day,
      createdHour: world.time.hour,
      status: 'saving',
      kind: candidate.kind,
      summary: summarizeSpec(property, candidate.spec),
      projectSpec: Core.deepClone(candidate.spec),
      reasons: candidate.reasons.slice(),
      scoreEvidence: { score: candidate.score, generatedDay: world.time.day },
      funding: {
        budget: candidate.budget,
        requestThreshold,
        escrow: { money: 0, materials: emptyMaterials() },
        contributionTotals: { resident: 0, propertyReserve: 0 },
        history: [],
        lastMilestone: 0,
        materialsPurchased: false,
        materialPurchaseEvidence: null
      },
      requestId: null,
      projectId: null,
      nextActionDay: world.time.day,
      deadlineDay: world.time.day + 120,
      completedDay: null,
      failureReason: null,
      history: []
    };
    recordIntention(world, intention, 'formed', `${npc.name} formed the intention: ${intention.summary}.`, {
      reasons: intention.reasons, budget: intention.funding.budget, score: candidate.score
    });
    world.habitatIntentions.push(intention);
    world.metrics.habitatIntentionsFormed += 1;
    Core.appendPropertyHistory(world, property, 'resident_intention', `${npc.name} began saving toward ${intention.summary}.`, {
      actorIds: [npc.id], causes: intention.reasons
    });
    Core.appendLedger(world, 'stewardship', `${npc.name} formed a habitat intention at ${property.name}: ${intention.summary}.`, {
      actorIds: [npc.id], placeId: property.id, causes: intention.reasons,
      evidence: { intentionId: intention.id, budget: candidate.budget, score: candidate.score }
    });
    return { ok: true, intention };
  }

  function residentSafetyBuffer(npc, property) {
    return Math.max(90, property.currentRent / 3.2 + Math.min(180, npc.rentArrears || 0));
  }

  function saveTowardIntention(world, intention) {
    const npc = World.getPerson(world, intention.residentId);
    const property = World.getProperty(world, intention.propertyId);
    if (!npc || !property) return 0;
    const target = intention.funding.budget.totalMoney;
    const already = intention.funding.contributionTotals.resident + intention.funding.contributionTotals.propertyReserve;
    const remaining = Math.max(0, target - already);
    if (remaining <= 0.001) return 0;
    const disposable = Math.max(0, npc.money - residentSafetyBuffer(npc, property));
    if (disposable <= 0.01) return 0;
    const income = Systems.npcMonthlyIncome(npc);
    const base = 1.5 + npc.traits.ambition / 24 + npc.traits.thrift / 32 + income / 900;
    const cadence = stableRange(world, `${npc.id}|save|${intention.id}|${world.time.day}`, 0.72, 1.28);
    const amount = Core.round(Math.min(remaining, disposable, Math.max(1, base * cadence)), 2);
    if (amount <= 0) return 0;
    npc.money = Core.round(npc.money - amount, 2);
    intention.funding.escrow.money = Core.round(intention.funding.escrow.money + amount, 2);
    intention.funding.contributionTotals.resident = Core.round(intention.funding.contributionTotals.resident + amount, 2);
    world.metrics.stewardshipResidentSavings = Core.round(world.metrics.stewardshipResidentSavings + amount, 2);

    const ratio = Math.min(1, (intention.funding.contributionTotals.resident + intention.funding.contributionTotals.propertyReserve) / target);
    const milestone = Math.floor(ratio * 4) * 25;
    if (milestone > intention.funding.lastMilestone) {
      intention.funding.lastMilestone = milestone;
      const entry = { day: world.time.day, amount, total: Core.round(already + amount, 2), milestone };
      intention.funding.history.push(entry);
      recordIntention(world, intention, 'funding_milestone', `${npc.name}'s visible project reserve reached ${milestone}% of the target.`, entry);
    }
    return amount;
  }

  function roomStakeholders(world, property, intention) {
    const others = property.tenants.filter((id) => id !== intention.residentId && id !== 'player');
    if (intention.projectSpec.type !== 'surface') return others;
    const roomId = intention.projectSpec.target.roomId;
    const owners = new Set((property.furniture || []).filter((object) => {
      const room = Habitats.roomAtCell(property, object.position.x, object.position.y);
      return room?.id === roomId && object.ownerId && object.ownerId !== intention.residentId && object.ownerId !== 'player' && object.ownershipMode !== 'property_fixture';
    }).map((object) => object.ownerId));
    return owners.size ? others.filter((id) => owners.has(id)) : others.slice(0, 1);
  }

  function cotenantResponse(world, intention, otherId) {
    const resident = World.getPerson(world, intention.residentId);
    const other = World.getPerson(world, otherId);
    const property = World.getProperty(world, intention.propertyId);
    const relation = resident?.relationships?.[otherId] || { friendship: 0, trust: 0 };
    let score = 46 + Core.safeNumber(relation.friendship, 0) * 0.18 + Core.safeNumber(relation.trust, 0) * 0.12;
    if (intention.projectSpec.type === 'repair') score += 24;
    if (intention.projectSpec.type === 'utility') score += 10;
    if (intention.projectSpec.type === 'partition') score -= other?.traits?.independence * 0.16 || 0;
    if (intention.projectSpec.type === 'surface') {
      const finish = intention.projectSpec.target.finishId;
      const preferred = FINISH_BY_COLOR[other?.preferences?.colors?.[0]];
      if (preferred === finish) score += 20;
      else score -= (other?.traits?.creativity || 50) * 0.08;
    }
    score += stableRange(world, `${intention.id}|cotenant|${otherId}`, -24, 24);
    const accepted = score >= 40;
    return {
      personId: otherId,
      status: accepted ? 'approved' : 'declined',
      respondedDay: world.time.day,
      score: Core.round(score, 2),
      reason: accepted ? 'The change fit their use of the shared home well enough.' : 'They did not consent to this exact change in the shared home.',
      evidence: { relation, propertyId: property.id, projectType: intention.projectSpec.type }
    };
  }

  function ownerShareRate(intention) {
    if (intention.projectSpec.type === 'repair') return 0.72;
    if (intention.projectSpec.type === 'utility') return 0.5;
    if (intention.projectSpec.type === 'partition') return 0.32;
    return 0.12;
  }

  function submitRequest(world, intention) {
    if (intention.requestId) return requestById(world, intention.requestId);
    const npc = World.getPerson(world, intention.residentId);
    const property = World.getProperty(world, intention.propertyId);
    if (!npc || !property) return null;
    const stakeholders = roomStakeholders(world, property, intention);
    const coTenants = stakeholders.map((id) => cotenantResponse(world, intention, id));
    coTenants.forEach((response) => {
      if (response.status === 'approved') world.metrics.stewardshipCotenantApprovals += 1;
      else world.metrics.stewardshipCotenantDeclines += 1;
    });
    const playerRequired = property.ownerId === 'player' || property.tenants.includes('player');
    const externalRequired = property.ownerId !== 'player';
    const request = {
      id: Core.uniqueId(world, 'stewardship_request'),
      schema: REQUEST_SCHEMA,
      intentionId: intention.id,
      residentId: intention.residentId,
      propertyId: intention.propertyId,
      createdDay: world.time.day,
      createdHour: world.time.hour,
      status: 'pending_external',
      summary: intention.summary,
      projectSpec: Core.deepClone(intention.projectSpec),
      proposedOwnerContribution: Core.round(intention.funding.budget.totalMoney * ownerShareRate(intention), 2),
      acceptedOwnerContribution: 0,
      authorities: {
        coTenants,
        player: {
          required: playerRequired,
          roles: [property.ownerId === 'player' ? 'property_owner' : null, property.tenants.includes('player') ? 'cohabitant' : null].filter(Boolean),
          status: playerRequired ? 'pending' : 'not_required',
          respondedDay: null,
          response: null
        },
        externalOwner: {
          required: externalRequired,
          ownerId: property.ownerId,
          ownerLabel: property.ownerLabel,
          status: externalRequired ? 'pending' : 'not_required',
          dueDay: externalRequired ? world.time.day + ensurePropertyPolicy(property).policy.responseDelayDays : null,
          respondedDay: null,
          response: null,
          score: null,
          evidence: null
        }
      },
      response: null,
      history: []
    };
    const declinedCoTenant = coTenants.find((entry) => entry.status === 'declined');
    if (declinedCoTenant) {
      request.status = 'declined';
      request.response = { by: declinedCoTenant.personId, reason: declinedCoTenant.reason, boundary: 'co_tenant_consent' };
      request.authorities.externalOwner.status = externalRequired ? 'not_reached' : 'not_required';
      request.authorities.player.status = playerRequired ? 'not_reached' : 'not_required';
    } else if (playerRequired) {
      request.status = 'pending_player';
    } else if (externalRequired) {
      request.status = 'pending_external';
    } else {
      request.status = 'approved';
    }

    recordRequest(world, request, 'submitted', `${npc.name} submitted an exact request for ${intention.summary}.`, {
      coTenants, playerRequired, externalRequired, proposedOwnerContribution: request.proposedOwnerContribution
    });
    world.stewardshipRequests.push(request);
    intention.requestId = request.id;
    property.stewardship.requestIds.push(request.id);
    world.metrics.stewardshipRequestsSubmitted += 1;

    if (request.status === 'declined') {
      declineIntention(world, intention, request.response.reason, request.response.by, 'co_tenant_refusal');
      request.completedDay = world.time.day;
      world.metrics.stewardshipRequestsDeclined += 1;
      Core.appendLedger(world, 'stewardship', `${npc.name}'s request for ${intention.summary} was declined by a co-tenant. The exact refusal remains visible and no relationship punishment flag was added.`, {
        actorIds: [npc.id, request.response.by], placeId: property.id, causes: ['explicit co-tenant refusal'], evidence: { requestId: request.id, response: request.response }
      });
      return request;
    }
    if (request.status === 'approved') {
      approveRequest(world, request, { by: 'direct_authority', ownerContribution: 0, evidence: { noFurtherAuthorityRequired: true } });
      return request;
    }

    intention.status = 'awaiting_permission';
    recordIntention(world, intention, 'permission_requested', `${npc.name} requested permission after saving a visible first share of the budget.`, { requestId: request.id });
    Core.appendPropertyHistory(world, property, 'stewardship_request', `${npc.name} requested permission for ${intention.summary}.`, {
      actorIds: [npc.id], causes: ['resident-authored intention', 'explicit authority request']
    });
    Core.appendLedger(world, 'stewardship', `${npc.name} requested permission for ${intention.summary} at ${property.name}.`, {
      actorIds: [npc.id], placeId: property.id, causes: ['visible savings threshold reached', 'authority cannot be invented'],
      evidence: { requestId: request.id, intentionId: intention.id, status: request.status, coTenantResponses: coTenants }
    });
    return request;
  }

  function addOwnerContribution(world, intention, property, amount, source = 'property_reserve') {
    const available = Math.max(0, property.maintenanceReserve);
    const contribution = Core.round(Math.min(Math.max(0, amount), available), 2);
    if (contribution <= 0) return 0;
    property.maintenanceReserve = Core.round(property.maintenanceReserve - contribution, 2);
    intention.funding.escrow.money = Core.round(intention.funding.escrow.money + contribution, 2);
    intention.funding.contributionTotals.propertyReserve = Core.round(intention.funding.contributionTotals.propertyReserve + contribution, 2);
    intention.funding.history.push({ day: world.time.day, source, amount: contribution, totalEscrow: intention.funding.escrow.money });
    world.metrics.stewardshipOwnerContributions = Core.round(world.metrics.stewardshipOwnerContributions + contribution, 2);
    return contribution;
  }

  function approveRequest(world, request, options = {}) {
    const intention = intentionById(world, request.intentionId);
    const property = World.getProperty(world, request.propertyId);
    const npc = World.getPerson(world, request.residentId);
    if (!intention || !property || !npc) return { ok: false, reason: 'Linked stewardship state is missing.' };
    const ownerContribution = addOwnerContribution(world, intention, property, Core.safeNumber(options.ownerContribution, 0), options.source || 'property_reserve');
    request.acceptedOwnerContribution = Core.round(request.acceptedOwnerContribution + ownerContribution, 2);
    request.status = 'approved';
    request.response = {
      by: options.by || property.ownerId,
      decision: 'approved',
      ownerContribution,
      evidence: options.evidence || null,
      day: world.time.day
    };
    recordRequest(world, request, 'approved', `${intention.summary} was approved with ${Core.formatMoney(ownerContribution)} from the property reserve.`, request.response);
    intention.status = 'approved_saving';
    recordIntention(world, intention, 'approved', 'The exact request was approved. Approval did not skip saving, material acquisition, or construction phases.', { requestId: request.id, ownerContribution });
    world.metrics.stewardshipRequestsApproved += 1;
    Core.appendPropertyHistory(world, property, 'stewardship_approved', `${npc.name}'s request for ${intention.summary} was approved.`, {
      actorIds: [npc.id, options.by === 'player' ? 'player' : property.ownerId], causes: ['recorded authority decision', 'phased work still required']
    });
    Core.appendLedger(world, 'stewardship', `${npc.name}'s habitat request was approved at ${property.name}: ${intention.summary}.`, {
      actorIds: [npc.id].concat(options.by === 'player' ? ['player'] : []), placeId: property.id, causes: ['explicit approval'],
      evidence: { requestId: request.id, ownerContribution, authorityEvidence: options.evidence || null }
    });
    return { ok: true, request, intention, ownerContribution };
  }

  function releaseEscrow(world, intention, reason, options = {}) {
    const npc = World.getPerson(world, intention.residentId);
    const property = World.getProperty(world, intention.propertyId);
    if (!npc || !property || !intention.funding?.escrow) return { cash: 0, materialValue: 0, loss: 0 };
    const escrow = intention.funding.escrow;
    const materialGross = Object.entries(escrow.materials || {}).reduce((sum, [key, amount]) => sum + (Content.MATERIALS[key]?.unitPrice || 0) * Core.safeNumber(amount, 0), 0);
    const resaleRate = options.completed ? 1 : 0.7;
    const materialValue = Core.round(materialGross * resaleRate, 2);
    const loss = Core.round(materialGross - materialValue, 2);
    const refundable = Core.round(Math.max(0, escrow.money) + materialValue, 2);
    const residentContrib = Math.max(0, intention.funding.contributionTotals.resident || 0);
    const reserveContrib = Math.max(0, intention.funding.contributionTotals.propertyReserve || 0);
    const totalContrib = residentContrib + reserveContrib;
    const residentShare = totalContrib > 0 ? Core.round(refundable * residentContrib / totalContrib, 2) : refundable;
    const reserveShare = Core.round(refundable - residentShare, 2);
    npc.money = Core.round(npc.money + residentShare, 2);
    property.maintenanceReserve = Core.round(property.maintenanceReserve + reserveShare, 2);
    escrow.money = 0;
    escrow.materials = emptyMaterials();
    world.metrics.stewardshipEscrowRefunded = Core.round(world.metrics.stewardshipEscrowRefunded + refundable, 2);
    world.metrics.stewardshipMaterialResaleLoss = Core.round(world.metrics.stewardshipMaterialResaleLoss + loss, 2);
    recordIntention(world, intention, 'escrow_released', `Remaining project resources were released after ${reason}.`, {
      residentShare, reserveShare, materialGross, materialValue, loss, resaleRate
    });
    return { cash: refundable, residentShare, reserveShare, materialValue, loss };
  }

  function declineIntention(world, intention, reason, by, cause = 'authority_decline') {
    if (TERMINAL_INTENTION.has(intention.status)) return;
    intention.status = 'declined';
    intention.failureReason = reason;
    intention.completedDay = world.time.day;
    const npc = World.getPerson(world, intention.residentId);
    const property = World.getProperty(world, intention.propertyId);
    const refund = releaseEscrow(world, intention, 'a declined request');
    recordIntention(world, intention, 'declined', `${intention.summary} was declined: ${reason}`, { by, refund });
    if (npc) npc.habitatIntentionCooldownUntil = world.time.day + 18 + Math.floor((npc.traits.stability || 50) * 0.25);
    world.metrics.habitatIntentionsDeclined += 1;
    if (property) Core.appendPropertyHistory(world, property, 'stewardship_declined', `${npc?.name || intention.residentId}'s request for ${intention.summary} was declined.`, {
      actorIds: [intention.residentId].concat(by === 'player' ? ['player'] : []), causes: [cause, 'no hidden consent']
    });
  }

  function resolveExternalRequest(world, request) {
    if (request.status !== 'pending_external') return null;
    if (request.authorities.player.required && request.authorities.player.status !== 'approved') return null;
    const intention = intentionById(world, request.intentionId);
    const property = World.getProperty(world, request.propertyId);
    const npc = World.getPerson(world, request.residentId);
    if (!intention || !property || !npc) return null;
    const authority = request.authorities.externalOwner;
    if (!authority.required) return approveRequest(world, request, { by: 'direct_authority', ownerContribution: 0 });
    if (world.time.day < authority.dueDay) return null;
    const policy = ensurePropertyPolicy(property).policy;
    let score = policy.alterationTolerance + policy.generosity * 0.15 + npc.stewardshipReliability * 0.22;
    if (intention.projectSpec.type === 'repair') score += 32 + policy.repairPriority * 0.15;
    if (intention.projectSpec.type === 'utility') score += 15;
    if (intention.projectSpec.type === 'surface') score += 5 + npc.traits.neatness * 0.08;
    if (intention.projectSpec.type === 'partition') score -= 11;
    if (property.condition < 78) score += 12;
    if (npc.rentArrears > 0) score -= Math.min(36, 12 + npc.rentArrears * 0.05);
    const reserveCoverage = property.maintenanceReserve / Math.max(1, request.proposedOwnerContribution);
    score += Core.clamp(reserveCoverage, 0, 2) * 8;
    score += stableRange(world, `${request.id}|external-owner-decision`, -24, 24);
    const approvalThresholds = {
      repair: 58,
      utility: 66,
      surface: 72,
      partition: 78
    };
    const approvalThreshold = approvalThresholds[intention.projectSpec.type] || 72;
    const approved = score >= approvalThreshold;
    authority.respondedDay = world.time.day;
    authority.score = Core.round(score, 2);
    authority.evidence = {
      policyId: policy.id,
      reliability: npc.stewardshipReliability,
      rentArrears: npc.rentArrears,
      propertyCondition: property.condition,
      maintenanceReserve: property.maintenanceReserve,
      approvalThreshold,
      deterministicDecisionKey: `${request.id}|external-owner-decision`
    };

    if (!approved) {
      authority.status = 'declined';
      authority.response = 'The owner policy declined this exact change.';
      request.status = 'declined';
      request.response = { by: property.ownerId, decision: 'declined', reason: authority.response, score: authority.score, evidence: authority.evidence };
      recordRequest(world, request, 'declined', authority.response, request.response);
      world.metrics.stewardshipExternalDeclines += 1;
      world.metrics.stewardshipRequestsDeclined += 1;
      declineIntention(world, intention, authority.response, property.ownerId, 'external_owner_policy_decline');
      Core.appendLedger(world, 'stewardship', `${property.ownerLabel} declined ${npc.name}'s request for ${intention.summary}.`, {
        actorIds: [npc.id], placeId: property.id, causes: ['deterministic owner policy decision'], evidence: { requestId: request.id, score: authority.score, ...authority.evidence }
      });
      return { ok: true, request, approved: false };
    }

    authority.status = 'approved';
    authority.response = 'The owner policy approved the exact change.';
    const desired = request.proposedOwnerContribution;
    const affordability = Core.clamp(property.maintenanceReserve / Math.max(1, desired), 0, 1);
    const contribution = Core.round(desired * affordability * Core.clamp(policy.generosity / 70, 0.35, 1), 2);
    world.metrics.stewardshipExternalApprovals += 1;
    return approveRequest(world, request, { by: property.ownerId, ownerContribution: contribution, source: 'external_property_reserve', evidence: { score: authority.score, ...authority.evidence } });
  }

  function respondToStewardshipRequest(world, requestId, response) {
    ensureState(world);
    const request = requestById(world, requestId);
    if (!request || request.status !== 'pending_player' || request.authorities.player.status !== 'pending') return { ok: false, reason: 'No player decision is waiting for this request.' };
    const intention = intentionById(world, request.intentionId);
    const property = World.getProperty(world, request.propertyId);
    const npc = World.getPerson(world, request.residentId);
    if (!intention || !property || !npc) return { ok: false, reason: 'Linked request state is missing.' };
    if (!['approve_tenant_funded', 'approve_owner_share', 'decline'].includes(response)) return { ok: false, reason: 'Unknown stewardship response.' };

    // Reject impossible reserve-authority choices before recording any
    // response. A failed UI/API action must leave the pending request exactly
    // as it was; it may never create partial consent as a side effect.
    if (response === 'approve_owner_share') {
      if (property.ownerId !== 'player') return { ok: false, reason: 'Only a property owner can release that property’s maintenance reserve.' };
      if (property.maintenanceReserve <= 0) return { ok: false, reason: 'This property has no maintenance reserve to contribute.' };
    }

    request.authorities.player.respondedDay = world.time.day;
    request.authorities.player.response = response;
    if (response === 'decline') {
      request.authorities.player.status = 'declined';
      request.status = 'declined';
      request.response = { by: 'player', decision: 'declined', reason: 'The player did not approve this exact change.', noRelationshipPenalty: true };
      recordRequest(world, request, 'declined', 'The player declined the exact request. Declining did not add a hidden relationship penalty.', request.response);
      world.metrics.stewardshipPlayerDeclines += 1;
      world.metrics.stewardshipRequestsDeclined += 1;
      declineIntention(world, intention, request.response.reason, 'player', 'explicit_player_decline');
      Core.appendLedger(world, 'stewardship', `You declined ${npc.name}'s request for ${intention.summary} at ${property.name}.`, {
        actorIds: ['player', npc.id], placeId: property.id, causes: ['explicit player decision', 'no fabricated consent'], evidence: { requestId: request.id, noRelationshipPenalty: true }
      });
      Systems.toast(world, 'Request declined without a hidden relationship penalty.', 'info');
      return { ok: true, request, approved: false };
    }

    request.authorities.player.status = 'approved';
    world.metrics.stewardshipPlayerApprovals += 1;
    let contribution = 0;
    if (response === 'approve_owner_share') {
      contribution = Math.min(request.proposedOwnerContribution, property.maintenanceReserve);
    }
    recordRequest(world, request, 'player_approved', `The player approved the exact request${contribution ? ' and authorized a maintenance-reserve contribution' : ' without taking over its funding'}.`, {
      response, contribution, roles: request.authorities.player.roles
    });
    Core.appendLedger(world, 'stewardship', `You approved ${npc.name}'s request for ${intention.summary} at ${property.name}.`, {
      actorIds: ['player', npc.id], placeId: property.id, causes: ['explicit player approval'], evidence: { requestId: request.id, response, contribution }
    });

    if (request.authorities.externalOwner.required) {
      request.status = 'pending_external';
      request.authorities.externalOwner.dueDay = Math.max(world.time.day + 1, request.authorities.externalOwner.dueDay || world.time.day + 1);
      intention.status = 'awaiting_permission';
      Systems.toast(world, 'Your consent is recorded; the external owner must still decide.', 'info');
      return { ok: true, request, approved: null };
    }

    const result = approveRequest(world, request, { by: 'player', ownerContribution: contribution, source: 'player_property_reserve', evidence: { response, roles: request.authorities.player.roles } });
    Systems.toast(world, contribution > 0 ? 'Approved with a property-reserve contribution.' : 'Approved; the resident keeps funding and performing the work.', 'success');
    return { ...result, approved: true };
  }

  function acquireResourcesAndCreateProject(world, intention) {
    if (!['approved_saving', 'ready'].includes(intention.status)) return null;
    const property = World.getProperty(world, intention.propertyId);
    const npc = World.getPerson(world, intention.residentId);
    const request = intentionRequest(world, intention);
    if (!property || !npc || !request || request.status !== 'approved') return null;
    const budget = intention.funding.budget;
    const contributed = intention.funding.contributionTotals.resident + intention.funding.contributionTotals.propertyReserve;
    if (contributed + 0.001 < budget.totalMoney) return null;

    if (!intention.funding.materialsPurchased) {
      if (intention.funding.escrow.money + 0.001 < budget.totalMoney) return null;
      intention.funding.escrow.money = Core.round(intention.funding.escrow.money - budget.materialMoney, 2);
      intention.funding.escrow.materials = { ...emptyMaterials(), ...Core.deepClone(budget.materials) };
      intention.funding.materialsPurchased = true;
      intention.funding.materialPurchaseEvidence = {
        day: world.time.day,
        cost: budget.materialMoney,
        unitPrices: Object.fromEntries(Object.entries(Content.MATERIALS).map(([key, value]) => [key, value.unitPrice])),
        materials: Core.deepClone(budget.materials)
      };
      world.metrics.stewardshipMaterialsPurchased = Core.round(world.metrics.stewardshipMaterialsPurchased + budget.materialMoney, 2);
      recordIntention(world, intention, 'materials_acquired', `${npc.name} acquired the exact recorded material bundle for the approved project.`, intention.funding.materialPurchaseEvidence);
    }

    intention.status = 'ready';
    if (intention.projectId) return intentionProject(world, intention);
    const created = Habitats.createStewardshipProject(world, property.id, intention.projectSpec, {
      actorId: npc.id,
      intentionId: intention.id,
      requestId: request.id,
      evidence: {
        requestStatus: request.status,
        playerAuthority: request.authorities.player,
        externalOwnerAuthority: request.authorities.externalOwner,
        coTenantAuthority: request.authorities.coTenants,
        budget
      }
    });
    if (!created.ok) {
      intention.status = 'failed';
      intention.failureReason = created.reason;
      intention.completedDay = world.time.day;
      releaseEscrow(world, intention, 'project creation failure');
      recordIntention(world, intention, 'failed', `The approved plan could not enter construction: ${created.reason}`, { requestId: request.id });
      world.metrics.habitatIntentionsFailed += 1;
      npc.habitatIntentionCooldownUntil = world.time.day + 30;
      return null;
    }
    intention.projectId = created.project.id;
    intention.status = 'working';
    recordIntention(world, intention, 'construction_started', `${npc.name} began phased work.`, { projectId: created.project.id, phases: created.project.phases.map((phase) => phase.id) });
    return created.project;
  }

  function completeIntention(world, intention, project) {
    if (intention.status === 'completed') return;
    const npc = World.getPerson(world, intention.residentId);
    const property = World.getProperty(world, intention.propertyId);
    const request = intentionRequest(world, intention);
    intention.status = 'completed';
    intention.completedDay = world.time.day;
    if (request) {
      request.status = 'completed';
      request.completedDay = world.time.day;
      recordRequest(world, request, 'completed', `${intention.summary} completed after all construction phases and validation.`, { projectId: project.id });
    }
    const refund = releaseEscrow(world, intention, 'validated completion', { completed: true });
    recordIntention(world, intention, 'completed', `${npc?.name || intention.residentId} completed ${intention.summary}.`, { projectId: project.id, refund });
    if (property) {
      property.stewardship.completedIntentionIds.push(intention.id);
      Core.appendPropertyHistory(world, property, 'resident_project_completed', `${npc?.name || intention.residentId} completed ${intention.summary}; the home retained the change in its history.`, {
        actorIds: [intention.residentId], causes: ['autonomous resident work', 'validated construction completion']
      });
    }
    if (npc) npc.habitatIntentionCooldownUntil = world.time.day + 28 + Math.floor(npc.traits.stability * 0.45);
    world.metrics.habitatIntentionsCompleted += 1;
    world.metrics.stewardshipProjectsCompleted += 1;
    Core.appendLedger(world, 'stewardship', `${npc?.name || intention.residentId} completed ${intention.summary} at ${property?.name || intention.propertyId}.`, {
      actorIds: [intention.residentId], placeId: intention.propertyId, causes: ['resident-authored intention', 'saved resources', 'recorded permissions', 'phased validated work'],
      evidence: { intentionId: intention.id, requestId: intention.requestId, projectId: project.id, refund }
    });
  }

  function failIntention(world, intention, reason) {
    if (TERMINAL_INTENTION.has(intention.status)) return;
    const npc = World.getPerson(world, intention.residentId);
    const property = World.getProperty(world, intention.propertyId);
    intention.status = 'failed';
    intention.failureReason = reason;
    intention.completedDay = world.time.day;
    const request = intentionRequest(world, intention);
    if (request && !TERMINAL_REQUEST.has(request.status)) {
      request.status = 'withdrawn';
      request.response = { decision: 'withdrawn_after_failure', reason };
      recordRequest(world, request, 'withdrawn', reason, request.response);
    }
    const refund = releaseEscrow(world, intention, 'a failed project');
    recordIntention(world, intention, 'failed', reason, { refund });
    if (npc) npc.habitatIntentionCooldownUntil = world.time.day + 35;
    world.metrics.habitatIntentionsFailed += 1;
    Core.appendLedger(world, 'stewardship', `${npc?.name || intention.residentId}'s habitat intention failed safely: ${reason}`, {
      actorIds: [intention.residentId], placeId: property?.id || intention.propertyId, causes: ['explicit failure handling', 'remaining escrow released'], evidence: { intentionId: intention.id, refund }
    });
  }

  function withdrawIntention(world, intention, reason) {
    if (TERMINAL_INTENTION.has(intention.status)) return;
    const npc = World.getPerson(world, intention.residentId);
    const project = intentionProject(world, intention);
    if (project && ['planned', 'active'].includes(project.status)) {
      project.status = 'cancelled';
      project.failureReason = reason;
      project.history.push({ day: world.time.day, hour: world.time.hour, type: 'cancelled', message: reason, evidence: { stewardshipIntentionId: intention.id } });
      world.metrics.habitatProjectsCancelled += 1;
    }
    intention.status = 'withdrawn';
    intention.failureReason = reason;
    intention.completedDay = world.time.day;
    const request = intentionRequest(world, intention);
    if (request && !TERMINAL_REQUEST.has(request.status)) {
      request.status = 'withdrawn';
      request.response = { decision: 'withdrawn', reason };
      recordRequest(world, request, 'withdrawn', reason, request.response);
    }
    const refund = releaseEscrow(world, intention, 'a withdrawn intention');
    recordIntention(world, intention, 'withdrawn', reason, { refund });
    if (npc) npc.habitatIntentionCooldownUntil = world.time.day + 20;
    world.metrics.habitatIntentionsWithdrawn += 1;
  }

  function processIntention(world, intention) {
    if (TERMINAL_INTENTION.has(intention.status)) return;
    const npc = World.getPerson(world, intention.residentId);
    const property = World.getProperty(world, intention.propertyId);
    if (!npc || !property) return failIntention(world, intention, 'Resident or property disappeared from the authoritative world state.');
    if (npc.homePropertyId !== property.id || !property.tenants.includes(npc.id)) {
      return withdrawIntention(world, intention, `${npc.name} moved before the habitat intention completed.`);
    }
    if (world.time.day > intention.deadlineDay && intention.status === 'awaiting_permission') {
      return withdrawIntention(world, intention, 'The resident withdrew the unanswered request after a visible long deadline.');
    }

    if (['saving', 'awaiting_permission', 'approved_saving'].includes(intention.status)) saveTowardIntention(world, intention);
    const contributed = intention.funding.contributionTotals.resident + intention.funding.contributionTotals.propertyReserve;
    if (!intention.requestId && contributed + 0.001 >= intention.funding.requestThreshold) submitRequest(world, intention);

    const request = intentionRequest(world, intention);
    if (request?.status === 'pending_external') resolveExternalRequest(world, request);
    if (request?.status === 'approved') acquireResourcesAndCreateProject(world, intention);

    if (intention.status === 'working') {
      const project = intentionProject(world, intention);
      if (!project) return failIntention(world, intention, 'The linked construction project is missing.');
      if (project.status === 'failed' || project.status === 'cancelled') return failIntention(world, intention, project.failureReason || `Project became ${project.status}.`);
      if (project.status === 'completed') return completeIntention(world, intention, project);
      const cadence = (world.time.day + Core.hashString(intention.id)) % 2 === 0 || project.phaseIndex === 0;
      if (!cadence) return;
      const result = Habitats.workStewardshipProject(world, project.id, npc.id, intention.funding.escrow);
      if (result.ok) {
        world.metrics.stewardshipProjectPhases += 1;
        recordIntention(world, intention, 'phase_completed', `${npc.name} completed ${result.phase?.name || 'the final validation phase'}.`, {
          projectId: project.id, phaseId: result.phase?.id || null, phaseIndex: project.phaseIndex, status: project.status
        });
        if (project.status === 'completed') completeIntention(world, intention, project);
      } else if (project.status === 'failed') {
        failIntention(world, intention, result.reason);
      }
    }
  }

  function maybeFormIntention(world, npc) {
    if (AXM.Family?.isDependent(npc)) return null;
    if (activeIntentionForResident(world, npc.id)) return null;
    if (world.time.day < npc.habitatIntentionCooldownUntil) return null;
    const property = World.getProperty(world, npc.homePropertyId);
    if (!property?.habitat) return null;
    if (property.tenants.includes('player')) {
      const household = AXM.Households?.playerHousehold(world);
      const allowed = household && household.memberIds.includes(npc.id) && household.homePropertyId === property.id && AXM.Households.isCohabiting(world, household);
      if (!allowed) {
        npc.habitatIntentionCooldownUntil = world.time.day + 14;
        return null;
      }
    }
    if ((Core.hashString(`${npc.id}|intention-cadence`) + world.time.day) % 4 !== 0) return null;
    const result = formIntention(world, npc.id);
    if (!result.ok) npc.habitatIntentionCooldownUntil = world.time.day + 7;
    return result.ok ? result.intention : null;
  }

  function ageHabitatSurfaces(world) {
    (world.places || []).filter((place) => place.kind === 'residential' && place.habitat).forEach((property) => {
      const occupied = property.tenants.length > 0;
      if (occupied) {
        property.habitat.structuralCondition = Core.clamp(Core.safeNumber(property.habitat.structuralCondition, property.condition) - 0.018, 0, 100);
        (property.habitat.rooms || []).forEach((room) => {
          room.finish.condition = Core.clamp(Core.safeNumber(room.finish.condition, 78) - 0.025, 0, 100);
        });
      }
    });
  }

  function dailyTick(world) {
    ensureState(world);
    ageHabitatSurfaces(world);
    (world.stewardshipRequests || []).filter((request) => request.status === 'pending_external').forEach((request) => resolveExternalRequest(world, request));
    (world.habitatIntentions || []).filter((intention) => !TERMINAL_INTENTION.has(intention.status)).forEach((intention) => processIntention(world, intention));
    (world.people || []).forEach((npc) => maybeFormIntention(world, npc));
  }

  function prepareStewardshipExperiment(world) {
    ensureState(world);
    if (world.flags.stewardshipExperimentPrepared) return { ok: false, reason: 'The stewardship experiment setup was already used in this save.' };
    const property = (world.places || []).find((place) => place.kind === 'residential' && place.id !== world.player.homePropertyId && place.tenants.some((id) => id !== 'player'));
    if (!property) return { ok: false, reason: 'No occupied remote property is available for the experiment.' };
    const residentId = property.tenants.find((id) => id !== 'player');
    const npc = World.getPerson(world, residentId);
    if (!npc) return { ok: false, reason: 'Resident not found.' };
    const previousOwnerId = property.ownerId;
    const transferredFixtureIds = [];
    property.ownerId = 'player';
    property.ownerLabel = world.player.name;
    property.listedForSale = false;
    if (!world.player.ownedPropertyIds.includes(property.id)) world.player.ownedPropertyIds.push(property.id);
    (property.furniture || []).forEach((object) => {
      if (object.ownershipMode !== 'property_fixture') return;
      object.ownerId = 'player';
      transferredFixtureIds.push(object.id);
      if (!Array.isArray(object.history)) object.history = [];
      object.history.push({
        day: world.time.day,
        hour: world.time.hour,
        type: 'fixture_ownership_transfer',
        message: `Building-bound fixture ownership transferred from ${previousOwnerId} to the player with the property.`,
        evidence: { propertyId: property.id, previousOwnerId, newOwnerId: 'player', experimentSetup: true }
      });
    });
    property.maintenanceReserve = Math.max(property.maintenanceReserve, 800);
    ensurePropertyPolicy(property);
    npc.money = Math.max(npc.money, 1800);
    npc.habitatIntentionCooldownUntil = world.time.day;

    const room = preferredResidentRooms(npc, property).find((entry) => entry.purpose !== 'bathroom') || property.habitat.rooms[0];
    const current = room.finish.wallFinishId;
    const alternatives = ['moss_wash', 'warm_clay', 'night_blue', 'plum_lime', 'soft_white', 'reclaimed_wood'].filter((id) => id !== current);
    const finishId = alternatives[Core.hashString(`${world.seed}|stewardship-demo`) % alternatives.length];
    const formed = formIntention(world, npc.id, { type: 'surface', target: { roomId: room.id, surface: 'walls', finishId } }, { force: true });
    if (!formed.ok) return formed;
    const intention = formed.intention;
    const seedAmount = Core.round(Math.max(intention.funding.requestThreshold, intention.funding.budget.totalMoney * 0.42), 2);
    const transfer = Math.min(seedAmount, npc.money - 100);
    npc.money = Core.round(npc.money - transfer, 2);
    intention.funding.escrow.money = Core.round(intention.funding.escrow.money + transfer, 2);
    intention.funding.contributionTotals.resident = Core.round(intention.funding.contributionTotals.resident + transfer, 2);
    intention.funding.lastMilestone = Math.floor(transfer / intention.funding.budget.totalMoney * 4) * 25;
    const request = submitRequest(world, intention);
    world.flags.stewardshipExperimentPrepared = true;
    world.ui.selectedStewardshipRequestId = request?.id || null;
    Core.appendLedger(world, 'research', `A labeled stewardship test state was prepared: ${world.player.name} now owns occupied ${property.name}, and ${npc.name} submitted a real resident-authored request without being displaced.`, {
      actorIds: ['player', npc.id], placeId: property.id, causes: ['explicit prototype test setup'],
      evidence: {
        propertyId: property.id,
        residentId: npc.id,
        intentionId: intention.id,
        requestId: request?.id,
        seededSavings: transfer,
        previousOwnerId,
        transferredFixtureIds
      }
    });
    Systems.toast(world, 'Stewardship test prepared: a remote tenant request is waiting.', 'warning');
    return { ok: true, propertyId: property.id, residentId: npc.id, intentionId: intention.id, requestId: request?.id };
  }

  function metrics(world) {
    ensureState(world);
    const active = world.habitatIntentions.filter((entry) => !TERMINAL_INTENTION.has(entry.status));
    const pendingPlayer = world.stewardshipRequests.filter((entry) => entry.status === 'pending_player');
    return {
      activeIntentions: active.length,
      pendingPlayerRequests: pendingPlayer.length,
      pendingExternalRequests: world.stewardshipRequests.filter((entry) => entry.status === 'pending_external').length,
      completedIntentions: world.habitatIntentions.filter((entry) => entry.status === 'completed').length,
      declinedIntentions: world.habitatIntentions.filter((entry) => entry.status === 'declined').length,
      workingProjects: active.filter((entry) => entry.status === 'working').length,
      escrowMoney: Core.round(active.reduce((sum, entry) => sum + Core.safeNumber(entry.funding?.escrow?.money, 0), 0), 2),
      residentSavings: Core.round(world.metrics.stewardshipResidentSavings || 0, 2),
      ownerContributions: Core.round(world.metrics.stewardshipOwnerContributions || 0, 2),
      phasesCompleted: world.metrics.stewardshipProjectPhases || 0
    };
  }

  function validate(world, add) {
    if (!Array.isArray(world.habitatIntentions)) add('habitatIntentions must be an array.');
    if (!Array.isArray(world.stewardshipRequests)) add('stewardshipRequests must be an array.');
    if (!Array.isArray(world.habitatIntentions) || !Array.isArray(world.stewardshipRequests)) return;
    const people = new Set((world.people || []).map((person) => person.id));
    const properties = new Set((world.places || []).filter((place) => place.kind === 'residential').map((place) => place.id));
    const intentionIds = new Set();
    const requestIds = new Set();
    const activeByResident = new Set();
    world.habitatIntentions.forEach((intention) => {
      if (!intention.id || intentionIds.has(intention.id)) add(`Duplicate or missing habitat intention id ${String(intention.id)}.`);
      intentionIds.add(intention.id);
      if (intention.schema !== INTENTION_SCHEMA) add(`${intention.id} has invalid intention schema.`);
      if (!people.has(intention.residentId)) add(`${intention.id} references unknown resident ${String(intention.residentId)}.`);
      if (!properties.has(intention.propertyId)) add(`${intention.id} references unknown property ${String(intention.propertyId)}.`);
      if (!INTENTION_STATUSES.includes(intention.status)) add(`${intention.id} has invalid status ${String(intention.status)}.`);
      if (!TERMINAL_INTENTION.has(intention.status)) {
        if (activeByResident.has(intention.residentId)) add(`${intention.residentId} has more than one active habitat intention.`);
        activeByResident.add(intention.residentId);
      }
      if (!intention.funding || !Number.isFinite(intention.funding.escrow?.money) || intention.funding.escrow.money < -0.001) add(`${intention.id} has invalid escrow money.`);
      Object.entries(intention.funding?.escrow?.materials || {}).forEach(([key, amount]) => {
        if (!Content.MATERIALS[key] || !Number.isFinite(amount) || amount < 0) add(`${intention.id} has invalid escrow material ${key}.`);
      });
      if (intention.requestId && !world.stewardshipRequests.some((request) => request.id === intention.requestId)) add(`${intention.id} references unknown request ${intention.requestId}.`);
      if (intention.projectId && !Habitats.findProject(world, intention.projectId)) add(`${intention.id} references unknown construction project ${intention.projectId}.`);
    });
    world.stewardshipRequests.forEach((request) => {
      if (!request.id || requestIds.has(request.id)) add(`Duplicate or missing stewardship request id ${String(request.id)}.`);
      requestIds.add(request.id);
      if (request.schema !== REQUEST_SCHEMA) add(`${request.id} has invalid request schema.`);
      if (!intentionIds.has(request.intentionId)) add(`${request.id} references unknown intention ${String(request.intentionId)}.`);
      if (!people.has(request.residentId)) add(`${request.id} references unknown resident ${String(request.residentId)}.`);
      if (!properties.has(request.propertyId)) add(`${request.id} references unknown property ${String(request.propertyId)}.`);
      if (!REQUEST_STATUSES.includes(request.status)) add(`${request.id} has invalid status ${String(request.status)}.`);
      if (!Array.isArray(request.authorities?.coTenants)) add(`${request.id} has malformed co-tenant authority evidence.`);
    });
    (world.places || []).filter((place) => place.kind === 'residential').forEach((property) => {
      if (!property.stewardship || property.stewardship.schema !== PROPERTY_SCHEMA) add(`${property.id} has no v0.4 property stewardship state.`);
      (property.stewardship?.requestIds || []).forEach((id) => { if (!requestIds.has(id)) add(`${property.id} references unknown stewardship request ${id}.`); });
    });
  }

  Object.assign(Systems, {
    respondToStewardshipRequest,
    prepareStewardshipExperiment,
    formHabitatIntention: formIntention
  });

  AXM.Stewardship = {
    INTENTION_SCHEMA,
    REQUEST_SCHEMA,
    PROPERTY_SCHEMA,
    INTENTION_STATUSES,
    REQUEST_STATUSES,
    TERMINAL_INTENTION,
    TERMINAL_REQUEST,
    ensureState,
    initializeWorld,
    dailyTick,
    intentionById,
    requestById,
    activeIntentionForResident,
    intentionRequest,
    intentionProject,
    formIntention,
    submitRequest,
    resolveExternalRequest,
    respondToStewardshipRequest,
    prepareStewardshipExperiment,
    metrics,
    validate,
    candidateSpecs
  };
}(typeof window !== 'undefined' ? window : globalThis));
