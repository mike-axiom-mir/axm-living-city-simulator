(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Game = AXM.Game;
  const CONFLICT_KIND = 'stale-storage';
  let lastAnnouncedConflict = null;
  let started = false;

  function project(game = Game) {
    const conflict = game?.autosaveConflict;
    if (!conflict || conflict.kind !== CONFLICT_KIND) return null;
    const autosaveEnabled = game.world?.settings?.autosave !== false;
    return {
      kind: CONFLICT_KIND,
      autosaveEnabled,
      baselineKnown: conflict.baselineKnown === true,
      title: 'This tab will not overwrite a newer local save.',
      body: autosaveEnabled
        ? 'Another tab or session changed the current local save after this tab last observed it. Living City is still running in memory, but autosave writes are being held so the newer stored world is not silently replaced.'
        : 'Another tab or session changed the current local save after this tab last observed it. This tab is continuing in memory with autosave off, so the newer stored world remains untouched.',
      guidance: 'Nothing has been overwritten. Export this session before reloading if you want to keep its in-memory progress.'
    };
  }

  function panelMarkup(view, announce) {
    return `
      <section
        class="card"
        data-autosave-conflict-panel
        role="${announce ? 'alert' : 'region'}"
        aria-labelledby="autosave-conflict-title"
        style="margin:12px 18px 0;border-color:rgba(214,166,89,.62);background:linear-gradient(180deg,rgba(78,58,31,.96),rgba(36,31,27,.97));box-shadow:0 18px 48px rgba(0,0,0,.34)"
      >
        <div class="card-inner stack">
          <div class="view-title-row" style="margin:0;align-items:center">
            <div>
              <div class="brand-kicker" style="color:#f0c66f">LOCAL SAVE HELD · DISPLAY ≠ STORAGE AUTHORITY</div>
              <h2 id="autosave-conflict-title" style="margin:4px 0 0;font-size:clamp(1.15rem,2.5vw,1.55rem)">${view.title}</h2>
              <p style="margin:7px 0 0;color:var(--muted);max-width:920px;line-height:1.5">${view.body}</p>
            </div>
            <div class="pill-row" aria-label="Autosave conflict state">
              <span class="pill warn">${view.autosaveEnabled ? 'AUTOSAVE HELD' : 'AUTOSAVE OFF'}</span>
              <span class="pill good">IN-MEMORY WORLD INTACT</span>
            </div>
          </div>
          <div class="callout" style="margin-top:2px">${view.guidance}</div>
          <div class="button-grid" style="margin-top:2px">
            <button class="button primary" data-autosave-conflict-action="export">
              <strong>Export this session</strong><span>Keep a readable JSON copy of the world currently open in this tab.</span>
            </button>
            <button class="button secondary" data-autosave-conflict-action="reload">
              <strong>Reload changed local save</strong><span>Leave this in-memory branch and reopen the newer stored world.</span>
            </button>
            ${view.autosaveEnabled ? `
              <button class="button" data-autosave-conflict-action="disable-autosave">
                <strong>Continue with autosave off</strong><span>Keep playing in this tab without repeated write attempts.</span>
              </button>` : `
              <button class="button" disabled>
                <strong>Autosave is off</strong><span>This tab is now memory-only until you explicitly export or reload.</span>
              </button>`}
            <button class="button ghost" data-autosave-conflict-action="open-save-tools">
              <strong>Open save tools</strong><span>Go to Observer Lab without changing either saved world.</span>
            </button>
          </div>
        </div>
      </section>`;
  }

  function render(game = Game) {
    const document = root.document;
    if (!document) return null;
    const shell = document.querySelector('#app .shell');
    if (!shell) return null;

    const existing = shell.querySelector('[data-autosave-conflict-panel]');
    const view = project(game);
    if (!view) {
      existing?.remove();
      lastAnnouncedConflict = null;
      return null;
    }

    existing?.remove();
    const announce = game.autosaveConflict !== lastAnnouncedConflict;
    const holder = document.createElement('div');
    holder.innerHTML = panelMarkup(view, announce).trim();
    const panel = holder.firstElementChild;
    const topbar = shell.querySelector('.topbar');
    if (topbar) topbar.insertAdjacentElement('afterend', panel);
    else shell.prepend(panel);
    if (announce) lastAnnouncedConflict = game.autosaveConflict;
    return panel;
  }

  function onClick(event) {
    const button = event.target.closest?.('[data-autosave-conflict-action]');
    if (!button || button.disabled || !Game?.autosaveConflict) return;
    const action = button.dataset.autosaveConflictAction;

    if (action === 'export') {
      Game.exportWorld();
      return;
    }
    if (action === 'open-save-tools') {
      Game.setTab('lab');
      return;
    }
    if (action === 'disable-autosave') {
      Game.mutate((world) => {
        world.settings.autosave = false;
      }, 'autosave-conflict-disable');
      return;
    }
    if (action === 'reload') {
      const confirmed = typeof root.confirm !== 'function' || root.confirm(
        'Reload the changed local save?\n\nThe world currently open in this tab will be left behind unless you exported it first.'
      );
      if (confirmed) root.location?.reload?.();
    }
  }

  function start() {
    if (started || !root.document || !Game) return;
    started = true;
    Game.subscribe(() => render(Game));
    root.document.addEventListener('click', onClick);
    render(Game);
  }

  AXM.AutosaveConflictUI = {
    CONFLICT_KIND,
    project,
    render,
    start
  };

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start);
    else start();
  }
}(typeof window !== 'undefined' ? window : globalThis));
