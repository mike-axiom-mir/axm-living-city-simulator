'use strict';

const assert = require('node:assert/strict');
const { HeadlessSimulator } = require('../runtime/headless-simulator');

const simulator = HeadlessSimulator.create({ seed: 'AXM-AUTOSAVE-CONFLICT-EXPERIENCE' });
require('../src/game.js');
require('../src/autosave_conflict_ui.js');

const Game = simulator.axm.Game;
const Experience = simulator.axm.AutosaveConflictUI;
let checks = 0;

function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write(`PASS ${message}\n`);
}

Game.world = simulator.world;
Game.world.settings.autosave = true;

check(Experience.project(Game) === null, 'no conflict produces no user-facing conflict projection');

const before = simulator.serialize();
Game.autosaveConflict = { kind: 'stale-storage', key: 'local-current', baselineKnown: true };
const projected = Experience.project(Game);
check(projected?.kind === 'stale-storage', 'stale storage becomes an explicit experience state');
check(projected?.autosaveEnabled === true, 'projection reports that autosave is still enabled while writes are held');
check(projected?.body.includes('newer stored world is not silently replaced'), 'projection explains why the write is being held');
check(projected?.guidance.includes('Export this session before reloading'), 'projection exposes the safe next action before reload');
check(simulator.serialize() === before, 'experience projection does not mutate canonical world state');

Game.world.settings.autosave = false;
const memoryOnly = Experience.project(Game);
check(memoryOnly?.autosaveEnabled === false, 'projection distinguishes an explicit continue-with-autosave-off choice');
check(memoryOnly?.body.includes('continuing in memory with autosave off'), 'memory-only state remains human-readable');

Game.autosaveConflict = { kind: 'other-diagnostic' };
check(Experience.project(Game) === null, 'unrelated diagnostics are not relabeled as stale-storage conflicts');

process.stdout.write(`PASS ${checks}/${checks} autosave conflict experience checks\n`);
