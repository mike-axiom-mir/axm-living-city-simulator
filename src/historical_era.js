(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Systems = AXM.Systems;

  if (!Core || !Content || !World || !Systems) {
    throw new Error('Living City historical era progression requires Core, Content, World and Systems.');
  }
  if (AXM.HistoricalEra) return;

  const SCHEMA = 'axm.living-city.historical-era/v0.12.0-draft';
  const START_YEAR = 1980;
  const END_YEAR = 2026;
  const DAYS_PER_ERA_YEAR = 7;

  const ERAS = Object.freeze([
    Object.freeze({ id: 'eighties', start: 1980, end: 1989, label: 'Analog Eighties' }),
    Object.freeze({ id: 'nineties', start: 1990, end: 1999, label: 'Digital Nineties' }),
    Object.freeze({ id: 'connected_2000s', start: 2000, end: 2009, label: 'Connected 2000s' }),
    Object.freeze({ id: 'mobile_2010s', start: 2010, end: 2019, label: 'Mobile 2010s' }),
    Object.freeze({ id: 'present_2020s', start: 2020, end: 2026, label: 'Present Era' })
  ]);

  const INTRO_YEARS = Object.freeze({
    handheld_game_screen: 1990,
    old_laptop: 1995,
    refurbished_laptop: 2000,
    fast_computer: 2005,
    induction_stove: 2005,
    compact_computer: 2010
  });

  function yearForDay(day) {
    const normalizedDay = Math.max(1, Math.floor(Number(day) || 1));
    return Math.min(END_YEAR, START_YEAR + Math.floor((normalizedDay - 1) / DAYS_PER_ERA_YEAR));
  }

  function dayForYear(year) {
    const boundedYear = Core.clamp(Math.floor(Number(year) || START_YEAR), START_YEAR, END_YEAR);
    return 1 + (boundedYear - START_YEAR) * DAYS_PER_ERA_YEAR;
  }

  function currentYear(world) {
    return yearForDay(world?.time?.day || 1);
  }

  function eraForYear(year) {
    const boundedYear = Core.clamp(Math.floor(Number(year) || START_YEAR), START_YEAR, END_YEAR);
    return ERAS.find((era) => boundedYear >= era.start && boundedYear <= era.end) || ERAS[ERAS.length - 1];
  }

  function introYear(catalogId) {
    return INTRO_YEARS[catalogId] || START_YEAR;
  }

  function furnitureAvailability(world, catalogId) {
    const definition = Content.furnitureById(catalogId);
    if (!definition) return { ok: false, catalogId, reason: 'Unknown furniture.', introducedYear: null, currentYear: currentYear(world) };
    const introducedYear = introYear(catalogId);
    const year = currentYear(world);
    return {
      ok: year >= introducedYear,
      catalogId,
      introducedYear,
      currentYear: year,
      reason: year >= introducedYear ? null : `${definition.name} enters this timeline in ${introducedYear}; the city is currently in ${year}.`
    };
  }

  function availableFurniture(world) {
    return Content.FURNITURE_CATALOG.filter((definition) => furnitureAvailability(world, definition.id).ok);
  }

  function historicalizeNewWorld(world) {
    const home = World.homeOf(world, 'player');
    if (!home) return world;
    const futureStarter = (home.furniture || []).find((object) => object.ownerId === 'player' && object.catalogId === 'old_laptop');
    if (futureStarter) {
      const replacement = Content.furnitureById('music_player');
      futureStarter.catalogId = 'music_player';
      futureStarter.acquiredPrice = replacement?.price || futureStarter.acquiredPrice;
      futureStarter.sentimental = Math.max(8, Number(futureStarter.sentimental) || 0);
      Core.appendObjectHistory(world, futureStarter, 'historical_start', 'The 1980 starting room uses a music player here; personal computing arrives later in the timeline.', {
        actorId: 'player', causes: ['historical start year 1980', 'technology availability']
      });
    }
    return world;
  }

  const originalCreateWorld = World.createWorld;
  World.createWorld = function createHistoricalWorld(...args) {
    return historicalizeNewWorld(originalCreateWorld.apply(World, args));
  };

  const originalBuyFurniture = Systems.buyFurniture;
  Systems.buyFurniture = function buyFurnitureForEra(world, catalogId, ...args) {
    const availability = furnitureAvailability(world, catalogId);
    if (!availability.ok) {
      return { ok: false, reason: availability.reason, historicalEra: availability };
    }
    const result = originalBuyFurniture.call(Systems, world, catalogId, ...args);
    if (result && typeof result === 'object') result.historicalEra = availability;
    return result;
  };

  const originalFormatDateTime = Core.formatDateTime;
  Core.formatDateTime = function formatHistoricalDateTime(world) {
    const year = currentYear(world);
    return `${year} · ${eraForYear(year).label} · ${originalFormatDateTime(world)}`;
  };

  if (typeof Systems.computeMetrics === 'function') {
    const originalComputeMetrics = Systems.computeMetrics;
    Systems.computeMetrics = function computeMetricsWithHistoricalEra(world, ...args) {
      return { ...originalComputeMetrics.call(Systems, world, ...args), historicalEra: summary(world) };
    };
  }

  function summary(world) {
    const year = currentYear(world);
    const era = eraForYear(year);
    return {
      schema: SCHEMA,
      startYear: START_YEAR,
      endYear: END_YEAR,
      currentYear: year,
      eraId: era.id,
      eraLabel: era.label,
      daysPerEraYear: DAYS_PER_ERA_YEAR,
      atPresent: year === END_YEAR,
      availableFurniture: availableFurniture(world).length,
      totalFurniture: Content.FURNITURE_CATALOG.length,
      playerAgePressure: false,
      lifeCourseStillChoiceBased: true,
      existingFutureObjectsArePreserved: true
    };
  }

  AXM.HistoricalEra = Object.freeze({
    SCHEMA,
    START_YEAR,
    END_YEAR,
    DAYS_PER_ERA_YEAR,
    ERAS,
    INTRO_YEARS,
    yearForDay,
    dayForYear,
    currentYear,
    eraForYear,
    introYear,
    furnitureAvailability,
    availableFurniture,
    historicalizeNewWorld,
    summary
  });
}(typeof window !== 'undefined' ? window : globalThis));
