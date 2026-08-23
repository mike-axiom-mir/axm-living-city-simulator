(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;

  function getPlace(world, placeId) {
    return world.places.find((place) => place.id === placeId) || null;
  }

  function getProperty(world, propertyId) {
    const place = getPlace(world, propertyId);
    return place && place.kind === 'residential' ? place : null;
  }

  function getPerson(world, personId) {
    if (personId === 'player') return world.player;
    return world.people.find((person) => person.id === personId) || null;
  }

  function personName(world, personId) {
    const person = getPerson(world, personId);
    return person ? person.name : 'Unknown person';
  }

  function homeOf(world, personId) {
    const person = getPerson(world, personId);
    return person ? getProperty(world, person.homePropertyId) : null;
  }

  function paletteChoice(world) {
    return Core.choice(world, Content.PALETTE).id;
  }

  function createFurnitureInstance(world, catalogId, ownerId, options = {}) {
    const definition = Content.furnitureById(catalogId);
    if (!definition) throw new Error(`Unknown furniture definition: ${catalogId}`);
    const colorId = options.colorId || paletteChoice(world);
    const footprint = definition.footprint || [1, 1];
    const rotation = options.rotation || 0;
    return {
      id: Core.uniqueId(world, 'object'),
      catalogId,
      ownerId: ownerId || null,
      ownershipMode: options.ownershipMode || 'personal',
      acquiredDay: world.time.day,
      acquiredPrice: options.acquiredPrice == null ? definition.price : options.acquiredPrice,
      colorId,
      position: {
        x: options.x == null ? 0 : options.x,
        y: options.y == null ? 0 : options.y,
        rotation
      },
      footprint: rotation % 180 === 90 ? [footprint[1], footprint[0]] : footprint.slice(),
      condition: Core.clamp(options.condition == null ? 75 + Core.randomInt(world, 0, 25) : options.condition, 0, 100),
      sentimental: Core.clamp(options.sentimental == null ? Core.randomInt(world, 0, 12) : options.sentimental, 0, 100),
      upgrades: {
        comfort: 0,
        beauty: 0,
        utility: 0,
        durability: 0,
        efficiency: 0,
        ...(options.upgrades || {})
      },
      usageHours: options.usageHours || 0,
      history: []
    };
  }

  function footprintCells(object, x = object.position.x, y = object.position.y, footprint = object.footprint) {
    const cells = [];
    for (let dy = 0; dy < footprint[1]; dy += 1) {
      for (let dx = 0; dx < footprint[0]; dx += 1) {
        cells.push(`${x + dx},${y + dy}`);
      }
    }
    return cells;
  }

  function positionFits(property, furniture, x, y, footprint, ignoreId = null) {
    const [gridW, gridH] = property.roomGrid;
    if (x < 0 || y < 0 || x + footprint[0] > gridW || y + footprint[1] > gridH) return false;
    if (AXM.Habitats?.footprintRespectsPartitions && !AXM.Habitats.footprintRespectsPartitions(property, x, y, footprint)) return false;
    const occupied = new Set();
    furniture.forEach((object) => {
      if (object.id === ignoreId) return;
      footprintCells(object).forEach((cell) => occupied.add(cell));
    });
    return footprintCells({ position: { x, y }, footprint }, x, y, footprint).every((cell) => !occupied.has(cell));
  }

  function findOpenPosition(property, furniture, footprint, positionRule = null) {
    const [gridW, gridH] = property.roomGrid;
    for (let y = 0; y <= gridH - footprint[1]; y += 1) {
      for (let x = 0; x <= gridW - footprint[0]; x += 1) {
        const ruleAllows = !positionRule || positionRule(x, y, footprint);
        if (ruleAllows && positionFits(property, furniture, x, y, footprint)) return { x, y };
      }
    }
    return null;
  }

  function addFurnitureToProperty(world, property, object, preferredPosition = null, positionRule = null) {
    const preferredAllowed = preferredPosition
      && (!positionRule || positionRule(preferredPosition.x, preferredPosition.y, object.footprint))
      && positionFits(
        property,
        property.furniture,
        preferredPosition.x,
        preferredPosition.y,
        object.footprint
      );
    const position = preferredAllowed
      ? preferredPosition
      : findOpenPosition(property, property.furniture, object.footprint, positionRule);
    if (!position) return false;
    object.position.x = position.x;
    object.position.y = position.y;
    property.furniture.push(object);
    return true;
  }

  function createResidentialPlaces(world) {
    return Content.RESIDENTIAL_TEMPLATES.map((template) => ({
      ...Core.deepClone(template),
      kind: 'residential',
      ownerId: template.id === 'home_student' ? 'canal_student_coop' : 'town_housing_network',
      ownerLabel: template.id === 'home_student' ? 'Canal Student Co-op' : 'Town Housing Network',
      currentRent: template.rent,
      rentBasis: template.id === 'home_student' ? 'per_tenant' : 'whole_property',
      utilitiesIncluded: template.id === 'home_student',
      weeklyUtilityBase: template.id === 'home_student' ? 0 : 8 + Math.round((template.roomGrid[0] * template.roomGrid[1]) / 25),
      tenants: [],
      furniture: [],
      condition: Core.randomInt(world, 72, 96),
      maintenanceReserve: Core.randomInt(world, 250, 1100),
      listedForRent: true,
      listedForSale: Boolean(template.forSale),
      playerSetRent: null,
      lastMoveDay: 0,
      history: [],
      decorSignature: null
    }));
  }

  function createPublicPlaces() {
    return Content.PUBLIC_PLACES.map((template) => ({
      ...Core.deepClone(template),
      kind: 'public'
    }));
  }

  function buildUniqueNames(world, count) {
    const firstNames = Core.shuffled(world, Content.FIRST_NAMES);
    const lastNames = Core.shuffled(world, Content.LAST_NAMES);
    const names = [];
    for (let i = 0; i < count; i += 1) {
      names.push(`${firstNames[i % firstNames.length]} ${lastNames[(i * 3) % lastNames.length]}`);
    }
    return names;
  }

  function createNpc(world, name, index) {
    const preferredColors = Core.shuffled(world, Content.PALETTE).slice(0, 2).map((entry) => entry.id);
    const preferredStyles = Core.shuffled(world, Content.STYLES).slice(0, 2).map((entry) => entry.id);
    const preferredCategories = Core.shuffled(world, ['seat', 'sleep', 'work', 'activity', 'light', 'storage', 'surface', 'decor', 'food']).slice(0, 3);
    const traits = {
      social: Core.randomInt(world, 15, 92),
      ambition: Core.randomInt(world, 15, 92),
      neatness: Core.randomInt(world, 12, 94),
      thrift: Core.randomInt(world, 12, 94),
      creativity: Core.randomInt(world, 12, 94),
      stability: Core.randomInt(world, 12, 94),
      independence: Core.randomInt(world, 18, 96)
    };
    const skills = {
      focus: Core.randomInt(world, 5, 48),
      social: Core.randomInt(world, 5, 48),
      repair: Core.randomInt(world, 3, 42),
      creativity: Core.randomInt(world, 4, 48),
      cooking: Core.randomInt(world, 2, 38)
    };
    return {
      id: `npc_${String(index + 1).padStart(3, '0')}`,
      name,
      age: Core.randomInt(world, 19, 54),
      pronouns: Core.choice(world, ['they/them', 'she/her', 'he/him']),
      traits,
      preferences: {
        colors: preferredColors,
        styles: preferredStyles,
        categories: preferredCategories
      },
      personalGoal: Core.choice(world, Content.PERSONAL_GOALS),
      skills,
      money: Core.randomInt(world, 420, 3100),
      jobId: null,
      homePropertyId: null,
      locationId: null,
      activity: 'settling in',
      needs: {
        energy: Core.randomInt(world, 55, 90),
        hunger: Core.randomInt(world, 55, 90),
        hygiene: Core.randomInt(world, 55, 95),
        mood: Core.randomInt(world, 45, 88),
        social: Core.randomInt(world, 35, 90)
      },
      relationships: {},
      familyLinks: [],
      knownFacts: [],
      householdId: null,
      householdInitiativeCooldownUntil: 0,
      habitatIntentionCooldownUntil: 0,
      stewardshipReliability: 0,
      storedFurniture: [],
      lastMoveDay: 0,
      moveCooldownUntil: Core.randomInt(world, 7, 24),
      decorCooldownUntil: Core.randomInt(world, 1, 5),
      jobCooldownUntil: Core.randomInt(world, 18, 45),
      rentArrears: 0,
      lifetimeEarnings: 0,
      lifetimeHousingCost: 0,
      autonomousActions: 0,
      isPlayerControlled: false
    };
  }

  function assignJobs(world) {
    const counts = Object.fromEntries(Content.JOBS.map((job) => [job.id, 0]));
    const shuffledPeople = Core.shuffled(world, world.people);
    shuffledPeople.forEach((person) => {
      const candidates = Content.JOBS.filter((job) => counts[job.id] < job.slots).map((job) => {
        const primary = person.skills[job.primarySkill] || 0;
        const aspiration = person.traits.ambition * 0.12;
        const creativeFit = job.id === 'design_coop' ? person.traits.creativity * 0.12 : 0;
        const repairFit = job.id === 'repair_workshop' ? person.skills.repair * 0.25 : 0;
        const accessiblePenalty = Math.max(0, job.requirement - primary) * 1.7;
        return { job, weight: Math.max(1, 15 + primary + aspiration + creativeFit + repairFit - accessiblePenalty) };
      });
      const selected = Core.weightedChoice(world, candidates, (entry) => entry.weight).job;
      person.jobId = selected.id;
      counts[selected.id] += 1;
    });
  }

  function assignHomes(world) {
    const occupancyPlan = {
      home_student: 3,
      home_courtyard_1: 1,
      home_courtyard_2: 0,
      home_bakery_flat: 2,
      home_rooftop: 1,
      home_lane_1: 3,
      home_lane_2: 2,
      home_lane_3: 3,
      home_station_1: 2,
      home_station_2: 0,
      home_garden_1: 4,
      home_garden_2: 2,
      home_quiet_flat: 2,
      home_river_room: 0
    };

    const peoplePool = Core.shuffled(world, world.people);
    let cursor = 0;
    Object.entries(occupancyPlan).forEach(([propertyId, target]) => {
      const property = getProperty(world, propertyId);
      for (let i = 0; i < target; i += 1) {
        const person = peoplePool[cursor];
        cursor += 1;
        if (!person) break;
        property.tenants.push(person.id);
        person.homePropertyId = property.id;
        person.locationId = property.id;
      }
      property.listedForRent = property.tenants.length < property.capacity;
    });

    while (cursor < peoplePool.length) {
      const person = peoplePool[cursor];
      cursor += 1;
      const property = world.places.find((place) => place.kind === 'residential' && place.tenants.length < place.capacity);
      property.tenants.push(person.id);
      person.homePropertyId = property.id;
      person.locationId = property.id;
    }

    const student = getProperty(world, 'home_student');
    student.tenants.unshift('player');
    student.listedForRent = student.tenants.length < student.capacity;
  }

  function establishRoommateLinks(world) {
    world.places.filter((place) => place.kind === 'residential').forEach((property) => {
      const npcTenants = property.tenants.filter((id) => id !== 'player');
      for (let i = 0; i < npcTenants.length; i += 1) {
        for (let j = i + 1; j < npcTenants.length; j += 1) {
          const a = getPerson(world, npcTenants[i]);
          const b = getPerson(world, npcTenants[j]);
          const base = Core.randomInt(world, 8, 34);
          a.relationships[b.id] = { friendship: base, romance: 0, trust: base * 0.7, status: 'roommate' };
          b.relationships[a.id] = { friendship: base, romance: 0, trust: base * 0.7, status: 'roommate' };
        }
      }
    });
  }

  function seedPlayerRelationships(world) {
    const student = getProperty(world, 'home_student');
    student.tenants.filter((id) => id !== 'player').forEach((id) => {
      world.player.relationships[id] = {
        friendship: Core.randomInt(world, 6, 14),
        romance: 0,
        trust: Core.randomInt(world, 5, 12),
        status: 'roommate',
        interactions: 0,
        lastInteractionDay: 0
      };
    });
  }

  function furnitureOwnerFor(property, fallback = null) {
    const resident = property.tenants.find((id) => id !== 'player');
    return resident || fallback;
  }

  function seedPropertyFurniture(world, property) {
    const occupantCount = Math.max(1, property.tenants.length);
    const residentOwner = furnitureOwnerFor(property, property.ownerId);
    const builtIn = (catalogId, colorId = null) => createFurnitureInstance(world, catalogId, property.ownerId, {
      ownershipMode: 'property_fixture',
      colorId: colorId || Content.PALETTE.find((entry) => entry.hex.toLowerCase() === property.color.toLowerCase())?.id || paletteChoice(world),
      condition: Core.randomInt(world, 72, 96),
      sentimental: 0
    });
    const personal = (catalogId, owner = residentOwner, colorId = null) => createFurnitureInstance(world, catalogId, owner, {
      ownershipMode: owner === property.ownerId ? 'property_fixture' : 'personal',
      colorId: colorId || (owner && owner !== property.ownerId ? getPerson(world, owner)?.preferences.colors[0] : paletteChoice(world)),
      condition: Core.randomInt(world, 58, 96),
      sentimental: Core.randomInt(world, 2, 22)
    });

    addFurnitureToProperty(world, property, builtIn('basic_lamp'));
    if (property.type !== 'student_house') addFurnitureToProperty(world, property, builtIn('kitchenette'));

    const bedsToAdd = Math.min(Math.max(1, occupantCount), Math.max(1, Math.floor(property.capacity * 0.75)));
    for (let i = 0; i < bedsToAdd; i += 1) {
      const owner = property.tenants.filter((id) => id !== 'player')[i] || residentOwner;
      addFurnitureToProperty(world, property, personal(Core.chance(world, 0.24) ? 'floor_mattress' : 'simple_bed', owner));
    }

    const seatChoices = property.capacity > 2 ? ['deep_sofa', 'secondhand_chair'] : ['secondhand_chair', 'folding_chair'];
    addFurnitureToProperty(world, property, personal(Core.choice(world, seatChoices)));
    addFurnitureToProperty(world, property, personal(property.capacity > 2 ? 'family_table' : 'small_table'));

    const extraCount = Core.randomInt(world, 2, 5);
    const extras = ['crate_shelf', 'threadbare_rug', 'wall_print', 'plant', 'music_player', 'standing_lamp', 'tiny_desk'];
    for (let i = 0; i < extraCount; i += 1) {
      addFurnitureToProperty(world, property, personal(Core.choice(world, extras)));
    }
  }

  function reseedStudentRoom(world) {
    const property = getProperty(world, 'home_student');
    property.furniture = property.furniture.filter((object) => object.ownerId !== 'player');
    const playerItems = [
      createFurnitureInstance(world, 'floor_mattress', 'player', { colorId: 'charcoal', condition: 72, sentimental: 8 }),
      createFurnitureInstance(world, 'secondhand_chair', 'player', { colorId: 'clay', condition: 58, sentimental: 18 }),
      createFurnitureInstance(world, 'tiny_desk', 'player', { colorId: 'moss', condition: 68, sentimental: 7 }),
      createFurnitureInstance(world, 'old_laptop', 'player', { colorId: 'night', condition: 61, sentimental: 22 }),
      createFurnitureInstance(world, 'basic_lamp', 'player', { colorId: 'mustard', condition: 80, sentimental: 5 }),
      createFurnitureInstance(world, 'threadbare_rug', 'player', { colorId: 'plum', condition: 64, sentimental: 12 })
    ];
    playerItems.forEach((object) => addFurnitureToProperty(world, property, object));
  }

  function seedAllFurniture(world) {
    world.places.filter((place) => place.kind === 'residential').forEach((property) => seedPropertyFurniture(world, property));
    reseedStudentRoom(world);
  }

  function seedPropertyHistory(world) {
    world.places.filter((place) => place.kind === 'residential').forEach((property) => {
      const residentNames = property.tenants.map((id) => personName(world, id));
      Core.appendPropertyHistory(world, property, 'foundation', `${property.name} entered the simulation with ${residentNames.length ? residentNames.join(', ') : 'no residents'} present.`, {
        actorIds: property.tenants,
        causes: ['deterministic starting state']
      });
    });
  }

  function createPlayer() {
    return {
      id: 'player',
      name: 'Player',
      age: 21,
      money: 220,
      homePropertyId: 'home_student',
      locationId: 'home_student',
      jobId: 'corner_cafe',
      jobLevel: 1,
      jobExperience: 0,
      needs: { energy: 78, hunger: 72, hygiene: 66, mood: 64, social: 48 },
      skills: { focus: 6, social: 8, repair: 3, creativity: 7, cooking: 2 },
      materials: { wood: 2, metal: 1, fabric: 2, parts: 1, paint: 2 },
      relationships: {},
      householdId: null,
      storedFurniture: [],
      ownedPropertyIds: [],
      rentArrears: 0,
      lifetimeEarnings: 0,
      lifetimeSpend: 0,
      influenceActions: 0,
      activeObjective: 'be yourself, find your adventure, do not make others smaller, and grow in your own way',
      isPlayerControlled: true
    };
  }

  function createTutorial() {
    return {
      goals: Content.TUTORIAL_GOALS.map((goal) => ({ ...goal, progress: 0, complete: false })),
      inspectedPlaceIds: [],
      earnedAtWork: 0,
      objectUpgrades: 0,
      friendships: 0,
      homesRented: 0
    };
  }

  function createWorld(seed = 'AXM-LIVING-CITY-001') {
    const initialState = Core.hashString(seed) || 1;
    const world = {
      schema: Core.SCHEMA,
      version: Core.VERSION,
      seed: String(seed),
      rngState: initialState,
      idCounter: 0,
      time: { day: 1, hour: 7, minute: 0 },
      map: { width: 18, height: 13, tileSize: 48 },
      settings: {
        autosave: true,
        simulationSpeed: 0,
        reducedMotion: false,
        visualMotion: 'full',
        compactCards: false,
        casualRealism: true,
        noDailyStreaks: true,
        opportunityExpiryPenalty: false,
        lifeCourseMode: 'choice',
        showExactAges: false,
        agePressure: false,
        defaultTravelMode: 'compressed',
        travelCompressionAllowed: true,
        walkingObligation: false,
        defaultIndoorMovementMode: 'compressed',
        presenceCompressionAllowed: true,
        compulsoryGreetings: false,
        presenceWatchingReward: false,
        presenceSurveillance: false,
        minuteByMinutePresenceTax: false
      },
      player: createPlayer(),
      people: [],
      places: [],
      households: [],
      householdProposals: [],
      householdIssues: [],
      habitatIntentions: [],
      stewardshipRequests: [],
      familyUnits: [],
      familyProposals: [],
      careRecords: [],
      communityInstitutions: [],
      communityOpportunities: [],
      communityConnections: [],
      adventureThreads: [],
      personalProjects: [],
      localNeeds: [],
      enterprises: [],
      enterpriseSessions: [],
      enterpriseWorkOffers: [],
      travelRecords: [],
      streetMoments: [],
      streetNetwork: null,
      exteriorState: {},
      activeTravel: null,
      exteriorIdCounter: 0,
      presenceByPerson: {},
      presenceRecords: [],
      ordinaryEncounters: [],
      presenceAccessGrants: [],
      presenceState: {},
      activeIndoorMovement: null,
      presenceIdCounter: 0,
      ledger: [],
      tutorial: createTutorial(),
      metrics: {
        totalMoves: 0,
        playerMoves: 0,
        npcDecorations: 0,
        npcObjectUpgrades: 0,
        playerObjectUpgrades: 0,
        jobChanges: 0,
        relationshipsFormed: 0,
        autonomousSocialEvents: 0,
        rentPayments: 0,
        propertyPurchases: 0,
        daysObserved: 0,
        householdProposals: 0,
        householdProposalsAccepted: 0,
        householdProposalsDeclined: 0,
        householdCounteroffers: 0,
        householdAgreementsCreated: 0,
        householdRenegotiations: 0,
        householdConflicts: 0,
        householdRepairs: 0,
        householdRelocations: 0,
        householdReserveContributions: 0,
        householdSharedExpensePayments: 0,
        npcHouseholdInitiatives: 0,
        householdRenovations: 0,
        householdSeparations: 0,
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
        stewardshipMaterialResaleLoss: 0,
        communityMembershipsStarted: 0,
        communityWaitlistEntries: 0,
        communityWaitlistPromotions: 0,
        communityMembershipsLeft: 0,
        communityOpportunitiesGenerated: 0,
        communityPlayerParticipations: 0,
        communityNpcParticipations: 0,
        communityRefusals: 0,
        communityOpportunityExpiries: 0,
        communityConnectionsFormed: 0,
        communityMentorLinks: 0,
        communityVisitsCompleted: 0,
        communityInvitesSent: 0,
        communityInvitesAccepted: 0,
        communityInvitesDeclined: 0,
        adventureThreadsStarted: 0,
        adventureStagesCompleted: 0,
        adventureThreadsCompleted: 0,
        adventureThreadsReleased: 0,
        npcAdventureThreadsStarted: 0,
        npcAdventureStagesCompleted: 0,
        personalProjectsCreated: 0,
        personalProjectChaptersCompleted: 0,
        personalProjectsPaused: 0,
        personalProjectsResumed: 0,
        personalProjectsReshaped: 0,
        personalProjectsCompleted: 0,
        personalProjectsReleased: 0,
        personalProjectsArchived: 0,
        projectCollaborationInvites: 0,
        projectCollaborationsAccepted: 0,
        projectCollaborationsDeclined: 0,
        npcPersonalProjectsCreated: 0,
        npcPersonalProjectChaptersCompleted: 0,
        npcPersonalProjectsCompleted: 0,
        npcPersonalProjectsReleased: 0,
        projectMoneySpent: 0,
        projectMaterialsSpent: 0,
        lifeChapterChoices: 0,
        enterprisesCreated: 0,
        npcEnterprisesCreated: 0,
        enterprisePremisesLeased: 0,
        enterprisesPaused: 0,
        enterprisesClosed: 0,
        enterprisesPivoted: 0,
        enterpriseSessionsCompleted: 0,
        npcEnterpriseSessions: 0,
        enterpriseCustomersServed: 0,
        enterpriseRevenue: 0,
        enterpriseOperatingCosts: 0,
        enterpriseFlexibleServices: 0,
        enterpriseEquipmentRepairs: 0,
        enterpriseEquipmentUpgrades: 0,
        enterpriseExperimentRuns: 0,
        playerJourneysCompleted: 0,
        playerVisibleJourneys: 0,
        playerCompressedJourneys: 0,
        playerWalkingMinutes: 0,
        playerWalkingDistanceMeters: 0,
        npcRoutesObserved: 0,
        npcRouteDistanceMeters: 0,
        bundledRoutesRecorded: 0,
        streetMomentsObserved: 0,
        walkableExperimentRuns: 0,
        presenceSnapshotsInitialized: 0,
        indoorMovementsStarted: 0,
        indoorMovementsCompleted: 0,
        indoorVisibleMovements: 0,
        indoorCompressedMovements: 0,
        indoorScheduleMovements: 0,
        indoorMovementMinutes: 0,
        indoorStairUses: 0,
        lawfulArrivals: 0,
        lawfulDepartures: 0,
        roomTransitions: 0,
        accessGrantsCreated: 0,
        accessDenials: 0,
        encountersOffered: 0,
        encountersGreeted: 0,
        encountersQuiet: 0,
        encountersDeclined: 0,
        encountersPassed: 0,
        privacyCoarsenings: 0,
        presenceExperimentRuns: 0
      },
      activeShift: null,
      activeEnterpriseSessionId: null,
      ui: {
        activeTab: 'visuals',
        selectedPlaceId: 'home_student',
        viewPropertyId: 'home_student',
        selectedPersonId: null,
        selectedObjectId: null,
        selectedUpgradeAxis: 'comfort',
        selectedSuggestionColor: 'moss',
        selectedHouseholdId: null,
        selectedProposalId: null,
        selectedIssueId: null,
        selectedFamilyUnitId: null,
        selectedFamilyProposalId: null,
        selectedDependentId: null,
        selectedCommunityInstitutionId: null,
        selectedCommunityOpportunityId: null,
        selectedCommunityConnectionId: null,
        selectedAdventureId: null,
        selectedPersonalProjectId: null,
        selectedEnterpriseId: null,
        selectedCommercialPremiseId: null,
        selectedStreetMomentId: null,
        streetRouteDestinationId: 'place_market',
        selectedPresenceBuildingId: null,
        selectedPresencePlaceId: null,
        selectedEncounterId: null,
        visualSceneMode: 'room',
        selectedVisualRoomId: null,
        selectedVisualObjectId: null,
        pendingVisualActivity: null,
        lastVisualActivityReceipt: null,
        ledgerFilter: 'all',
        toast: null,
        modal: null,
        lastRenderReason: 'new-world'
      },
      flags: {
        developerGrantUsed: false,
        firstFriendLogged: false,
        firstUpgradeLogged: false,
        firstMoveLogged: false,
        householdExperimentPrepared: false,
        stewardshipExperimentPrepared: false,
        familyExperimentPrepared: false,
        communityExperimentPrepared: false,
        communityFoundationLogged: false,
        personalDirectionsExperimentPrepared: false,
        personalDirectionsFoundationLogged: false,
        enterpriseExperimentPrepared: false,
        enterpriseFoundationLogged: false,
        enterpriseSeeded: false,
        exteriorFoundationLogged: false,
        walkableExperimentPrepared: false,
        shellFoundationLogged: false,
        shellExperimentPrepared: false,
        presenceFoundationLogged: false,
        presenceExperimentPrepared: false
      }
    };

    world.places = createResidentialPlaces(world).concat(createPublicPlaces());
    const names = buildUniqueNames(world, 23);
    world.people = names.map((name, index) => createNpc(world, name, index));
    assignJobs(world);
    assignHomes(world);
    establishRoommateLinks(world);
    seedPlayerRelationships(world);
    seedAllFurniture(world);
    seedPropertyHistory(world);
    AXM.Habitats?.initializeWorld(world, { silent: true });
    AXM.Stewardship?.initializeWorld(world, { silent: true });
    AXM.Family?.initializeWorld(world, { silent: true });
    AXM.Community?.initializeWorld(world, { silent: true, newWorld: true });
    AXM.Directions?.initializeWorld(world, { silent: true, newWorld: true });
    AXM.Economy?.initializeWorld(world, { silent: true, newWorld: true });
    AXM.Exteriors?.initializeWorld(world, { silent: true, newWorld: true });
    AXM.Shells?.initializeWorld(world, { silent: true, newWorld: true });
    AXM.Presence?.initializeWorld(world, { silent: true, newWorld: true });

    Core.appendLedger(world, 'foundation', 'The living city began from a reproducible seed. Buildings are occupied by residents rather than waiting as player menu slots.', {
      causes: [`seed:${world.seed}`],
      evidence: { residents: world.people.length + 1, residentialProperties: Content.RESIDENTIAL_TEMPLATES.length }
    });
    Core.appendLedger(world, 'player', 'You begin in one room of the Canal Student House with a shared bathroom, a part-time job, and no direct control over anyone else.', {
      actorIds: ['player'], placeId: 'home_student', causes: ['single-life starting rule']
    });

    return world;
  }

  AXM.World = {
    createWorld,
    getPlace,
    getProperty,
    getPerson,
    personName,
    homeOf,
    createFurnitureInstance,
    footprintCells,
    positionFits,
    findOpenPosition,
    addFurnitureToProperty
  };
}(typeof window !== 'undefined' ? window : globalThis));
