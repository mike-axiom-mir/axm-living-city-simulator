(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};

  const VERSION = '0.11.3';
  const SCHEMA = 'axm.living-city-sim.world/v0.11.0';
  const LEGACY_SCHEMAS = ['axm.living-city-sim.world/v0.10.0', 'axm.living-city-sim.world/v0.9.0', 'axm.living-city-sim.world/v0.8.0', 'axm.living-city-sim.world/v0.7.0', 'axm.living-city-sim.world/v0.6.0', 'axm.living-city-sim.world/v0.5.0', 'axm.living-city-sim.world/v0.4.0', 'axm.living-city-sim.world/v0.3.0', 'axm.living-city-sim.world/v0.2.0', 'axm.living-city-sim.world/v0.1.0'];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, digits = 0) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function hashString(text) {
    let hash = 2166136261 >>> 0;
    const value = String(text || 'AXM-LIVING-CITY');
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function nextRandom(world) {
    world.rngState = (Math.imul(1664525, world.rngState >>> 0) + 1013904223) >>> 0;
    return world.rngState / 4294967296;
  }

  function randomInt(world, min, maxInclusive) {
    const low = Math.ceil(min);
    const high = Math.floor(maxInclusive);
    return Math.floor(nextRandom(world) * (high - low + 1)) + low;
  }

  function chance(world, probability) {
    return nextRandom(world) < clamp(probability, 0, 1);
  }

  function choice(world, values) {
    if (!Array.isArray(values) || values.length === 0) return undefined;
    return values[randomInt(world, 0, values.length - 1)];
  }

  function shuffled(world, values) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = randomInt(world, 0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function weightedChoice(world, entries, weightAccessor = (entry) => entry.weight || 1) {
    if (!entries || entries.length === 0) return undefined;
    const weights = entries.map((entry) => Math.max(0, Number(weightAccessor(entry)) || 0));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return choice(world, entries);
    let cursor = nextRandom(world) * total;
    for (let i = 0; i < entries.length; i += 1) {
      cursor -= weights[i];
      if (cursor <= 0) return entries[i];
    }
    return entries[entries.length - 1];
  }

  function uniqueId(world, prefix) {
    world.idCounter = (world.idCounter || 0) + 1;
    return `${prefix}_${String(world.idCounter).padStart(5, '0')}`;
  }

  function deepClone(value) {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function weekdayIndex(day) {
    return ((day - 1) % 7 + 7) % 7;
  }

  const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function weekdayName(day) {
    return WEEKDAYS[weekdayIndex(day)];
  }

  function formatClock(world) {
    return `${String(world.time.hour).padStart(2, '0')}:${String(world.time.minute || 0).padStart(2, '0')}`;
  }

  function formatDateTime(world) {
    return `${weekdayName(world.time.day)}, day ${world.time.day} · ${formatClock(world)}`;
  }

  function distance(a, b) {
    if (!a || !b) return 999;
    const ax = Number(a.x) || 0;
    const ay = Number(a.y) || 0;
    const bx = Number(b.x) || 0;
    const by = Number(b.y) || 0;
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function normalizeHex(hex) {
    if (!hex) return '#8aa4b8';
    const value = String(hex).trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : '#8aa4b8';
  }

  function mixHex(hexA, hexB, ratio = 0.5) {
    const a = normalizeHex(hexA).slice(1);
    const b = normalizeHex(hexB).slice(1);
    const t = clamp(ratio, 0, 1);
    const parse = (hex, start) => parseInt(hex.slice(start, start + 2), 16);
    const r = Math.round(parse(a, 0) * (1 - t) + parse(b, 0) * t);
    const g = Math.round(parse(a, 2) * (1 - t) + parse(b, 2) * t);
    const bl = Math.round(parse(a, 4) * (1 - t) + parse(b, 4) * t);
    return `#${[r, g, bl].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  }

  function luminance(hex) {
    const value = normalizeHex(hex).slice(1);
    const parts = [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16) / 255);
    const linear = parts.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }

  function contrastingText(hex) {
    return luminance(hex) > 0.42 ? '#12171f' : '#f6f8fb';
  }

  function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function appendLedger(world, type, message, details = {}) {
    if (!world.ledger) world.ledger = [];
    const entry = {
      id: uniqueId(world, 'event'),
      day: world.time.day,
      hour: world.time.hour,
      minute: world.time.minute || 0,
      type,
      message,
      actorIds: Array.isArray(details.actorIds) ? details.actorIds.slice() : [],
      placeId: details.placeId || null,
      objectId: details.objectId || null,
      causes: Array.isArray(details.causes) ? details.causes.slice() : [],
      evidence: details.evidence || null,
      scope: details.scope || 'world'
    };
    world.ledger.push(entry);
    if (world.ledger.length > 5000) world.ledger.splice(0, world.ledger.length - 5000);
    return entry;
  }

  function appendPropertyHistory(world, property, type, message, details = {}) {
    if (!property.history) property.history = [];
    const entry = {
      id: uniqueId(world, 'property_event'),
      day: world.time.day,
      hour: world.time.hour,
      minute: world.time.minute || 0,
      type,
      message,
      actorIds: Array.isArray(details.actorIds) ? details.actorIds.slice() : [],
      objectId: details.objectId || null,
      causes: Array.isArray(details.causes) ? details.causes.slice() : []
    };
    property.history.push(entry);
    if (property.history.length > 300) property.history.splice(0, property.history.length - 300);
    return entry;
  }

  function appendObjectHistory(world, object, type, message, details = {}) {
    if (!object.history) object.history = [];
    const entry = {
      id: uniqueId(world, 'object_event'),
      day: world.time.day,
      hour: world.time.hour,
      minute: world.time.minute || 0,
      type,
      message,
      actorId: details.actorId || null,
      causes: Array.isArray(details.causes) ? details.causes.slice() : []
    };
    object.history.push(entry);
    if (object.history.length > 120) object.history.splice(0, object.history.length - 120);
    return entry;
  }

  function relationshipLabel(relation) {
    if (!relation) return 'Stranger';
    if (relation.status === 'partner') return 'Partner';
    if (relation.status === 'former_partner') return 'Former partner';
    if (relation.status === 'dating') return 'Dating';
    if (relation.romance >= 55 && relation.friendship >= 45) return 'Mutual spark';
    if (relation.friendship >= 75) return 'Close friend';
    if (relation.friendship >= 45) return 'Friend';
    if (relation.friendship >= 15) return 'Acquaintance';
    if (relation.friendship <= -35) return 'Hostile';
    return 'Stranger';
  }

  function traitLabel(value, low, high) {
    if (value < 34) return low;
    if (value > 66) return high;
    return 'balanced';
  }

  function formatMoney(value) {
    const amount = safeNumber(value, 0);
    return `€${Math.round(amount).toLocaleString('en-US')}`;
  }

  function titleCase(text) {
    return String(text || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function objectUpgradeCost(definition, instance, axis) {
    const current = safeNumber(instance.upgrades && instance.upgrades[axis], 0);
    const basePrice = safeNumber(definition.price, 25);
    const money = Math.round((12 + basePrice * 0.075) * ((current + 1) ** 1.48));
    const axisMaterial = {
      comfort: { fabric: 1 + Math.floor(current / 2), wood: current >= 3 ? 1 : 0 },
      beauty: { paint: 1, wood: current >= 4 ? 1 : 0 },
      utility: { parts: 1 + Math.floor(current / 3), metal: current >= 2 ? 1 : 0 },
      durability: { wood: 1, metal: current >= 2 ? 1 : 0 },
      efficiency: { parts: 1, metal: current >= 4 ? 1 : 0 }
    };
    return { money, materials: axisMaterial[axis] || { parts: 1 } };
  }

  function computeObjectStats(definition, instance) {
    const base = definition.baseStats || {};
    const levels = instance.upgrades || {};
    const conditionFactor = clamp((instance.condition || 100) / 100, 0.35, 1);
    const sentimental = clamp(instance.sentimental || 0, 0, 100);
    const stats = {
      comfort: safeNumber(base.comfort, 20),
      beauty: safeNumber(base.beauty, 20),
      utility: safeNumber(base.utility, 20),
      durability: safeNumber(base.durability, 20),
      efficiency: safeNumber(base.efficiency, 20)
    };

    // Full investment makes every reasonable object late-game viable without flattening
    // the catalogue into identical 100/100 stat blocks. Its original strengths survive.
    const primaryGain = 10;
    const crossGain = 0.6;
    stats.comfort += safeNumber(levels.comfort) * primaryGain;
    stats.beauty += safeNumber(levels.beauty) * primaryGain;
    stats.utility += safeNumber(levels.utility) * primaryGain;
    stats.durability += safeNumber(levels.durability) * primaryGain;
    stats.efficiency += safeNumber(levels.efficiency) * primaryGain;

    const totalLevels = Object.values(levels).reduce((sum, value) => sum + safeNumber(value), 0);
    Object.keys(stats).forEach((key) => {
      stats[key] += totalLevels * crossGain;
      if (key !== 'beauty') stats[key] *= 0.72 + conditionFactor * 0.28;
      stats[key] = clamp(round(stats[key], 1), 0, 100);
    });

    stats.identity = clamp(round(25 + sentimental * 0.55 + totalLevels * 3.5, 1), 0, 100);
    stats.viability = round((stats.comfort + stats.beauty + stats.utility + stats.durability + stats.efficiency) / 5, 1);
    return stats;
  }

  function availableMaterialCheck(inventory, requirements) {
    const missing = {};
    Object.entries(requirements || {}).forEach(([key, amount]) => {
      const have = safeNumber(inventory && inventory[key], 0);
      if (have < amount) missing[key] = amount - have;
    });
    return missing;
  }

  function hasMissingMaterials(missing) {
    return Object.values(missing || {}).some((amount) => amount > 0);
  }

  function consumeMaterials(inventory, requirements) {
    Object.entries(requirements || {}).forEach(([key, amount]) => {
      inventory[key] = Math.max(0, safeNumber(inventory[key], 0) - amount);
    });
  }

  function sumObjectUpgrades(object) {
    return Object.values(object.upgrades || {}).reduce((sum, value) => sum + safeNumber(value), 0);
  }

  function average(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, value) => sum + safeNumber(value), 0) / values.length;
  }

  function standardDeviation(values) {
    if (!values || values.length <= 1) return 0;
    const mean = average(values);
    return Math.sqrt(average(values.map((value) => (safeNumber(value) - mean) ** 2)));
  }

  function serializeWorld(world) {
    return JSON.stringify(world, null, 2);
  }

  function parseWorld(text) {
    const parsed = JSON.parse(text);
    const supported = [SCHEMA].concat(LEGACY_SCHEMAS);
    if (!parsed || !supported.includes(parsed.schema)) {
      throw new Error(`Unsupported save schema. Expected one of: ${supported.join(', ')}.`);
    }
    return parsed;
  }

  AXM.Core = {
    VERSION,
    SCHEMA,
    LEGACY_SCHEMAS,
    WEEKDAYS,
    clamp,
    round,
    hashString,
    nextRandom,
    randomInt,
    chance,
    choice,
    shuffled,
    weightedChoice,
    uniqueId,
    deepClone,
    weekdayIndex,
    weekdayName,
    formatClock,
    formatDateTime,
    distance,
    normalizeHex,
    mixHex,
    contrastingText,
    safeNumber,
    appendLedger,
    appendPropertyHistory,
    appendObjectHistory,
    relationshipLabel,
    traitLabel,
    formatMoney,
    titleCase,
    objectUpgradeCost,
    computeObjectStats,
    availableMaterialCheck,
    hasMissingMaterials,
    consumeMaterials,
    sumObjectUpgrades,
    average,
    standardDeviation,
    serializeWorld,
    parseWorld
  };
}(typeof window !== 'undefined' ? window : globalThis));
