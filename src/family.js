(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Systems = AXM.Systems;

  const LIFE_COURSE_SCHEMA = 'axm.living-city.life-course/v0.5.0';
  const FAMILY_UNIT_SCHEMA = 'axm.living-city.family-unit/v0.5.0';
  const FAMILY_PROPOSAL_SCHEMA = 'axm.living-city.family-proposal/v0.5.0';
  const CARE_RECORD_SCHEMA = 'axm.living-city.care-record/v0.5.0';

  const FAMILY_PROPOSAL_TYPES = ['parenthood', 'care_plan', 'education_plan', 'room_plan', 'family_ritual'];
  const FAMILY_PROPOSAL_STATUSES = ['pending_npc', 'awaiting_player', 'accepted', 'declined', 'withdrawn', 'expired', 'waiting_space', 'implemented'];
  const FAMILY_UNIT_STATUSES = ['active', 'continuing_separately', 'ended'];
  const MEMBER_ROLES = ['adult_guardian', 'adult_partner', 'dependent', 'adult_child'];
  const ROOM_KINDS = ['dependent_private', 'dependent_shared', 'family_common'];
  const CARE_MODES = ['balanced', 'player_leads', 'partner_leads', 'flexible'];
  const EDUCATION_MODES = ['neighborhood_learning', 'home_project_mix', 'practical_apprenticeship'];
  const ARRIVAL_PATHS = ['new_child', 'adoption', 'kinship_care'];
  const DEVELOPMENT_DOMAINS = ['security', 'curiosity', 'social', 'practical', 'creativity', 'independence'];
  const DEPENDENT_STAGES = ['infant', 'toddler', 'child', 'teen'];
  const LIFE_COURSE_MODES = ['choice', 'calendar'];
  const LIFE_STAGE_ORDER = ['infant', 'toddler', 'child', 'teen', 'young_adult', 'adult', 'elder'];

  const STAGE_RULES = {
    infant: { minAge: 0, maxAge: 1, careHours: 8, schoolHours: 0, weeklyCost: 72, energyDrain: 10 },
    toddler: { minAge: 2, maxAge: 4, careHours: 6, schoolHours: 2, weeklyCost: 62, energyDrain: 8 },
    child: { minAge: 5, maxAge: 12, careHours: 3.5, schoolHours: 6, weeklyCost: 48, energyDrain: 5 },
    teen: { minAge: 13, maxAge: 17, careHours: 2, schoolHours: 6, weeklyCost: 58, energyDrain: 3 },
    young_adult: { minAge: 18, maxAge: 24, careHours: 0, schoolHours: 0, weeklyCost: 0, energyDrain: 0 },
    adult: { minAge: 25, maxAge: 64, careHours: 0, schoolHours: 0, weeklyCost: 0, energyDrain: 0 },
    elder: { minAge: 65, maxAge: 200, careHours: 0, schoolHours: 0, weeklyCost: 0, energyDrain: 0 }
  };

  const CARE_ACTIONS = {
    share_meal: {
      name: 'Share a meal', hours: 1, cost: 8, energy: 3,
      domains: { security: 1.2, social: 0.8, practical: 0.25 },
      needEffects: { hunger: 32, social: 8, mood: 5 },
      note: 'A reliable meal supports security without deciding who the child must become.'
    },
    read_create: {
      name: 'Read or create together', hours: 2, cost: 3, energy: 5,
      domains: { curiosity: 1.1, creativity: 1.4, security: 0.25 },
      needEffects: { social: 7, mood: 8, energy: -2 },
      note: 'The activity can follow the child’s interests rather than a fixed optimization path.'
    },
    practical_teaching: {
      name: 'Teach something practical', hours: 2, cost: 4, energy: 6,
      domains: { practical: 1.5, independence: 0.8, security: 0.2 },
      needEffects: { mood: 4, social: 4, energy: -3 },
      note: 'Teaching influences capability; it does not queue commands for the child.'
    },
    listen_check_in: {
      name: 'Listen and check in', hours: 1, cost: 0, energy: 3,
      domains: { security: 1.4, social: 0.7, independence: 0.25 },
      needEffects: { mood: 9, social: 8 },
      note: 'Listening is useful even when no visible problem is solved.'
    },
    boundary_conversation: {
      name: 'Boundary conversation', hours: 1, cost: 0, energy: 4,
      domains: { security: 0.7, independence: 1.1, practical: 0.35 },
      needEffects: { mood: 2, social: 3 },
      note: 'Boundaries are recorded as care and clarity, not domination.'
    },
    neighborhood_outing: {
      name: 'Neighborhood outing', hours: 3, cost: 12, energy: 7,
      domains: { curiosity: 1, social: 1.2, independence: 0.55 },
      needEffects: { mood: 12, social: 10, energy: -5, hunger: -4 },
      note: 'The living city becomes part of development instead of a decorative backdrop.'
    },
    support_rest: {
      name: 'Protect rest and recovery', hours: 1, cost: 2, energy: 2,
      domains: { security: 1.1, practical: 0.25 },
      needEffects: { energy: 18, mood: 5, hygiene: 3 },
      note: 'Recovery is treated as a legitimate need, not lost productivity.'
    }
  };

  function ensureArray(world, key) {
    if (!Array.isArray(world[key])) world[key] = [];
    return world[key];
  }

  function ensureMetric(world, key) {
    if (!world.metrics || typeof world.metrics !== 'object') world.metrics = {};
    if (!Number.isFinite(world.metrics[key])) world.metrics[key] = 0;
  }

  function ensureState(world) {
    if (!world.settings || typeof world.settings !== 'object') world.settings = {};
    if (!LIFE_COURSE_MODES.includes(world.settings.lifeCourseMode)) world.settings.lifeCourseMode = 'choice';
    if (typeof world.settings.showExactAges !== 'boolean') world.settings.showExactAges = false;
    world.settings.agePressure = false;
    ensureArray(world, 'familyUnits');
    ensureArray(world, 'familyProposals');
    ensureArray(world, 'careRecords');
    [
      'familyProposalsCreated', 'familyProposalsAccepted', 'familyProposalsDeclined',
      'familyUnitsCreated', 'dependentsWelcomed', 'careActions', 'careHoursPlayer',
      'careHoursPartner', 'careHoursCommunity', 'careNeedsMetDays', 'careStrainDays',
      'educationDays', 'familyRelocations', 'familySeparations', 'lifeStageTransitions',
      'adultChildrenLaunched', 'familySupportSpend', 'familyEnvironmentUpdates'
    ].forEach((key) => ensureMetric(world, key));
    if (!world.ui || typeof world.ui !== 'object') world.ui = {};
    if (world.ui.selectedFamilyUnitId === undefined) world.ui.selectedFamilyUnitId = null;
    if (world.ui.selectedFamilyProposalId === undefined) world.ui.selectedFamilyProposalId = null;
    if (world.ui.selectedDependentId === undefined) world.ui.selectedDependentId = null;
    if (!world.flags || typeof world.flags !== 'object') world.flags = {};
    if (world.flags.familyExperimentPrepared === undefined) world.flags.familyExperimentPrepared = false;
    ensureLifeCourse(world, world.player, { migrated: true });
    (world.people || []).forEach((person) => ensureLifeCourse(world, person, { migrated: true }));
    return world;
  }

  function stageForAge(ageYears) {
    const age = Math.max(0, Core.safeNumber(ageYears, 0));
    if (age < 2) return 'infant';
    if (age < 5) return 'toddler';
    if (age < 13) return 'child';
    if (age < 18) return 'teen';
    if (age < 25) return 'young_adult';
    if (age < 65) return 'adult';
    return 'elder';
  }

  function ensureLifeCourse(world, person, options = {}) {
    if (!person) return null;
    if (!world.settings || typeof world.settings !== 'object') world.settings = {};
    if (!LIFE_COURSE_MODES.includes(world.settings.lifeCourseMode)) world.settings.lifeCourseMode = 'choice';
    if (typeof world.settings.showExactAges !== 'boolean') world.settings.showExactAges = false;
    world.settings.agePressure = false;
    const age = Math.max(0, Math.floor(Core.safeNumber(person.age, 0)));
    if (!person.lifeCourse || person.lifeCourse.schema !== LIFE_COURSE_SCHEMA) {
      const offset = Core.hashString(`${world.seed}|${person.id}|birthday-offset`) % 365;
      person.lifeCourse = {
        schema: LIFE_COURSE_SCHEMA,
        ageDays: age * 365 + offset,
        ageYears: age,
        stage: stageForAge(age),
        birthdayOffset: offset,
        stageEnteredDay: world.time?.day || 1,
        chapterDays: 0,
        mode: world.settings.lifeCourseMode,
        agePressure: false,
        exactAgeVisible: world.settings.showExactAges,
        transitionHistory: [],
        chapterChoiceHistory: [],
        provenance: options.migrated
          ? 'existing life context preserved; v0.7 does not invent elapsed years or force a new chapter'
          : 'created in v0.5 and governed by the v0.7 choice-first life-course root'
      };
    }
    const life = person.lifeCourse;
    if (!Number.isFinite(life.birthdayOffset)) life.birthdayOffset = Core.hashString(`${world.seed}|${person.id}|birthday-offset`) % 365;
    if (!Number.isFinite(life.ageDays)) life.ageDays = age * 365 + life.birthdayOffset;
    if (!Number.isFinite(life.ageYears)) life.ageYears = Math.floor(life.ageDays / 365);
    if (!LIFE_STAGE_ORDER.includes(life.stage)) life.stage = stageForAge(life.ageYears);
    if (!Number.isFinite(life.stageEnteredDay)) life.stageEnteredDay = world.time?.day || 1;
    if (!Number.isFinite(life.chapterDays)) life.chapterDays = 0;
    if (!Array.isArray(life.transitionHistory)) life.transitionHistory = [];
    if (!Array.isArray(life.chapterChoiceHistory)) life.chapterChoiceHistory = [];
    life.mode = world.settings.lifeCourseMode;
    life.agePressure = false;
    life.exactAgeVisible = world.settings.showExactAges;

    if (world.settings.lifeCourseMode === 'calendar') {
      life.ageYears = Math.floor(life.ageDays / 365);
      person.age = life.ageYears;
      life.stage = stageForAge(life.ageYears);
    } else {
      // Compatibility age remains stable context. It is not advanced by the
      // simulation clock and does not decide the current chapter.
      person.age = Math.max(0, Math.floor(Core.safeNumber(life.ageYears, age)));
    }
    if (person.familyUnitId === undefined) person.familyUnitId = null;
    return life;
  }

  function isDependent(personOrId, world = null) {
    const person = typeof personOrId === 'string' ? World.getPerson(world, personOrId) : personOrId;
    if (!person) return false;
    const stage = person.lifeCourse?.stage || stageForAge(person.age);
    return person.dependent === true || DEPENDENT_STAGES.includes(stage);
  }

  function isFinancialDependent(world, personId) {
    const person = World.getPerson(world, personId);
    return Boolean(person && isDependent(person));
  }

  function familyUnitById(world, id) {
    return ensureArray(world, 'familyUnits').find((unit) => unit.id === id) || null;
  }

  function familyProposalById(world, id) {
    return ensureArray(world, 'familyProposals').find((proposal) => proposal.id === id) || null;
  }

  function playerFamily(world) {
    ensureState(world);
    const direct = world.player.familyUnitId ? familyUnitById(world, world.player.familyUnitId) : null;
    if (direct && direct.status !== 'ended') return direct;
    return world.familyUnits.find((unit) => unit.status !== 'ended' && unit.members.some((member) => member.personId === 'player' && !member.leftDay)) || null;
  }

  function unitMembers(world, unit) {
    return (unit?.members || []).map((member) => ({ ...member, person: World.getPerson(world, member.personId) })).filter((entry) => entry.person);
  }

  function dependentMembers(world, unit) {
    return unitMembers(world, unit).filter((entry) => ['dependent'].includes(entry.role) || isDependent(entry.person));
  }

  function adultMembers(world, unit) {
    return unitMembers(world, unit).filter((entry) => ['adult_guardian', 'adult_partner', 'adult_child'].includes(entry.role) && !isDependent(entry.person));
  }

  function partnerForUnit(world, unit) {
    const household = unit?.linkedHouseholdId ? AXM.Households?.householdById(world, unit.linkedHouseholdId) : null;
    const partnerId = household ? AXM.Households.partnerIdFor(household) : unit?.members.find((member) => member.role === 'adult_partner' && !member.leftDay)?.personId;
    return partnerId ? World.getPerson(world, partnerId) : null;
  }

  function appendUnitHistory(world, unit, type, message, details = {}) {
    if (!Array.isArray(unit.history)) unit.history = [];
    const entry = {
      id: Core.uniqueId(world, 'family_event'),
      day: world.time.day,
      hour: world.time.hour,
      type,
      message,
      actorIds: Array.isArray(details.actorIds) ? details.actorIds.slice() : [],
      personId: details.personId || null,
      proposalId: details.proposalId || null,
      propertyId: details.propertyId || unit.homePropertyId || null,
      causes: Array.isArray(details.causes) ? details.causes.slice() : [],
      evidence: details.evidence || null
    };
    unit.history.push(entry);
    if (unit.history.length > 500) unit.history.splice(0, unit.history.length - 500);
    return entry;
  }

  function appendProposalHistory(world, proposal, type, message, details = {}) {
    if (!Array.isArray(proposal.history)) proposal.history = [];
    const entry = {
      id: Core.uniqueId(world, 'family_proposal_event'),
      day: world.time.day,
      hour: world.time.hour,
      type,
      message,
      actorId: details.actorId || null,
      causes: Array.isArray(details.causes) ? details.causes.slice() : [],
      evidence: details.evidence || null
    };
    proposal.history.push(entry);
    return entry;
  }

  function relationBetweenPlayerAnd(world, person) {
    const relation = Systems.getRelation(world.player, person.id, { status: isDependent(person) ? 'family' : 'stranger' });
    if (isDependent(person) && ['stranger', 'acquaintance', 'friend'].includes(relation.status)) relation.status = 'family';
    return relation;
  }

  function ensureReverseFamilyRelation(world, person) {
    const reverse = Systems.getRelation(person, 'player', { status: 'family' });
    reverse.status = 'family';
    return reverse;
  }

  function createFamilyUnit(world, household, options = {}) {
    ensureState(world);
    const existing = world.familyUnits.find((unit) => unit.status !== 'ended' && unit.linkedHouseholdId === household.id);
    if (existing) return existing;
    const partnerId = AXM.Households.partnerIdFor(household);
    const unit = {
      id: Core.uniqueId(world, 'family'),
      schema: FAMILY_UNIT_SCHEMA,
      status: 'active',
      linkedHouseholdId: household.id,
      homePropertyId: household.homePropertyId || null,
      createdDay: world.time.day,
      createdHour: world.time.hour,
      revision: 1,
      members: [
        { personId: 'player', role: 'adult_guardian', joinedDay: world.time.day, leftDay: null, agency: 'self-directed' },
        { personId: partnerId, role: 'adult_partner', joinedDay: world.time.day, leftDay: null, agency: 'self-directed' }
      ],
      carePlan: {
        mode: options.careMode || 'balanced',
        playerTargetHours: 2,
        partnerTargetHours: 2,
        communitySupportAllowed: true,
        weeklyBudget: 55,
        educationMode: 'neighborhood_learning',
        lastAcceptedProposalId: options.proposalId || null
      },
      pendingArrival: null,
      pressure: {
        rollingUnmetHours: 0,
        consecutiveStrainDays: 0,
        lastDayRequired: 0,
        lastDayProvided: 0,
        lastDayCost: 0,
        lastReviewDay: world.time.day
      },
      roomAssignments: [],
      separation: null,
      history: []
    };
    world.familyUnits.push(unit);
    world.player.familyUnitId = unit.id;
    const partner = World.getPerson(world, partnerId);
    if (partner) partner.familyUnitId = unit.id;
    world.metrics.familyUnitsCreated += 1;
    const familyHome = World.getProperty(world, unit.homePropertyId);
    if (familyHome) {
      familyHome.listedForRent = false;
      Core.appendPropertyHistory(world, familyHome, 'family_capacity_boundary', 'The accepted family plan closed spare household capacity to unrelated automatic move-ins. Reopening a room requires a later explicit housing choice.', {
        actorIds: ['player', partnerId], causes: ['accepted family plan', 'home capacity is not an automatic public listing']
      });
    }
    appendUnitHistory(world, unit, 'created', `${world.player.name} and ${partner?.name || 'their partner'} created a family-continuity agreement without transferring control over either adult.`, {
      actorIds: ['player', partnerId], proposalId: options.proposalId || null,
      causes: ['accepted adult agreement', 'separate family graph', 'no household ownership']
    });
    return unit;
  }

  function householdReadyForParenthood(world) {
    const household = AXM.Households?.playerHousehold(world);
    if (!household || household.status !== 'active') return { ok: false, reason: 'An active adult household agreement is required first.' };
    if (!AXM.Households.isCohabiting(world, household)) return { ok: false, reason: 'The adults need an accepted shared-home agreement before a dependent can join the home.' };
    const partner = AXM.Households.partnerFor(world, household);
    if (!partner) return { ok: false, reason: 'The autonomous partner is unavailable.' };
    const home = World.getProperty(world, household.homePropertyId);
    if (!home) return { ok: false, reason: 'The shared home is unavailable.' };
    return { ok: true, household, partner, home };
  }

  function createFamilyProposal(world, type, proposerId, recipientIds, terms, options = {}) {
    ensureState(world);
    if (!FAMILY_PROPOSAL_TYPES.includes(type)) return { ok: false, reason: 'Unknown family proposal type.' };
    const proposal = {
      id: Core.uniqueId(world, 'family_proposal'),
      schema: FAMILY_PROPOSAL_SCHEMA,
      type,
      status: options.status || (proposerId === 'player' ? 'pending_npc' : 'awaiting_player'),
      proposerId,
      recipientIds: recipientIds.slice(),
      familyUnitId: options.familyUnitId || null,
      householdId: options.householdId || null,
      createdDay: world.time.day,
      createdHour: world.time.hour,
      dueDay: options.dueDay == null ? world.time.day + 1 : options.dueDay,
      expiresDay: options.expiresDay == null ? world.time.day + 14 : options.expiresDay,
      terms: Core.deepClone(terms),
      response: null,
      history: []
    };
    world.familyProposals.push(proposal);
    world.metrics.familyProposalsCreated += 1;
    const proposerName = proposerId === 'system' ? 'The family continuity system' : World.personName(world, proposerId);
    appendProposalHistory(world, proposal, 'created', `${proposerName} opened a ${Core.titleCase(type)} conversation.`, {
      actorId: proposerId,
      causes: ['explicit proposal', 'no implied consent'],
      evidence: { terms: Core.deepClone(terms) }
    });
    Core.appendLedger(world, 'family', `${proposerName} opened a ${Core.titleCase(type)} proposal. No family state changed yet.`, {
      actorIds: [proposerId].concat(recipientIds), causes: ['proposal is not consent'], evidence: { proposalId: proposal.id, type }
    });
    return { ok: true, proposal };
  }

  function proposeParenthood(world, options = {}) {
    const ready = householdReadyForParenthood(world);
    if (!ready.ok) return ready;
    const existing = world.familyProposals?.find((proposal) => proposal.type === 'parenthood' && ['pending_npc', 'awaiting_player', 'accepted', 'waiting_space'].includes(proposal.status));
    if (existing) return { ok: false, reason: 'A parenthood plan is already open.' };
    const path = ARRIVAL_PATHS.includes(options.path) ? options.path : 'new_child';
    const careMode = CARE_MODES.includes(options.careMode) ? options.careMode : 'balanced';
    const educationMode = EDUCATION_MODES.includes(options.educationMode) ? options.educationMode : 'neighborhood_learning';
    const terms = {
      path,
      careMode,
      educationMode,
      preferredStage: options.preferredStage || (path === 'new_child' ? 'infant' : 'child'),
      preparationDays: Core.clamp(Math.floor(Core.safeNumber(options.preparationDays, path === 'new_child' ? 30 : 14)), 2, 120),
      playerCommitmentHours: Core.clamp(Core.safeNumber(options.playerCommitmentHours, 2), 0.5, 8),
      partnerCommitmentHours: Core.clamp(Core.safeNumber(options.partnerCommitmentHours, 2), 0.5, 8),
      weeklyBudget: Core.clamp(Core.safeNumber(options.weeklyBudget, 55), 10, 250),
      explicitBoundary: 'dependent remains autonomous; care influences rather than controls'
    };
    const actionCrossesDay = world.time.hour + 1 >= 24;
    const result = createFamilyProposal(world, 'parenthood', 'player', [ready.partner.id], terms, {
      householdId: ready.household.id,
      dueDay: world.time.day + 1 + (actionCrossesDay ? 1 : 0) + (Core.hashString(`${world.seed}|${ready.partner.id}|parenthood-delay|${world.time.day}`) % 3)
    });
    if (!result.ok) return result;
    Systems.advanceHours(world, 1);
    Systems.toast(world, `Parenthood proposal sent to ${ready.partner.name}. Their answer will be autonomous.`, 'info');
    return result;
  }

  function parenthoodScore(world, proposal) {
    const household = AXM.Households?.householdById(world, proposal.householdId);
    const partner = World.getPerson(world, proposal.recipientIds[0]);
    const relation = partner ? world.player.relationships[partner.id] || {} : {};
    const home = household ? World.getProperty(world, household.homePropertyId) : null;
    const space = home ? (home.capacity - home.tenants.length) * 12 : -30;
    const financial = Core.clamp(((world.player.money + (partner?.money || 0)) - 1200) / 80, -20, 25);
    const relational = Core.safeNumber(relation.trust, 0) * 0.35 + Core.safeNumber(relation.friendship, 0) * 0.22 + Core.safeNumber(relation.romance, 0) * 0.15;
    const values = partner ? partner.traits.stability * 0.18 + (100 - partner.traits.independence) * 0.08 + partner.traits.social * 0.05 : 0;
    const careFit = proposal.terms.careMode === 'partner_leads' && partner ? -partner.traits.independence * 0.12 : 0;
    return Core.round(20 + relational + values + financial + space + careFit, 1);
  }

  function implementAcceptedParenthood(world, proposal) {
    const household = AXM.Households?.householdById(world, proposal.householdId);
    if (!household || household.status !== 'active') return { ok: false, reason: 'The adult household agreement no longer exists.' };
    const unit = createFamilyUnit(world, household, {
      careMode: proposal.terms.careMode,
      proposalId: proposal.id
    });
    unit.carePlan.mode = proposal.terms.careMode;
    unit.carePlan.playerTargetHours = proposal.terms.playerCommitmentHours;
    unit.carePlan.partnerTargetHours = proposal.terms.partnerCommitmentHours;
    unit.carePlan.weeklyBudget = proposal.terms.weeklyBudget;
    unit.carePlan.educationMode = proposal.terms.educationMode;
    unit.carePlan.lastAcceptedProposalId = proposal.id;
    unit.pendingArrival = {
      proposalId: proposal.id,
      path: proposal.terms.path,
      preferredStage: proposal.terms.preferredStage,
      readyDay: world.time.day + proposal.terms.preparationDays,
      status: 'preparing',
      waitingReason: null,
      createdDay: world.time.day
    };
    proposal.familyUnitId = unit.id;
    proposal.status = 'accepted';
    proposal.response = {
      decision: 'accepted',
      day: world.time.day,
      hour: world.time.hour,
      evidence: { score: parenthoodScore(world, proposal), preparationDays: proposal.terms.preparationDays }
    };
    world.metrics.familyProposalsAccepted += 1;
    appendProposalHistory(world, proposal, 'accepted', `${World.personName(world, proposal.recipientIds[0])} accepted the plan. Preparation begins; no child is created by the answer itself.`, {
      actorId: proposal.recipientIds[0], causes: ['autonomous acceptance', 'accepted plan still requires preparation']
    });
    appendUnitHistory(world, unit, 'arrival_preparation', 'The adults began a visible preparation phase for a possible dependent arrival.', {
      actorIds: ['player', proposal.recipientIds[0]], proposalId: proposal.id,
      causes: ['accepted parenthood proposal', 'no instant family-member creation'], evidence: Core.deepClone(unit.pendingArrival)
    });
    return { ok: true, unit };
  }

  function resolveParenthoodProposal(world, proposal) {
    if (proposal.status !== 'pending_npc' || world.time.day < proposal.dueDay) return null;
    const partner = World.getPerson(world, proposal.recipientIds[0]);
    const score = parenthoodScore(world, proposal);
    const roll = Core.hashString(`${world.seed}|${proposal.id}|parenthood-response`) % 101;
    if (score >= roll) return implementAcceptedParenthood(world, proposal);
    proposal.status = 'declined';
    proposal.response = { decision: 'declined', day: world.time.day, hour: world.time.hour, evidence: { score, roll } };
    world.metrics.familyProposalsDeclined += 1;
    appendProposalHistory(world, proposal, 'declined', `${partner?.name || 'The partner'} declined the parenthood plan. The refusal changes no hidden relationship value.`, {
      actorId: partner?.id || null, causes: ['autonomous refusal', 'no hidden punishment'], evidence: { score, roll }
    });
    Core.appendLedger(world, 'family', `${partner?.name || 'Your partner'} declined the parenthood proposal. The adult relationship remains otherwise unchanged.`, {
      actorIds: ['player', partner?.id].filter(Boolean), causes: ['family proposal refusal respected'], evidence: { proposalId: proposal.id, score, roll }
    });
    return { ok: true, accepted: false };
  }

  function createDevelopment(seedText) {
    const result = {};
    DEVELOPMENT_DOMAINS.forEach((domain, index) => {
      result[domain] = 18 + (Core.hashString(`${seedText}|${domain}|${index}`) % 23);
    });
    return result;
  }

  function dependentName(world, familyUnit, stage) {
    const used = new Set([world.player.name].concat(world.people.map((person) => person.name)));
    const names = Content.FIRST_NAMES.slice();
    const start = Core.hashString(`${world.seed}|${familyUnit.id}|${stage}|dependent-name`) % names.length;
    for (let offset = 0; offset < names.length; offset += 1) {
      const first = names[(start + offset) % names.length];
      const partner = partnerForUnit(world, familyUnit);
      const last = (partner?.name || world.player.name).split(/\s+/).slice(-1)[0];
      const full = `${first} ${last}`;
      if (!used.has(full)) return full;
    }
    return `Resident ${world.people.length + 1}`;
  }

  function ageForPreferredStage(stage, world, unit) {
    const deterministic = Core.hashString(`${world.seed}|${unit.id}|arrival-age`) % 3;
    if (stage === 'infant') return 0;
    if (stage === 'toddler') return 2 + deterministic;
    if (stage === 'teen') return 13 + deterministic * 2;
    return 6 + deterministic * 2;
  }

  function createDependentPerson(world, unit, options = {}) {
    const preferredStage = DEPENDENT_STAGES.includes(options.stage) ? options.stage : 'child';
    const age = Number.isFinite(options.age) ? Math.max(0, Math.floor(options.age)) : ageForPreferredStage(preferredStage, world, unit);
    const id = Core.uniqueId(world, 'dependent');
    const name = options.name || dependentName(world, unit, preferredStage);
    const colors = Core.shuffled(world, Content.PALETTE).slice(0, 2).map((entry) => entry.id);
    const styles = Core.shuffled(world, Content.STYLES).slice(0, 2).map((entry) => entry.id);
    const categories = Core.shuffled(world, ['sleep', 'activity', 'decor', 'storage', 'work', 'seat']).slice(0, 3);
    const person = {
      id,
      name,
      age,
      pronouns: options.pronouns || Core.choice(world, ['they/them', 'she/her', 'he/him']),
      traits: {
        social: Core.randomInt(world, 20, 90),
        ambition: Core.randomInt(world, 10, 78),
        neatness: Core.randomInt(world, 12, 88),
        thrift: Core.randomInt(world, 10, 85),
        creativity: Core.randomInt(world, 18, 96),
        stability: Core.randomInt(world, 18, 92),
        independence: Core.randomInt(world, 8, preferredStage === 'teen' ? 92 : 65)
      },
      preferences: { colors, styles, categories },
      personalGoal: preferredStage === 'teen' ? 'discover a direction that feels personally chosen' : 'explore the world safely without becoming a copy of either adult',
      skills: { focus: 5, social: 8, repair: 0, creativity: 8, cooking: 0 },
      development: createDevelopment(`${world.seed}|${id}`),
      money: preferredStage === 'teen' ? Core.randomInt(world, 20, 120) : 0,
      jobId: null,
      homePropertyId: unit.homePropertyId,
      locationId: unit.homePropertyId,
      activity: 'joining the household as an autonomous person',
      needs: { energy: 82, hunger: 78, hygiene: 78, mood: 72, social: 70 },
      relationships: {},
      familyLinks: unit.members.map((member) => ({ personId: member.personId, kind: 'guardian', establishedDay: world.time.day })),
      knownFacts: ['personalGoal', 'preferences'],
      householdId: null,
      familyUnitId: unit.id,
      dependent: true,
      careAutonomy: {
        lastChoiceDay: 0,
        preferredActivities: Core.shuffled(world, Object.keys(CARE_ACTIONS)).slice(0, 3),
        refusedActivities: [],
        voiceNotes: []
      },
      education: {
        mode: unit.carePlan.educationMode,
        progress: 0,
        attendanceDays: 0,
        missedDays: 0,
        currentFocus: Core.choice(world, ['stories', 'numbers', 'making', 'nature', 'people', 'movement']),
        history: []
      },
      storedFurniture: [],
      lastMoveDay: world.time.day,
      moveCooldownUntil: Number.MAX_SAFE_INTEGER,
      decorCooldownUntil: Number.MAX_SAFE_INTEGER,
      jobCooldownUntil: Number.MAX_SAFE_INTEGER,
      householdInitiativeCooldownUntil: Number.MAX_SAFE_INTEGER,
      habitatIntentionCooldownUntil: Number.MAX_SAFE_INTEGER,
      stewardshipReliability: 0,
      personalProjectIds: [],
      personalProjectCooldownUntil: 0,
      enterpriseIds: [],
      enterpriseCooldownUntil: 0,
      rentArrears: 0,
      lifetimeEarnings: 0,
      lifetimeHousingCost: 0,
      autonomousActions: 0,
      isPlayerControlled: false
    };
    ensureLifeCourse(world, person, { migrated: false });
    person.lifeCourse.ageDays = age * 365 + (Core.hashString(`${world.seed}|${id}|birth-offset`) % 365);
    person.lifeCourse.ageYears = age;
    person.lifeCourse.stage = stageForAge(age);
    person.age = age;
    return person;
  }

  function preferredDependentRoom(world, unit, person) {
    const property = World.getProperty(world, unit.homePropertyId);
    if (!property?.habitat?.rooms?.length) return null;
    const rooms = property.habitat.rooms.filter((room) => room.purpose !== 'bathroom' && room.purpose !== 'entry');
    const already = new Set((unit.roomAssignments || []).map((assignment) => assignment.roomId));
    const sleepOrWork = rooms.filter((room) => ['sleep', 'work', 'hobby', 'flex'].includes(room.purpose) && !already.has(room.id));
    const candidates = sleepOrWork.length ? sleepOrWork : rooms.filter((room) => !already.has(room.id));
    return candidates.sort((a, b) => a.cells.length - b.cells.length || a.id.localeCompare(b.id))[0] || rooms[0] || null;
  }

  function addDependentFurniture(world, person, property, room) {
    const starter = person.lifeCourse.stage === 'teen'
      ? ['simple_bed', 'tiny_desk', 'keepsake_chest', 'story_shelf']
      : person.lifeCourse.stage === 'infant'
        ? ['small_child_bed', 'keepsake_chest', 'basic_lamp']
        : ['small_child_bed', 'play_mat', 'story_shelf', 'keepsake_chest'];
    const added = [];
    starter.forEach((catalogId, index) => {
      if (!Content.furnitureById(catalogId)) return;
      const object = World.createFurnitureInstance(world, catalogId, person.id, {
        colorId: person.preferences.colors[index % person.preferences.colors.length],
        condition: 88,
        sentimental: 14 + index * 4
      });
      const roomRule = room
        ? (x, y, footprint) => {
            const placement = AXM.Habitats?.placementPermission(world, property, person.id, object, x, y, footprint) || { ok: true };
            if (!placement.ok) return false;
            for (let dy = 0; dy < footprint[1]; dy += 1) {
              for (let dx = 0; dx < footprint[0]; dx += 1) {
                if (AXM.Habitats.roomAtCell(property, x + dx, y + dy)?.id !== room.id) return false;
              }
            }
            return true;
          }
        : null;
      if (World.addFurnitureToProperty(world, property, object, null, roomRule)) {
        Core.appendObjectHistory(world, object, 'family_arrival', `${person.name} received this ${Content.furnitureById(catalogId).name.toLowerCase()} as their own object.`, {
          actorId: person.id, causes: ['dependent object ownership', 'identity preserved from arrival']
        });
        added.push(object.id);
      } else {
        person.storedFurniture.push(object);
      }
    });
    return added;
  }

  function welcomeDependent(world, unit, options = {}) {
    const property = World.getProperty(world, unit.homePropertyId);
    if (!property) return { ok: false, reason: 'Family home unavailable.' };
    if (property.tenants.length >= property.capacity) {
      if (unit.pendingArrival) {
        unit.pendingArrival.status = 'waiting_space';
        unit.pendingArrival.waitingReason = 'home capacity is full';
      }
      const proposal = unit.pendingArrival?.proposalId ? familyProposalById(world, unit.pendingArrival.proposalId) : null;
      if (proposal) proposal.status = 'waiting_space';
      return { ok: false, reason: 'The current home has no lawful capacity. The accepted plan remains visible while the family looks for space.' };
    }
    const person = createDependentPerson(world, unit, options);
    world.people.push(person);
    property.tenants.push(person.id);
    property.listedForRent = false;
    unit.members.push({ personId: person.id, role: 'dependent', joinedDay: world.time.day, leftDay: null, agency: 'autonomous_dependent' });
    const room = preferredDependentRoom(world, unit, person);
    if (room) {
      const assignment = {
        id: Core.uniqueId(world, 'family_room'),
        roomId: room.id,
        personId: person.id,
        kind: room.purpose === 'living' || room.purpose === 'kitchen' ? 'dependent_shared' : 'dependent_private',
        label: `${person.name}'s ${room.purpose === 'living' ? 'shared family area' : 'personal room'}`,
        createdDay: world.time.day,
        provenance: options.experiment ? 'explicit labeled experiment' : 'accepted family plan'
      };
      unit.roomAssignments.push(assignment);
      room.familyPermissionSnapshot = Core.deepClone(assignment);
      world.metrics.familyEnvironmentUpdates += 1;
    }
    const objects = addDependentFurniture(world, person, property, room);
    const relation = relationBetweenPlayerAnd(world, person);
    relation.friendship = Math.max(relation.friendship, 32);
    relation.trust = Math.max(relation.trust, 38);
    relation.romance = 0;
    relation.status = 'family';
    relation.interactions = Math.max(1, relation.interactions);
    const reverse = ensureReverseFamilyRelation(world, person);
    reverse.friendship = relation.friendship;
    reverse.trust = relation.trust;
    reverse.romance = 0;
    unit.pendingArrival = null;
    unit.revision += 1;
    world.metrics.dependentsWelcomed += 1;
    const proposal = options.proposalId ? familyProposalById(world, options.proposalId) : null;
    if (proposal) proposal.status = 'implemented';
    appendUnitHistory(world, unit, 'dependent_joined', `${person.name} joined the family as an autonomous ${Core.titleCase(person.lifeCourse.stage)}.`, {
      actorIds: adultMembers(world, unit).map((entry) => entry.person.id), personId: person.id,
      proposalId: options.proposalId || null, propertyId: property.id,
      causes: [options.experiment ? 'explicit labeled experiment' : 'completed accepted family plan', 'lawful home capacity', 'dependent remains non-playable'],
      evidence: { age: person.age, stage: person.lifeCourse.stage, roomId: room?.id || null, objectIds: objects }
    });
    Core.appendPropertyHistory(world, property, 'family_continuity', `${person.name} joined the household and received their own objects and recorded room boundary.`, {
      actorIds: adultMembers(world, unit).map((entry) => entry.person.id).concat(person.id), causes: ['family arrival', 'object ownership preserved']
    });
    Core.appendLedger(world, 'family', `${person.name} joined the living city as an autonomous family member, not a second playable avatar.`, {
      actorIds: ['player', partnerForUnit(world, unit)?.id, person.id].filter(Boolean), placeId: property.id,
      causes: ['life-course continuity', 'influence without possession'], evidence: { familyUnitId: unit.id, stage: person.lifeCourse.stage }
    });
    return { ok: true, person, room };
  }

  function careRecordForDay(world, unit, personId, create = true) {
    ensureState(world);
    let record = world.careRecords.find((entry) => entry.familyUnitId === unit.id && entry.personId === personId && entry.day === world.time.day);
    if (!record && create) {
      record = {
        id: Core.uniqueId(world, 'care'),
        schema: CARE_RECORD_SCHEMA,
        familyUnitId: unit.id,
        personId,
        day: world.time.day,
        requiredHours: STAGE_RULES[World.getPerson(world, personId)?.lifeCourse?.stage]?.careHours || 0,
        playerHours: 0,
        partnerHours: 0,
        communityHours: 0,
        cost: 0,
        actions: [],
        needsMet: null,
        environmentSupport: 0,
        strainAdded: 0,
        finalized: false
      };
      world.careRecords.push(record);
      if (world.careRecords.length > 2500) world.careRecords.splice(0, world.careRecords.length - 2500);
    }
    return record || null;
  }

  function roomAssignmentFor(world, unit, personId) {
    const property = World.getProperty(world, unit.homePropertyId);
    if (!property) return null;
    let assignment = (unit.roomAssignments || []).find((entry) => entry.personId === personId && AXM.Habitats?.roomById(property, entry.roomId));
    if (!assignment) {
      const person = World.getPerson(world, personId);
      const room = preferredDependentRoom(world, unit, person);
      if (room) {
        assignment = {
          id: Core.uniqueId(world, 'family_room'), roomId: room.id, personId,
          kind: room.purpose === 'living' ? 'dependent_shared' : 'dependent_private',
          label: `${person?.name || 'Dependent'}'s ${room.purpose === 'living' ? 'shared family area' : 'personal room'}`,
          createdDay: world.time.day,
          provenance: 'deterministic room reassignment after structural change'
        };
        unit.roomAssignments = (unit.roomAssignments || []).filter((entry) => entry.personId !== personId);
        unit.roomAssignments.push(assignment);
        room.familyPermissionSnapshot = Core.deepClone(assignment);
      }
    }
    return assignment || null;
  }

  function environmentSupport(world, unit, person) {
    const property = World.getProperty(world, person.homePropertyId);
    if (!property) return 0;
    const assignment = roomAssignmentFor(world, unit, person.id);
    const room = assignment ? AXM.Habitats?.roomById(property, assignment.roomId) : null;
    const personalObjects = property.furniture.filter((object) => object.ownerId === person.id).concat(person.storedFurniture || []);
    const categories = new Set(personalObjects.map((object) => Content.furnitureById(object.catalogId)?.category).filter(Boolean));
    const stats = personalObjects.map((object) => Core.computeObjectStats(Content.furnitureById(object.catalogId), object));
    const viability = stats.length ? Core.average(stats.map((entry) => entry.viability)) : 0;
    const privacy = assignment?.kind === 'dependent_private' ? 18 : assignment ? 8 : 0;
    const variety = Math.min(25, categories.size * 5);
    const condition = property.condition * 0.18;
    const roomFit = room && ['sleep', 'work', 'hobby', 'flex'].includes(room.purpose) ? 12 : 5;
    return Core.clamp(Core.round(privacy + variety + viability * 0.25 + condition + roomFit, 1), 0, 100);
  }

  function applyDevelopment(person, effects, multiplier = 1) {
    if (!person.development) person.development = createDevelopment(person.id);
    Object.entries(effects || {}).forEach(([domain, amount]) => {
      if (!DEVELOPMENT_DOMAINS.includes(domain)) return;
      person.development[domain] = Core.clamp(Core.round(Core.safeNumber(person.development[domain], 0) + amount * multiplier, 2), 0, 100);
    });
  }

  function actionAcceptance(world, person, actionId) {
    const stage = person.lifeCourse.stage;
    if (stage === 'infant' || stage === 'toddler') return { accepted: true, score: 100, roll: 0, reason: 'age-appropriate care is provided while signals still affect timing' };
    const relation = relationBetweenPlayerAnd(world, person);
    const preferred = person.careAutonomy?.preferredActivities?.includes(actionId) ? 22 : 0;
    const repeated = person.careAutonomy?.refusedActivities?.filter((entry) => entry.actionId === actionId && world.time.day - entry.day < 7).length || 0;
    const score = 35 + relation.trust * 0.32 + relation.friendship * 0.2 + preferred + person.needs.mood * 0.1 - repeated * 8 + (actionId === 'listen_check_in' ? 10 : 0);
    const roll = Core.hashString(`${world.seed}|${world.time.day}|${world.time.hour}|${person.id}|${actionId}|care-choice`) % 101;
    return { accepted: score >= roll, score: Core.round(score, 1), roll };
  }

  function performCareAction(world, personId, actionId) {
    ensureState(world);
    if (world.activeShift) return { ok: false, reason: 'Finish the active workday first.' };
    const unit = playerFamily(world);
    const person = World.getPerson(world, personId);
    const action = CARE_ACTIONS[actionId];
    if (!unit || !person || person.familyUnitId !== unit.id || !isDependent(person)) return { ok: false, reason: 'That autonomous dependent is not part of the active family unit.' };
    if (!action) return { ok: false, reason: 'Unknown care action.' };
    if (world.player.money + 0.001 < action.cost) return { ok: false, reason: `This action needs ${Core.formatMoney(action.cost)}.` };
    const choice = actionAcceptance(world, person, actionId);
    const record = careRecordForDay(world, unit, person.id, true);
    if (!choice.accepted) {
      person.careAutonomy.refusedActivities.push({ actionId, day: world.time.day, hour: world.time.hour, reason: 'autonomous preference' });
      if (person.careAutonomy.refusedActivities.length > 60) person.careAutonomy.refusedActivities.splice(0, person.careAutonomy.refusedActivities.length - 60);
      record.actions.push({ actionId, actorId: 'player', accepted: false, hours: 0, cost: 0, evidence: choice });
      relationBetweenPlayerAnd(world, person).trust = Core.clamp(relationBetweenPlayerAnd(world, person).trust + 0.25, -100, 100);
      Systems.advanceHours(world, 1);
      Core.appendLedger(world, 'family', `${person.name} declined ${action.name.toLowerCase()} right now. Their refusal was recorded without a hidden punishment.`, {
        actorIds: ['player', person.id], causes: ['dependent preference', 'refusal respected'], evidence: choice
      });
      Systems.toast(world, `${person.name} did not want that activity right now.`, 'info');
      return { ok: true, accepted: false, choice };
    }
    world.player.money = Core.round(world.player.money - action.cost, 2);
    world.player.lifetimeSpend += action.cost;
    world.metrics.familySupportSpend += action.cost;
    world.player.needs.energy = Core.clamp(world.player.needs.energy - action.energy, 0, 100);
    Systems.applyNeedEffects(person, action.needEffects);
    const relation = relationBetweenPlayerAnd(world, person);
    relation.friendship = Core.clamp(relation.friendship + 1.8 + action.hours * 0.6, -100, 100);
    relation.trust = Core.clamp(relation.trust + 2.2 + action.hours * 0.45, -100, 100);
    relation.status = 'family';
    relation.interactions += 1;
    relation.lastInteractionDay = world.time.day;
    const reverse = ensureReverseFamilyRelation(world, person);
    reverse.friendship = relation.friendship;
    reverse.trust = relation.trust;
    applyDevelopment(person, action.domains, 1);
    record.playerHours = Core.round(record.playerHours + action.hours, 2);
    record.cost = Core.round(record.cost + action.cost, 2);
    record.actions.push({ actionId, actorId: 'player', accepted: true, hours: action.hours, cost: action.cost, evidence: choice });
    world.metrics.careActions += 1;
    world.metrics.careHoursPlayer += action.hours;
    person.careAutonomy.lastChoiceDay = world.time.day;
    Systems.advanceHours(world, action.hours);
    Core.appendLedger(world, 'family', `You and ${person.name} completed: ${action.name}.`, {
      actorIds: ['player', person.id], placeId: person.homePropertyId,
      causes: ['explicit care action', 'time and cost paid', 'influence without command queue'],
      evidence: { hours: action.hours, cost: action.cost, development: action.domains, choice }
    });
    Systems.toast(world, `${action.name} completed with ${person.name}.`, 'success');
    return { ok: true, accepted: true, action, choice };
  }

  function determineDependentLocation(world, person) {
    const stage = person.lifeCourse?.stage || stageForAge(person.age);
    const hour = world.time.hour;
    const weekday = Core.weekdayIndex(world.time.day);
    if (hour < 7 || hour >= (stage === 'teen' ? 23 : 21)) return { placeId: person.homePropertyId, activity: 'sleeping in their own rhythm' };
    if (hour < 8) return { placeId: person.homePropertyId, activity: 'waking and getting ready' };
    if (weekday < 5 && ['toddler', 'child', 'teen'].includes(stage) && hour >= 8 && hour < 15) {
      return { placeId: World.getPlace(world, 'place_school') ? 'place_school' : 'place_library', activity: `learning through ${Core.titleCase(person.education?.mode || 'neighborhood learning')}` };
    }
    if (hour >= 15 && hour < 18) {
      const roll = Core.hashString(`${world.seed}|${world.time.day}|${person.id}|after-school`) % 3;
      if (roll === 0) return { placeId: 'place_park', activity: 'choosing time in the park' };
      if (roll === 1) return { placeId: 'place_library', activity: 'following a personal interest' };
      return { placeId: person.homePropertyId, activity: 'using their own room and objects' };
    }
    return { placeId: person.homePropertyId, activity: hour < 20 ? 'spending family and personal time at home' : 'winding down' };
  }

  function hourlyDependentTick(world, person) {
    const hour = world.time.hour;
    const stage = person.lifeCourse?.stage || stageForAge(person.age);
    const atLearning = person.locationId === 'place_school' || person.locationId === 'place_library';
    person.needs.hunger -= stage === 'infant' ? 2.3 : 1.45;
    person.needs.hygiene -= 0.45;
    person.needs.social -= person.locationId === person.homePropertyId ? 0.15 : -0.35;
    person.needs.energy += (hour < 7 || hour >= (stage === 'teen' ? 23 : 21)) ? 2.8 : (atLearning ? -1.05 : -0.65);
    if (hour === 7) {
      person.needs.hygiene += 24;
      person.needs.hunger += 24;
    }
    if (hour === 17) person.needs.hunger += 30;
    if (atLearning) person.skills.focus = Core.clamp(person.skills.focus + 0.01, 0, 100);
    Systems.clampNeeds(person);
  }

  function requiredCapacityForHousehold(world, household) {
    if (!household) return 0;
    const unit = world.familyUnits?.find((entry) => entry.status !== 'ended' && entry.linkedHouseholdId === household.id);
    const dependentCount = unit ? dependentMembers(world, unit).filter((entry) => entry.role === 'dependent').length : 0;
    return household.memberIds.length + dependentCount;
  }

  function dependentIdsForHousehold(world, household) {
    const unit = world.familyUnits?.find((entry) => entry.status !== 'ended' && entry.linkedHouseholdId === household?.id);
    return unit ? dependentMembers(world, unit).map((entry) => entry.person.id) : [];
  }

  function transferDependentFurniture(world, person, origin, destination) {
    if (!origin || !destination) return { moved: 0, stored: 0 };
    const moving = origin.furniture.filter((object) => object.ownerId === person.id && object.ownershipMode !== 'property_fixture');
    origin.furniture = origin.furniture.filter((object) => !(object.ownerId === person.id && object.ownershipMode !== 'property_fixture'));
    let placed = 0;
    let stored = 0;
    moving.forEach((object) => {
      const rule = (x, y, footprint) => placementPermission(world, destination, person.id, object, x, y, footprint).ok;
      if (World.addFurnitureToProperty(world, destination, object, null, rule)) placed += 1;
      else {
        person.storedFurniture.push(object);
        stored += 1;
      }
    });
    return { moved: placed, stored };
  }

  function syncAfterHouseholdMove(world, household, destination, proposal = null) {
    const unit = world.familyUnits?.find((entry) => entry.status !== 'ended' && entry.linkedHouseholdId === household.id);
    if (!unit) return { ok: true, movedDependents: 0 };
    const dependents = dependentMembers(world, unit).filter((entry) => entry.role === 'dependent');
    if (destination.capacity < household.memberIds.length + dependents.length) return { ok: false, reason: 'The accepted destination no longer has capacity for the full family.' };
    const oldHome = World.getProperty(world, unit.homePropertyId);
    dependents.forEach(({ person }) => {
      if (person.homePropertyId === destination.id) return;
      if (oldHome) oldHome.tenants = oldHome.tenants.filter((id) => id !== person.id);
      transferDependentFurniture(world, person, oldHome, destination);
      if (!destination.tenants.includes(person.id)) destination.tenants.push(person.id);
      person.homePropertyId = destination.id;
      person.locationId = destination.id;
      person.lastMoveDay = world.time.day;
    });
    if (oldHome) oldHome.listedForRent = oldHome.tenants.length < oldHome.capacity;
    destination.listedForRent = false;
    unit.homePropertyId = destination.id;
    unit.roomAssignments = [];
    dependents.forEach(({ person }) => roomAssignmentFor(world, unit, person.id));
    unit.revision += 1;
    world.metrics.familyRelocations += dependents.length ? 1 : 0;
    appendUnitHistory(world, unit, 'family_relocation', `The family continuity graph followed the accepted adult relocation to ${destination.name}; each dependent and their objects remained attributable.`, {
      actorIds: household.memberIds.concat(dependents.map((entry) => entry.person.id)), proposalId: proposal?.id || null,
      propertyId: destination.id, causes: ['accepted adult relocation', 'dependent capacity verified', 'no object loss']
    });
    return { ok: true, movedDependents: dependents.length };
  }

  function handleHouseholdSeparation(world, household, partner, details = {}) {
    const unit = world.familyUnits?.find((entry) => entry.status !== 'ended' && entry.linkedHouseholdId === household.id);
    if (!unit) return { ok: true };
    const dependents = dependentMembers(world, unit).filter((entry) => entry.role === 'dependent');
    if (!dependents.length) {
      unit.status = 'ended';
      unit.separation = { day: world.time.day, mode: 'no_dependents', householdEndMode: household.endMode };
      const formerHome = World.getProperty(world, unit.homePropertyId);
      if (formerHome) formerHome.listedForRent = formerHome.tenants.length < formerHome.capacity;
      world.player.familyUnitId = null;
      if (partner) partner.familyUnitId = null;
      return { ok: true };
    }
    unit.status = 'continuing_separately';
    unit.linkedHouseholdId = null;
    unit.separation = {
      day: world.time.day,
      hour: world.time.hour,
      mode: 'current_home_continuity',
      primaryHomePropertyId: dependents[0].person.homePropertyId,
      playerHomePropertyId: world.player.homePropertyId,
      partnerHomePropertyId: partner?.homePropertyId || null,
      boundary: 'prototype care continuity only; not a legal custody model'
    };
    unit.carePlan.mode = 'flexible';
    unit.carePlan.lastAcceptedProposalId = null;
    unit.revision += 1;
    world.metrics.familySeparations += 1;
    appendUnitHistory(world, unit, 'adult_separation', 'The adult agreement ended, but the dependent family graph and object ownership remained intact. The prototype records continuity rather than claiming legal custody rules.', {
      actorIds: ['player', partner?.id].filter(Boolean), causes: ['unilateral adult exit preserved', 'dependent continuity', 'no legal inference'], evidence: Core.deepClone(unit.separation)
    });
    return { ok: true, unit };
  }

  function assignmentAtRoom(world, propertyId, roomId) {
    const unit = playerFamily(world);
    if (!unit || unit.homePropertyId !== propertyId) return null;
    return unit.roomAssignments.find((entry) => entry.roomId === roomId) || null;
  }

  function placementPermission(world, property, actorId, object, x, y, footprint = object.footprint) {
    const unit = playerFamily(world);
    if (!unit || unit.homePropertyId !== property?.id) return { ok: true, familyRoomIds: [] };
    const familyRoomIds = new Set();
    for (let dy = 0; dy < footprint[1]; dy += 1) {
      for (let dx = 0; dx < footprint[0]; dx += 1) {
        const room = AXM.Habitats?.roomAtCell(property, x + dx, y + dy);
        if (!room) continue;
        familyRoomIds.add(room.id);
        const assignment = assignmentAtRoom(world, property.id, room.id);
        if (!assignment) continue;
        if (assignment.kind === 'dependent_private' && actorId !== assignment.personId) {
          return { ok: false, reason: `${World.personName(world, assignment.personId)}'s private room needs an accepted family room plan before another person edits it.`, familyRoomIds: Array.from(familyRoomIds) };
        }
        if (actorId === assignment.personId && object.ownerId !== assignment.personId && object.ownershipMode !== 'property_fixture') {
          return { ok: false, reason: 'The dependent may shape their room with their own objects, not take ownership of somebody else’s belongings.', familyRoomIds: Array.from(familyRoomIds) };
        }
      }
    }
    return { ok: true, familyRoomIds: Array.from(familyRoomIds) };
  }

  function projectAuthority(world, property, spec, options = {}) {
    const unit = playerFamily(world);
    if (!unit || unit.homePropertyId !== property?.id) return null;
    const roomId = spec?.target?.roomId;
    const assignment = roomId ? assignmentAtRoom(world, property.id, roomId) : null;
    if (assignment?.kind === 'dependent_private' && !options.approvedFamilyProposalId) {
      return { mode: 'family_proposal', familyUnitId: unit.id, reason: `${World.personName(world, assignment.personId)}'s private room requires an accepted family room proposal.` };
    }
    if (spec?.type === 'partition' && unit.roomAssignments.some((entry) => entry.kind === 'dependent_private') && !options.approvedFamilyProposalId) {
      return { mode: 'family_proposal', familyUnitId: unit.id, reason: 'A structural edit can alter a dependent room boundary and needs an accepted family plan.' };
    }
    return null;
  }

  function proposeFamilyChange(world, familyUnitId, type, terms = {}) {
    ensureState(world);
    const unit = familyUnitById(world, familyUnitId);
    if (!unit || unit.status === 'ended' || !unit.members.some((member) => member.personId === 'player' && !member.leftDay)) return { ok: false, reason: 'Active player family unit not found.' };
    if (!FAMILY_PROPOSAL_TYPES.includes(type) || type === 'parenthood') return { ok: false, reason: 'Unknown or unsupported family change.' };
    const partner = partnerForUnit(world, unit);
    if (!partner) return { ok: false, reason: 'An autonomous adult partner is required for this shared plan.' };
    const normalized = Core.deepClone(terms);
    if (type === 'care_plan') {
      if (!CARE_MODES.includes(normalized.mode)) return { ok: false, reason: 'Unknown care mode.' };
      normalized.playerTargetHours = Core.clamp(Core.safeNumber(normalized.playerTargetHours, unit.carePlan.playerTargetHours), 0.5, 10);
      normalized.partnerTargetHours = Core.clamp(Core.safeNumber(normalized.partnerTargetHours, unit.carePlan.partnerTargetHours), 0.5, 10);
      normalized.weeklyBudget = Core.clamp(Core.safeNumber(normalized.weeklyBudget, unit.carePlan.weeklyBudget), 10, 300);
    }
    if (type === 'education_plan' && !EDUCATION_MODES.includes(normalized.mode)) return { ok: false, reason: 'Unknown education mode.' };
    if (type === 'room_plan') {
      const person = World.getPerson(world, normalized.personId);
      const property = World.getProperty(world, unit.homePropertyId);
      if (!person || person.familyUnitId !== unit.id || !isDependent(person)) return { ok: false, reason: 'Choose a dependent family member.' };
      if (!AXM.Habitats?.roomById(property, normalized.roomId)) return { ok: false, reason: 'Choose a real room.' };
      if (!ROOM_KINDS.includes(normalized.kind)) return { ok: false, reason: 'Unknown family room kind.' };
      if (normalized.projectSpec) {
        if (normalized.propertyId !== unit.homePropertyId) return { ok: false, reason: 'The family project must target the active family home.' };
        const projectValidation = AXM.Habitats.validateProjectSpec(world, property, normalized.projectSpec, { forProposal: true });
        if (!projectValidation.ok) return projectValidation;
      }
    }
    const actionCrossesDay = world.time.hour + 1 >= 24;
    const result = createFamilyProposal(world, type, 'player', [partner.id], normalized, {
      familyUnitId: unit.id,
      householdId: unit.linkedHouseholdId,
      dueDay: world.time.day + 1 + (actionCrossesDay ? 1 : 0)
    });
    if (result.ok) Systems.advanceHours(world, 1);
    return result;
  }

  function familyProposalScore(world, proposal) {
    const unit = familyUnitById(world, proposal.familyUnitId);
    const partner = partnerForUnit(world, unit);
    if (!unit || !partner) return -100;
    const relation = world.player.relationships[partner.id] || {};
    let score = 35 + Core.safeNumber(relation.trust, 0) * 0.35 + Core.safeNumber(relation.friendship, 0) * 0.18;
    if (proposal.type === 'care_plan') {
      const loadDelta = Core.safeNumber(proposal.terms.partnerTargetHours, unit.carePlan.partnerTargetHours) - unit.carePlan.partnerTargetHours;
      score -= Math.max(0, loadDelta) * 9;
      if (proposal.terms.mode === 'partner_leads') score -= partner.traits.independence * 0.18;
      if (unit.pressure.consecutiveStrainDays >= 3) score += 18;
    }
    if (proposal.type === 'education_plan') {
      if (proposal.terms.mode === 'home_project_mix') score += partner.traits.creativity * 0.18;
      if (proposal.terms.mode === 'practical_apprenticeship') score += partner.skills.repair * 0.22;
    }
    if (proposal.type === 'room_plan') {
      const assignment = unit.roomAssignments.find((entry) => entry.personId === proposal.terms.personId);
      if (assignment?.roomId === proposal.terms.roomId && assignment.kind === proposal.terms.kind) score -= 40;
      if (proposal.terms.kind === 'dependent_private') score += 8;
    }
    if (proposal.type === 'family_ritual') score += Core.safeNumber(relation.romance, 0) * 0.25;
    return Core.round(score, 1);
  }

  function applyFamilyProposal(world, proposal) {
    const unit = familyUnitById(world, proposal.familyUnitId);
    if (!unit) return { ok: false, reason: 'Family unit unavailable.' };
    if (proposal.type === 'care_plan') {
      unit.carePlan.mode = proposal.terms.mode;
      unit.carePlan.playerTargetHours = proposal.terms.playerTargetHours;
      unit.carePlan.partnerTargetHours = proposal.terms.partnerTargetHours;
      unit.carePlan.weeklyBudget = proposal.terms.weeklyBudget;
    } else if (proposal.type === 'education_plan') {
      unit.carePlan.educationMode = proposal.terms.mode;
      dependentMembers(world, unit).forEach(({ person }) => {
        person.education.mode = proposal.terms.mode;
        person.education.history.push({ day: world.time.day, type: 'plan_change', mode: proposal.terms.mode, proposalId: proposal.id });
      });
    } else if (proposal.type === 'room_plan') {
      const person = World.getPerson(world, proposal.terms.personId);
      unit.roomAssignments = unit.roomAssignments.filter((entry) => entry.personId !== proposal.terms.personId);
      unit.roomAssignments.push({
        id: Core.uniqueId(world, 'family_room'), roomId: proposal.terms.roomId, personId: proposal.terms.personId,
        kind: proposal.terms.kind, label: `${person.name}'s ${Core.titleCase(proposal.terms.kind)}`,
        createdDay: world.time.day, provenance: 'accepted family room proposal', proposalId: proposal.id
      });
      const property = World.getProperty(world, unit.homePropertyId);
      const room = AXM.Habitats?.roomById(property, proposal.terms.roomId);
      if (room) room.familyPermissionSnapshot = Core.deepClone(unit.roomAssignments[unit.roomAssignments.length - 1]);
      world.metrics.familyEnvironmentUpdates += 1;
      if (proposal.terms.projectSpec) {
        const projectResult = AXM.Habitats?.createFamilyAuthorizedProject(world, unit, proposal);
        if (!projectResult?.ok) return projectResult || { ok: false, reason: 'Family-authorized construction could not be created.' };
        proposal.implementedProjectId = projectResult.project.id;
      }
    } else if (proposal.type === 'family_ritual') {
      unit.familyRitual = {
        label: String(proposal.terms.label || 'Chosen family commitment').slice(0, 60),
        day: world.time.day,
        meaning: String(proposal.terms.meaning || 'A personal commitment without legal claims.').slice(0, 220),
        proposalId: proposal.id
      };
    }
    unit.carePlan.lastAcceptedProposalId = proposal.id;
    unit.revision += 1;
    proposal.status = 'implemented';
    appendUnitHistory(world, unit, `${proposal.type}_implemented`, `The accepted ${Core.titleCase(proposal.type)} plan became active.`, {
      actorIds: ['player', partnerForUnit(world, unit)?.id].filter(Boolean), proposalId: proposal.id,
      causes: ['mutual adult acceptance', 'visible terms'], evidence: Core.deepClone(proposal.terms)
    });
    return { ok: true, unit };
  }

  function resolveNpcFamilyProposal(world, proposal) {
    if (proposal.status !== 'pending_npc' || world.time.day < proposal.dueDay) return null;
    const partner = World.getPerson(world, proposal.recipientIds[0]);
    const score = familyProposalScore(world, proposal);
    const roll = Core.hashString(`${world.seed}|${proposal.id}|family-response`) % 101;
    let dependentVoice = null;
    if (proposal.type === 'room_plan') {
      const affected = World.getPerson(world, proposal.terms.personId);
      if (affected?.lifeCourse?.stage === 'teen') {
        const trust = relationBetweenPlayerAnd(world, affected).trust;
        const privacyFit = proposal.terms.kind === 'dependent_private' ? 18 : 0;
        const voiceScore = Core.round(38 + trust * 0.25 + privacyFit + affected.traits.stability * 0.08, 1);
        const voiceRoll = Core.hashString(`${world.seed}|${proposal.id}|${affected.id}|teen-room-voice`) % 101;
        dependentVoice = { personId: affected.id, score: voiceScore, roll: voiceRoll, accepted: voiceScore >= voiceRoll };
      }
    }
    if (score >= roll && (!dependentVoice || dependentVoice.accepted)) {
      proposal.status = 'accepted';
      proposal.response = { decision: 'accepted', day: world.time.day, hour: world.time.hour, evidence: { score, roll, dependentVoice } };
      world.metrics.familyProposalsAccepted += 1;
      appendProposalHistory(world, proposal, 'accepted', `${partner?.name || 'The partner'} accepted the family plan${dependentVoice ? ` and ${World.personName(world, dependentVoice.personId)}'s recorded voice also accepted it` : ''}.`, { actorId: partner?.id, evidence: { score, roll, dependentVoice } });
      return applyFamilyProposal(world, proposal);
    }
    proposal.status = 'declined';
    proposal.response = { decision: 'declined', day: world.time.day, hour: world.time.hour, evidence: { score, roll, dependentVoice } };
    world.metrics.familyProposalsDeclined += 1;
    appendProposalHistory(world, proposal, 'declined', `${partner?.name || 'The partner'} declined without hidden relationship punishment.`, {
      actorId: dependentVoice && !dependentVoice.accepted ? dependentVoice.personId : partner?.id, causes: [dependentVoice && !dependentVoice.accepted ? 'dependent room voice declined' : 'autonomous partner refusal'], evidence: { score, roll, dependentVoice }
    });
    return { ok: true, accepted: false };
  }

  function respondToFamilyProposal(world, proposalId, response) {
    ensureState(world);
    const proposal = familyProposalById(world, proposalId);
    if (!proposal || proposal.status !== 'awaiting_player') return { ok: false, reason: 'No player response is currently requested.' };
    if (!['accept', 'decline'].includes(response)) return { ok: false, reason: 'Response must be accept or decline.' };
    if (response === 'decline') {
      proposal.status = 'declined';
      proposal.response = { decision: 'declined', day: world.time.day, hour: world.time.hour };
      world.metrics.familyProposalsDeclined += 1;
      appendProposalHistory(world, proposal, 'declined', 'The player declined the proposal. No hidden punishment was added.', { actorId: 'player' });
      Systems.toast(world, 'Family proposal declined.', 'info');
      return { ok: true, accepted: false };
    }
    proposal.status = 'accepted';
    proposal.response = { decision: 'accepted', day: world.time.day, hour: world.time.hour };
    world.metrics.familyProposalsAccepted += 1;
    appendProposalHistory(world, proposal, 'accepted', 'The player accepted the visible family terms.', { actorId: 'player' });
    const result = applyFamilyProposal(world, proposal);
    Systems.toast(world, result.ok ? 'Family proposal accepted.' : result.reason, result.ok ? 'success' : 'warning');
    return result;
  }

  function maybePartnerCareProposal(world, unit) {
    if (unit.status === 'ended' || unit.pressure.consecutiveStrainDays < 3) return null;
    const pending = world.familyProposals.find((proposal) => proposal.familyUnitId === unit.id && proposal.type === 'care_plan' && ['pending_npc', 'awaiting_player'].includes(proposal.status));
    if (pending) return null;
    const partner = partnerForUnit(world, unit);
    if (!partner) return null;
    const mode = unit.carePlan.mode === 'player_leads' ? 'balanced' : unit.carePlan.mode;
    const terms = {
      mode,
      playerTargetHours: Core.clamp(unit.carePlan.playerTargetHours + 0.5, 0.5, 10),
      partnerTargetHours: unit.carePlan.partnerTargetHours,
      weeklyBudget: Core.clamp(unit.carePlan.weeklyBudget + 10, 10, 300),
      reason: `${unit.pressure.consecutiveStrainDays} consecutive strained care days`
    };
    const result = createFamilyProposal(world, 'care_plan', partner.id, ['player'], terms, {
      status: 'awaiting_player', familyUnitId: unit.id, householdId: unit.linkedHouseholdId,
      dueDay: world.time.day, expiresDay: world.time.day + 10
    });
    if (result.ok) world.metrics.npcHouseholdInitiatives = (world.metrics.npcHouseholdInitiatives || 0) + 1;
    return result.ok ? result.proposal : null;
  }

  function autonomousPartnerCare(world, unit, person, record) {
    const partner = partnerForUnit(world, unit);
    if (!partner || partner.homePropertyId !== person.homePropertyId) return 0;
    const target = Core.safeNumber(unit.carePlan.partnerTargetHours, 2);
    const capacity = Core.clamp(0.6 + partner.needs.energy / 100 + partner.traits.stability / 160 - partner.traits.independence / 260, 0.4, 2.2);
    const deterministicVariation = (Core.hashString(`${world.seed}|${world.time.day}|${partner.id}|care-hours`) % 75) / 100;
    const hours = Core.round(Math.min(target, capacity + deterministicVariation), 2);
    if (hours <= 0) return 0;
    record.partnerHours += hours;
    record.actions.push({ actionId: 'autonomous_partner_care', actorId: partner.id, accepted: true, hours, cost: 0 });
    world.metrics.careHoursPartner += hours;
    partner.needs.energy = Core.clamp(partner.needs.energy - hours * 1.4, 0, 100);
    applyDevelopment(person, { security: 0.35, social: 0.25, practical: partner.skills.repair > 35 ? 0.18 : 0.05 }, hours);
    return hours;
  }

  function communityCare(world, unit, person, record) {
    if (!unit.carePlan.communitySupportAllowed) return 0;
    const stage = person.lifeCourse.stage;
    const weekday = Core.weekdayIndex(world.time.day);
    if (weekday >= 5 || !['toddler', 'child', 'teen'].includes(stage)) return 0;
    const hours = stage === 'toddler' ? 1 : 1.5;
    record.communityHours += hours;
    record.actions.push({ actionId: 'learning_community_support', actorId: 'place_school', accepted: true, hours, cost: 0 });
    world.metrics.careHoursCommunity += hours;
    return hours;
  }

  function settleWeeklySupport(world, unit, dependents) {
    if ((world.time.day - 1) % 7 !== 0 || world.time.day === 1 || !dependents.length) return;
    const partner = partnerForUnit(world, unit);
    const weeklyCost = dependents.reduce((sum, entry) => sum + (STAGE_RULES[entry.person.lifeCourse.stage]?.weeklyCost || 0), 0);
    const budget = Math.max(weeklyCost, Core.safeNumber(unit.carePlan.weeklyBudget, weeklyCost));
    let playerShare = 0.5;
    if (unit.carePlan.mode === 'player_leads') playerShare = 0.65;
    if (unit.carePlan.mode === 'partner_leads') playerShare = 0.35;
    if (unit.carePlan.mode === 'flexible' && partner) {
      const total = Math.max(1, Systems.playerMonthlyIncome(world) + Systems.npcMonthlyIncome(partner));
      playerShare = Systems.playerMonthlyIncome(world) / total;
    }
    const playerDue = Core.round(budget * playerShare, 2);
    const partnerDue = Core.round(budget - playerDue, 2);
    const playerPaid = Math.min(world.player.money, playerDue);
    const partnerPaid = partner ? Math.min(partner.money, partnerDue) : 0;
    world.player.money = Core.round(world.player.money - playerPaid, 2);
    world.player.lifetimeSpend += playerPaid;
    if (partner) partner.money = Core.round(partner.money - partnerPaid, 2);
    const paid = playerPaid + partnerPaid;
    world.metrics.familySupportSpend += paid;
    const shortfall = Math.max(0, budget - paid);
    if (shortfall > 0) unit.pressure.rollingUnmetHours = Core.round(unit.pressure.rollingUnmetHours + shortfall / 12, 2);
    appendUnitHistory(world, unit, 'weekly_support', `The family funded ${Core.formatMoney(paid)} of ${Core.formatMoney(budget)} in visible weekly support costs.`, {
      actorIds: ['player', partner?.id].filter(Boolean), causes: ['accepted care plan', shortfall ? 'limited adult funds' : 'support cost met'],
      evidence: { budget, playerDue, playerPaid, partnerDue, partnerPaid, shortfall }
    });
  }

  function finalizePreviousCareDay(world, unit, person) {
    const previous = world.careRecords.find((entry) => entry.familyUnitId === unit.id && entry.personId === person.id && entry.day === world.time.day - 1);
    if (!previous || previous.finalized) return;
    const provided = previous.playerHours + previous.partnerHours + previous.communityHours;
    const environment = environmentSupport(world, unit, person);
    const environmentHours = environment >= 70 ? 0.75 : environment >= 45 ? 0.35 : 0;
    const effective = provided + environmentHours;
    const unmet = Math.max(0, previous.requiredHours - effective);
    previous.environmentSupport = environment;
    previous.needsMet = unmet <= 0.25;
    previous.strainAdded = Core.round(unmet, 2);
    previous.finalized = true;
    unit.pressure.lastDayRequired = previous.requiredHours;
    unit.pressure.lastDayProvided = Core.round(effective, 2);
    unit.pressure.lastDayCost = previous.cost;
    unit.pressure.rollingUnmetHours = Core.round(Core.clamp(unit.pressure.rollingUnmetHours * 0.82 + unmet, 0, 100), 2);
    if (unmet > 0.75) {
      unit.pressure.consecutiveStrainDays += 1;
      world.metrics.careStrainDays += 1;
      person.needs.mood = Core.clamp(person.needs.mood - Math.min(5, unmet * 1.4), 0, 100);
      person.needs.security = person.needs.security == null ? 50 : Core.clamp(person.needs.security - unmet, 0, 100);
      applyDevelopment(person, { security: -0.3, independence: 0.08 }, unmet);
    } else {
      unit.pressure.consecutiveStrainDays = 0;
      world.metrics.careNeedsMetDays += 1;
      applyDevelopment(person, { security: 0.25, independence: 0.12 }, 1);
    }
    unit.pressure.lastReviewDay = world.time.day;
  }

  function processEducation(world, person) {
    const stage = person.lifeCourse.stage;
    const weekday = Core.weekdayIndex(world.time.day);
    if (weekday >= 5 || !['toddler', 'child', 'teen'].includes(stage)) return;
    const moodFactor = person.needs.mood / 100;
    const focusFactor = person.skills.focus / 100;
    const gain = Core.round(0.6 + moodFactor * 0.45 + focusFactor * 0.35, 2);
    person.education.progress = Core.round(person.education.progress + gain, 2);
    person.education.attendanceDays += 1;
    person.education.history.push({ day: world.time.day, type: 'attendance', gain, mode: person.education.mode, focus: person.education.currentFocus });
    if (person.education.history.length > 240) person.education.history.splice(0, person.education.history.length - 240);
    world.metrics.educationDays += 1;
    const domain = person.education.mode === 'practical_apprenticeship' ? 'practical'
      : person.education.mode === 'home_project_mix' ? 'creativity' : 'curiosity';
    applyDevelopment(person, { [domain]: 0.22, social: 0.08 }, gain);
  }

  function processLifeCourse(world, person) {
    const life = ensureLifeCourse(world, person);
    life.mode = world.settings.lifeCourseMode;
    life.agePressure = false;
    if (world.settings.lifeCourseMode === 'choice') {
      life.chapterDays += 1;
      return { ok: true, changed: false, mode: 'choice', stage: life.stage };
    }

    const previousStage = life.stage;
    const previousAge = life.ageYears;
    life.ageDays += 1;
    life.ageYears = Math.floor(life.ageDays / 365);
    person.age = life.ageYears;
    const nextStage = stageForAge(life.ageYears);
    if (life.ageYears !== previousAge) {
      Core.appendLedger(world, 'life_course', `${person.name} reached calendar age ${life.ageYears} in the optional calendar-aging mode.`, {
        actorIds: [person.id], causes: ['player-enabled calendar life course'], evidence: { ageDays: life.ageDays, agePressure: false }
      });
    }
    if (nextStage !== previousStage) {
      life.stage = nextStage;
      life.stageEnteredDay = world.time.day;
      life.chapterDays = 0;
      const transition = { day: world.time.day, from: previousStage, to: nextStage, age: life.ageYears, mode: 'calendar', chosenBy: 'calendar_mode' };
      life.transitionHistory.push(transition);
      world.metrics.lifeStageTransitions += 1;
      const unit = person.familyUnitId ? familyUnitById(world, person.familyUnitId) : null;
      if (unit) appendUnitHistory(world, unit, 'life_stage_transition', `${person.name} entered the ${Core.titleCase(nextStage)} chapter through the optional calendar mode.`, {
        personId: person.id, actorIds: [person.id], causes: ['player-enabled calendar life course'], evidence: transition
      });
      if (nextStage === 'young_adult' && person.dependent) transitionToAdultChild(world, person, unit);
    }
    return { ok: true, changed: nextStage !== previousStage, mode: 'calendar', stage: life.stage };
  }

  function setLifeCourseMode(world, mode) {
    ensureState(world);
    if (!LIFE_COURSE_MODES.includes(mode)) return { ok: false, reason: 'Life-course mode must be choice or calendar.' };
    const previous = world.settings.lifeCourseMode;
    if (previous === mode) return { ok: true, changed: false, mode };
    world.settings.lifeCourseMode = mode;
    world.settings.agePressure = false;
    [world.player].concat(world.people || []).forEach((person) => {
      const life = ensureLifeCourse(world, person, { migrated: true });
      life.mode = mode;
      life.agePressure = false;
      if (mode === 'calendar') {
        // Anchor the optional clock inside the chapter already chosen so
        // enabling it cannot cause an immediate hidden stage jump.
        const rules = STAGE_RULES[life.stage];
        const currentAge = Math.max(rules?.minAge || 0, Math.min(rules?.maxAge || 200, Core.safeNumber(life.ageYears, person.age)));
        life.ageYears = currentAge;
        life.ageDays = currentAge * 365 + Core.safeNumber(life.birthdayOffset, 0);
        person.age = currentAge;
      }
    });
    Core.appendLedger(world, 'life_course', mode === 'choice'
      ? 'Choice-first life chapters enabled. The simulation clock no longer advances anyone into another stage.'
      : 'Optional calendar aging enabled. Life stages may now advance with simulated time until choice-first mode is restored.', {
      actorIds: ['player'], causes: ['explicit player setting', 'age pressure remains disabled'],
      evidence: { previousMode: previous, mode, agePressure: false }
    });
    Systems.toast(world, mode === 'choice' ? 'Choice-first life chapters active. No age countdown.' : 'Optional calendar aging active. You can turn it off at any time.', mode === 'choice' ? 'success' : 'warning');
    return { ok: true, changed: true, mode };
  }

  function setShowExactAges(world, visible) {
    ensureState(world);
    const next = Boolean(visible);
    const previous = world.settings.showExactAges;
    world.settings.showExactAges = next;
    [world.player].concat(world.people || []).forEach((person) => {
      const life = ensureLifeCourse(world, person, { migrated: true });
      life.exactAgeVisible = next;
    });
    if (previous !== next) Core.appendLedger(world, 'life_course', next
      ? 'Exact calendar-age labels were made visible by explicit player choice.'
      : 'Exact calendar-age labels were hidden. Life chapters remain visible without a countdown.', {
      actorIds: ['player'], causes: ['explicit display preference'], evidence: { showExactAges: next, agePressure: false }
    });
    Systems.toast(world, next ? 'Exact age labels visible; no deadline was created.' : 'Exact ages hidden. Life chapters remain.', 'info');
    return { ok: true, changed: previous !== next, visible: next };
  }

  function advanceLifeChapter(world, personId = 'player', options = {}) {
    ensureState(world);
    if (world.settings.lifeCourseMode !== 'choice') return { ok: false, reason: 'Switch to choice-first life chapters before choosing a chapter directly.' };
    const person = World.getPerson(world, personId);
    if (!person) return { ok: false, reason: 'Unknown person.' };
    if (personId !== 'player' && !isDependent(person)) return { ok: false, reason: 'Autonomous adults choose their own life direction; the player cannot advance their chapter.' };
    const life = ensureLifeCourse(world, person);
    const index = LIFE_STAGE_ORDER.indexOf(life.stage);
    if (index < 0 || index >= LIFE_STAGE_ORDER.length - 1) return { ok: false, reason: `${person.name} is already in the open-ended Elder chapter.` };
    const previousStage = life.stage;
    const nextStage = LIFE_STAGE_ORDER[index + 1];
    const representativeAge = STAGE_RULES[nextStage]?.minAge ?? life.ageYears;
    life.stage = nextStage;
    life.stageEnteredDay = world.time.day;
    life.chapterDays = 0;
    life.ageYears = representativeAge;
    life.ageDays = representativeAge * 365 + Core.safeNumber(life.birthdayOffset, 0);
    person.age = representativeAge;
    life.mode = 'choice';
    life.agePressure = false;
    const actorId = options.actorId || 'player';
    const transition = {
      day: world.time.day,
      from: previousStage,
      to: nextStage,
      age: representativeAge,
      mode: 'choice',
      chosenBy: actorId,
      noDeadline: true,
      noMissedWindow: true
    };
    life.transitionHistory.push(transition);
    life.chapterChoiceHistory.push(transition);
    world.metrics.lifeStageTransitions += 1;
    world.metrics.lifeChapterChoices += 1;
    const unit = person.familyUnitId ? familyUnitById(world, person.familyUnitId) : null;
    if (unit) appendUnitHistory(world, unit, 'life_chapter_choice', `${person.name} entered the ${Core.titleCase(nextStage)} chapter by explicit choice. No earlier deadline existed and no later choice was lost.`, {
      personId: person.id, actorIds: Array.from(new Set([actorId, person.id])), causes: ['explicit choice', 'no age countdown'], evidence: transition
    });
    if (nextStage === 'young_adult' && person.dependent) transitionToAdultChild(world, person, unit);
    Core.appendLedger(world, 'life_course', `${person.name} opened the ${Core.titleCase(nextStage)} life chapter by choice.`, {
      actorIds: Array.from(new Set([actorId, person.id])), causes: ['choice-first life course', 'identity and history preserved'], evidence: transition
    });
    Systems.toast(world, `${person.name}: ${Core.titleCase(nextStage)} chapter opened without a countdown.`, 'success');
    return { ok: true, person, transition };
  }

  function transitionToAdultChild(world, person, unit) {
    person.dependent = false;
    person.moveCooldownUntil = world.time.day + 30;
    person.decorCooldownUntil = world.time.day + 3;
    person.jobCooldownUntil = world.time.day;
    person.habitatIntentionCooldownUntil = world.time.day + 15;
    if (!person.jobId) {
      const candidates = Content.JOBS.filter((job) => (person.skills[job.primarySkill] || 0) >= job.requirement - 8);
      const chosen = Core.weightedChoice(world, candidates.length ? candidates : Content.JOBS, (job) => 5 + (person.skills[job.primarySkill] || 0) + job.wage);
      person.jobId = chosen.id;
    }
    if (unit) {
      const member = unit.members.find((entry) => entry.personId === person.id && !entry.leftDay);
      if (member) member.role = 'adult_child';
      unit.roomAssignments = unit.roomAssignments.filter((entry) => entry.personId !== person.id);
      appendUnitHistory(world, unit, 'adult_child', `${person.name} became a self-directed young adult. Their objects, relationships, and history remained theirs.`, {
        actorIds: [person.id], personId: person.id, causes: ['age transition', 'no ownership transfer']
      });
    }
  }

  function maybeLaunchAdultChild(world, person, unit) {
    const membership = unit?.members?.find((entry) => entry.personId === person.id);
    if (!unit || !membership || membership.leftDay || person.lifeCourse.stage !== 'young_adult' || isDependent(person) || world.time.day < person.moveCooldownUntil) return;
    if ((Core.hashString(`${person.id}|launch`) + world.time.day) % 17 !== 0) return;
    const current = World.homeOf(world, person.id);
    const candidates = world.places.filter((property) => property.kind === 'residential' && property.id !== current?.id && property.tenants.length < property.capacity && (property.listedForRent || property.ownerId === person.id));
    const affordable = candidates.filter((property) => property.currentRent / 4.2 < Math.max(1, Systems.npcMonthlyIncome(person)) * 0.28 && person.money > property.currentRent * 1.2);
    if (!affordable.length) {
      person.moveCooldownUntil = world.time.day + 14;
      return;
    }
    const target = affordable.sort((a, b) => Systems.housingScore(world, person, b) - Systems.housingScore(world, person, a))[0];
    const result = Systems.moveNpc(world, person, target, { causes: ['young-adult independent housing choice', 'affordable vacancy', 'family continuity without permanent dependence'] });
    if (!result.ok) return;
    const familyHome = World.getProperty(world, unit.homePropertyId);
    if (familyHome && unit.status !== 'ended') familyHome.listedForRent = false;
    const member = unit.members.find((entry) => entry.personId === person.id && !entry.leftDay);
    if (member) member.leftDay = world.time.day;
    person.familyUnitId = unit.id;
    world.metrics.adultChildrenLaunched += 1;
    appendUnitHistory(world, unit, 'adult_child_departure', `${person.name} chose an independent home at ${target.name}. The family relationship and object provenance continue.`, {
      actorIds: [person.id], personId: person.id, propertyId: target.id,
      causes: ['autonomous adult housing decision', 'affordability threshold'], evidence: { money: person.money, jobId: person.jobId }
    });
  }

  function processPendingArrival(world, unit) {
    const pending = unit.pendingArrival;
    if (!pending || world.time.day < pending.readyDay) return;
    const proposal = familyProposalById(world, pending.proposalId);
    const result = welcomeDependent(world, unit, {
      stage: pending.preferredStage,
      proposalId: pending.proposalId,
      experiment: false
    });
    if (!result.ok) {
      pending.status = 'waiting_space';
      pending.waitingReason = result.reason;
      if (proposal) proposal.status = 'waiting_space';
      if (!world.familyProposals.some((entry) => entry.familyUnitId === unit.id && entry.type === 'room_plan' && entry.status === 'awaiting_player')) {
        const partner = partnerForUnit(world, unit);
        createFamilyProposal(world, 'care_plan', partner?.id || 'system', ['player'], {
          mode: unit.carePlan.mode,
          playerTargetHours: unit.carePlan.playerTargetHours,
          partnerTargetHours: unit.carePlan.partnerTargetHours,
          weeklyBudget: unit.carePlan.weeklyBudget,
          reason: 'accepted arrival is waiting for lawful home capacity'
        }, { status: 'awaiting_player', familyUnitId: unit.id, householdId: unit.linkedHouseholdId, dueDay: world.time.day, expiresDay: world.time.day + 14 });
      }
    }
  }

  function dailyTick(world) {
    ensureState(world);
    world.familyProposals.filter((proposal) => proposal.status === 'pending_npc' && world.time.day >= proposal.dueDay).forEach((proposal) => {
      if (proposal.type === 'parenthood') resolveParenthoodProposal(world, proposal);
      else resolveNpcFamilyProposal(world, proposal);
    });
    world.familyProposals.filter((proposal) => ['pending_npc', 'awaiting_player'].includes(proposal.status) && world.time.day > proposal.expiresDay).forEach((proposal) => {
      proposal.status = 'expired';
      appendProposalHistory(world, proposal, 'expired', 'The proposal expired without manufacturing consent.', { causes: ['time window ended'] });
    });

    [world.player].concat(world.people).forEach((person) => processLifeCourse(world, person));

    world.familyUnits.filter((unit) => unit.status !== 'ended').forEach((unit) => {
      processPendingArrival(world, unit);
      const dependents = dependentMembers(world, unit).filter((entry) => entry.role === 'dependent' && isDependent(entry.person));
      settleWeeklySupport(world, unit, dependents);
      dependents.forEach(({ person }) => {
        finalizePreviousCareDay(world, unit, person);
        const record = careRecordForDay(world, unit, person.id, true);
        autonomousPartnerCare(world, unit, person, record);
        communityCare(world, unit, person, record);
        processEducation(world, person);
      });
      adultMembers(world, unit).filter((entry) => entry.role === 'adult_child').forEach(({ person }) => maybeLaunchAdultChild(world, person, unit));
      maybePartnerCareProposal(world, unit);
    });
  }

  function initializeWorld(world, options = {}) {
    ensureState(world);
    if (!options.silent) Core.appendLedger(world, 'family', 'Choice-first life chapters and the separate family-continuity graph were initialized without inventing parenthood, family ties, or an age countdown.', {
      causes: ['v0.7 choice-first life course', 'no fabricated consent', 'age pressure disabled'],
      evidence: { lifeCourseMode: world.settings.lifeCourseMode, showExactAges: world.settings.showExactAges, agePressure: false }
    });
    return world;
  }

  function prepareFamilyContinuityExperiment(world, variant = 'young_child') {
    ensureState(world);
    if (world.flags.familyExperimentPrepared) return { ok: false, reason: 'The labeled family-continuity experiment was already prepared in this save.' };
    world.player.money = Math.max(world.player.money, 18000);
    const householdSetup = Systems.prepareHouseholdExperiment(world);
    if (!householdSetup?.ok) return { ok: false, reason: householdSetup?.reason || 'Household experiment setup failed.' };
    const partner = World.getPerson(world, householdSetup.npcId);
    const relation = world.player.relationships[partner.id];
    relation.friendship = Math.max(88, relation.friendship);
    relation.trust = Math.max(88, relation.trust);
    relation.romance = Math.max(78, relation.romance);
    relation.status = 'dating';
    const reverse = Systems.getRelation(partner, 'player');
    reverse.friendship = relation.friendship;
    reverse.trust = relation.trust;
    reverse.romance = relation.romance;
    reverse.status = 'dating';

    let household = AXM.Households.playerHousehold(world);
    if (!household) {
      const commitment = Systems.proposeCommitment(world, partner.id);
      if (!commitment.ok) return commitment;
      const proposal = commitment.proposal;
      proposal.dueDay = world.time.day;
      const originalRandomInt = Core.randomInt;
      Core.randomInt = () => 0;
      try { AXM.Households.dailyTick(world, {}); } finally { Core.randomInt = originalRandomInt; }
      household = AXM.Households.playerHousehold(world);
    }
    if (!household) return { ok: false, reason: 'The real commitment path did not create an accepted household agreement.' };

    const target = world.places.find((property) => property.id === 'home_garden_2')
      || world.places.find((property) => property.kind === 'residential' && property.capacity >= 4 && property.tenants.length <= 2);
    if (!target) return { ok: false, reason: 'No suitable four-person habitat exists.' };
    const familyMemberSet = new Set(['player', partner.id]);
    const relocatees = target.tenants.filter((id) => !familyMemberSet.has(id));
    for (const residentId of relocatees) {
      const resident = World.getPerson(world, residentId);
      const vacancy = world.places.find((property) => property.kind === 'residential' && property.id !== target.id && property.tenants.length < property.capacity && !property.tenants.includes('player'));
      if (!resident || !vacancy) return { ok: false, reason: 'Could not lawfully create experiment capacity without deleting a resident.' };
      const move = Systems.moveNpc(world, resident, vacancy, { waiveCost: true, causes: ['explicit labeled QA experiment', 'resident preserved through lawful vacancy'] });
      if (!move.ok) return move;
    }

    if (!AXM.Households.isCohabiting(world, household) || household.homePropertyId !== target.id) {
      const cohab = Systems.proposeCohabitation(world, partner.id, target.id);
      if (!cohab.ok) return cohab;
      const proposal = cohab.proposal;
      proposal.dueDay = world.time.day;
      const originalRandomInt = Core.randomInt;
      Core.randomInt = () => 0;
      try { AXM.Households.dailyTick(world, {}); } finally { Core.randomInt = originalRandomInt; }
    }
    household = AXM.Households.playerHousehold(world);
    if (!household || !AXM.Households.isCohabiting(world, household) || household.homePropertyId !== target.id) {
      return { ok: false, reason: 'The real cohabitation path did not establish the experiment home.' };
    }

    const unit = createFamilyUnit(world, household, { careMode: 'balanced' });
    unit.homePropertyId = target.id;
    const stage = variant === 'teen' ? 'teen' : 'child';
    const result = welcomeDependent(world, unit, { stage, experiment: true });
    if (!result.ok) return result;
    appendUnitHistory(world, unit, 'experiment_prepared', `A labeled ${stage} family-continuity experiment was prepared through real household, movement, capacity, object, and room systems.`, {
      actorIds: ['player', partner.id, result.person.id], personId: result.person.id, propertyId: target.id,
      causes: ['explicit developer experiment', 'not normal progression'], evidence: { variant, householdId: household.id }
    });
    Core.appendLedger(world, 'research', `Family continuity experiment prepared with ${result.person.name} (${stage}). This is explicitly a QA shortcut, not ordinary life progression.`, {
      actorIds: ['player', partner.id, result.person.id], placeId: target.id,
      causes: ['explicit labeled experiment'], evidence: { familyUnitId: unit.id, variant }
    });
    world.ui.selectedFamilyUnitId = unit.id;
    world.ui.selectedDependentId = result.person.id;
    world.flags.familyExperimentPrepared = true;
    Systems.toast(world, `Family continuity experiment prepared with ${result.person.name}.`, 'warning');
    return { ok: true, familyUnitId: unit.id, dependentId: result.person.id, partnerId: partner.id, propertyId: target.id };
  }

  function metrics(world) {
    ensureState(world);
    const activeUnits = world.familyUnits.filter((unit) => unit.status !== 'ended');
    const activeDependents = activeUnits.flatMap((unit) => dependentMembers(world, unit)).filter((entry) => entry.role === 'dependent' && isDependent(entry.person));
    const pending = world.familyProposals.filter((proposal) => ['pending_npc', 'awaiting_player', 'waiting_space'].includes(proposal.status));
    const latestRecords = activeDependents.map((entry) => world.careRecords.filter((record) => record.personId === entry.person.id).sort((a, b) => b.day - a.day)[0]).filter(Boolean);
    return {
      activeUnits: activeUnits.length,
      activeDependents: activeDependents.length,
      pendingPlayerProposals: pending.filter((proposal) => proposal.status === 'awaiting_player').length,
      pendingNpcProposals: pending.filter((proposal) => proposal.status === 'pending_npc').length,
      waitingSpace: pending.filter((proposal) => proposal.status === 'waiting_space').length,
      averageDevelopment: activeDependents.length ? Core.round(Core.average(activeDependents.flatMap((entry) => DEVELOPMENT_DOMAINS.map((domain) => entry.person.development?.[domain] || 0))), 1) : 0,
      recentCareCoverage: latestRecords.length ? Core.round(Core.average(latestRecords.map((record) => Math.min(1, (record.playerHours + record.partnerHours + record.communityHours) / Math.max(0.5, record.requiredHours)))) * 100, 1) : 0,
      lifeStageTransitions: world.metrics.lifeStageTransitions || 0,
      adultChildrenLaunched: world.metrics.adultChildrenLaunched || 0
    };
  }

  function validate(world, add) {
    if (!Array.isArray(world.familyUnits)) add('familyUnits must be an array.');
    if (!Array.isArray(world.familyProposals)) add('familyProposals must be an array.');
    if (!Array.isArray(world.careRecords)) add('careRecords must be an array.');
    if (!Array.isArray(world.familyUnits) || !Array.isArray(world.familyProposals) || !Array.isArray(world.careRecords)) return;
    const people = new Set(['player'].concat((world.people || []).map((person) => person.id)));
    const units = new Set();
    const activeMembership = new Map();
    world.familyUnits.forEach((unit) => {
      if (!unit.id || units.has(unit.id)) add(`Duplicate or missing family unit id ${String(unit.id)}.`);
      units.add(unit.id);
      if (unit.schema !== FAMILY_UNIT_SCHEMA) add(`${unit.id} has invalid family unit schema.`);
      if (!FAMILY_UNIT_STATUSES.includes(unit.status)) add(`${unit.id} has invalid family unit status.`);
      if (!Array.isArray(unit.members) || unit.members.length < 2) add(`${unit.id} needs at least two adult-origin members.`);
      (unit.members || []).forEach((member) => {
        if (!people.has(member.personId)) add(`${unit.id} references unknown member ${String(member.personId)}.`);
        if (!MEMBER_ROLES.includes(member.role)) add(`${unit.id} has invalid member role ${String(member.role)}.`);
        if (!member.leftDay && unit.status !== 'ended') {
          if (activeMembership.has(member.personId) && activeMembership.get(member.personId) !== unit.id) add(`${member.personId} appears in more than one active family unit.`);
          activeMembership.set(member.personId, unit.id);
        }
      });
      if (!unit.carePlan || !CARE_MODES.includes(unit.carePlan.mode)) add(`${unit.id} has invalid care plan.`);
      if (!Array.isArray(unit.roomAssignments)) add(`${unit.id} roomAssignments must be an array.`);
      (unit.roomAssignments || []).forEach((assignment) => {
        if (!people.has(assignment.personId)) add(`${unit.id} room assignment references unknown person.`);
        if (!ROOM_KINDS.includes(assignment.kind)) add(`${unit.id} has invalid room assignment kind.`);
        const property = World.getProperty(world, unit.homePropertyId);
        if (property && !AXM.Habitats?.roomById(property, assignment.roomId)) add(`${unit.id} room assignment references missing room ${assignment.roomId}.`);
      });
      if (!Array.isArray(unit.history)) add(`${unit.id} history must be an array.`);
    });
    if (!LIFE_COURSE_MODES.includes(world.settings?.lifeCourseMode)) add('lifeCourseMode must be choice or calendar.');
    if (world.settings?.agePressure !== false) add('Choice-first life-course root requires agePressure=false.');
    if (typeof world.settings?.showExactAges !== 'boolean') add('showExactAges must be a boolean.');
    [world.player].concat(world.people || []).forEach((person) => {
      if (!person.lifeCourse || person.lifeCourse.schema !== LIFE_COURSE_SCHEMA) add(`${person.id} has no v0.5 life-course record.`);
      if (person.lifeCourse && !LIFE_STAGE_ORDER.includes(person.lifeCourse.stage)) add(`${person.id} has an invalid life chapter.`);
      if (person.lifeCourse && !LIFE_COURSE_MODES.includes(person.lifeCourse.mode)) add(`${person.id} has an invalid life-course mode.`);
      if (person.lifeCourse && person.lifeCourse.agePressure !== false) add(`${person.id} life-course record contains age pressure.`);
      if (person.lifeCourse && !Array.isArray(person.lifeCourse.transitionHistory)) add(`${person.id} transitionHistory must be an array.`);
      if (person.lifeCourse && !Array.isArray(person.lifeCourse.chapterChoiceHistory)) add(`${person.id} chapterChoiceHistory must be an array.`);
      if (person.familyUnitId && !units.has(person.familyUnitId)) add(`${person.id} points to unknown family unit ${person.familyUnitId}.`);
      if (isDependent(person) && Content.jobById(person.jobId)) add(`${person.id} is a dependent but has an adult job.`);
      if (isDependent(person) && person.rentArrears !== 0) add(`${person.id} is a financial dependent but has rent arrears.`);
      if (person.dependent && !person.development) add(`${person.id} dependent development record is missing.`);
    });
    const proposalIds = new Set();
    world.familyProposals.forEach((proposal) => {
      if (!proposal.id || proposalIds.has(proposal.id)) add(`Duplicate or missing family proposal id ${String(proposal.id)}.`);
      proposalIds.add(proposal.id);
      if (proposal.schema !== FAMILY_PROPOSAL_SCHEMA) add(`${proposal.id} has invalid family proposal schema.`);
      if (!FAMILY_PROPOSAL_TYPES.includes(proposal.type)) add(`${proposal.id} has invalid family proposal type.`);
      if (!FAMILY_PROPOSAL_STATUSES.includes(proposal.status)) add(`${proposal.id} has invalid family proposal status.`);
      if (!people.has(proposal.proposerId) && proposal.proposerId !== 'system') add(`${proposal.id} has unknown proposer.`);
      if (!Array.isArray(proposal.recipientIds) || proposal.recipientIds.some((id) => !people.has(id))) add(`${proposal.id} has invalid recipients.`);
      if (proposal.familyUnitId && !units.has(proposal.familyUnitId)) add(`${proposal.id} references unknown family unit.`);
      if (!Array.isArray(proposal.history)) add(`${proposal.id} history must be an array.`);
    });
    const recordIds = new Set();
    world.careRecords.forEach((record) => {
      if (!record.id || recordIds.has(record.id)) add(`Duplicate or missing care record id ${String(record.id)}.`);
      recordIds.add(record.id);
      if (record.schema !== CARE_RECORD_SCHEMA) add(`${record.id} has invalid care record schema.`);
      if (!units.has(record.familyUnitId)) add(`${record.id} references unknown family unit.`);
      if (!people.has(record.personId)) add(`${record.id} references unknown person.`);
      ['requiredHours', 'playerHours', 'partnerHours', 'communityHours', 'cost'].forEach((key) => {
        if (!Number.isFinite(record[key]) || record[key] < 0) add(`${record.id} has invalid ${key}.`);
      });
      if (!Array.isArray(record.actions)) add(`${record.id} actions must be an array.`);
    });
  }

  Object.assign(Systems, {
    proposeParenthood,
    proposeFamilyChange,
    respondToFamilyProposal,
    performCareAction,
    prepareFamilyContinuityExperiment,
    setLifeCourseMode,
    setShowExactAges,
    advanceLifeChapter
  });

  AXM.Family = {
    LIFE_COURSE_SCHEMA,
    FAMILY_UNIT_SCHEMA,
    FAMILY_PROPOSAL_SCHEMA,
    CARE_RECORD_SCHEMA,
    FAMILY_PROPOSAL_TYPES,
    FAMILY_PROPOSAL_STATUSES,
    FAMILY_UNIT_STATUSES,
    MEMBER_ROLES,
    ROOM_KINDS,
    CARE_MODES,
    EDUCATION_MODES,
    ARRIVAL_PATHS,
    DEVELOPMENT_DOMAINS,
    DEPENDENT_STAGES,
    LIFE_COURSE_MODES,
    LIFE_STAGE_ORDER,
    STAGE_RULES,
    CARE_ACTIONS,
    ensureState,
    initializeWorld,
    ensureLifeCourse,
    stageForAge,
    setLifeCourseMode,
    setShowExactAges,
    advanceLifeChapter,
    isDependent,
    isFinancialDependent,
    familyUnitById,
    familyProposalById,
    playerFamily,
    unitMembers,
    dependentMembers,
    adultMembers,
    partnerForUnit,
    householdReadyForParenthood,
    createFamilyProposal,
    proposeParenthood,
    respondToFamilyProposal,
    proposeFamilyChange,
    performCareAction,
    determineDependentLocation,
    hourlyDependentTick,
    requiredCapacityForHousehold,
    dependentIdsForHousehold,
    syncAfterHouseholdMove,
    handleHouseholdSeparation,
    assignmentAtRoom,
    placementPermission,
    projectAuthority,
    environmentSupport,
    careRecordForDay,
    welcomeDependent,
    prepareFamilyContinuityExperiment,
    dailyTick,
    metrics,
    validate
  };
}(typeof window !== 'undefined' ? window : globalThis));
