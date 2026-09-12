'use strict';

const assert = require('node:assert/strict');

globalThis.AXM = {
  Game: {
    autosaveConflict: null,
    world: { seed: 'AXM-EXPERIENCE-TEST', time: { day: 1 }, settings: { autosave: true } }
  },
  Systems: { toast() {} }
};

require('../src/autosave_clear_recovery_ui.js');

const UI = globalThis.AXM.AutosaveClearRecoveryUI;
let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

const Game = globalThis.AXM.Game;

Game.autosaveConflict = { kind: 'clear-transaction-held', key: 'clear-key', reason: 'unexpected-marker' };
const heldBefore = JSON.stringify({ world: Game.world, conflict: Game.autosaveConflict });
const held = UI.project(Game);
check(held?.kind === 'clear-transaction-held', 'unknown clear markers project a held experience state');
check(held?.title === 'Local save cleanup needs review.', 'held cleanup has a direct human title');
check(held?.fallbackWorld === true, 'held startup state identifies the open world as an in-memory fallback');
check(held?.canRetry === false, 'unknown markers do not offer a destructive retry');
check(held?.body.includes('did not load, delete, or overwrite'), 'held copy states the fail-closed storage behavior');
check(JSON.stringify({ world: Game.world, conflict: Game.autosaveConflict }) === heldBefore, 'projection does not mutate world or storage-conflict truth');

Game.autosaveConflict = { kind: 'clear-transaction-pending', key: 'clear-key', reason: 'physical-cleanup-failed' };
const pending = UI.project(Game);
check(pending?.kind === 'clear-transaction-pending', 'interrupted cleanup projects a pending state');
check(pending?.canRetry === true, 'only an admitted interrupted cleanup offers safe retry');
check(pending?.body.includes('Save loading and autosave writes remain held'), 'pending copy explains the blocked loop');

Game.autosaveConflict = { kind: 'clear-transaction-unavailable', key: 'clear-key', reason: 'intent-write-failed' };
const unavailable = UI.project(Game);
check(unavailable?.kind === 'clear-transaction-unavailable', 'failed intent publication projects an unavailable state');
check(unavailable?.fallbackWorld === false, 'failed clear-start does not mislabel the already-open world as recovered/fallback');
check(unavailable?.body.includes('No cleanup was admitted'), 'unavailable copy explains that deletion did not begin');

Game.autosaveConflict = { kind: 'stale-storage' };
check(UI.project(Game) === null, 'stale-writer conflicts remain owned by the separate Experience lane');
Game.autosaveConflict = null;
check(UI.project(Game) === null, 'ordinary play remains visually unchanged without a clear-transaction conflict');

console.log(`Autosave clear recovery experience checks: ${checks}/${checks} passed.`);
