(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Systems = AXM.Systems;

  if (!Core || !Content || !World || !Systems) {
    throw new Error('Living City housing pressure requires Core, Content, World and Systems.');
  }
  if (AXM.HousingPressure) return;

  const SCHEMA = 'axm.living-city.housing-pressure/v0.12.0-draft';
  const FREE_PERSONAL_OBJECTS = 6;
  const MONTHLY_CAP_RATIO = 0.25;
  const MINIMUM_CAP = 18;
  const activeDepth = new WeakMap();

  function playerPersonalObjects(world) {
    const home = World.homeOf(world, 'player');
    if (!home) return [];
    return (home.furniture || [])
      .filter((object) => object.ownerId === 'player' && object.ownershipMode !== 'property_fixture')
      .slice()
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  function objectMonthlyPressure(object) {
    const definition = Content.furnitureById(object?.catalogId);
    if (!definition) return 0;
    const area = Math.max(1, Number(object.footprint?.[0] || definition.footprint?.[0] || 1) * Number(object.footprint?.[1] || definition.footprint?.[1] || 1));
    const price = Math.max(0, Number(definition.price) || 0);
    return Core.round(2.25 + Math.max(0, area - 1) * 0.75 + Math.min(6, price * 0.006), 2);
  }

  function summary(world) {
    const home = World.homeOf(world, 'player');
    if (!home) {
      return {
        schema: SCHEMA,
        homeId: null,
        ownerOccupied: false,
        personalPlacedObjects: 0,
        freeObjectAllowance: FREE_PERSONAL_OBJECTS,
        chargeableObjects: 0,
        monthlySurcharge: 0,
        weeklySurcharge: 0,
        capMonthly: 0,
        noPassiveDecay: true
      };
    }

    const objects = playerPersonalObjects(world);
    const chargeable = objects.slice(FREE_PERSONAL_OBJECTS);
    const ownerOccupied = home.ownerId === 'player';
    const baseRent = Math.max(0, Number(home.currentRent) || Number(home.rent) || 0);
    const capMonthly = Core.round(Math.max(MINIMUM_CAP, baseRent * MONTHLY_CAP_RATIO), 2);
    const rawMonthly = chargeable.reduce((sum, object) => sum + objectMonthlyPressure(object), 0);
    const monthlySurcharge = ownerOccupied ? 0 : Core.round(Math.min(rawMonthly, capMonthly), 2);

    return {
      schema: SCHEMA,
      homeId: home.id,
      ownerOccupied,
      personalPlacedObjects: objects.length,
      freeObjectAllowance: FREE_PERSONAL_OBJECTS,
      chargeableObjects: Math.max(0, objects.length - FREE_PERSONAL_OBJECTS),
      monthlySurcharge,
      weeklySurcharge: Core.round(monthlySurcharge / 4.2, 2),
      capMonthly,
      noPassiveDecay: true,
      roommateObjectsExcluded: true,
      propertyFixturesExcluded: true,
      storedObjectsExcluded: true
    };
  }

  function snapshotResidentialConditions(world) {
    const out = new Map();
    (world.places || []).filter((place) => place.kind === 'residential').forEach((property) => {
      (property.furniture || []).forEach((object) => {
        out.set(object.id, Number(object.condition) || 0);
      });
    });
    return out;
  }

  function preventPassiveConditionLoss(world, before) {
    if (!before) return;
    (world.places || []).filter((place) => place.kind === 'residential').forEach((property) => {
      (property.furniture || []).forEach((object) => {
        if (!before.has(object.id)) return;
        const earlier = before.get(object.id);
        if ((Number(object.condition) || 0) < earlier) object.condition = earlier;
      });
    });
  }

  function weekIndex(day) {
    return Math.floor((Math.max(1, Number(day) || 1) - 1) / 7);
  }

  function chargeOneWeek(world, cycleIndex) {
    const pressure = summary(world);
    const due = pressure.weeklySurcharge;
    if (due <= 0) return { due: 0, paid: 0, shortfall: 0, pressure };

    const player = world.player;
    const paid = Math.min(Math.max(0, Number(player.money) || 0), due);
    const shortfall = Core.round(Math.max(0, due - paid), 2);
    player.money = Core.round(player.money - paid, 2);
    player.lifetimeSpend = Core.round((Number(player.lifetimeSpend) || 0) + paid, 2);
    if (shortfall > 0) player.rentArrears = Core.round((Number(player.rentArrears) || 0) + shortfall, 2);

    Core.appendLedger(world, 'housing', `Your extra belongings added ${Core.formatMoney(due)} to this week's rent pressure; ${Core.formatMoney(paid)} was paid${shortfall > 0 ? ` and ${Core.formatMoney(shortfall)} remains visible as rent arrears` : ''}.`, {
      actorIds: ['player'],
      placeId: pressure.homeId,
      causes: ['placed personal belongings above the starter allowance', 'weekly furnishing rent pressure'],
      evidence: {
        schema: SCHEMA,
        cycleIndex,
        monthlySurcharge: pressure.monthlySurcharge,
        weeklySurcharge: due,
        personalPlacedObjects: pressure.personalPlacedObjects,
        chargeableObjects: pressure.chargeableObjects,
        paid,
        shortfall,
        noLateFee: true
      }
    });

    return { due, paid, shortfall, pressure };
  }

  function settleCrossedWeeks(world, beforeDay, afterDay, options = {}) {
    if (options.freezePlayer) return [];
    const start = weekIndex(beforeDay);
    const end = weekIndex(afterDay);
    const receipts = [];
    for (let cycle = start + 1; cycle <= end; cycle += 1) receipts.push(chargeOneWeek(world, cycle));
    return receipts;
  }

  function pressureMutationReceipt(before, after) {
    return {
      schema: SCHEMA,
      beforeMonthly: before.monthlySurcharge,
      afterMonthly: after.monthlySurcharge,
      deltaMonthly: Core.round(after.monthlySurcharge - before.monthlySurcharge, 2),
      chargeableObjects: after.chargeableObjects,
      freeObjectAllowance: FREE_PERSONAL_OBJECTS,
      noPassiveDecay: true
    };
  }

  function wrapPressureMutation(name) {
    const original = Systems[name];
    if (typeof original !== 'function') return;
    Systems[name] = function wrappedHousingPressureMutation(world, ...args) {
      const before = summary(world);
      const result = original.call(Systems, world, ...args);
      const after = summary(world);
      if (result && typeof result === 'object' && result.ok !== false) {
        result.housingPressure = pressureMutationReceipt(before, after);
        const delta = result.housingPressure.deltaMonthly;
        if (Math.abs(delta) >= 0.01) {
          const direction = delta > 0 ? 'increased' : 'decreased';
          Core.appendLedger(world, 'housing', `Your placed belongings ${direction} projected furnishing rent pressure by ${Core.formatMoney(Math.abs(delta))} per month.`, {
            actorIds: ['player'], placeId: after.homeId,
            causes: [`${name} changed placed personal belongings`],
            evidence: result.housingPressure
          });
          Systems.toast(world, `Projected furnishing rent pressure: ${Core.formatMoney(after.monthlySurcharge)}/month.`, delta > 0 ? 'warning' : 'info');
        }
      }
      return result;
    };
  }

  function freezeRequested(name, args) {
    if (name === 'simulateHour') return args[0]?.freezePlayer === true;
    if (name === 'advanceHours' || name === 'advanceMinutes') return args[1]?.freezePlayer === true;
    return false;
  }

  function wrapTimeMethod(name, settleRent = true) {
    const original = Systems[name];
    if (typeof original !== 'function') return;
    Systems[name] = function wrappedHousingPressureTime(world, ...args) {
      const depth = activeDepth.get(world) || 0;
      if (depth > 0) return original.call(Systems, world, ...args);
      activeDepth.set(world, depth + 1);
      const beforeDay = Number(world.time?.day) || 1;
      const conditions = snapshotResidentialConditions(world);
      try {
        const result = original.call(Systems, world, ...args);
        preventPassiveConditionLoss(world, conditions);
        if (settleRent && !freezeRequested(name, args)) {
          const afterDay = Number(world.time?.day) || beforeDay;
          const receipts = settleCrossedWeeks(world, beforeDay, afterDay);
          if (result && typeof result === 'object' && !Array.isArray(result) && result !== world && receipts.length) {
            result.furnishingRentReceipts = receipts;
          }
        }
        return result;
      } finally {
        activeDepth.delete(world);
      }
    };
  }

  ['buyFurniture', 'storeFurniture', 'placeStoredFurniture'].forEach(wrapPressureMutation);

  [
    'simulateHour',
    'advanceHours',
    'advanceMinutes',
    'performActivity',
    'startInteractiveShift',
    'performWorkTask',
    'skipShift',
    'interactWithNpc',
    'startPlayerTravel',
    'stepPlayerTravel',
    'finishPlayerTravelCompressed',
    'endPlayerTravelEarly'
  ].forEach((name) => wrapTimeMethod(name, true));
  wrapTimeMethod('runObserverDays', false);

  if (typeof Systems.computeMetrics === 'function') {
    const originalComputeMetrics = Systems.computeMetrics;
    Systems.computeMetrics = function computeMetricsWithHousingPressure(world, ...args) {
      return { ...originalComputeMetrics.call(Systems, world, ...args), housingPressure: summary(world) };
    };
  }

  AXM.HousingPressure = Object.freeze({
    SCHEMA,
    FREE_PERSONAL_OBJECTS,
    MONTHLY_CAP_RATIO,
    objectMonthlyPressure,
    playerPersonalObjects,
    summary,
    chargeOneWeek,
    settleCrossedWeeks,
    noPassiveDecay: true
  });
}(typeof window !== 'undefined' ? window : globalThis));
