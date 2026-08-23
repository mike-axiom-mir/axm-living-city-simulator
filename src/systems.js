(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;

  const NEED_KEYS = ['energy', 'hunger', 'hygiene', 'mood', 'social'];
  const UPGRADE_AXES = ['comfort', 'beauty', 'utility', 'durability', 'efficiency'];

  function toast(world, message, tone = 'info') {
    world.ui.toast = { message, tone, nonce: (world.ui.toast?.nonce || 0) + 1 };
  }

  function clampNeeds(entity) {
    NEED_KEYS.forEach((key) => {
      entity.needs[key] = Core.clamp(Core.safeNumber(entity.needs[key], 50), 0, 100);
    });
  }

  function applyNeedEffects(entity, effects = {}) {
    Object.entries(effects).forEach(([key, amount]) => {
      if (entity.needs[key] == null) return;
      entity.needs[key] += amount;
    });
    clampNeeds(entity);
  }

  function applySkillEffects(entity, effects = {}) {
    Object.entries(effects).forEach(([key, amount]) => {
      if (entity.skills[key] == null) entity.skills[key] = 0;
      entity.skills[key] = Core.clamp(Core.round(entity.skills[key] + amount, 2), 0, 100);
    });
  }

  function currentJob(world, entity = world.player) {
    return Content.jobById(entity.jobId);
  }

  function propertyResidents(world, property) {
    return property.tenants.map((id) => World.getPerson(world, id)).filter(Boolean);
  }

  function npcMonthlyIncome(npc) {
    const job = Content.jobById(npc.jobId);
    return job ? job.wage * job.hours * 5 * 4.2 : 0;
  }

  function playerMonthlyIncome(world) {
    const job = currentJob(world);
    return job ? job.wage * job.hours * 5 * 4.2 : 0;
  }

  function getRelation(container, otherId, defaults = {}) {
    if (!container.relationships[otherId]) {
      container.relationships[otherId] = {
        friendship: 0,
        romance: 0,
        trust: 0,
        status: 'stranger',
        interactions: 0,
        lastInteractionDay: 0,
        ...defaults
      };
    }
    return container.relationships[otherId];
  }

  function getNpcPairRelations(a, b) {
    const relA = getRelation(a, b.id);
    const relB = getRelation(b, a.id);
    return [relA, relB];
  }

  function compatibility(a, b) {
    const traitKeys = ['social', 'ambition', 'neatness', 'thrift', 'creativity', 'stability', 'independence'];
    const traitSimilarity = 100 - Core.average(traitKeys.map((key) => Math.abs(a.traits[key] - b.traits[key])));
    const sharedColors = a.preferences.colors.filter((color) => b.preferences.colors.includes(color)).length;
    const sharedStyles = a.preferences.styles.filter((style) => b.preferences.styles.includes(style)).length;
    return Core.clamp(Core.round(traitSimilarity * 0.62 + sharedColors * 9 + sharedStyles * 12, 1), 0, 100);
  }

  function playerNpcCompatibility(world, npc) {
    const playerProxy = {
      traits: { social: 55, ambition: 55, neatness: 50, thrift: 58, creativity: 66, stability: 48, independence: 68 },
      preferences: { colors: ['moss', 'night'], styles: ['patched', 'warm'] }
    };
    return compatibility(playerProxy, npc);
  }

  function updateTutorial(world) {
    const tutorial = world.tutorial;
    tutorial.goals.forEach((goal) => {
      if (goal.id === 'inspect_homes') goal.progress = tutorial.inspectedPlaceIds.length;
      if (goal.id === 'earn_money') goal.progress = tutorial.earnedAtWork;
      if (goal.id === 'upgrade_object') goal.progress = tutorial.objectUpgrades;
      if (goal.id === 'make_friend') {
        goal.progress = Object.values(world.player.relationships).filter((relation) => relation.friendship >= 45).length;
        tutorial.friendships = goal.progress;
      }
      if (goal.id === 'rent_home') goal.progress = tutorial.homesRented;
      goal.complete = goal.progress >= goal.target;
    });
  }

  function inspectPlace(world, placeId) {
    const place = World.getPlace(world, placeId);
    if (!place) return false;
    world.ui.selectedPlaceId = placeId;
    if (place.kind === 'residential' && !world.tutorial.inspectedPlaceIds.includes(placeId)) {
      world.tutorial.inspectedPlaceIds.push(placeId);
      updateTutorial(world);
    }
    return true;
  }

  function normalizePlayerState(world) {
    clampNeeds(world.player);
    Object.keys(world.player.skills).forEach((key) => {
      world.player.skills[key] = Core.clamp(world.player.skills[key], 0, 100);
    });
    world.player.money = Core.round(world.player.money, 2);
  }

  function stableRoll(text) {
    return (Core.hashString(text) % 10000) / 10000;
  }

  function determineNpcLocation(world, npc) {
    const communityLocation = AXM.Community?.locationForPerson(world, npc);
    if (communityLocation) return communityLocation;
    if (AXM.Family?.isDependent(npc)) return AXM.Family.determineDependentLocation(world, npc);
    const hour = world.time.hour;
    const weekday = Core.weekdayIndex(world.time.day);
    const job = Content.jobById(npc.jobId);

    if (hour < 6 || hour >= 23) return { placeId: npc.homePropertyId, activity: 'sleeping' };
    if (hour < 8) return { placeId: npc.homePropertyId, activity: hour < 7 ? 'waking slowly' : 'getting ready' };
    if (job && weekday < 5 && hour >= job.shiftStart && hour < job.shiftStart + job.hours) {
      return { placeId: job.placeId, activity: `working at ${job.name}` };
    }
    if (hour >= 21) return { placeId: npc.homePropertyId, activity: 'winding down at home' };

    const roll = stableRoll(`${world.seed}|${world.time.day}|${npc.id}|evening`);
    const socialWeight = npc.traits.social / 100;
    const creativeWeight = npc.traits.creativity / 100;
    if (hour >= 17 && hour < 21) {
      if (roll < 0.20 + socialWeight * 0.18) return { placeId: 'place_cafe', activity: 'meeting people at the café' };
      if (roll < 0.42 + socialWeight * 0.16) return { placeId: 'place_park', activity: 'walking through the park' };
      if (roll < 0.60 + creativeWeight * 0.12) return { placeId: 'place_library', activity: 'browsing at the library' };
      if (roll < 0.76) return { placeId: 'place_market', activity: 'checking the material market' };
      return { placeId: npc.homePropertyId, activity: 'working on their own home' };
    }
    if (hour >= 8 && hour < 17) {
      if (weekday >= 5 && roll < 0.35) return { placeId: 'place_square', activity: 'spending time in the square' };
      if (weekday >= 5 && roll < 0.65) return { placeId: 'place_market', activity: 'shopping for the week' };
      return { placeId: npc.homePropertyId, activity: weekday >= 5 ? 'using a free day at home' : 'between obligations' };
    }
    return { placeId: npc.homePropertyId, activity: 'at home' };
  }

  function updateNpcSchedules(world) {
    world.people.forEach((npc) => {
      const previousPlaceId = npc.locationId;
      const state = determineNpcLocation(world, npc);
      let externalRecord = null;
      if (previousPlaceId && previousPlaceId !== state.placeId) {
        externalRecord = AXM.Exteriors?.recordScheduledTravel(world, npc.id, previousPlaceId, state.placeId, state.activity) || null;
      }
      npc.locationId = state.placeId;
      npc.activity = state.activity;
      AXM.Presence?.syncNpcSchedule(world, npc.id, previousPlaceId, state.placeId, state.activity, externalRecord?.id || null);
    });
  }

  function hourlyPlayerDecay(world, options) {
    if (options.freezePlayer) return;
    const player = world.player;
    const hour = world.time.hour;
    const asleep = hour < 6 || hour >= 23;
    // Casual realism keeps needs meaningful without turning ordinary living
    // into a click tax. The same physical causes remain; their pressure is
    // gentler and sleep recovers more reliably.
    const rhythm = world.settings?.casualRealism === false ? 1 : 0.58;
    player.needs.hunger -= 2.15 * rhythm;
    player.needs.hygiene -= (asleep ? 0.3 : 0.75) * rhythm;
    player.needs.social -= 0.35 * rhythm;
    player.needs.energy += asleep ? 1.15 : -1.35 * rhythm;
    if (player.needs.hunger < 14 || player.needs.energy < 14 || player.needs.hygiene < 12) player.needs.mood -= 0.65;
    else if (player.needs.hunger > 62 && player.needs.energy > 52) player.needs.mood += 0.18;
    clampNeeds(player);
  }

  function hourlyNpcNeeds(world) {
    world.people.forEach((npc) => {
      if (AXM.Family?.isDependent(npc)) {
        AXM.Family.hourlyDependentTick(world, npc);
        return;
      }
      const hour = world.time.hour;
      const atHome = npc.locationId === npc.homePropertyId;
      const atWork = Content.jobById(npc.jobId)?.placeId === npc.locationId;
      npc.needs.hunger -= atWork ? 1.9 : 1.4;
      npc.needs.hygiene -= 0.55;
      npc.needs.social -= atHome ? 0.25 : -0.2;
      npc.needs.energy += (hour < 6 || hour >= 23) ? 2.4 : (atWork ? -1.8 : -0.85);
      if (hour === 7) {
        npc.needs.hygiene += 28 + npc.traits.neatness * 0.15;
        npc.needs.hunger += 24;
      }
      if (hour === 18) npc.needs.hunger += 35;
      if (atWork) npc.needs.mood += (npc.skills[Content.jobById(npc.jobId).primarySkill] - 30) * 0.005;
      clampNeeds(npc);
    });
  }

  function objectConditionTick(world) {
    world.places.filter((place) => place.kind === 'residential').forEach((property) => {
      property.furniture.forEach((object) => {
        const definition = Content.furnitureById(object.catalogId);
        const stats = Core.computeObjectStats(definition, object);
        const decay = Math.max(0.005, 0.045 - stats.durability * 0.00036);
        object.condition = Core.clamp(object.condition - decay, 0, 100);
      });
    });
  }

  function payNpcWagesForPreviousDay(world) {
    const previousDay = world.time.day - 1;
    if (previousDay < 1 || Core.weekdayIndex(previousDay) >= 5) return;
    world.people.forEach((npc) => {
      const job = Content.jobById(npc.jobId);
      if (!job) return;
      const dailyPay = job.wage * job.hours * (0.88 + npc.skills[job.primarySkill] * 0.0025);
      npc.money += dailyPay;
      npc.lifetimeEarnings += dailyPay;
      npc.needs.mood += 0.5;
    });
  }

  function weeklyRentCycle(world, options = {}) {
    if ((world.time.day - 1) % 7 !== 0 || world.time.day === 1) return;

    const charge = (property, personId, kind, due) => {
      if (due <= 0) return { due: 0, paid: 0, shortfall: 0 };
      const person = World.getPerson(world, personId);
      if (!person) return { due, paid: 0, shortfall: due };
      if (AXM.Family?.isFinancialDependent(world, personId)) return { due: 0, paid: 0, shortfall: 0, dependent: true };
      if (personId === 'player' && options.freezePlayer) return { due, paid: 0, shortfall: 0, frozen: true };
      const paid = Math.min(person.money, due);
      person.money -= paid;
      const shortfall = Math.max(0, due - paid);
      if (personId === 'player') {
        person.lifetimeSpend += paid;
      } else if (kind === 'rent') {
        person.lifetimeHousingCost += paid;
      }
      if (kind === 'rent') {
        if (shortfall > 0.01) {
          person.rentArrears += shortfall;
          person.needs.mood -= personId === 'player' ? 6 : 5;
        } else {
          person.rentArrears = Math.max(0, person.rentArrears - due * 0.2);
        }
        world.metrics.rentPayments += 1;
      }
      AXM.Households?.recordSharedExpensePayment(world, property, personId, kind, due, paid);
      return { due, paid, shortfall };
    };

    world.places.filter((place) => place.kind === 'residential').forEach((property) => {
      const tenantIds = property.tenants.slice();
      if (!tenantIds.length) return;
      const adultTenantIds = tenantIds.filter((id) => !AXM.Family?.isFinancialDependent(world, id));
      const externalOwner = property.ownerId !== 'player';
      const weeklyRentTotal = property.currentRent / 4.2;
      const baseRentDues = {};

      if (property.rentBasis === 'per_tenant') {
        tenantIds.forEach((id) => {
          baseRentDues[id] = AXM.Family?.isFinancialDependent(world, id) || property.ownerId === id ? 0 : weeklyRentTotal;
        });
      } else {
        const payingTenants = adultTenantIds.filter((id) => property.ownerId !== id);
        const share = weeklyRentTotal / Math.max(1, payingTenants.length);
        tenantIds.forEach((id) => {
          baseRentDues[id] = AXM.Family?.isFinancialDependent(world, id) || property.ownerId === id ? 0 : share;
        });
      }

      const rentDues = AXM.Households?.redistributePropertyExpense(world, property, 'rent', baseRentDues) || baseRentDues;
      Object.entries(rentDues).forEach(([tenantId, rawDue]) => {
        const result = charge(property, tenantId, 'rent', Core.round(rawDue, 2));
        if (result.frozen) return;
        if (result.shortfall > 0.01 && tenantId === 'player') {
          Core.appendLedger(world, 'housing', `You could only cover ${Core.formatMoney(result.paid)} of this week's ${Core.formatMoney(result.due)} rent. The arrears remain visible rather than becoming a hidden penalty.`, {
            actorIds: ['player'], placeId: property.id, causes: ['insufficient cash'], evidence: { arrears: world.player.rentArrears, due: result.due, paid: result.paid }
          });
        }
        if (property.ownerId === 'player' && tenantId !== 'player') {
          const net = result.paid * 0.92;
          world.player.money += net;
          property.maintenanceReserve += result.paid * 0.08;
        } else if (externalOwner) {
          property.maintenanceReserve += result.paid * 0.06;
        }
      });

      if (!property.utilitiesIncluded && Core.safeNumber(property.weeklyUtilityBase, 0) > 0) {
        const baseUtilityDues = {};
        const share = property.weeklyUtilityBase / Math.max(1, adultTenantIds.length);
        tenantIds.forEach((id) => { baseUtilityDues[id] = AXM.Family?.isFinancialDependent(world, id) ? 0 : share; });
        const utilityDues = AXM.Households?.redistributePropertyExpense(world, property, 'utilities', baseUtilityDues) || baseUtilityDues;
        Object.entries(utilityDues).forEach(([tenantId, rawDue]) => {
          const result = charge(property, tenantId, 'utilities', Core.round(rawDue, 2));
          if (!result.frozen) property.maintenanceReserve += result.paid * 0.65;
        });
      }
    });
  }

  function homeStyleMatch(npc, property) {
    const style = npc.preferences.styles.includes(property.style) ? 18 : 0;
    const colorEntry = Content.PALETTE.find((entry) => entry.hex.toLowerCase() === property.color.toLowerCase());
    const color = colorEntry && npc.preferences.colors.includes(colorEntry.id) ? 8 : 0;
    return style + color;
  }

  function housingScore(world, npc, property, assumeResidents = null) {
    const residents = assumeResidents == null ? Math.max(1, property.tenants.filter((id) => id !== 'player').length) : Math.max(1, assumeResidents);
    const income = Math.max(1, npcMonthlyIncome(npc));
    const rentShare = property.currentRent / residents;
    const ratio = rentShare / income;
    const affordability = Core.clamp(78 - ratio * 120, -60, 75);
    const jobPlace = World.getPlace(world, Content.jobById(npc.jobId)?.placeId);
    const commute = Core.distance(property, jobPlace);
    const commuteScore = Core.clamp(28 - commute * 2.4, -30, 28);
    const spaceScore = Math.min(24, property.capacity * 5 - property.tenants.length * 2);
    const conditionScore = (property.condition - 70) * 0.35;
    const styleScore = homeStyleMatch(npc, property);
    const roommateScore = property.tenants.reduce((sum, id) => {
      if (id === 'player') return sum;
      const relation = npc.relationships[id];
      return sum + (relation ? relation.friendship * 0.08 : 0);
    }, 0);
    const arrearsPressure = npc.rentArrears > 0 && property.currentRent < (World.homeOf(world, npc.id)?.currentRent || Infinity) ? 14 : 0;
    return Core.round(affordability + commuteScore + spaceScore + conditionScore + styleScore + roommateScore + arrearsPressure, 1);
  }

  function transferPersonalFurniture(world, personId, fromProperty, toProperty) {
    const moving = fromProperty.furniture.filter((object) => object.ownerId === personId && object.ownershipMode !== 'property_fixture');
    fromProperty.furniture = fromProperty.furniture.filter((object) => !(object.ownerId === personId && object.ownershipMode !== 'property_fixture'));
    const person = World.getPerson(world, personId);
    if (!person.storedFurniture) person.storedFurniture = [];
    moving.forEach((object) => {
      // Placement authority and utility requirements depend on the real object
      // definition. Passing only a footprint would let powered or wet fixtures
      // lose their catalog identity during a move and enter an unsuitable room.
      const actorRule = AXM.Households
        ? personId === 'player'
          ? (x, y, footprint) => AXM.Households.canPlacePlayerObject(world, toProperty, object, x, y, footprint).ok
          : (x, y, footprint) => AXM.Households.canPlaceNpcObject(world, toProperty, personId, object, x, y, footprint).ok
        : null;
      const placed = World.addFurnitureToProperty(world, toProperty, object, null, actorRule);
      if (!placed) person.storedFurniture.push(object);
    });
    return moving.length;
  }

  function moveNpc(world, npc, destination, options = {}) {
    if (AXM.Family?.isDependent(npc) && !options.familyTransfer) return { ok: false, reason: 'A dependent cannot be moved as an isolated housing unit. Move the family through an explicit family or household path.' };
    const origin = World.getProperty(world, npc.homePropertyId);
    if (!destination || destination.tenants.length >= destination.capacity) return { ok: false, reason: 'No capacity.' };
    if (origin && origin.id === destination.id) return { ok: false, reason: 'Already lives there.' };

    const movingCost = options.waiveCost ? 0 : Math.min(95, destination.currentRent * 0.16);
    if (!options.waiveCost && npc.money < movingCost) return { ok: false, reason: 'Cannot cover moving cost.' };

    if (origin) {
      origin.tenants = origin.tenants.filter((id) => id !== npc.id);
      origin.listedForRent = origin.tenants.length < origin.capacity;
      transferPersonalFurniture(world, npc.id, origin, destination);
      Core.appendPropertyHistory(world, origin, 'move_out', `${npc.name} moved out.`, {
        actorIds: [npc.id], causes: options.causes || ['autonomous housing decision']
      });
    }

    npc.money -= movingCost;
    destination.tenants.push(npc.id);
    destination.listedForRent = destination.tenants.length < destination.capacity;
    npc.homePropertyId = destination.id;
    npc.locationId = destination.id;
    npc.lastMoveDay = world.time.day;
    npc.moveCooldownUntil = world.time.day + 18 + Math.floor(npc.traits.stability * 0.18);
    world.metrics.totalMoves += 1;
    Core.appendPropertyHistory(world, destination, 'move_in', `${npc.name} moved in and brought their own objects where space allowed.`, {
      actorIds: [npc.id], causes: options.causes || ['autonomous housing decision']
    });
    Core.appendLedger(world, 'housing', `${npc.name} moved from ${origin ? origin.name : 'temporary housing'} to ${destination.name}.`, {
      actorIds: [npc.id], placeId: destination.id,
      causes: options.causes || ['better housing fit'],
      evidence: options.evidence || null
    });
    return { ok: true };
  }

  function evaluateNpcHousing(world, npc) {
    if (AXM.Family?.isDependent(npc)) return;
    if (world.time.day < npc.moveCooldownUntil) return;
    if ((Core.hashString(npc.id) + world.time.day) % 7 !== 0) return;
    const current = World.homeOf(world, npc.id);
    if (!current) return;
    const currentScore = housingScore(world, npc, current);
    const candidates = world.places.filter((place) => place.kind === 'residential' && place.id !== current.id && place.tenants.length < place.capacity && place.listedForRent);
    if (!candidates.length) return;
    const scored = candidates.map((property) => ({ property, score: housingScore(world, npc, property, property.tenants.length + 1) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const inertia = 15 + npc.traits.stability * 0.18;
    const pressure = npc.rentArrears > current.currentRent / 4.2 ? 12 : 0;
    if (best.score > currentScore + inertia - pressure) {
      const evidence = { previousFit: currentScore, newFit: best.score, decisionThreshold: Core.round(currentScore + inertia - pressure, 1) };
      if (AXM.Households?.handleNpcHousingDecision(world, npc, current, best.property, evidence)) return;
      moveNpc(world, npc, best.property, {
        causes: [
          best.property.currentRent < current.currentRent ? 'lower housing cost' : 'better overall fit',
          Core.distance(best.property, World.getPlace(world, Content.jobById(npc.jobId).placeId)) < Core.distance(current, World.getPlace(world, Content.jobById(npc.jobId).placeId)) ? 'shorter commute' : 'personal preference',
          npc.rentArrears > 0 ? 'rent pressure' : 'voluntary change'
        ],
        evidence
      });
    }
  }

  function jobCounts(world) {
    const counts = Object.fromEntries(Content.JOBS.map((job) => [job.id, 0]));
    world.people.forEach((npc) => { if (counts[npc.jobId] != null) counts[npc.jobId] += 1; });
    return counts;
  }

  function evaluateNpcJob(world, npc, counts) {
    if (AXM.Family?.isDependent(npc)) return;
    if (world.time.day < npc.jobCooldownUntil) return;
    if ((Core.hashString(`${npc.id}:job`) + world.time.day) % 13 !== 0) return;
    const current = Content.jobById(npc.jobId);
    const candidates = Content.JOBS.filter((job) => job.id !== npc.jobId && counts[job.id] < job.slots && (npc.skills[job.primarySkill] || 0) >= job.requirement - 5);
    if (!candidates.length) return;
    const currentFit = current.wage * 2 + (npc.skills[current.primarySkill] || 0) + (current.id === 'design_coop' ? npc.traits.creativity * 0.2 : 0);
    const scored = candidates.map((job) => ({
      job,
      fit: job.wage * 2 + (npc.skills[job.primarySkill] || 0) + (job.id === 'repair_workshop' ? npc.skills.repair * 0.25 : 0) + (job.id === 'design_coop' ? npc.traits.creativity * 0.2 : 0)
    })).sort((a, b) => b.fit - a.fit);
    const best = scored[0];
    if (best.fit > currentFit + 9 + npc.traits.stability * 0.08) {
      counts[current.id] -= 1;
      counts[best.job.id] += 1;
      npc.jobId = best.job.id;
      npc.jobCooldownUntil = world.time.day + 25 + Math.floor(npc.traits.stability * 0.22);
      world.metrics.jobChanges += 1;
      Core.appendLedger(world, 'work', `${npc.name} left ${current.name} for ${best.job.name}.`, {
        actorIds: [npc.id], placeId: best.job.placeId,
        causes: [best.job.wage > current.wage ? 'better pay' : 'better skill fit', 'autonomous career decision'],
        evidence: { oldFit: Core.round(currentFit, 1), newFit: Core.round(best.fit, 1) }
      });
    }
  }

  function categoryCounts(property) {
    const counts = {};
    property.furniture.forEach((object) => {
      const definition = Content.furnitureById(object.catalogId);
      counts[definition.category] = (counts[definition.category] || 0) + 1;
    });
    return counts;
  }

  function chooseNpcFurniture(world, npc, property, budget) {
    const counts = categoryCounts(property);
    const essentials = [
      { category: 'sleep', desired: Math.max(1, property.tenants.length) },
      { category: 'seat', desired: Math.max(1, Math.ceil(property.tenants.length / 2)) },
      { category: 'light', desired: 1 },
      { category: 'surface', desired: 1 }
    ];
    const missing = essentials.find((entry) => (counts[entry.category] || 0) < entry.desired);
    const candidates = Content.FURNITURE_CATALOG.filter((definition) => definition.price <= budget && (!missing || definition.category === missing.category));
    const pool = candidates.length ? candidates : Content.FURNITURE_CATALOG.filter((definition) => definition.price <= budget);
    if (!pool.length) return null;
    return Core.weightedChoice(world, pool, (definition) => {
      let weight = 4;
      if (npc.preferences.categories.includes(definition.category)) weight += 8;
      if (definition.styleTags.some((style) => npc.preferences.styles.includes(style))) weight += 10;
      if (npc.traits.thrift > 65) weight += Math.max(0, 10 - definition.price / 80);
      if (npc.traits.creativity > 65 && definition.category === 'decor') weight += 8;
      return Math.max(1, weight);
    });
  }

  function npcDecorate(world, npc) {
    if (AXM.Family?.isDependent(npc)) return;
    if (world.time.day < npc.decorCooldownUntil) return;
    const property = World.homeOf(world, npc.id);
    if (!property) return;
    const reserve = property.currentRent * 0.8 + 180 + npc.traits.thrift * 2;
    const spendable = npc.money - reserve;
    if (spendable < 20) {
      npc.decorCooldownUntil = world.time.day + 4;
      return;
    }

    const owned = property.furniture.filter((object) => object.ownerId === npc.id);
    const actionRoll = Core.nextRandom(world);

    if (actionRoll < 0.54 && property.furniture.length < property.roomGrid[0] * property.roomGrid[1] * 0.34) {
      const definition = chooseNpcFurniture(world, npc, property, Math.min(spendable, 520));
      if (definition) {
        const object = World.createFurnitureInstance(world, definition.id, npc.id, {
          colorId: Core.choice(world, npc.preferences.colors),
          condition: Core.randomInt(world, 72, 100),
          sentimental: Core.randomInt(world, 1, 8)
        });
        const placementRule = AXM.Households
          ? (x, y, footprint) => AXM.Households.canPlaceNpcObject(world, property, npc.id, object, x, y, footprint).ok
          : null;
        if (World.addFurnitureToProperty(world, property, object, null, placementRule)) {
          npc.money -= definition.price;
          npc.autonomousActions += 1;
          world.metrics.npcDecorations += 1;
          Core.appendObjectHistory(world, object, 'acquired', `${npc.name} chose this ${definition.name.toLowerCase()} for ${property.name}.`, {
            actorId: npc.id, causes: ['personal preference', 'available budget']
          });
          Core.appendPropertyHistory(world, property, 'decor', `${npc.name} added a ${definition.name} in ${Content.paletteById(object.colorId).name}.`, {
            actorIds: [npc.id], objectId: object.id, causes: ['autonomous decoration']
          });
        }
      }
    } else if (owned.length) {
      const object = Core.choice(world, owned);
      const definition = Content.furnitureById(object.catalogId);
      if (actionRoll < 0.82) {
        const axis = Core.choice(world, UPGRADE_AXES);
        if (object.upgrades[axis] < 5) {
          const cost = Core.objectUpgradeCost(definition, object, axis).money * 0.75;
          if (npc.money - reserve >= cost) {
            npc.money -= cost;
            object.upgrades[axis] += 1;
            object.sentimental = Core.clamp(object.sentimental + 3, 0, 100);
            npc.autonomousActions += 1;
            world.metrics.npcObjectUpgrades += 1;
            Core.appendObjectHistory(world, object, 'upgrade', `${npc.name} improved the ${axis} of this object instead of replacing it.`, {
              actorId: npc.id, causes: ['attachment to existing object', 'sufficient budget']
            });
            Core.appendPropertyHistory(world, property, 'upgrade', `${npc.name} improved a ${definition.name} already in the home.`, {
              actorIds: [npc.id], objectId: object.id, causes: ['upgrade without replacement']
            });
          }
        }
      } else {
        const oldColor = object.colorId;
        const newColor = Core.choice(world, npc.preferences.colors);
        if (newColor !== oldColor) {
          object.colorId = newColor;
          object.sentimental = Core.clamp(object.sentimental + 1, 0, 100);
          npc.money -= 6;
          npc.autonomousActions += 1;
          world.metrics.npcDecorations += 1;
          Core.appendObjectHistory(world, object, 'recolor', `${npc.name} changed the finish from ${Content.paletteById(oldColor).name} to ${Content.paletteById(newColor).name}.`, {
            actorId: npc.id, causes: ['personal color preference']
          });
        }
      }
    }
    npc.decorCooldownUntil = world.time.day + Core.randomInt(world, 3, 10);
  }

  function autonomousSocial(world) {
    const available = world.people.filter((npc) => npc.needs.social < 85 || npc.traits.social > 55);
    if (available.length < 2) return;
    const eventCount = 2 + (world.time.day % 3 === 0 ? 1 : 0);
    for (let event = 0; event < eventCount; event += 1) {
      const a = Core.choice(world, available);
      const samePlace = available.filter((b) => b.id !== a.id && b.locationId === a.locationId);
      const b = Core.choice(world, samePlace.length ? samePlace : available.filter((person) => person.id !== a.id));
      if (!a || !b) continue;
      const [relA, relB] = getNpcPairRelations(a, b);
      const fit = compatibility(a, b);
      const change = Core.round((fit - 35) / 22 + Core.randomInt(world, -1, 3), 1);
      relA.friendship = Core.clamp(relA.friendship + change, -100, 100);
      relB.friendship = Core.clamp(relB.friendship + change, -100, 100);
      relA.trust = Core.clamp(relA.trust + Math.max(-1, change * 0.55), -100, 100);
      relB.trust = Core.clamp(relB.trust + Math.max(-1, change * 0.55), -100, 100);
      a.needs.social += 7;
      b.needs.social += 7;
      a.needs.mood += change > 0 ? 2 : -1;
      b.needs.mood += change > 0 ? 2 : -1;
      world.metrics.autonomousSocialEvents += 1;

      const oldStatus = relA.status;
      if (relA.friendship >= 48 && ['stranger', 'acquaintance', 'roommate'].includes(relA.status)) {
        relA.status = 'friend';
        relB.status = 'friend';
      }
      const romancePotential = !AXM.Family?.isDependent(a) && !AXM.Family?.isDependent(b) && fit > 66 && a.traits.independence < 88 && b.traits.independence < 88;
      if (romancePotential && relA.friendship > 62 && relB.friendship > 62 && Core.chance(world, 0.035)) {
        relA.romance = Math.max(relA.romance, 35);
        relB.romance = Math.max(relB.romance, 35);
        relA.status = 'dating';
        relB.status = 'dating';
        Core.appendLedger(world, 'relationship', `${a.name} and ${b.name} decided to start dating.`, {
          actorIds: [a.id, b.id], placeId: a.locationId,
          causes: ['mutual compatibility', 'accumulated friendship', 'autonomous choice'],
          evidence: { compatibility: fit }
        });
        world.metrics.relationshipsFormed += 1;
      } else if (oldStatus !== relA.status && relA.status === 'friend') {
        Core.appendLedger(world, 'relationship', `${a.name} and ${b.name} have become friends through repeated contact.`, {
          actorIds: [a.id, b.id], placeId: a.locationId,
          causes: ['repeated autonomous social contact'], evidence: { friendship: relA.friendship }
        });
        world.metrics.relationshipsFormed += 1;
      }
    }
  }

  function npcInitiatesWithPlayer(world) {
    const colocated = world.people.filter((npc) => npc.locationId === world.player.locationId && !AXM.Family?.isDependent(npc));
    if (!colocated.length || !Core.chance(world, 0.14)) return;
    const npc = Core.weightedChoice(world, colocated, (person) => 10 + person.traits.social);
    const relation = getRelation(world.player, npc.id);
    const gain = 1 + npc.traits.social / 40;
    relation.friendship = Core.clamp(relation.friendship + gain, -100, 100);
    relation.trust = Core.clamp(relation.trust + gain * 0.4, -100, 100);
    relation.status = relation.friendship >= 45 ? 'friend' : relation.friendship >= 15 ? 'acquaintance' : relation.status;
    npc.needs.social += 5;
    Core.appendLedger(world, 'relationship', `${npc.name} initiated a small conversation with you at ${World.getPlace(world, npc.locationId)?.name || 'the neighborhood'}.`, {
      actorIds: [npc.id, 'player'], placeId: npc.locationId,
      causes: ['NPC initiative', 'shared location']
    });
  }

  function propertyMaintenance(world) {
    world.places.filter((place) => place.kind === 'residential').forEach((property) => {
      const occupied = property.tenants.length > 0;
      property.condition -= occupied ? 0.09 : 0.035;
      if (property.maintenanceReserve > 45 && property.condition < 82 && Core.chance(world, 0.08)) {
        const spend = Math.min(property.maintenanceReserve, 65 + (82 - property.condition) * 2);
        property.maintenanceReserve -= spend;
        property.condition = Core.clamp(property.condition + spend / 18, 0, 100);
        Core.appendPropertyHistory(world, property, 'maintenance', `${property.ownerLabel || 'The owner'} funded visible maintenance.`, {
          causes: ['condition below preferred range', 'available maintenance reserve']
        });
      }
      property.condition = Core.clamp(property.condition, 0, 100);
    });
  }

  function dailyTick(world, options = {}) {
    payNpcWagesForPreviousDay(world);
    weeklyRentCycle(world, options);
    propertyMaintenance(world);
    autonomousSocial(world);
    if (!options.freezePlayer) npcInitiatesWithPlayer(world);

    const counts = jobCounts(world);
    world.people.forEach((npc) => {
      if (AXM.Family?.isDependent(npc)) return;
      npcDecorate(world, npc);
      evaluateNpcHousing(world, npc);
      evaluateNpcJob(world, npc, counts);
    });
    AXM.Households?.dailyTick(world, options);
    AXM.Stewardship?.dailyTick(world, options);
    AXM.Family?.dailyTick(world, options);
    AXM.Community?.dailyTick(world, options);
    AXM.Directions?.dailyTick(world, options);
    AXM.Economy?.dailyTick(world, options);
    AXM.Shells?.dailyTick(world, options);
    AXM.Presence?.dailyTick(world, options);
    world.metrics.daysObserved += 1;
    updateTutorial(world);
  }

  function simulateHour(world, options = {}) {
    hourlyPlayerDecay(world, options);
    hourlyNpcNeeds(world);
    objectConditionTick(world);

    world.time.hour += 1;
    if (world.time.hour >= 24) {
      world.time.hour = 0;
      world.time.day += 1;
      dailyTick(world, options);
    }
    AXM.Community?.hourlyTick(world, options);
    AXM.Economy?.hourlyTick(world, options);
    AXM.Exteriors?.hourlyTick(world, options);
    updateNpcSchedules(world);
    AXM.Presence?.hourlyTick(world, options);
    normalizePlayerState(world);
  }

  function advanceHours(world, hours, options = {}) {
    const count = Math.max(0, Math.floor(hours));
    for (let i = 0; i < count; i += 1) simulateHour(world, options);
    updateTutorial(world);
    return world;
  }

  function advanceMinutes(world, minutes, options = {}) {
    const amount = Math.max(0, Math.floor(Number(minutes) || 0));
    if (!world.time || typeof world.time !== 'object') world.time = { day: 1, hour: 7, minute: 0 };
    if (!Number.isInteger(world.time.minute)) world.time.minute = 0;
    const total = world.time.minute + amount;
    const wholeHours = Math.floor(total / 60);
    world.time.minute = total % 60;
    for (let i = 0; i < wholeHours; i += 1) simulateHour(world, options);
    updateNpcSchedules(world);
    normalizePlayerState(world);
    updateTutorial(world);
    return world;
  }

  function objectOwnedByPlayer(world, objectId) {
    for (const property of world.places.filter((place) => place.kind === 'residential')) {
      const object = property.furniture.find((entry) => entry.id === objectId && entry.ownerId === 'player');
      if (object) return { property, object, stored: false };
    }
    const stored = (world.player.storedFurniture || []).find((entry) => entry.id === objectId);
    return stored ? { property: null, object: stored, stored: true } : null;
  }

  function objectEditAuthority(world, found, options = {}) {
    if (!found) return { ok: false, reason: 'You do not own that object.' };
    if (found.property && found.property.id !== world.player.homePropertyId) {
      return { ok: false, reason: 'That object is inside a resident-authored home. Ownership does not grant remote build control.' };
    }
    if (options.personalOnly && found.object.ownershipMode === 'property_fixture') {
      return { ok: false, reason: 'Property fixtures remain bound to the building and cannot be moved or stored as personal furniture.' };
    }
    return { ok: true };
  }

  function playerObjectByCatalog(world, catalogId) {
    const home = World.homeOf(world, 'player');
    return home?.furniture.find((object) => object.ownerId === 'player' && object.catalogId === catalogId) || null;
  }

  function activityLocation(actionId, world) {
    if (actionId === 'eat_out') return 'place_cafe';
    if (actionId === 'walk_park') return 'place_park';
    if (actionId === 'salvage' || actionId === 'practice_repair') return 'place_workshop';
    return world.player.homePropertyId;
  }

  function visualMinuteStamp(world) {
    return (Math.max(1, Number(world.time?.day) || 1) - 1) * 1440
      + (Number(world.time?.hour) || 0) * 60
      + (Number(world.time?.minute) || 0);
  }

  function visualActivitySnapshot(world, request) {
    if (!request) return null;
    const home = World.homeOf(world, 'player');
    const object = request.objectId ? home?.furniture?.find((entry) => entry.id === request.objectId) || null : null;
    return {
      minuteStamp: visualMinuteStamp(world),
      money: Number(world.player.money) || 0,
      needs: { ...(world.player.needs || {}) },
      skills: { ...(world.player.skills || {}) },
      homeCondition: Number(home?.condition) || 0,
      object: object ? {
        id: object.id,
        condition: Number(object.condition) || 0,
        sentimental: Number(object.sentimental) || 0,
        usageHours: Number(object.usageHours) || 0
      } : null
    };
  }

  function changedNumericDeltas(before = {}, after = {}) {
    const deltas = {};
    Object.keys(before).forEach((key) => {
      const delta = Core.round((Number(after[key]) || 0) - (Number(before[key]) || 0), 2);
      if (Math.abs(delta) > 0.001) deltas[key] = delta;
    });
    return deltas;
  }

  function observedVisualEffects(world, before) {
    if (!before) return null;
    const home = World.homeOf(world, 'player');
    const object = before.object?.id ? home?.furniture?.find((entry) => entry.id === before.object.id) || null : null;
    const objectDeltas = before.object && object ? changedNumericDeltas({
      condition: before.object.condition,
      sentimental: before.object.sentimental,
      usageHours: before.object.usageHours
    }, {
      condition: object.condition,
      sentimental: object.sentimental,
      usageHours: object.usageHours
    }) : {};
    return {
      effectsObserved: true,
      effectScope: 'player_and_selected_home_context',
      timeMinutes: Math.max(0, visualMinuteStamp(world) - before.minuteStamp),
      moneyDelta: Core.round((Number(world.player.money) || 0) - before.money, 2),
      needs: changedNumericDeltas(before.needs, world.player.needs || {}),
      skills: changedNumericDeltas(before.skills, world.player.skills || {}),
      homeConditionDelta: Core.round((Number(home?.condition) || 0) - before.homeCondition, 2),
      object: Object.keys(objectDeltas).length ? { id: object.id, ...objectDeltas } : null,
      noAddedEffect: true
    };
  }

  function completedVisualActivityReceipt(world, request, activity, before) {
    if (!request || request.actionId !== activity.id || !world.ui) return null;
    const home = World.homeOf(world, 'player');
    const room = home?.habitat?.rooms?.find((entry) => entry.id === request.roomId) || null;
    if (!home || !room) return null;
    const grounding = AXM.Visuals?.groundedActivityForRoom?.(world, room.id, activity.id, request.objectId || null) || null;
    if (!grounding) return null;
    const requestedObject = request.objectId
      ? home.furniture.find((object) => object.id === request.objectId) || null
      : null;
    const objectRoom = requestedObject && AXM.Habitats?.roomAtCell
      ? AXM.Habitats.roomAtCell(home, requestedObject.position?.x, requestedObject.position?.y)
      : null;
    const object = objectRoom?.id === room.id ? requestedObject : null;
    if (request.objectId && !object) return null;
    const receipt = {
      schema: 'axm.living-city.visual-activity-receipt/v0.11.2',
      actionId: activity.id,
      label: activity.name,
      placeId: home.id,
      roomId: room.id,
      objectId: object?.id || null,
      objectName: object ? (Content.furnitureById(object.catalogId)?.name || object.catalogId) : null,
      completedAt: { day: world.time.day, hour: world.time.hour, minute: world.time.minute || 0 },
      observedEffects: observedVisualEffects(world, before),
      source: 'completed_activity',
      notCurrentPresence: true,
      noExtraReward: true
    };
    world.ui.lastVisualActivityReceipt = receipt;
    world.ui.selectedVisualRoomId = room.id;
    world.ui.selectedVisualObjectId = object?.id || null;
    return receipt;
  }

  function performActivity(world, actionId) {
    const visualRequest = world.ui?.pendingVisualActivity || null;
    if (world.ui) world.ui.pendingVisualActivity = null;
    if (world.activeShift) return { ok: false, reason: 'Finish the active workday first.' };
    const activity = Content.activityById(actionId);
    if (!activity) return { ok: false, reason: 'Unknown activity.' };
    if (world.player.money < activity.cost) return { ok: false, reason: 'Not enough money.' };
    if (actionId === 'play_pc' && !playerObjectByCatalog(world, 'old_laptop') && !playerObjectByCatalog(world, 'fast_computer')) {
      return { ok: false, reason: 'There is no computer in your current home.' };
    }

    const home = World.homeOf(world, 'player');
    const visualBefore = visualRequest ? visualActivitySnapshot(world, visualRequest) : null;
    const originPlaceId = world.player.locationId;
    const destinationPlaceId = activityLocation(actionId, world);
    AXM.Exteriors?.recordBundledTravel(world, 'player', originPlaceId, destinationPlaceId, `${activity.name} outward route`);
    let delay = 0;
    if (actionId === 'shower' && home?.sharedBathroom && Core.chance(world, 0.28 + Math.max(0, home.tenants.length - 2) * 0.06)) {
      delay = 1;
      Core.appendLedger(world, 'life', 'The shared bathroom was occupied, so you waited an hour rather than teleporting through another resident.', {
        actorIds: ['player'], placeId: home.id, causes: ['shared facility', 'another resident using it']
      });
    }

    world.player.money -= activity.cost;
    world.player.lifetimeSpend += activity.cost;
    world.player.locationId = destinationPlaceId;
    advanceHours(world, activity.hours + delay);
    applyNeedEffects(world.player, activity.effects);
    applySkillEffects(world.player, activity.skill);

    if (actionId === 'salvage') {
      const finds = 2 + Core.randomInt(world, 0, 2);
      const found = {};
      for (let i = 0; i < finds; i += 1) {
        const materialId = Core.weightedChoice(world, Object.keys(Content.MATERIALS), (id) => id === 'parts' ? 1.4 : 1);
        world.player.materials[materialId] += 1;
        found[materialId] = (found[materialId] || 0) + 1;
      }
      Core.appendLedger(world, 'materials', `You recovered ${Object.entries(found).map(([id, qty]) => `${qty} ${Content.MATERIALS[id].name.toLowerCase()}`).join(', ')} for future repairs.`, {
        actorIds: ['player'], placeId: 'place_workshop', causes: ['manual salvage activity'], evidence: found
      });
    }

    if (actionId === 'clean_home' && home) {
      home.condition = Core.clamp(home.condition + 1.8, 0, 100);
      home.furniture.forEach((object) => { if (object.ownerId === 'player') object.condition = Core.clamp(object.condition + 0.8, 0, 100); });
    }

    if (actionId === 'play_pc') {
      const computer = playerObjectByCatalog(world, 'old_laptop') || playerObjectByCatalog(world, 'fast_computer');
      if (computer) {
        computer.usageHours += activity.hours;
        computer.sentimental = Core.clamp(computer.sentimental + 0.6, 0, 100);
      }
    }

    if (actionId === 'walk_park') {
      const candidates = world.people.filter((npc) => npc.locationId === 'place_park');
      if (candidates.length) {
        const npc = Core.choice(world, candidates);
        const relation = getRelation(world.player, npc.id);
        relation.friendship = Core.clamp(relation.friendship + 2.5, -100, 100);
        relation.trust = Core.clamp(relation.trust + 1, -100, 100);
        Core.appendLedger(world, 'relationship', `You crossed paths with ${npc.name} in the park. It became a small shared memory, not a forced interaction menu.`, {
          actorIds: ['player', npc.id], placeId: 'place_park', causes: ['shared location', 'chance encounter']
        });
      }
    }

    const finalPlaceId = actionId === 'eat_out' || actionId === 'walk_park' ? destinationPlaceId : world.player.homePropertyId;
    AXM.Exteriors?.recordBundledTravel(world, 'player', destinationPlaceId, finalPlaceId, `${activity.name} return route`);
    world.player.locationId = finalPlaceId;
    const visualReceipt = completedVisualActivityReceipt(world, visualRequest, activity, visualBefore);
    normalizePlayerState(world);
    updateTutorial(world);
    toast(world, `${activity.name} completed.`, 'success');
    return { ok: true, visualReceipt };
  }

  function nextShiftStart(world, job) {
    let daysAhead = 0;
    let targetDay = world.time.day;
    if (Core.weekdayIndex(targetDay) >= 5 || world.time.hour > job.shiftStart) {
      do {
        daysAhead += 1;
        targetDay = world.time.day + daysAhead;
      } while (Core.weekdayIndex(targetDay) >= 5);
    }
    const hours = daysAhead * 24 + (job.shiftStart - world.time.hour);
    return Math.max(0, hours);
  }

  function commuteToShift(world, job) {
    const wait = nextShiftStart(world, job);
    if (wait > 0) advanceHours(world, wait);
    AXM.Exteriors?.recordBundledTravel(world, 'player', world.player.locationId, job.placeId, `commute to ${job.name}`);
    world.player.locationId = job.placeId;
  }

  function startInteractiveShift(world) {
    if (world.activeShift) return { ok: false, reason: 'A shift is already active.' };
    const job = currentJob(world);
    if (!job) return { ok: false, reason: 'No current job.' };
    commuteToShift(world, job);
    world.activeShift = {
      jobId: job.id,
      startedDay: world.time.day,
      remainingHours: job.hours,
      performance: 0,
      innovation: 0,
      taskCounts: {},
      coworkerIds: world.people.filter((npc) => npc.jobId === job.id).map((npc) => npc.id),
      narrative: []
    };
    Core.appendLedger(world, 'work', `You entered the workday at ${job.name}. Each hour can now be influenced, but entering is optional.`, {
      actorIds: ['player'], placeId: job.placeId, causes: ['player chose interactive work']
    });
    toast(world, `Interactive shift started at ${job.name}.`, 'success');
    return { ok: true };
  }

  function finishInteractiveShift(world) {
    const shift = world.activeShift;
    if (!shift) return { ok: false, reason: 'No active shift.' };
    const job = Content.jobById(shift.jobId);
    const normalizedPerformance = Core.clamp(shift.performance / (job.hours * 12), 0.65, 1.18);
    const basePay = job.wage * job.hours;
    const pay = Core.round(basePay * (0.94 + (normalizedPerformance - 0.65) * 0.22), 2);
    world.player.money += pay;
    world.player.lifetimeEarnings += pay;
    world.player.jobExperience += shift.performance + shift.innovation * 5;
    world.tutorial.earnedAtWork += pay;
    Core.appendLedger(world, 'work', `You completed an interactive shift at ${job.name} and earned ${Core.formatMoney(pay)}. The advantage was influence and learning; skipped work remains economically valid.`, {
      actorIds: ['player'], placeId: job.placeId,
      causes: ['completed interactive shift'],
      evidence: { performance: Core.round(shift.performance, 1), innovation: shift.innovation, pay }
    });
    world.activeShift = null;
    AXM.Exteriors?.recordBundledTravel(world, 'player', world.player.locationId, world.player.homePropertyId, `return from ${job.name}`);
    world.player.locationId = world.player.homePropertyId;
    updateTutorial(world);
    toast(world, `Shift complete: ${Core.formatMoney(pay)} earned.`, 'success');
    return { ok: true, pay };
  }

  function performWorkTask(world, taskId) {
    const shift = world.activeShift;
    if (!shift) return { ok: false, reason: 'Start an interactive shift first.' };
    const job = Content.jobById(shift.jobId);
    const task = job.actions.find((entry) => entry.id === taskId);
    if (!task) return { ok: false, reason: 'Unknown task.' };

    advanceHours(world, 1);
    shift.remainingHours -= 1;
    shift.performance += task.performance;
    shift.innovation += task.innovation || 0;
    shift.taskCounts[task.id] = (shift.taskCounts[task.id] || 0) + 1;
    shift.narrative.push(task.name);
    applyNeedEffects(world.player, task.needs || {});
    applySkillEffects(world.player, task.skill || {});

    if (task.coworker && shift.coworkerIds.length) {
      const npc = World.getPerson(world, Core.choice(world, shift.coworkerIds));
      if (npc) {
        const relation = getRelation(world.player, npc.id);
        relation.friendship = Core.clamp(relation.friendship + 3.5, -100, 100);
        relation.trust = Core.clamp(relation.trust + 4.5, -100, 100);
        relation.interactions += 1;
        Core.appendLedger(world, 'relationship', `Working alongside ${npc.name} built trust through a concrete shared task.`, {
          actorIds: ['player', npc.id], placeId: job.placeId, causes: ['coworker assistance']
        });
      }
    }

    if (task.materialChance && Core.chance(world, task.materialChance)) {
      const materialId = Core.choice(world, Object.keys(Content.MATERIALS));
      world.player.materials[materialId] += 1;
      shift.narrative.push(`Recovered 1 ${Content.MATERIALS[materialId].name}`);
    }

    normalizePlayerState(world);
    if (shift.remainingHours <= 0) return finishInteractiveShift(world);
    toast(world, `${task.name}: ${shift.remainingHours} work hours remain.`, 'info');
    return { ok: true };
  }

  function skipShift(world) {
    if (world.activeShift) return { ok: false, reason: 'Finish the active shift first.' };
    const job = currentJob(world);
    if (!job) return { ok: false, reason: 'No current job.' };
    commuteToShift(world, job);
    advanceHours(world, job.hours);
    const pay = Core.round(job.wage * job.hours, 2);
    world.player.money += pay;
    world.player.lifetimeEarnings += pay;
    world.player.jobExperience += job.hours * 7;
    world.tutorial.earnedAtWork += pay;
    applyNeedEffects(world.player, { energy: -12, hunger: -8, mood: -1 });
    applySkillEffects(world.player, { [job.primarySkill]: 0.45 });
    AXM.Exteriors?.recordBundledTravel(world, 'player', world.player.locationId, world.player.homePropertyId, `return from compressed ${job.name} shift`);
    world.player.locationId = world.player.homePropertyId;
    Core.appendLedger(world, 'work', `You fast-forwarded a normal shift at ${job.name} and earned ${Core.formatMoney(pay)}. The game does not treat skipping as the wrong choice.`, {
      actorIds: ['player'], placeId: job.placeId, causes: ['player chose time compression'], evidence: { pay }
    });
    updateTutorial(world);
    toast(world, `Shift skipped cleanly: ${Core.formatMoney(pay)} earned.`, 'success');
    return { ok: true, pay };
  }

  function applyForJob(world, jobId) {
    const job = Content.jobById(jobId);
    if (!job) return { ok: false, reason: 'Unknown job.' };
    const skill = world.player.skills[job.primarySkill] || 0;
    if (skill < job.requirement) return { ok: false, reason: `Requires ${job.requirement} ${job.primarySkill}; you currently have ${Core.round(skill, 1)}.` };
    const oldJob = currentJob(world);
    world.player.jobId = job.id;
    world.player.jobLevel = 1;
    world.player.jobExperience = 0;
    Core.appendLedger(world, 'work', `You changed jobs from ${oldJob?.name || 'none'} to ${job.name}.`, {
      actorIds: ['player'], placeId: job.placeId,
      causes: ['player application', 'skill requirement met'], evidence: { skill: job.primarySkill, level: skill }
    });
    toast(world, `New job: ${job.name}.`, 'success');
    return { ok: true };
  }

  function buyMaterial(world, materialId, quantity = 1) {
    const material = Content.MATERIALS[materialId];
    const qty = Core.clamp(Math.floor(quantity), 1, 20);
    if (!material) return { ok: false, reason: 'Unknown material.' };
    const cost = material.unitPrice * qty;
    if (world.player.money < cost) return { ok: false, reason: 'Not enough money.' };
    world.player.money -= cost;
    world.player.lifetimeSpend += cost;
    world.player.materials[materialId] += qty;
    Core.appendLedger(world, 'materials', `You bought ${qty} ${material.name.toLowerCase()} for ${Core.formatMoney(cost)}.`, {
      actorIds: ['player'], placeId: 'place_market', causes: ['explicit player purchase']
    });
    toast(world, `${qty} ${material.name} added.`, 'success');
    return { ok: true };
  }

  function buyFurniture(world, catalogId) {
    const definition = Content.furnitureById(catalogId);
    const home = World.homeOf(world, 'player');
    if (!definition || !home) return { ok: false, reason: 'Furniture or home unavailable.' };
    if (world.player.money < definition.price) return { ok: false, reason: 'Not enough money.' };
    const object = World.createFurnitureInstance(world, catalogId, 'player', {
      colorId: world.ui.selectedSuggestionColor || 'moss', condition: 100, sentimental: 1
    });
    const placementRule = AXM.Households
      ? (x, y, footprint) => AXM.Households.canPlacePlayerObject(world, home, object, x, y, footprint).ok
      : null;
    if (!World.addFurnitureToProperty(world, home, object, null, placementRule)) return { ok: false, reason: 'No permitted open floor position. Store or move something first.' };
    world.player.money -= definition.price;
    world.player.lifetimeSpend += definition.price;
    world.ui.selectedObjectId = object.id;
    Core.appendObjectHistory(world, object, 'acquired', `You chose this ${definition.name.toLowerCase()} for ${home.name}.`, {
      actorId: 'player', causes: ['player aesthetic choice']
    });
    Core.appendPropertyHistory(world, home, 'decor', `You added a ${definition.name}.`, {
      actorIds: ['player'], objectId: object.id, causes: ['player decoration']
    });
    toast(world, `${definition.name} placed.`, 'success');
    return { ok: true, object };
  }

  function moveFurniture(world, objectId, dx, dy) {
    const found = objectOwnedByPlayer(world, objectId);
    const authority = objectEditAuthority(world, found, { personalOnly: true });
    if (!authority.ok) return authority;
    if (!found.property) return { ok: false, reason: 'Only placed objects can be moved.' };
    const { property, object } = found;
    const x = object.position.x + dx;
    const y = object.position.y + dy;
    if (!World.positionFits(property, property.furniture, x, y, object.footprint, object.id)) return { ok: false, reason: 'Blocked or outside the room.' };
    const permission = AXM.Households?.canPlacePlayerObject(world, property, object, x, y, object.footprint) || { ok: true };
    if (!permission.ok) return permission;
    object.position.x = x;
    object.position.y = y;
    return { ok: true };
  }

  function rotateFurniture(world, objectId) {
    const found = objectOwnedByPlayer(world, objectId);
    const authority = objectEditAuthority(world, found, { personalOnly: true });
    if (!authority.ok) return authority;
    if (!found.property) return { ok: false, reason: 'Only placed objects can be rotated.' };
    const { property, object } = found;
    const rotated = [object.footprint[1], object.footprint[0]];
    if (!World.positionFits(property, property.furniture, object.position.x, object.position.y, rotated, object.id)) return { ok: false, reason: 'No space to rotate here.' };
    const permission = AXM.Households?.canPlacePlayerObject(world, property, object, object.position.x, object.position.y, rotated) || { ok: true };
    if (!permission.ok) return permission;
    object.footprint = rotated;
    object.position.rotation = (object.position.rotation + 90) % 360;
    return { ok: true };
  }

  function recolorFurniture(world, objectId, colorId) {
    const found = objectOwnedByPlayer(world, objectId);
    const authority = objectEditAuthority(world, found);
    if (!authority.ok) return authority;
    if (!Content.paletteById(colorId)) return { ok: false, reason: 'Unknown color.' };
    if (world.player.materials.paint < 1) return { ok: false, reason: 'One paint material is required.' };
    const oldColor = found.object.colorId;
    if (oldColor === colorId) return { ok: false, reason: 'It already has that finish.' };
    world.player.materials.paint -= 1;
    found.object.colorId = colorId;
    found.object.sentimental = Core.clamp(found.object.sentimental + 1.5, 0, 100);
    Core.appendObjectHistory(world, found.object, 'recolor', `You changed the finish from ${Content.paletteById(oldColor).name} to ${Content.paletteById(colorId).name}.`, {
      actorId: 'player', causes: ['player visual preference']
    });
    toast(world, `Recolored to ${Content.paletteById(colorId).name}.`, 'success');
    return { ok: true };
  }

  function upgradeFurniture(world, objectId, axis) {
    if (!UPGRADE_AXES.includes(axis)) return { ok: false, reason: 'Unknown upgrade axis.' };
    const found = objectOwnedByPlayer(world, objectId);
    const authority = objectEditAuthority(world, found);
    if (!authority.ok) return authority;
    const object = found.object;
    const definition = Content.furnitureById(object.catalogId);
    if (object.upgrades[axis] >= 5) return { ok: false, reason: `${Core.titleCase(axis)} is already fully developed.` };
    const cost = Core.objectUpgradeCost(definition, object, axis);
    if (world.player.money < cost.money) return { ok: false, reason: `Needs ${Core.formatMoney(cost.money)}.` };
    const missing = Core.availableMaterialCheck(world.player.materials, cost.materials);
    if (Core.hasMissingMaterials(missing)) {
      return { ok: false, reason: `Missing ${Object.entries(missing).map(([id, qty]) => `${qty} ${Content.MATERIALS[id].name.toLowerCase()}`).join(', ')}.` };
    }
    world.player.money -= cost.money;
    world.player.lifetimeSpend += cost.money;
    Core.consumeMaterials(world.player.materials, cost.materials);
    object.upgrades[axis] += 1;
    object.condition = Core.clamp(object.condition + 4, 0, 100);
    object.sentimental = Core.clamp(object.sentimental + 5, 0, 100);
    world.metrics.playerObjectUpgrades += 1;
    world.tutorial.objectUpgrades += 1;
    Core.appendObjectHistory(world, object, 'upgrade', `You raised ${axis} to level ${object.upgrades[axis]} without replacing the ${definition.name}.`, {
      actorId: 'player', causes: ['upgrade without replacement'],
    });
    if (found.property) {
      Core.appendPropertyHistory(world, found.property, 'upgrade', `The ${definition.name} was improved rather than deleted.`, {
        actorIds: ['player'], objectId: object.id, causes: ['preserved object identity']
      });
    }
    Core.appendLedger(world, 'object', `Your ${definition.name} reached ${Core.titleCase(axis)} level ${object.upgrades[axis]}. It is still the same object.`, {
      actorIds: ['player'], placeId: found.property?.id || null, objectId: object.id,
      causes: ['player invested money and materials'], evidence: { axis, level: object.upgrades[axis] }
    });
    updateTutorial(world);
    toast(world, `${definition.name}: ${Core.titleCase(axis)} improved.`, 'success');
    return { ok: true };
  }

  function repairFurniture(world, objectId) {
    const found = objectOwnedByPlayer(world, objectId);
    const authority = objectEditAuthority(world, found);
    if (!authority.ok) return authority;
    const object = found.object;
    if (object.condition >= 99.5) return { ok: false, reason: 'It does not need repair.' };
    const partsNeeded = object.condition < 45 ? 2 : 1;
    if (world.player.materials.parts < partsNeeded) return { ok: false, reason: `Needs ${partsNeeded} parts.` };
    const money = 8 + partsNeeded * 4;
    if (world.player.money < money) return { ok: false, reason: `Needs ${Core.formatMoney(money)}.` };
    world.player.materials.parts -= partsNeeded;
    world.player.money -= money;
    object.condition = Core.clamp(object.condition + 35 + world.player.skills.repair * 0.25, 0, 100);
    object.sentimental = Core.clamp(object.sentimental + 2, 0, 100);
    applySkillEffects(world.player, { repair: 0.7 });
    Core.appendObjectHistory(world, object, 'repair', 'You repaired the object and preserved its accumulated history.', {
      actorId: 'player', causes: ['condition loss', 'repair instead of replacement']
    });
    toast(world, 'Object repaired.', 'success');
    return { ok: true };
  }

  function storeFurniture(world, objectId) {
    const found = objectOwnedByPlayer(world, objectId);
    const authority = objectEditAuthority(world, found, { personalOnly: true });
    if (!authority.ok) return authority;
    if (!found.property) return { ok: false, reason: 'That object is not currently placed.' };
    found.property.furniture = found.property.furniture.filter((object) => object.id !== objectId);
    if (!world.player.storedFurniture) world.player.storedFurniture = [];
    world.player.storedFurniture.push(found.object);
    Core.appendObjectHistory(world, found.object, 'stored', 'The object was stored, not deleted.', {
      actorId: 'player', causes: ['player space choice', 'no-loss object rule']
    });
    if (world.ui.selectedObjectId === objectId) world.ui.selectedObjectId = null;
    toast(world, 'Object stored without losing its history.', 'success');
    return { ok: true };
  }

  function placeStoredFurniture(world, objectId) {
    const home = World.homeOf(world, 'player');
    if (!home) return { ok: false, reason: 'No current home.' };
    const stored = world.player.storedFurniture || [];
    const index = stored.findIndex((object) => object.id === objectId);
    if (index < 0) return { ok: false, reason: 'Object not found in storage.' };
    const object = stored[index];
    const placementRule = AXM.Households
      ? (x, y, footprint) => AXM.Households.canPlacePlayerObject(world, home, object, x, y, footprint).ok
      : null;
    if (!World.addFurnitureToProperty(world, home, object, null, placementRule)) return { ok: false, reason: 'No permitted open floor position.' };
    stored.splice(index, 1);
    Core.appendObjectHistory(world, object, 'placed', `The object returned from storage to ${home.name}.`, {
      actorId: 'player', causes: ['player placement choice']
    });
    world.ui.selectedObjectId = object.id;
    toast(world, 'Stored object placed.', 'success');
    return { ok: true };
  }

  function interactWithNpc(world, npcId, action, options = {}) {
    if (world.activeShift) return { ok: false, reason: 'Finish the active workday first.' };
    const npc = World.getPerson(world, npcId);
    if (!npc || npc.id === 'player') return { ok: false, reason: 'Person unavailable.' };
    if (AXM.Family?.isDependent(npc)) return { ok: false, reason: 'Use the Family view for age-appropriate care and influence. Dependents never enter adult romance or household-control actions.' };
    const relation = getRelation(world.player, npc.id);
    const fit = playerNpcCompatibility(world, npc);
    const trustFactor = Core.clamp((relation.trust + 25) / 100, 0.1, 1.2);
    let hours = 1;
    let message = '';

    if (action === 'talk') {
      hours = 1;
      const gain = 2.5 + fit / 28 + Core.randomInt(world, 0, 3);
      relation.friendship += gain;
      relation.trust += gain * 0.45;
      message = `You talked with ${npc.name}.`;
    } else if (action === 'spend_time') {
      hours = 2;
      const gain = 5 + fit / 18 + Core.randomInt(world, 0, 4);
      relation.friendship += gain;
      relation.trust += gain * 0.5;
      world.player.needs.mood += 9;
      npc.needs.mood += 7;
      message = `You spent unhurried time with ${npc.name}.`;
    } else if (action === 'help') {
      hours = 2;
      const gain = 4 + trustFactor * 5;
      relation.friendship += gain;
      relation.trust += 7 + trustFactor * 3;
      world.player.needs.energy -= 8;
      message = `You helped ${npc.name} with something concrete.`;
    } else if (action === 'flirt') {
      hours = 1;
      if (relation.friendship < 15) return { ok: false, reason: 'There is not enough familiarity for this to feel grounded.' };
      const acceptance = fit * 0.55 + relation.friendship * 0.25 + relation.trust * 0.2 - npc.traits.independence * 0.08;
      if (Core.randomInt(world, 0, 100) < acceptance) {
        relation.romance += 5 + fit / 18;
        relation.friendship += 2;
        message = `${npc.name} responded warmly, but remains autonomous.`;
      } else {
        relation.romance = Math.max(-10, relation.romance - 2);
        relation.trust = Math.max(-100, relation.trust - 1);
        message = `${npc.name} did not return the flirt. Nothing is forced.`;
      }
    } else if (action === 'ask_date') {
      hours = 1;
      if (relation.friendship < 35 || relation.romance < 18) return { ok: false, reason: 'The relationship is not ready for that question.' };
      const acceptance = 25 + fit * 0.35 + relation.friendship * 0.25 + relation.trust * 0.25 + relation.romance * 0.3 - npc.traits.independence * 0.12;
      if (Core.randomInt(world, 0, 100) < acceptance) {
        relation.status = 'dating';
        relation.romance = Math.max(38, relation.romance);
        message = `${npc.name} chose to start dating you.`;
        world.metrics.relationshipsFormed += 1;
      } else {
        relation.trust = Math.max(-100, relation.trust - 2);
        message = `${npc.name} declined the date. The simulation preserves their agency.`;
      }
    } else if (action === 'invite_move_in') {
      if (!AXM.Households) return { ok: false, reason: 'Household agreement module is unavailable.' };
      const household = AXM.Households.playerHousehold(world);
      if (!household) return { ok: false, reason: 'Commitment must be proposed and accepted before cohabitation. Open Agreements to begin that conversation.' };
      const home = World.homeOf(world, 'player');
      if (!home) return { ok: false, reason: 'No current home is available.' };
      return Systems.proposeCohabitation(world, npc.id, home.id);
    } else if (action === 'decor_suggestion') {
      hours = 1;
      if (relation.trust < 20) return { ok: false, reason: 'More trust is needed before décor advice feels welcome.' };
      const colorId = options.colorId || world.ui.selectedSuggestionColor || 'moss';
      const home = World.homeOf(world, npc.id);
      const choices = home?.furniture.filter((object) => object.ownerId === npc.id) || [];
      if (!choices.length) return { ok: false, reason: `${npc.name} has no personal object available for this suggestion.` };
      const acceptance = 30 + relation.trust * 0.35 + fit * 0.2 + (npc.preferences.colors.includes(colorId) ? 24 : 0) - npc.traits.independence * 0.22;
      if (Core.randomInt(world, 0, 100) < acceptance) {
        const object = Core.choice(world, choices);
        const oldColor = object.colorId;
        object.colorId = colorId;
        Core.appendObjectHistory(world, object, 'influenced_recolor', `${npc.name} accepted your suggestion and chose ${Content.paletteById(colorId).name}.`, {
          actorId: npc.id, causes: ['trusted suggestion', 'NPC acceptance']
        });
        Core.appendPropertyHistory(world, home, 'decor', `${npc.name} recolored a ${Content.furnitureById(object.catalogId).name} after considering your suggestion.`, {
          actorIds: ['player', npc.id], objectId: object.id, causes: ['influence, not direct control'],
        });
        relation.trust += 1;
        message = `${npc.name} accepted the suggestion and changed ${Content.paletteById(oldColor).name} to ${Content.paletteById(colorId).name}.`;
      } else {
        message = `${npc.name} listened but kept their own color choice.`;
      }
      world.player.influenceActions += 1;
    } else {
      return { ok: false, reason: 'Unknown interaction.' };
    }

    world.player.locationId = npc.locationId;
    advanceHours(world, hours);
    relation.friendship = Core.clamp(relation.friendship, -100, 100);
    relation.romance = Core.clamp(relation.romance, -100, 100);
    relation.trust = Core.clamp(relation.trust, -100, 100);
    relation.interactions += 1;
    relation.lastInteractionDay = world.time.day;
    if (relation.friendship >= 45 && !['dating', 'partner'].includes(relation.status)) relation.status = 'friend';
    else if (relation.friendship >= 15 && relation.status === 'stranger') relation.status = 'acquaintance';
    if (relation.interactions >= 2 && !npc.knownFacts.includes('personalGoal')) npc.knownFacts.push('personalGoal');
    if (relation.interactions >= 3 && !npc.knownFacts.includes('preferences')) npc.knownFacts.push('preferences');
    applyNeedEffects(world.player, { social: 10, mood: 3, energy: -3 });
    world.player.locationId = world.player.homePropertyId;
    Core.appendLedger(world, 'relationship', message, {
      actorIds: ['player', npc.id], placeId: npc.locationId,
      causes: [`player chose ${action}`, 'NPC response used personality and relationship state'],
      evidence: { compatibility: fit, friendship: Core.round(relation.friendship, 1), trust: Core.round(relation.trust, 1), romance: Core.round(relation.romance, 1) }
    });
    updateTutorial(world);
    toast(world, message, 'info');
    return { ok: true, message };
  }

  function rentProperty(world, propertyId) {
    const property = World.getProperty(world, propertyId);
    if (!property) return { ok: false, reason: 'Unknown property.' };
    if (property.tenants.length >= property.capacity) return { ok: false, reason: 'No vacancy remains.' };
    if (property.tenants.includes('player')) return { ok: false, reason: 'You already live here.' };
    const movePermission = AXM.Households?.playerMovePermission(world, property.id) || { ok: true };
    if (!movePermission.ok) return movePermission;
    const deposit = property.currentRent;
    if (world.player.money < deposit) return { ok: false, reason: `A visible deposit of ${Core.formatMoney(deposit)} is required.` };
    const origin = World.homeOf(world, 'player');
    world.player.money -= deposit;
    world.player.lifetimeSpend += deposit;
    if (origin) {
      origin.tenants = origin.tenants.filter((id) => id !== 'player');
      origin.listedForRent = origin.tenants.length < origin.capacity;
      transferPersonalFurniture(world, 'player', origin, property);
      Core.appendPropertyHistory(world, origin, 'move_out', 'The player moved out, leaving other residents and property-owned objects intact.', {
        actorIds: ['player'], causes: ['player rental choice']
      });
    }
    property.tenants.push('player');
    property.listedForRent = property.tenants.length < property.capacity;
    world.player.homePropertyId = property.id;
    world.player.locationId = property.id;
    world.metrics.totalMoves += 1;
    world.metrics.playerMoves += 1;
    world.tutorial.homesRented += 1;
    Core.appendPropertyHistory(world, property, 'move_in', 'The player rented an available place in the same market NPCs use.', {
      actorIds: ['player'], causes: ['real vacancy', 'deposit paid']
    });
    Core.appendLedger(world, 'housing', `You rented ${property.name} for ${Core.formatMoney(property.currentRent)} per month after it was genuinely available.`, {
      actorIds: ['player'], placeId: property.id,
      causes: ['real vacancy', 'player choice', 'deposit paid'], evidence: { deposit, monthlyRent: property.currentRent }
    });
    updateTutorial(world);
    toast(world, `Moved into ${property.name}.`, 'success');
    return { ok: true };
  }

  function buyProperty(world, propertyId) {
    const property = World.getProperty(world, propertyId);
    if (!property) return { ok: false, reason: 'Unknown property.' };
    if (!property.listedForSale) return { ok: false, reason: 'This property is not currently for sale.' };
    if (property.ownerId === 'player') return { ok: false, reason: 'You already own it.' };
    if (world.player.money < property.purchasePrice) return { ok: false, reason: `Needs ${Core.formatMoney(property.purchasePrice)}.` };
    world.player.money -= property.purchasePrice;
    world.player.lifetimeSpend += property.purchasePrice;
    property.ownerId = 'player';
    property.ownerLabel = world.player.name;
    property.furniture.forEach((object) => {
      if (object.ownershipMode === 'property_fixture') object.ownerId = 'player';
    });
    property.listedForSale = false;
    world.player.ownedPropertyIds.push(property.id);
    world.metrics.propertyPurchases += 1;
    Core.appendPropertyHistory(world, property, 'ownership', 'The player purchased the property without removing its existing tenants.', {
      actorIds: ['player'].concat(property.tenants), causes: ['voluntary sale', 'tenant continuity']
    });
    Core.appendLedger(world, 'housing', `You purchased ${property.name}. Existing residents stayed; ownership did not grant direct control over them.`, {
      actorIds: ['player'].concat(property.tenants), placeId: property.id,
      causes: ['purchase price paid', 'no automatic displacement'], evidence: { price: property.purchasePrice }
    });
    toast(world, `${property.name} purchased with tenants preserved.`, 'success');
    return { ok: true };
  }

  function setOwnedRent(world, propertyId, rent) {
    const property = World.getProperty(world, propertyId);
    if (!property || property.ownerId !== 'player') return { ok: false, reason: 'You do not own this property.' };
    const market = property.rent;
    const value = Core.clamp(Math.round(rent), Math.round(market * 0.7), Math.round(market * 1.3));
    property.currentRent = value;
    property.playerSetRent = value;
    Core.appendPropertyHistory(world, property, 'rent_change', `The monthly rent was set to ${Core.formatMoney(value)}.`, {
      actorIds: ['player'], causes: ['owner decision', 'bounded market range']
    });
    toast(world, `Rent set to ${Core.formatMoney(value)}.`, 'success');
    return { ok: true };
  }

  function moveIntoOwnedProperty(world, propertyId) {
    const property = World.getProperty(world, propertyId);
    if (!property || property.ownerId !== 'player') return { ok: false, reason: 'You do not own this property.' };
    if (property.tenants.length >= property.capacity && !property.tenants.includes('player')) return { ok: false, reason: 'No capacity. Existing tenants are not evicted automatically.' };
    if (property.tenants.includes('player')) return { ok: false, reason: 'You already live there.' };
    const movePermission = AXM.Households?.playerMovePermission(world, property.id) || { ok: true };
    if (!movePermission.ok) return movePermission;
    const origin = World.homeOf(world, 'player');
    if (origin) {
      origin.tenants = origin.tenants.filter((id) => id !== 'player');
      transferPersonalFurniture(world, 'player', origin, property);
    }
    property.tenants.push('player');
    world.player.homePropertyId = property.id;
    world.player.locationId = property.id;
    world.metrics.totalMoves += 1;
    world.metrics.playerMoves += 1;
    Core.appendLedger(world, 'housing', `You moved into your property at ${property.name} without displacing anyone.`, {
      actorIds: ['player'], placeId: property.id, causes: ['owner occupancy', 'available capacity']
    });
    toast(world, `Moved into ${property.name}.`, 'success');
    return { ok: true };
  }

  function startPlayerTravel(world, destinationPlaceId, mode = 'visible') {
    return AXM.Presence?.startPlayerJourney(world, destinationPlaceId, mode)
      || AXM.Exteriors?.startPlayerTravel(world, destinationPlaceId, mode)
      || { ok: false, reason: 'Walkable-place engine unavailable.' };
  }

  function stepPlayerTravel(world) {
    return AXM.Exteriors?.stepPlayerTravel(world) || { ok: false, reason: 'Walkable-place engine unavailable.' };
  }

  function finishPlayerTravelCompressed(world) {
    return AXM.Exteriors?.finishPlayerTravelCompressed(world) || { ok: false, reason: 'Walkable-place engine unavailable.' };
  }

  function endPlayerTravelEarly(world) {
    return AXM.Exteriors?.endPlayerTravelEarly(world) || { ok: false, reason: 'Walkable-place engine unavailable.' };
  }

  function prepareWalkableExperiment(world) {
    return AXM.Exteriors?.prepareWalkableExperiment(world) || { ok: false, reason: 'Walkable-place engine unavailable.' };
  }

  function computeDecorSignature(property) {
    // A visual-state signature, not an ownership fingerprint. Object IDs are
    // intentionally excluded so two rooms that look the same compare alike.
    const tokens = property.furniture.map((object) => {
      const position = object.position || { x: 0, y: 0 };
      return [
        object.catalogId,
        object.colorId,
        Core.sumObjectUpgrades(object),
        position.x,
        position.y,
        object.footprint?.[0] || 1,
        object.footprint?.[1] || 1,
        position.rotation || 0
      ].join(':');
    }).sort();
    return Core.hashString(tokens.join('|')).toString(16).padStart(8, '0');
  }

  function captureResidentialDecorSignatures(world) {
    return Object.fromEntries(
      world.places
        .filter((place) => place.kind === 'residential')
        .map((property) => [property.id, {
          id: property.id,
          name: property.name,
          signature: computeDecorSignature(property)
        }])
    );
  }

  function computeMetrics(world) {
    const properties = world.places.filter((place) => place.kind === 'residential');
    const occupiedProperties = properties.filter((property) => property.tenants.length > 0);
    const fullyVacant = properties.filter((property) => property.tenants.length === 0);
    const availableSlots = properties.reduce((sum, property) => sum + Math.max(0, property.capacity - property.tenants.length), 0);
    const objects = properties.flatMap((property) => property.furniture);
    const upgradeLevels = objects.map(Core.sumObjectUpgrades);
    const signatures = new Set(properties.map(computeDecorSignature));
    const colors = new Set(objects.map((object) => object.colorId));
    const catalogTypes = new Set(objects.map((object) => object.catalogId));
    const npcMoney = world.people.map((npc) => npc.money);
    const playerObjects = objects.filter((object) => object.ownerId === 'player' && object.ownershipMode !== 'property_fixture').concat(world.player.storedFurniture || []);
    const oldestPlayerObject = playerObjects.sort((a, b) => a.acquiredDay - b.acquiredDay)[0];
    const friendCount = Object.values(world.player.relationships).filter((relation) => relation.friendship >= 45).length;
    return {
      day: world.time.day,
      population: world.people.length + 1,
      residentialProperties: properties.length,
      occupiedProperties: occupiedProperties.length,
      fullyVacantProperties: fullyVacant.length,
      availableHousingSlots: availableSlots,
      occupancyRate: Core.round(occupiedProperties.length / properties.length * 100, 1),
      furnitureObjects: objects.length,
      objectUpgradeLevels: upgradeLevels.reduce((sum, value) => sum + value, 0),
      averageUpgradeLevel: Core.round(Core.average(upgradeLevels), 2),
      decorSignatureCount: signatures.size,
      colorVariety: colors.size,
      furnitureTypeVariety: catalogTypes.size,
      npcWealthAverage: Core.round(Core.average(npcMoney), 0),
      npcWealthSpread: Core.round(Core.standardDeviation(npcMoney), 0),
      moves: world.metrics.totalMoves,
      npcDecorActions: world.metrics.npcDecorations,
      npcUpgradeActions: world.metrics.npcObjectUpgrades,
      autonomousSocialEvents: world.metrics.autonomousSocialEvents,
      playerFriends: friendCount,
      playerMoney: Core.round(world.player.money, 0),
      playerOwnedProperties: world.player.ownedPropertyIds.length,
      oldestPlayerObjectAge: oldestPlayerObject ? world.time.day - oldestPlayerObject.acquiredDay : 0,
      activeHouseholds: Array.isArray(world.households) ? world.households.filter((entry) => entry.status === 'active').length : 0,
      pendingHouseholdProposals: Array.isArray(world.householdProposals) ? world.householdProposals.filter((entry) => ['pending_npc', 'awaiting_player'].includes(entry.status)).length : 0,
      openHouseholdIssues: Array.isArray(world.householdIssues) ? world.householdIssues.filter((entry) => entry.status === 'open').length : 0,
      sharedReserve: AXM.Households?.playerHousehold(world)?.sharedReserve || 0,
      householdAgreementRevision: AXM.Households?.playerHousehold(world)?.revision || 0,
      householdSeparations: world.metrics.householdSeparations || 0,
      habitatRooms: properties.reduce((sum, property) => sum + (property.habitat?.rooms?.length || 0), 0),
      habitatDoors: properties.reduce((sum, property) => sum + (property.habitat?.partitions || []).filter((entry) => entry.kind === 'door').length, 0),
      habitatProjectsPlanned: world.metrics.habitatProjectsPlanned || 0,
      habitatProjectsCompleted: world.metrics.habitatProjectsCompleted || 0,
      structuralChanges: world.metrics.structuralChanges || 0,
      surfaceProjects: world.metrics.surfaceProjects || 0,
      utilityProjects: world.metrics.utilityProjects || 0,
      habitatIntentionsActive: AXM.Stewardship?.metrics(world).activeIntentions || 0,
      stewardshipPendingPlayer: AXM.Stewardship?.metrics(world).pendingPlayerRequests || 0,
      stewardshipPendingExternal: AXM.Stewardship?.metrics(world).pendingExternalRequests || 0,
      stewardshipCompleted: AXM.Stewardship?.metrics(world).completedIntentions || 0,
      stewardshipDeclined: AXM.Stewardship?.metrics(world).declinedIntentions || 0,
      stewardshipWorking: AXM.Stewardship?.metrics(world).workingProjects || 0,
      stewardshipEscrow: AXM.Stewardship?.metrics(world).escrowMoney || 0,
      stewardshipResidentSavings: AXM.Stewardship?.metrics(world).residentSavings || 0,
      stewardshipOwnerContributions: AXM.Stewardship?.metrics(world).ownerContributions || 0,
      stewardshipProjectPhases: AXM.Stewardship?.metrics(world).phasesCompleted || 0,
      familyActiveUnits: AXM.Family?.metrics(world).activeUnits || 0,
      familyActiveDependents: AXM.Family?.metrics(world).activeDependents || 0,
      familyCareCoverage: AXM.Family?.metrics(world).recentCareCoverage || 0,
      familyLifeStageTransitions: AXM.Family?.metrics(world).lifeStageTransitions || 0,
      communityInstitutions: AXM.Community?.metrics(world).institutions || 0,
      communityActiveMemberships: AXM.Community?.metrics(world).activeMemberships || 0,
      communityWaitingMemberships: AXM.Community?.metrics(world).waitingMemberships || 0,
      communityOpenOpportunities: AXM.Community?.metrics(world).openOpportunities || 0,
      communityAwaitingPlayer: AXM.Community?.metrics(world).awaitingPlayer || 0,
      communityPlayerConnections: AXM.Community?.metrics(world).playerConnections || 0,
      communityMentorLinks: AXM.Community?.metrics(world).mentorLinks || 0,
      communityActiveAdventures: AXM.Community?.metrics(world).activeAdventures || 0,
      communityCompletedAdventures: AXM.Community?.metrics(world).completedAdventures || 0,
      communityVisitsCompleted: AXM.Community?.metrics(world).visitsCompleted || 0,
      personalProjectsOpen: AXM.Directions?.metrics(world).playerOpen || 0,
      personalProjectsCompleted: AXM.Directions?.metrics(world).playerCompleted || 0,
      personalProjectsReleased: AXM.Directions?.metrics(world).playerReleased || 0,
      personalProjectCollaborationsPending: AXM.Directions?.metrics(world).pendingCollaborations || 0,
      npcPersonalProjectsOpen: AXM.Directions?.metrics(world).npcOpen || 0,
      npcPersonalProjectsCompleted: AXM.Directions?.metrics(world).npcCompleted || 0,
      playerEnterprises: AXM.Economy?.metrics(world).playerDirections || 0,
      playerPrivateEnterprises: AXM.Economy?.metrics(world).playerPrivate || 0,
      playerOccasionalEnterprises: AXM.Economy?.metrics(world).playerOccasional || 0,
      playerOpenEnterprises: AXM.Economy?.metrics(world).playerOpen || 0,
      playerPausedEnterprises: AXM.Economy?.metrics(world).playerPaused || 0,
      npcEnterprises: AXM.Economy?.metrics(world).npcDirections || 0,
      localEconomyNeeds: AXM.Economy?.metrics(world).localNeeds || 0,
      localEconomyHighestNeed: AXM.Economy?.metrics(world).highestNeedScore || 0,
      commercialPremises: AXM.Economy?.metrics(world).premises || 0,
      vacantCommercialPremises: AXM.Economy?.metrics(world).vacantPremises || 0,
      enterpriseCustomersServed: AXM.Economy?.metrics(world).customersServed || 0,
      enterpriseRevenue: AXM.Economy?.metrics(world).revenue || 0,
      enterpriseFlexibleServices: AXM.Economy?.metrics(world).flexibleServices || 0,
      activeEnterpriseSession: AXM.Economy?.metrics(world).activeSession || false,
      exteriorPlaces: AXM.Exteriors?.metrics(world).exteriorPlaces || 0,
      streetNetworkNodes: AXM.Exteriors?.metrics(world).networkNodes || 0,
      streetNetworkEdges: AXM.Exteriors?.metrics(world).networkEdges || 0,
      activeTravel: AXM.Exteriors?.metrics(world).activeTravel || false,
      playerJourneys: AXM.Exteriors?.metrics(world).playerJourneys || 0,
      playerWalkingMinutes: AXM.Exteriors?.metrics(world).playerWalkingMinutes || 0,
      playerWalkingDistanceMeters: AXM.Exteriors?.metrics(world).playerDistanceMeters || 0,
      npcRoutesObserved: AXM.Exteriors?.metrics(world).npcRoutesObserved || 0,
      streetMoments: AXM.Exteriors?.metrics(world).streetMoments || 0,
      buildingShells: AXM.Shells?.metrics(world).buildings || 0,
      multiStoreyBuildings: AXM.Shells?.metrics(world).multiStoreyBuildings || 0,
      buildingStoreys: AXM.Shells?.metrics(world).storeys || 0,
      buildingWallEdges: AXM.Shells?.metrics(world).wallEdges || 0,
      buildingWindows: AXM.Shells?.metrics(world).windows || 0,
      buildingStairs: AXM.Shells?.metrics(world).stairs || 0,
      pendingFrontageRequests: AXM.Shells?.metrics(world).pendingPlayerRequests || 0,
      completedFrontageProjects: AXM.Shells?.metrics(world).completedProjects || 0,
      trackedLivedBuildings: AXM.Presence?.metrics(world).trackedBuildings || 0,
      currentPresenceSnapshots: AXM.Presence?.metrics(world).presenceSnapshots || 0,
      playerInsideBuilding: AXM.Presence?.metrics(world).playerInside || false,
      playerPresenceKind: AXM.Presence?.metrics(world).playerPresenceKind || null,
      visibleCoPresentPeople: AXM.Presence?.metrics(world).visiblePeople || 0,
      exactCoPresentPeople: AXM.Presence?.metrics(world).exactCoPresentPeople || 0,
      privacyCoarsenedPeople: AXM.Presence?.metrics(world).privacyCoarsenedPeople || 0,
      activeIndoorMovement: AXM.Presence?.metrics(world).activeIndoorMovement || false,
      indoorMovementsCompleted: AXM.Presence?.metrics(world).indoorMovements || 0,
      indoorStairUses: AXM.Presence?.metrics(world).stairUses || 0,
      pendingOrdinaryEncounters: AXM.Presence?.metrics(world).encountersAwaiting || 0,
      ordinaryEncountersOffered: AXM.Presence?.metrics(world).encountersOffered || 0,
      ordinaryEncountersDeclined: AXM.Presence?.metrics(world).encountersDeclined || 0,
      indoorMovementCompressionAllowed: AXM.Presence?.metrics(world).presenceCompressionAllowed !== false,
      presenceGrantsAuthority: false,
      compulsoryGreetings: AXM.Presence?.metrics(world).compulsoryGreetings === true,
      presenceSurveillance: AXM.Presence?.metrics(world).surveillance === true,
      minuteByMinutePresenceTax: AXM.Presence?.metrics(world).minuteByMinuteTax === true,
      facadeMaintenanceObligation: false,
      travelCompressionAllowed: AXM.Exteriors?.metrics(world).compressionAllowed !== false,
      walkingObligation: false,
      lifeCourseMode: world.settings?.lifeCourseMode || 'choice',
      agePressure: false
    };
  }

  function migrateWorld(world) {
    if (!world || typeof world !== 'object') throw new Error('World state must be an object.');
    if (world.schema === Core.SCHEMA) {
      world.version = Core.VERSION;
      AXM.Households?.ensureState(world);
      AXM.Habitats?.ensureState(world);
      AXM.Stewardship?.ensureState(world);
      AXM.Family?.ensureState(world);
      AXM.Community?.ensureState(world);
      AXM.Directions?.ensureState(world);
      AXM.Economy?.ensureState(world);
      AXM.Exteriors?.initializeWorld(world, { silent: true, migration: true });
      AXM.Shells?.initializeWorld(world, { silent: true, migration: true });
      AXM.Presence?.initializeWorld(world, { silent: true, migration: true });
      AXM.Visuals?.ensureUiState(world);
      return world;
    }
    if (!Core.LEGACY_SCHEMAS.includes(world.schema)) throw new Error(`Unsupported migration source: ${String(world.schema)}.`);

    const sourceSchema = world.schema;
    const fromV01 = sourceSchema === 'axm.living-city-sim.world/v0.1.0';
    world.schema = Core.SCHEMA;
    world.version = Core.VERSION;
    if (!Array.isArray(world.households)) world.households = [];
    if (!Array.isArray(world.householdProposals)) world.householdProposals = [];
    if (!Array.isArray(world.householdIssues)) world.householdIssues = [];
    if (!Array.isArray(world.habitatIntentions)) world.habitatIntentions = [];
    if (!Array.isArray(world.stewardshipRequests)) world.stewardshipRequests = [];
    if (!Array.isArray(world.familyUnits)) world.familyUnits = [];
    if (!Array.isArray(world.familyProposals)) world.familyProposals = [];
    if (!Array.isArray(world.careRecords)) world.careRecords = [];
    if (!Array.isArray(world.communityInstitutions)) world.communityInstitutions = [];
    if (!Array.isArray(world.communityOpportunities)) world.communityOpportunities = [];
    if (!Array.isArray(world.communityConnections)) world.communityConnections = [];
    if (!Array.isArray(world.adventureThreads)) world.adventureThreads = [];
    if (!Array.isArray(world.personalProjects)) world.personalProjects = [];
    if (!Array.isArray(world.localNeeds)) world.localNeeds = [];
    if (!Array.isArray(world.enterprises)) world.enterprises = [];
    if (!Array.isArray(world.enterpriseSessions)) world.enterpriseSessions = [];
    if (!Array.isArray(world.enterpriseWorkOffers)) world.enterpriseWorkOffers = [];
    if (world.activeEnterpriseSessionId === undefined) world.activeEnterpriseSessionId = null;
    if (!Array.isArray(world.travelRecords)) world.travelRecords = [];
    if (!Array.isArray(world.streetMoments)) world.streetMoments = [];
    if (!world.exteriorState || typeof world.exteriorState !== 'object') world.exteriorState = {};
    if (!Array.isArray(world.buildings)) world.buildings = [];
    if (!Array.isArray(world.frontageProposals)) world.frontageProposals = [];
    if (!Array.isArray(world.frontageProjects)) world.frontageProjects = [];
    if (!world.shellState || typeof world.shellState !== 'object') world.shellState = {};
    if (!Number.isInteger(world.shellIdCounter) || world.shellIdCounter < 0) world.shellIdCounter = 0;
    if (!world.presenceByPerson || typeof world.presenceByPerson !== 'object' || Array.isArray(world.presenceByPerson)) world.presenceByPerson = {};
    if (!Array.isArray(world.presenceRecords)) world.presenceRecords = [];
    if (!Array.isArray(world.ordinaryEncounters)) world.ordinaryEncounters = [];
    if (!Array.isArray(world.presenceAccessGrants)) world.presenceAccessGrants = [];
    if (!world.presenceState || typeof world.presenceState !== 'object') world.presenceState = {};
    if (world.activeIndoorMovement === undefined) world.activeIndoorMovement = null;
    if (!Number.isInteger(world.presenceIdCounter) || world.presenceIdCounter < 0) world.presenceIdCounter = 0;
    if (world.activeTravel === undefined) world.activeTravel = null;
    if (!Number.isInteger(world.exteriorIdCounter) || world.exteriorIdCounter < 0) world.exteriorIdCounter = 0;
    if (!world.time || typeof world.time !== 'object') world.time = { day: 1, hour: 7, minute: 0 };
    if (!Number.isInteger(world.time.minute) || world.time.minute < 0 || world.time.minute > 59) world.time.minute = 0;
    if (!world.metrics || typeof world.metrics !== 'object') world.metrics = {};
    AXM.Visuals?.ensureUiState(world);
    const metricDefaults = {
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
      habitatProjectsPlanned: 0,
      habitatProjectsCompleted: 0,
      habitatProjectsCancelled: 0,
      habitatProjectsFailed: 0,
      structuralChanges: 0,
      surfaceProjects: 0,
      utilityProjects: 0,
      habitatRepairs: 0,
      roomPurposeChanges: 0,
      habitatObjectsReflowed: 0,
      habitatObjectsStored: 0,
      habitatMigrations: 0,
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
      buildingShellsCreated: 0,
      frontageProposalsCreated: 0,
      frontageProposalsApproved: 0,
      frontageProposalsDeclined: 0,
      frontageProjectsCreated: 0,
      frontageProjectsCompleted: 0,
      frontageProjectsFailed: 0,
      frontageProjectPhases: 0,
      frontageResidentSavings: 0,
      shellExperimentRuns: 0,
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
    };
    Object.entries(metricDefaults).forEach(([key, value]) => {
      if (!Number.isFinite(world.metrics[key])) world.metrics[key] = value;
    });
    if (!world.player || typeof world.player !== 'object') throw new Error('Legacy save has no valid player record.');
    if (!Array.isArray(world.player.storedFurniture)) world.player.storedFurniture = [];

    if (fromV01) {
      // v0.1 had relationship labels but no accepted household contract. Do
      // not fabricate consent while adding the later state containers.
      world.player.householdId = null;
      (Array.isArray(world.people) ? world.people : []).forEach((person) => {
        if (!Array.isArray(person.storedFurniture)) person.storedFurniture = [];
        person.householdId = null;
        person.householdInitiativeCooldownUntil = 0;
        person.habitatIntentionCooldownUntil = 0;
        person.stewardshipReliability = 0;
      });
      world.households = [];
      world.householdProposals = [];
      world.householdIssues = [];
    } else {
      // v0.2 household agreements are genuine accepted state and must survive
      // the structural habitat migration exactly as recorded.
      (Array.isArray(world.people) ? world.people : []).forEach((person) => {
        if (!Array.isArray(person.storedFurniture)) person.storedFurniture = [];
        if (person.householdId === undefined) person.householdId = null;
        if (!Number.isFinite(person.householdInitiativeCooldownUntil)) person.householdInitiativeCooldownUntil = 0;
        if (!Number.isFinite(person.habitatIntentionCooldownUntil)) person.habitatIntentionCooldownUntil = 0;
        if (!Number.isFinite(person.stewardshipReliability)) person.stewardshipReliability = 0;
      });
      if (world.player.householdId === undefined) world.player.householdId = null;
    }

    (Array.isArray(world.places) ? world.places : []).filter((place) => place.kind === 'residential').forEach((property) => {
      property.rentBasis = property.rentBasis || (property.id === 'home_student' ? 'per_tenant' : 'whole_property');
      property.utilitiesIncluded = typeof property.utilitiesIncluded === 'boolean' ? property.utilitiesIncluded : property.id === 'home_student';
      property.weeklyUtilityBase = Number.isFinite(property.weeklyUtilityBase)
        ? property.weeklyUtilityBase
        : property.id === 'home_student' ? 0 : 8 + Math.round((property.roomGrid?.[0] || 1) * (property.roomGrid?.[1] || 1) / 25);
    });
    if (!world.ui || typeof world.ui !== 'object') world.ui = {};
    if (world.ui.selectedHouseholdId === undefined) world.ui.selectedHouseholdId = null;
    if (world.ui.selectedProposalId === undefined) world.ui.selectedProposalId = null;
    if (world.ui.selectedIssueId === undefined) world.ui.selectedIssueId = null;
    if (world.ui.selectedFamilyUnitId === undefined) world.ui.selectedFamilyUnitId = null;
    if (world.ui.selectedFamilyProposalId === undefined) world.ui.selectedFamilyProposalId = null;
    if (world.ui.selectedDependentId === undefined) world.ui.selectedDependentId = null;
    if (world.ui.selectedCommunityInstitutionId === undefined) world.ui.selectedCommunityInstitutionId = null;
    if (world.ui.selectedCommunityOpportunityId === undefined) world.ui.selectedCommunityOpportunityId = null;
    if (world.ui.selectedCommunityConnectionId === undefined) world.ui.selectedCommunityConnectionId = null;
    if (world.ui.selectedAdventureId === undefined) world.ui.selectedAdventureId = null;
    if (world.ui.selectedPersonalProjectId === undefined) world.ui.selectedPersonalProjectId = null;
    if (world.ui.selectedEnterpriseId === undefined) world.ui.selectedEnterpriseId = null;
    if (world.ui.selectedCommercialPremiseId === undefined) world.ui.selectedCommercialPremiseId = null;
    if (world.ui.selectedStreetMomentId === undefined) world.ui.selectedStreetMomentId = null;
    if (world.ui.streetRouteDestinationId === undefined) world.ui.streetRouteDestinationId = world.ui.selectedPlaceId || world.player.homePropertyId;
    if (world.ui.selectedBuildingId === undefined) world.ui.selectedBuildingId = null;
    if (world.ui.selectedPresenceBuildingId === undefined) world.ui.selectedPresenceBuildingId = null;
    if (world.ui.selectedPresencePlaceId === undefined) world.ui.selectedPresencePlaceId = null;
    if (world.ui.selectedPresencePersonId === undefined) world.ui.selectedPresencePersonId = 'player';
    if (world.ui.selectedPresenceRoomId === undefined) world.ui.selectedPresenceRoomId = null;
    if (world.ui.selectedEncounterId === undefined) world.ui.selectedEncounterId = null;
    if (world.ui.selectedFrontageProposalId === undefined) world.ui.selectedFrontageProposalId = null;
    if (world.ui.selectedRoomId === undefined) world.ui.selectedRoomId = null;
    if (world.ui.selectedHabitatProjectId === undefined) world.ui.selectedHabitatProjectId = null;
    if (world.ui.selectedHabitatEdgeKey === undefined) world.ui.selectedHabitatEdgeKey = null;
    if (world.ui.selectedHabitatIntentionId === undefined) world.ui.selectedHabitatIntentionId = null;
    if (world.ui.selectedStewardshipRequestId === undefined) world.ui.selectedStewardshipRequestId = null;
    if (!world.flags || typeof world.flags !== 'object') world.flags = {};
    if (world.flags.householdExperimentPrepared === undefined) world.flags.householdExperimentPrepared = false;
    if (world.flags.stewardshipExperimentPrepared === undefined) world.flags.stewardshipExperimentPrepared = false;
    if (world.flags.familyExperimentPrepared === undefined) world.flags.familyExperimentPrepared = false;
    if (world.flags.communityExperimentPrepared === undefined) world.flags.communityExperimentPrepared = false;
    if (world.flags.communityFoundationLogged === undefined) world.flags.communityFoundationLogged = false;
    if (world.flags.personalDirectionsExperimentPrepared === undefined) world.flags.personalDirectionsExperimentPrepared = false;
    if (world.flags.personalDirectionsFoundationLogged === undefined) world.flags.personalDirectionsFoundationLogged = false;
    if (world.flags.enterpriseExperimentPrepared === undefined) world.flags.enterpriseExperimentPrepared = false;
    if (world.flags.enterpriseFoundationLogged === undefined) world.flags.enterpriseFoundationLogged = false;
    if (world.flags.enterpriseSeeded === undefined) world.flags.enterpriseSeeded = false;
    if (world.flags.exteriorFoundationLogged === undefined) world.flags.exteriorFoundationLogged = false;
    if (world.flags.walkableExperimentPrepared === undefined) world.flags.walkableExperimentPrepared = false;
    if (world.flags.shellFoundationLogged === undefined) world.flags.shellFoundationLogged = false;
    if (world.flags.shellExperimentPrepared === undefined) world.flags.shellExperimentPrepared = false;
    if (world.flags.presenceFoundationLogged === undefined) world.flags.presenceFoundationLogged = false;
    if (world.flags.presenceExperimentPrepared === undefined) world.flags.presenceExperimentPrepared = false;
    if (!world.settings || typeof world.settings !== 'object') world.settings = {};
    if (typeof world.settings.casualRealism !== 'boolean') world.settings.casualRealism = true;
    if (typeof world.settings.noDailyStreaks !== 'boolean') world.settings.noDailyStreaks = true;
    if (typeof world.settings.opportunityExpiryPenalty !== 'boolean') world.settings.opportunityExpiryPenalty = false;
    if (!['choice', 'calendar'].includes(world.settings.lifeCourseMode)) world.settings.lifeCourseMode = 'choice';
    if (typeof world.settings.showExactAges !== 'boolean') world.settings.showExactAges = false;
    world.settings.agePressure = false;
    if (!['visible', 'compressed'].includes(world.settings.defaultTravelMode)) world.settings.defaultTravelMode = 'compressed';
    world.settings.travelCompressionAllowed = true;
    world.settings.walkingObligation = false;
    world.settings.presenceCompressionAllowed = true;
    world.settings.compulsoryGreetings = false;
    world.settings.presenceWatchingReward = false;
    world.settings.presenceSurveillance = false;
    world.settings.minuteByMinutePresenceTax = false;
    world.settings.facadeMaintenanceObligation = false;
    world.settings.frontageDailyDecay = false;
    world.settings.exteriorOptimizationScore = false;
    AXM.Households?.ensureState(world);
    AXM.Habitats?.initializeWorld(world, { silent: true });
    AXM.Stewardship?.initializeWorld(world, { silent: true });
    AXM.Family?.initializeWorld(world, { silent: true });
    AXM.Community?.initializeWorld(world, { silent: true, migration: true });
    AXM.Directions?.initializeWorld(world, { silent: true, migration: true });
    AXM.Economy?.initializeWorld(world, { silent: true, migration: true });
    AXM.Exteriors?.initializeWorld(world, { silent: true, migration: true });
    AXM.Shells?.initializeWorld(world, { silent: true, migration: true });
    AXM.Presence?.initializeWorld(world, { silent: true, migration: true });
    AXM.Visuals?.ensureUiState(world);
    const activeHousehold = AXM.Households?.playerHousehold(world);
    if (activeHousehold?.homePropertyId && AXM.Households.isCohabiting(world, activeHousehold)) {
      AXM.Habitats?.syncHouseholdRoomPermissions(world, activeHousehold, activeHousehold.agreement?.space?.mode);
      AXM.Households?.rebalanceHouseholdObjects(world, activeHousehold, 'v0.3 room-graph migration');
    }
    Core.appendLedger(world, 'migration', `Save migrated explicitly from ${sourceSchema} to ${Core.SCHEMA}. ${fromV01 ? 'Legacy relationship states were preserved, but no household consent agreement was invented.' : 'Accepted household, structural, stewardship, family, community, and personal-direction state was preserved.'} No resident intention or permission was invented. Community institutions were added only as present-day infrastructure; no past membership, attendance, invitation, relationship, or adventure was fabricated. Personal-project containers were added empty where absent: no past project, chapter, collaboration, or achievement was fabricated. Commercial rooms and current local-need signals were added as present-day infrastructure only; no past enterprise, customer, sale, work session, income, equipment, lease, or success was fabricated. Exterior addresses and the current pedestrian network were derived from existing map positions; no past journey, encounter, lateness, or walking achievement was fabricated. Present-day building shells, storeys, wall graphs, openings, stairs, and interior/exterior continuity were derived from existing places without fabricating past construction or resident frontage work. Present-day presence snapshots were derived from current lawful locations only; no past arrival, room movement, greeting, refusal, or watching reward was fabricated. Existing life stages were retained while the default clock remains choice-first with no age pressure.`, {
      causes: ['explicit schema migration', 'no fabricated consent', 'object identity preservation', 'no fabricated project history', 'no fabricated enterprise history', 'choice-first life course', 'no fabricated building history', 'no fabricated presence history'],
      evidence: { sourceSchema, targetSchema: Core.SCHEMA, habitatSchema: AXM.Habitats?.HABITAT_SCHEMA || null, stewardshipSchema: AXM.Stewardship?.INTENTION_SCHEMA || null, familySchema: AXM.Family?.FAMILY_UNIT_SCHEMA || null, communitySchema: AXM.Community?.INSTITUTION_SCHEMA || null, projectSchema: AXM.Directions?.PROJECT_SCHEMA || null, enterpriseSchema: AXM.Economy?.ENTERPRISE_SCHEMA || null, exteriorSchema: AXM.Exteriors?.EXTERIOR_SCHEMA || null, travelSchema: AXM.Exteriors?.TRAVEL_SCHEMA || null, buildingShellSchema: AXM.Shells?.BUILDING_SCHEMA || null, frontageProposalSchema: AXM.Shells?.FRONTAGE_PROPOSAL_SCHEMA || null, presenceSchema: AXM.Presence?.PRESENCE_SCHEMA || null, indoorMovementSchema: AXM.Presence?.MOVEMENT_SCHEMA || null, encounterSchema: AXM.Presence?.ENCOUNTER_SCHEMA || null, lifeCourseMode: world.settings.lifeCourseMode }
    });
    return world;
  }

  function validateWorld(world) {
    const errors = [];
    const add = (message) => { if (errors.length < 250) errors.push(message); };
    const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    const finiteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
    const validGridPair = (value) => Array.isArray(value) && value.length === 2 && value.every((entry) => Number.isInteger(entry) && entry > 0);

    if (!isRecord(world)) return { ok: false, errors: ['World must be an object.'] };
    if (world.schema !== Core.SCHEMA) add('World schema mismatch.');
    if (!isRecord(world.time) || !Number.isInteger(world.time.day) || world.time.day < 1 || !Number.isInteger(world.time.hour) || world.time.hour < 0 || world.time.hour > 23 || !Number.isInteger(world.time.minute) || world.time.minute < 0 || world.time.minute > 59) {
      add('World time is malformed.');
    }
    if (!Number.isInteger(world.rngState) || world.rngState < 0) add('RNG state must be a non-negative integer.');
    if (!isRecord(world.player) || world.player.id !== 'player') add('Player record is missing or malformed.');
    if (!Array.isArray(world.people)) add('People must be an array.');
    if (!Array.isArray(world.places)) add('Places must be an array.');
    if (!Array.isArray(world.ledger)) add('Ledger must be an array.');
    if (!Array.isArray(world.people) || !Array.isArray(world.places) || !isRecord(world.player)) return { ok: false, errors };

    const personIds = new Set(['player']);
    const duplicatePersonIds = new Set();
    world.people.forEach((npc, index) => {
      if (!isRecord(npc) || typeof npc.id !== 'string' || !npc.id) {
        add(`Person at index ${index} has no valid id.`);
        return;
      }
      if (personIds.has(npc.id)) duplicatePersonIds.add(npc.id);
      personIds.add(npc.id);
      if (!Content.jobById(npc.jobId) && !AXM.Family?.isDependent(npc)) add(`${npc.name || npc.id} has an unknown job.`);
      if (!finiteNumber(npc.money)) add(`${npc.name || npc.id} has invalid money.`);
    });
    duplicatePersonIds.forEach((id) => add(`Duplicate person id: ${id}.`));

    const placeIds = new Set();
    const residential = [];
    world.places.forEach((place, index) => {
      if (!isRecord(place) || typeof place.id !== 'string' || !place.id) {
        add(`Place at index ${index} has no valid id.`);
        return;
      }
      if (placeIds.has(place.id)) add(`Duplicate place id: ${place.id}.`);
      placeIds.add(place.id);
      if (place.kind === 'residential') residential.push(place);
    });

    const seenResidents = new Map();
    const seenObjectIds = new Map();
    const validateObject = (object, locationLabel, property = null, expectedStoredOwner = null) => {
      if (!isRecord(object) || typeof object.id !== 'string' || !object.id) {
        add(`${locationLabel} contains an object without a valid id.`);
        return;
      }
      if (seenObjectIds.has(object.id)) add(`Object ${object.id} appears in both ${seenObjectIds.get(object.id)} and ${locationLabel}.`);
      else seenObjectIds.set(object.id, locationLabel);
      const definition = Content.furnitureById(object.catalogId);
      if (!definition) add(`${object.id} uses unknown furniture catalog id ${String(object.catalogId)}.`);
      if (!Content.PALETTE.some((entry) => entry.id === object.colorId)) add(`${object.id} uses unknown color ${String(object.colorId)}.`);
      if (!['personal', 'property_fixture'].includes(object.ownershipMode)) add(`${object.id} has invalid ownership mode ${String(object.ownershipMode)}.`);
      if (!finiteNumber(object.condition) || object.condition < 0 || object.condition > 100) add(`${object.id} has invalid condition.`);
      if (!finiteNumber(object.sentimental) || object.sentimental < 0 || object.sentimental > 100) add(`${object.id} has invalid sentimental value.`);
      if (!validGridPair(object.footprint)) add(`${object.id} has an invalid footprint.`);
      if (!isRecord(object.position) || !Number.isInteger(object.position.x) || !Number.isInteger(object.position.y)) add(`${object.id} has an invalid position.`);
      else if (!Number.isInteger(object.position.rotation) || ![0, 90, 180, 270].includes(object.position.rotation)) add(`${object.id} has an invalid rotation.`);
      if (!isRecord(object.upgrades)) add(`${object.id} has no upgrade record.`);
      else UPGRADE_AXES.forEach((axis) => {
        const level = object.upgrades[axis];
        if (!Number.isInteger(level) || level < 0 || level > 5) add(`${object.id} has invalid ${axis} level.`);
      });
      if (!Array.isArray(object.history)) add(`${object.id} history must be an array.`);

      if (expectedStoredOwner) {
        if (object.ownershipMode === 'property_fixture') add(`${object.id} is a property fixture inside personal storage.`);
        if (object.ownerId !== expectedStoredOwner) add(`${object.id} is stored by ${expectedStoredOwner} but owned by ${String(object.ownerId)}.`);
      } else if (property) {
        if (object.ownershipMode === 'property_fixture') {
          if (object.ownerId !== property.ownerId) add(`${object.id} fixture owner does not match ${property.name || property.id}.`);
        } else if (!personIds.has(object.ownerId)) {
          add(`${object.id} has unknown personal owner ${String(object.ownerId)}.`);
        }
        if (validGridPair(property.roomGrid) && validGridPair(object.footprint) && isRecord(object.position) && Number.isInteger(object.position.x) && Number.isInteger(object.position.y)) {
          const [gridW, gridH] = property.roomGrid;
          if (object.position.x < 0 || object.position.y < 0 || object.position.x + object.footprint[0] > gridW || object.position.y + object.footprint[1] > gridH) {
            add(`${object.id} is outside the room bounds of ${property.name || property.id}.`);
          }
        }
      }
    };

    residential.forEach((property) => {
      if (!Number.isInteger(property.capacity) || property.capacity < 1) add(`${property.name || property.id} has invalid capacity.`);
      if (!validGridPair(property.roomGrid)) add(`${property.name || property.id} has an invalid room grid.`);
      const tenants = Array.isArray(property.tenants) ? property.tenants : [];
      if (!Array.isArray(property.tenants)) add(`${property.name || property.id} tenants must be an array.`);
      if (tenants.length > property.capacity) add(`${property.name || property.id} exceeds capacity.`);
      tenants.forEach((id) => {
        if (!personIds.has(id)) add(`${property.name || property.id} contains unknown tenant ${String(id)}.`);
        if (seenResidents.has(id)) add(`${id} appears in both ${seenResidents.get(id)} and ${property.id}.`);
        else seenResidents.set(id, property.id);
      });
      const furniture = Array.isArray(property.furniture) ? property.furniture : [];
      if (!Array.isArray(property.furniture)) add(`${property.name || property.id} furniture must be an array.`);
      const occupiedCells = new Map();
      furniture.forEach((object) => {
        validateObject(object, property.id, property, null);
        if (!isRecord(object) || !validGridPair(object.footprint) || !isRecord(object.position) || !Number.isInteger(object.position.x) || !Number.isInteger(object.position.y)) return;
        World.footprintCells(object).forEach((cell) => {
          if (occupiedCells.has(cell)) add(`${property.name || property.id} has overlapping objects ${occupiedCells.get(cell)} and ${object.id}.`);
          else occupiedCells.set(cell, object.id);
        });
      });
      if (!finiteNumber(property.currentRent) || property.currentRent < 0) add(`${property.name || property.id} has invalid rent.`);
      if (!['per_tenant', 'whole_property'].includes(property.rentBasis)) add(`${property.name || property.id} has invalid rent basis.`);
      if (typeof property.utilitiesIncluded !== 'boolean') add(`${property.name || property.id} has invalid utilitiesIncluded flag.`);
      if (!finiteNumber(property.weeklyUtilityBase) || property.weeklyUtilityBase < 0) add(`${property.name || property.id} has invalid weekly utility base.`);
      if (!finiteNumber(property.condition) || property.condition < 0 || property.condition > 100) add(`${property.name || property.id} has invalid condition.`);
    });

    const playerHome = seenResidents.get('player');
    if (playerHome !== world.player.homePropertyId) add('Player home pointer does not match property occupancy.');
    world.people.forEach((npc) => {
      if (!npc || typeof npc.id !== 'string') return;
      if (seenResidents.get(npc.id) !== npc.homePropertyId) add(`${npc.name || npc.id} home pointer does not match property occupancy.`);
      const stored = npc.storedFurniture == null ? [] : npc.storedFurniture;
      if (!Array.isArray(stored)) add(`${npc.name || npc.id} stored furniture must be an array.`);
      else stored.forEach((object) => validateObject(object, `${npc.id}:storage`, null, npc.id));
    });
    const playerStored = world.player.storedFurniture == null ? [] : world.player.storedFurniture;
    if (!Array.isArray(playerStored)) add('Player stored furniture must be an array.');
    else playerStored.forEach((object) => validateObject(object, 'player:storage', null, 'player'));

    const ownedIds = Array.isArray(world.player.ownedPropertyIds) ? world.player.ownedPropertyIds : [];
    if (!Array.isArray(world.player.ownedPropertyIds)) add('Player ownedPropertyIds must be an array.');
    const ownedSet = new Set();
    ownedIds.forEach((id) => {
      if (ownedSet.has(id)) add(`Owned property id ${id} is duplicated.`);
      ownedSet.add(id);
      const property = residential.find((entry) => entry.id === id);
      if (!property || property.ownerId !== 'player') add(`Owned property pointer ${id} does not match property ownership.`);
    });
    residential.filter((property) => property.ownerId === 'player').forEach((property) => {
      if (!ownedSet.has(property.id)) add(`${property.name || property.id} is player-owned but missing from ownedPropertyIds.`);
    });

    if (!finiteNumber(world.player.money)) add('Player money is invalid.');
    if (!placeIds.has(world.player.homePropertyId)) add('Player home points to an unknown place.');
    if (world.activeShift && !Content.jobById(world.activeShift.jobId)) add('Active shift references an unknown job.');
    if (AXM.Households?.validate) AXM.Households.validate(world, add);
    if (AXM.Habitats?.validate) AXM.Habitats.validate(world, add);
    if (AXM.Stewardship?.validate) AXM.Stewardship.validate(world, add);
    if (AXM.Family?.validate) AXM.Family.validate(world, add);
    if (AXM.Community?.validate) AXM.Community.validate(world, add);
    if (AXM.Directions?.validate) AXM.Directions.validate(world, add);
    if (AXM.Economy?.validate) AXM.Economy.validate(world, add);
    if (AXM.Exteriors?.validate) AXM.Exteriors.validate(world, add);
    if (AXM.Shells?.validate) AXM.Shells.validate(world, add);
    if (AXM.Presence?.validate) AXM.Presence.validate(world, add);
    return { ok: errors.length === 0, errors };
  }

  function runObserverDays(world, days) {
    const count = Core.clamp(Math.floor(days), 1, 365);
    const before = computeMetrics(world);
    const beforePropertySignatures = captureResidentialDecorSignatures(world);
    Core.appendLedger(world, 'research', `Observer mode began for ${count} autonomous days. Player needs and rent were frozen so this remains a simulation experiment, not a hidden punishment.`, {
      causes: ['explicit observer command'], evidence: { days: count }
    });
    advanceHours(world, count * 24, { freezePlayer: true });
    const after = computeMetrics(world);
    const afterPropertySignatures = captureResidentialDecorSignatures(world);
    const changedProperties = Object.values(afterPropertySignatures)
      .filter((entry) => beforePropertySignatures[entry.id]?.signature !== entry.signature)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        beforeSignature: beforePropertySignatures[entry.id]?.signature || null,
        afterSignature: entry.signature
      }));
    const changedPropertyIds = changedProperties.map((entry) => entry.id);
    const changedPropertyCount = changedProperties.length;
    const validation = validateWorld(world);
    Core.appendLedger(world, 'research', `Observer mode completed ${count} days with ${validation.errors.length} invariant errors; ${changedPropertyCount} homes changed visible state.`, {
      causes: ['deterministic batch simulation'],
      evidence: { before, after, changedPropertyCount, changedPropertyIds, validation }
    });
    toast(world, `${count} autonomous days simulated; ${changedPropertyCount} homes changed; ${validation.errors.length} invariant errors.`, validation.ok ? 'success' : 'warning');
    return { before, after, changedPropertyCount, changedPropertyIds, changedProperties, validation };
  }

  function developerGrant(world) {
    if (world.flags.developerGrantUsed) return { ok: false, reason: 'The prototype grant was already used in this save.' };
    world.flags.developerGrantUsed = true;
    world.player.money += 260000;
    Object.keys(world.player.materials).forEach((key) => { world.player.materials[key] += 30; });
    Core.appendLedger(world, 'research', 'A clearly labeled prototype grant was added for testing ownership and max-upgrade systems. It is not part of normal progression.', {
      actorIds: ['player'], causes: ['explicit developer tool'], evidence: { money: 260000, materialsEach: 30 }
    });
    toast(world, 'Prototype grant added for system testing.', 'warning');
    return { ok: true };
  }

  function renamePlayer(world, name) {
    const clean = String(name || '').trim().slice(0, 30);
    if (!clean) return { ok: false, reason: 'Name cannot be empty.' };
    const old = world.player.name;
    world.player.name = clean;
    world.places.filter((place) => place.ownerId === 'player').forEach((property) => { property.ownerLabel = clean; });
    Core.appendLedger(world, 'player', `${old} is now recorded as ${clean}.`, {
      actorIds: ['player'], causes: ['explicit player rename']
    });
    toast(world, `Player renamed to ${clean}.`, 'success');
    return { ok: true };
  }

  AXM.Systems = {
    NEED_KEYS,
    UPGRADE_AXES,
    toast,
    clampNeeds,
    applyNeedEffects,
    applySkillEffects,
    currentJob,
    propertyResidents,
    npcMonthlyIncome,
    playerMonthlyIncome,
    getRelation,
    compatibility,
    playerNpcCompatibility,
    updateTutorial,
    inspectPlace,
    updateNpcSchedules,
    simulateHour,
    advanceHours,
    advanceMinutes,
    performActivity,
    startInteractiveShift,
    performWorkTask,
    finishInteractiveShift,
    skipShift,
    applyForJob,
    buyMaterial,
    buyFurniture,
    moveFurniture,
    rotateFurniture,
    recolorFurniture,
    upgradeFurniture,
    repairFurniture,
    storeFurniture,
    placeStoredFurniture,
    interactWithNpc,
    rentProperty,
    buyProperty,
    setOwnedRent,
    moveIntoOwnedProperty,
    startPlayerTravel,
    stepPlayerTravel,
    finishPlayerTravelCompressed,
    endPlayerTravelEarly,
    prepareWalkableExperiment,
    housingScore,
    transferPersonalFurniture,
    moveNpc,
    migrateWorld,
    computeDecorSignature,
    computeMetrics,
    validateWorld,
    runObserverDays,
    developerGrant,
    renamePlayer,
    objectOwnedByPlayer
  };
}(typeof window !== 'undefined' ? window : globalThis));
