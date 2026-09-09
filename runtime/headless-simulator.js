'use strict';

const { loadSimulation } = require('./load-simulation');

const DEFAULT_SEED = 'AXM-LIVING-CITY-001';

function positiveInteger(value, label, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    throw new Error(label + ' must be an integer from 1 to ' + maximum);
  }
  return number;
}

function assertValid(axm, world, label) {
  const result = axm.Systems.validateWorld(world);
  if (!result.ok) {
    throw new Error(label + ' failed invariant validation:\n' + result.errors.join('\n'));
  }
  return result;
}

class HeadlessSimulator {
  constructor(axm, world) {
    this.axm = axm;
    this.world = world;
  }

  static create(options = {}) {
    const axm = loadSimulation(options);
    const seed = String(options.seed || DEFAULT_SEED).trim() || DEFAULT_SEED;
    const world = axm.World.createWorld(seed);
    axm.Systems.updateNpcSchedules(world);
    axm.Systems.updateTutorial(world);
    assertValid(axm, world, 'new world');
    return new HeadlessSimulator(axm, world);
  }

  static fromText(text, options = {}) {
    const axm = loadSimulation(options);
    const parsed = axm.Core.parseWorld(String(text));
    const world = axm.Systems.migrateWorld(parsed);
    assertValid(axm, world, 'loaded world');
    return new HeadlessSimulator(axm, world);
  }

  static fromCanonicalText(text, options = {}) {
    const axm = loadSimulation(options);
    const parsed = axm.Core.parseWorld(String(text));
    if (Object.hasOwn(parsed, 'ui')) {
      throw new Error('Canonical world projection input must omit root ui realization state.');
    }
    const template = axm.World.createWorld(String(parsed.seed || DEFAULT_SEED));
    parsed.ui = axm.Core.deepClone(template.ui);
    const world = axm.Systems.migrateWorld(parsed);
    assertValid(axm, world, 'rehydrated canonical world');
    return new HeadlessSimulator(axm, world);
  }

  validate() {
    return this.axm.Systems.validateWorld(this.world);
  }

  serialize() {
    assertValid(this.axm, this.world, 'world serialization');
    return this.axm.Core.serializeWorld(this.world);
  }

  serializeCanonical() {
    assertValid(this.axm, this.world, 'canonical world projection');
    return this.axm.Core.serializeCanonicalWorld(this.world);
  }

  advanceMinutes(minutes) {
    const count = positiveInteger(minutes, 'minutes', 525600);
    this.axm.Systems.advanceMinutes(this.world, count);
    assertValid(this.axm, this.world, 'advanced world');
    return this.summary();
  }

  observeDays(days) {
    const count = positiveInteger(days, 'days', 365);
    const result = this.axm.Systems.runObserverDays(this.world, count);
    assertValid(this.axm, this.world, 'observed world');
    return { result, summary: this.summary() };
  }

  summary() {
    const validation = this.validate();
    return {
      schema: this.world.schema,
      version: this.world.version,
      seed: this.world.seed,
      time: {
        day: this.world.time.day,
        hour: this.world.time.hour,
        minute: this.world.time.minute || 0
      },
      people: 1 + this.world.people.length,
      places: this.world.places.length,
      ledgerEntries: this.world.ledger.length,
      identityCursors: this.axm.Core.identityCursorSummary(this.world),
      rngState: this.world.rngState,
      valid: validation.ok,
      validationErrors: validation.errors
    };
  }
}

module.exports = Object.freeze({ DEFAULT_SEED, HeadlessSimulator });