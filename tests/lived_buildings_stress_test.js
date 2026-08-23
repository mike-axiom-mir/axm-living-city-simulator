'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { Core, World, Systems, Presence } = globalThis.AXM;
const DAYS = Number(process.env.AXM_PRESENCE_STRESS_DAYS || 90);
const TOTAL_SEEDS = Math.max(1, Number(process.env.AXM_PRESENCE_STRESS_SEEDS || 8));
const SEED_START = Math.max(1, Number(process.env.AXM_PRESENCE_STRESS_START || 1));
const SEED_COUNT = Math.max(1, Math.min(TOTAL_SEEDS, Number(process.env.AXM_PRESENCE_STRESS_COUNT || TOTAL_SEEDS)));
const SEED_INDICES = Array.from({ length: SEED_COUNT }, (_, offset) => SEED_START + offset).filter((index) => index <= TOTAL_SEEDS);

function enterCurrentThreshold(world) {
  const current = Presence.presenceFor(world, 'player');
  if (current?.kind !== 'street_threshold') return;
  const access = Presence.accessFor(world, 'player', current.placeId);
  if (!access.ok) return;
  const result = Systems.startIndoorArrival(world, current.placeId, 'compressed');
  assert.equal(result.ok, true, result.reason);
}

function runWorld(seed) {
  const world = World.createWorld(seed);
  Systems.updateNpcSchedules(world);
  const ageBefore = world.player.age;
  const stageBefore = world.player.lifeCourse.stage;
  const destinations = ['place_market', 'place_school', world.player.homePropertyId];

  for (let day = 0; day < DAYS; day += 1) {
    Systems.advanceHours(world, 24, { freezePlayer: true });
    if ((day + 1) % 15 === 0) {
      const destination = destinations[Math.floor(day / 15) % destinations.length];
      if (world.player.locationId !== destination) {
        const journey = Systems.startPlayerJourney(world, destination, 'compressed');
        assert.equal(journey.ok, true, journey.reason || journey.travel?.reason);
      }
      enterCurrentThreshold(world);
    }
  }

  const validation = Systems.validateWorld(world);
  assert.equal(validation.ok, true, validation.errors.slice(0, 12).join('\n'));
  assert.equal(Object.keys(world.presenceByPerson).length, world.people.length + 1);
  assert.equal(world.settings.presenceCompressionAllowed, true);
  assert.equal(world.settings.compulsoryGreetings, false);
  assert.equal(world.settings.presenceWatchingReward, false);
  assert.equal(world.settings.presenceSurveillance, false);
  assert.equal(world.settings.minuteByMinutePresenceTax, false);
  assert.equal(world.settings.socialChecklist, false);
  assert.equal(world.settings.presenceMovementObligation, false);
  assert.equal(world.player.age, ageBefore);
  assert.equal(world.player.lifeCourse.stage, stageBefore);
  world.people.forEach((person) => {
    const presence = Presence.presenceFor(world, person.id);
    if (presence?.kind === 'private_interior_coarse') assert.equal(presence.roomId, null);
  });
  (world.presenceRecords || []).forEach((record) => {
    assert.equal(record.noWatchingReward, true);
    assert.equal(record.noAuthorityFromPresence, true);
    assert.equal(record.access?.authority?.surveillance === true, false);
  });
  return { world, serialized: Core.serializeWorld(world), metrics: Presence.metrics(world), rawMetrics: Core.deepClone(world.metrics) };
}

const aggregate = {
  schema: 'axm.living-city.lived-buildings-stress/v0.11.0',
  seeds: SEED_INDICES.length,
  seedStart: SEED_START,
  daysPerWorld: DAYS,
  deterministicReplays: 0,
  indoorMovementsStarted: 0,
  indoorMovementsCompleted: 0,
  visibleMovements: 0,
  compressedMovements: 0,
  scheduleMovements: 0,
  indoorMinutes: 0,
  stairUses: 0,
  lawfulArrivals: 0,
  lawfulDepartures: 0,
  roomTransitions: 0,
  encountersOffered: 0,
  encountersDeclined: 0,
  encountersPassed: 0,
  finalPresenceRecords: 0,
  finalPresenceSnapshots: 0,
  validationFailures: 0,
  exactReplayFailures: 0
};

