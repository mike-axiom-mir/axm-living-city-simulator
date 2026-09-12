(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const World = AXM.World;
  const HistoricalEra = AXM.HistoricalEra;
  const EngineeringEwaste = AXM.EngineeringEwaste;

  if (!Core || !World || !HistoricalEra || !EngineeringEwaste) {
    throw new Error('Living City engineering visuals require Core, World, HistoricalEra and EngineeringEwaste.');
  }
  if (AXM.EngineeringVisuals) return;

  const SCHEMA = 'axm.living-city.engineering-visuals/v0.12.0-draft';
  const WIDTH = 960;
  const HEIGHT = 420;

  function engineeringStateStatus(world) {
    const state = world?.engineeringEwaste;
    if (!state) return { ok: true, initialized: false, state: EngineeringEwaste.peekState(world) };
    if (state.schema !== EngineeringEwaste.SCHEMA) {
      return {
        ok: false,
        initialized: true,
        state: null,
        reason: `Engineering visuals held: unrecognized state schema ${String(state.schema || 'unknown')}.`
      };
    }
    return { ok: true, initialized: true, state };
  }

  function sceneFor(world) {
    const status = engineeringStateStatus(world);
    const year = HistoricalEra.currentYear(world);
    const era = HistoricalEra.eraForYear(year);
    if (!status.ok) {
      return {
        schema: SCHEMA,
        kind: 'held',
        year,
        eraLabel: era.label,
        reason: status.reason,
        prototypes: [],
        visualOnly: true,
        noRewardAuthority: true,
        noWorldMutation: true
      };
    }

    const bench = EngineeringEwaste.benchStatus(world);
    const state = status.state;
    return {
      schema: SCHEMA,
      kind: 'workbench',
      year,
      eraLabel: era.label,
      bench: {
        availableHere: bench.ok,
        mode: bench.mode,
        placeId: bench.placeId,
        objectId: bench.objectId,
        reason: bench.reason || null
      },
      queueCount: state.lots.length,
      componentCount: Object.values(state.components || {}).reduce((sum, value) => sum + (Number(value) || 0), 0),
      prototypes: (state.prototypes || []).map((prototype) => ({
        id: prototype.id,
        blueprintId: prototype.blueprintId,
        name: prototype.name,
        kind: prototype.kind,
        builtYear: prototype.builtYear,
        autonomous: prototype.autonomous === true,
        scheduleAuthority: prototype.scheduleAuthority === true,
        provenance: Array.isArray(prototype.provenance) ? prototype.provenance.slice() : []
      })),
      visualOnly: true,
      noRewardAuthority: true,
      noWorldMutation: true
    };
  }

  function validateScene(scene) {
    const errors = [];
    if (!scene || scene.schema !== SCHEMA) errors.push('Engineering visual scene schema mismatch.');
    if (!['held', 'workbench'].includes(scene?.kind)) errors.push('Unknown engineering visual scene kind.');
    if (scene?.visualOnly !== true || scene?.noRewardAuthority !== true || scene?.noWorldMutation !== true) {
      errors.push('Engineering visual scene must remain presentation-only.');
    }
    (scene?.prototypes || []).forEach((prototype) => {
      if (prototype.autonomous) errors.push(`${prototype.name || prototype.id} unexpectedly claims autonomy.`);
      if (prototype.scheduleAuthority) errors.push(`${prototype.name || prototype.id} unexpectedly claims schedule authority.`);
    });
    return { ok: errors.length === 0, errors };
  }

  function motionForPrototype(prototype, timestamp = 0, motionAmount = 1) {
    const amount = Core.clamp(Number(motionAmount) || 0, 0, 1);
    const time = Math.max(0, Number(timestamp) || 0);
    if (!prototype || amount <= 0) return { x: 0, y: 0, rotation: 0, light: 0.58 };
    if (prototype.blueprintId === 'bench_blinker') {
      return { x: 0, y: 0, rotation: 0, light: 0.35 + (Math.sin(time / 260) + 1) * 0.3 * amount };
    }
    if (prototype.blueprintId === 'motor_bug') {
      return {
        x: Math.sin(time / 78) * 3.2 * amount,
        y: Math.cos(time / 104) * 1.2 * amount,
        rotation: Math.sin(time / 115) * 0.035 * amount,
        light: 0.62
      };
    }
    if (prototype.blueprintId === 'mini_scrap_crawler') {
      return {
        x: Math.sin(time / 920) * 72 * amount,
        y: Math.sin(time / 410) * 2 * amount,
        rotation: Math.sin(time / 920) >= 0 ? 0.025 : -0.025,
        light: 0.7
      };
    }
    return { x: 0, y: 0, rotation: 0, light: 0.6 };
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawBenchBlinker(ctx, x, y, motion) {
    ctx.save();
    ctx.translate(x + motion.x, y + motion.y);
    ctx.fillStyle = '#303944';
    roundedRect(ctx, -32, -18, 64, 36, 7);
    ctx.fill();
    ctx.strokeStyle = '#9c7a54';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#b6c1c8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, 4);
    ctx.lineTo(-5, -6);
    ctx.lineTo(8, 5);
    ctx.lineTo(19, -3);
    ctx.stroke();
    ctx.globalAlpha = Core.clamp(motion.light, 0.18, 1);
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.arc(20, -7, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMotorBug(ctx, x, y, motion) {
    ctx.save();
    ctx.translate(x + motion.x, y + motion.y);
    ctx.rotate(motion.rotation);
    ctx.fillStyle = '#59656a';
    roundedRect(ctx, -30, -13, 60, 26, 12);
    ctx.fill();
    ctx.strokeStyle = '#d0a86e';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#9faeb1';
    ctx.beginPath();
    ctx.moveTo(-22, 11); ctx.lineTo(-32, 24);
    ctx.moveTo(-7, 12); ctx.lineTo(-13, 25);
    ctx.moveTo(10, 12); ctx.lineTo(16, 25);
    ctx.moveTo(24, 10); ctx.lineTo(33, 22);
    ctx.stroke();
    ctx.fillStyle = '#9dd7c1';
    ctx.beginPath();
    ctx.arc(19, -3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCrawler(ctx, x, y, motion) {
    ctx.save();
    ctx.translate(x + motion.x, y + motion.y);
    ctx.rotate(motion.rotation);
    ctx.fillStyle = '#46535b';
    roundedRect(ctx, -38, -17, 76, 34, 9);
    ctx.fill();
    ctx.strokeStyle = '#c28e5b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#20272d';
    [-25, 25].forEach((wheelX) => {
      ctx.beginPath();
      ctx.arc(wheelX, 18, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#83939a';
      ctx.stroke();
    });
    ctx.strokeStyle = '#a4b8b8';
    ctx.beginPath();
    ctx.moveTo(16, -16);
    ctx.lineTo(26, -31);
    ctx.stroke();
    ctx.fillStyle = '#8fd8c5';
    ctx.beginPath();
    ctx.arc(27, -33, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPrototype(ctx, prototype, x, y, timestamp, motionAmount) {
    const motion = motionForPrototype(prototype, timestamp, motionAmount);
    if (prototype.blueprintId === 'bench_blinker') drawBenchBlinker(ctx, x, y, motion);
    else if (prototype.blueprintId === 'motor_bug') drawMotorBug(ctx, x, y, motion);
    else if (prototype.blueprintId === 'mini_scrap_crawler') drawCrawler(ctx, x, y, motion);
    else {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#4c5861';
      roundedRect(ctx, -28, -15, 56, 30, 6);
      ctx.fill();
      ctx.restore();
    }
  }

  function draw(ctx, scene, timestamp = 0, options = {}) {
    const validation = validateScene(scene);
    const width = Number(options.width) || WIDTH;
    const height = Number(options.height) || HEIGHT;
    const motionAmount = options.motion === 'still' ? 0 : options.motion === 'gentle' ? 0.38 : 1;

    ctx.clearRect(0, 0, width, height);
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, '#18222b');
    background.addColorStop(1, '#0d1319');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    if (!validation.ok || scene.kind === 'held') {
      ctx.fillStyle = '#d9e2e5';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Engineering view held at the truth boundary', width / 2, height / 2 - 8);
      ctx.fillStyle = '#9caeb5';
      ctx.font = '500 13px system-ui, sans-serif';
      ctx.fillText(String(scene?.reason || validation.errors.join(' · ')).slice(0, 120), width / 2, height / 2 + 20);
      return validation;
    }

    ctx.fillStyle = '#202b33';
    roundedRect(ctx, 35, 42, width - 70, height - 84, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(224,235,238,0.14)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const benchY = height - 112;
    ctx.fillStyle = '#6d5945';
    roundedRect(ctx, 72, benchY, width - 144, 58, 12);
    ctx.fill();
    ctx.fillStyle = '#46382d';
    ctx.fillRect(105, benchY + 50, 28, 55);
    ctx.fillRect(width - 133, benchY + 50, 28, 55);

    ctx.fillStyle = '#dfe8ea';
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`WORKSHOP DISPLAY · ${scene.year} · ${scene.eraLabel}`, 68, 78);
    ctx.fillStyle = '#9eafb5';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(scene.bench.availableHere ? `Physical engineering access: ${scene.bench.mode === 'home_bench' ? 'home workbench' : 'public repair workshop'}` : 'Display only here — engineering actions still require a real bench/workshop location', 68, 100);

    const prototypes = scene.prototypes.slice(-6);
    if (!prototypes.length) {
      ctx.fillStyle = '#91a2aa';
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('The bench is waiting for something weird made from reclaimed parts.', width / 2, benchY - 54);
    } else {
      const spacing = Math.min(170, (width - 180) / Math.max(1, prototypes.length));
      const startX = width / 2 - ((prototypes.length - 1) * spacing) / 2;
      prototypes.forEach((prototype, index) => {
        const baseX = startX + index * spacing;
        drawPrototype(ctx, prototype, baseX, benchY - 30, timestamp + index * 97, motionAmount);
        ctx.fillStyle = '#dbe4e6';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(prototype.name, baseX, benchY + 34, Math.max(90, spacing - 8));
        ctx.fillStyle = '#8fa2aa';
        ctx.font = '600 9px system-ui, sans-serif';
        ctx.fillText(`built ${prototype.builtYear}`, baseX, benchY + 48);
      });
    }

    ctx.fillStyle = 'rgba(8,13,18,0.78)';
    roundedRect(ctx, 58, height - 42, width - 116, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#9cc9bb';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DISPLAY MOTION ONLY · NO TASKS · NO SCHEDULE · NO REWARD · NO WORLD MUTATION FROM WATCHING', width / 2, height - 25);
    return validation;
  }

  AXM.EngineeringVisuals = Object.freeze({
    SCHEMA,
    WIDTH,
    HEIGHT,
    engineeringStateStatus,
    sceneFor,
    validateScene,
    motionForPrototype,
    draw
  });
}(typeof window !== 'undefined' ? window : globalThis));
