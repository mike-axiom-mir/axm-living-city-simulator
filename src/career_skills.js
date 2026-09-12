(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Systems = AXM.Systems;

  if (!Core || !Content || !World || !Systems) {
    throw new Error('Living City career/skills requires Core, Content, World and Systems.');
  }
  if (AXM.CareerSkills) return;

  const SCHEMA = 'axm.living-city.career-skills/v0.12.0-draft';
  const SKILL_KEYS = Object.freeze(['focus', 'social', 'repair', 'creativity', 'cooking', 'engineering']);
  const SKILL_DEFINITIONS = Object.freeze([
    Object.freeze({ id: 'focus', name: 'Focus', description: 'Attention, sequencing and seeing a task through without turning speed into the only measure.', routes: ['study practical topics', 'parcel routing', 'cataloguing', 'market tracing'] }),
    Object.freeze({ id: 'social', name: 'Social', description: 'Listening, explaining, coordinating and building trust while other people keep their own agency.', routes: ['ordinary conversations', 'café service', 'peer review', 'learning-house support'] }),
    Object.freeze({ id: 'repair', name: 'Repair', description: 'Diagnosis, restoration and preserving useful objects instead of treating replacement as progression.', routes: ['practice repairs', 'repair workshop', 'park maintenance', 'e-waste salvage'] }),
    Object.freeze({ id: 'creativity', name: 'Creativity', description: 'Making, adapting and trying alternative forms without requiring a creative career.', routes: ['make something small', 'design work', 'process experiments', 'learning projects'] }),
    Object.freeze({ id: 'cooking', name: 'Cooking', description: 'Food preparation, timing and care for practical meals—from home basics to café kitchen work.', routes: ['cook at home', 'gentle routine', 'café kitchen shifts'] }),
    Object.freeze({ id: 'engineering', name: 'Engineering', description: 'Combining diagnosed parts into testable systems with explicit provenance and bounded authority.', routes: ['inspect e-waste', 'refurbish electronics', 'dismantle components', 'build prototypes'] })
  ]);

  const EXTRA_JOBS = Object.freeze([
    Object.freeze({
      id: 'cafe_kitchen', name: 'Café Kitchen', placeId: 'place_cafe', wage: 15, shiftStart: 7, hours: 6,
      primarySkill: 'cooking', requirement: 10, slots: 4,
      skillProfile: { cooking: 0.5, focus: 0.25, social: 0.15, creativity: 0.1 },
      entryRequirements: { cooking: 10, focus: 6 },
      summary: 'Prepare a small changing menu, keep waste visible, and learn food work without turning it into a restaurant empire.',
      actions: [
        { id: 'prep_basic_menu', name: 'Prep the basic menu', note: 'Steady food practice and sequencing.', style: 'craft', performance: 11, skill: { cooking: 1.3, focus: 0.4 }, needs: { energy: -8, hunger: -3 } },
        { id: 'handle_meal_rush', name: 'Handle the meal rush', note: 'Fast coordination with a heavier energy cost.', style: 'pace', performance: 15, skill: { cooking: 1, focus: 0.8 }, needs: { energy: -11, hunger: -5 } },
        { id: 'reduce_food_waste', name: 'Reduce food waste', note: 'Adapt ingredients instead of hiding waste in a score.', style: 'improvement', performance: 10, skill: { cooking: 0.8, creativity: 0.7, focus: 0.4 }, innovation: 1, needs: { energy: -7 } },
        { id: 'share_kitchen_method', name: 'Share a kitchen method', note: 'Teach a coworker without becoming their controller.', style: 'people', performance: 8, skill: { cooking: 0.7, social: 0.8 }, coworker: true, needs: { energy: -7, mood: 2 } }
      ]
    }),
    Object.freeze({
      id: 'material_market', name: 'Material Market', placeId: 'place_market', wage: 15, shiftStart: 9, hours: 6,
      primarySkill: 'focus', requirement: 10, slots: 5,
      skillProfile: { focus: 0.4, repair: 0.25, social: 0.2, creativity: 0.15 },
      entryRequirements: { focus: 10, repair: 6 },
      summary: 'Sort secondhand materials, recognize useful leftovers, and keep source history readable for local makers.',
      actions: [
        { id: 'sort_material_stock', name: 'Sort material stock', note: 'Precision and provenance in ordinary stock work.', style: 'precision', performance: 11, skill: { focus: 1.2, repair: 0.4 }, needs: { energy: -7 } },
        { id: 'assess_reuse_value', name: 'Assess reuse value', note: 'Look for repairable value before treating something as waste.', style: 'craft', performance: 12, skill: { repair: 1, focus: 0.6 }, needs: { energy: -8 } },
        { id: 'help_local_maker', name: 'Help a local maker', note: 'Explain options without pushing a purchase.', style: 'people', performance: 9, skill: { social: 0.9, focus: 0.4 }, coworker: true, needs: { energy: -7, mood: 1 } },
        { id: 'trace_material_source', name: 'Trace a material source', note: 'Keep where-things-came-from evidence useful.', style: 'improvement', performance: 10, skill: { focus: 0.9, creativity: 0.5 }, innovation: 1, needs: { energy: -6 } }
      ]
    }),
    Object.freeze({
      id: 'park_steward', name: 'Pocket Park Steward', placeId: 'place_park', wage: 16, shiftStart: 8, hours: 6,
      primarySkill: 'repair', requirement: 10, slots: 3,
      skillProfile: { repair: 0.4, focus: 0.25, social: 0.2, creativity: 0.15 },
      entryRequirements: { repair: 10, focus: 8 },
      summary: 'Keep a small public place usable through repair, observation and light-touch stewardship rather than constant optimization.',
      actions: [
        { id: 'repair_park_fixture', name: 'Repair a park fixture', note: 'Preserve an existing bench, bin or sign.', style: 'craft', performance: 12, skill: { repair: 1.3, focus: 0.4 }, needs: { energy: -9 } },
        { id: 'walk_condition_round', name: 'Walk a condition round', note: 'Notice real problems before inventing work.', style: 'precision', performance: 10, skill: { focus: 1.1, repair: 0.4 }, needs: { energy: -8 } },
        { id: 'help_park_visitor', name: 'Help a park visitor', note: 'Small public-facing guidance, not surveillance.', style: 'people', performance: 8, skill: { social: 0.9, focus: 0.3 }, needs: { energy: -6, mood: 1 } },
        { id: 'reuse_park_material', name: 'Reuse a leftover material', note: 'A bounded practical improvement using what already exists.', style: 'improvement', performance: 10, skill: { repair: 0.7, creativity: 0.8 }, innovation: 1, materialChance: 0.15, needs: { energy: -8 } }
      ]
    }),
    Object.freeze({
      id: 'learning_house', name: 'Learning House Guide', placeId: 'place_school', wage: 17, shiftStart: 10, hours: 6,
      primarySkill: 'social', requirement: 18, slots: 5,
      skillProfile: { social: 0.4, focus: 0.25, creativity: 0.2, repair: 0.15 },
      entryRequirements: { social: 18, focus: 10, creativity: 10 },
      summary: 'Support practical learning, questions and small projects without deciding another person’s path for them.',
      actions: [
        { id: 'guide_learning_project', name: 'Guide a learning project', note: 'Ask useful questions and let the learner keep authorship.', style: 'people', performance: 10, skill: { social: 1, focus: 0.6 }, needs: { energy: -7, mood: 1 } },
        { id: 'prepare_learning_material', name: 'Prepare learning material', note: 'Turn a topic into something understandable and usable.', style: 'precision', performance: 11, skill: { focus: 1, creativity: 0.7 }, needs: { energy: -7 } },
        { id: 'repair_learning_tool', name: 'Repair a learning tool', note: 'Keep an existing tool in service and explain what failed.', style: 'craft', performance: 10, skill: { repair: 0.9, social: 0.4 }, needs: { energy: -8 } },
        { id: 'host_open_project_table', name: 'Host an open project table', note: 'Support a mixed group without creating attendance pressure.', style: 'people', performance: 9, skill: { social: 1, creativity: 0.6 }, coworker: true, needs: { energy: -8, mood: 2 } }
      ]
    })
  ]);

  const EXISTING_PROFILES = Object.freeze({
    corner_cafe: { skillProfile: { social: 0.45, focus: 0.25, cooking: 0.2, creativity: 0.1 }, entryRequirements: { social: 0 }, family: 'hospitality' },
    parcel_depot: { skillProfile: { focus: 0.5, repair: 0.2, social: 0.15, creativity: 0.15 }, entryRequirements: { focus: 8 }, family: 'logistics' },
    repair_workshop: { skillProfile: { repair: 0.5, focus: 0.2, creativity: 0.15, social: 0.1, engineering: 0.05 }, entryRequirements: { repair: 18, focus: 8 }, family: 'repair' },
    neighborhood_library: { skillProfile: { social: 0.35, focus: 0.35, creativity: 0.15, repair: 0.15 }, entryRequirements: { social: 15, focus: 12 }, family: 'civic' },
    design_coop: { skillProfile: { creativity: 0.5, focus: 0.25, social: 0.15, repair: 0.1 }, entryRequirements: { creativity: 30, focus: 20 }, family: 'design' }
  });

  function installJobProfiles() {
    Content.JOBS.forEach((job) => {
      const profile = EXISTING_PROFILES[job.id];
      if (profile) Object.assign(job, Core.deepClone(profile));
      if (!job.skillProfile) job.skillProfile = { [job.primarySkill]: 1 };
      if (!job.entryRequirements) job.entryRequirements = { [job.primarySkill]: job.requirement || 0 };
      if (!job.family) job.family = job.id;
      (job.actions || []).forEach((action) => { if (!action.style) action.style = 'work'; });
    });
    EXTRA_JOBS.forEach((definition) => {
      if (!Content.JOBS.some((job) => job.id === definition.id)) Content.JOBS.push(Core.deepClone(definition));
    });
  }

  function emptySkillEvidence() {
    return Object.fromEntries(SKILL_KEYS.map((key) => [key, { events: 0, hours: 0, totalGain: 0, sources: [] }]));
  }

  function freshState() {
    return {
      schema: SCHEMA,
      jobRecords: {},
      skillEvidence: emptySkillEvidence(),
      history: [],
      noSkillDecay: true,
      noCareerDeadline: true,
      noMandatoryPromotion: true
    };
  }

  function ensureState(world) {
    if (world.careerSkills && world.careerSkills.schema !== SCHEMA) {
      throw new Error(`Career/skills state uses unrecognized schema ${String(world.careerSkills.schema || 'unknown')}; refusing to overwrite it.`);
    }
    if (!world.careerSkills) world.careerSkills = freshState();
    SKILL_KEYS.forEach((key) => {
      if (!world.careerSkills.skillEvidence[key]) world.careerSkills.skillEvidence[key] = { events: 0, hours: 0, totalGain: 0, sources: [] };
    });
    return world.careerSkills;
  }

  function peekState(world) {
    if (world.careerSkills?.schema === SCHEMA) return world.careerSkills;
    return freshState();
  }

  function entitySkill(entity, key) {
    return Core.safeNumber(entity?.skills?.[key], 0);
  }

  function skillDefinition(key) {
    return SKILL_DEFINITIONS.find((entry) => entry.id === key) || null;
  }

  function skillTier(value) {
    const amount = Core.clamp(Core.safeNumber(value, 0), 0, 100);
    if (amount < 10) return 'Starting';
    if (amount < 25) return 'Growing';
    if (amount < 45) return 'Practiced';
    if (amount < 65) return 'Skilled';
    if (amount < 82) return 'Deep practice';
    return 'Highly developed';
  }

  function skillSnapshot(entity) {
    return Object.fromEntries(SKILL_KEYS.map((key) => [key, entitySkill(entity, key)]));
  }

  function jobById(jobId) {
    return Content.JOBS.find((job) => job.id === jobId) || null;
  }

  function jobRecord(world, jobId, create = false) {
    const state = create ? ensureState(world) : peekState(world);
    if (!state.jobRecords[jobId] && create) {
      state.jobRecords[jobId] = {
        jobId,
        shifts: 0,
        hours: 0,
        interactiveShifts: 0,
        compressedShifts: 0,
        taskHours: 0,
        tasks: {},
        totalPayObserved: 0,
        firstWorkedDay: null,
        lastWorkedDay: null,
        history: []
      };
    }
    return state.jobRecords[jobId] || null;
  }

  function practiceStage(record) {
    const hours = Core.safeNumber(record?.hours, 0);
    if (hours < 12) return 'New to this work';
    if (hours < 48) return 'Familiar';
    if (hours < 120) return 'Practiced';
    if (hours < 240) return 'Deeply experienced';
    return 'Long-practiced';
  }

  function jobEligibility(world, jobId, entity = world.player) {
    const job = jobById(jobId);
    if (!job) return { ok: false, reason: 'Unknown job.', missing: {}, jobId };
    const requirements = job.entryRequirements || { [job.primarySkill]: job.requirement || 0 };
    const missing = {};
    Object.entries(requirements).forEach(([key, required]) => {
      const current = entitySkill(entity, key);
      if (current < required) missing[key] = Core.round(required - current, 1);
    });
    return {
      ok: Object.keys(missing).length === 0,
      reason: Object.keys(missing).length ? `Needs ${Object.entries(missing).map(([key, amount]) => `${amount} more ${key}`).join(', ')}.` : null,
      missing,
      requirements: { ...requirements },
      jobId
    };
  }

  function jobFit(world, jobId, entity = world.player) {
    const job = jobById(jobId);
    if (!job) return { score: 0, band: 'Unknown', contributions: [] };
    const record = entity.id === 'player' ? jobRecord(world, job.id, false) : null;
    const contributions = Object.entries(job.skillProfile || { [job.primarySkill]: 1 }).map(([key, weight]) => ({
      skill: key,
      weight,
      value: entitySkill(entity, key),
      contribution: entitySkill(entity, key) * weight
    }));
    const skillScore = contributions.reduce((sum, entry) => sum + entry.contribution, 0);
    const experienceSignal = Math.min(15, Core.safeNumber(record?.hours, 0) / 12);
    const score = Core.round(Core.clamp(skillScore * 0.85 + experienceSignal, 0, 100), 1);
    const band = score < 15 ? 'Emerging fit' : score < 30 ? 'Grounded fit' : score < 50 ? 'Strong fit' : score < 70 ? 'Deep fit' : 'Highly developed fit';
    return { score, band, contributions, experienceSignal: Core.round(experienceSignal, 1) };
  }

  function recordSkillDeltas(world, before, after, source = {}) {
    const state = ensureState(world);
    const hours = Math.max(0, Core.safeNumber(source.hours, 0));
    const changed = [];
    SKILL_KEYS.forEach((key) => {
      const delta = Core.round(entitySkill({ skills: after }, key) - entitySkill({ skills: before }, key), 2);
      if (delta <= 0) return;
      const evidence = state.skillEvidence[key];
      evidence.events += 1;
      evidence.hours = Core.round(evidence.hours + hours, 2);
      evidence.totalGain = Core.round(evidence.totalGain + delta, 2);
      evidence.sources.push({
        day: world.time.day,
        type: source.type || 'practice',
        id: source.id || null,
        label: source.label || source.id || 'practice',
        gain: delta,
        hours
      });
      if (evidence.sources.length > 24) evidence.sources.splice(0, evidence.sources.length - 24);
      changed.push({ key, delta });
    });
    return changed;
  }

  function recordTask(world, job, task) {
    const record = jobRecord(world, job.id, true);
    record.taskHours = Core.round(record.taskHours + 1, 2);
    record.tasks[task.id] = (record.tasks[task.id] || 0) + 1;
    record.lastWorkedDay = world.time.day;
  }

  function recordCompletedShift(world, job, mode, pay) {
    const record = jobRecord(world, job.id, true);
    record.shifts += 1;
    record.hours = Core.round(record.hours + job.hours, 2);
    if (mode === 'interactive') record.interactiveShifts += 1;
    else record.compressedShifts += 1;
    record.totalPayObserved = Core.round(record.totalPayObserved + Core.safeNumber(pay, 0), 2);
    if (record.firstWorkedDay == null) record.firstWorkedDay = world.time.day;
    record.lastWorkedDay = world.time.day;
    record.history.push({ type: 'shift', day: world.time.day, mode, hours: job.hours, pay: Core.safeNumber(pay, 0) });
    if (record.history.length > 32) record.history.splice(0, record.history.length - 32);
    return record;
  }

  function addSocialPractice(world, action) {
    const gains = {
      talk: { social: 0.25 },
      spend_time: { social: 0.35 },
      help: { social: 0.2, focus: 0.08 },
      flirt: { social: 0.12 },
      ask_date: { social: 0.15 },
      decor_suggestion: { social: 0.12, creativity: 0.15 }
    };
    const gain = gains[action];
    if (!gain) return;
    Systems.applySkillEffects(world.player, gain);
  }

  function summary(world) {
    const state = peekState(world);
    const currentJob = jobById(world.player.jobId);
    const currentRecord = currentJob ? jobRecord(world, currentJob.id, false) : null;
    return {
      schema: SCHEMA,
      jobCount: Content.JOBS.length,
      skillCount: SKILL_KEYS.length,
      currentJobId: currentJob?.id || null,
      currentJobStage: practiceStage(currentRecord),
      currentJobHours: Core.safeNumber(currentRecord?.hours, 0),
      currentJobShifts: Core.safeNumber(currentRecord?.shifts, 0),
      skillTiers: Object.fromEntries(SKILL_KEYS.map((key) => [key, skillTier(entitySkill(world.player, key))])),
      eligibleJobs: Content.JOBS.filter((job) => jobEligibility(world, job.id).ok).map((job) => job.id),
      noSkillDecay: state.noSkillDecay !== false,
      noCareerDeadline: state.noCareerDeadline !== false,
      noMandatoryPromotion: state.noMandatoryPromotion !== false,
      inspectionMutatesState: false
    };
  }

  function validate(world, add) {
    const state = world.careerSkills;
    if (!state || state.schema !== SCHEMA) return;
    if (!state.noSkillDecay) add('Career state cannot enable skill decay.');
    if (!state.noCareerDeadline) add('Career state cannot create a career deadline.');
    if (!state.noMandatoryPromotion) add('Career state cannot require promotion.');
    Object.entries(state.jobRecords || {}).forEach(([jobId, record]) => {
      if (!jobById(jobId)) add(`Career record references unknown job ${jobId}.`);
      if (Core.safeNumber(record.hours, -1) < 0 || Core.safeNumber(record.shifts, -1) < 0) add(`Career record ${jobId} has invalid hours or shifts.`);
    });
    Object.entries(state.skillEvidence || {}).forEach(([key, evidence]) => {
      if (!SKILL_KEYS.includes(key)) add(`Career evidence references unknown skill ${key}.`);
      if (Core.safeNumber(evidence.totalGain, -1) < 0) add(`Career evidence ${key} has invalid accumulated gain.`);
    });
  }

  installJobProfiles();

  const originalCreateWorld = World.createWorld;
  World.createWorld = function createWorldWithCareerSkills(...args) {
    const world = originalCreateWorld.apply(World, args);
    if (world.player.skills.engineering == null) world.player.skills.engineering = 0;
    world.people.forEach((person) => { if (person.skills.engineering == null) person.skills.engineering = 0; });
    ensureState(world);
    jobRecord(world, world.player.jobId, true);
    return world;
  };

  const originalStartInteractiveShift = Systems.startInteractiveShift;
  Systems.startInteractiveShift = function startInteractiveShiftWithCareer(world, ...args) {
    const result = originalStartInteractiveShift.call(Systems, world, ...args);
    if (result?.ok && world.activeShift) jobRecord(world, world.activeShift.jobId, true);
    return result;
  };

  const originalPerformWorkTask = Systems.performWorkTask;
  Systems.performWorkTask = function performWorkTaskWithCareer(world, taskId, ...args) {
    const shift = world.activeShift;
    const job = shift ? jobById(shift.jobId) : null;
    const task = job?.actions?.find((entry) => entry.id === taskId) || null;
    const before = skillSnapshot(world.player);
    const result = originalPerformWorkTask.call(Systems, world, taskId, ...args);
    if (result?.ok && job && task) {
      recordTask(world, job, task);
      recordSkillDeltas(world, before, skillSnapshot(world.player), { type: 'job_task', id: task.id, label: `${job.name}: ${task.name}`, hours: 1 });
      if (!world.activeShift) recordCompletedShift(world, job, 'interactive', result.pay || 0);
    }
    return result;
  };

  const originalSkipShift = Systems.skipShift;
  Systems.skipShift = function skipShiftWithCareer(world, ...args) {
    const job = jobById(world.player.jobId);
    const before = skillSnapshot(world.player);
    const result = originalSkipShift.call(Systems, world, ...args);
    if (result?.ok && job) {
      recordSkillDeltas(world, before, skillSnapshot(world.player), { type: 'compressed_job', id: job.id, label: `${job.name}: compressed shift`, hours: job.hours });
      recordCompletedShift(world, job, 'compressed', result.pay || 0);
    }
    return result;
  };

  const originalPerformActivity = Systems.performActivity;
  Systems.performActivity = function performActivityWithSkillEvidence(world, actionId, ...args) {
    const activity = Content.activityById(actionId);
    const before = skillSnapshot(world.player);
    const result = originalPerformActivity.call(Systems, world, actionId, ...args);
    if (result?.ok && activity) recordSkillDeltas(world, before, skillSnapshot(world.player), { type: 'life_activity', id: activity.id, label: activity.name, hours: activity.hours });
    return result;
  };

  const originalInteractWithNpc = Systems.interactWithNpc;
  Systems.interactWithNpc = function interactWithNpcWithSkillEvidence(world, npcId, action, options = {}, ...args) {
    const before = skillSnapshot(world.player);
    const result = originalInteractWithNpc.call(Systems, world, npcId, action, options, ...args);
    if (result?.ok) {
      addSocialPractice(world, action);
      recordSkillDeltas(world, before, skillSnapshot(world.player), { type: 'social_practice', id: action, label: Core.titleCase(action.replaceAll('_', ' ')), hours: action === 'spend_time' || action === 'help' ? 2 : 1 });
    }
    return result;
  };

  const originalApplyForJob = Systems.applyForJob;
  Systems.applyForJob = function applyForJobWithTransferableRequirements(world, jobId, ...args) {
    const eligibility = jobEligibility(world, jobId);
    if (!eligibility.ok) return { ok: false, reason: eligibility.reason, eligibility };
    const oldJobId = world.player.jobId;
    const result = originalApplyForJob.call(Systems, world, jobId, ...args);
    if (result?.ok) {
      const state = ensureState(world);
      jobRecord(world, jobId, true);
      state.history.push({ type: 'job_change', day: world.time.day, fromJobId: oldJobId, toJobId: jobId });
      if (state.history.length > 40) state.history.splice(0, state.history.length - 40);
    }
    return result;
  };

  if (typeof Systems.computeMetrics === 'function') {
    const originalComputeMetrics = Systems.computeMetrics;
    Systems.computeMetrics = function computeMetricsWithCareerSkills(world, ...args) {
      return { ...originalComputeMetrics.call(Systems, world, ...args), careerSkills: summary(world) };
    };
  }

  if (typeof Systems.validateWorld === 'function') {
    const originalValidateWorld = Systems.validateWorld;
    Systems.validateWorld = function validateWorldWithCareerSkills(world, ...args) {
      const result = originalValidateWorld.call(Systems, world, ...args);
      const errors = Array.isArray(result?.errors) ? result.errors.slice() : [];
      validate(world, (message) => { if (!errors.includes(message)) errors.push(message); });
      return { ...result, ok: errors.length === 0, errors };
    };
  }

  AXM.CareerSkills = Object.freeze({
    SCHEMA,
    SKILL_KEYS,
    SKILL_DEFINITIONS,
    EXTRA_JOBS,
    ensureState,
    peekState,
    skillDefinition,
    skillTier,
    skillSnapshot,
    jobById,
    jobRecord,
    practiceStage,
    jobEligibility,
    jobFit,
    recordSkillDeltas,
    summary,
    validate
  });
}(typeof window !== 'undefined' ? window : globalThis));