(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Game = AXM.Game;
  const Systems = AXM.Systems;
  const OWNED_KINDS = new Set([
    'clear-transaction-held',
    'clear-transaction-pending',
    'clear-transaction-unavailable'
  ]);
  let lastAnnouncedConflict = null;
  let started = false;

  function project(game = Game) {
    const conflict = game?.autosaveConflict;
    if (!conflict || !OWNED_KINDS.has(conflict.kind)) return null;
    const autosaveEnabled = game.world?.settings?.autosave !== false;

    if (conflict.kind === 'clear-transaction-held') {
      return {
        kind: conflict.kind,
        autosaveEnabled,
        fallbackWorld: true,
        canRetry: false,
        status: 'LOCAL SAVE CLEANUP HELD',
        title: 'Local save cleanup needs review.',
        body: 'Living City found an unfamiliar local-save cleanup marker, so it did not load, delete, or overwrite the stored save set. The world open now is an in-memory fallback, not proof that your previous local save was recovered.',
        guidance: 'Stored bytes remain outside this world until you deliberately inspect or repair them. Export this in-memory world if you want to keep anything you do here.',
        tone: 'warn'
      };
    }

    if (conflict.kind === 'clear-transaction-pending') {
      return {
        kind: conflict.kind,
        autosaveEnabled,
        fallbackWorld: true,
        canRetry: true,
        status: 'LOCAL SAVE CLEANUP PENDING',
        title: 'Interrupted local save cleanup can be retried.',
        body: 'A previously admitted local clear could not finish. Save loading and autosave writes remain held, so the open world is an in-memory fallback until cleanup finishes or you leave autosave off.',
        guidance: 'Retry only resumes the already-admitted delete intent. It does not widen the clear, merge worlds, or treat this fallback world as saved truth.',
        tone: 'warn'
      };
    }

    return {
      kind: conflict.kind,
      autosaveEnabled,
      fallbackWorld: false,
      canRetry: false,
      status: 'LOCAL SAVE CLEANUP NOT STARTED',
      title: 'Local save cleanup did not start.',
      body: 'Browser storage refused the delete-intent marker before cleanup began. No cleanup was admitted and no save bytes were intentionally removed by this attempt.',
      guidance: 'Your current in-memory world remains open. Export it if useful, and inspect local save tools before trying another destructive clear.',
      tone: 'warn'
    };
  }

  function panelMarkup(view, announce) {
    const retry = view.canRetry
      ? `<button class="button primary" data-autosave-clear-recovery-action="retry">
          <strong>Retry safe cleanup</strong><span>Resume only the already-admitted local clear, then report whether it actually finished.</span>
        </button>`
      : '';
    const autosaveChoice = view.autosaveEnabled
      ? `<button class="button" data-autosave-clear-recovery-action="disable-autosave">
          <strong>Continue with autosave off</strong><span>Keep this open world memory-only without repeated held writes.</span>
        </button>`
      : `<button class="button" disabled>
          <strong>Autosave is off</strong><span>This world remains memory-only until you explicitly export or resolve local save storage.</span>
        </button>`;

    return `
      <section
        class="card"
        data-autosave-clear-recovery-panel
        role="${announce ? 'alert' : 'region'}"
        aria-labelledby="autosave-clear-recovery-title"
        style="margin:12px 18px 0;border-color:rgba(214,166,89,.68);background:linear-gradient(180deg,rgba(78,58,31,.97),rgba(31,29,27,.98));box-shadow:0 18px 48px rgba(0,0,0,.34)"
      >
        <div class="card-inner stack">
          <div class="view-title-row" style="margin:0;align-items:center">
            <div>
              <div class="brand-kicker" style="color:#f0c66f">${view.status} · DISPLAY ≠ STORAGE AUTHORITY</div>
              <h2 id="autosave-clear-recovery-title" style="margin:4px 0 0;font-size:clamp(1.15rem,2.5vw,1.55rem)">${view.title}</h2>
              <p style="margin:7px 0 0;color:var(--muted);max-width:940px;line-height:1.5">${view.body}</p>
            </div>
            <div class="pill-row" aria-label="Local save cleanup state">
              <span class="pill warn">${view.canRetry ? 'RETRY AVAILABLE' : 'STORAGE HELD'}</span>
              <span class="pill ${view.fallbackWorld ? 'warn' : 'good'}">${view.fallbackWorld ? 'IN-MEMORY FALLBACK' : 'OPEN WORLD INTACT'}</span>
            </div>
          </div>
          <div class="callout" style="margin-top:2px">${view.guidance}</div>
          <div class="button-grid" style="margin-top:2px">
            ${retry}
            <button class="button ${view.canRetry ? 'secondary' : 'primary'}" data-autosave-clear-recovery-action="export">
              <strong>Export this open world</strong><span>Download readable JSON without changing the held local-save bytes.</span>
            </button>
            ${autosaveChoice}
            <button class="button ghost" data-autosave-clear-recovery-action="diagnostic">
              <strong>Download cleanup diagnostic</strong><span>Save the bounded conflict kind and reason without exporting stored save contents.</span>
            </button>
            <button class="button ghost" data-autosave-clear-recovery-action="open-save-tools">
              <strong>Open save tools</strong><span>Go to Observer Lab without claiming that storage has been repaired.</span>
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

    const existing = shell.querySelector('[data-autosave-clear-recovery-panel]');
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

  function downloadDiagnostic() {
    if (!Game?.autosaveConflict || !OWNED_KINDS.has(Game.autosaveConflict.kind)) return;
    const payload = {
      schema: 'axm.living-city.autosave-clear-experience-diagnostic/v1',
      observationOnly: true,
      kind: Game.autosaveConflict.kind,
      reason: Game.autosaveConflict.reason || null,
      key: Game.autosaveConflict.key || null,
      openWorld: Game.world ? {
        seed: Game.world.seed,
        day: Game.world.time?.day ?? null,
        autosaveEnabled: Game.world.settings?.autosave !== false
      } : null,
      claims: {
        storedSaveLoaded: false,
        storageRepaired: false,
        canonAuthority: false
      }
    };
    Game.downloadText('AXM_LIVING_CITY_LOCAL_SAVE_CLEANUP_DIAGNOSTIC.json', JSON.stringify(payload, null, 2), 'application/json');
    Systems?.toast?.(Game.world, 'Local save cleanup diagnostic downloaded. Stored save contents were not included.', 'info');
    Game.emit?.('autosave-clear-diagnostic-export');
  }

  function retryPendingCleanup() {
    if (Game?.autosaveConflict?.kind !== 'clear-transaction-pending') return false;
    let recovered = false;
    try {
      recovered = Boolean(Game.recoverAutosaveClearTransaction(root.localStorage));
    } catch (error) {
      recovered = false;
    }
    if (recovered) {
      Systems?.toast?.(Game.world, 'Interrupted local save cleanup finished. Stored autosave slots are now empty; the current in-memory world remains open.', 'success');
      Game.emit?.('autosave-clear-recovered');
      return true;
    }
    Systems?.toast?.(Game.world, 'Local save cleanup is still held. Stored save loading and overwrite remain blocked.', 'warning');
    Game.emit?.('autosave-clear-retry-held');
    return false;
  }

  function onClick(event) {
    const button = event.target.closest?.('[data-autosave-clear-recovery-action]');
    if (!button || button.disabled || !Game?.autosaveConflict) return;
    const action = button.dataset.autosaveClearRecoveryAction;

    if (action === 'retry') {
      retryPendingCleanup();
      return;
    }
    if (action === 'export') {
      Game.exportWorld();
      return;
    }
    if (action === 'diagnostic') {
      downloadDiagnostic();
      return;
    }
    if (action === 'open-save-tools') {
      Game.setTab('lab');
      return;
    }
    if (action === 'disable-autosave') {
      Game.mutate((world) => {
        world.settings.autosave = false;
      }, 'autosave-clear-recovery-disable');
    }
  }

  function start() {
    if (started || !root.document || !Game) return;
    started = true;
    Game.subscribe(() => render(Game));
    root.document.addEventListener('click', onClick);
    render(Game);
  }

  AXM.AutosaveClearRecoveryUI = {
    OWNED_KINDS,
    project,
    render,
    retryPendingCleanup,
    start
  };

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start);
    else start();
  }
}(typeof window !== 'undefined' ? window : globalThis));
