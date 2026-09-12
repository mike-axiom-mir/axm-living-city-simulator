(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Career = AXM.CareerSkills;
  const Engineering = AXM.EngineeringEwaste;

  if (!Career || !Engineering) throw new Error('Living City career engineering bridge requires CareerSkills and EngineeringEwaste.');
  if (AXM.CareerEngineeringBridge) return;

  const ACTION_LABELS = Object.freeze({
    collectEwaste: 'Collect e-waste intact',
    inspectEwaste: 'Inspect e-waste',
    salvageEwaste: 'Dismantle e-waste',
    refurbishEwaste: 'Refurbish e-waste',
    sellRefurbished: 'Sell refurbished electronics',
    buildPrototype: 'Build engineering prototype'
  });

  function wrapAction(name) {
    const original = Engineering[name];
    if (typeof original !== 'function') return null;
    return function careerAwareEngineeringAction(world, ...args) {
      // This is an explicit engineering mutation, so installing missing current
      // career state is allowed. An unknown/future career schema must refuse
      // before the engineering backend changes time, money, parts or lots.
      Career.ensureState(world);
      const before = Career.skillSnapshot(world.player);
      const result = original.call(Engineering, world, ...args);
      if (result?.ok) {
        Career.recordSkillDeltas(world, before, Career.skillSnapshot(world.player), {
          type: 'engineering_work',
          id: name,
          label: ACTION_LABELS[name] || name,
          hours: Number(result.hours) || 0
        });
      }
      return result;
    };
  }

  const wrapped = { ...Engineering };
  Object.keys(ACTION_LABELS).forEach((name) => {
    const action = wrapAction(name);
    if (action) wrapped[name] = action;
  });

  AXM.EngineeringEwaste = Object.freeze(wrapped);
  AXM.CareerEngineeringBridge = Object.freeze({
    ACTION_LABELS,
    sourceSchema: Engineering.SCHEMA,
    careerSchema: Career.SCHEMA,
    recordsSkillEvidenceOnly: true,
    addsNoEngineeringReward: true,
    refusesUnknownCareerSchemaBeforeEngineeringMutation: true
  });
}(typeof window !== 'undefined' ? window : globalThis));