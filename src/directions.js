(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Systems = AXM.Systems;

  const PROJECT_SCHEMA = 'axm.living-city.personal-project/v0.7.0';
  const PROJECT_STATUSES = ['active', 'paused', 'completed', 'released', 'archived'];
  const COLLABORATION_STATUSES = ['pending_npc', 'accepted', 'declined', 'withdrawn'];
  const PROJECT_TYPES = ['restoration', 'making', 'creative', 'collection', 'garden', 'research', 'local_journey', 'learning'];

  const PROJECT_TEMPLATES = [
    {
      id: 'restoration', name: 'Restore something that matters', targetKind: 'object',
      description: 'Choose an object you already own. Repair and preserve it without erasing the marks that make it yours.',
      tags: ['repair', 'history', 'care', 'focus'],
      chapters: [
        { id: 'listen', title: 'Listen to the object first', description: 'Inspect its condition and history before deciding what to change.', hours: 1, money: 0, materials: {}, skillEffects: { focus: 0.5, repair: 0.25 }, needEffects: { mood: 4, energy: -1 }, objectEffects: { sentimental: 2 } },
        { id: 'repair', title: 'Repair the part that limits its life', description: 'Use real materials for a careful intervention instead of replacing the object.', hours: 3, money: 8, materials: { parts: 1 }, skillEffects: { repair: 1.1, focus: 0.35 }, needEffects: { mood: 6, energy: -5 }, objectEffects: { condition: 18, sentimental: 3 } },
        { id: 'preserve', title: 'Preserve its identity', description: 'Finish the work while keeping the object recognizably itself.', hours: 2, money: 4, materials: { paint: 1 }, skillEffects: { creativity: 0.7, repair: 0.45 }, needEffects: { mood: 10, energy: -3 }, objectEffects: { condition: 8, sentimental: 8 } }
      ]
    },
    {
      id: 'making', name: 'Make a strange useful thing', targetKind: 'place',
      description: 'Turn a loose idea into a small physical creation. Usefulness is welcome, not compulsory.',
      tags: ['repair', 'creativity', 'practical'],
      defaultPlaceId: 'place_workshop',
      chapters: [
        { id: 'sketch', title: 'Make the rough idea visible', description: 'Choose a shape and purpose without demanding a perfect plan.', hours: 1, money: 0, materials: {}, skillEffects: { creativity: 0.7, focus: 0.3 }, needEffects: { mood: 5, energy: -1 } },
        { id: 'build', title: 'Build the first honest version', description: 'Use a small amount of material and learn from what resists.', hours: 3, money: 6, materials: { wood: 1, parts: 1 }, skillEffects: { repair: 0.8, creativity: 0.7 }, needEffects: { mood: 8, energy: -5 } },
        { id: 'live_with_it', title: 'Live with what you made', description: 'Adjust it because of real use, not because a quest marker demands polish.', hours: 2, money: 2, materials: {}, skillEffects: { focus: 0.35, repair: 0.4 }, needEffects: { mood: 9, energy: -2 } }
      ]
    },
    {
      id: 'creative', name: 'Create something only you would make', targetKind: 'place',
      description: 'A drawing, sound, story, arrangement, or visual experiment whose value is not reduced to sales or scores.',
      tags: ['creativity', 'story', 'quiet'],
      defaultPlaceId: 'place_library',
      chapters: [
        { id: 'gather', title: 'Gather fragments', description: 'Collect impressions, sounds, colors, memories, or words without forcing them into order.', hours: 2, money: 0, materials: {}, skillEffects: { creativity: 0.8, focus: 0.35 }, needEffects: { mood: 7, energy: -2 } },
        { id: 'shape', title: 'Give the fragments a shape', description: 'Make a version that can exist without needing to be final.', hours: 3, money: 3, materials: { paint: 1 }, skillEffects: { creativity: 1.1, focus: 0.45 }, needEffects: { mood: 9, energy: -5 } },
        { id: 'share_or_keep', title: 'Choose how it should live', description: 'Keep it private, share it, or place it in your history. None is the superior ending.', hours: 1, money: 0, materials: {}, skillEffects: { creativity: 0.35, social: 0.25 }, needEffects: { mood: 11, energy: 0 } }
      ]
    },
    {
      id: 'collection', name: 'Build a collection with a reason', targetKind: 'place',
      description: 'Collect ordinary things because of a personal thread, not artificial rarity or completion pressure.',
      tags: ['focus', 'history', 'neighborhood'],
      chapters: [
        { id: 'meaning', title: 'Decide what connects the pieces', description: 'Name the human or aesthetic reason the collection deserves space.', hours: 1, money: 0, materials: {}, skillEffects: { focus: 0.5, creativity: 0.3 }, needEffects: { mood: 5, energy: -1 } },
        { id: 'find', title: 'Find a few honest pieces', description: 'Look locally and accept that the collection can remain small.', hours: 3, money: 12, materials: {}, skillEffects: { focus: 0.55, social: 0.25 }, needEffects: { mood: 8, energy: -4 } },
        { id: 'arrange', title: 'Give the collection a home', description: 'Arrange it so the connection remains visible without turning it into a checklist.', hours: 2, money: 0, materials: {}, skillEffects: { creativity: 0.65, focus: 0.25 }, needEffects: { mood: 10, energy: -2 } }
      ]
    },
    {
      id: 'garden', name: 'Help a small living place grow', targetKind: 'place',
      description: 'Care for one patch over time. The goal is relationship with a place, not domination over nature.',
      tags: ['outdoors', 'care', 'practical', 'quiet'],
      defaultPlaceId: 'place_park',
      chapters: [
        { id: 'notice', title: 'Notice what is already alive', description: 'Observe light, wear, soil, water, and who already uses the place.', hours: 2, money: 0, materials: {}, skillEffects: { focus: 0.5, cooking: 0.2 }, needEffects: { mood: 9, energy: -2, hygiene: -2 } },
        { id: 'care', title: 'Make one careful intervention', description: 'Use modest resources and avoid treating the whole place as a blank canvas.', hours: 3, money: 5, materials: { wood: 1 }, skillEffects: { repair: 0.45, focus: 0.4 }, needEffects: { mood: 11, energy: -5, hygiene: -4 } },
        { id: 'return', title: 'Return and see what happened', description: 'Let the place answer before deciding whether anything else is needed.', hours: 2, money: 0, materials: {}, skillEffects: { focus: 0.45, creativity: 0.3 }, needEffects: { mood: 12, energy: -2 } }
      ]
    },
    {
      id: 'research', name: 'Follow a question deeply', targetKind: 'place',
      description: 'Trace a question through observations, sources, disagreements, and what remains unknown.',
      tags: ['learning', 'focus', 'source', 'quiet'],
      defaultPlaceId: 'place_library',
      chapters: [
        { id: 'question', title: 'Make the real question visible', description: 'Separate what you are curious about from the answer you hope to find.', hours: 1, money: 0, materials: {}, skillEffects: { focus: 0.7, creativity: 0.25 }, needEffects: { mood: 5, energy: -1 } },
        { id: 'trace', title: 'Trace evidence and disagreement', description: 'Look for source integrity and preserve uncertainty where the evidence does not settle it.', hours: 3, money: 0, materials: {}, skillEffects: { focus: 1.1 }, needEffects: { mood: 7, energy: -5 } },
        { id: 'return', title: 'Return a usable piece', description: 'Turn what you learned into something you or another person can actually use.', hours: 2, money: 0, materials: {}, skillEffects: { focus: 0.55, creativity: 0.45 }, needEffects: { mood: 10, energy: -3 } }
      ]
    },
    {
      id: 'local_journey', name: 'Follow a local thread', targetKind: 'place',
      description: 'Explore a nearby route, person, building, or story without pretending adventure requires distance or danger.',
      tags: ['neighborhood', 'outdoors', 'story', 'social'],
      defaultPlaceId: 'place_square',
      chapters: [
        { id: 'choose', title: 'Choose the thread, not the destination', description: 'Follow a detail that feels alive enough to deserve attention.', hours: 1, money: 0, materials: {}, skillEffects: { focus: 0.35, creativity: 0.4 }, needEffects: { mood: 7, energy: -1 } },
        { id: 'walk', title: 'Let the neighborhood complicate it', description: 'Walk, notice, ask, or sit long enough for the first story to become less simple.', hours: 3, money: 2, materials: {}, skillEffects: { social: 0.45, focus: 0.45 }, needEffects: { mood: 11, social: 3, energy: -5 } },
        { id: 'mark', title: 'Leave an honest trace', description: 'Record what was observed, heard, inferred, disputed, and still unknown.', hours: 2, money: 0, materials: {}, skillEffects: { creativity: 0.5, focus: 0.55 }, needEffects: { mood: 10, energy: -2 } }
      ]
    },
    {
      id: 'learning', name: 'Learn in your own direction', targetKind: 'place',
      description: 'Choose a capability because it opens agency or joy, not because age or status says you are late.',
      tags: ['learning', 'practical', 'focus', 'agency'],
      defaultPlaceId: 'place_school',
      chapters: [
        { id: 'why', title: 'Name why this matters to you', description: 'Connect the skill to a life you actually want rather than a generic achievement.', hours: 1, money: 0, materials: {}, skillEffects: { focus: 0.45 }, needEffects: { mood: 5, energy: -1 } },
        { id: 'practice', title: 'Practice one grounded piece', description: 'Use a small real exercise instead of grinding an abstract bar.', hours: 3, money: 0, materials: {}, skillEffects: { focus: 0.75, repair: 0.25, creativity: 0.25 }, needEffects: { mood: 8, energy: -5 } },
        { id: 'use', title: 'Use it somewhere that matters', description: 'Connect the capability back to an object, person, place, or future choice.', hours: 2, money: 0, materials: {}, skillEffects: { focus: 0.45, social: 0.2 }, needEffects: { mood: 10, energy: -2 } }
      ]
    }
  ];

  function templateById(id) {
    return PROJECT_TEMPLATES.find((entry) => entry.id === id) || null;
  }

  function stableRoll(text) {
    return (Core.hashString(text) % 10000) / 100;
  }

  function ensureMetric(world, key) {
    if (!world.metrics || typeof world.metrics !== 'object') world.metrics = {};
    if (!Number.isFinite(world.metrics[key])) world.metrics[key] = 0;
  }

  function ensureState(world) {
    if (!Array.isArray(world.personalProjects)) world.personalProjects = [];
    if (!world.settings || typeof world.settings !== 'object') world.settings = {};
    if (!['choice', 'calendar'].includes(world.settings.lifeCourseMode)) world.settings.lifeCourseMode = 'choice';
    if (typeof world.settings.showExactAges !== 'boolean') world.settings.showExactAges = false;
    world.settings.agePressure = false;
    if (!world.ui || typeof world.ui !== 'object') world.ui = {};
    if (world.ui.selectedPersonalProjectId === undefined) world.ui.selectedPersonalProjectId = null;
    if (!world.flags || typeof world.flags !== 'object') world.flags = {};
    if (world.flags.personalDirectionsExperimentPrepared === undefined) world.flags.personalDirectionsExperimentPrepared = false;
    if (world.flags.personalDirectionsFoundationLogged === undefined) world.flags.personalDirectionsFoundationLogged = false;
    [
      'personalProjectsCreated', 'personalProjectChaptersCompleted', 'personalProjectsPaused',
      'personalProjectsResumed', 'personalProjectsReshaped', 'personalProjectsCompleted',
      'personalProjectsReleased', 'personalProjectsArchived', 'projectCollaborationInvites',
      'projectCollaborationsAccepted', 'projectCollaborationsDeclined', 'npcPersonalProjectsCreated',
      'npcPersonalProjectChaptersCompleted', 'npcPersonalProjectsCompleted', 'npcPersonalProjectsReleased',
      'projectMoneySpent', 'projectMaterialsSpent', 'lifeChapterChoices'
    ].forEach((key) => ensureMetric(world, key));
    [world.player].concat(world.people || []).forEach((person) => {
      if (!person) return;
      if (!Number.isFinite(person.personalProjectCooldownUntil)) person.personalProjectCooldownUntil = 0;
      if (!Array.isArray(person.personalProjectIds)) person.personalProjectIds = [];
    });
    return world;
  }

  function initializeWorld(world, options = {}) {
    ensureState(world);
    if (!options.silent && !world.flags.personalDirectionsFoundationLogged) {
      Core.appendLedger(world, 'direction', 'Personal directions were initialized as undated, age-free projects. Ordinary life remains complete without an active project.', {
        causes: ['explicit v0.7 foundation', 'no age deadline', 'no productivity streak', 'meaning before optimization'],
        evidence: { lifeCourseMode: world.settings.lifeCourseMode, agePressure: false, projectCount: world.personalProjects.length }
      });
      world.flags.personalDirectionsFoundationLogged = true;
    }
    return world;
  }

  function projectById(world, projectId) {
    ensureState(world);
    return world.personalProjects.find((entry) => entry.id === projectId) || null;
  }

  function projectsFor(world, ownerId, statuses = null) {
    return world.personalProjects.filter((entry) => entry.ownerId === ownerId && (!statuses || statuses.includes(entry.status)));
  }

  function findOwnedObject(world, ownerId, objectId) {
    for (const property of world.places.filter((place) => place.kind === 'residential')) {
      const object = (property.furniture || []).find((entry) => entry.id === objectId && entry.ownerId === ownerId && entry.ownershipMode !== 'property_fixture');
      if (object) return { object, property, stored: false };
    }
    const owner = World.getPerson(world, ownerId);
    const object = (owner?.storedFurniture || []).find((entry) => entry.id === objectId && entry.ownerId === ownerId);
    return object ? { object, property: null, stored: true } : null;
  }

  function ownedObjects(world, ownerId) {
    const records = [];
    world.places.filter((place) => place.kind === 'residential').forEach((property) => {
      (property.furniture || []).filter((object) => object.ownerId === ownerId && object.ownershipMode !== 'property_fixture')
        .forEach((object) => records.push({ object, property, stored: false }));
    });
    const owner = World.getPerson(world, ownerId);
    (owner?.storedFurniture || []).filter((object) => object.ownerId === ownerId)
      .forEach((object) => records.push({ object, property: null, stored: true }));
    return records;
  }

  function appendProjectHistory(world, project, type, message, details = {}) {
    if (!Array.isArray(project.history)) project.history = [];
    const entry = {
      id: Core.uniqueId(world, 'project_event'),
      day: world.time.day,
      hour: world.time.hour,
      type,
      message,
      actorIds: Array.isArray(details.actorIds) ? details.actorIds.slice() : [],
      chapterId: details.chapterId || null,
      causes: Array.isArray(details.causes) ? details.causes.slice() : [],
      evidence: details.evidence || null
    };
    project.history.push(entry);
    if (project.history.length > 240) project.history.splice(0, project.history.length - 240);
    project.updatedDay = world.time.day;
    return entry;
  }

  function dynamicRestorationMaterials(object, chapterIndex, base) {
    if (!object || chapterIndex === 0) return Core.deepClone(base || {});
    const definition = Content.furnitureById(object.catalogId);
    const category = definition?.category || 'decor';
    if (chapterIndex === 1) {
      if (['seat', 'sleep', 'decor'].includes(category)) return { fabric: 1, wood: 1 };
      if (['activity', 'light', 'utility'].includes(category)) return { parts: 1, metal: 1 };
      return { wood: 1, parts: 1 };
    }
    if (chapterIndex === 2) {
      return ['seat', 'sleep'].includes(category) ? { fabric: 1, paint: 1 } : { paint: 1 };
    }
    return Core.deepClone(base || {});
  }

  function buildChapters(template, targetObject = null) {
    return template.chapters.map((chapter, index) => ({
      ...Core.deepClone(chapter),
      materials: template.id === 'restoration' ? dynamicRestorationMaterials(targetObject, index, chapter.materials) : Core.deepClone(chapter.materials || {}),
      status: index === 0 ? 'open' : 'locked',
      completedDay: null,
      completedHour: null,
      contribution: null
    }));
  }

  function targetFor(world, ownerId, template, options = {}) {
    if (template.targetKind === 'object') {
      const found = findOwnedObject(world, ownerId, options.targetObjectId);
      if (!found) return { ok: false, reason: 'Choose an object this person actually owns. Property fixtures and other people’s belongings cannot become a personal project target.' };
      const definition = Content.furnitureById(found.object.catalogId);
      return {
        ok: true,
        target: {
          kind: 'object',
          objectId: found.object.id,
          objectCatalogId: found.object.catalogId,
          label: definition?.name || found.object.catalogId,
          propertyId: found.property?.id || null,
          storedAtCreation: found.stored,
          ownershipAtCreation: found.object.ownerId,
          provenance: 'existing owned object selected without cloning or ownership transfer'
        },
        object: found.object
      };
    }
    const placeId = options.targetPlaceId || template.defaultPlaceId || World.getPerson(world, ownerId)?.homePropertyId || 'place_square';
    const place = World.getPlace(world, placeId);
    if (!place) return { ok: false, reason: 'Choose a real place in the current town.' };
    return {
      ok: true,
      target: {
        kind: 'place', placeId: place.id, label: place.name,
        provenance: 'existing world place referenced without granting ownership or edit authority'
      },
      object: null
    };
  }

  function projectFit(world, person, template) {
    if (!person || !template) return 0;
    let score = 10;
    template.tags.forEach((tag) => {
      if (tag === 'repair' || tag === 'practical') score += Core.safeNumber(person.skills?.repair, 0) * 0.18;
      if (tag === 'creativity' || tag === 'story') score += Core.safeNumber(person.skills?.creativity, 0) * 0.18 + Core.safeNumber(person.traits?.creativity, 0) * 0.08;
      if (tag === 'social') score += Core.safeNumber(person.skills?.social, 0) * 0.12 + Core.safeNumber(person.traits?.social, 0) * 0.08;
      if (tag === 'focus' || tag === 'learning' || tag === 'source') score += Core.safeNumber(person.skills?.focus, 0) * 0.16;
      if (tag === 'quiet') score += Math.max(0, 65 - Core.safeNumber(person.traits?.social, 50)) * 0.08;
      if (tag === 'outdoors' || tag === 'neighborhood') score += Core.safeNumber(person.traits?.independence, 50) * 0.06;
    });
    if (String(person.personalGoal || '').toLowerCase().includes('learn') && template.id === 'learning') score += 18;
    if (String(person.personalGoal || '').toLowerCase().includes('make') && ['making', 'creative'].includes(template.id)) score += 18;
    return Core.round(score, 2);
  }

  function chooseNpcTemplate(world, person) {
    const recent = new Set(projectsFor(world, person.id).slice(-4).map((entry) => entry.templateId));
    const objects = ownedObjects(world, person.id);
    const ranked = PROJECT_TEMPLATES
      .filter((template) => template.id !== 'restoration' || objects.length)
      .map((template) => ({ template, score: projectFit(world, person, template) - (recent.has(template.id) ? 25 : 0) + stableRoll(`${world.seed}|${world.time.day}|${person.id}|${template.id}|project`) * 22 }))
      .sort((a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id));
    return ranked[0]?.template || PROJECT_TEMPLATES.find((entry) => entry.id === 'local_journey');
  }

  function chooseNpcTargetObject(world, person) {
    const objects = ownedObjects(world, person.id);
    if (!objects.length) return null;
    return objects.slice().sort((a, b) => {
      const aScore = (100 - a.object.condition) + a.object.sentimental * 0.5;
      const bScore = (100 - b.object.condition) + b.object.sentimental * 0.5;
      return bScore - aScore || a.object.id.localeCompare(b.object.id);
    })[0].object;
  }

  function createPersonalProject(world, options = {}, ownerId = 'player') {
    ensureState(world);
    const owner = World.getPerson(world, ownerId);
    if (!owner) return { ok: false, reason: 'Unknown project owner.' };
    const template = templateById(options.templateId) || (ownerId === 'player' ? null : chooseNpcTemplate(world, owner));
    if (!template) return { ok: false, reason: 'Choose a project direction.' };
    const title = String(options.title || (ownerId === 'player' ? template.name : `${owner.name} — ${template.name}`)).trim().slice(0, 80);
    const meaning = String(options.meaning || (ownerId === 'player' ? '' : `This matters to ${owner.name} because it fits their interests and current life rather than an age timetable.`)).trim().slice(0, 320);
    if (!title) return { ok: false, reason: 'Give the project a title that feels like yours.' };
    if (!meaning) return { ok: false, reason: 'Name why the project matters. Meaning stays separate from efficiency statistics.' };
    let targetObjectId = options.targetObjectId;
    if (template.id === 'restoration' && !targetObjectId && ownerId !== 'player') targetObjectId = chooseNpcTargetObject(world, owner)?.id;
    const targetResult = targetFor(world, ownerId, template, { ...options, targetObjectId });
    if (!targetResult.ok) return targetResult;
    const project = {
      schema: PROJECT_SCHEMA,
      id: Core.uniqueId(world, 'personal_project'),
      ownerId,
      templateId: template.id,
      type: template.id,
      title,
      meaning,
      status: 'active',
      createdDay: world.time.day,
      createdHour: world.time.hour,
      updatedDay: world.time.day,
      pausedDay: null,
      completedDay: null,
      releasedDay: null,
      archivedDay: null,
      noDeadline: true,
      noAgeGate: true,
      ageGate: null,
      lifeContext: {
        stageAtCreation: owner.lifeCourse?.stage || null,
        modeAtCreation: world.settings.lifeCourseMode,
        exactAgeRequired: false
      },
      target: targetResult.target,
      tags: template.tags.slice(),
      stageIndex: 0,
      chapters: buildChapters(template, targetResult.object),
      collaboratorIds: [],
      collaborationRequests: [],
      reshapes: [],
      evidence: {
        hoursWorked: 0,
        moneySpent: 0,
        materialsSpent: {},
        objectHistoryEntries: 0,
        collaboratorHours: 0
      },
      history: []
    };
    world.personalProjects.push(project);
    owner.personalProjectIds.push(project.id);
    if (ownerId === 'player') {
      world.metrics.personalProjectsCreated += 1;
      world.ui.selectedPersonalProjectId = project.id;
    } else {
      world.metrics.npcPersonalProjectsCreated += 1;
      owner.personalProjectCooldownUntil = world.time.day + 18 + (Core.hashString(project.id) % 30);
    }
    appendProjectHistory(world, project, 'created', `${owner.name} opened “${title}” as an undated personal direction.`, {
      actorIds: [ownerId], causes: ['self-authored meaning', 'no age gate', 'no deadline'],
      evidence: { templateId: template.id, target: Core.deepClone(project.target), meaning }
    });
    Core.appendLedger(world, 'direction', `${owner.name} began ${title}. It has no deadline, age gate, or hidden abandonment penalty.`, {
      actorIds: [ownerId], placeId: project.target.placeId || project.target.propertyId || null,
      objectId: project.target.objectId || null,
      causes: ['personal direction', 'meaning before optimization'], evidence: { projectId: project.id, templateId: template.id }
    });
    if (ownerId === 'player') Systems.toast(world, `${title} is yours to follow, pause, reshape, finish, or release.`, 'success');
    return { ok: true, project };
  }

  function materialCost(materials) {
    return Object.entries(materials || {}).reduce((sum, [id, amount]) => sum + Core.safeNumber(Content.MATERIALS[id]?.unitPrice, 0) * amount, 0);
  }

  function recordMaterialSpend(world, project, materials) {
    Object.entries(materials || {}).forEach(([id, amount]) => {
      project.evidence.materialsSpent[id] = Core.safeNumber(project.evidence.materialsSpent[id], 0) + amount;
      world.metrics.projectMaterialsSpent += amount;
    });
  }

  function currentChapter(project) {
    return project?.chapters?.[project.stageIndex] || null;
  }

  function applyObjectChapter(world, project, chapter, ownerId) {
    if (project.target.kind !== 'object') return null;
    const found = findOwnedObject(world, ownerId, project.target.objectId);
    if (!found) return { ok: false, reason: 'The target object is no longer attributable to the project owner. Work stopped rather than silently redirecting to another object.' };
    const before = { condition: found.object.condition, sentimental: found.object.sentimental };
    const effects = chapter.objectEffects || {};
    found.object.condition = Core.clamp(found.object.condition + Core.safeNumber(effects.condition, 0), 0, 100);
    found.object.sentimental = Core.clamp(found.object.sentimental + Core.safeNumber(effects.sentimental, 0), 0, 100);
    Core.appendObjectHistory(world, found.object, 'personal_project', `${World.personName(world, ownerId)} completed “${chapter.title}” within ${project.title}.`, {
      actorId: ownerId,
      causes: [`project:${project.id}`, `chapter:${chapter.id}`, 'object identity preserved']
    });
    project.evidence.objectHistoryEntries += 1;
    return { ok: true, object: found.object, before, after: { condition: found.object.condition, sentimental: found.object.sentimental } };
  }

  function acceptedCollaborators(world, project) {
    return (project.collaboratorIds || []).map((id) => World.getPerson(world, id)).filter(Boolean);
  }

  function workPersonalProject(world, projectId, options = {}) {
    ensureState(world);
    const project = projectById(world, projectId);
    if (!project) return { ok: false, reason: 'Unknown personal project.' };
    const owner = World.getPerson(world, project.ownerId);
    if (!owner) return { ok: false, reason: 'Project owner is unavailable.' };
    if (project.status === 'paused') return { ok: false, reason: 'This project is paused. Resume it only when it feels alive again.' };
    if (project.status !== 'active') return { ok: false, reason: `This project is ${project.status}.` };
    const chapter = currentChapter(project);
    if (!chapter) return { ok: false, reason: 'The next project chapter is missing.' };
    const playerOwned = project.ownerId === 'player';
    if (playerOwned && world.activeShift) return { ok: false, reason: 'Finish the active workday first. The project waits without a deadline.' };
    if (project.target.kind === 'object' && !findOwnedObject(world, owner.id, project.target.objectId)) {
      return { ok: false, reason: 'The target object is no longer attributable to the project owner. No time, money, or materials were consumed.' };
    }

    const materials = chapter.materials || {};
    let procurement = 0;
    if (playerOwned) {
      const missing = Core.availableMaterialCheck(world.player.materials, materials);
      if (Core.hasMissingMaterials(missing)) {
        const text = Object.entries(missing).map(([id, amount]) => `${amount} ${Content.MATERIALS[id]?.name || id}`).join(', ');
        return { ok: false, reason: `This chapter waits for ${text}. Nothing expires while you gather it.` };
      }
      if (world.player.money < chapter.money) return { ok: false, reason: 'You cannot currently cover this optional chapter. It waits without penalty.' };
      world.player.money -= chapter.money;
      world.player.lifetimeSpend += chapter.money;
      Core.consumeMaterials(world.player.materials, materials);
    } else {
      procurement = materialCost(materials);
      const total = chapter.money + procurement;
      if (owner.money < total) return { ok: false, reason: 'The resident cannot currently fund this chapter.' };
      owner.money -= total;
    }

    project.evidence.moneySpent = Core.round(project.evidence.moneySpent + chapter.money + procurement, 2);
    world.metrics.projectMoneySpent = Core.round(world.metrics.projectMoneySpent + chapter.money + procurement, 2);
    recordMaterialSpend(world, project, materials);
    if (playerOwned) {
      const collaborators = acceptedCollaborators(world, project);
      const support = Math.min(0.35, collaborators.length * 0.12);
      Systems.advanceHours(world, chapter.hours);
      Systems.applyNeedEffects(owner, { ...(chapter.needEffects || {}), energy: Core.safeNumber(chapter.needEffects?.energy, 0) * (1 - support) });
      Systems.applySkillEffects(owner, chapter.skillEffects || {});
      project.evidence.collaboratorHours += Core.round(chapter.hours * support, 2);
    } else {
      Systems.applyNeedEffects(owner, chapter.needEffects || {});
      Systems.applySkillEffects(owner, Object.fromEntries(Object.entries(chapter.skillEffects || {}).map(([id, value]) => [id, value * 0.7])));
    }

    const objectResult = applyObjectChapter(world, project, chapter, owner.id);
    if (objectResult && !objectResult.ok) return objectResult;
    chapter.status = 'completed';
    chapter.completedDay = world.time.day;
    chapter.completedHour = world.time.hour;
    chapter.contribution = {
      ownerHours: chapter.hours,
      collaboratorIds: project.collaboratorIds.slice(),
      materialSource: playerOwned ? 'player inventory' : 'recorded local procurement',
      money: chapter.money + procurement
    };
    project.evidence.hoursWorked += chapter.hours;
    project.stageIndex += 1;
    if (project.chapters[project.stageIndex]) project.chapters[project.stageIndex].status = 'open';
    if (playerOwned) world.metrics.personalProjectChaptersCompleted += 1;
    else world.metrics.npcPersonalProjectChaptersCompleted += 1;

    const collaboratorIds = project.collaboratorIds.slice();
    collaboratorIds.forEach((personId) => {
      AXM.Community?.ensureConnection(world, owner.id, personId, 'creative_partner', {
        message: `${owner.name} and ${World.personName(world, personId)} shared a chapter of ${project.title}.`,
        causes: ['accepted collaboration', 'project work did not transfer ownership'],
        evidence: { projectId: project.id, chapterId: chapter.id }
      });
    });
    appendProjectHistory(world, project, 'chapter_completed', `${owner.name} completed “${chapter.title}” without creating a deadline for what comes next.`, {
      actorIds: [owner.id].concat(collaboratorIds), chapterId: chapter.id,
      causes: ['explicit project work', 'real time and resources', 'no age requirement'],
      evidence: { hours: chapter.hours, money: chapter.money + procurement, materials: Core.deepClone(materials), objectChange: objectResult ? { before: objectResult.before, after: objectResult.after } : null }
    });

    if (project.stageIndex >= project.chapters.length) {
      project.status = 'completed';
      project.completedDay = world.time.day;
      if (playerOwned) world.metrics.personalProjectsCompleted += 1;
      else world.metrics.npcPersonalProjectsCompleted += 1;
      appendProjectHistory(world, project, 'completed', `${project.title} became a completed piece of ${owner.name}’s history. It did not unlock a compulsory next tier.`, {
        actorIds: [owner.id].concat(collaboratorIds), causes: ['all chosen chapters lived', 'no productivity ladder']
      });
      Core.appendLedger(world, 'direction', `${owner.name} completed ${project.title}. Its meaning and provenance remain inspectable; no new obligation was created.`, {
        actorIds: [owner.id].concat(collaboratorIds), placeId: project.target.placeId || project.target.propertyId || null,
        objectId: project.target.objectId || null, causes: ['personal completion', 'no mandatory unlock'], evidence: { projectId: project.id }
      });
      if (playerOwned) Systems.toast(world, `${project.title} is complete. You owe the game no next project.`, 'success');
    } else if (playerOwned) {
      Systems.toast(world, `${chapter.title} is part of the history now. The next chapter waits without a clock.`, 'success');
    }
    return { ok: true, project, chapter, objectResult };
  }

  function pausePersonalProject(world, projectId) {
    const project = projectById(world, projectId);
    if (!project || project.ownerId !== 'player') return { ok: false, reason: 'Unknown personal project.' };
    if (project.status !== 'active') return { ok: false, reason: `Only an active project can be paused; this one is ${project.status}.` };
    const before = { money: world.player.money, needs: Core.deepClone(world.player.needs), skills: Core.deepClone(world.player.skills) };
    project.status = 'paused';
    project.pausedDay = world.time.day;
    world.metrics.personalProjectsPaused += 1;
    appendProjectHistory(world, project, 'paused', `${world.player.name} paused the project without losing progress, resources already used, mood, skill, or social standing.`, {
      actorIds: ['player'], causes: ['explicit pause', 'rest and changing attention are valid'], evidence: { hiddenPenalty: false, playerStateBefore: before }
    });
    Systems.toast(world, `${project.title} paused. It can remain quiet indefinitely.`, 'info');
    return { ok: true, project };
  }

  function resumePersonalProject(world, projectId) {
    const project = projectById(world, projectId);
    if (!project || project.ownerId !== 'player') return { ok: false, reason: 'Unknown personal project.' };
    if (project.status !== 'paused') return { ok: false, reason: `Only a paused project can be resumed; this one is ${project.status}.` };
    project.status = 'active';
    project.pausedDay = null;
    world.metrics.personalProjectsResumed += 1;
    appendProjectHistory(world, project, 'resumed', `${world.player.name} returned because the project felt worth returning to, not because a timer demanded it.`, {
      actorIds: ['player'], causes: ['explicit return', 'no inactivity penalty']
    });
    Systems.toast(world, `${project.title} is active again.`, 'success');
    return { ok: true, project };
  }

  function reshapePersonalProject(world, projectId, title, meaning) {
    const project = projectById(world, projectId);
    if (!project || project.ownerId !== 'player') return { ok: false, reason: 'Unknown personal project.' };
    if (!['active', 'paused'].includes(project.status)) return { ok: false, reason: 'Only an open project can be reshaped.' };
    const cleanTitle = String(title || '').trim().slice(0, 80);
    const cleanMeaning = String(meaning || '').trim().slice(0, 320);
    if (!cleanTitle || !cleanMeaning) return { ok: false, reason: 'A reshaped project still needs a title and a reason that matters to you.' };
    const previous = { title: project.title, meaning: project.meaning, day: world.time.day };
    project.title = cleanTitle;
    project.meaning = cleanMeaning;
    project.reshapes.push(previous);
    world.metrics.personalProjectsReshaped += 1;
    appendProjectHistory(world, project, 'reshaped', `The project became “${cleanTitle}” without deleting its earlier direction or completed chapters.`, {
      actorIds: ['player'], causes: ['explicit reinterpretation', 'history preserved'], evidence: { previous }
    });
    Systems.toast(world, 'Project direction reshaped; earlier history remains.', 'success');
    return { ok: true, project };
  }

  function releasePersonalProject(world, projectId) {
    const project = projectById(world, projectId);
    if (!project || project.ownerId !== 'player') return { ok: false, reason: 'Unknown personal project.' };
    if (!['active', 'paused'].includes(project.status)) return { ok: false, reason: `This project is already ${project.status}.` };
    project.status = 'released';
    project.releasedDay = world.time.day;
    world.metrics.personalProjectsReleased += 1;
    appendProjectHistory(world, project, 'released', `${world.player.name} released the direction. Completed work and provenance remain; no failure, mood loss, reputation loss, or age penalty was added.`, {
      actorIds: ['player'], causes: ['explicit release', 'project is not obligation'], evidence: { hiddenPenalty: false }
    });
    Systems.toast(world, `${project.title} released without punishment.`, 'info');
    return { ok: true, project };
  }

  function archivePersonalProject(world, projectId) {
    const project = projectById(world, projectId);
    if (!project || project.ownerId !== 'player') return { ok: false, reason: 'Unknown personal project.' };
    if (!['completed', 'released'].includes(project.status)) return { ok: false, reason: 'Finish or release the project before archiving its history.' };
    const previousStatus = project.status;
    project.status = 'archived';
    project.archivedDay = world.time.day;
    world.metrics.personalProjectsArchived += 1;
    appendProjectHistory(world, project, 'archived', `${project.title} moved into the personal archive without erasing whether it was completed or released.`, {
      actorIds: ['player'], causes: ['explicit organization', 'history retained'], evidence: { previousStatus }
    });
    Systems.toast(world, `${project.title} archived.`, 'info');
    return { ok: true, project };
  }

  function connectionBetween(world, aId, bId) {
    return (world.communityConnections || []).find((entry) => entry.status === 'active' && entry.personIds.includes(aId) && entry.personIds.includes(bId)) || null;
  }

  function inviteProjectCollaborator(world, projectId, personId) {
    const project = projectById(world, projectId);
    if (!project || project.ownerId !== 'player') return { ok: false, reason: 'Choose one of your open projects.' };
    if (!['active', 'paused'].includes(project.status)) return { ok: false, reason: 'This project is no longer open to a new collaboration.' };
    const person = World.getPerson(world, personId);
    if (!person || person.id === 'player') return { ok: false, reason: 'Choose another real resident.' };
    const connection = connectionBetween(world, 'player', personId);
    if (!connection) return { ok: false, reason: 'Collaboration invitations are currently limited to people you have actually met through lived community history.' };
    if (project.collaboratorIds.includes(personId)) return { ok: false, reason: `${person.name} already chose to collaborate.` };
    const existing = project.collaborationRequests.find((entry) => entry.personId === personId && entry.status === 'pending_npc');
    if (existing) return { ok: false, reason: `${person.name} is already considering this invitation.` };
    const request = {
      id: Core.uniqueId(world, 'project_collaboration'),
      personId,
      status: 'pending_npc',
      createdDay: world.time.day,
      createdHour: world.time.hour,
      dueDay: world.time.day + 1,
      responseDay: null,
      evidence: null
    };
    project.collaborationRequests.push(request);
    world.metrics.projectCollaborationInvites += 1;
    appendProjectHistory(world, project, 'collaboration_invited', `${world.player.name} invited ${person.name}. Sending the invitation created no consent or shared ownership.`, {
      actorIds: ['player', person.id], causes: ['explicit invitation', 'answer remains autonomous'], evidence: { requestId: request.id }
    });
    Systems.toast(world, `${person.name} will answer later. The project remains yours either way.`, 'info');
    return { ok: true, project, request };
  }

  function resolveCollaborationRequests(world) {
    world.personalProjects.forEach((project) => {
      project.collaborationRequests.filter((entry) => entry.status === 'pending_npc' && world.time.day >= entry.dueDay).forEach((request) => {
        const person = World.getPerson(world, request.personId);
        const template = templateById(project.templateId);
        const connection = connectionBetween(world, project.ownerId, request.personId);
        if (!person || !template || !connection || !['active', 'paused'].includes(project.status)) {
          request.status = 'withdrawn';
          request.responseDay = world.time.day;
          request.evidence = { reason: 'project or connection no longer open' };
          return;
        }
        const score = Core.clamp(18 + projectFit(world, person, template) * 0.45 + connection.warmth * 0.22 + connection.trust * 0.22, 0, 100);
        const roll = stableRoll(`${world.seed}|${project.id}|${person.id}|collaboration`);
        const accepted = score >= roll;
        request.status = accepted ? 'accepted' : 'declined';
        request.responseDay = world.time.day;
        request.evidence = { score: Core.round(score, 2), roll: Core.round(roll, 2), relationshipPenalty: 0, ownershipTransfer: false };
        if (accepted) {
          if (!project.collaboratorIds.includes(person.id)) project.collaboratorIds.push(person.id);
          world.metrics.projectCollaborationsAccepted += 1;
        } else {
          world.metrics.projectCollaborationsDeclined += 1;
        }
        appendProjectHistory(world, project, accepted ? 'collaboration_accepted' : 'collaboration_declined', `${person.name} ${accepted ? 'chose to join' : 'declined'} the collaboration. ${accepted ? 'Their participation grants no ownership over the project target.' : 'No hidden relationship or progression penalty was added.'}`, {
          actorIds: [project.ownerId, person.id], causes: [accepted ? 'autonomous acceptance' : 'autonomous refusal'], evidence: request.evidence
        });
      });
    });
  }

  function npcProjectDailyTick(world) {
    const activeNpc = world.personalProjects.filter((entry) => entry.ownerId !== 'player' && ['active', 'paused'].includes(entry.status));
    const activeOwners = new Set(activeNpc.map((entry) => entry.ownerId));
    if (activeNpc.length < 14) {
      world.people.forEach((person) => {
        if (activeOwners.has(person.id) || world.time.day < person.personalProjectCooldownUntil) return;
        const probability = 0.018 + Core.safeNumber(person.traits?.creativity, 50) / 10000;
        if (stableRoll(`${world.seed}|${world.time.day}|${person.id}|personal-project-start`) >= probability * 100) return;
        const template = chooseNpcTemplate(world, person);
        const result = createPersonalProject(world, { templateId: template.id }, person.id);
        if (result.ok) activeOwners.add(person.id);
      });
    }

    world.personalProjects.filter((entry) => entry.ownerId !== 'player' && ['active', 'paused'].includes(entry.status)).forEach((project) => {
      const owner = World.getPerson(world, project.ownerId);
      if (!owner) return;
      if (project.status === 'paused') {
        if (stableRoll(`${world.seed}|${world.time.day}|${project.id}|resume`) < 12) {
          project.status = 'active';
          appendProjectHistory(world, project, 'resumed', `${owner.name} returned to the project in their own time.`, { actorIds: [owner.id], causes: ['autonomous return', 'no age pressure'] });
        } else if (world.time.day - (project.pausedDay || project.createdDay) > 28 && stableRoll(`${world.seed}|${world.time.day}|${project.id}|release`) < 6) {
          project.status = 'released';
          project.releasedDay = world.time.day;
          world.metrics.npcPersonalProjectsReleased += 1;
          appendProjectHistory(world, project, 'released', `${owner.name} released the project without being marked as a failure.`, { actorIds: [owner.id], causes: ['autonomous change of direction'] });
        }
        return;
      }
      const workRoll = stableRoll(`${world.seed}|${world.time.day}|${project.id}|work`);
      if (workRoll >= 18) return;
      const result = workPersonalProject(world, project.id, { autonomous: true });
      if (!result.ok) {
        if (stableRoll(`${world.seed}|${world.time.day}|${project.id}|pause`) < 35) {
          project.status = 'paused';
          project.pausedDay = world.time.day;
          appendProjectHistory(world, project, 'paused', `${owner.name} paused because the next step did not fit their present resources.`, {
            actorIds: [owner.id], causes: ['resource fit', 'no deadline'], evidence: { reason: result.reason }
          });
        }
      }
    });
  }

  function dailyTick(world) {
    ensureState(world);
    resolveCollaborationRequests(world);
    npcProjectDailyTick(world);
  }

  function preparePersonalDirectionsExperiment(world) {
    ensureState(world);
    if (world.flags.personalDirectionsExperimentPrepared) return { ok: false, reason: 'The labeled personal-directions experiment was already prepared in this save.' };
    world.player.money = Math.max(world.player.money, 2500);
    Object.keys(world.player.materials || {}).forEach((key) => { world.player.materials[key] = Math.max(world.player.materials[key], 4); });
    const candidates = ownedObjects(world, 'player').sort((a, b) => (b.object.sentimental + (100 - b.object.condition)) - (a.object.sentimental + (100 - a.object.condition)));
    const target = candidates[0];
    if (!target) return { ok: false, reason: 'No player-owned object exists for the restoration experiment.' };
    const definition = Content.furnitureById(target.object.catalogId);
    const result = createPersonalProject(world, {
      templateId: 'restoration',
      targetObjectId: target.object.id,
      title: `Keep ${definition?.name || 'this object'} alive`,
      meaning: 'This object matters because its history should become deeper through care, not disappear through replacement.'
    });
    if (!result.ok) return result;
    const first = workPersonalProject(world, result.project.id);
    if (!first.ok) return first;
    let invitedId = null;
    const connection = (world.communityConnections || []).find((entry) => entry.status === 'active' && entry.personIds.includes('player'));
    if (connection) {
      invitedId = connection.personIds.find((id) => id !== 'player');
      inviteProjectCollaborator(world, result.project.id, invitedId);
    }
    world.flags.personalDirectionsExperimentPrepared = true;
    appendProjectHistory(world, result.project, 'experiment_prepared', 'A labeled restoration experiment was prepared through the real object, material, time, history, and optional collaboration systems.', {
      actorIds: ['player', invitedId].filter(Boolean), causes: ['explicit QA shortcut', 'not normal progression'], evidence: { targetObjectId: target.object.id, invitedId }
    });
    Core.appendLedger(world, 'research', 'Personal-directions experiment prepared. Automatic aging remained off and no project deadline was created.', {
      actorIds: ['player', invitedId].filter(Boolean), objectId: target.object.id,
      causes: ['explicit labeled experiment', 'choice-first life course'], evidence: { projectId: result.project.id, lifeCourseMode: world.settings.lifeCourseMode }
    });
    Systems.toast(world, 'Undated restoration experiment prepared with one real chapter already lived.', 'warning');
    return { ok: true, projectId: result.project.id, objectId: target.object.id, invitedId };
  }

  function metrics(world) {
    ensureState(world);
    const playerProjects = projectsFor(world, 'player');
    const npcProjects = world.personalProjects.filter((entry) => entry.ownerId !== 'player');
    const pending = playerProjects.flatMap((entry) => entry.collaborationRequests || []).filter((entry) => entry.status === 'pending_npc');
    return {
      playerOpen: playerProjects.filter((entry) => ['active', 'paused'].includes(entry.status)).length,
      playerActive: playerProjects.filter((entry) => entry.status === 'active').length,
      playerPaused: playerProjects.filter((entry) => entry.status === 'paused').length,
      playerCompleted: playerProjects.filter((entry) => entry.status === 'completed').length,
      playerReleased: playerProjects.filter((entry) => entry.status === 'released').length,
      playerArchived: playerProjects.filter((entry) => entry.status === 'archived').length,
      pendingCollaborations: pending.length,
      npcOpen: npcProjects.filter((entry) => ['active', 'paused'].includes(entry.status)).length,
      npcCompleted: npcProjects.filter((entry) => entry.status === 'completed').length,
      totalObjectHistoryEntries: world.personalProjects.reduce((sum, entry) => sum + Core.safeNumber(entry.evidence?.objectHistoryEntries, 0), 0),
      lifeCourseMode: world.settings.lifeCourseMode,
      agePressure: false
    };
  }

  function validate(world, add) {
    if (!Array.isArray(world.personalProjects)) add('personalProjects must be an array.');
    if (!Array.isArray(world.personalProjects)) return;
    if (!['choice', 'calendar'].includes(world.settings?.lifeCourseMode)) add('lifeCourseMode must be choice or calendar.');
    if (world.settings?.agePressure !== false) add('Age-pressure root requires agePressure=false.');
    const people = new Set(['player'].concat((world.people || []).map((person) => person.id)));
    const ids = new Set();
    world.personalProjects.forEach((project) => {
      if (!project.id || ids.has(project.id)) add(`Duplicate or missing personal project id ${String(project.id)}.`);
      ids.add(project.id);
      if (project.schema !== PROJECT_SCHEMA) add(`${project.id} has invalid personal project schema.`);
      if (!people.has(project.ownerId)) add(`${project.id} has unknown owner.`);
      if (!PROJECT_TYPES.includes(project.templateId) || !templateById(project.templateId)) add(`${project.id} has unknown project template.`);
      if (!PROJECT_STATUSES.includes(project.status)) add(`${project.id} has invalid project status.`);
      if (project.noDeadline !== true) add(`${project.id} violates the no-deadline root.`);
      if (project.noAgeGate !== true || project.ageGate !== null) add(`${project.id} must remain free of age gates.`);
      if (!project.lifeContext || project.lifeContext.exactAgeRequired !== false) add(`${project.id} must not require an exact age.`);
      if (!project.target || !['object', 'place'].includes(project.target.kind)) add(`${project.id} has invalid target.`);
      if (project.target?.kind === 'object' && !findOwnedObject(world, project.ownerId, project.target.objectId)) add(`${project.id} target object is missing or no longer owned by its project owner.`);
      if (project.target?.kind === 'place' && !World.getPlace(world, project.target.placeId)) add(`${project.id} target place is missing.`);
      if (!Array.isArray(project.chapters) || project.chapters.length < 1) add(`${project.id} has no project chapters.`);
      if (!Number.isInteger(project.stageIndex) || project.stageIndex < 0 || project.stageIndex > (project.chapters || []).length) add(`${project.id} has invalid stageIndex.`);
      const completed = (project.chapters || []).filter((entry) => entry.status === 'completed').length;
      if (completed !== project.stageIndex) add(`${project.id} completed chapter count does not match stageIndex.`);
      if (project.status === 'completed' && project.stageIndex !== project.chapters.length) add(`${project.id} is completed before all chapters are complete.`);
      if (!Array.isArray(project.collaboratorIds) || project.collaboratorIds.some((id) => !people.has(id) || id === project.ownerId)) add(`${project.id} has invalid collaborators.`);
      if (new Set(project.collaboratorIds || []).size !== (project.collaboratorIds || []).length) add(`${project.id} has duplicate collaborators.`);
      if (!Array.isArray(project.collaborationRequests)) add(`${project.id} collaborationRequests must be an array.`);
      (project.collaborationRequests || []).forEach((request) => {
        if (!people.has(request.personId) || request.personId === project.ownerId) add(`${project.id} has invalid collaboration invitee.`);
        if (!COLLABORATION_STATUSES.includes(request.status)) add(`${project.id} has invalid collaboration request status.`);
      });
      if (!project.evidence || !Number.isFinite(project.evidence.hoursWorked) || project.evidence.hoursWorked < 0 || !Number.isFinite(project.evidence.moneySpent) || project.evidence.moneySpent < 0) add(`${project.id} has invalid evidence totals.`);
      if (!Array.isArray(project.history)) add(`${project.id} history must be an array.`);
    });
    [world.player].concat(world.people || []).forEach((person) => {
      if (!Array.isArray(person.personalProjectIds)) add(`${person.id} personalProjectIds must be an array.`);
      (person.personalProjectIds || []).forEach((id) => {
        const project = world.personalProjects.find((entry) => entry.id === id);
        if (!project || project.ownerId !== person.id) add(`${person.id} points to an invalid personal project ${id}.`);
      });
    });
  }

  Object.assign(Systems, {
    createPersonalProject,
    workPersonalProject,
    pausePersonalProject,
    resumePersonalProject,
    reshapePersonalProject,
    releasePersonalProject,
    archivePersonalProject,
    inviteProjectCollaborator,
    preparePersonalDirectionsExperiment
  });

  AXM.Directions = {
    PROJECT_SCHEMA,
    PROJECT_STATUSES,
    COLLABORATION_STATUSES,
    PROJECT_TYPES,
    PROJECT_TEMPLATES,
    templateById,
    ensureState,
    initializeWorld,
    projectById,
    projectsFor,
    findOwnedObject,
    ownedObjects,
    currentChapter,
    createPersonalProject,
    workPersonalProject,
    pausePersonalProject,
    resumePersonalProject,
    reshapePersonalProject,
    releasePersonalProject,
    archivePersonalProject,
    inviteProjectCollaborator,
    preparePersonalDirectionsExperiment,
    dailyTick,
    metrics,
    validate,
    projectFit
  };
}(typeof window !== 'undefined' ? window : globalThis));
