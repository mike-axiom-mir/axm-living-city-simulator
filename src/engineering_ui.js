(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Systems = AXM.Systems;
  const HistoricalEra = AXM.HistoricalEra;
  const EngineeringEwaste = AXM.EngineeringEwaste;
  const EngineeringVisuals = AXM.EngineeringVisuals;
  const Game = AXM.Game;
  const UI = AXM.UI;

  if (!Core || !Systems || !HistoricalEra || !EngineeringEwaste || !EngineeringVisuals || !Game || !UI) {
    throw new Error('Living City engineering UI requires Core, Systems, HistoricalEra, EngineeringEwaste, EngineeringVisuals, Game and UI.');
  }
  if (AXM.EngineeringUI) return;

  const SCHEMA = 'axm.living-city.engineering-ui/v0.12.0-draft';
  let engineeringFrame = null;
  let engineeringLastDraw = 0;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function formatComponents(components) {
    const entries = Object.entries(components || {}).filter(([, amount]) => Number(amount) > 0);
    return entries.length
      ? entries.map(([key, amount]) => `${Core.titleCase(key)} x${amount}`).join(' · ')
      : 'none';
  }

  function installStyles() {
    if (typeof document === 'undefined' || document.getElementById('axm-engineering-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'axm-engineering-ui-styles';
    style.textContent = `
      .engineering-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:16px;align-items:start}
      .engineering-workshop-canvas{display:block;width:100%;height:auto;aspect-ratio:16/7;border-radius:14px;background:#0d1319;border:1px solid rgba(224,235,238,.12)}
      .engineering-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .engineering-summary-tile{padding:12px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)}
      .engineering-summary-tile span{display:block;font-size:11px;opacity:.68;text-transform:uppercase;letter-spacing:.08em}
      .engineering-summary-tile strong{display:block;margin-top:5px;font-size:18px}
      .engineering-lot,.engineering-stock,.engineering-blueprint,.engineering-prototype{padding:13px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)}
      .engineering-item-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .engineering-item-head h4{margin:0 0 3px}
      .engineering-item-head p{margin:0;opacity:.72;font-size:12px}
      .engineering-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .engineering-reason{margin-top:8px;font-size:11px;opacity:.72}
      .engineering-components{display:flex;flex-wrap:wrap;gap:7px}
      .engineering-component{padding:7px 9px;border-radius:999px;background:rgba(132,184,167,.09);border:1px solid rgba(132,184,167,.2);font-size:12px}
      .engineering-provenance{margin-top:8px;padding:9px 10px;border-left:2px solid rgba(221,177,105,.6);background:rgba(221,177,105,.05);font-size:11px;line-height:1.45}
      .engineering-held{padding:18px;border-radius:14px;border:1px solid rgba(220,137,130,.35);background:rgba(220,137,130,.07)}
      .engineering-section-title{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}
      .engineering-section-title h3{margin:0}
      .engineering-empty{padding:15px;border-radius:12px;border:1px dashed rgba(255,255,255,.14);opacity:.7}
      .engineering-policy{font-size:11px;line-height:1.5;opacity:.72}
      @media (max-width:900px){.engineering-layout{grid-template-columns:1fr}.engineering-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media (max-width:520px){.engineering-summary-grid{grid-template-columns:1fr 1fr}.engineering-actions .button{flex:1 1 auto}}
    `;
    document.head.appendChild(style);
  }

  function stateStatus(world) {
    const state = world.engineeringEwaste;
    if (state && state.schema !== EngineeringEwaste.SCHEMA) {
      return {
        ok: false,
        reason: `This save contains engineering state schema ${String(state.schema || 'unknown')}. The UI will not interpret or overwrite it.`
      };
    }
    return { ok: true, state: state || EngineeringEwaste.peekState(world), initialized: Boolean(state) };
  }

  function missingComponents(state, requirements) {
    const missing = {};
    Object.entries(requirements || {}).forEach(([key, amount]) => {
      const deficit = Math.max(0, Number(amount) - (Number(state.components?.[key]) || 0));
      if (deficit > 0) missing[key] = deficit;
    });
    return missing;
  }

  function lotActionReason(world, state, lot, action) {
    if (action === 'inspect') return lot.inspected ? 'Already inspected.' : null;
    if (!lot.inspected) return 'Inspect first so this stays an informed choice.';
    const bench = EngineeringEwaste.benchStatus(world);
    if (!bench.ok) return bench.reason;
    if (action === 'refurbish') {
      const source = EngineeringEwaste.sourceById(lot.sourceId);
      if (!source) return 'Unknown source class; preserved rather than guessed.';
      if (world.player.money < source.refurbishCost) return `Needs ${Core.formatMoney(source.refurbishCost)} for replacement consumables.`;
    }
    return null;
  }

  function blueprintBuildReason(world, state, blueprint) {
    if (!blueprint.availability.ok) return blueprint.availability.reason;
    const bench = EngineeringEwaste.benchStatus(world);
    if (!bench.ok) return bench.reason;
    const missing = missingComponents(state, blueprint.components);
    if (Object.keys(missing).length) return `Missing ${formatComponents(missing)}.`;
    return null;
  }

  function renderLot(world, state, lot) {
    const inspectReason = lotActionReason(world, state, lot, 'inspect');
    const refurbishReason = lotActionReason(world, state, lot, 'refurbish');
    const dismantleReason = lotActionReason(world, state, lot, 'dismantle');
    const source = EngineeringEwaste.sourceById(lot.sourceId);
    return `
      <article class="engineering-lot">
        <div class="engineering-item-head">
          <div><h4>${escapeHtml(lot.name)}</h4><p>Found ${lot.foundYear} · condition ${Math.round(lot.condition)}%</p></div>
          <span class="pill ${lot.inspected ? 'good' : 'info'}">${lot.inspected ? 'inspected' : 'intact / unknown'}</span>
        </div>
        ${lot.inspected ? `
          <div class="kv-list" style="margin-top:9px">
            <div class="kv-row"><span>Expected reclaimed parts</span><strong>${escapeHtml(formatComponents(lot.expectedComponents))}</strong></div>
            <div class="kv-row"><span>Estimated refurb resale</span><strong>${Core.formatMoney(lot.estimatedResaleValue || 0)}</strong></div>
            <div class="kv-row"><span>Consumables to refurbish</span><strong>${Core.formatMoney(source?.refurbishCost || 0)}</strong></div>
          </div>` : '<div class="engineering-reason">Inspection reveals the choice without destroying the item.</div>'}
        <div class="engineering-actions">
          <button class="button small secondary" data-engineering-action="inspect" data-id="${escapeAttr(lot.id)}" ${inspectReason ? 'disabled' : ''}>Inspect</button>
          <button class="button small primary" data-engineering-action="refurbish" data-id="${escapeAttr(lot.id)}" ${refurbishReason ? 'disabled' : ''}>Refurbish</button>
          <button class="button small ghost" data-engineering-action="dismantle" data-id="${escapeAttr(lot.id)}" ${dismantleReason ? 'disabled' : ''}>Dismantle</button>
        </div>
        ${refurbishReason && lot.inspected ? `<div class="engineering-reason">Refurbish: ${escapeHtml(refurbishReason)}</div>` : ''}
        ${dismantleReason && lot.inspected ? `<div class="engineering-reason">Dismantle: ${escapeHtml(dismantleReason)}</div>` : ''}
        <div class="engineering-provenance">${escapeHtml((lot.provenance || []).join(' → '))}</div>
      </article>`;
  }

  function renderBlueprint(world, state, blueprint) {
    const reason = blueprintBuildReason(world, state, blueprint);
    return `
      <article class="engineering-blueprint">
        <div class="engineering-item-head">
          <div><h4>${escapeHtml(blueprint.name)}</h4><p>${escapeHtml(blueprint.kind)} · introduced ${blueprint.introducedYear} · ${blueprint.hours}h bench time</p></div>
          <span class="pill ${blueprint.availability.ok ? 'good' : 'warning'}">${blueprint.availability.ok ? 'era ready' : blueprint.introducedYear}</span>
        </div>
        <p>${escapeHtml(blueprint.description)}</p>
        <div class="engineering-components">${Object.entries(blueprint.components).map(([key, amount]) => `<span class="engineering-component">${escapeHtml(Core.titleCase(key))} x${amount}</span>`).join('')}</div>
        <div class="engineering-actions">
          <button class="button small primary" data-engineering-action="build" data-id="${escapeAttr(blueprint.id)}" ${reason ? 'disabled' : ''}>Build prototype</button>
        </div>
        ${reason ? `<div class="engineering-reason">${escapeHtml(reason)}</div>` : '<div class="engineering-reason">All requirements are physically present. Building consumes the listed reclaimed components.</div>'}
      </article>`;
  }

  function renderEngineering(world) {
    const status = stateStatus(world);
    const era = HistoricalEra.summary(world);
    if (!status.ok) {
      return `
        <div class="view-title-row"><div><h2>Engineering & Salvage</h2><p>Read-only hold. Unknown future engineering state is preserved exactly rather than guessed.</p></div></div>
        <section class="engineering-held"><h3>Future-schema boundary</h3><p>${escapeHtml(status.reason)}</p><p>No engineering action is enabled and no state is initialized by opening this tab.</p></section>`;
    }

    const state = status.state;
    const summary = EngineeringEwaste.summary(world);
    const bench = EngineeringEwaste.benchStatus(world);
    const blueprints = EngineeringEwaste.availableBlueprints(world);
    const queueFull = state.lots.length >= EngineeringEwaste.MAX_LOTS;
    const componentTotal = Object.values(state.components).reduce((sum, value) => sum + (Number(value) || 0), 0);

    return `
      <div class="view-title-row">
        <div>
          <h2>Engineering & Salvage</h2>
          <p>Find era-appropriate dead electronics, inspect them, then choose: keep them intact, refurbish for side income, dismantle for real parts, or slowly turn those parts into weird little prototypes.</p>
        </div>
        <div class="pill-row">
          <span class="pill info">${era.currentYear} · ${escapeHtml(era.eraLabel)}</span>
          <span class="pill good">Engineering ${Core.round(summary.engineering, 1)}</span>
          <span class="pill ${bench.ok ? 'good' : 'warning'}">${bench.ok ? (bench.mode === 'home_bench' ? 'at home bench' : 'at public workshop') : 'no bench access here'}</span>
        </div>
      </div>

      <div class="engineering-layout">
        <div class="stack">
          <section class="card"><div class="card-inner stack">
            <div class="engineering-section-title"><h3>Workshop display</h3><span class="pill">presentation only</span></div>
            <canvas id="engineeringWorkshopCanvas" class="engineering-workshop-canvas" width="960" height="420" aria-label="Reward-neutral animated display of built engineering prototypes"></canvas>
            <div class="engineering-policy">Bench Blinker pulses, Motor Bug jitters, and Mini Scrap Crawler rolls along a short bounded display path. These animations execute no tasks, earn nothing, create no schedule, and do not mutate the world merely because you watch.</div>
          </div></section>

          <section class="card"><div class="card-inner stack">
            <div class="engineering-section-title">
              <div><h3>Salvage queue</h3><p>${state.lots.length}/${EngineeringEwaste.MAX_LOTS} intact lots · nothing arrives passively</p></div>
              <button class="button small primary" data-engineering-action="collect" ${queueFull ? 'disabled' : ''}>Find e-waste</button>
            </div>
            ${queueFull ? '<div class="callout">The bounded queue is full. That is a capacity limit, not an overdue-cleanup meter.</div>' : ''}
            ${state.lots.length ? state.lots.map((lot) => renderLot(world, state, lot)).join('') : '<div class="engineering-empty">No salvage waiting. Leaving it empty creates no penalty.</div>'}
          </div></section>

          <section class="card"><div class="card-inner stack">
            <div class="engineering-section-title"><div><h3>Blueprint bench</h3><p>Availability follows the historical city and your demonstrated engineering skill.</p></div></div>
            ${blueprints.map((blueprint) => renderBlueprint(world, state, blueprint)).join('')}
          </div></section>
        </div>

        <aside class="stack">
          <section class="card"><div class="card-inner stack">
            <div class="engineering-section-title"><h3>Engineering state</h3><span class="pill ${status.initialized ? 'good' : 'info'}">${status.initialized ? 'initialized by prior action/world start' : 'read-only projection'}</span></div>
            <div class="engineering-summary-grid">
              <div class="engineering-summary-tile"><span>Salvage lots</span><strong>${state.lots.length}/${EngineeringEwaste.MAX_LOTS}</strong></div>
              <div class="engineering-summary-tile"><span>Parts</span><strong>${componentTotal}</strong></div>
              <div class="engineering-summary-tile"><span>Refurb stock</span><strong>${state.refurbished.length}</strong></div>
              <div class="engineering-summary-tile"><span>Prototypes</span><strong>${state.prototypes.length}</strong></div>
            </div>
            <div class="callout">${escapeHtml(bench.ok ? `Physical authority confirmed at ${bench.mode === 'home_bench' ? 'your usable home workbench' : 'the public repair workshop'}.` : bench.reason)}</div>
          </div></section>

          <section class="card"><div class="card-inner stack">
            <div class="engineering-section-title"><h3>Reclaimed components</h3><span class="pill">real stock</span></div>
            <div class="engineering-components">
              ${EngineeringEwaste.COMPONENT_KEYS.map((key) => `<span class="engineering-component">${escapeHtml(Core.titleCase(key))} <strong>x${Number(state.components[key]) || 0}</strong></span>`).join('')}
            </div>
            <div class="engineering-policy">Components enter this stock only through explicit dismantling and leave it when a prototype is actually built.</div>
          </div></section>

          <section class="card"><div class="card-inner stack">
            <div class="engineering-section-title"><h3>Refurbished stock</h3><span class="pill">normal money</span></div>
            ${state.refurbished.length ? state.refurbished.map((stock) => `
              <article class="engineering-stock">
                <div class="engineering-item-head"><div><h4>${escapeHtml(stock.name)}</h4><p>Refurbished ${stock.refurbishedYear}</p></div><strong>${Core.formatMoney(stock.saleValue)}</strong></div>
                <div class="engineering-actions"><button class="button small primary" data-engineering-action="sell" data-id="${escapeAttr(stock.id)}">Sell locally</button></div>
                <div class="engineering-provenance">${escapeHtml((stock.provenance || []).join(' → '))}</div>
              </article>`).join('') : '<div class="engineering-empty">Nothing refurbished for sale. This is optional side income, not a second currency.</div>'}
          </div></section>

          <section class="card"><div class="card-inner stack">
            <div class="engineering-section-title"><h3>Built prototypes</h3><span class="pill ${state.prototypes.some((entry) => entry.kind === 'miniature_robotica') ? 'good' : ''}">${state.prototypes.length}</span></div>
            ${state.prototypes.length ? state.prototypes.slice().reverse().map((prototype) => `
              <article class="engineering-prototype">
                <div class="engineering-item-head"><div><h4>${escapeHtml(prototype.name)}</h4><p>${escapeHtml(prototype.kind)} · built ${prototype.builtYear}</p></div><span class="pill good">non-autonomous</span></div>
                <p>${escapeHtml(prototype.description || '')}</p>
                <div class="engineering-provenance">${escapeHtml((prototype.provenance || []).join(' → '))}</div>
                <div class="engineering-reason">Consumed: ${escapeHtml(formatComponents(prototype.consumedComponents))} · autonomous: false · schedule authority: false</div>
              </article>`).join('') : '<div class="engineering-empty">No prototypes yet. Nothing unlocks itself merely because time passes.</div>'}
          </div></section>
        </aside>
      </div>`;
  }

  function installSystemBridges() {
    const bridges = {
      collectEwaste: ['collectEwaste', 'E-waste lot collected intact.'],
      inspectEwaste: ['inspectEwaste', 'Inspection complete; the choice is now visible.'],
      refurbishEwaste: ['refurbishEwaste', 'Second-life item refurbished.'],
      salvageEwaste: ['salvageEwaste', 'Lot dismantled into reclaimed components.'],
      sellRefurbished: ['sellRefurbished', 'Refurbished item sold through normal world money.'],
      buildPrototype: ['buildPrototype', 'Prototype built from reclaimed components.']
    };
    Object.entries(bridges).forEach(([systemName, [engineeringName, successMessage]]) => {
      if (typeof Systems[systemName] === 'function') return;
      Systems[systemName] = function engineeringSystemBridge(world, ...args) {
        const result = EngineeringEwaste[engineeringName](world, ...args);
        if (result?.ok) Systems.toast(world, successMessage, 'success');
        return result;
      };
    });
  }

  function decorateTabs(world) {
    const nav = UI.app?.querySelector('.tabbar');
    if (!nav) return;
    let button = nav.querySelector('[data-action="tab"][data-id="engineering"]');
    if (!button) {
      // Compatibility fallback for older host UIs. Current Living City owns
      // Engineering in the canonical section registry.
      button = nav.querySelector('[data-action="engineering-tab"]');
      if (!button) {
        button = document.createElement('button');
        button.className = 'tab-button';
        button.id = 'tab-engineering';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', 'active-view');
        button.dataset.action = 'engineering-tab';
        button.dataset.id = 'engineering';
        button.textContent = 'Engineering';
        const anchor = nav.querySelector('[data-action="tab"][data-id="stewardship"]');
        nav.insertBefore(button, anchor || null);
      }
    }
    nav.querySelectorAll('.tab-button').forEach((entry) => {
      const entryId = entry.dataset.id || (entry.dataset.action === 'engineering-tab' ? 'engineering' : null);
      const active = entryId === world.ui.activeTab;
      entry.classList.toggle('active', active);
      if (entry.getAttribute('role') === 'tab') {
        entry.setAttribute('aria-selected', String(active));
        entry.tabIndex = active ? 0 : -1;
      }
    });
  }

  function drawEngineeringCanvas(world, canvas, timestamp, motion) {
    if (!canvas) return;
    const logicalW = EngineeringVisuals.WIDTH;
    const logicalH = EngineeringVisuals.HEIGHT;
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    const desiredW = Math.round(logicalW * dpr);
    const desiredH = Math.round(logicalH * dpr);
    if (canvas.width !== desiredW || canvas.height !== desiredH) {
      canvas.width = desiredW;
      canvas.height = desiredH;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    EngineeringVisuals.draw(ctx, EngineeringVisuals.sceneFor(world), timestamp, { width: logicalW, height: logicalH, motion });
  }

  function cancelEngineeringLoop() {
    if (engineeringFrame) root.cancelAnimationFrame(engineeringFrame);
    engineeringFrame = null;
    engineeringLastDraw = 0;
  }

  function startEngineeringLoop(world) {
    cancelEngineeringLoop();
    const canvas = document.getElementById('engineeringWorkshopCanvas');
    if (!canvas) return;
    const systemReduced = Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const motion = AXM.Visuals?.motionLevel ? AXM.Visuals.motionLevel(world, systemReduced) : (systemReduced ? 'still' : 'full');
    const staticQuery = typeof location !== 'undefined' && new URLSearchParams(location.search).get('static') === '1';
    if (motion === 'still' || staticQuery) {
      drawEngineeringCanvas(world, canvas, 0, 'still');
      return;
    }
    const interval = motion === 'gentle' ? 120 : 42;
    const drawFrame = (timestamp) => {
      const liveCanvas = document.getElementById('engineeringWorkshopCanvas');
      if (Game.world?.ui?.activeTab !== 'engineering' || !liveCanvas) return;
      if (timestamp - engineeringLastDraw >= interval) {
        drawEngineeringCanvas(Game.world, liveCanvas, timestamp, motion);
        engineeringLastDraw = timestamp;
      }
      engineeringFrame = root.requestAnimationFrame(drawFrame);
    };
    engineeringFrame = root.requestAnimationFrame(drawFrame);
  }

  function bindEngineeringEvents() {
    UI.app.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-action="engineering-tab"]');
      if (tab) {
        event.preventDefault();
        Game.setTab('engineering');
        return;
      }
      const button = event.target.closest('[data-engineering-action]');
      if (!button || button.disabled) return;
      event.preventDefault();
      const action = button.dataset.engineeringAction;
      const id = button.dataset.id;
      if (action === 'collect') Game.invoke('collectEwaste');
      else if (action === 'inspect') Game.invoke('inspectEwaste', id);
      else if (action === 'refurbish') Game.invoke('refurbishEwaste', id);
      else if (action === 'dismantle') Game.invoke('salvageEwaste', id);
      else if (action === 'sell') Game.invoke('sellRefurbished', id);
      else if (action === 'build') Game.invoke('buildPrototype', id);
    });
  }

  installStyles();
  installSystemBridges();

  const originalBindEvents = UI.bindEvents;
  UI.bindEvents = function bindEventsWithEngineering(...args) {
    originalBindEvents.apply(this, args);
    bindEngineeringEvents();
  };

  const originalRenderView = UI.renderView;
  UI.renderView = function renderViewWithEngineering(world, ...args) {
    if (world?.ui?.activeTab === 'engineering') return renderEngineering(world);
    return originalRenderView.call(this, world, ...args);
  };

  const originalRender = UI.render;
  UI.render = function renderWithEngineering(world, ...args) {
    cancelEngineeringLoop();
    originalRender.call(this, world, ...args);
    decorateTabs(world);
    if (world?.ui?.activeTab === 'engineering') startEngineeringLoop(world);
  };

  AXM.EngineeringUI = Object.freeze({
    SCHEMA,
    stateStatus,
    missingComponents,
    lotActionReason,
    blueprintBuildReason,
    renderEngineering,
    drawEngineeringCanvas
  });
}(typeof window !== 'undefined' ? window : globalThis));
