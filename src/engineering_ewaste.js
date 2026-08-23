(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const World = AXM.World;
  const Systems = AXM.Systems;
  const HistoricalEra = AXM.HistoricalEra;
  const ItemInteractions = AXM.ItemInteractions;

  if (!Core || !World || !Systems || !HistoricalEra || !ItemInteractions) {
    throw new Error('Living City engineering/e-waste requires Core, World, Systems, HistoricalEra and ItemInteractions.');
  }
  if (AXM.EngineeringEwaste) return;

  const SCHEMA = 'axm.living-city.engineering-ewaste/v0.12.0-draft';
  const MAX_LOTS = 6;
  const COMPONENT_KEYS = Object.freeze(['wire', 'motor', 'board', 'sensor', 'cell', 'optics', 'casing']);

  const SOURCE_TEMPLATES = Object.freeze([
    Object.freeze({ id: 'cassette_player_scrap', name: 'Discarded cassette player', introducedYear: 1980, refurbishCost: 2, resaleBase: 12, components: { wire: 2, motor: 1, casing: 1 } }),
    Object.freeze({ id: 'toy_motor_scrap', name: 'Broken motorized toy', introducedYear: 1980, refurbishCost: 2, resaleBase: 10, components: { wire: 1, motor: 2, casing: 1 } }),
    Object.freeze({ id: 'crt_television_scrap', name: 'Old CRT television', introducedYear: 1985, refurbishCost: 5, resaleBase: 26, components: { wire: 2, board: 1, casing: 1 } }),
    Object.freeze({ id: 'game_console_scrap', name: 'Discarded game console', introducedYear: 1995, refurbishCost: 4, resaleBase: 31, components: { wire: 1, board: 2, casing: 1 } }),
    Object.freeze({ id: 'desktop_pc_scrap', name: 'Retired desktop computer', introducedYear: 2000, refurbishCost: 6, resaleBase: 44, components: { wire: 2, board: 2, motor: 1, casing: 1 } }),
    Object.freeze({ id: 'router_scrap', name: 'Discarded network box', introducedYear: 2005, refurbishCost: 3, resaleBase: 22, components: { wire: 1, board: 1, casing: 1 } }),
    Object.freeze({ id: 'laptop_scrap', name: 'Retired laptop', introducedYear: 2005, refurbishCost: 7, resaleBase: 56, components: { wire: 1, board: 2, cell: 1, casing: 1 } }),
    Object.freeze({ id: 'mobile_phone_scrap', name: 'Discarded mobile phone', introducedYear: 2010, refurbishCost: 5, resaleBase: 38, components: { board: 1, sensor: 1, cell: 1, casing: 1 } }),
    Object.freeze({ id: 'camera_scrap', name: 'Broken compact camera', introducedYear: 2010, refurbishCost: 5, resaleBase: 36, components: { board: 1, sensor: 1, optics: 1, casing: 1 } })
  ]);

  const BLUEPRINTS = Object.freeze([
    Object.freeze({
      id: 'bench_blinker', name: 'Bench Blinker', introducedYear: 1985, kind: 'electronics', hours: 2, minimumEngineering: 0,
      components: { wire: 2, board: 1, casing: 1 },
      description: 'A tiny visible-light electronics project built from reclaimed parts. It proves the bench and salvaged components can become something new.'
    }),
    Object.freeze({
      id: 'motor_bug', name: 'Motor Bug', introducedYear: 2000, kind: 'kinetic_prototype', hours: 3, minimumEngineering: 1,
      components: { wire: 2, motor: 1, board: 1, casing: 1 },
      description: 'A small motorized desk creature. It can jitter and move when explicitly activated, but has no autonomy or schedule.'
    }),
    Object.freeze({
      id: 'mini_scrap_crawler', name: 'Mini Scrap Crawler', introducedYear: 2015, kind: 'miniature_robotica', hours: 4, minimumEngineering: 3,
      components: { wire: 2, motor: 2, board: 1, sensor: 1, casing: 1 },
      description: 'The first miniature-robotica seed: a palm-sized crawler made from reclaimed motors, board, sensor and casing. It is a built object, not an autonomous resident.'
    })
  ]);

  function emptyComponents() {
    return Object.fromEntries(COMPONENT_KEYS.map((key) => [key, 0]));
  }

  function freshState() {
    return {
      schema: SCHEMA,
      sequence: 0,
      lots: [],
      components: emptyComponents(),
      refurbished: [],
      prototypes: [],
      history: []
    };
  }

  function ensureState(world) {
    if (!world.engineeringEwaste || world.engineeringEwaste.schema !== SCHEMA) {
      const previous = world.engineeringEwaste;
      world.engineeringEwaste = freshState();
      if (previous && typeof previous === 'object') {
        world.engineeringEwaste.history.push({
          type: 'legacy_state_preserved_elsewhere',
          note: 'An unrecognized engineering state was not silently interpreted as current data.'
        });
      }
    }
    COMPONENT_KEYS.forEach((key) => {
      if (!Number.isFinite(world.engineeringEwaste.components[key])) world.engineeringEwaste.components[key] = 0;
    });
    return world.engineeringEwaste;
  }

  function peekState(world) {
    const state = world.engineeringEwaste;
    if (state && state.schema === SCHEMA) return state;
    return freshState();
  }

  function addSkill(world, key, amount) {
    const before = Core.safeNumber(world.player.skills[key], 0);
    world.player.skills[key] = Core.clamp(Core.round(before + amount, 2), 0, 100);
  }

  function engineeringLevel(world) {
    return Core.safeNumber(world.player.skills.engineering, 0);
  }

  function sourcePool(world) {
    const year = HistoricalEra.currentYear(world);
    return SOURCE_TEMPLATES.filter((template) => year >= template.introducedYear);
  }

  function sourceById(sourceId) {
    return SOURCE_TEMPLATES.find((template) => template.id === sourceId) || null;
  }

  function blueprintById(blueprintId) {
    return BLUEPRINTS.find((blueprint) => blueprint.id === blueprintId) || null;
  }

  function deterministicIndex(world, state, label, length) {
    if (!length) return -1;
    const hash = Core.hashString(`${world.seed}|engineering-ewaste|${HistoricalEra.currentYear(world)}|${state.sequence}|${label}`);
    return hash % length;
  }

  function deterministicCondition(world, state, sourceId) {
    const hash = Core.hashString(`${world.seed}|engineering-condition|${state.sequence}|${sourceId}|${world.time.day}`);
    return 35 + (hash % 46);
  }

  function findLot(state, lotId) {
    return state.lots.find((lot) => lot.id === lotId) || null;
  }

  function benchStatus(world) {
    const home = World.homeOf(world, 'player');
    const homeBench = (home?.furniture || []).find((object) => (
      ItemInteractions.objectMatchesAction(object, 'repair_at_bench') && ItemInteractions.directUseAllowed(object)
    )) || null;
    if (homeBench) return { ok: true, mode: 'home_bench', placeId: home.id, objectId: homeBench.id };
    if (world.player.locationId === 'place_workshop') return { ok: true, mode: 'public_workshop', placeId: 'place_workshop', objectId: null };
    return { ok: false, mode: null, placeId: null, objectId: null, reason: 'Engineering salvage needs your usable home workbench or your physical presence at the public repair workshop.' };
  }

  function advance(world, hours) {
    Systems.advanceHours(world, hours);
  }

  function collectEwaste(world) {
    const state = ensureState(world);
    if (state.lots.length >= MAX_LOTS) return { ok: false, reason: `Your salvage queue already holds ${MAX_LOTS} lots. Inspect, refurbish or dismantle something first.` };
    const pool = sourcePool(world);
    if (!pool.length) return { ok: false, reason: 'No era-appropriate electronic salvage is available.' };

    const source = pool[deterministicIndex(world, state, 'collect', pool.length)];
    const year = HistoricalEra.currentYear(world);
    const lot = {
      id: Core.uniqueId(world, 'ewaste'),
      sourceId: source.id,
      name: source.name,
      foundYear: year,
      condition: deterministicCondition(world, state, source.id),
      inspected: false,
      estimatedResaleValue: null,
      expectedComponents: null,
      provenance: [`found as discarded electronics in ${year}`, `source class: ${source.id}`]
    };
    state.sequence += 1;
    state.lots.push(lot);
    advance(world, 1);
    addSkill(world, 'focus', 0.1);
    Core.appendLedger(world, 'engineering', `You collected ${source.name} as an e-waste lot instead of turning it into instant money or parts.`, {
      actorIds: ['player'], placeId: world.player.locationId,
      causes: ['explicit e-waste collection choice'],
      evidence: { schema: SCHEMA, lotId: lot.id, sourceId: source.id, foundYear: year, noPassiveGeneration: true }
    });
    return { ok: true, lot: Core.deepClone(lot), hours: 1 };
  }

  function inspectEwaste(world, lotId) {
    const state = ensureState(world);
    const lot = findLot(state, lotId);
    if (!lot) return { ok: false, reason: 'That e-waste lot is not in your current salvage queue.' };
    if (lot.inspected) return { ok: false, reason: 'That lot is already inspected.' };
    const source = sourceById(lot.sourceId);
    if (!source) return { ok: false, reason: 'The source class for that lot is unknown; it is preserved rather than guessed.' };

    advance(world, 1);
    lot.inspected = true;
    lot.expectedComponents = { ...source.components };
    const conditionFactor = 0.55 + lot.condition / 200;
    lot.estimatedResaleValue = Core.round(source.resaleBase * conditionFactor, 2);
    addSkill(world, 'focus', 0.25);
    addSkill(world, 'repair', 0.2);
    addSkill(world, 'engineering', 0.2);
    Core.appendLedger(world, 'engineering', `You inspected ${lot.name}; its salvage components and refurbishment value are now visible.`, {
      actorIds: ['player'], placeId: world.player.locationId,
      causes: ['explicit inspection'],
      evidence: { schema: SCHEMA, lotId: lot.id, expectedComponents: lot.expectedComponents, estimatedResaleValue: lot.estimatedResaleValue }
    });
    return { ok: true, lot: Core.deepClone(lot), hours: 1 };
  }

  function addComponents(state, components) {
    Object.entries(components || {}).forEach(([key, amount]) => {
      if (!COMPONENT_KEYS.includes(key)) return;
      state.components[key] = Math.max(0, Math.floor(Core.safeNumber(state.components[key], 0) + Core.safeNumber(amount, 0)));
    });
  }

  function removeLot(state, lotId) {
    const index = state.lots.findIndex((lot) => lot.id === lotId);
    if (index < 0) return null;
    return state.lots.splice(index, 1)[0];
  }

  function salvageEwaste(world, lotId) {
    const state = ensureState(world);
    const lot = findLot(state, lotId);
    if (!lot) return { ok: false, reason: 'That e-waste lot is not in your current salvage queue.' };
    if (!lot.inspected) return { ok: false, reason: 'Inspect the lot first so dismantling is an informed choice.' };
    const bench = benchStatus(world);
    if (!bench.ok) return { ok: false, reason: bench.reason };
    const source = sourceById(lot.sourceId);
    if (!source) return { ok: false, reason: 'Unknown source class; nothing is dismantled by guesswork.' };

    advance(world, 2);
    removeLot(state, lotId);
    addComponents(state, source.components);
    addSkill(world, 'repair', 0.7);
    addSkill(world, 'focus', 0.2);
    addSkill(world, 'engineering', 0.6);
    const receipt = {
      schema: SCHEMA,
      lotId,
      sourceId: source.id,
      components: { ...source.components },
      bench,
      destructiveChoice: true,
      reversibleBeforeAction: true
    };
    state.history.push({ type: 'salvaged', day: world.time.day, receipt: Core.deepClone(receipt) });
    Core.appendLedger(world, 'engineering', `You dismantled ${lot.name} and kept its reusable components.`, {
      actorIds: ['player'], placeId: bench.placeId,
      causes: ['explicit salvage choice'], evidence: receipt
    });
    return { ok: true, receipt, components: { ...source.components }, hours: 2 };
  }

  function refurbishEwaste(world, lotId) {
    const state = ensureState(world);
    const lot = findLot(state, lotId);
    if (!lot) return { ok: false, reason: 'That e-waste lot is not in your current salvage queue.' };
    if (!lot.inspected) return { ok: false, reason: 'Inspect the lot before deciding to refurbish it.' };
    const bench = benchStatus(world);
    if (!bench.ok) return { ok: false, reason: bench.reason };
    const source = sourceById(lot.sourceId);
    if (!source) return { ok: false, reason: 'Unknown source class; it is preserved rather than repaired by guesswork.' };
    if (world.player.money < source.refurbishCost) return { ok: false, reason: `Refurbishment needs ${Core.formatMoney(source.refurbishCost)} for small replacement consumables.` };

    world.player.money = Core.round(world.player.money - source.refurbishCost, 2);
    world.player.lifetimeSpend = Core.round((Number(world.player.lifetimeSpend) || 0) + source.refurbishCost, 2);
    advance(world, 3);
    removeLot(state, lotId);
    const skillFactor = 1 + Math.min(0.45, (Core.safeNumber(world.player.skills.repair, 0) + engineeringLevel(world)) / 220);
    const conditionFactor = 0.72 + lot.condition / 250;
    const saleValue = Core.round(Math.max(source.refurbishCost + 2, source.resaleBase * skillFactor * conditionFactor), 2);
    const stock = {
      id: Core.uniqueId(world, 'refurbished'),
      sourceLotId: lot.id,
      sourceId: source.id,
      name: `Refurbished ${source.name.replace(/^Discarded |^Broken |^Old |^Retired /, '')}`,
      refurbishedYear: HistoricalEra.currentYear(world),
      saleValue,
      provenance: lot.provenance.concat([`refurbished by player in ${HistoricalEra.currentYear(world)}`])
    };
    state.refurbished.push(stock);
    addSkill(world, 'repair', 0.9);
    addSkill(world, 'engineering', 0.8);
    addSkill(world, 'focus', 0.2);
    Core.appendLedger(world, 'engineering', `You refurbished ${lot.name} into a sellable second-life item worth about ${Core.formatMoney(saleValue)}.`, {
      actorIds: ['player'], placeId: bench.placeId,
      causes: ['explicit refurbishment choice'],
      evidence: { schema: SCHEMA, lotId: lot.id, stockId: stock.id, cost: source.refurbishCost, saleValue, bench }
    });
    return { ok: true, stock: Core.deepClone(stock), cost: source.refurbishCost, hours: 3 };
  }

  function sellRefurbished(world, stockId) {
    const state = ensureState(world);
    const index = state.refurbished.findIndex((item) => item.id === stockId);
    if (index < 0) return { ok: false, reason: 'That refurbished item is not in your sellable stock.' };
    const stock = state.refurbished[index];
    advance(world, 1);
    state.refurbished.splice(index, 1);
    world.player.money = Core.round(world.player.money + stock.saleValue, 2);
    world.player.lifetimeEarnings = Core.round((Number(world.player.lifetimeEarnings) || 0) + stock.saleValue, 2);
    addSkill(world, 'social', 0.15);
    Core.appendLedger(world, 'engineering', `${stock.name} found a new owner for ${Core.formatMoney(stock.saleValue)}.`, {
      actorIds: ['player'], placeId: world.player.locationId,
      causes: ['explicit local resale'],
      evidence: { schema: SCHEMA, stockId: stock.id, saleValue: stock.saleValue, sideIncome: true, provenancePreserved: true }
    });
    return { ok: true, amount: stock.saleValue, stock: Core.deepClone(stock), hours: 1 };
  }

  function blueprintAvailability(world, blueprintId) {
    const blueprint = blueprintById(blueprintId);
    if (!blueprint) return { ok: false, reason: 'Unknown engineering blueprint.', blueprintId };
    const year = HistoricalEra.currentYear(world);
    const level = engineeringLevel(world);
    if (year < blueprint.introducedYear) {
      return { ok: false, reason: `${blueprint.name} belongs to ${blueprint.introducedYear} or later in this timeline.`, blueprintId, introducedYear: blueprint.introducedYear, currentYear: year, engineering: level };
    }
    if (level < blueprint.minimumEngineering) {
      return { ok: false, reason: `${blueprint.name} needs engineering ${blueprint.minimumEngineering}; current engineering is ${Core.round(level, 1)}.`, blueprintId, introducedYear: blueprint.introducedYear, currentYear: year, engineering: level };
    }
    return { ok: true, reason: null, blueprintId, introducedYear: blueprint.introducedYear, currentYear: year, engineering: level };
  }

  function missingComponents(state, requirements) {
    const missing = {};
    Object.entries(requirements || {}).forEach(([key, amount]) => {
      const deficit = Math.max(0, amount - Core.safeNumber(state.components[key], 0));
      if (deficit > 0) missing[key] = deficit;
    });
    return missing;
  }

  function buildPrototype(world, blueprintId) {
    const state = ensureState(world);
    const blueprint = blueprintById(blueprintId);
    const availability = blueprintAvailability(world, blueprintId);
    if (!availability.ok) return { ok: false, reason: availability.reason, availability };
    const bench = benchStatus(world);
    if (!bench.ok) return { ok: false, reason: bench.reason };
    const missing = missingComponents(state, blueprint.components);
    if (Object.keys(missing).length) return { ok: false, reason: `Missing reclaimed components: ${Object.entries(missing).map(([key, amount]) => `${key} x${amount}`).join(', ')}.`, missing };

    Object.entries(blueprint.components).forEach(([key, amount]) => {
      state.components[key] -= amount;
    });
    advance(world, blueprint.hours);
    const prototype = {
      id: Core.uniqueId(world, 'prototype'),
      blueprintId: blueprint.id,
      name: blueprint.name,
      kind: blueprint.kind,
      builtYear: HistoricalEra.currentYear(world),
      autonomous: false,
      scheduleAuthority: false,
      consumedComponents: { ...blueprint.components },
      provenance: [`built by player from reclaimed e-waste components in ${HistoricalEra.currentYear(world)}`],
      description: blueprint.description
    };
    state.prototypes.push(prototype);
    addSkill(world, 'engineering', blueprint.kind === 'miniature_robotica' ? 1.4 : 1.0);
    addSkill(world, 'repair', 0.45);
    addSkill(world, 'creativity', 0.5);
    Core.appendLedger(world, 'engineering', `You built ${blueprint.name} from reclaimed electronics.`, {
      actorIds: ['player'], placeId: bench.placeId,
      causes: ['explicit engineering build'],
      evidence: { schema: SCHEMA, prototypeId: prototype.id, blueprintId: blueprint.id, kind: blueprint.kind, components: prototype.consumedComponents, autonomous: false, scheduleAuthority: false }
    });
    return { ok: true, prototype: Core.deepClone(prototype), hours: blueprint.hours };
  }

  function availableBlueprints(world) {
    return BLUEPRINTS.map((blueprint) => ({ ...blueprint, availability: blueprintAvailability(world, blueprint.id) }));
  }

  function summary(world) {
    const state = peekState(world);
    return {
      schema: SCHEMA,
      currentYear: HistoricalEra.currentYear(world),
      engineering: engineeringLevel(world),
      queuedLots: state.lots.length,
      maxLots: MAX_LOTS,
      refurbishedStock: state.refurbished.length,
      prototypes: state.prototypes.length,
      miniatureRobotica: state.prototypes.filter((entry) => entry.kind === 'miniature_robotica').length,
      components: { ...state.components },
      availableSourceTypes: sourcePool(world).map((entry) => entry.id),
      availableBlueprints: availableBlueprints(world).filter((entry) => entry.availability.ok).map((entry) => entry.id),
      noPassiveEwasteGeneration: true,
      noMaintenanceObligation: true,
      robotAutonomyEnabled: false,
      existingWorldStateIsNotRewrittenByInspection: true
    };
  }

  const originalCreateWorld = World.createWorld;
  World.createWorld = function createWorldWithEngineering(...args) {
    const world = originalCreateWorld.apply(World, args);
    ensureState(world);
    return world;
  };

  if (typeof Systems.computeMetrics === 'function') {
    const originalComputeMetrics = Systems.computeMetrics;
    Systems.computeMetrics = function computeMetricsWithEngineering(world, ...args) {
      return { ...originalComputeMetrics.call(Systems, world, ...args), engineeringEwaste: summary(world) };
    };
  }

  AXM.EngineeringEwaste = Object.freeze({
    SCHEMA,
    MAX_LOTS,
    COMPONENT_KEYS,
    SOURCE_TEMPLATES,
    BLUEPRINTS,
    ensureState,
    peekState,
    engineeringLevel,
    sourcePool,
    sourceById,
    blueprintById,
    blueprintAvailability,
    availableBlueprints,
    benchStatus,
    collectEwaste,
    inspectEwaste,
    salvageEwaste,
    refurbishEwaste,
    sellRefurbished,
    buildPrototype,
    summary
  });
}(typeof window !== 'undefined' ? window : globalThis));
