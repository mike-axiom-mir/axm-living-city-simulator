(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const World = AXM.World;
  const Systems = AXM.Systems;
  const Habitats = AXM.Habitats;
  const Exteriors = AXM.Exteriors;
  const Shells = AXM.Shells;
  const Presence = AXM.Presence;
  const Visuals = AXM.Visuals;

  const STORAGE_KEY = 'axm.living-city-sim.autosave.v0.11.3';
  const LEGACY_STORAGE_KEYS = [
    'axm.living-city-sim.autosave.v0.11.2', 'axm.living-city-sim.autosave.v0.11.1', 'axm.living-city-sim.autosave.v0.11.0', 'axm.living-city-sim.autosave.v0.10.0', 'axm.living-city-sim.autosave.v0.9.0', 'axm.living-city-sim.autosave.v0.8.0','axm.living-city-sim.autosave.v0.7.0','axm.living-city-sim.autosave.v0.6.0', 'axm.living-city-sim.autosave.v0.5.0', 'axm.living-city-sim.autosave.v0.4.0', 'axm.living-city-sim.autosave.v0.3.0', 'axm.living-city-sim.autosave.v0.2.0', 'axm.living-city-sim.autosave.v0.1.0'];
  const CLEAR_TRANSACTION_KEY = 'axm.living-city-sim.autosave.clear-transaction.v1';
  const CLEAR_TRANSACTION_MARKER = 'axm.living-city.autosave-clear-transaction/v1:DELETE_INTENT';

  const Game = {
    world: null,
    listeners: [],
    timer: null,
    initialized: false,
    autosaveBaselineKnown: false,
    autosaveBaseText: null,
    autosaveConflict: null,

    rememberAutosaveBaseline(text) {
      this.autosaveBaselineKnown = true;
      this.autosaveBaseText = text == null ? null : String(text);
      this.autosaveConflict = null;
    },

    inspectAutosaveClearTransaction(storage) {
      const marker = storage.getItem(CLEAR_TRANSACTION_KEY);
      if (marker === null) return { state: 'absent' };
      if (marker !== CLEAR_TRANSACTION_MARKER) return { state: 'held', marker: String(marker) };
      return { state: 'pending' };
    },

    holdAutosaveClearTransaction(reason) {
      this.autosaveConflict = {
        kind: 'clear-transaction-held',
        key: CLEAR_TRANSACTION_KEY,
        reason: String(reason || 'invalid-marker')
      };
      console.warn('Autosave clear transaction held: ' + this.autosaveConflict.reason + '.');
      return false;
    },

    completeAutosaveClearTransaction(storage) {
      let transaction;
      try {
        transaction = this.inspectAutosaveClearTransaction(storage);
      } catch (error) {
        this.autosaveConflict = {
          kind: 'clear-transaction-pending',
          key: CLEAR_TRANSACTION_KEY,
          reason: 'marker-read-failed'
        };
        console.warn('Autosave clear transaction pending: marker could not be read:', error.message);
        return false;
      }
      if (transaction.state === 'absent') return true;
      if (transaction.state === 'held') return this.holdAutosaveClearTransaction('unexpected-marker');
      try {
        for (const key of LEGACY_STORAGE_KEYS) storage.removeItem(key);
        storage.removeItem(STORAGE_KEY);
        storage.removeItem(CLEAR_TRANSACTION_KEY);
        this.rememberAutosaveBaseline(null);
        return true;
      } catch (error) {
        this.autosaveConflict = {
          kind: 'clear-transaction-pending',
          key: CLEAR_TRANSACTION_KEY,
          reason: 'physical-cleanup-failed'
        };
        console.warn('Autosave clear transaction pending: physical cleanup could not complete:', error.message);
        return false;
      }
    },

    recoverAutosaveClearTransaction(storage) {
      return this.completeAutosaveClearTransaction(storage);
    },

    init(options = {}) {
      if (this.initialized) return this.world;
      let world = null;
      const loadAutosave = options.loadAutosave !== false;
      if (loadAutosave) world = this.readAutosave();
      if (!world) world = World.createWorld(options.seed || 'AXM-LIVING-CITY-001');
      this.world = world;
      Habitats?.initializeWorld(this.world, { silent: false });
      AXM.Stewardship?.initializeWorld(this.world, { silent: false });
      AXM.Family?.initializeWorld(this.world, { silent: false });
      AXM.Community?.initializeWorld(this.world, { silent: false });
      AXM.Directions?.initializeWorld(this.world, { silent: false });
      AXM.Economy?.initializeWorld(this.world, { silent: false });
      Exteriors?.initializeWorld(this.world, { silent: false });
      Shells?.initializeWorld(this.world, { silent: false });
      Presence?.initializeWorld(this.world, { silent: false });
      Visuals?.ensureUiState(this.world);
      Systems.updateNpcSchedules(this.world);
      Systems.updateTutorial(this.world);
      this.initialized = true;
      this.emit('init');
      return this.world;
    },

    subscribe(listener) {
      if (typeof listener === 'function' && !this.listeners.includes(listener)) this.listeners.push(listener);
      return () => {
        this.listeners = this.listeners.filter((entry) => entry !== listener);
      };
    },

    emit(reason = 'update') {
      if (!this.world) return;
      this.world.ui.lastRenderReason = reason;
      this.listeners.forEach((listener) => {
        try {
          listener(this.world, reason);
        } catch (error) {
          console.error('AXM UI listener failed:', error);
        }
      });
    },

    invoke(systemName, ...args) {
      const fn = Systems[systemName];
      if (typeof fn !== 'function') {
        Systems.toast(this.world, `Unknown system command: ${systemName}`, 'error');
        this.emit('command-error');
        return { ok: false, reason: 'Unknown command.' };
      }
      let result;
      try {
        result = fn(this.world, ...args);
      } catch (error) {
        console.error(`AXM system ${systemName} failed:`, error);
        result = { ok: false, reason: error.message || 'Command failed.' };
      }
      if (result && result.ok === false && result.reason) Systems.toast(this.world, result.reason, 'warning');
      this.afterMutation(systemName);
      return result;
    },

    mutate(mutator, reason = 'mutation') {
      try {
        mutator(this.world);
        this.afterMutation(reason);
        return { ok: true };
      } catch (error) {
        console.error('AXM mutation failed:', error);
        Systems.toast(this.world, error.message || 'Mutation failed.', 'error');
        this.emit('mutation-error');
        return { ok: false, reason: error.message };
      }
    },

    afterMutation(reason) {
      Systems.updateTutorial(this.world);
      Exteriors?.reconcilePlayerLocation(this.world, reason);
      Presence?.reconcilePlayerPresence(this.world, reason);
      if (this.world.settings.autosave) this.writeAutosave();
      this.emit(reason);
    },

    setTab(tabId) {
      this.world.ui.activeTab = tabId;
      this.emit('tab');
    },

    selectPlace(placeId) {
      Systems.inspectPlace(this.world, placeId);
      this.afterMutation('select-place');
    },

    viewProperty(propertyId) {
      const property = World.getProperty(this.world, propertyId);
      if (!property) {
        Systems.toast(this.world, 'That residential interior is unavailable.', 'warning');
        this.emit('view-property-error');
        return false;
      }
      this.world.ui.viewPropertyId = property.id;
      this.world.ui.selectedPlaceId = property.id;
      this.world.ui.selectedObjectId = property.furniture[0]?.id || null;
      this.world.ui.selectedRoomId = property.habitat?.rooms?.[0]?.id || null;
      this.world.ui.selectedHabitatEdgeKey = Habitats?.listEdges(property)?.[0]?.key || null;
      this.world.ui.activeTab = 'home';
      this.emit('view-property');
      return true;
    },

    selectPerson(personId) {
      this.world.ui.selectedPersonId = personId;
      this.emit('select-person');
    },

    selectObject(objectId) {
      this.world.ui.selectedObjectId = objectId;
      this.emit('select-object');
    },

    selectRoom(roomId) {
      this.world.ui.selectedRoomId = roomId;
      this.emit('select-room');
    },

    selectHabitatEdge(edgeKey) {
      this.world.ui.selectedHabitatEdgeKey = edgeKey;
      this.emit('select-habitat-edge');
    },

    selectHabitatProject(projectId) {
      this.world.ui.selectedHabitatProjectId = projectId;
      this.emit('select-habitat-project');
    },

    setSuggestionColor(colorId) {
      this.world.ui.selectedSuggestionColor = colorId;
      this.emit('select-color');
    },

    setLedgerFilter(filter) {
      this.world.ui.ledgerFilter = filter;
      this.emit('ledger-filter');
    },

    clearToast() {
      if (this.world?.ui) this.world.ui.toast = null;
      this.emit('toast-clear');
    },

    newWorld(seed) {
      this.stopTimer();
      this.world = World.createWorld(String(seed || 'AXM-LIVING-CITY-001').trim() || 'AXM-LIVING-CITY-001');
      Habitats?.initializeWorld(this.world, { silent: false });
      AXM.Stewardship?.initializeWorld(this.world, { silent: false });
      AXM.Family?.initializeWorld(this.world, { silent: false });
      AXM.Community?.initializeWorld(this.world, { silent: false, newWorld: true });
      AXM.Directions?.initializeWorld(this.world, { silent: false, newWorld: true });
      AXM.Economy?.initializeWorld(this.world, { silent: false, newWorld: true });
      Exteriors?.initializeWorld(this.world, { silent: false, newWorld: true });
      Shells?.initializeWorld(this.world, { silent: false, newWorld: true });
      Presence?.initializeWorld(this.world, { silent: false, newWorld: true });
      Visuals?.ensureUiState(this.world);
      Systems.updateNpcSchedules(this.world);
      Systems.updateTutorial(this.world);
      this.writeAutosave();
      this.emit('new-world');
      return this.world;
    },

    writeAutosave() {
      if (!this.world) return false;
      try {
        const storage = root.localStorage;
        if (!storage) return false;
        if (!this.recoverAutosaveClearTransaction(storage)) return false;
        const observed = storage.getItem(STORAGE_KEY);
        const staleObservedBaseline = this.autosaveBaselineKnown
          ? observed !== this.autosaveBaseText
          : observed !== null;
        if (staleObservedBaseline) {
          this.autosaveConflict = {
            kind: 'stale-storage',
            key: STORAGE_KEY,
            baselineKnown: this.autosaveBaselineKnown
          };
          console.warn('Autosave refused: current local save changed since this session last observed it.');
          return false;
        }
        const serialized = Core.serializeWorld(this.world);
        storage.setItem(STORAGE_KEY, serialized);
        this.rememberAutosaveBaseline(serialized);
        return true;
      } catch (error) {
        console.warn('Autosave unavailable:', error.message);
        return false;
      }
    },

    readAutosave() {
      const candidates = [STORAGE_KEY].concat(LEGACY_STORAGE_KEYS);
      this.autosaveBaselineKnown = false;
      this.autosaveBaseText = null;
      this.autosaveConflict = null;
      let currentObserved = null;
      let currentObservedKnown = false;
      try {
        const storage = root.localStorage;
        if (!storage) return null;
        if (!this.recoverAutosaveClearTransaction(storage)) return null;
        for (const key of candidates) {
          const text = storage.getItem(key);
          if (key === STORAGE_KEY) {
            currentObserved = text == null ? null : String(text);
            currentObservedKnown = true;
          }
          if (!text) continue;
          try {
            const parsed = Core.parseWorld(text);
            const sourceSchema = parsed.schema;
            const world = Systems.migrateWorld(parsed);
            const validation = Systems.validateWorld(world);
            if (!validation.ok) {
              console.warn(`Autosave ${key} rejected due to invariant errors:`, validation.errors);
              continue;
            }
            if (sourceSchema !== Core.SCHEMA) {
              const promoted = Core.serializeWorld(world);
              storage.setItem(STORAGE_KEY, promoted);
              this.rememberAutosaveBaseline(promoted);
            } else if (key === STORAGE_KEY) {
              this.rememberAutosaveBaseline(text);
            } else {
              const promoted = Core.serializeWorld(world);
              storage.setItem(STORAGE_KEY, promoted);
              this.rememberAutosaveBaseline(promoted);
            }
            return world;
          } catch (error) {
            console.warn(`Autosave ${key} rejected:`, error.message);
          }
        }
        if (currentObservedKnown) this.rememberAutosaveBaseline(currentObserved);
        return null;
      } catch (error) {
        console.warn('Autosave storage unavailable:', error.message);
        return null;
      }
    },

    clearAutosave() {
      try {
        const storage = root.localStorage;
        if (!storage) return false;
        const transaction = this.inspectAutosaveClearTransaction(storage);
        if (transaction.state === 'held') {
          return this.holdAutosaveClearTransaction('unexpected-marker');
        }
        if (transaction.state === 'pending') {
          if (!this.completeAutosaveClearTransaction(storage)) {
            Systems.toast(this.world, 'Local autosave clear is pending because browser storage interrupted cleanup. Save loading and overwrite remain held until cleanup can resume.', 'warning');
            this.emit('autosave-clear-pending');
            return false;
          }
          Systems.toast(this.world, 'Local autosave cleared. Current in-memory world remains open.', 'info');
          this.emit('autosave-clear');
          return true;
        }
        const observed = storage.getItem(STORAGE_KEY);
        const staleObservedBaseline = this.autosaveBaselineKnown
          ? observed !== this.autosaveBaseText
          : observed !== null;
        if (staleObservedBaseline) {
          this.autosaveConflict = {
            kind: 'stale-storage',
            key: STORAGE_KEY,
            baselineKnown: this.autosaveBaselineKnown
          };
          console.warn('Autosave clear refused: current local save changed since this session last observed it.');
          Systems.toast(this.world, 'Local autosave was not cleared because the stored save changed in another session. Current in-memory world remains open.', 'warning');
          this.emit('autosave-clear-refused');
          return false;
        }
        try {
          storage.setItem(CLEAR_TRANSACTION_KEY, CLEAR_TRANSACTION_MARKER);
        } catch (error) {
          this.autosaveConflict = {
            kind: 'clear-transaction-unavailable',
            key: CLEAR_TRANSACTION_KEY,
            reason: 'intent-write-failed'
          };
          console.warn('Could not begin autosave clear transaction:', error.message);
          return false;
        }
        if (!this.completeAutosaveClearTransaction(storage)) {
          Systems.toast(this.world, 'Local autosave clear is pending because browser storage interrupted cleanup. Save loading and overwrite remain held until cleanup can resume.', 'warning');
          this.emit('autosave-clear-pending');
          return false;
        }
      } catch (error) {
        console.warn('Could not clear autosave:', error.message);
        return false;
      }
      Systems.toast(this.world, 'Local autosave cleared. Current in-memory world remains open.', 'info');
      this.emit('autosave-clear');
      return true;
    },

    downloadText(filename, text, mime = 'text/plain') {
      const blob = new Blob([text], { type: `${mime};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    exportWorld() {
      const filename = `AXM_LIVING_CITY_${this.world.seed.replace(/[^a-z0-9_-]+/gi, '_')}_DAY_${this.world.time.day}.json`;
      this.downloadText(filename, Core.serializeWorld(this.world), 'application/json');
      Systems.toast(this.world, 'World state exported as readable JSON.', 'success');
      this.emit('export-world');
    },

    exportLedger() {
      const lines = [
        '# AXM Living City — World Ledger',
        `Seed: ${this.world.seed}`,
        `Exported simulation time: ${Core.formatDateTime(this.world)}`,
        '',
        ...this.world.ledger.map((entry) => {
          const time = `Day ${entry.day}, ${String(entry.hour).padStart(2, '0')}:${String(entry.minute || 0).padStart(2, '0')}`;
          const causes = entry.causes?.length ? ` | causes: ${entry.causes.join('; ')}` : '';
          return `[${time}] [${entry.type}] ${entry.message}${causes}`;
        })
      ];
      this.downloadText(`AXM_LIVING_CITY_LEDGER_DAY_${this.world.time.day}.txt`, lines.join('\n'));
      Systems.toast(this.world, 'Append-only world ledger exported.', 'success');
      this.emit('export-ledger');
    },

    importWorldText(text) {
      try {
        const world = Systems.migrateWorld(Core.parseWorld(text));
        const validation = Systems.validateWorld(world);
        if (!validation.ok) throw new Error(`Imported world has invariant errors: ${validation.errors.join(' | ')}`);
        this.stopTimer();
        this.world = world;
        Habitats?.initializeWorld(this.world, { silent: false });
        AXM.Stewardship?.initializeWorld(this.world, { silent: false });
        AXM.Family?.initializeWorld(this.world, { silent: false });
        AXM.Community?.initializeWorld(this.world, { silent: false });
        AXM.Directions?.initializeWorld(this.world, { silent: false });
        AXM.Economy?.initializeWorld(this.world, { silent: false });
        Exteriors?.initializeWorld(this.world, { silent: false });
        Shells?.initializeWorld(this.world, { silent: false });
        Presence?.initializeWorld(this.world, { silent: false });
        Visuals?.ensureUiState(this.world);
        Systems.updateNpcSchedules(this.world);
        Presence?.reconcileAll(this.world, 'imported world schedule');
        Systems.updateTutorial(this.world);
        this.writeAutosave();
        this.emit('import-world');
        return { ok: true };
      } catch (error) {
        Systems.toast(this.world, error.message || 'Import failed.', 'error');
        this.emit('import-error');
        return { ok: false, reason: error.message };
      }
    },

    importWorldFile(file) {
      if (!file) return Promise.resolve({ ok: false, reason: 'No file selected.' });
      return file.text().then((text) => this.importWorldText(text));
    },

    setSpeed(hoursPerPulse) {
      const speed = [0, 1, 6, 24].includes(Number(hoursPerPulse)) ? Number(hoursPerPulse) : 0;
      this.stopTimer();
      this.world.settings.simulationSpeed = speed;
      if (speed > 0) {
        this.timer = setInterval(() => {
          Systems.advanceHours(this.world, speed);
          this.afterMutation(`autoplay-${speed}`);
        }, speed === 1 ? 1400 : speed === 6 ? 1100 : 900);
      }
      this.emit('speed');
    },

    stopTimer() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      if (this.world?.settings) this.world.settings.simulationSpeed = 0;
    },

    toggleAutosave(enabled) {
      this.world.settings.autosave = Boolean(enabled);
      if (enabled) this.writeAutosave();
      this.emit('autosave-setting');
    }
  };

  AXM.Game = Game;
}(typeof window !== 'undefined' ? window : globalThis));