for (const index of SEED_INDICES) {
  const seed = `AXM-LIVED-STRESS-${String(index).padStart(2, '0')}`;
  const first = runWorld(seed);
  const replay = runWorld(seed);
  try {
    assert.equal(replay.serialized, first.serialized);
  } catch (error) {
    aggregate.exactReplayFailures += 1;
    throw error;
  }
  aggregate.deterministicReplays += 1;
  aggregate.indoorMovementsStarted += first.rawMetrics.indoorMovementsStarted || 0;
  aggregate.indoorMovementsCompleted += first.rawMetrics.indoorMovementsCompleted || 0;
  aggregate.visibleMovements += first.rawMetrics.indoorVisibleMovements || 0;
  aggregate.compressedMovements += first.rawMetrics.indoorCompressedMovements || 0;
  aggregate.scheduleMovements += first.rawMetrics.indoorScheduleMovements || 0;
  aggregate.indoorMinutes += first.rawMetrics.indoorMovementMinutes || 0;
  aggregate.stairUses += first.metrics.stairUses;
  aggregate.lawfulArrivals += first.rawMetrics.lawfulArrivals || 0;
  aggregate.lawfulDepartures += first.rawMetrics.lawfulDepartures || 0;
  aggregate.roomTransitions += first.rawMetrics.roomTransitions || 0;
  aggregate.encountersOffered += first.metrics.encountersOffered;
  aggregate.encountersDeclined += first.metrics.encountersDeclined;
  aggregate.encountersPassed += first.rawMetrics.encountersPassed || 0;
  aggregate.finalPresenceRecords += first.world.presenceRecords.length;
  aggregate.finalPresenceSnapshots += Object.keys(first.world.presenceByPerson).length;
  console.log(`PASS ${seed}: ${DAYS} days, ${first.rawMetrics.indoorMovementsCompleted || 0} completed indoor movements, ${first.metrics.stairUses} stair uses.`);
}

const suffix = SEED_INDICES.length === TOTAL_SEEDS && SEED_START === 1
  ? ''
  : `_v0_11_${String(SEED_START).padStart(2, '0')}_${String(SEED_INDICES.at(-1)).padStart(2, '0')}`;
const jsonPath = path.join(ROOT, 'tests', `LIVED_BUILDINGS_STRESS_RESULTS${suffix}.json`);
const textPath = path.join(ROOT, 'tests', `LIVED_BUILDINGS_STRESS_RESULTS${suffix}.txt`);
fs.writeFileSync(jsonPath, `${JSON.stringify(aggregate, null, 2)}\n`, 'utf8');
fs.writeFileSync(textPath, [
  'AXM Living City — Lived Buildings Stress Results v0.11.0',
  `Seeds: ${aggregate.seeds}`,
  `Days per world: ${aggregate.daysPerWorld}`,
  `Deterministic replay matches: ${aggregate.deterministicReplays}/${aggregate.seeds}`,
  `Indoor movements started/completed: ${aggregate.indoorMovementsStarted}/${aggregate.indoorMovementsCompleted}`,
  `Visible/compressed/schedule movements: ${aggregate.visibleMovements}/${aggregate.compressedMovements}/${aggregate.scheduleMovements}`,
  `Indoor movement minutes: ${aggregate.indoorMinutes}`,
  `Stair uses: ${aggregate.stairUses}`,
  `Lawful arrivals/departures: ${aggregate.lawfulArrivals}/${aggregate.lawfulDepartures}`,
  `Room transitions: ${aggregate.roomTransitions}`,
  `Encounter offers/declines/passed: ${aggregate.encountersOffered}/${aggregate.encountersDeclined}/${aggregate.encountersPassed}`,
  `Final retained presence records: ${aggregate.finalPresenceRecords}`,
  `Final presence snapshots: ${aggregate.finalPresenceSnapshots}`,
  `Validation failures: ${aggregate.validationFailures}`,
  `Exact replay failures: ${aggregate.exactReplayFailures}`,
  'Protected roots: compression available; greetings optional; private rooms coarsened; no watching reward; no minute-by-minute presence tax; no age pressure.'
].join('\n') + '\n', 'utf8');

console.log(`\n${SEED_INDICES.length}/${SEED_INDICES.length} deterministic lived-building stress worlds passed twice.`);
console.log(JSON.stringify(aggregate, null, 2));
