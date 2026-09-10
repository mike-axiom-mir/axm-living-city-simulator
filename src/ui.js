(function (root) {
  'use strict';

  const AXM = root.AXM;
  const Core = AXM.Core;
  const Content = AXM.Content;
  const World = AXM.World;
  const Systems = AXM.Systems;
  const Households = AXM.Households;
  const Habitats = AXM.Habitats;
  const Stewardship = AXM.Stewardship;
  const Family = AXM.Family;
  const Community = AXM.Community;
  const Directions = AXM.Directions;
  const Economy = AXM.Economy;
  const Exteriors = AXM.Exteriors;
  const Shells = AXM.Shells;
  const Presence = AXM.Presence;
  const Visuals = AXM.Visuals;
  const Game = AXM.Game;

  const TABS = [
    { id: 'town', label: 'Town' },
    { id: 'street', label: 'Street Life' },
    { id: 'buildings', label: 'Buildings' },
    { id: 'presence', label: 'Lived Buildings' },
    { id: 'visuals', label: 'Living View' },
    { id: 'life', label: 'One Life' },
    { id: 'home', label: 'Build & Home' },
    { id: 'people', label: 'People' },
    { id: 'agreements', label: 'Agreements' },
    { id: 'family', label: 'Family' },
    { id: 'community', label: 'Community' },
    { id: 'directions', label: 'Directions' },
    { id: 'economy', label: 'Local Economy' },
    { id: 'stewardship', label: 'Stewardship' },
    { id: 'work', label: 'Workday' },
    { id: 'housing', label: 'Housing' },
    { id: 'ledger', label: 'World Ledger' },
    { id: 'lab', label: 'Observer Lab' }
  ];

  const UI = {
    app: null,
    mapHitboxes: [],
    mapFrame: null,
    mapLastDraw: 0,
    livingFrame: null,
    livingLastDraw: 0,
    toastTimer: null,
    pendingFocusKey: null,

    init() {
      this.app = document.getElementById('app');
      if (!this.app) throw new Error('Missing #app root.');
      this.bindEvents();
      root.addEventListener?.('resize', () => this.syncStickyOffset());
      Game.subscribe((world, reason) => this.render(world, reason));
      Game.init({ loadAutosave: true });
    },

    render(world, reason = 'update') {
      const interaction = this.captureInteractionState();
      if (this.pendingFocusKey) interaction.focusKey = this.pendingFocusKey;
      this.pendingFocusKey = null;
      this.cancelMapLoop();
      this.cancelLivingLoop();
      this.app.innerHTML = this.renderShell(world);
      this.syncStickyOffset();
      if (['town', 'street'].includes(world.ui.activeTab)) this.startMapLoop(world);
      if (world.ui.activeTab === 'visuals') this.startLivingLoop(world);
      requestAnimationFrame(() => this.restoreInteractionState(interaction, reason));
      this.scheduleToast(world);
    },

    renderShell(world) {
      return `
        <div class="shell">
          ${this.renderHeader(world)}
          ${this.renderTabs(world)}
          <main class="view" id="active-view" role="tabpanel" aria-labelledby="tab-${escapeAttr(world.ui.activeTab)}">${this.renderView(world)}</main>
          <div class="footer-note">
            Local-first casual-realism prototype · no network calls · deterministic seed · readable JSON export · animated views are derived atmosphere, never authority or reward · no daily streaks or expiry punishment · community life, personal projects, local enterprise, visible street travel, resident-shaped buildings, and lawful lived-building presence offer possibilities rather than duties · walking and indoor routes can always be compressed · greetings are optional · private rooms are not remotely exposed · business is optional and closure is not failure · age is context, never a countdown · adult household, family-care, community, and property authority remain separate · people remain autonomous · objects are never silently erased.
          </div>
          ${this.renderToast(world)}
        </div>
      `;
    },

    renderHeader(world) {
      const needNames = { energy: 'Energy', hunger: 'Food', hygiene: 'Clean', mood: 'Mood', social: 'Social' };
      const needs = Systems.NEED_KEYS.map((key) => {
        const value = Math.round(world.player.needs[key]);
        const color = value < 25 ? '#d47974' : value < 50 ? '#d6a659' : '#76c69a';
        return `
          <div class="need-chip" title="${needNames[key]}: ${value}/100">
            <div class="need-chip-head"><span>${needNames[key]}</span><span>${value}</span></div>
            <div class="meter"><span style="--value:${value}%;--meter-color:${color}"></span></div>
          </div>`;
      }).join('');
      const speed = world.settings.simulationSpeed || 0;
      return `
        <header class="topbar">
          <div class="brand-block">
            <div class="brand-kicker">AXM experimental foundation · v${Core.VERSION}</div>
            <h1 class="brand-title">Living City — One Life</h1>
            <div class="brand-subtitle">Be yourself. Find your adventure. Don’t make others smaller. Grow in your own way.</div>
          </div>
          <div class="status-strip">${needs}</div>
          <div class="top-actions">
            <span class="time-badge">${Core.formatDateTime(world)}</span>
            <span class="money-badge">${Core.formatMoney(world.player.money)}</span>
            <span class="seed-badge" title="Seed: ${escapeHtml(world.seed)}">Seed: ${escapeHtml(world.seed)}</span>
            <div class="speed-controls" aria-label="Simulation speed">
              ${[[0, 'II'], [1, '1h'], [6, '6h'], [24, '1d']].map(([value, label]) => `<button class="speed-button ${speed === value ? 'active' : ''}" data-action="speed" data-value="${value}" title="${value === 0 ? 'Pause automatic time' : `Advance ${value} hour${value === 1 ? '' : 's'} per pulse`}">${label}</button>`).join('')}
            </div>
          </div>
        </header>
      `;
    },

    renderTabs(world) {
      const stewardship = Stewardship.metrics(world);
      const family = Family.metrics(world);
      const community = Community.metrics(world);
      const directions = Directions.metrics(world);
      const economy = Economy.metrics(world);
      const shells = Shells.metrics(world);
      const presence = Presence.metrics(world);
      const activeIndex = Math.max(0, TABS.findIndex((tab) => tab.id === world.ui.activeTab));
      return `<div class="view-switcher">
        <button class="view-step" data-action="tab-relative" data-direction="-1" aria-label="Previous section" title="Previous section (Left arrow)">‹</button>
        <nav class="tabbar" role="tablist" aria-label="Simulation sections">
          ${TABS.map((tab) => {
            const active = world.ui.activeTab === tab.id;
            return `<button class="tab-button ${active ? 'active' : ''}" id="tab-${tab.id}" role="tab" aria-selected="${active}" aria-controls="active-view" tabindex="${active ? '0' : '-1'}" data-action="tab" data-id="${tab.id}">${tab.label}${tab.id === 'work' && world.activeShift ? ' · active' : ''}${tab.id === 'buildings' && shells.pendingPlayerRequests ? ` · ${shells.pendingPlayerRequests}` : ''}${tab.id === 'presence' && presence.activeIndoorMovement ? ' · moving' : tab.id === 'presence' && presence.encountersAwaiting ? ` · ${presence.encountersAwaiting}` : ''}${tab.id === 'family' && family.pendingPlayerProposals ? ` · ${family.pendingPlayerProposals}` : ''}${tab.id === 'community' && community.awaitingPlayer ? ` · ${community.awaitingPlayer}` : ''}${tab.id === 'directions' && directions.pendingCollaborations ? ` · ${directions.pendingCollaborations}` : ''}${tab.id === 'economy' && economy.activeSession ? ' · active' : tab.id === 'economy' && economy.pendingWorkOffers ? ` · ${economy.pendingWorkOffers}` : ''}${tab.id === 'stewardship' && stewardship.pendingPlayerRequests ? ` · ${stewardship.pendingPlayerRequests}` : ''}</button>`;
          }).join('')}
        </nav>
        <span class="view-position" aria-label="Section ${activeIndex + 1} of ${TABS.length}">${activeIndex + 1}<i>/</i>${TABS.length}</span>
        <button class="view-step" data-action="tab-relative" data-direction="1" aria-label="Next section" title="Next section (Right arrow)">›</button>
      </div>`;
    },

    navigationTarget(currentId, key) {
      const index = Math.max(0, TABS.findIndex((tab) => tab.id === currentId));
      if (key === 'Home') return TABS[0].id;
      if (key === 'End') return TABS[TABS.length - 1].id;
      if (key === 'ArrowRight') return TABS[(index + 1) % TABS.length].id;
      if (key === 'ArrowLeft') return TABS[(index - 1 + TABS.length) % TABS.length].id;
      return null;
    },

    activateTab(tabId, focusTab = true) {
      if (!TABS.some((tab) => tab.id === tabId)) return;
      if (focusTab) this.pendingFocusKey = `tab:${tabId}`;
      Game.setTab(tabId);
    },

    interactionKey(element) {
      if (!element || element === document.body) return null;
      if (element.classList?.contains('tab-button') && element.dataset.id) return `tab:${element.dataset.id}`;
      if (element.id) return `id:${element.id}`;
      if (!element.dataset?.action) return null;
      return ['action', 'id', 'value', 'axis', 'kind', 'variant', 'response', 'direction']
        .map((key) => `${key}:${element.dataset[key] || ''}`)
        .join('|');
    },

    findInteraction(key) {
      if (!key) return null;
      return Array.from(this.app.querySelectorAll('button, input, select, textarea, [tabindex]'))
        .find((element) => this.interactionKey(element) === key) || null;
    },

    captureInteractionState() {
      const active = document.activeElement;
      const tabbar = this.app?.querySelector('.tabbar');
      const state = {
        focusKey: this.app?.contains(active) ? this.interactionKey(active) : null,
        tabScrollLeft: tabbar?.scrollLeft || 0,
        draft: null
      };
      if (state.focusKey && active?.matches?.('input, textarea, select')) {
        state.draft = {
          value: active.value,
          selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
          selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null
        };
      }
      return state;
    },

    restoreInteractionState(state, reason) {
      const tabbar = this.app.querySelector('.tabbar');
      if (tabbar && Number.isFinite(state?.tabScrollLeft)) tabbar.scrollLeft = state.tabScrollLeft;
      if (reason === 'tab') {
        this.app.querySelector('#active-view')?.scrollIntoView({ block: 'start' });
      }
      const target = this.findInteraction(state?.focusKey);
      if (target) {
        if (state.draft && target.matches('input, textarea, select')) {
          target.value = state.draft.value;
          if (state.draft.selectionStart != null && target.setSelectionRange) {
            target.setSelectionRange(state.draft.selectionStart, state.draft.selectionEnd);
          }
        }
        target.focus({ preventScroll: true });
        if (target.classList.contains('tab-button')) target.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
        return;
      }
      if (reason === 'init' || reason === 'tab') {
        this.app.querySelector('.tab-button.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
      }
    },

    syncStickyOffset() {
      const topbar = this.app?.querySelector('.topbar');
      const compact = root.matchMedia?.('(max-width: 720px)').matches;
      this.app?.style.setProperty('--topbar-height', `${compact ? 0 : Math.ceil(topbar?.getBoundingClientRect().height || 0)}px`);
    },

    renderView(world) {
      switch (world.ui.activeTab) {
        case 'town': return this.renderTown(world);
        case 'street': return this.renderStreet(world);
        case 'buildings': return this.renderBuildings(world);
        case 'presence': return this.renderLivedBuildings(world);
        case 'visuals': return this.renderLivingVisuals(world);
        case 'life': return this.renderLife(world);
        case 'home': return this.renderHome(world);
        case 'people': return this.renderPeople(world);
        case 'agreements': return this.renderAgreements(world);
        case 'family': return this.renderFamily(world);
        case 'community': return this.renderCommunity(world);
        case 'directions': return this.renderDirections(world);
        case 'economy': return this.renderEconomy(world);
        case 'stewardship': return this.renderStewardship(world);
        case 'work': return this.renderWork(world);
        case 'housing': return this.renderHousing(world);
        case 'ledger': return this.renderLedger(world);
        case 'lab': return this.renderLab(world);
        default: return this.renderTown(world);
      }
    },

    renderTown(world) {
      const selected = World.getPlace(world, world.ui.selectedPlaceId) || World.getPlace(world, 'home_student');
      return `
        <div class="view-title-row">
          <div>
            <h2>A neighborhood that is already occupied</h2>
            <p>Homes are not level-select buttons. Residents work, visit places, decorate, pay rent, and sometimes move for explainable reasons. Select any building to inspect it, or open Street Life to follow the connected routes between addresses.</p><button class="button small secondary" data-action="open-street">Open walkable street view</button>
          </div>
          <div class="pill-row">
            <span class="pill info">${world.people.length + 1} residents</span>
            <span class="pill good">${Systems.computeMetrics(world).occupiedProperties}/${Systems.computeMetrics(world).residentialProperties} homes occupied</span>
            <span class="pill">Day ${world.time.day}</span>
          </div>
        </div>
        <div class="split">
          <section class="card map-shell">
            <canvas id="townCanvas" class="town-canvas" width="960" height="650" aria-label="Interactive low-graphic town map"></canvas>
            <div class="map-legend">
              <span><i class="legend-dot" style="background:#82b79a"></i>You</span>
              <span><i class="legend-dot" style="background:#e9edf0"></i>Autonomous resident</span>
              <span><i class="legend-dot" style="background:#d0a85b"></i>Vacancy</span>
              <span><i class="legend-dot" style="background:#9b8fc0"></i>Selected place</span>
            </div>
          </section>
          <aside class="stack">
            ${this.renderPlaceInspector(world, selected)}
            ${this.renderNearbyActivity(world, selected)}
          </aside>
        </div>
      `;
    },

    renderStreet(world) {
      const selected = World.getPlace(world, world.ui.selectedPlaceId) || World.getPlace(world, world.player.locationId) || world.places[0];
      const current = World.getPlace(world, world.player.locationId);
      const metrics = Exteriors.metrics(world);
      const activeRecord = world.activeTravel ? Exteriors.recordById(world, world.activeTravel.recordId) : null;
      const preview = selected ? Exteriors.previewRoute(world, selected.id) : null;
      const recentRoutes = (world.travelRecords || []).filter((entry) => entry.status !== 'active').slice(-10).reverse();
      const moments = (world.streetMoments || []).slice(-6).reverse();
      const remainingMinutes = activeRecord
        ? activeRecord.route.edgeIds.slice(activeRecord.currentNodeIndex).reduce((sum, edgeId) => sum + (Exteriors.networkEdge(world, edgeId)?.durationMinutes || 0), 0)
        : 0;
      const progress = activeRecord ? Math.round(activeRecord.currentNodeIndex / Math.max(1, activeRecord.route.nodeIds.length - 1) * 100) : 0;
      return `
        <div class="view-title-row">
          <div>
            <h2>Walkable places with their own exterior identity</h2>
            <p>Addresses, doors, windows, signs, frontages, and routes now persist in the same deterministic town. Walking visibly and compressing the exact same route use the same minutes and need cost; neither is the correct way to play.</p>
          </div>
          <div class="pill-row">
            <span class="pill good">${metrics.addresses} addresses</span>
            <span class="pill info">${metrics.networkEdges} route segments</span>
            <span class="pill">${Math.round(metrics.playerDistanceMeters)} m walked</span>
            <span class="pill ${metrics.walkingObligation ? 'warning' : 'good'}">No walking obligation</span>
          </div>
        </div>
        <div class="split street-split">
          <section class="card map-shell">
            <canvas id="streetCanvas" class="town-canvas" width="960" height="650" aria-label="Walkable low-graphic street map with façades and routes"></canvas>
            <div class="map-legend">
              <span><i class="legend-dot" style="background:#82b79a"></i>You / active route</span>
              <span><i class="legend-dot" style="background:#d7c89d"></i>Walkable streets</span>
              <span><i class="legend-dot" style="background:#a99bd2"></i>Planned route</span>
              <span><i class="legend-dot" style="background:#edf2f4"></i>Resident movement</span>
            </div>
          </section>
          <aside class="stack">
            ${activeRecord ? `
              <section class="card"><div class="card-inner stack">
                <div class="proposal-head"><div><h3>Visible route in progress</h3><p>${escapeHtml(World.getPlace(world, activeRecord.originPlaceId)?.name || activeRecord.originPlaceId)} → ${escapeHtml(World.getPlace(world, activeRecord.intendedDestinationPlaceId)?.name || activeRecord.intendedDestinationPlaceId)}</p></div><span class="pill info">${remainingMinutes} min remain</span></div>
                <div class="meter"><span style="--value:${progress}%"></span></div>
                <div class="kv-list">
                  <div class="kv-row"><span>Streets</span><strong>${escapeHtml(activeRecord.route.streetNames.join(' → ') || 'Local frontage')}</strong></div>
                  <div class="kv-row"><span>Elapsed</span><strong>${activeRecord.elapsedMinutes} minutes</strong></div>
                  <div class="kv-row"><span>Total route</span><strong>${activeRecord.route.distanceMeters} m · ${activeRecord.route.durationMinutes} min</strong></div>
                </div>
                <div class="button-grid">
                  <button class="button primary" data-action="step-player-travel">Walk next stretch</button>
                  <button class="button secondary" data-action="finish-player-travel">Finish remaining route compressed</button>
                  <button class="button ghost" data-action="end-player-travel-early">End at nearest route end</button>
                </div>
                <div class="callout">Visible walking adds observations, not superior rewards. Finishing compressed preserves the same remaining time and physical cost.</div>
              </div></section>` : `
              <section class="card"><div class="card-inner stack">
                <div class="proposal-head"><div><h3>Plan a route</h3><p>Currently at ${escapeHtml(current?.name || world.player.locationId)}.</p></div><span class="pill">${Core.formatClock(world)}</span></div>
                ${selected ? this.renderExteriorIdentity(world, selected) : '<div class="empty-state">Select a place on the map.</div>'}
                ${preview && selected.id !== world.player.locationId ? `
                  <div class="kv-list">
                    <div class="kv-row"><span>Route</span><strong>${escapeHtml(preview.streetNames.join(' → ') || 'Local frontage')}</strong></div>
                    <div class="kv-row"><span>Distance</span><strong>${preview.distanceMeters} m</strong></div>
                    <div class="kv-row"><span>Time</span><strong>${preview.durationMinutes} minutes</strong></div>
                  </div>
                  <div class="button-grid">
                    <button class="button primary" data-action="start-visible-travel" data-id="${escapeAttr(selected.id)}">Walk visibly</button>
                    <button class="button secondary" data-action="start-compressed-travel" data-id="${escapeAttr(selected.id)}">Travel compressed</button>
                  </div>
                  <div class="callout">Both choices advance ${preview.durationMinutes} minutes and apply the same need effects. Compression removes watching, not reality.</div>` : `<div class="callout">${selected?.id === world.player.locationId ? 'You are already here. Select another address to preview a route.' : 'No connected route is available.'}</div>`}
              </div></section>`}
            <section class="card"><div class="card-inner stack">
              <div class="proposal-head"><div><h3>Recent resident routes</h3><p>Hourly autonomy now leaves route evidence instead of only changing a location pointer.</p></div><span class="pill info">${metrics.recentNpcRoutes} recent</span></div>
              ${recentRoutes.length ? `<div class="history-list">${recentRoutes.map((record) => {
                const actor = World.getPerson(world, record.actorId);
                const from = World.getPlace(world, record.originPlaceId);
                const to = World.getPlace(world, record.destinationPlaceId);
                return `<div class="history-entry"><strong>${escapeHtml(actor?.name || (record.actorId === 'player' ? world.player.name : record.actorId))}</strong><span>${escapeHtml(from?.name || record.originPlaceId)} → ${escapeHtml(to?.name || record.destinationPlaceId)} · ${record.route.durationMinutes} min · ${escapeHtml(Core.titleCase(record.mode))}</span></div>`;
              }).join('')}</div>` : '<div class="empty-state">Movement evidence will appear as simulated time passes.</div>'}
            </div></section>
            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Street moments <small>observation, never forced interaction</small></h3>
              ${moments.length ? `<div class="history-list">${moments.map((moment) => `<div class="history-entry"><strong>${escapeHtml(moment.streetName || 'Neighborhood')}</strong><span>${escapeHtml(moment.text)}</span></div>`).join('')}</div>` : '<div class="empty-state">Walk one visible stretch to notice the street without turning it into a checklist.</div>'}
            </div></section>
          </aside>
        </div>
      `;
    },

    renderExteriorIdentity(world, place) {
      const exterior = place.exterior;
      if (!exterior) return '<div class="empty-state">This place has no exterior record.</div>';
      const occupancy = place.kind === 'residential'
        ? `${place.tenants.length}/${place.capacity} residents`
        : place.kind === 'commercial'
          ? (place.listedForLease ? 'Vacant commercial room' : 'Occupied commercial room')
          : 'Public or working place';
      return `
        <div class="exterior-identity">
          <div class="place-heading">
            <div class="place-swatch exterior-door" style="background:${escapeAttr(exterior.entrance.doorColor)}">${escapeHtml(String(exterior.address.number))}</div>
            <div><h3>${escapeHtml(place.name)}</h3><p>${escapeHtml(exterior.address.label)}</p></div>
          </div>
          <div class="pill-row"><span class="pill info">${escapeHtml(exterior.facade.frontageType)}</span><span class="pill">${escapeHtml(occupancy)}</span></div>
          <div class="kv-list">
            <div class="kv-row"><span>Façade</span><strong>${escapeHtml(exterior.facade.material)}</strong></div>
            <div class="kv-row"><span>Windows</span><strong>${exterior.facade.windowCount} · ${escapeHtml(exterior.facade.windowStyle)}</strong></div>
            <div class="kv-row"><span>Roofline</span><strong>${escapeHtml(exterior.facade.roofline)}</strong></div>
            <div class="kv-row"><span>Entrance</span><strong>${escapeHtml(exterior.entrance.access)} · faces ${escapeHtml(exterior.entrance.side)}</strong></div>
            <div class="kv-row"><span>Sign / number</span><strong>${escapeHtml(exterior.facade.signText)}</strong></div>
            <div class="kv-row"><span>Building shell</span><strong>${escapeHtml(Shells.buildingForPlace(world, place.id)?.name || 'Not derived')}</strong></div>
          </div>
          ${Shells.buildingForPlace(world, place.id) ? `<button class="button small secondary" data-action="open-building" data-id="${escapeAttr(Shells.buildingForPlace(world, place.id).id)}">Inspect storeys and frontage</button>` : ''}
        </div>`;
    },

    renderBuildings(world) {
      const metrics = Shells.metrics(world);
      const selected = Shells.buildingById(world, world.ui.selectedBuildingId)
        || Shells.buildingForPlace(world, world.player.homePropertyId)
        || world.buildings[0];
      const pending = (world.frontageProposals || []).filter((entry) => entry.status === 'awaiting_player');
      const activeProjects = (world.frontageProjects || []).filter((entry) => ['saving', 'planned', 'active'].includes(entry.status));
      return `
        <div class="view-title-row">
          <div>
            <h2>Buildings that connect street, shell, storey, and interior</h2>
            <p>Every existing place now belongs to a persistent low-graphic building shell. Storeys, wall edges, openings, stairs, frontages, and interior entry records are deterministic and inspectable. Residents may shape a frontage, but an idea still needs exact authority, money, phases, and validation.</p><button class="button small secondary" data-action="open-presence">Open lived-building presence</button>
          </div>
          <div class="pill-row">
            <span class="pill good">${metrics.buildings} shells</span>
            <span class="pill info">${metrics.multiStoreyBuildings} multi-storey</span>
            <span class="pill">${metrics.windows} windows</span>
            <span class="pill ${metrics.facadeMaintenanceObligation ? 'warning' : 'good'}">No façade chores</span>
          </div>
        </div>
        <div class="split building-shell-split">
          <section class="card"><div class="card-inner stack">
            <div class="proposal-head"><div><h3>Living building index</h3><p>One shell may hold one place or several independently occupied places.</p></div><span class="pill info">${metrics.storeys} storeys</span></div>
            <div class="building-index">
              ${(world.buildings || []).map((building) => {
                const addresses = building.placeIds.map((placeId) => World.getPlace(world, placeId)?.exterior?.address?.label).filter(Boolean);
                return `<button class="building-index-card ${selected?.id === building.id ? 'selected' : ''}" data-action="select-building" data-id="${escapeAttr(building.id)}">
                  <strong>${escapeHtml(building.name)}</strong>
                  <span>${building.storeys.length} storey${building.storeys.length === 1 ? '' : 's'} · ${building.placeIds.length} place${building.placeIds.length === 1 ? '' : 's'}</span>
                  <small>${escapeHtml(addresses.join(' · '))}</small>
                </button>`;
              }).join('')}
            </div>
          </div></section>
          <aside class="stack">
            ${selected ? this.renderBuildingShell(world, selected) : '<div class="empty-state">No building shell is available.</div>'}
            <section class="card"><div class="card-inner stack">
              <div class="proposal-head"><div><h3>Requests awaiting your property authority</h3><p>Approval grants permission for one exact project. It does not grant control over the resident.</p></div><span class="pill ${pending.length ? 'warn' : 'good'}">${pending.length} pending</span></div>
              ${pending.length ? pending.map((proposal) => this.renderFrontageProposal(world, proposal)).join('') : '<div class="empty-state">No resident frontage request is waiting for you.</div>'}
            </div></section>
            <section class="card"><div class="card-inner stack">
              <div class="proposal-head"><div><h3>Active frontage work</h3><p>Saving and work are visible; approval never creates an instant façade.</p></div><span class="pill info">${activeProjects.length} active</span></div>
              ${activeProjects.length ? activeProjects.slice(-8).reverse().map((project) => this.renderFrontageProject(world, project)).join('') : '<div class="empty-state">No frontage project is currently active.</div>'}
            </div></section>
          </aside>
        </div>
      `;
    },

    renderLivedBuildings(world) {
      const metrics = Presence.metrics(world);
      const current = Presence.presenceFor(world, 'player');
      const place = World.getPlace(world, current?.placeId || world.player.locationId);
      const building = current?.buildingId ? Shells.buildingById(world, current.buildingId) : Shells.buildingForPlace(world, place?.id);
      const active = Presence.movementById(world, world.activeIndoorMovement?.recordId);
      const visible = Presence.visiblePresencesForPlayer(world);
      const encounter = Presence.openEncounter(world);
      const recentEncounters = (world.ordinaryEncounters || []).slice(-8).reverse();
      const access = place ? Presence.accessFor(world, 'player', place.id) : { ok: false, reason: 'No current place.' };
      const rooms = place?.kind === 'residential' && current?.kind === 'room'
        ? Presence.accessibleRooms(world, 'player', place.id)
        : [];
      const activeGrants = (world.presenceAccessGrants || []).filter((entry) => entry.guestId === 'player' && entry.status === 'accepted');
      const currentStep = active?.route?.steps?.[active.currentStepIndex] || null;
      const movementProgress = active?.route?.steps?.length
        ? Math.round(active.currentStepIndex / active.route.steps.length * 100)
        : 0;
      const encounterPerson = encounter ? World.getPerson(world, encounter.actorIds.find((id) => id !== 'player')) : null;
      const presenceTone = current?.kind === 'street_threshold' ? 'info' : 'good';
      return `
        <div class="view-title-row">
          <div>
            <h2>Lived buildings and ordinary presence</h2>
            <p>Arrivals, landings, stairs, room routes, and departures now exist as lawful movement evidence. Reaching an address does not grant entry. Being present does not grant ownership, control, storage, household, care, edit, or surveillance authority.</p><button class="button small secondary" data-action="open-visuals">Open animated Living View</button>
          </div>
          <div class="pill-row">
            <span class="pill ${presenceTone}">${escapeHtml(Core.titleCase(current?.kind || 'unknown'))}</span>
            <span class="pill info">${metrics.trackedBuildings} deeply tracked buildings</span>
            <span class="pill ${metrics.encountersAwaiting ? 'warn' : 'good'}">${metrics.encountersAwaiting} optional moment${metrics.encountersAwaiting === 1 ? '' : 's'}</span>
            <span class="pill good">No social checklist</span>
          </div>
        </div>

        <section class="card"><div class="card-inner stack">
          <div class="proposal-head"><div><h3>Protected presence roots</h3><p>The simulation records enough to make buildings feel inhabited while refusing remote private-room tracking.</p></div><span class="pill good">Compression parity</span></div>
          <div class="grid-4">
            <div class="metric-card"><span>Visible/compressed</span><strong>${metrics.presenceCompressionAllowed ? 'Equal authority' : 'Unavailable'}</strong><small>Same route, minutes, stairs, and access checks.</small></div>
            <div class="metric-card"><span>Greetings</span><strong>${metrics.compulsoryGreetings ? 'Compulsory' : 'Always optional'}</strong><small>Quiet, decline, or simply let a moment pass.</small></div>
            <div class="metric-card"><span>Private rooms</span><strong>${metrics.surveillance ? 'Exposed' : 'Coarsened'}</strong><small>NPC private room IDs are not kept for remote observation.</small></div>
            <div class="metric-card"><span>Simulation tax</span><strong>${metrics.minuteByMinuteTax ? 'Continuous' : 'Bounded'}</strong><small>Distant residents resolve at schedule scale.</small></div>
          </div>
        </div></section>

        <div class="split lived-building-split">
          <div class="stack">
            <section class="card"><div class="card-inner stack">
              <div class="proposal-head"><div><h3>Your current presence</h3><p>${escapeHtml(Presence.presenceLabel(world, current))}</p></div><span class="pill ${presenceTone}">${escapeHtml(current?.accessBasis || 'unknown basis')}</span></div>
              <div class="grid-3">
                <div class="metric-card"><span>Place</span><strong>${escapeHtml(place?.name || 'Unknown')}</strong><small>${escapeHtml(place?.exterior?.address?.label || 'No address')}</small></div>
                <div class="metric-card"><span>Building</span><strong>${escapeHtml(building?.name || 'No shell')}</strong><small>${building ? `${building.storeys.length} storey${building.storeys.length === 1 ? '' : 's'}` : 'No shell route'}</small></div>
                <div class="metric-card"><span>Access evidence</span><strong>${access.ok ? escapeHtml(Core.titleCase(access.basis)) : 'Threshold only'}</strong><small>${escapeHtml(access.reason || 'No permission was inferred from presence.')}</small></div>
              </div>
              ${active ? `
                <div class="subtle-card stack">
                  <div class="proposal-head"><div><h4>${escapeHtml(Core.titleCase(active.kind.replace('_', ' ')))}</h4><p>${escapeHtml(currentStep?.label || 'Finalizing the route')}</p></div><span class="pill info">${active.currentStepIndex}/${active.route.steps.length} steps</span></div>
                  <div class="meter"><span style="--value:${movementProgress}%"></span></div>
                  <div class="history-list">${active.route.steps.map((step, index) => `<div class="history-entry"><div class="meta">${index < active.currentStepIndex ? 'Completed' : index === active.currentStepIndex ? 'Next' : 'Later'} · ${step.minutes} min${step.kind === 'stairs' ? ' · stairs' : ''}</div><div class="message">${escapeHtml(step.label)}</div></div>`).join('')}</div>
                  <div class="button-row"><button class="button" data-action="step-indoor-movement">Walk next step</button><button class="button secondary" data-action="finish-indoor-movement">Compress remainder</button></div>
                </div>` : current?.kind === 'street_threshold' ? `
                <div class="subtle-card stack">
                  <h4>Enter this building</h4>
                  <p>${access.ok ? 'A lawful access basis exists. Entry still requires an explicit action.' : escapeHtml(access.reason || 'No lawful access basis exists.')}</p>
                  <div class="button-row"><button class="button" data-action="start-indoor-arrival" data-id="${escapeAttr(place?.id || '')}" data-mode="visible" ${access.ok ? '' : 'disabled'}>Enter visibly</button><button class="button secondary" data-action="start-indoor-arrival" data-id="${escapeAttr(place?.id || '')}" data-mode="compressed" ${access.ok ? '' : 'disabled'}>Enter compressed</button></div>
                </div>` : `
                <div class="subtle-card stack">
                  <h4>Leave without a movement chore</h4>
                  <p>The same lawful exit can be watched step by step or resolved immediately.</p>
                  <div class="button-row"><button class="button" data-action="start-indoor-departure" data-mode="visible">Leave visibly</button><button class="button secondary" data-action="start-indoor-departure" data-mode="compressed">Leave compressed</button></div>
                </div>`}
              ${rooms.length > 1 ? `<div class="subtle-card stack"><h4>Rooms you may lawfully enter</h4><div class="history-list">${rooms.map((room) => `<div class="history-entry"><div class="message"><strong>${escapeHtml(room.name)}</strong>${room.id === current?.roomId ? ' · current room' : ''}</div>${room.id === current?.roomId ? '' : `<div class="button-row"><button class="button small" data-action="move-presence-room" data-id="${escapeAttr(room.id)}" data-mode="visible">Move visibly</button><button class="button small secondary" data-action="move-presence-room" data-id="${escapeAttr(room.id)}" data-mode="compressed">Move compressed</button></div>`}</div>`).join('')}</div><p class="muted small-text">Both choices use the same lawful route, duration, and authority. Watching is atmosphere, not a progression advantage.</p></div>` : ''}
            </div></section>

            <section class="card"><div class="card-inner stack">
              <div class="proposal-head"><div><h3>People you can lawfully perceive</h3><p>Exact presence appears only through real co-presence. Co-residents elsewhere in the same home remain deliberately coarse.</p></div><span class="pill info">${visible.length}</span></div>
              ${visible.length ? `<div class="history-list">${visible.map((entry) => `<div class="history-entry"><div class="meta">${escapeHtml(entry.disclosure === 'co_present' ? 'Co-present' : 'Private presence coarsened')}</div><div class="message"><strong>${escapeHtml(entry.person.name)}</strong> · ${escapeHtml(entry.label)}</div><div class="causes">No authority gained through observation.</div></div>`).join('')}</div>` : '<div class="empty-state">Nobody else is lawfully observable in your current space. The simulation does not expose private rooms to fill this panel.</div>'}
            </div></section>
          </div>

          <aside class="stack">
            <section class="card"><div class="card-inner stack">
              <div class="proposal-head"><div><h3>Ordinary encounter</h3><p>A tiny social possibility, never a required greeting.</p></div><span class="pill ${encounter ? 'warn' : 'good'}">${encounter ? 'Your choice' : 'Nothing demanded'}</span></div>
              ${encounter ? `<div class="proposal-card"><div class="proposal-head"><div><h4>${escapeHtml(encounter.title)}</h4><p>${escapeHtml(encounter.text)}</p></div><span class="pill info">${escapeHtml(encounterPerson?.name || 'Resident')}</span></div><div class="button-row"><button class="button" data-action="respond-presence-encounter" data-id="${escapeAttr(encounter.id)}" data-response="greet">Small hello · 5 min</button><button class="button secondary" data-action="respond-presence-encounter" data-id="${escapeAttr(encounter.id)}" data-response="quiet">Quiet acknowledgment</button><button class="button ghost" data-action="respond-presence-encounter" data-id="${escapeAttr(encounter.id)}" data-response="decline">Not now</button></div><p class="muted small-text">Quiet and decline preserve time, money, needs, and relationship state exactly.</p></div>` : '<div class="empty-state">Ordinary life may continue without producing an interaction prompt.</div>'}
              ${recentEncounters.length ? `<details><summary>Recent truthful encounter history</summary><div class="history-list">${recentEncounters.map((entry) => { const other = World.getPerson(world, entry.actorIds.find((id) => id !== 'player')); return `<div class="history-entry"><div class="meta">Day ${entry.offeredAt.day}, ${String(entry.offeredAt.hour).padStart(2, '0')}:${String(entry.offeredAt.minute || 0).padStart(2, '0')} · ${escapeHtml(Core.titleCase(entry.status.replaceAll('_', ' ')))}</div><div class="message">${escapeHtml(other?.name || 'Resident')} · ${escapeHtml(entry.title)}</div></div>`; }).join('')}</div></details>` : ''}
            </div></section>

            <section class="card"><div class="card-inner stack">
              <div class="proposal-head"><div><h3>Bounded access grants</h3><p>A visit can open shared spaces without inventing tenancy, storage, edit, family, care, or surveillance rights.</p></div><span class="pill info">${activeGrants.length}</span></div>
              ${activeGrants.length ? `<div class="history-list">${activeGrants.map((grant) => `<div class="history-entry"><div class="meta">${escapeHtml(Core.titleCase(grant.purpose.replaceAll('_', ' ')))}</div><div class="message">${escapeHtml(World.getPlace(world, grant.placeId)?.name || grant.placeId)} · host ${escapeHtml(World.personName(world, grant.hostId))}</div><div class="causes">Expires after day ${grant.expiresAt.day}; shared-space entry only.</div></div>`).join('')}</div>` : '<div class="empty-state">No bounded visit access is active.</div>'}
            </div></section>

            <section class="card"><div class="card-inner stack">
              <h3>Labeled v0.11 experiment</h3>
              <p>Prepare one accepted visit to an occupied upper walk-up, start outside its real entrance, use the landing and stairs, and test a refusal-safe encounter. This is an explicit QA shortcut, not normal progression.</p>
              <button class="button secondary" data-action="prepare-presence-experiment" ${world.flags.presenceExperimentPrepared ? 'disabled' : ''}>${world.flags.presenceExperimentPrepared ? 'Experiment already prepared' : 'Prepare lived-building experiment'}</button>
            </div></section>
          </aside>
        </div>
      `;
    },

    renderLivingVisuals(world) {
      Visuals.ensureUiState(world);
      const scene = Visuals.sceneFor(world);
      const validation = Visuals.validateScene(scene);
      const motion = world.settings.reducedMotion ? 'still' : world.settings.visualMotion;
      const modeLabels = { auto: 'Follow presence', room: 'Room', building: 'Building', street: 'Street' };
      const rooms = scene?.kind === 'room' ? scene.rooms || [] : [];
      const activities = scene?.kind === 'room' ? scene.activities || [] : [];
      const moment = scene?.kind === 'room' ? scene.recentMoment : null;
      const observed = moment?.observedEffects?.effectsObserved ? moment.observedEffects : null;
      const selectedObject = scene?.kind === 'room'
        ? scene.objects.find((object) => object.id === scene.selectedObjectId) || null
        : null;
      const needDeltas = observed ? Object.entries(observed.needs || {}) : [];
      const skillDeltas = observed ? Object.entries(observed.skills || {}) : [];
      const actionPulseFacts = observed ? [
        compactDuration(observed.timeMinutes || 0),
        observed.moneyDelta ? `${observed.moneyDelta > 0 ? '+' : '−'}${Core.formatMoney(Math.abs(observed.moneyDelta))}` : 'Money unchanged',
        observed.homeConditionDelta ? `Home ${signedDelta(observed.homeConditionDelta)}` : null,
        observed.object ? Object.entries(observed.object)
          .filter(([key]) => key !== 'id')
          .map(([key, value]) => `${Core.titleCase(key)} ${signedDelta(value)}`)
          .join(', ') : null,
        ...needDeltas.map(([key, value]) => `${Core.titleCase(key)} ${signedDelta(value)}`),
        ...skillDeltas.map(([key, value]) => `${Core.titleCase(key)} ${signedDelta(value)}`)
      ].filter(Boolean) : [];
      const objectSummary = scene?.kind === 'room' ? scene.objects.slice(0, 16).map((object) => `
        <button class="visual-object-chip ${scene.selectedObjectId === object.id ? 'active' : ''}" data-action="visual-object" data-id="${escapeAttr(object.id)}" aria-pressed="${scene.selectedObjectId === object.id}">
          <span>${escapeHtml(object.name)}</span><small>${Math.round(object.condition)}%</small>
        </button>`).join('') : '';
      return `<div class="living-view-flow">
        <div class="view-title-row living-view-title">
          <div>
            <div class="brand-kicker">Playable interiors steward pass · v${Core.VERSION}</div>
            <h2>Start inside a room, look around, and choose what feels worth doing</h2>
            <p class="living-intro-full">Browse your real rooms and objects, focus the scene, or complete a grounded activity through the existing simulation. Ambient motion stays atmosphere; a completed-moment echo appears only after the real activity engine has finished the action.</p>
            <p class="living-intro-compact">Choose a real room and one grounded activity. The ordinary engine resolves it; the nearby receipt reports what actually changed.</p>
          </div>
          <div class="pill-row">
            <span class="pill good">Playable room choices</span>
            <span class="pill info">${escapeHtml(Core.titleCase(scene?.kind || 'unavailable'))}</span>
            <span class="pill ${validation.ok ? 'good' : 'warning'}">${validation.ok ? 'Truth boundary intact' : 'Scene held'}</span>
          </div>
        </div>

        <section class="living-visual-toolbar" aria-label="Living View controls">
          <div class="visual-mode-group"><span>Scene</span>${Visuals.MODES.map((modeId) => `<button class="visual-chip ${world.ui.visualSceneMode === modeId ? 'active' : ''}" data-action="visual-scene" data-id="${modeId}" aria-pressed="${world.ui.visualSceneMode === modeId}">${modeLabels[modeId]}</button>`).join('')}</div>
          <div class="visual-mode-group"><span>Motion</span>${Visuals.MOTION_LEVELS.map((level) => `<button class="visual-chip ${motion === level ? 'active' : ''}" data-action="visual-motion" data-id="${level}" aria-pressed="${motion === level}">${escapeHtml(Core.titleCase(level))}</button>`).join('')}</div>
        </section>

        ${rooms.length ? `<section class="visual-room-browser" aria-label="Browse your home rooms">
          <div><span>Interior</span><strong>${escapeHtml(scene.title)}</strong></div>
          <div class="visual-room-strip">${rooms.map((room) => `<button class="visual-room-button ${room.id === scene.roomId ? 'active' : ''}" data-action="visual-room" data-id="${escapeAttr(room.id)}" aria-pressed="${room.id === scene.roomId}"><strong>${escapeHtml(room.name)}</strong><span>${escapeHtml(Core.titleCase(room.purpose))} · ${room.objectCount} object${room.objectCount === 1 ? '' : 's'}</span></button>`).join('')}</div>
        </section>` : ''}

        <div class="split living-visual-split">
          <section class="card living-stage-card">
            <div class="living-stage-frame">
              <canvas id="livingCanvas" class="living-canvas" width="960" height="560" role="img" aria-label="${escapeAttr(Visuals.describeScene(scene))}"></canvas>
              <div class="living-stage-overlay" aria-hidden="true"><span>${moment ? 'COMPLETED MOMENT ECHO' : 'LIVE DERIVATION'}</span><strong>${escapeHtml(moment?.label || scene?.title || 'No scene')}</strong></div>
            </div>
            <div class="living-caption">
              <div><strong>${escapeHtml(scene?.title || 'No scene available')}</strong><span>${escapeHtml(moment ? `${moment.label} completed at day ${moment.completedAt.day}, ${String(moment.completedAt.hour).padStart(2, '0')}:${String(moment.completedAt.minute).padStart(2, '0')} · the animation is an after-the-fact echo` : scene?.subtitle || '')}</span></div>
              <span class="pill ${motion === 'still' ? '' : 'good'}">${escapeHtml(Core.titleCase(motion))} motion</span>
            </div>
          </section>

          <aside class="stack">
            ${scene?.kind === 'room' ? `<section class="card visual-activity-card"><div class="card-inner stack">
              <div class="proposal-head"><div><h3>Things to do here</h3><p>These buttons use the real activity engine: time, money, needs, skills, routes, and consequences resolve exactly as they do in One Life.</p></div><span class="pill good">${activities.length} grounded</span></div>
              <div class="visual-action-pulse ${observed ? 'recorded' : 'ready'}" role="status" aria-live="polite" aria-atomic="true">
                <span>${observed ? 'Recorded' : 'Ready'}</span>
                <strong>${escapeHtml(observed ? (moment?.label || 'Grounded activity completed') : `${scene.title} is ready`)}</strong>
                <small>${escapeHtml(observed ? `${actionPulseFacts.join(' · ') || 'No bounded player or home values changed'} · Ordinary engine result; watching added nothing.` : 'Choose a grounded activity. Its exact result will stay here beside the same controls.')}</small>
              </div>
              ${activities.length ? `<div class="visual-activity-list">${activities.map((activity) => {
                const unaffordable = activity.cost > world.player.money;
                return `<button class="visual-activity-button" data-action="visual-activity" data-id="${escapeAttr(activity.id)}" data-room="${escapeAttr(scene.roomId)}" data-object="${escapeAttr(activity.objectId || '')}" ${unaffordable ? 'disabled' : ''}>
                  <span><strong>${escapeHtml(activity.name)}</strong><small>${escapeHtml(activity.reason)}</small></span>
                  <em>${activity.hours}h${activity.cost ? ` · ${Core.formatMoney(activity.cost)}` : ''}</em>
                </button>`;
              }).join('')}</div>` : '<div class="empty-state">This room has no grounded quick action yet. You can still browse it, arrange its real objects in Build & Home, or choose any ordinary activity in One Life.</div>'}
              <div class="callout">Completing an action may create one visual echo of what actually finished. It adds no bonus, relationship point, authority, or better outcome for watching.</div>
              <div class="button-row"><button class="button secondary" data-action="tab" data-id="life">All life choices</button><button class="button ghost" data-action="tab" data-id="home">Arrange this home</button>${moment ? '<button class="button ghost" data-action="visual-clear-moment">Clear echo</button>' : ''}</div>
            </div></section>` : ''}

            ${observed ? `<section class="card visual-effect-card"><div class="card-inner stack">
              <div class="proposal-head"><div><h3>What actually changed</h3><p>Observed after the ordinary activity engine finished. This reports its result; the visual layer adds nothing.</p></div><span class="pill good">Factual receipt</span></div>
              <div class="visual-effect-grid">
                <div><span>Time</span><strong>${escapeHtml(compactDuration(observed.timeMinutes))}</strong></div>
                <div><span>Money</span><strong>${observed.moneyDelta ? `${observed.moneyDelta > 0 ? '+' : '−'}${Core.formatMoney(Math.abs(observed.moneyDelta))}` : 'No change'}</strong></div>
                ${observed.homeConditionDelta ? `<div><span>Home condition</span><strong>${signedDelta(observed.homeConditionDelta)}</strong></div>` : ''}
                ${observed.object ? `<div><span>Focused object</span><strong>${Object.entries(observed.object).filter(([key]) => key !== 'id').map(([key, value]) => `${Core.titleCase(key)} ${signedDelta(value)}`).join(' · ')}</strong></div>` : ''}
              </div>
              ${needDeltas.length ? `<div class="visual-effect-row"><span>Needs</span><div>${needDeltas.map(([key, value]) => `<span class="effect-token ${value > 0 ? 'positive' : 'negative'}">${escapeHtml(Core.titleCase(key))} ${signedDelta(value)}</span>`).join('')}</div></div>` : ''}
              ${skillDeltas.length ? `<div class="visual-effect-row"><span>Skills</span><div>${skillDeltas.map(([key, value]) => `<span class="effect-token positive">${escapeHtml(Core.titleCase(key))} ${signedDelta(value)}</span>`).join('')}</div></div>` : ''}
              <p class="muted small-text">Scope: the player and selected home context only. Background world evolution remains in the ordinary ledger and is not hidden inside this summary.</p>
            </div></section>` : ''}

            ${scene?.kind === 'room' ? `<section class="card"><div class="card-inner stack">
              <div class="proposal-head"><div><h3>Focus a real object</h3><p>Focus changes only the camera emphasis. It never changes ownership, condition, placement, or use.</p></div><span class="pill info">${scene.objects.length}</span></div>
              <div class="visual-object-grid">${objectSummary || '<span class="pill">No placed objects in this room</span>'}</div>
              ${selectedObject ? `<div class="visual-object-detail">
                <div><span>Focused object</span><strong>${escapeHtml(selectedObject.name)}</strong><small>${escapeHtml(Core.titleCase(selectedObject.kind))} · ${Math.round(selectedObject.condition)}% condition · ${Math.round(selectedObject.sentimental)} sentiment</small></div>
                <div class="pill-row"><span class="pill">${Core.round(selectedObject.usageHours, 1)}h use</span><span class="pill">${selectedObject.historyCount} history</span></div>
                <button class="button small ghost" data-action="visual-open-object" data-id="${escapeAttr(selectedObject.id)}" data-room="${escapeAttr(scene.roomId)}">Open in Build &amp; Home</button>
              </div>` : '<p class="muted small-text">Choose an object to see its real condition, sentiment, use, and history.</p>'}
            </div></section>` : ''}

            <section class="card"><div class="card-inner stack">
              <div class="proposal-head"><div><h3>What this frame knows</h3><p>${escapeHtml(Visuals.describeScene(scene))}</p></div><span class="pill info">Derived</span></div>
              <div class="kv-list">
                <div class="kv-row"><span>Evidence</span><strong>${escapeHtml(scene?.evidence || 'none')}</strong></div>
                <div class="kv-row"><span>Simulation mutation</span><strong>None</strong></div>
                <div class="kv-row"><span>Observer reward</span><strong>None</strong></div>
                <div class="kv-row"><span>Authority gained</span><strong>None</strong></div>
              </div>
              ${scene?.kind === 'room' ? `<p class="muted small-text">Only the player and lawfully co-present people may appear as exact current figures. A translucent completed-moment echo is explicitly not current presence. ${scene.hiddenPrivateResidents ? `${scene.hiddenPrivateResidents} private presence ${scene.hiddenPrivateResidents === 1 ? 'summary remains' : 'summaries remain'} intentionally unplaced.` : 'No private resident is converted into a room marker.'}</p>` : ''}
              ${scene?.kind === 'building' ? `<div class="grid-2"><div class="metric-card"><span>Storeys</span><strong>${scene.storeys.length}</strong></div><div class="metric-card"><span>Coarse occupants</span><strong>${scene.coarseOccupants}</strong><small>No room positions inferred.</small></div></div>` : ''}
              ${scene?.kind === 'street' ? `<div class="grid-2"><div class="metric-card"><span>Address</span><strong>${escapeHtml(scene.address)}</strong></div><div class="metric-card"><span>Recent traces</span><strong>${scene.ambientRouteCount}</strong><small>Public route atmosphere.</small></div></div>` : ''}
            </div></section>

            <section class="card"><div class="card-inner stack">
              <div class="proposal-head"><div><h3>Motion stays optional</h3><p>Full is livelier, Gentle reduces movement, and Still renders one stable frame. A device-level reduced-motion preference also forces the stable frame.</p></div><span class="pill good">No animation gate</span></div>
              <div class="callout">Visible and compressed travel and indoor movement remain equally authoritative. This view is never required before an ordinary action.</div>
              <div class="button-row"><button class="button secondary" data-action="open-presence">Presence controls</button><button class="button ghost" data-action="tab" data-id="street">Street routes</button></div>
            </div></section>

            ${validation.ok ? '' : `<section class="card"><div class="card-inner"><h3>Scene held</h3><div class="history-list">${validation.errors.map((error) => `<div class="history-entry"><div class="message">${escapeHtml(error)}</div></div>`).join('')}</div></div></section>`}
          </aside>
        </div>
      </div>`;
    },

    renderBuildingShell(world, building) {
      const places = building.placeIds.map((id) => World.getPlace(world, id)).filter(Boolean);
      const authorable = places.filter((place) => {
        if (place.kind === 'residential') return (place.tenants || []).includes('player') || (!(place.tenants || []).length && place.ownerId === 'player');
        if (place.kind === 'commercial' && place.occupantEnterpriseId) return Economy.enterpriseById(world, place.occupantEnterpriseId)?.ownerId === 'player';
        return false;
      });
      const storeyVisuals = building.storeys.slice().sort((a, b) => b.level - a.level).map((storey) => {
        const windowCount = (storey.openings || []).filter((entry) => entry.type === 'window').length;
        const hasDoor = (storey.openings || []).some((entry) => entry.type === 'external_door');
        return `<div class="shell-storey" data-level="${storey.level}">
          <div class="shell-storey-label">${escapeHtml(storey.label)}</div>
          <div class="shell-openings">${Array.from({ length: Math.min(windowCount, 10) }, (_, index) => `<span class="shell-window" title="Window ${index + 1}"></span>`).join('')}${hasDoor ? '<span class="shell-door" title="Exterior door"></span>' : ''}</div>
          <small>${storey.wallGraph.edges.length} exterior wall edges · ${(storey.placeIds || []).map((id) => escapeHtml(World.getPlace(world, id)?.name || id)).join(' · ') || 'shared access'}</small>
        </div>`;
      }).join('');
      return `<section class="card"><div class="card-inner stack">
        <div class="proposal-head"><div><h3>${escapeHtml(building.name)}</h3><p>${escapeHtml(Core.titleCase(building.type))} · persistent identity revision ${building.revision}</p></div><span class="pill info">${building.storeys.length} storey${building.storeys.length === 1 ? '' : 's'}</span></div>
        <div class="shell-elevation" aria-label="Low-graphic building elevation">${storeyVisuals}<div class="shell-ground-line"></div></div>
        <div class="grid-3">
          <div class="metric-card"><span>Wall graph</span><strong>${building.storeys.reduce((sum, storey) => sum + storey.wallGraph.edges.length, 0)} edges</strong></div>
          <div class="metric-card"><span>Vertical routes</span><strong>${building.verticalLinks.length} stair link${building.verticalLinks.length === 1 ? '' : 's'}</strong></div>
          <div class="metric-card"><span>Roof</span><strong>${escapeHtml(building.roof.style)}</strong></div>
        </div>
        <div class="stack">${places.map((place) => {
          const route = Shells.routeFromStreetToPlace(world, place.id);
          const frontage = Shells.frontageForPlace(world, place.id);
          return `<div class="frontage-row">
            <div><strong>${escapeHtml(place.name)}</strong><span>${escapeHtml(place.exterior?.address?.label || '')} · storey ${Number(place.shellRef?.primaryStoreyId?.match(/_s(\d+)_/)?.[1] || 0) + 1}</span></div>
            <div class="pill-row"><span class="pill">${route ? `${route.edgeIds.length} internal steps` : 'No route'}</span><span class="pill info">${escapeHtml(frontage?.frameStyle || 'frontage')}</span></div>
            <div class="button-grid compact"><button class="button small ghost" data-action="select-place" data-id="${escapeAttr(place.id)}">Town record</button>${place.kind === 'residential' ? `<button class="button small ghost" data-action="view-property" data-id="${escapeAttr(place.id)}">Interior</button>` : ''}</div>
          </div>`;
        }).join('')}</div>
        ${authorable.length ? `<div class="divider"></div><div class="stack"><h4>Optional player-authored frontage idea</h4><p class="muted">This is a proposal, not an instant edit. Keeping the current frontage forever is equally valid.</p><div class="form-grid"><label>Place<select id="shellPlaceSelect" class="select-input">${authorable.map((place) => `<option value="${escapeAttr(place.id)}">${escapeHtml(place.name)}</option>`).join('')}</select></label><label>Exact change<select id="shellChangeType" class="select-input">${Shells.CHANGE_TYPES.map((type) => `<option value="${escapeAttr(type)}">${escapeHtml(Core.titleCase(type))}</option>`).join('')}</select></label></div><button class="button secondary" data-action="propose-frontage">Form exact optional proposal</button></div>` : '<div class="callout">You can inspect this shell, but occupancy or ownership here does not grant you frontage authorship.</div>'}
        <details class="proposal-history"><summary>${building.history.length} building-history event${building.history.length === 1 ? '' : 's'}</summary><div class="history-list">${building.history.slice(-8).reverse().map((entry) => this.renderHistoryEntry(entry)).join('')}</div></details>
      </div></section>`;
    },

    renderFrontageProposal(world, proposal) {
      const author = World.getPerson(world, proposal.authorId);
      const place = World.getPlace(world, proposal.placeId);
      return `<div class="proposal-card">
        <div class="proposal-head"><div><h4>${escapeHtml(author?.name || proposal.authorId)} · ${escapeHtml(place?.name || proposal.placeId)}</h4><p>${escapeHtml(proposal.change.description)}</p></div><span class="pill warn">Exact request</span></div>
        <div class="kv-list"><div class="kv-row"><span>Cost</span><strong>${Core.formatMoney(proposal.finance.totalCost)}</strong></div><div class="kv-row"><span>Authority</span><strong>Property response only</strong></div><div class="kv-row"><span>Decline effect</span><strong>No hidden relationship penalty</strong></div></div>
        <div class="button-grid compact"><button class="button small primary" data-action="respond-frontage" data-id="${escapeAttr(proposal.id)}" data-response="approve">Approve exact project</button><button class="button small" data-action="respond-frontage" data-id="${escapeAttr(proposal.id)}" data-response="decline">Decline without punishment</button></div>
      </div>`;
    },

    renderFrontageProject(world, project) {
      const place = World.getPlace(world, project.placeId);
      const actor = World.getPerson(world, project.actorId);
      const completed = project.completedPhaseIds.length;
      const percent = Math.round(completed / Math.max(1, project.phases.length) * 100);
      return `<div class="proposal-card">
        <div class="proposal-head"><div><h4>${escapeHtml(place?.name || project.placeId)}</h4><p>${escapeHtml(actor?.name || project.actorId)} · ${escapeHtml(Core.titleCase(project.status))}</p></div><span class="pill info">${completed}/${project.phases.length} phases</span></div>
        <div class="meter"><span style="--value:${percent}%"></span></div>
        <div class="kv-list"><div class="kv-row"><span>Resident escrow</span><strong>${Core.formatMoney(project.escrow)} / ${Core.formatMoney(project.requiredMoney)}</strong></div><div class="kv-row"><span>Spent</span><strong>${Core.formatMoney(project.spent)}</strong></div></div>
        <button class="button small secondary" data-action="advance-frontage-project" data-id="${escapeAttr(project.id)}">Advance one visible saving/work step</button>
      </div>`;
    },

    renderPlaceInspector(world, place) {
      if (!place) return '<div class="empty-state">Select a place.</div>';
      const textColor = Core.contrastingText(place.color || '#6f8f72');
      if (place.kind === 'commercial') {
        const enterprise = place.occupantEnterpriseId ? Economy.enterpriseById(world, place.occupantEnterpriseId) : null;
        const owner = enterprise ? World.getPerson(world, enterprise.ownerId) : null;
        return `
          <section class="card"><div class="card-inner">
            <div class="place-heading">
              <div class="place-swatch" style="background:${place.color};color:${textColor}">${escapeHtml(place.symbol || 'C')}</div>
              <div><h3>${escapeHtml(place.name)}</h3><p>${escapeHtml(place.description || '')}</p></div>
            </div>
            <div class="pill-row">
              <span class="pill ${place.listedForLease ? 'good' : 'info'}">${place.listedForLease ? 'Genuine vacancy' : 'Occupied commercial room'}</span>
              <span class="pill">Condition ${Math.round(place.condition || 0)}</span>
              <span class="pill">${Core.formatMoney(place.weeklyLease || 0)}/week</span>
            </div>
            <div class="kv-list">
              <div class="kv-row"><span>Owner authority</span><strong>${escapeHtml(place.ownerLabel || place.ownerId || 'Unknown')}</strong></div>
              <div class="kv-row"><span>Deposit</span><strong>${Core.formatMoney(place.deposit || 0)}</strong></div>
              <div class="kv-row"><span>Utilities</span><strong>${Core.formatMoney(place.utilityBase || 0)}/week</strong></div>
              <div class="kv-row"><span>Current direction</span><strong>${enterprise ? escapeHtml(enterprise.name) : 'None'}</strong></div>
            </div>
            ${enterprise ? `<div class="callout"><strong>${escapeHtml(owner?.name || enterprise.ownerId)}</strong> operates this as ${escapeHtml(Core.titleCase(enterprise.path))}. Occupancy grants no control over the resident owner.</div><button class="button primary" data-action="open-enterprise" data-id="${enterprise.id}">Inspect living direction</button>` : `<div class="callout">The room is actually available. A player or autonomous resident may lease it later; it is not reserved as a player unlock.</div><button class="button" data-action="open-economy">Open local economy</button>`}
            ${place.history?.length ? `<details class="proposal-history"><summary>${place.history.length} property-history event${place.history.length === 1 ? '' : 's'}</summary><div class="history-list">${place.history.slice(-8).reverse().map((entry) => this.renderHistoryEntry(entry)).join('')}</div></details>` : ''}
          </div></section>`;
      }
      if (place.kind === 'public') {
        const visitors = world.people.filter((person) => person.locationId === place.id);
        if (world.player.locationId === place.id) visitors.unshift(world.player);
        const workers = world.people.filter((person) => Content.jobById(person.jobId)?.placeId === place.id);
        return `
          <section class="card"><div class="card-inner">
            <div class="place-heading">
              <div class="place-swatch" style="background:${place.color};color:${textColor}">${escapeHtml(place.symbol || '•')}</div>
              <div><h3>${escapeHtml(place.name)}</h3><p>${escapeHtml(place.description || '')}</p></div>
            </div>
            <div class="kv-list">
              <div class="kv-row"><span>Type</span><strong>${Core.titleCase(place.type)}</strong></div>
              <div class="kv-row"><span>People here now</span><strong>${visitors.length}</strong></div>
              <div class="kv-row"><span>Residents employed here</span><strong>${workers.length}</strong></div>
            </div>
            <div class="pill-row">${visitors.length ? visitors.slice(0, 10).map((person) => `<button class="button small" data-action="select-person" data-id="${person.id}">${escapeHtml(person.name)}</button>`).join('') : '<span class="pill">Quiet right now</span>'}</div>
          </div></section>`;
      }

      const residents = place.tenants.map((id) => World.getPerson(world, id)).filter(Boolean);
      const vacancies = Math.max(0, place.capacity - place.tenants.length);
      const isHome = world.player.homePropertyId === place.id;
      const ownerPlayer = place.ownerId === 'player';
      const household = Households.playerHousehold(world);
      const cohabiting = Households.isCohabiting(world, household);
      const agreementPartnerId = household ? Households.partnerIdFor(household) : null;
      const jointEligible = household && Households.eligibleJointMoveProperties(world, household).some((property) => property.id === place.id)
        && (!cohabiting || household.homePropertyId !== place.id);
      const canRent = !isHome && vacancies > 0 && !cohabiting;
      const latestHistory = (place.history || []).slice(-6).reverse();
      return `
        <section class="card"><div class="card-inner">
          <div class="place-heading">
            <div class="place-swatch" style="background:${place.color};color:${textColor}">H</div>
            <div><h3>${escapeHtml(place.name)}</h3><p>${Core.titleCase(place.type)} · ${escapeHtml(Content.STYLES.find((style) => style.id === place.style)?.name || place.style)}</p></div>
          </div>
          <div class="pill-row" style="margin-top:10px">
            ${isHome ? '<span class="pill good">Your current home</span>' : ''}
            ${ownerPlayer ? '<span class="pill info">You own this</span>' : ''}
            ${vacancies > 0 ? `<span class="pill warn">${vacancies} open place${vacancies === 1 ? '' : 's'}</span>` : '<span class="pill">Fully occupied</span>'}
            ${place.sharedBathroom ? '<span class="pill">Shared bathroom</span>' : ''}
          </div>
          <div class="kv-list">
            <div class="kv-row"><span>Monthly rent</span><strong>${Core.formatMoney(place.currentRent)}</strong></div>
            <div class="kv-row"><span>Condition</span><strong>${Math.round(place.condition)}/100</strong></div>
            <div class="kv-row"><span>Capacity</span><strong>${place.tenants.length}/${place.capacity}</strong></div>
            <div class="kv-row"><span>Owner</span><strong>${escapeHtml(place.ownerLabel)}</strong></div>
            <div class="kv-row"><span>Décor signature</span><strong>${Systems.computeDecorSignature(place)}</strong></div>
          </div>
          <div class="pill-row">
            ${residents.map((person) => `<button class="button small ${person.id === 'player' ? 'primary' : ''}" data-action="select-person" data-id="${person.id}">${escapeHtml(person.name)}</button>`).join('') || '<span class="pill">No residents</span>'}
          </div>
          <div class="property-actions">
            ${jointEligible ? `<button class="button primary" data-action="propose-home-property" data-id="${place.id}" data-partner="${agreementPartnerId}">${cohabiting ? 'Propose moving here together' : 'Propose this as a shared home'}<span>A proposal is not an automatic move.</span></button>` : ''}
            ${canRent ? `<button class="button ${household ? '' : 'primary'}" data-action="rent-property" data-id="${place.id}">Rent for yourself · ${Core.formatMoney(place.currentRent)} deposit</button>` : ''}
            ${place.listedForSale && !ownerPlayer ? `<button class="button secondary" data-action="buy-property" data-id="${place.id}">Buy for ${Core.formatMoney(place.purchasePrice)}<span>Existing tenants stay.</span></button>` : ''}
            ${ownerPlayer && !isHome && vacancies > 0 && !cohabiting ? `<button class="button" data-action="move-owned" data-id="${place.id}">Move here yourself<span>No tenant is displaced.</span></button>` : ''}
            <button class="button ghost" data-action="view-property" data-id="${place.id}">View interior</button>
          </div>
          <div class="divider"></div>
          <h4 class="card-title">Recent property history</h4>
          <div class="history-list">
            ${latestHistory.length ? latestHistory.map((entry) => this.renderHistoryEntry(entry)).join('') : '<div class="empty-state">No recorded history yet.</div>'}
          </div>
        </div></section>`;
    },

    renderNearbyActivity(world, place) {
      const people = world.people.filter((person) => person.locationId === place.id).slice(0, 8);
      return `
        <section class="card"><div class="card-inner">
          <h3 class="card-title">Activity now <small>${String(world.time.hour).padStart(2, '0')}:00</small></h3>
          <div class="stack">
            ${people.length ? people.map((person) => `
              <button class="button" data-action="select-person" data-id="${person.id}">
                <strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.activity)}</span>
              </button>`).join('') : '<div class="empty-state">No autonomous resident is here at this hour.</div>'}
          </div>
        </div></section>`;
    },

    renderLife(world) {
      const home = World.homeOf(world, 'player');
      const job = Content.jobById(world.player.jobId);
      return `
        <div class="view-title-row">
          <div>
            <h2>One life, not a household control panel</h2>
            <p>You directly choose this character’s time. Casual realism keeps ordinary needs and consequences grounded without turning life into a checklist. Relationships, partners, family, and neighbors remain simulated people whose responses have their own causes.</p>
          </div>
          <div class="pill-row"><span class="pill good">${escapeHtml(world.player.name)}</span><span class="pill">${escapeHtml(lifeContextLabel(world, world.player))}</span><span class="pill info">${escapeHtml(job.name)}</span></div>
        </div>
        <div class="split">
          <div class="stack">
            <section class="card choice-life-card"><div class="card-inner stack">
              <h3 class="card-title">Life chapters without a countdown <small>Default: choice-first</small></h3>
              <p>${world.settings.lifeCourseMode === 'choice' ? 'Simulated days do not make you older or close a life window. Your current chapter stays open until you explicitly choose another.' : 'Optional calendar aging is active because you chose it. You can return to choice-first chapters at any time without losing history.'}</p>
              <div class="pill-row"><span class="pill ${world.settings.lifeCourseMode === 'choice' ? 'good' : 'warn'}">${world.settings.lifeCourseMode === 'choice' ? 'Choice-first active' : 'Calendar mode active'}</span><span class="pill good">No missed-life penalties</span><span class="pill">Exact ages ${world.settings.showExactAges ? 'visible' : 'hidden'}</span></div>
              <div class="button-grid">
                <button class="button ${world.settings.lifeCourseMode === 'choice' ? 'primary' : ''}" data-action="set-life-course-mode" data-mode="choice" ${world.settings.lifeCourseMode === 'choice' ? 'disabled' : ''}><strong>Use choice-first chapters</strong><span>No automatic aging, fertility clock, age gate, or “too late” state.</span></button>
                <button class="button ${world.settings.lifeCourseMode === 'calendar' ? 'secondary' : 'ghost'}" data-action="set-life-course-mode" data-mode="calendar" ${world.settings.lifeCourseMode === 'calendar' ? 'disabled' : ''}><strong>Optional calendar aging</strong><span>For players who want elapsed years; never required by the game.</span></button>
                <button class="button ghost" data-action="toggle-exact-ages"><strong>${world.settings.showExactAges ? 'Hide exact ages' : 'Show exact ages'}</strong><span>A display preference only. It never changes opportunity or progression.</span></button>
                ${world.settings.lifeCourseMode === 'choice' && Family.LIFE_STAGE_ORDER.indexOf(world.player.lifeCourse?.stage) < Family.LIFE_STAGE_ORDER.length - 1 ? `<button class="button secondary" data-action="advance-life-chapter" data-id="player"><strong>Open my next life chapter</strong><span>Explicit choice; identity, possessions, relationships, and unfinished projects remain.</span></button>` : ''}
              </div>
            </div></section>
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Choose what feels worth doing <small>Ordinary care is compressed; no daily streak exists</small></h3>
              <div class="button-grid">
                ${Content.ACTIVITIES.map((activity) => `
                  <button class="button" data-action="activity" data-id="${activity.id}">
                    <strong>${escapeHtml(activity.name)} · ${activity.hours}h${activity.cost ? ` · ${Core.formatMoney(activity.cost)}` : ''}</strong>
                    <span>${escapeHtml(activity.description)}</span>
                  </button>`).join('')}
              </div>
            </div></section>
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Skills grow slowly <small>No single personality build is mandatory</small></h3>
              <div class="grid-3">
                ${Object.entries(world.player.skills).map(([key, value]) => this.renderStatMeter(Core.titleCase(key), value, 100)).join('')}
              </div>
            </div></section>
          </div>
          <aside class="stack">
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Optional starting possibilities <small>Helpful orientation, never an unlock gate</small></h3>
              <div class="progress-list">
                ${world.tutorial.goals.map((goal) => `
                  <div class="progress-item ${goal.complete ? 'complete' : ''}">
                    <span class="progress-check">${goal.complete ? '✓' : ''}</span>
                    <span class="label">${escapeHtml(goal.label)}</span>
                    <span class="count">${Math.min(Math.round(goal.progress), goal.target)}/${goal.target}</span>
                  </div>`).join('')}
              </div>
            </div></section>
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Current anchor</h3>
              <div class="kv-list">
                <div class="kv-row"><span>Home</span><strong>${escapeHtml(home.name)}</strong></div>
                <div class="kv-row"><span>Rent</span><strong>${Core.formatMoney(home.currentRent)}/month</strong></div>
                <div class="kv-row"><span>Job</span><strong>${escapeHtml(job.name)}</strong></div>
                <div class="kv-row"><span>Estimated monthly income</span><strong>${Core.formatMoney(Systems.playerMonthlyIncome(world))}</strong></div>
                <div class="kv-row"><span>Rent arrears</span><strong>${Core.formatMoney(world.player.rentArrears)}</strong></div>
              </div>
              <div class="callout">${escapeHtml(world.player.activeObjective)}</div>
            </div></section>
            ${this.renderMaterials(world, true)}
          </aside>
        </div>
      `;
    },

    renderMaterials(world, includeBuyButtons = false) {
      return `
        <section class="card"><div class="card-inner">
          <h3 class="card-title">Build materials <small>Money alone does not instantly perfect objects</small></h3>
          <div class="material-row">
            ${Object.values(Content.MATERIALS).map((material) => `
              <div class="material-chip"><strong>${world.player.materials[material.id]}</strong>${escapeHtml(material.name)}${includeBuyButtons ? `<button class="button small" style="margin-top:6px;width:100%;text-align:center" data-action="buy-material" data-id="${material.id}">+1 · ${Core.formatMoney(material.unitPrice)}</button>` : ''}</div>
            `).join('')}
          </div>
        </div></section>`;
    },

    renderHome(world) {
      const playerHome = World.homeOf(world, 'player');
      const viewedHome = World.getProperty(world, world.ui.viewPropertyId) || playerHome;
      const editable = viewedHome.id === playerHome.id;
      const selected = this.findSelectedObject(world, viewedHome);
      const residents = viewedHome.tenants.map((id) => World.getPerson(world, id)).filter(Boolean);
      const habitat = viewedHome.habitat;
      const facilities = habitat ? Habitats.facilityReport(viewedHome) : null;
      const activeProjects = habitat?.projects?.filter((project) => ['planned', 'active'].includes(project.status)).length || 0;
      return `
        <div class="view-title-row">
          <div>
            <h2>${editable ? 'A home made of real rooms, not one decorative rectangle' : `Observe how ${escapeHtml(viewedHome.name)} is becoming its own place`}</h2>
            <p>${editable ? 'Walls and doors create room identity; doors create actual routes; floors, wall finishes, utilities, permissions, furniture, and construction history remain separate layers. Work happens in phases and must pass reachability and no-loss checks before the habitat changes.' : 'This is a read-only structural interior shaped by its residents. Observation reveals rooms, utilities, finishes, objects, and history, but never grants remote authorship.'}</p>
          </div>
          <div class="pill-row">
            <span class="pill ${editable ? 'good' : 'info'}">${escapeHtml(viewedHome.name)}</span>
            <span class="pill">${viewedHome.roomGrid[0]}×${viewedHome.roomGrid[1]} habitat grid</span>
            <span class="pill ${facilities?.allRoomsReachable ? 'good' : 'bad'}">${habitat?.rooms?.length || 0} real rooms</span>
            ${activeProjects ? `<span class="pill warn">${activeProjects} active project${activeProjects === 1 ? '' : 's'}</span>` : ''}
            ${editable ? '<span class="pill good">Current home</span>' : '<span class="pill warn">Read-only resident interior</span>'}
          </div>
        </div>
        <div class="split">
          <div class="stack">
            <section class="card room-wrap">
              ${this.renderRoomGrid(world, viewedHome, selected?.id)}
            </section>
            ${editable ? `
              ${this.renderHabitatStudio(world, viewedHome)}
              ${this.renderMaterials(world, true)}
              <section class="card"><div class="card-inner">
                <h3 class="card-title">Furniture and activity catalogue <small>Objects must fit one room and its real utility access</small></h3>
                <div class="grid-3">
                  ${Content.FURNITURE_CATALOG.map((definition) => this.renderCatalogCard(world, definition)).join('')}
                </div>
              </div></section>
              ${this.renderStoredObjects(world)}
            ` : `
              <section class="card"><div class="card-inner">
                <h3 class="card-title">Residents shaping this habitat <small>They retain authorship</small></h3>
                <div class="grid-3">${residents.length ? residents.map((person) => this.renderPersonCard(world, person, world.ui.selectedPersonId)).join('') : '<div class="empty-state">This home is currently vacant, so its next interior chapter has not begun.</div>'}</div>
                <div class="property-actions"><button class="button primary" data-action="view-property" data-id="${playerHome.id}">Return to your current home</button><button class="button ghost" data-action="select-place" data-id="${viewedHome.id}">Open property history on the town map</button></div>
              </div></section>
            `}
          </div>
          <aside class="stack">
            ${this.renderObjectInspector(world, selected, viewedHome)}
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Habitat truth <small>Authoritative state, not visual labels</small></h3>
              <div class="kv-list">
                <div class="kv-row"><span>Room graph revision</span><strong>${habitat?.revision || '—'}</strong></div>
                <div class="kv-row"><span>Rooms / doors</span><strong>${habitat?.rooms?.length || 0} / ${habitat?.partitions?.filter((entry) => entry.kind === 'door').length || 0}</strong></div>
                <div class="kv-row"><span>Reachable floor</span><strong>${facilities ? `${facilities.reachableCellCount}/${facilities.totalCellCount}` : '—'}</strong></div>
                <div class="kv-row"><span>Structural condition</span><strong>${Math.round(habitat?.structuralCondition || viewedHome.condition)}%</strong></div>
                <div class="kv-row"><span>Objects here</span><strong>${viewedHome.furniture.length}</strong></div>
                <div class="kv-row"><span>Your personal objects</span><strong>${viewedHome.furniture.filter((object) => object.ownerId === 'player' && object.ownershipMode !== 'property_fixture').length}</strong></div>
                <div class="kv-row"><span>Residents' personal objects</span><strong>${viewedHome.furniture.filter((object) => object.ownershipMode !== 'property_fixture' && object.ownerId !== 'player').length}</strong></div>
                <div class="kv-row"><span>Property-bound fixtures</span><strong>${viewedHome.furniture.filter((object) => object.ownershipMode === 'property_fixture').length}</strong></div>
                <div class="kv-row"><span>Layout evidence hash</span><strong class="mono">${escapeHtml(habitat?.layoutHash || '—')}</strong></div>
              </div>
              <div class="callout">${editable ? 'You can author your current home only within real ownership and household authority. A rental permits bounded surface expression; structural changes require ownership; shared-space changes become proposals.' : 'Observation does not grant edit authority. Property ownership also does not create remote control over an occupied resident-authored home.'}</div>
            </div></section>
          </aside>
        </div>
      `;
    },

    renderRoomGrid(world, property, selectedId) {
      const [gridW, gridH] = property.roomGrid;
      const habitat = property.habitat;
      if (!habitat) return '<div class="empty-state">Structural habitat state is unavailable.</div>';
      const selectedRoomId = Habitats.roomById(property, world.ui.selectedRoomId)?.id || habitat.rooms[0]?.id || null;
      const permissions = Habitats.roomPermissionsForProperty(world, property.id);
      const permissionByRoom = new Map(permissions.map((entry) => [entry.roomId, entry]));
      const cells = [];
      for (let y = 0; y < gridH; y += 1) {
        for (let x = 0; x < gridW; x += 1) {
          const room = Habitats.roomAtCell(property, x, y);
          const permission = permissionByRoom.get(room?.id);
          const top = y > 0 ? Habitats.partitionAt(property, Habitats.edgeKey('H', x, y)) : null;
          const left = x > 0 ? Habitats.partitionAt(property, Habitats.edgeKey('V', x, y)) : null;
          const floor = Habitats.finishById(room?.finish?.floorFinishId).color;
          const wall = Habitats.finishById(room?.finish?.wallFinishId).color;
          const classes = [
            'habitat-cell',
            room?.id === selectedRoomId ? 'selected-room' : '',
            permission ? `permission-${permission.kind}` : '',
            top ? `edge-top-${top.kind}` : '',
            left ? `edge-left-${left.kind}` : ''
          ].filter(Boolean).join(' ');
          const doorMarks = `${top?.kind === 'door' ? '<span class="door-mark top">↕</span>' : ''}${left?.kind === 'door' ? '<span class="door-mark left">↔</span>' : ''}`;
          cells.push(`<button class="${classes}" data-action="select-room" data-id="${escapeAttr(room?.id || '')}" style="grid-column:${x + 1};grid-row:${y + 1};--floor-finish:${floor};--wall-finish:${wall}" title="${escapeAttr(room?.name || 'Room')} · ${escapeAttr(Habitats.roomPurpose(room?.purpose).name)} · ${permission ? escapeAttr(permission.label) : 'resident space'}">${doorMarks}</button>`);
        }
      }
      const roomLabels = habitat.rooms.map((room) => {
        const permission = permissionByRoom.get(room.id);
        const utilities = Habitats.UTILITY_TYPES.filter((type) => room.utilityAccess[type]).map((type) => type[0].toUpperCase()).join('');
        return `<button class="habitat-room-label ${selectedRoomId === room.id ? 'selected' : ''}" data-action="select-room" data-id="${room.id}" style="grid-column:${room.anchor.x + 1} / span ${Math.min(room.bounds.w, Math.max(2, Math.ceil(room.name.length / 6)))};grid-row:${room.anchor.y + 1}" title="Select ${escapeAttr(room.name)}"><strong>${escapeHtml(room.name)}</strong><span>${room.area} tiles · ${utilities || 'no utilities'}${permission ? ` · ${escapeHtml(Core.titleCase(permission.kind))}` : ''}</span></button>`;
      }).join('');
      const permissionKinds = Array.from(new Map(permissions.map((entry) => [entry.kind, entry])).values());
      return `
        <div class="room-grid structural-grid ${permissions.length ? 'has-household-zones' : ''}" style="--grid-w:${gridW};--grid-h:${gridH}" aria-label="Structural room and furniture grid">
          ${cells.join('')}
          ${roomLabels}
          ${property.furniture.map((object) => {
            const definition = Content.furnitureById(object.catalogId);
            const color = Content.paletteById(object.colorId).hex;
            const text = Core.contrastingText(color);
            const owner = World.getPerson(world, object.ownerId);
            const playerOwned = object.ownerId === 'player' && object.ownershipMode !== 'property_fixture';
            const propertyOwned = object.ownershipMode === 'property_fixture';
            const ownerMark = propertyOwned ? 'FIX' : playerOwned ? 'YOU' : initials(owner?.name || 'NPC');
            return `<button
              class="furniture-tile ${selectedId === object.id ? 'selected' : ''} ${playerOwned ? '' : 'npc-owned'}"
              data-action="select-object" data-id="${object.id}"
              style="grid-column:${object.position.x + 1} / span ${object.footprint[0]};grid-row:${object.position.y + 1} / span ${object.footprint[1]};background:${color};color:${text}"
              title="${escapeAttr(definition.name)} · ${escapeAttr(playerOwned ? 'Owned by you' : propertyOwned ? 'Property fixture' : `Owned by ${owner?.name || 'resident'}`)}">
              ${escapeHtml(definition.symbol)}<span class="owner-mark">${escapeHtml(ownerMark)}</span>
            </button>`;
          }).join('')}
        </div>
        <div class="zone-legend habitat-legend" aria-label="Room graph legend">
          <span class="zone-chip"><i class="edge-sample wall"></i>Wall</span>
          <span class="zone-chip"><i class="edge-sample door"></i>Door / passable route</span>
          ${permissionKinds.map((entry) => `<span class="zone-chip zone-${escapeAttr(entry.kind)}">${escapeHtml(entry.label)}</span>`).join('')}
        </div>
      `;
    },

    renderHabitatStudio(world, property) {
      const habitat = property.habitat;
      if (!habitat) return '';
      const selectedRoom = Habitats.roomById(property, world.ui.selectedRoomId) || habitat.rooms[0];
      if (!selectedRoom) return '';
      const suggestions = Habitats.roomSuggestions(property, selectedRoom.id).slice(0, 4);
      const edges = Habitats.listEdges(property);
      const preferredEdge = edges.find((entry) => entry.key === world.ui.selectedHabitatEdgeKey) || Habitats.recommendedEdits(property)[0] || edges[0];
      const permissions = Habitats.roomPermissionsForProperty(world, property.id);
      const permission = permissions.find((entry) => entry.roomId === selectedRoom.id);
      const surfaceProbe = { type: 'surface', target: { roomId: selectedRoom.id, surface: 'walls', finishId: Habitats.FINISHES.find((entry) => entry.id !== selectedRoom.finish.wallFinishId)?.id || 'bare' } };
      const structureProbe = { type: 'partition', target: { edgeKey: preferredEdge?.key, kind: preferredEdge?.current === 'door' ? 'open' : 'door', materialId: 'timber_frame' } };
      const surfaceAuthority = Habitats.projectAuthority(world, property, surfaceProbe);
      const structureAuthority = preferredEdge ? Habitats.projectAuthority(world, property, structureProbe) : { mode: 'denied', reason: 'No internal edge available.' };
      const projects = habitat.projects.slice().sort((a, b) => b.createdDay - a.createdDay || b.createdHour - a.createdHour || b.id.localeCompare(a.id));
      return `<section class="card habitat-studio"><div class="card-inner">
        <div class="view-title-row compact">
          <div><h3 class="card-title">Structural Habitat Studio <small>Real rooms · phased work · explicit authority</small></h3><p>Select a room on the grid. Purpose labels remain descriptive; finishes remain expressive; walls, doors, utilities, and repairs enter a construction queue and only mutate the world after all phases pass validation.</p></div>
          <div class="pill-row"><span class="pill info">Revision ${habitat.revision}</span><span class="pill ${permission?.kind === 'partner_private' ? 'warn' : 'good'}">${escapeHtml(permission?.label || 'Resident-authored room')}</span><span class="pill">${escapeHtml(selectedRoom.name)}</span></div>
        </div>

        <div class="habitat-room-tabs">${habitat.rooms.map((room) => `<button class="room-tab ${room.id === selectedRoom.id ? 'active' : ''}" data-action="select-room" data-id="${room.id}"><strong>${escapeHtml(room.name)}</strong><span>${room.area} tiles · ${escapeHtml(Habitats.roomPurpose(room.purpose).name)}</span></button>`).join('')}</div>

        <div class="grid-2 habitat-editor-grid">
          <div class="subtle-card">
            <h4 class="card-title">Room meaning <small>Suggestion is not optimisation law</small></h4>
            <div class="kv-list">
              <div class="kv-row"><span>Current purpose</span><strong>${escapeHtml(Habitats.roomPurpose(selectedRoom.purpose).name)}</strong></div>
              <div class="kv-row"><span>Floor / walls</span><strong>${escapeHtml(Habitats.finishById(selectedRoom.finish.floorFinishId).name)} / ${escapeHtml(Habitats.finishById(selectedRoom.finish.wallFinishId).name)}</strong></div>
              <div class="kv-row"><span>Utilities</span><strong>${Habitats.UTILITY_TYPES.map((type) => `${Core.titleCase(type)} ${selectedRoom.utilityAccess[type] ? '✓' : '—'}`).join(' · ')}</strong></div>
            </div>
            <div class="form-row" style="margin-top:10px">
              <select id="habitatPurpose" class="select-input" aria-label="Room purpose">${Habitats.ROOM_PURPOSES.map((entry) => `<option value="${entry.id}" ${entry.id === selectedRoom.purpose ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}</select>
              <button class="button small" data-action="set-room-purpose" data-property="${property.id}" data-id="${selectedRoom.id}">Choose purpose</button>
            </div>
            <div class="suggestion-list">${suggestions.map((entry) => `<button class="suggestion-chip" data-action="quick-room-purpose" data-property="${property.id}" data-room="${selectedRoom.id}" data-purpose="${entry.id}"><strong>${escapeHtml(Habitats.roomPurpose(entry.id).name)}</strong><span>${entry.score} signal · ${escapeHtml(entry.note || 'open interpretation')}</span></button>`).join('') || '<span class="muted small-text">This room is deliberately flexible.</span>'}</div>
          </div>

          <div class="subtle-card">
            <h4 class="card-title">Surface project <small>${escapeHtml(this.authorityLabel(surfaceAuthority))}</small></h4>
            <div class="form-row">
              <select id="habitatSurface" class="select-input"><option value="walls">Walls</option><option value="floor">Floor</option></select>
              <select id="habitatFinish" class="select-input">${Habitats.FINISHES.map((finish) => `<option value="${finish.id}">${escapeHtml(finish.name)}</option>`).join('')}</select>
              <button class="button primary" data-action="request-surface-project" data-property="${property.id}" data-room="${selectedRoom.id}">Plan finish</button>
            </div>
            <div class="finish-swatches">${Habitats.FINISHES.map((finish) => `<span title="${escapeAttr(finish.name)}" style="--finish:${finish.color}"></span>`).join('')}</div>
            <p class="muted small-text">A rental can support bounded surface expression. A common or partner-private room routes through the Household Agreement Engine.</p>
          </div>

          <div class="subtle-card">
            <h4 class="card-title">Wall / door / open connection <small>${escapeHtml(this.authorityLabel(structureAuthority))}</small></h4>
            <div class="stack tight">
              <select id="habitatEdge" class="select-input habitat-edge-select">${edges.map((edge) => `<option value="${edge.key}" ${edge.key === preferredEdge?.key ? 'selected' : ''}>${escapeHtml(edge.label)}</option>`).join('')}</select>
              <div class="form-row">
                <select id="habitatPartitionKind" class="select-input"><option value="door">Door</option><option value="wall">Wall</option><option value="open">Open connection</option></select>
                <select id="habitatWallMaterial" class="select-input">${Habitats.WALL_MATERIALS.map((material) => `<option value="${material.id}">${escapeHtml(material.name)}</option>`).join('')}</select>
                <button class="button ${structureAuthority.mode === 'denied' ? 'ghost' : 'primary'}" data-action="request-partition-project" data-property="${property.id}" ${structureAuthority.mode === 'denied' ? 'disabled' : ''}>Plan structure</button>
              </div>
            </div>
            <p class="muted small-text">A partition plan is rejected when it would strand a room. Furniture may be reflowed or stored with its owner, but never silently deleted.</p>
          </div>

          <div class="subtle-card">
            <h4 class="card-title">Services and repair <small>Separate capability layers</small></h4>
            <div class="form-row">
              <select id="habitatUtility" class="select-input">${Habitats.UTILITY_TYPES.map((type) => `<option value="${type}" ${selectedRoom.utilityAccess[type] ? 'disabled' : ''}>${Core.titleCase(type)}${selectedRoom.utilityAccess[type] ? ' · already present' : ''}</option>`).join('')}</select>
              <button class="button" data-action="request-utility-project" data-property="${property.id}" data-room="${selectedRoom.id}" ${structureAuthority.mode === 'denied' ? 'disabled' : ''}>Plan utility</button>
              <button class="button" data-action="request-repair-project" data-property="${property.id}" ${property.ownerId !== 'player' || habitat.structuralCondition >= 99 ? 'disabled' : ''}>Repair structure · ${Math.round(habitat.structuralCondition)}%</button>
            </div>
            <p class="muted small-text">Food fixtures require power, water, and waste in the same real room. Activity and lighting objects require power.</p>
          </div>
        </div>

        <div class="project-queue">
          <h4 class="card-title">Construction queue <small>${projects.length} recorded project${projects.length === 1 ? '' : 's'}</small></h4>
          ${projects.length ? projects.map((project) => this.renderHabitatProject(world, property, project)).join('') : '<div class="empty-state">No project has been planned. Existing rooms are fully real state even before the first renovation.</div>'}
        </div>
      </div></section>`;
    },

    authorityLabel(authority) {
      if (!authority) return 'authority unknown';
      if (authority.mode === 'direct') return 'direct authority';
      if (authority.mode === 'proposal') return 'requires accepted household proposal';
      if (authority.mode === 'approved_proposal') return 'approved household authority';
      return authority.reason || 'denied';
    },

    renderHabitatProject(world, property, project) {
      const current = project.phases[project.phaseIndex];
      const percent = project.phases.length ? Math.round((project.completedPhaseIds.length / project.phases.length) * 100) : 0;
      const statusTone = project.status === 'completed' ? 'good' : project.status === 'failed' ? 'bad' : project.status === 'cancelled' ? 'warn' : 'info';
      return `<article class="construction-card status-${project.status}">
        <div class="proposal-head"><div><span class="proposal-type">${escapeHtml(Core.titleCase(project.spec.type))} project</span><h4>${escapeHtml(project.summary)}</h4><p>Planned day ${project.createdDay} · authority ${escapeHtml(Core.titleCase(project.authority.mode))} · layout revision ${project.layoutRevisionAtPlan}</p></div><span class="pill ${statusTone}">${escapeHtml(Core.titleCase(project.status))}</span></div>
        <div class="construction-progress"><span style="--value:${percent}%"></span></div>
        <div class="phase-track">${project.phases.map((phase, index) => `<div class="phase-step ${project.completedPhaseIds.includes(phase.id) ? 'complete' : index === project.phaseIndex && ['planned', 'active'].includes(project.status) ? 'current' : ''}"><strong>${escapeHtml(phase.name)}</strong><span>${phase.hours}h · ${Core.formatMoney(phase.money)}${Object.keys(phase.materials).length ? ` · ${escapeHtml(Object.entries(phase.materials).map(([key, amount]) => `${amount} ${key}`).join(' + '))}` : ''}</span></div>`).join('')}</div>
        ${project.failureReason ? `<div class="callout danger">${escapeHtml(project.failureReason)}</div>` : ''}
        ${['planned', 'active'].includes(project.status) ? `<div class="property-actions"><button class="button primary" data-action="work-habitat-project" data-id="${project.id}"><strong>${current ? `Complete: ${escapeHtml(current.name)}` : 'Validate completion'}</strong><span>${current ? `${current.hours}h · ${Core.formatMoney(current.money)}` : 'Run final invariant checks'}</span></button><button class="button danger small" data-action="cancel-habitat-project" data-id="${project.id}">Cancel remaining work</button></div>` : ''}
        <details class="proposal-history"><summary>Project evidence · ${project.history.length} events · spent ${Core.formatMoney(project.spent.money)}</summary><div class="history-list">${project.history.slice().reverse().map((entry) => this.renderHistoryEntry(entry)).join('')}</div></details>
      </article>`;
    },

    findSelectedObject(world, home) {
      const id = world.ui.selectedObjectId;
      if (id) {
        const placed = home.furniture.find((object) => object.id === id);
        if (placed) return placed;
        const stored = (world.player.storedFurniture || []).find((object) => object.id === id);
        if (stored) return stored;
      }
      return home.furniture.find((object) => object.ownerId === 'player') || home.furniture[0] || null;
    },

    findObjectLocation(world, objectId) {
      for (const property of world.places.filter((place) => place.kind === 'residential')) {
        const object = property.furniture.find((entry) => entry.id === objectId);
        if (object) return { object, property, stored: false };
      }
      const object = (world.player.storedFurniture || []).find((entry) => entry.id === objectId);
      return object ? { object, property: null, stored: true } : null;
    },

    renderObjectInspector(world, object, currentHome) {
      if (!object) return '<section class="card"><div class="card-inner"><div class="empty-state">Select an object in the room.</div></div></section>';
      const location = this.findObjectLocation(world, object.id);
      const definition = Content.furnitureById(object.catalogId);
      const stats = Core.computeObjectStats(definition, object);
      const playerOwned = object.ownerId === 'player';
      const propertyOwned = object.ownershipMode === 'property_fixture';
      const editablePlayerObject = playerOwned && (location?.stored || location?.property?.id === world.player.homePropertyId);
      const owner = World.getPerson(world, object.ownerId);
      const ownerLabel = propertyOwned ? `${location.property.ownerLabel} · property fixture` : playerOwned ? 'You' : owner?.name || object.ownerId;
      const history = (object.history || []).slice(-8).reverse();
      return `
        <section class="card"><div class="card-inner object-panel">
          <div>
            <div class="catalog-head">
              <div><h3 class="card-title" style="margin-bottom:3px">${escapeHtml(definition.name)}</h3><div class="muted small-text">Owned by ${escapeHtml(ownerLabel)} · condition ${Math.round(object.condition)} · identity ${Math.round(stats.identity)}</div></div>
              <div class="place-swatch" style="background:${Content.paletteById(object.colorId).hex};color:${Core.contrastingText(Content.paletteById(object.colorId).hex)}">${escapeHtml(definition.symbol)}</div>
            </div>
            <div class="pill-row" style="margin-top:9px">${definition.signature.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join('')}</div>
          </div>
          <div class="object-stats">
            ${['comfort', 'beauty', 'utility', 'durability', 'efficiency', 'viability'].map((key) => this.renderObjectStat(key, stats[key])).join('')}
          </div>
          ${editablePlayerObject ? this.renderPlayerObjectControls(world, object, definition, location, propertyOwned) : playerOwned ? `
            <div class="callout warning">You still own this object, but it is inside a resident-authored home. Ownership does not grant remote build control while that interior is occupied; move or tenancy systems must return it through an explicit world action.</div>` : `
            <div class="callout warning">This object belongs to ${escapeHtml(ownerLabel)}. You may observe its evolution but cannot directly move, recolor, store, or upgrade it.</div>`}
          <div>
            <h4 class="card-title">Object history <small>${object.history.length} events</small></h4>
            <div class="history-list">${history.length ? history.map((entry) => this.renderHistoryEntry(entry)).join('') : '<div class="empty-state">Its story has only just begun.</div>'}</div>
          </div>
        </div></section>
      `;
    },

    renderPlayerObjectControls(world, object, definition, location, propertyFixture = false) {
      const stored = location?.stored;
      return `
        <div class="subtle-card">
          <h4 class="card-title">Position and preservation</h4>
          <div class="form-row">
            ${stored ? `<button class="button primary" data-action="place-stored" data-id="${object.id}">Place in current home</button>` : propertyFixture ? `
              <span class="pill warn">Bound to this property</span>
              <button class="button small" data-action="repair-object" data-id="${object.id}">Repair fixture</button>` : `
              <button class="icon-button" data-action="move-object" data-id="${object.id}" data-dx="0" data-dy="-1" title="Move up">↑</button>
              <button class="icon-button" data-action="move-object" data-id="${object.id}" data-dx="-1" data-dy="0" title="Move left">←</button>
              <button class="icon-button" data-action="move-object" data-id="${object.id}" data-dx="1" data-dy="0" title="Move right">→</button>
              <button class="icon-button" data-action="move-object" data-id="${object.id}" data-dx="0" data-dy="1" title="Move down">↓</button>
              <button class="button small" data-action="rotate-object" data-id="${object.id}">Rotate</button>
              <button class="button small" data-action="repair-object" data-id="${object.id}">Repair</button>
              <button class="button small" data-action="store-object" data-id="${object.id}">Store, never delete</button>`}
          </div>
        </div>
        <div class="subtle-card">
          <h4 class="card-title">Finish <small>Costs 1 paint</small></h4>
          <div class="palette">
            ${Content.PALETTE.map((color) => `<button class="color-button ${object.colorId === color.id ? 'selected' : ''}" style="background:${color.hex}" data-action="recolor-object" data-id="${object.id}" data-color="${color.id}" title="${escapeAttr(color.name)}"></button>`).join('')}
          </div>
        </div>
        <div class="subtle-card">
          <h4 class="card-title">Upgrade this object, not its replacement</h4>
          <div class="stack">
            ${Systems.UPGRADE_AXES.map((axis) => {
              const level = object.upgrades[axis];
              const cost = Core.objectUpgradeCost(definition, object, axis);
              const materials = Object.entries(cost.materials).filter(([, qty]) => qty > 0).map(([id, qty]) => `${qty} ${Content.MATERIALS[id].name}`).join(' + ') || 'no materials';
              return `<button class="button ${level >= 5 ? 'ghost' : ''}" data-action="upgrade-object" data-id="${object.id}" data-axis="${axis}" ${level >= 5 ? 'disabled' : ''}>
                <strong>${Core.titleCase(axis)} · level ${level}/5 ${level >= 5 ? '· complete' : `· ${Core.formatMoney(cost.money)}`}</strong>
                <span>${level >= 5 ? 'This dimension has reached its full development.' : materials}</span>
              </button>`;
            }).join('')}
          </div>
        </div>
      `;
    },

    renderObjectStat(key, value) {
      const color = value < 35 ? '#d47974' : value < 65 ? '#d6a659' : '#76c69a';
      return `<div class="object-stat-row"><span>${Core.titleCase(key)}</span><div class="meter"><span style="--value:${value}%;--meter-color:${color}"></span></div><strong>${Math.round(value)}</strong></div>`;
    },

    renderCatalogCard(world, definition) {
      const affordable = world.player.money >= definition.price;
      return `
        <article class="catalog-card">
          <div class="catalog-head"><div><h4>${escapeHtml(definition.name)}</h4><p>${escapeHtml(definition.signature.join(' · '))}</p></div><span class="pill ${affordable ? 'good' : ''}">${Core.formatMoney(definition.price)}</span></div>
          <div class="pill-row" style="margin-top:8px">${definition.styleTags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join('')}<span class="pill">${definition.footprint[0]}×${definition.footprint[1]}</span></div>
          <div class="catalog-actions"><button class="button small ${affordable ? 'primary' : ''}" data-action="buy-furniture" data-id="${definition.id}" ${affordable ? '' : 'disabled'}>Place in home</button></div>
        </article>`;
    },

    renderStoredObjects(world) {
      const stored = world.player.storedFurniture || [];
      return `
        <section class="card"><div class="card-inner">
          <h3 class="card-title">Stored objects <small>No-loss alternative to deletion</small></h3>
          ${stored.length ? `<div class="grid-3">${stored.map((object) => {
            const definition = Content.furnitureById(object.catalogId);
            return `<article class="catalog-card"><h4>${escapeHtml(definition.name)}</h4><p>Condition ${Math.round(object.condition)} · ${Core.sumObjectUpgrades(object)} upgrade levels · ${object.history.length} history events</p><div class="catalog-actions"><button class="button small" data-action="select-object" data-id="${object.id}">Inspect</button><button class="button small primary" data-action="place-stored" data-id="${object.id}">Place</button></div></article>`;
          }).join('')}</div>` : '<div class="empty-state">Nothing is stored. Objects placed in homes retain their history.</div>'}
        </div></section>`;
    },

    renderPeople(world) {
      const sorted = world.people.slice().sort((a, b) => {
        const relationA = world.player.relationships[a.id]?.friendship || 0;
        const relationB = world.player.relationships[b.id]?.friendship || 0;
        const roommateA = a.homePropertyId === world.player.homePropertyId ? 1 : 0;
        const roommateB = b.homePropertyId === world.player.homePropertyId ? 1 : 0;
        return roommateB - roommateA || relationB - relationA || a.name.localeCompare(b.name);
      });
      const selectedId = world.ui.selectedPersonId && world.ui.selectedPersonId !== 'player' ? world.ui.selectedPersonId : sorted[0]?.id;
      const selected = World.getPerson(world, selectedId);
      return `
        <div class="view-title-row">
          <div>
            <h2>Influence without possession</h2>
            <p>Talking, helping, dating, living together, and offering suggestions can change relationships and environments. None of those actions grants direct control over the other resident.</p>
          </div>
          <div class="pill-row"><span class="pill good">${Object.values(world.player.relationships).filter((relation) => relation.friendship >= 45).length} friends</span><span class="pill">${world.player.influenceActions} explicit influence attempts</span></div>
        </div>
        <div class="split">
          <section class="card"><div class="card-inner">
            <h3 class="card-title">Residents <small>Sorted by shared home and relationship</small></h3>
            <div class="grid-3">
              ${sorted.map((person) => this.renderPersonCard(world, person, selectedId)).join('')}
            </div>
          </div></section>
          <aside class="stack">
            ${selected ? this.renderPersonInspector(world, selected) : '<div class="empty-state">Select a resident.</div>'}
          </aside>
        </div>
      `;
    },

    renderPersonCard(world, person, selectedId) {
      const relation = world.player.relationships[person.id] || { friendship: 0, romance: 0, trust: 0, status: 'stranger', interactions: 0 };
      const home = World.homeOf(world, person.id);
      const job = Content.jobById(person.jobId);
      const dependent = Family.isDependent(person);
      const stage = person.lifeCourse?.stage || Family.stageForAge(person.age);
      const role = dependent ? `${Core.titleCase(stage)} · family dependent` : (job?.name || 'Between jobs');
      return `
        <article class="person-card ${selectedId === person.id ? 'selected' : ''}">
          <div class="person-head">
            <div class="avatar">${escapeHtml(initials(person.name))}</div>
            <div class="person-name-block"><h4>${escapeHtml(person.name)}</h4><p>${escapeHtml(Core.relationshipLabel(relation))} · ${escapeHtml(person.pronouns)}</p></div>
          </div>
          <p>${escapeHtml(person.activity)}</p>
          <div class="pill-row" style="margin-top:8px"><span class="pill">${escapeHtml(home?.name || 'No fixed home')}</span><span class="pill ${dependent ? 'info' : ''}">${escapeHtml(role)}</span></div>
          <div class="person-actions"><button class="button small" data-action="select-person" data-id="${person.id}">Open</button>${dependent ? `<button class="button small primary" data-action="select-dependent" data-id="${person.id}">Family view</button>` : `<button class="button small" data-action="social" data-id="${person.id}" data-kind="talk">Talk · 1h</button>`}</div>
        </article>`;
    },

    renderPersonInspector(world, person) {
      if (Family.isDependent(person)) return this.renderDependentPersonInspector(world, person);
      const relation = world.player.relationships[person.id] || { friendship: 0, romance: 0, trust: 0, status: 'stranger', interactions: 0 };
      const home = World.homeOf(world, person.id);
      const job = Content.jobById(person.jobId);
      const knowsGoal = (person.knownFacts || []).includes('personalGoal') || relation.interactions >= 2;
      const knowsPrefs = (person.knownFacts || []).includes('preferences') || relation.interactions >= 3;
      const household = Households.playerHousehold(world);
      const isAgreementPartner = household && Households.partnerIdFor(household) === person.id;
      const pendingCommitment = world.householdProposals.find((proposal) => proposal.type === 'commitment'
        && ['pending_npc', 'awaiting_player'].includes(proposal.status)
        && (proposal.proposerId === person.id || proposal.recipientIds.includes(person.id)));
      const commitmentEligible = !household && ['dating', 'partner'].includes(relation.status)
        && relation.friendship >= 50 && relation.trust >= 38 && relation.romance >= 30;
      const agreementAction = isAgreementPartner
        ? `<button class="button primary" data-action="open-agreements"><strong>Open household agreement</strong><span>Money, space, moves, goals, repairs, and consent evidence.</span></button>`
        : pendingCommitment
          ? `<button class="button" data-action="open-agreements"><strong>Commitment conversation is open</strong><span>Review the waiting proposal without treating silence as consent.</span></button>`
          : commitmentEligible
            ? `<button class="button secondary" data-action="propose-commitment" data-id="${person.id}"><strong>Propose commitment · 1h</strong><span>This creates a conversation, not an instant household or direct control.</span></button>`
            : !household && ['dating', 'partner'].includes(relation.status)
              ? `<button class="button ghost" disabled><strong>Commitment is not grounded yet</strong><span>More friendship, trust, and mutual romance are needed.</span></button>`
              : '';
      const impressions = relation.interactions >= 2 ? [
        Core.traitLabel(person.traits.social, 'private', 'outgoing'),
        Core.traitLabel(person.traits.thrift, 'spontaneous spender', 'careful with money'),
        Core.traitLabel(person.traits.creativity, 'practical', 'experimental'),
        Core.traitLabel(person.traits.independence, 'interdependent', 'strongly independent')
      ] : [];
      return `
        <section class="card"><div class="card-inner stack">
          <div class="person-head"><div class="avatar">${escapeHtml(initials(person.name))}</div><div class="person-name-block"><h3 style="margin:0">${escapeHtml(person.name)}</h3><p>${escapeHtml(Core.relationshipLabel(relation))} · ${escapeHtml(lifeContextLabel(world, person))}</p></div></div>
          <div class="object-stats">
            ${this.renderObjectStat('friendship', Core.clamp(relation.friendship, 0, 100))}
            ${this.renderObjectStat('trust', Core.clamp(relation.trust, 0, 100))}
            ${this.renderObjectStat('romance', Core.clamp(relation.romance, 0, 100))}
          </div>
          <div class="kv-list">
            <div class="kv-row"><span>Home</span><strong>${escapeHtml(home?.name || 'No fixed home')}</strong></div>
            <div class="kv-row"><span>Work</span><strong>${escapeHtml(job?.name || 'Between jobs')}</strong></div>
            <div class="kv-row"><span>Current activity</span><strong>${escapeHtml(person.activity)}</strong></div>
            <div class="kv-row"><span>Life direction</span><strong>${knowsGoal ? escapeHtml(person.personalGoal) : 'Learn through more contact'}</strong></div>
          </div>
          ${impressions.length ? `<div class="pill-row">${impressions.map((label) => `<span class="pill">${escapeHtml(label)}</span>`).join('')}</div>` : '<div class="callout">Personality values are not exposed as an omniscient spreadsheet. Repeated contact reveals useful impressions.</div>'}
          ${knowsPrefs ? `<div><div class="muted small-text" style="margin-bottom:6px">Known color preferences</div><div class="palette">${person.preferences.colors.map((id) => `<span class="color-button" style="display:inline-block;background:${Content.paletteById(id).hex}" title="${escapeAttr(Content.paletteById(id).name)}"></span>`).join('')}</div></div>` : ''}
          <div class="button-grid">
            <button class="button" data-action="social" data-id="${person.id}" data-kind="talk"><strong>Talk · 1h</strong><span>Learn slowly and improve familiarity.</span></button>
            <button class="button" data-action="social" data-id="${person.id}" data-kind="spend_time"><strong>Spend time · 2h</strong><span>Stronger friendship, but costs real time.</span></button>
            <button class="button" data-action="social" data-id="${person.id}" data-kind="help"><strong>Help · 2h</strong><span>Trust grows through a concrete act.</span></button>
            <button class="button" data-action="social" data-id="${person.id}" data-kind="flirt"><strong>Flirt · 1h</strong><span>The response is theirs.</span></button>
            <button class="button" data-action="social" data-id="${person.id}" data-kind="ask_date"><strong>Ask on a date · 1h</strong><span>Requires a real foundation.</span></button>
            ${agreementAction}
          </div>
          <div class="subtle-card">
            <h4 class="card-title">Offer a décor suggestion <small>They can refuse</small></h4>
            <div class="palette">${Content.PALETTE.map((color) => `<button class="color-button ${world.ui.selectedSuggestionColor === color.id ? 'selected' : ''}" style="background:${color.hex}" data-action="suggestion-color" data-color="${color.id}" title="${escapeAttr(color.name)}"></button>`).join('')}</div>
            <button class="button secondary" style="margin-top:10px;width:100%" data-action="social" data-id="${person.id}" data-kind="decor_suggestion">Suggest ${escapeHtml(Content.paletteById(world.ui.selectedSuggestionColor).name)} for one of their objects</button>
          </div>
          ${home ? `<div class="grid-2"><button class="button ghost" data-action="select-place" data-id="${home.id}">Inspect property history</button><button class="button" data-action="view-property" data-id="${home.id}">View their interior</button></div>` : ''}
        </div></section>`;
    },

    renderDependentPersonInspector(world, person) {
      const relation = world.player.relationships[person.id] || { friendship: 0, romance: 0, trust: 0, status: 'family', interactions: 0 };
      const home = World.homeOf(world, person.id);
      const unit = Family.familyUnitById(world, person.familyUnitId);
      const stage = person.lifeCourse?.stage || Family.stageForAge(person.age);
      const assignment = unit?.roomAssignments?.find((entry) => entry.personId === person.id);
      const room = assignment && home ? Habitats.roomById(home, assignment.roomId) : null;
      const record = unit ? Family.careRecordForDay(world, unit, person.id, false) : null;
      return `
        <section class="card"><div class="card-inner stack">
          <div class="person-head"><div class="avatar">${escapeHtml(initials(person.name))}</div><div class="person-name-block"><h3 style="margin:0">${escapeHtml(person.name)}</h3><p>Autonomous ${escapeHtml(lifeContextLabel(world, person))} · ${escapeHtml(person.pronouns)}</p></div></div>
          <div class="callout">${escapeHtml(person.personalGoal || 'Develop through care, relationships, environment, and personal choices.')}</div>
          <div class="object-stats">
            ${this.renderObjectStat('security', Core.clamp(person.development?.security || 0, 0, 100))}
            ${this.renderObjectStat('curiosity', Core.clamp(person.development?.curiosity || 0, 0, 100))}
            ${this.renderObjectStat('independence', Core.clamp(person.development?.independence || 0, 0, 100))}
          </div>
          <div class="kv-list">
            <div class="kv-row"><span>Home</span><strong>${escapeHtml(home?.name || 'No fixed home')}</strong></div>
            <div class="kv-row"><span>Room boundary</span><strong>${escapeHtml(room?.label || room?.purpose || assignment?.kind || 'Shared household space')}</strong></div>
            <div class="kv-row"><span>Education</span><strong>${escapeHtml(Core.titleCase(person.education?.mode || 'not recorded'))}</strong></div>
            <div class="kv-row"><span>Current focus</span><strong>${escapeHtml(Core.titleCase(person.education?.currentFocus || 'exploration'))}</strong></div>
            <div class="kv-row"><span>Care today</span><strong>${record ? `${Core.round(record.playerHours + record.partnerHours + record.communityHours, 1)} / ${record.requiredHours}h` : 'No finalized evidence yet'}</strong></div>
            <div class="kv-row"><span>Personal objects</span><strong>${home ? home.furniture.filter((object) => object.ownerId === person.id).length : 0} placed · ${(person.storedFurniture || []).length} stored</strong></div>
          </div>
          <div class="object-stats">
            ${this.renderObjectStat('friendship', Core.clamp(relation.friendship, 0, 100))}
            ${this.renderObjectStat('trust', Core.clamp(relation.trust, 0, 100))}
            ${this.renderObjectStat('mood', Core.clamp(person.needs?.mood || 0, 0, 100))}
          </div>
          <div class="button-grid">
            <button class="button primary" data-action="select-dependent" data-id="${person.id}"><strong>Open family continuity</strong><span>Care, education, rooms, history, and autonomous responses.</span></button>
            ${home ? `<button class="button" data-action="view-property" data-id="${home.id}"><strong>View home</strong><span>Personal objects retain their owner and history.</span></button>` : ''}
          </div>
          <div class="callout warning">Adult romance and generic social-control actions are intentionally unavailable here. Family care uses its own evidence and authority path.</div>
        </div></section>`;
    },

    renderAgreements(world) {
      const household = Households.playerHousehold(world);
      const waiting = world.householdProposals.filter((proposal) => ['pending_npc', 'awaiting_player'].includes(proposal.status));
      return `
        <div class="view-title-row">
          <div>
            <h2>Household agreements, not household ownership</h2>
            <p>Commitment, living together, money, rooms, moves, shared goals, and changes to a partner’s belongings happen through proposals with visible terms. Silence is never consent, either person can refuse, and acceptance does not turn another resident into a playable unit.</p>
          </div>
          <div class="pill-row">
            <span class="pill ${household ? 'good' : 'info'}">${household ? `Agreement revision ${household.revision}` : 'No active agreement'}</span>
            <span class="pill ${waiting.some((proposal) => proposal.status === 'awaiting_player') ? 'warn' : ''}">${waiting.length} waiting proposal${waiting.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        ${household ? this.renderActiveAgreement(world, household) : this.renderAgreementOnboarding(world)}
      `;
    },

    renderAgreementOnboarding(world) {
      const proposals = world.householdProposals
        .filter((proposal) => proposal.type === 'commitment' && (proposal.proposerId === 'player' || proposal.recipientIds.includes('player')))
        .slice().sort((a, b) => b.createdDay - a.createdDay || b.createdHour - a.createdHour);
      const endedAgreements = world.households.filter((household) => household.status === 'ended' && household.memberIds.includes('player'))
        .slice().sort((a, b) => (b.endedDay || 0) - (a.endedDay || 0));
      const candidates = world.people.filter((person) => {
        const relation = world.player.relationships[person.id];
        return relation && ['dating', 'partner'].includes(relation.status);
      }).sort((a, b) => {
        const ra = world.player.relationships[a.id];
        const rb = world.player.relationships[b.id];
        return (rb.trust + rb.friendship + rb.romance) - (ra.trust + ra.friendship + ra.romance);
      });
      return `
        <div class="split">
          <div class="stack">
            ${proposals.some((proposal) => ['pending_npc', 'awaiting_player'].includes(proposal.status)) ? `
              <section class="card agreement-highlight"><div class="card-inner">
                <h3 class="card-title">A commitment conversation is open <small>No answer is manufactured</small></h3>
                <div class="stack">${proposals.filter((proposal) => ['pending_npc', 'awaiting_player'].includes(proposal.status)).map((proposal) => this.renderProposalCard(world, proposal)).join('')}</div>
              </div></section>` : ''}
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Possible commitment conversations <small>Dating is not already a household contract</small></h3>
              ${candidates.length ? `<div class="grid-2">${candidates.map((person) => {
                const relation = world.player.relationships[person.id];
                const eligible = relation.friendship >= 50 && relation.trust >= 38 && relation.romance >= 30;
                const pending = proposals.find((proposal) => ['pending_npc', 'awaiting_player'].includes(proposal.status)
                  && (proposal.proposerId === person.id || proposal.recipientIds.includes(person.id)));
                return `<article class="agreement-card">
                  <div class="person-head"><div class="avatar">${escapeHtml(initials(person.name))}</div><div class="person-name-block"><h4>${escapeHtml(person.name)}</h4><p>${escapeHtml(Core.relationshipLabel(relation))} · still autonomous</p></div></div>
                  <div class="object-stats" style="margin-top:10px">
                    ${this.renderObjectStat('friendship', Core.clamp(relation.friendship, 0, 100))}
                    ${this.renderObjectStat('trust', Core.clamp(relation.trust, 0, 100))}
                    ${this.renderObjectStat('romance', Core.clamp(relation.romance, 0, 100))}
                  </div>
                  <div class="property-actions">
                    <button class="button small" data-action="select-person" data-id="${person.id}">Open person</button>
                    ${pending ? '<span class="pill warn">Conversation already open</span>' : `<button class="button small ${eligible ? 'primary' : ''}" data-action="propose-commitment" data-id="${person.id}" ${eligible ? '' : 'disabled'}>${eligible ? 'Propose commitment · 1h' : 'More trust and connection needed'}</button>`}
                  </div>
                </article>`;
              }).join('')}</div>` : '<div class="empty-state">No dating relationship is ready for a household conversation. Relationships can continue in People without being forced toward cohabitation.</div>'}
            </div></section>
            ${endedAgreements.length ? `<section class="card"><div class="card-inner">
              <h3 class="card-title">Ended agreements <small>History is preserved without keeping anyone trapped</small></h3>
              <div class="stack">${endedAgreements.map((household) => {
                const partnerId = household.memberIds.find((id) => id !== 'player');
                const partner = World.getPerson(world, partnerId);
                const endedEvent = household.history.slice().reverse().find((entry) => entry.type === 'ended');
                return `<article class="proposal-card status-ended"><div class="proposal-head"><div><span class="proposal-type">Former household agreement</span><h4>${escapeHtml(world.player.name)} + ${escapeHtml(partner?.name || partnerId)}</h4><p>Ended day ${household.endedDay ?? '?'} · ${escapeHtml(Core.titleCase(household.endMode || 'ended'))}</p></div><span class="pill">Revision ${household.revision}</span></div>${endedEvent ? `<div class="callout">${escapeHtml(endedEvent.message)}</div>` : ''}<details class="proposal-history"><summary>${household.history.length} preserved history event${household.history.length === 1 ? '' : 's'}</summary><div class="history-list">${household.history.slice(-10).reverse().map((entry) => this.renderHistoryEntry(entry)).join('')}</div></details></article>`;
              }).join('')}</div>
            </div></section>` : ''}
            ${proposals.filter((proposal) => !['pending_npc', 'awaiting_player'].includes(proposal.status)).length ? `
              <section class="card"><div class="card-inner">
                <h3 class="card-title">Previous commitment conversations <small>Refusals and withdrawals remain evidence</small></h3>
                <div class="stack">${proposals.filter((proposal) => !['pending_npc', 'awaiting_player'].includes(proposal.status)).slice(0, 8).map((proposal) => this.renderProposalCard(world, proposal)).join('')}</div>
              </div></section>` : ''}
          </div>
          <aside class="stack">
            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">What commitment does—and does not—do</h3>
              <div class="agreement-principle"><strong>Creates</strong><span>A revisable agreement record, a shared conversation space, and permission to propose cohabitation.</span></div>
              <div class="agreement-principle"><strong>Preserves</strong><span>Separate identities, separate money, object ownership, refusal, private space, and independent schedules.</span></div>
              <div class="agreement-principle"><strong>Does not create</strong><span>Direct NPC control, automatic access to their belongings, merged bank accounts, or consent inferred from romance statistics.</span></div>
            </div></section>
            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Labeled prototype experiment</h3>
              <p class="muted small-text">This prepares one compatible resident and adds test money so the agreement engine can be explored without grinding through unfinished progression. The ledger records the intervention.</p>
              <button class="button secondary" data-action="prepare-household-experiment" ${world.flags.householdExperimentPrepared ? 'disabled' : ''}>${world.flags.householdExperimentPrepared ? 'Experiment setup already used' : 'Prepare consent-system test state'}</button>
            </div></section>
          </aside>
        </div>
      `;
    },

    renderActiveAgreement(world, household) {
      const partner = Households.partnerFor(world, household);
      const relation = world.player.relationships[partner.id];
      const cohabiting = Households.isCohabiting(world, household);
      const home = household.homePropertyId ? World.getProperty(world, household.homePropertyId) : null;
      const proposals = world.householdProposals
        .filter((proposal) => proposal.householdId === household.id || (proposal.type === 'commitment' && (proposal.proposerId === partner.id || proposal.recipientIds.includes(partner.id))))
        .slice().sort((a, b) => {
          const waitingA = ['awaiting_player', 'pending_npc'].includes(a.status) ? 1 : 0;
          const waitingB = ['awaiting_player', 'pending_npc'].includes(b.status) ? 1 : 0;
          return waitingB - waitingA || b.createdDay - a.createdDay || b.createdHour - a.createdHour;
        });
      const incoming = proposals.filter((proposal) => proposal.status === 'awaiting_player');
      const outgoing = proposals.filter((proposal) => proposal.status === 'pending_npc');
      const openIssues = household.unresolvedIssueIds.map((id) => Households.issueById(world, id)).filter((issue) => issue?.status === 'open');
      const moves = Households.eligibleJointMoveProperties(world, household).filter((property) => !cohabiting || property.id !== household.homePropertyId);
      const partnerObjects = home ? home.furniture.filter((object) => object.ownerId === partner.id && object.ownershipMode !== 'property_fixture') : [];
      const exitProperties = Households.eligiblePlayerExitProperties(world, household);
      const finance = household.agreement.finances;
      const zones = household.agreement.space.zones || [];
      const activeGoals = household.agreement.goals.filter((goal) => ['active', 'complete'].includes(goal.status));
      const waitingTypes = new Set(proposals.filter((proposal) => ['pending_npc', 'awaiting_player'].includes(proposal.status)).map((proposal) => proposal.type));
      return `
        <div class="stack">
          ${incoming.length ? `<section class="card agreement-highlight"><div class="card-inner"><h3 class="card-title">${escapeHtml(partner.name)} is asking for your answer <small>A boundary is valid</small></h3><div class="stack">${incoming.map((proposal) => this.renderProposalCard(world, proposal)).join('')}</div></div></section>` : ''}
          <div class="split">
            <div class="stack">
              <section class="card"><div class="card-inner">
                <div class="agreement-hero">
                  <div class="avatar large">${escapeHtml(initials(partner.name))}</div>
                  <div><h3>${escapeHtml(world.player.name)} + ${escapeHtml(partner.name)}</h3><p>Committed partners · agreement created day ${household.createdDay} · revision ${household.revision}</p></div>
                  <span class="pill ${cohabiting ? 'good' : 'info'}">${cohabiting ? `Shared home: ${escapeHtml(home.name)}` : 'Separate homes'}</span>
                </div>
                <div class="grid-4" style="margin-top:14px">
                  ${this.metricCard('Agreement revision', household.revision, 'Changes require accepted proposals')}
                  ${this.metricCard('Shared reserve', Core.formatMoney(household.sharedReserve), 'Personal accounts remain separate')}
                  ${this.metricCard('Household strain', Core.round(household.strain, 1), `${openIssues.length} open issue${openIssues.length === 1 ? '' : 's'}`)}
                  ${this.metricCard('Relationship trust', Core.round(relation.trust, 1), 'Still a relationship, not a control score')}
                </div>
                <div class="divider"></div>
                <div class="grid-2">
                  <div class="subtle-card">
                    <h4 class="card-title">Agency contract</h4>
                    <div class="kv-list">
                      <div class="kv-row"><span>Personal accounts</span><strong>${finance.personalAccountsRemainSeparate ? 'Separate' : 'Invalid state'}</strong></div>
                      <div class="kv-row"><span>Shared reserve use</span><strong>${finance.sharedReserveRequiresMutualConsent ? 'Mutual consent' : 'Invalid state'}</strong></div>
                      <div class="kv-row"><span>Relocation</span><strong>${household.agreement.relocation.requiresUnanimousConsent ? 'Unanimous' : 'Invalid state'}</strong></div>
                      <div class="kv-row"><span>Partner objects</span><strong>${household.agreement.renovation.partnerObjectsRequireOwnerConsent ? 'Owner permission' : 'Invalid state'}</strong></div>
                      <div class="kv-row"><span>Right to leave</span><strong>${household.agreement.dissolution.exitIsUnilateral ? 'Unilateral' : 'Invalid state'}</strong></div>
                      <div class="kv-row"><span>Forced eviction</span><strong>${household.agreement.dissolution.noForcedEviction ? 'Forbidden' : 'Invalid state'}</strong></div>
                    </div>
                  </div>
                  <div class="subtle-card">
                    <h4 class="card-title">Current expense plan</h4>
                    <div class="kv-list">
                      <div class="kv-row"><span>Mode</span><strong>${escapeHtml(Core.titleCase(finance.mode))}</strong></div>
                      <div class="kv-row"><span>Your reference share</span><strong>${Math.round((finance.shares.player || 0) * 100)}%</strong></div>
                      <div class="kv-row"><span>${escapeHtml(partner.name)} reference share</span><strong>${Math.round((finance.shares[partner.id] || 0) * 100)}%</strong></div>
                      <div class="kv-row"><span>Weekly reserve target</span><strong>${Core.formatMoney(finance.weeklyReserveTarget)}</strong></div>
                    </div>
                  </div>
                </div>
              </div></section>

              <section class="card"><div class="card-inner">
                <h3 class="card-title">Open and recent proposals <small>${outgoing.length} waiting on ${escapeHtml(partner.name)}</small></h3>
                ${proposals.length ? `<div class="stack">${proposals.slice(0, 14).map((proposal) => this.renderProposalCard(world, proposal)).join('')}</div>` : '<div class="empty-state">The agreement exists, but no household change has been proposed yet.</div>'}
              </div></section>

              <section class="card"><div class="card-inner">
                <h3 class="card-title">Shared direction and history <small>Meaning survives beyond current stats</small></h3>
                ${activeGoals.length ? `<div class="grid-2">${activeGoals.map((goal) => `<article class="goal-card ${goal.status === 'complete' ? 'complete' : ''}"><h4>${escapeHtml(Core.titleCase(goal.type))}</h4><p>${Core.round(goal.progress, 1)} / ${Core.round(goal.target, 1)} · ${escapeHtml(Core.titleCase(goal.status))}</p><div class="meter"><span style="--value:${Core.clamp(goal.progress / Math.max(1, goal.target) * 100, 0, 100)}%"></span></div></article>`).join('')}</div>` : '<div class="callout">No shared goal is active. A goal can guide the household without becoming a mandatory optimization path.</div>'}
                <div class="divider"></div>
                <div class="history-list">${household.history.slice(-12).reverse().map((entry) => this.renderHistoryEntry(entry)).join('') || '<div class="empty-state">No household history yet.</div>'}</div>
              </div></section>
            </div>

            <aside class="stack">
              <section class="card"><div class="card-inner stack">
                <h3 class="card-title">Home and space permissions</h3>
                <div class="kv-list">
                  <div class="kv-row"><span>Living state</span><strong>${cohabiting ? 'Cohabiting' : 'Separate homes'}</strong></div>
                  <div class="kv-row"><span>Space mode</span><strong>${escapeHtml(Core.titleCase(household.agreement.space.mode))}</strong></div>
                  <div class="kv-row"><span>Edit rule</span><strong>Owner or accepted proposal</strong></div>
                </div>
                ${zones.length ? `<div class="zone-legend agreement-zones">${zones.map((zone) => `<span class="zone-chip zone-${escapeAttr(zone.kind)}">${escapeHtml(zone.label)}</span>`).join('')}</div>` : '<div class="callout">Private and common floor zones become active when you deliberately choose a shared home.</div>'}
                ${home ? `<button class="button" data-action="view-property" data-id="${home.id}"><strong>Open shared home</strong><span>See enforced zones and object ownership on the build grid.</span></button>` : ''}
              </div></section>

              <section class="card"><div class="card-inner stack">
                <h3 class="card-title">Propose a joint home <small>Never move by omission</small></h3>
                ${moves.length ? `<select id="hhMoveDestination" class="select-input full-width">${moves.map((property) => `<option value="${property.id}">${escapeHtml(property.name)} · ${Core.formatMoney(property.currentRent)} · condition ${Math.round(property.condition)}</option>`).join('')}</select><button class="button primary" data-action="propose-cohabitation" data-id="${partner.id}" ${waitingTypes.has(cohabiting ? 'relocation' : 'cohabitation') ? 'disabled' : ''}><strong>${cohabiting ? 'Propose moving together · 1h' : 'Propose living together · 1h'}</strong><span>Both object histories and both people move only after acceptance.</span></button>` : '<div class="empty-state">No pair-capable home is currently available without involving unrelated tenants.</div>'}
              </div></section>

              <section class="card"><div class="card-inner stack">
                <h3 class="card-title">Renegotiate money <small>Visible costs, separate accounts</small></h3>
                <label class="field-label" for="hhFinanceMode">Expense-sharing mode</label>
                <select id="hhFinanceMode" class="select-input full-width">
                  ${Households.FINANCE_MODES.map((mode) => `<option value="${mode}" ${finance.mode === mode ? 'selected' : ''}>${escapeHtml(Core.titleCase(mode))}</option>`).join('')}
                </select>
                <label class="field-label" for="hhReserveTarget">Weekly shared reserve target (€0–€120)</label>
                <input id="hhReserveTarget" class="text-input full-width" type="number" min="0" max="120" step="1" value="${finance.weeklyReserveTarget}">
                <button class="button" data-action="propose-finance" data-id="${household.id}" ${waitingTypes.has('finance') ? 'disabled' : ''}>Propose finance revision · 1h</button>
              </div></section>

              <section class="card"><div class="card-inner stack">
                <h3 class="card-title">Renegotiate space <small>Labels become build permissions</small></h3>
                <select id="hhSpaceMode" class="select-input full-width">${Households.SPACE_MODES.map((mode) => `<option value="${mode}" ${household.agreement.space.mode === mode ? 'selected' : ''}>${escapeHtml(Core.titleCase(mode))}</option>`).join('')}</select>
                <button class="button" data-action="propose-space" data-id="${household.id}" ${waitingTypes.has('space') ? 'disabled' : ''}>Propose space revision · 1h</button>
              </div></section>

              <section class="card"><div class="card-inner stack">
                <h3 class="card-title">Propose a shared goal <small>Optional direction, not a forced endgame</small></h3>
                <select id="hhGoalType" class="select-input full-width">${Households.GOAL_TYPES.map((type) => `<option value="${type}">${escapeHtml(Core.titleCase(type))}</option>`).join('')}</select>
                <input id="hhGoalTarget" class="text-input full-width" type="number" min="1" step="1" value="200" aria-label="Household goal target">
                <button class="button" data-action="propose-goal" data-id="${household.id}" ${waitingTypes.has('goal') ? 'disabled' : ''}>Propose shared goal · 1h</button>
              </div></section>

              ${cohabiting ? `<section class="card"><div class="card-inner stack">
                <h3 class="card-title">Ask about a partner-owned object <small>Ownership is not bypassed</small></h3>
                ${partnerObjects.length ? `
                  <select id="hhRenovationObject" class="select-input full-width">${partnerObjects.map((object) => `<option value="${object.id}">${escapeHtml(Content.furnitureById(object.catalogId).name)} · ${escapeHtml(Content.paletteById(object.colorId).name)}</option>`).join('')}</select>
                  <select id="hhRenovationKind" class="select-input full-width"><option value="partner_upgrade">Propose an upgrade</option><option value="partner_recolor">Propose a new finish</option></select>
                  <select id="hhRenovationAxis" class="select-input full-width">${Systems.UPGRADE_AXES.map((axis) => `<option value="${axis}">${escapeHtml(Core.titleCase(axis))}</option>`).join('')}</select>
                  <select id="hhRenovationColor" class="select-input full-width">${Content.PALETTE.map((color) => `<option value="${color.id}">${escapeHtml(color.name)}</option>`).join('')}</select>
                  <button class="button" data-action="propose-renovation" data-id="${household.id}" ${waitingTypes.has('renovation') ? 'disabled' : ''}>Ask owner and propose change · 1h</button>` : '<div class="empty-state">Your partner currently has no personally owned object in the shared home. Property fixtures are not falsely relabeled as theirs.</div>'}
              </div></section>` : ''}

              <section class="card"><div class="card-inner">
                <h3 class="card-title">Visible friction and repair <small>Conflict is not silently erased</small></h3>
                ${openIssues.length ? `<div class="stack">${openIssues.map((issue) => this.renderHouseholdIssueCard(world, household, issue)).join('')}</div>` : '<div class="callout">No unresolved household issue is open. Low strain can recover gradually, but recorded conflicts remain in history.</div>'}
              </div></section>

              <section class="card separation-card"><div class="card-inner stack">
                <h3 class="card-title">End this agreement <small>Leaving cannot require permission</small></h3>
                <p class="muted small-text">Ending preserves both identities and possessions. The shared reserve is returned using recorded contribution evidence, or equally if no evidence exists. Your partner is never automatically evicted.</p>
                ${cohabiting ? `<label class="field-label" for="hhExitDestination">Where you go after ending</label><select id="hhExitDestination" class="select-input full-width"><option value="">Remain here as autonomous co-tenants</option>${exitProperties.map((property) => `<option value="${property.id}">Move to ${escapeHtml(property.name)} · deposit ${property.ownerId === 'player' ? Core.formatMoney(0) : Core.formatMoney(property.currentRent)}</option>`).join('')}</select>` : '<div class="callout">You already live separately, so neither home changes when the agreement ends.</div>'}
                <label class="field-label" for="hhEndAck">Type END to acknowledge this irreversible state change</label>
                <input id="hhEndAck" class="text-input full-width" autocomplete="off" placeholder="END" maxlength="12">
                <button class="button danger" data-action="end-household-agreement" data-id="${household.id}"><strong>End household agreement</strong><span>No acceptance from your partner is required; no hidden control is transferred.</span></button>
              </div></section>
            </aside>
          </div>
        </div>
      `;
    },

    renderProposalCard(world, proposal) {
      const summary = Households.proposalSummary(world, proposal);
      const proposer = World.personName(world, proposal.proposerId);
      const waiting = ['pending_npc', 'awaiting_player'].includes(proposal.status);
      const evidence = proposal.response?.evidence;
      const factors = Array.isArray(evidence?.factors) ? evidence.factors.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 5) : [];
      const statusTone = proposal.status === 'implemented' ? 'good' : proposal.status === 'awaiting_player' || proposal.status === 'countered' ? 'warn' : proposal.status === 'declined' || proposal.status === 'failed' ? 'bad' : proposal.status === 'pending_npc' ? 'info' : '';
      return `<article class="proposal-card status-${escapeAttr(proposal.status)}">
        <div class="proposal-head">
          <div><span class="proposal-type">${escapeHtml(Core.titleCase(proposal.type))}</span><h4>${escapeHtml(summary)}</h4><p>Proposed by ${escapeHtml(proposer)} on day ${proposal.createdDay}, ${String(proposal.createdHour).padStart(2, '0')}:00</p></div>
          <span class="pill ${statusTone}">${escapeHtml(Core.titleCase(proposal.status))}</span>
        </div>
        <div class="proposal-terms">${Object.entries(proposal.terms || {}).map(([key, value]) => `<span><strong>${escapeHtml(Core.titleCase(key))}</strong>${escapeHtml(this.formatAgreementTerm(world, key, value))}</span>`).join('')}</div>
        ${proposal.status === 'pending_npc' ? `<div class="callout">A response is due on day ${proposal.dueDay}. The simulation may accept, decline, or return a counteroffer from recorded factors.</div>` : ''}
        ${proposal.status === 'awaiting_player' ? '<div class="callout warning">This proposal came from an autonomous resident. Accepting and declining are both valid player choices.</div>' : ''}
        ${evidence ? `<div class="proposal-evidence"><strong>Recorded response evidence</strong><span>Score ${Core.round(evidence.score, 1)} · deterministic roll ${evidence.roll} · compatibility ${Core.round(evidence.compatibility, 1)}</span>${factors.length ? `<div class="factor-list">${factors.map((factor) => `<span>${escapeHtml(factor.name)} ${signedDelta(factor.value)} · ${escapeHtml(factor.note)}</span>`).join('')}</div>` : ''}</div>` : ''}
        ${proposal.response?.reason ? `<div class="callout danger">${escapeHtml(proposal.response.reason)}</div>` : ''}
        <div class="property-actions">
          ${proposal.status === 'awaiting_player' ? `<button class="button small primary" data-action="respond-proposal" data-id="${proposal.id}" data-response="accept">Accept and implement · 1h</button><button class="button small" data-action="respond-proposal" data-id="${proposal.id}" data-response="decline">Decline without hidden penalty · 1h</button>` : ''}
          ${proposal.status === 'pending_npc' && proposal.proposerId === 'player' ? `<button class="button small ghost" data-action="withdraw-proposal" data-id="${proposal.id}">Withdraw before response</button>` : ''}
          ${proposal.parentProposalId ? `<span class="pill">Counter to ${escapeHtml(proposal.parentProposalId)}</span>` : ''}
          ${waiting ? `<span class="pill">Expires day ${proposal.expiresDay}</span>` : ''}
        </div>
        ${proposal.history?.length ? `<details class="proposal-history"><summary>${proposal.history.length} evidence event${proposal.history.length === 1 ? '' : 's'}</summary><div class="history-list">${proposal.history.slice(-6).reverse().map((entry) => this.renderHistoryEntry(entry)).join('')}</div></details>` : ''}
      </article>`;
    },

    formatAgreementTerm(world, key, value) {
      if (key === 'destinationPropertyId') return World.getProperty(world, value)?.name || String(value);
      if (key === 'objectId') {
        for (const property of world.places.filter((place) => place.kind === 'residential')) {
          const object = property.furniture.find((entry) => entry.id === value);
          if (object) return `${Content.furnitureById(object.catalogId).name} (${value})`;
        }
      }
      if (key === 'colorId') return Content.paletteById(value)?.name || String(value);
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (typeof value === 'number' && /reserve|target/i.test(key)) return Core.formatMoney(value);
      return Core.titleCase(String(value));
    },

    renderHouseholdIssueCard(world, household, issue) {
      const evidence = issue.evidence ? summarizeEvidence(issue.evidence) : '';
      return `<article class="issue-card">
        <div class="proposal-head"><div><span class="proposal-type">${escapeHtml(Core.titleCase(issue.type))} pressure</span><h4>${escapeHtml(issue.message)}</h4><p>Opened day ${issue.createdDay} · ${issue.repairAttempts} repair attempt${issue.repairAttempts === 1 ? '' : 's'}</p></div><span class="pill bad">Severity ${issue.severity}/10</span></div>
        ${evidence ? `<div class="causes">Evidence: ${escapeHtml(evidence)}</div>` : ''}
        <div class="button-grid" style="margin-top:10px">
          <button class="button small" data-action="repair-issue" data-household="${household.id}" data-id="${issue.id}" data-approach="listen"><strong>Listen · 2h</strong><span>Best for style or emotional hurt.</span></button>
          <button class="button small" data-action="repair-issue" data-household="${household.id}" data-id="${issue.id}" data-approach="practical_plan"><strong>Make a practical plan · 2h</strong><span>Best for money pressure.</span></button>
          <button class="button small" data-action="repair-issue" data-household="${household.id}" data-id="${issue.id}" data-approach="give_space"><strong>Give space · 2h</strong><span>Best for privacy and independence.</span></button>
        </div>
      </article>`;
    },

    renderFamily(world) {
      const metrics = Family.metrics(world);
      const unit = Family.playerFamily(world);
      const waiting = world.familyProposals.filter((proposal) => ['pending_npc', 'awaiting_player', 'waiting_space'].includes(proposal.status));
      return `
        <div class="view-title-row">
          <div>
            <h2>Choice-first life chapters and family continuity</h2>
            <p>Children and later adult descendants are people in the living city, not extra avatars. Care, teaching, boundaries, rooms, education, relocation, and separation leave visible evidence while each person keeps their own identity, objects, preferences, and right to refuse. Simulated time does not force a new life chapter in the default mode.</p>
          </div>
          <div class="pill-row">
            <span class="pill ${unit ? 'good' : 'info'}">${unit ? `${metrics.activeDependents} active dependent${metrics.activeDependents === 1 ? '' : 's'}` : 'No active family unit'}</span>
            <span class="pill ${metrics.pendingPlayerProposals ? 'warn' : ''}">${metrics.pendingPlayerProposals} awaiting you</span>
            <span class="pill">${world.metrics.lifeChapterChoices || 0} chosen chapter change${(world.metrics.lifeChapterChoices || 0) === 1 ? '' : 's'}</span>
          </div>
        </div>
        ${unit ? this.renderActiveFamily(world, unit) : this.renderFamilyOnboarding(world, waiting)}
      `;
    },

    renderFamilyOnboarding(world, waiting) {
      const ready = Family.householdReadyForParenthood(world);
      const household = Households.playerHousehold(world);
      const proposals = world.familyProposals.slice().sort((a, b) => b.createdDay - a.createdDay || b.createdHour - a.createdHour);
      const openParenthood = proposals.find((proposal) => proposal.type === 'parenthood' && ['pending_npc', 'awaiting_player', 'accepted', 'waiting_space'].includes(proposal.status));
      return `
        <div class="split">
          <div class="stack">
            ${waiting.length ? `<section class="card agreement-highlight"><div class="card-inner"><h3 class="card-title">Open family conversations <small>A proposal is not a person or an outcome</small></h3><div class="stack">${waiting.map((proposal) => this.renderFamilyProposalCard(world, proposal)).join('')}</div></div></section>` : ''}
            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Begin a family-continuity plan <small>Only after an adult agreement and shared home</small></h3>
              ${ready.ok ? `
                <div class="callout">${escapeHtml(world.player.name)} and ${escapeHtml(ready.partner.name)} share ${escapeHtml(ready.home.name)} through an accepted adult household agreement. Opening this plan asks for a separate autonomous answer.</div>
                <div class="grid-2">
                  <label class="field-label">Arrival path<select id="familyArrivalPath" class="select-input full-width"><option value="new_child">New child</option><option value="adoption">Adoption</option><option value="kinship_care">Kinship care</option></select></label>
                  <label class="field-label">Preferred starting stage<select id="familyPreferredStage" class="select-input full-width"><option value="infant">Infant</option><option value="toddler">Toddler</option><option value="child" selected>Child</option><option value="teen">Teen</option></select></label>
                  <label class="field-label">Care pattern<select id="familyCareMode" class="select-input full-width">${Family.CARE_MODES.map((mode) => `<option value="${mode}">${escapeHtml(Core.titleCase(mode))}</option>`).join('')}</select></label>
                  <label class="field-label">Education direction<select id="familyEducationMode" class="select-input full-width">${Family.EDUCATION_MODES.map((mode) => `<option value="${mode}">${escapeHtml(Core.titleCase(mode))}</option>`).join('')}</select></label>
                  <label class="field-label">Preparation days<input id="familyPreparationDays" class="text-input full-width" type="number" min="2" max="120" value="14"></label>
                  <label class="field-label">Weekly family budget<input id="familyWeeklyBudget" class="text-input full-width" type="number" min="10" max="250" value="55"></label>
                  <label class="field-label">Your weekly care-hours target<input id="familyPlayerHours" class="text-input full-width" type="number" min="0.5" max="8" step="0.5" value="2"></label>
                  <label class="field-label">Partner care-hours proposed<input id="familyPartnerHours" class="text-input full-width" type="number" min="0.5" max="8" step="0.5" value="2"></label>
                </div>
                <button class="button primary" data-action="propose-parenthood" ${openParenthood ? 'disabled' : ''}><strong>${openParenthood ? 'A parenthood plan is already open' : 'Open the parenthood conversation · 1h'}</strong><span>No child is created by pressing this button. Your partner may accept or decline, then preparation and lawful home capacity still apply.</span></button>
              ` : `
                <div class="callout warning">${escapeHtml(ready.reason)}</div>
                <button class="button primary" data-action="open-agreements"><strong>Open adult household agreements</strong><span>Family care cannot silently invent commitment, cohabitation, or access to another adult.</span></button>
              `}
            </div></section>
            ${proposals.filter((proposal) => !['pending_npc', 'awaiting_player', 'waiting_space'].includes(proposal.status)).length ? `<section class="card"><div class="card-inner"><h3 class="card-title">Preserved family conversations <small>Acceptance, refusal, and expiry remain evidence</small></h3><div class="stack">${proposals.filter((proposal) => !['pending_npc', 'awaiting_player', 'waiting_space'].includes(proposal.status)).slice(0, 10).map((proposal) => this.renderFamilyProposalCard(world, proposal)).join('')}</div></div></section>` : ''}
          </div>
          <aside class="stack">
            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Three authorities remain separate</h3>
              <div class="agreement-principle"><strong>Adult household</strong><span>Commitment, cohabitation, money, and adult-to-adult boundaries.</span></div>
              <div class="agreement-principle"><strong>Family continuity</strong><span>Care plans, education, dependent room boundaries, development, and life-stage history.</span></div>
              <div class="agreement-principle"><strong>Property</strong><span>Ownership, tenancy, structural construction, landlord permission, and fixture provenance.</span></div>
              <div class="callout">A “yes” in one layer never silently becomes permission in another.</div>
            </div></section>
            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Labeled prototype experiment</h3>
              <p class="muted small-text">Creates a compatible adult relationship through the real consent path, establishes a lawful shared home, then adds one autonomous dependent with personal objects and a room boundary. The ledger marks the shortcut clearly.</p>
              <button class="button secondary" data-action="prepare-family-experiment" data-variant="young_child" ${world.flags.familyExperimentPrepared ? 'disabled' : ''}>Prepare child continuity test</button>
              <button class="button" data-action="prepare-family-experiment" data-variant="teen" ${world.flags.familyExperimentPrepared ? 'disabled' : ''}>Prepare teen voice-and-boundary test</button>
            </div></section>
            ${household ? `<section class="card"><div class="card-inner"><h3 class="card-title">Adult foundation</h3><div class="kv-list"><div class="kv-row"><span>Status</span><strong>${escapeHtml(Core.titleCase(household.status))}</strong></div><div class="kv-row"><span>Shared home</span><strong>${escapeHtml(household.homePropertyId ? World.getProperty(world, household.homePropertyId)?.name || 'Missing property' : 'Living separately')}</strong></div><div class="kv-row"><span>Agreement revision</span><strong>${household.revision}</strong></div></div></div></section>` : ''}
          </aside>
        </div>
      `;
    },

    renderActiveFamily(world, unit) {
      const partner = Family.partnerForUnit(world, unit);
      const home = World.getProperty(world, unit.homePropertyId);
      const members = Family.unitMembers(world, unit);
      const dependents = Family.dependentMembers(world, unit).filter((entry) => entry.role === 'dependent' && Family.isDependent(entry.person));
      const adultChildren = members.filter((entry) => entry.role === 'adult_child');
      const selectedId = dependents.some((entry) => entry.person.id === world.ui.selectedDependentId) ? world.ui.selectedDependentId : dependents[0]?.person.id;
      const selected = selectedId ? World.getPerson(world, selectedId) : null;
      const proposals = world.familyProposals.filter((proposal) => proposal.familyUnitId === unit.id || proposal.householdId === unit.linkedHouseholdId)
        .slice().sort((a, b) => b.createdDay - a.createdDay || b.createdHour - a.createdHour);
      const waiting = proposals.filter((proposal) => ['pending_npc', 'awaiting_player', 'waiting_space'].includes(proposal.status));
      const roomOptions = (home?.habitat?.rooms || []).filter((room) => !['bathroom', 'entry'].includes(room.purpose));
      const history = (unit.history || []).slice(-14).reverse();
      return `
        <div class="stack">
          ${waiting.length ? `<section class="card agreement-highlight"><div class="card-inner"><h3 class="card-title">Open family decisions <small>Visible terms, real refusal, no manufactured consent</small></h3><div class="stack">${waiting.map((proposal) => this.renderFamilyProposalCard(world, proposal)).join('')}</div></div></section>` : ''}
          <div class="split">
            <div class="stack">
              <section class="card"><div class="card-inner stack">
                <div class="proposal-head"><div><span class="proposal-type">Family unit ${escapeHtml(unit.id)}</span><h3 style="margin:4px 0">${escapeHtml(world.player.name)} · ${escapeHtml(partner?.name || 'separated adult')} · ${dependents.length} dependent${dependents.length === 1 ? '' : 's'}</h3><p>${escapeHtml(home?.name || 'Continuity across separate homes')} · revision ${unit.revision}</p></div><span class="pill ${unit.status === 'active' ? 'good' : 'warn'}">${escapeHtml(Core.titleCase(unit.status))}</span></div>
                <div class="grid-3">
                  <div class="subtle-card"><strong>Care plan</strong><p>${escapeHtml(Core.titleCase(unit.carePlan.mode))} · you ${unit.carePlan.playerTargetHours}h · partner ${unit.carePlan.partnerTargetHours}h</p></div>
                  <div class="subtle-card"><strong>Education</strong><p>${escapeHtml(Core.titleCase(unit.carePlan.educationMode))} · weekly budget ${Core.formatMoney(unit.carePlan.weeklyBudget)}</p></div>
                  <div class="subtle-card"><strong>Recent pressure</strong><p>${Core.round(unit.pressure.lastDayProvided, 1)} / ${Core.round(unit.pressure.lastDayRequired, 1)}h · ${unit.pressure.consecutiveStrainDays} strained day${unit.pressure.consecutiveStrainDays === 1 ? '' : 's'}</p></div>
                </div>
                ${unit.pendingArrival ? `<div class="callout warning"><strong>Arrival preparation:</strong> ${escapeHtml(Core.titleCase(unit.pendingArrival.path))} · ${escapeHtml(Core.titleCase(unit.pendingArrival.preferredStage))} · ready day ${unit.pendingArrival.readyDay} · ${escapeHtml(Core.titleCase(unit.pendingArrival.status))}${unit.pendingArrival.waitingReason ? ` · ${escapeHtml(unit.pendingArrival.waitingReason)}` : ''}</div>` : ''}
                ${unit.separation ? `<div class="callout warning">The adult agreement ended on day ${unit.separation.day}. Family continuity remains recorded across ${escapeHtml(Core.titleCase(unit.separation.mode))}. This is a simulation continuity rule, not a claim about real custody law.</div>` : ''}
                <div class="grid-3">${members.map((entry) => this.renderFamilyMemberCard(world, unit, entry, selectedId)).join('')}</div>
                ${adultChildren.length ? `<div class="callout">${adultChildren.map((entry) => `${escapeHtml(entry.person.name)} is now a self-directed ${escapeHtml(Core.titleCase(entry.person.lifeCourse.stage))}${entry.leftDay ? ` and left the family home on day ${entry.leftDay}` : ''}.`).join(' ')}</div>` : ''}
              </div></section>

              ${selected ? this.renderDependentFamilyPanel(world, unit, selected) : `<section class="card"><div class="card-inner"><div class="empty-state">This family plan is preparing for an arrival or currently has no dependent member. The adult agreement remains separate and inspectable.</div></div></section>`}

              <section class="card"><div class="card-inner stack">
                <h3 class="card-title">Family plan conversations <small>Influence the conditions; do not queue a child’s personality</small></h3>
                <div class="grid-3">
                  <div class="subtle-card stack">
                    <strong>Care responsibility</strong>
                    <select id="familyPlanMode" class="select-input full-width">${Family.CARE_MODES.map((mode) => `<option value="${mode}" ${unit.carePlan.mode === mode ? 'selected' : ''}>${escapeHtml(Core.titleCase(mode))}</option>`).join('')}</select>
                    <input id="familyPlanPlayerHours" class="text-input full-width" type="number" min="0.5" max="10" step="0.5" value="${unit.carePlan.playerTargetHours}">
                    <input id="familyPlanPartnerHours" class="text-input full-width" type="number" min="0.5" max="10" step="0.5" value="${unit.carePlan.partnerTargetHours}">
                    <input id="familyPlanBudget" class="text-input full-width" type="number" min="10" max="300" value="${unit.carePlan.weeklyBudget}">
                    <button class="button small" data-action="propose-family-care-plan" data-id="${unit.id}" ${partner ? '' : 'disabled'}>Propose care plan · 1h</button>
                  </div>
                  <div class="subtle-card stack">
                    <strong>Education direction</strong>
                    <select id="familyPlanEducation" class="select-input full-width">${Family.EDUCATION_MODES.map((mode) => `<option value="${mode}" ${unit.carePlan.educationMode === mode ? 'selected' : ''}>${escapeHtml(Core.titleCase(mode))}</option>`).join('')}</select>
                    <p class="muted small-text">Changes the opportunities and daily learning context, not a guaranteed personality or career.</p>
                    <button class="button small" data-action="propose-family-education" data-id="${unit.id}" ${partner ? '' : 'disabled'}>Propose education plan · 1h</button>
                  </div>
                  <div class="subtle-card stack">
                    <strong>Room boundary</strong>
                    <select id="familyRoomPerson" class="select-input full-width">${dependents.map((entry) => `<option value="${entry.person.id}" ${selectedId === entry.person.id ? 'selected' : ''}>${escapeHtml(entry.person.name)}</option>`).join('')}</select>
                    <select id="familyRoomId" class="select-input full-width">${roomOptions.map((room) => `<option value="${room.id}">${escapeHtml(room.label || Core.titleCase(room.purpose))} · ${room.cells.length} cells</option>`).join('')}</select>
                    <select id="familyRoomKind" class="select-input full-width">${Family.ROOM_KINDS.map((kind) => `<option value="${kind}">${escapeHtml(Core.titleCase(kind))}</option>`).join('')}</select>
                    <button class="button small" data-action="propose-family-room" data-id="${unit.id}" ${partner && dependents.length && roomOptions.length ? '' : 'disabled'}>Propose room plan · 1h</button>
                  </div>
                </div>
                <div class="subtle-card stack">
                  <strong>Chosen family ritual</strong>
                  <div class="grid-2"><input id="familyRitualLabel" class="text-input full-width" maxlength="60" value="${escapeAttr(unit.familyRitual?.label || 'A day we choose each other')}"><input id="familyRitualMeaning" class="text-input full-width" maxlength="220" value="${escapeAttr(unit.familyRitual?.meaning || 'A personal family commitment without transferring control or making legal claims.')}"></div>
                  <button class="button small" data-action="propose-family-ritual" data-id="${unit.id}" ${partner ? '' : 'disabled'}>Propose ritual meaning · 1h</button>
                </div>
              </div></section>

              <section class="card"><div class="card-inner"><h3 class="card-title">Family history <small>Life stages, care decisions, moves, rooms, and separation remain inspectable</small></h3><div class="history-list">${history.length ? history.map((entry) => this.renderHistoryEntry(entry)).join('') : '<div class="empty-state">No family history recorded yet.</div>'}</div></div></section>
            </div>
            <aside class="stack">
              <section class="card"><div class="card-inner stack">
                <h3 class="card-title">Care evidence</h3>
                ${dependents.length ? dependents.map((entry) => this.renderCareEvidence(world, unit, entry.person)).join('') : '<div class="empty-state">Care records begin when a dependent arrives.</div>'}
              </div></section>
              ${home ? `<section class="card"><div class="card-inner stack"><h3 class="card-title">Family habitat</h3><div class="kv-list"><div class="kv-row"><span>Home</span><strong>${escapeHtml(home.name)}</strong></div><div class="kv-row"><span>Capacity</span><strong>${home.tenants.length}/${home.capacity}</strong></div><div class="kv-row"><span>Real rooms</span><strong>${home.habitat?.rooms?.length || 0}</strong></div><div class="kv-row"><span>Family assignments</span><strong>${unit.roomAssignments.length}</strong></div></div><button class="button" data-action="view-property" data-id="${home.id}">View structural home</button><button class="button ghost" data-action="open-agreements">Open adult agreement</button></div></section>` : ''}
              <section class="card"><div class="card-inner stack">
                <h3 class="card-title">Another family plan</h3>
                <p class="muted small-text">The same explicit path can later prepare another arrival. Existing children are not erased or converted into household-control slots.</p>
                <div class="grid-2"><select id="familyNextPath" class="select-input full-width"><option value="new_child">New child</option><option value="adoption">Adoption</option><option value="kinship_care">Kinship care</option></select><select id="familyNextStage" class="select-input full-width"><option value="infant">Infant</option><option value="toddler">Toddler</option><option value="child" selected>Child</option><option value="teen">Teen</option></select></div>
                <button class="button" data-action="propose-another-dependent" ${unit.pendingArrival ? 'disabled' : ''}>${unit.pendingArrival ? 'An arrival is already being prepared' : 'Open another parenthood conversation · 1h'}</button>
              </div></section>
              <section class="card"><div class="card-inner"><h3 class="card-title">Recent proposal evidence</h3><div class="stack">${proposals.filter((proposal) => !['pending_npc', 'awaiting_player', 'waiting_space'].includes(proposal.status)).slice(0, 6).map((proposal) => this.renderFamilyProposalCard(world, proposal)).join('') || '<div class="empty-state">No concluded family proposals yet.</div>'}</div></div></section>
            </aside>
          </div>
        </div>
      `;
    },

    renderFamilyMemberCard(world, unit, entry, selectedId) {
      const person = entry.person;
      const dependent = entry.role === 'dependent' && Family.isDependent(person);
      const home = World.homeOf(world, person.id);
      return `<article class="person-card ${selectedId === person.id ? 'selected' : ''}">
        <div class="person-head"><div class="avatar">${escapeHtml(initials(person.name))}</div><div class="person-name-block"><h4>${escapeHtml(person.name)}</h4><p>${escapeHtml(Core.titleCase(entry.role))} · ${escapeHtml(Core.titleCase(person.lifeCourse?.stage || Family.stageForAge(person.age)))}</p></div></div>
        <p>${escapeHtml(person.activity || person.personalGoal || '')}</p>
        <div class="pill-row"><span class="pill">${escapeHtml(lifeContextLabel(world, person))}</span><span class="pill">${escapeHtml(home?.name || 'Continuity link')}</span>${entry.leftDay ? `<span class="pill info">left home day ${entry.leftDay}</span>` : ''}</div>
        ${dependent ? `<button class="button small ${selectedId === person.id ? 'primary' : ''}" data-action="select-dependent" data-id="${person.id}">Open care and agency</button>` : person.id === 'player' ? '<span class="pill good">Directly controlled self</span>' : `<button class="button small" data-action="select-person" data-id="${person.id}">Open autonomous adult</button>`}
      </article>`;
    },

    renderDependentFamilyPanel(world, unit, person) {
      const relation = world.player.relationships[person.id] || { friendship: 0, trust: 0 };
      const home = World.getProperty(world, person.homePropertyId);
      const assignment = unit.roomAssignments.find((entry) => entry.personId === person.id);
      const room = assignment && home ? Habitats.roomById(home, assignment.roomId) : null;
      const record = Family.careRecordForDay(world, unit, person.id, true);
      const personalPlaced = home ? home.furniture.filter((object) => object.ownerId === person.id) : [];
      const preferred = new Set(person.careAutonomy?.preferredActivities || []);
      const chapterIndex = Family.LIFE_STAGE_ORDER.indexOf(person.lifeCourse?.stage);
      const nextChapter = chapterIndex >= 0 && chapterIndex < Family.LIFE_STAGE_ORDER.length - 1 ? Family.LIFE_STAGE_ORDER[chapterIndex + 1] : null;
      return `<section class="card"><div class="card-inner stack">
        <div class="proposal-head"><div><span class="proposal-type">Selected autonomous dependent</span><h3 style="margin:4px 0">${escapeHtml(person.name)}</h3><p>${escapeHtml(lifeContextLabel(world, person))} · ${escapeHtml(person.pronouns)} · ${escapeHtml(person.personalGoal)}</p></div><span class="pill info">Not directly playable</span></div>
        <div class="grid-2">
          <div class="subtle-card stack"><strong>Needs now</strong>${Object.entries(person.needs || {}).map(([key, value]) => this.renderObjectStat(key, Core.clamp(value, 0, 100))).join('')}</div>
          <div class="subtle-card stack"><strong>Development—not destiny</strong>${Family.DEVELOPMENT_DOMAINS.map((domain) => this.renderObjectStat(domain, Core.clamp(person.development?.[domain] || 0, 0, 100))).join('')}</div>
        </div>
        <div class="kv-list">
          <div class="kv-row"><span>Trust / friendship</span><strong>${Core.round(relation.trust, 1)} / ${Core.round(relation.friendship, 1)}</strong></div>
          <div class="kv-row"><span>Education</span><strong>${escapeHtml(Core.titleCase(person.education.mode))} · ${Core.round(person.education.progress, 1)} progress</strong></div>
          <div class="kv-row"><span>Current interest</span><strong>${escapeHtml(Core.titleCase(person.education.currentFocus))}</strong></div>
          <div class="kv-row"><span>Room authority</span><strong>${escapeHtml(assignment ? `${Core.titleCase(assignment.kind)} · ${room?.label || room?.purpose || assignment.roomId}` : 'No dedicated room assignment')}</strong></div>
          <div class="kv-row"><span>Environment support</span><strong>${Family.environmentSupport(world, unit, person)}/100</strong></div>
          <div class="kv-row"><span>Personal objects</span><strong>${personalPlaced.length} placed · ${(person.storedFurniture || []).length} stored</strong></div>
          <div class="kv-row"><span>Care today</span><strong>${Core.round(record.playerHours + record.partnerHours + record.communityHours, 1)} / ${record.requiredHours}h</strong></div>
        </div>
        ${world.settings.lifeCourseMode === 'choice' && nextChapter ? `<div class="callout"><strong>No age deadline:</strong> ${escapeHtml(person.name)} remains in the ${escapeHtml(Core.titleCase(person.lifeCourse.stage))} chapter until an explicit family choice opens ${escapeHtml(Core.titleCase(nextChapter))}. Nothing becomes “too late.”</div><button class="button secondary" data-action="advance-life-chapter" data-id="${person.id}"><strong>Open ${escapeHtml(person.name)}’s ${escapeHtml(Core.titleCase(nextChapter))} chapter</strong><span>Identity, objects, relationships, care history, and unfinished directions remain. This changes life context, not personality ownership.</span></button>` : ''}
        <h4 class="card-title">Offer an activity <small>Older children and teens can decline right now</small></h4>
        <div class="grid-3">${Object.entries(Family.CARE_ACTIONS).map(([id, action]) => `<button class="button ${preferred.has(id) ? 'secondary' : ''}" data-action="family-care" data-id="${person.id}" data-kind="${id}"><strong>${escapeHtml(action.name)} · ${action.hours}h · ${Core.formatMoney(action.cost)}</strong><span>${escapeHtml(action.note)}</span></button>`).join('')}</div>
        ${(person.careAutonomy?.refusedActivities || []).length ? `<div class="callout">Recent refusals are preserved without hidden punishment: ${(person.careAutonomy.refusedActivities || []).slice(-4).map((entry) => `${escapeHtml(Core.titleCase(entry.actionId))} on day ${entry.day}`).join(' · ')}</div>` : ''}
        <div class="grid-2">${home ? `<button class="button" data-action="view-property" data-id="${home.id}">View room and personal objects</button>` : ''}<button class="button ghost" data-action="select-person" data-id="${person.id}">Open resident summary</button></div>
      </div></section>`;
    },

    renderCareEvidence(world, unit, person) {
      const records = world.careRecords.filter((record) => record.familyUnitId === unit.id && record.personId === person.id).slice().sort((a, b) => b.day - a.day).slice(0, 4);
      const latest = records[0];
      return `<div class="subtle-card">
        <div class="proposal-head"><div><strong>${escapeHtml(person.name)}</strong><p>${escapeHtml(Core.titleCase(person.lifeCourse.stage))}</p></div><span class="pill ${latest?.needsMet === true ? 'good' : latest?.needsMet === false ? 'warn' : ''}">${latest ? `${Core.round(latest.playerHours + latest.partnerHours + latest.communityHours, 1)}/${latest.requiredHours}h` : 'No record'}</span></div>
        ${records.length ? `<details class="proposal-history"><summary>${records.length} recent day record${records.length === 1 ? '' : 's'}</summary><div class="history-list">${records.map((record) => `<div class="history-entry"><div class="history-dot"></div><div><strong>Day ${record.day} · ${record.needsMet === true ? 'care met' : record.needsMet === false ? 'care strain' : 'open day'}</strong><p>you ${Core.round(record.playerHours, 1)}h · partner ${Core.round(record.partnerHours, 1)}h · community ${Core.round(record.communityHours, 1)}h · cost ${Core.formatMoney(record.cost)}</p></div></div>`).join('')}</div></details>` : '<p class="muted small-text">Daily evidence begins when care is provided or the day is finalized.</p>'}
      </div>`;
    },

    renderFamilyProposalCard(world, proposal) {
      const proposer = proposal.proposerId === 'system' ? 'Family continuity system' : World.personName(world, proposal.proposerId);
      const statusTone = proposal.status === 'implemented' || proposal.status === 'accepted' ? 'good' : proposal.status === 'awaiting_player' || proposal.status === 'waiting_space' ? 'warn' : proposal.status === 'declined' || proposal.status === 'expired' ? 'bad' : 'info';
      const evidence = proposal.response?.evidence || null;
      return `<article class="proposal-card status-${escapeAttr(proposal.status)}">
        <div class="proposal-head"><div><span class="proposal-type">${escapeHtml(Core.titleCase(proposal.type))}</span><h4>${escapeHtml(this.familyProposalTitle(world, proposal))}</h4><p>Opened by ${escapeHtml(proposer)} on day ${proposal.createdDay}, ${String(proposal.createdHour).padStart(2, '0')}:00</p></div><span class="pill ${statusTone}">${escapeHtml(Core.titleCase(proposal.status))}</span></div>
        <div class="proposal-terms">${Object.entries(proposal.terms || {}).map(([key, value]) => `<span><strong>${escapeHtml(Core.titleCase(key))}</strong>${escapeHtml(this.formatFamilyTerm(world, key, value))}</span>`).join('')}</div>
        ${proposal.status === 'pending_npc' ? `<div class="callout">An autonomous answer is due on day ${proposal.dueDay}. No response is inferred from relationship statistics alone.</div>` : ''}
        ${proposal.status === 'awaiting_player' ? '<div class="callout warning">This proposal came from an autonomous family member or continuity process. Accept and decline are both valid.</div>' : ''}
        ${proposal.status === 'waiting_space' ? '<div class="callout warning">The accepted intention is waiting for lawful home capacity. No person is silently inserted into a full property.</div>' : ''}
        ${evidence ? `<div class="proposal-evidence"><strong>Recorded response evidence</strong><span>${Number.isFinite(evidence.score) ? `Score ${Core.round(evidence.score, 1)}` : 'Decision evidence recorded'}${Number.isFinite(evidence.roll) ? ` · deterministic roll ${evidence.roll}` : ''}${evidence.dependentVoice ? ` · dependent voice ${evidence.dependentVoice.accepted ? 'accepted' : 'declined'}` : ''}</span></div>` : ''}
        <div class="property-actions">${proposal.status === 'awaiting_player' ? `<button class="button small primary" data-action="respond-family-proposal" data-id="${proposal.id}" data-response="accept">Accept visible terms</button><button class="button small" data-action="respond-family-proposal" data-id="${proposal.id}" data-response="decline">Decline without hidden penalty</button>` : ''}<span class="pill">Expires day ${proposal.expiresDay}</span></div>
        ${proposal.history?.length ? `<details class="proposal-history"><summary>${proposal.history.length} evidence event${proposal.history.length === 1 ? '' : 's'}</summary><div class="history-list">${proposal.history.slice(-7).reverse().map((entry) => this.renderHistoryEntry(entry)).join('')}</div></details>` : ''}
      </article>`;
    },

    familyProposalTitle(world, proposal) {
      if (proposal.type === 'parenthood') return `${Core.titleCase(proposal.terms.path)} · prepare for an autonomous ${Core.titleCase(proposal.terms.preferredStage)}`;
      if (proposal.type === 'care_plan') return `${Core.titleCase(proposal.terms.mode)} care plan`;
      if (proposal.type === 'education_plan') return `${Core.titleCase(proposal.terms.mode)} education direction`;
      if (proposal.type === 'room_plan') return `${World.personName(world, proposal.terms.personId)} · ${Core.titleCase(proposal.terms.kind)}`;
      if (proposal.type === 'family_ritual') return String(proposal.terms.label || 'Chosen family ritual');
      return Core.titleCase(proposal.type);
    },

    formatFamilyTerm(world, key, value) {
      if (key === 'personId') return World.personName(world, value);
      if (key === 'roomId') {
        const unit = Family.playerFamily(world);
        const property = unit ? World.getProperty(world, unit.homePropertyId) : null;
        const room = property ? Habitats.roomById(property, value) : null;
        return room?.label || room?.purpose || String(value);
      }
      if (key === 'weeklyBudget') return Core.formatMoney(value);
      if (/Hours$/.test(key) && Number.isFinite(value)) return `${value} hours`;
      if (key === 'projectSpec') return value?.type ? `${Core.titleCase(value.type)} construction proposal` : 'Bounded construction specification';
      if (typeof value === 'object' && value !== null) return JSON.stringify(value);
      return Core.titleCase(String(value));
    },

    renderCommunity(world) {
      const metrics = Community.metrics(world);
      const activeAdventure = Community.activeAdventureFor(world, 'player');
      const incoming = world.communityOpportunities
        .filter((entry) => entry.status === 'awaiting_player')
        .slice().sort((a, b) => a.eventDay - b.eventDay || a.startHour - b.startHour);
      const available = world.communityOpportunities
        .filter((entry) => ['open', 'available'].includes(entry.status))
        .slice().sort((a, b) => a.eventDay - b.eventDay || a.startHour - b.startHour)
        .slice(0, 12);
      const pendingNpc = world.communityOpportunities
        .filter((entry) => entry.status === 'pending_npc' && entry.initiatorId === 'player')
        .slice().sort((a, b) => a.createdDay - b.createdDay || a.createdHour - b.createdHour);
      const preserved = world.communityOpportunities
        .filter((entry) => ['completed', 'declined', 'expired', 'cancelled'].includes(entry.status))
        .slice().sort((a, b) => (b.playerCompletedDay || b.expiresDay || b.eventDay) - (a.playerCompletedDay || a.expiresDay || a.eventDay))
        .slice(0, 10);
      const connections = world.communityConnections
        .filter((entry) => entry.status === 'active' && entry.personIds.includes('player'))
        .slice().sort((a, b) => (b.warmth + b.trust) - (a.warmth + a.trust));
      const pastAdventures = world.adventureThreads
        .filter((entry) => entry.ownerId === 'player' && entry.status !== 'active')
        .slice().sort((a, b) => (b.completedDay || b.releasedDay || b.createdDay) - (a.completedDay || a.releasedDay || a.createdDay));

      return `
        <div class="view-title-row">
          <div>
            <h2>Community as possibility, not obligation</h2>
            <p>The neighborhood can offer places, people, invitations, and small adventures. Nothing below creates a daily streak, compulsory attendance, a universal “good life” build, or hidden punishment for saying no. The simulation keeps moving while your life remains yours.</p>
          </div>
          <div class="pill-row">
            <span class="pill good">${metrics.openOpportunities} open possibilit${metrics.openOpportunities === 1 ? 'y' : 'ies'}</span>
            <span class="pill ${metrics.awaitingPlayer ? 'warn' : 'info'}">${metrics.awaitingPlayer} awaiting your answer</span>
            <span class="pill">${metrics.playerConnections} lived connection${metrics.playerConnections === 1 ? '' : 's'}</span>
            <span class="pill ${activeAdventure ? 'good' : ''}">${activeAdventure ? '1 personal adventure' : 'No active adventure'}</span>
          </div>
        </div>

        <section class="card community-root-card"><div class="card-inner">
          <div class="grid-4">
            <div class="agreement-principle"><strong>Be yourself</strong><span>Personality and interests create possibilities, not a mandatory character build.</span></div>
            <div class="agreement-principle"><strong>Find your adventure</strong><span>Threads can be discovered, continued later, or released without failure.</span></div>
            <div class="agreement-principle"><strong>Do no harm</strong><span>Connection never grants possession, tenancy, care authority, or control over another person.</span></div>
            <div class="agreement-principle"><strong>Grow your way</strong><span>Skills, memories, objects, relationships, quiet time, and curiosity are all valid forms of progress.</span></div>
          </div>
          <div class="callout" style="margin-top:12px"><strong>Casual realism:</strong> needs and money still matter enough to ground choices, but repetitive maintenance is compressed. “Take care of the basics” handles an ordinary reset in one action; community events expire without penalties; memberships create access, never attendance duties.</div>
        </div></section>

        <div class="split" style="margin-top:16px">
          <div class="stack">
            <section class="card adventure-highlight"><div class="card-inner">
              <h3 class="card-title">Your current thread <small>No deadline, no quest failure</small></h3>
              ${activeAdventure ? this.renderAdventureCard(world, activeAdventure, true) : `
                <div class="empty-state">No adventure is demanding your attention. Wander only when you want a spark; ordinary life remains complete without one.</div>
                <button class="button primary" data-action="discover-adventure"><strong>Wander for a possible spark · 1h</strong><span>The world chooses from your interests and current connections. You may release whatever appears.</span></button>
              `}
            </div></section>

            ${incoming.length ? `<section class="card agreement-highlight"><div class="card-inner">
              <h3 class="card-title">Invitations waiting for an answer <small>Yes and no are equally valid</small></h3>
              <div class="stack">${incoming.map((entry) => this.renderCommunityOpportunityCard(world, entry)).join('')}</div>
            </div></section>` : ''}

            <section class="card"><div class="card-inner">
              <h3 class="card-title">Open possibilities <small>Join one, ignore all, or let time pass</small></h3>
              ${available.length ? `<div class="grid-2">${available.map((entry) => this.renderCommunityOpportunityCard(world, entry)).join('')}</div>` : '<div class="empty-state">The town is between community moments right now. New possibilities emerge through ordinary simulated time.</div>'}
            </div></section>

            ${pendingNpc.length ? `<section class="card"><div class="card-inner">
              <h3 class="card-title">Invitations others are considering <small>Sending is not consent</small></h3>
              <div class="grid-2">${pendingNpc.map((entry) => this.renderCommunityOpportunityCard(world, entry)).join('')}</div>
            </div></section>` : ''}

            <section class="card"><div class="card-inner">
              <h3 class="card-title">Community places <small>Capacity is real; exclusion mechanics are not</small></h3>
              <div class="grid-2">${world.communityInstitutions.map((institution) => this.renderCommunityInstitutionCard(world, institution)).join('')}</div>
            </div></section>
          </div>

          <aside class="stack">
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Connections made by living <small>Relationship, not ownership</small></h3>
              ${connections.length ? `<div class="stack">${connections.slice(0, 10).map((connection) => this.renderCommunityConnectionCard(world, connection)).join('')}</div>` : '<div class="empty-state">No community connection has formed yet. Shared moments may create peers, neighbors, mentors, or creative partners without creating authority over anyone.</div>'}
            </div></section>

            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Labeled freedom-loop experiment</h3>
              <p class="muted small-text">Prepares one real full-membership waiting state, one bounded home invitation, and one no-deadline adventure. It is explicitly recorded as QA setup rather than normal progression.</p>
              <button class="button ${world.flags.communityExperimentPrepared ? 'ghost' : 'secondary'}" data-action="prepare-community-experiment" ${world.flags.communityExperimentPrepared ? 'disabled' : ''}>
                <strong>${world.flags.communityExperimentPrepared ? 'Community experiment already prepared' : 'Prepare community freedom test'}</strong>
                <span>No fabricated attendance, tenancy, relationship penalty, or forced quest.</span>
              </button>
            </div></section>

            <section class="card"><div class="card-inner">
              <h3 class="card-title">Community evidence <small>What happened, not what you “should” do</small></h3>
              <div class="kv-list">
                <div class="kv-row"><span>Active memberships</span><strong>${metrics.activeMemberships}</strong></div>
                <div class="kv-row"><span>Visible waiting states</span><strong>${metrics.waitingMemberships}</strong></div>
                <div class="kv-row"><span>Mentor links</span><strong>${metrics.mentorLinks}</strong></div>
                <div class="kv-row"><span>Casual visits completed</span><strong>${metrics.visitsCompleted}</strong></div>
                <div class="kv-row"><span>Adventures completed</span><strong>${metrics.completedAdventures}</strong></div>
                <div class="kv-row"><span>Daily streak system</span><strong>None</strong></div>
              </div>
            </div></section>

            ${pastAdventures.length ? `<section class="card"><div class="card-inner">
              <h3 class="card-title">Adventure history <small>Completed and released both remain meaningful</small></h3>
              <div class="stack">${pastAdventures.slice(0, 6).map((adventure) => this.renderAdventureCard(world, adventure, false)).join('')}</div>
            </div></section>` : ''}

            ${preserved.length ? `<section class="card"><div class="card-inner">
              <h3 class="card-title">Preserved community moments <small>Declines and expiries are not failures</small></h3>
              <div class="stack">${preserved.map((entry) => this.renderCommunityOpportunityCard(world, entry, true)).join('')}</div>
            </div></section>` : ''}
          </aside>
        </div>
      `;
    },

    renderCommunityOpportunityCard(world, opportunity, compact = false) {
      const place = World.getPlace(world, opportunity.placeId);
      const institution = opportunity.institutionId ? Community.institutionById(world, opportunity.institutionId) : null;
      const host = opportunity.hostId ? World.getPerson(world, opportunity.hostId) : null;
      const participantNames = opportunity.participantIds.map((id) => World.personName(world, id)).slice(0, 5);
      const statusTone = opportunity.status === 'completed' ? 'good'
        : opportunity.status === 'declined' || opportunity.status === 'expired' || opportunity.status === 'cancelled' ? ''
          : opportunity.status === 'awaiting_player' ? 'warn' : 'info';
      const when = `${Core.weekdayName(opportunity.eventDay)}, day ${opportunity.eventDay} · ${String(opportunity.startHour).padStart(2, '0')}:00 · ${opportunity.durationHours}h`;
      const full = opportunity.participantIds.length >= opportunity.capacity && !opportunity.participantIds.includes('player');
      const action = opportunity.status === 'awaiting_player'
        ? `<div class="button-grid"><button class="button primary" data-action="respond-community-opportunity" data-id="${opportunity.id}" data-response="accept">Accept as an option</button><button class="button ghost" data-action="respond-community-opportunity" data-id="${opportunity.id}" data-response="decline">Decline without penalty</button></div>`
        : ['open', 'available'].includes(opportunity.status)
          ? `<button class="button ${opportunity.kind === 'home_visit' ? 'primary' : ''}" data-action="participate-community-opportunity" data-id="${opportunity.id}"><strong>${full ? 'Enter visible waiting state' : opportunity.kind === 'home_visit' ? 'Go for the visit' : 'Choose this moment'}</strong><span>${Core.formatMoney(opportunity.cost)} · the simulation advances to its real scheduled time</span></button>`
          : opportunity.status === 'pending_npc'
            ? '<div class="callout">The other person is deciding autonomously. No visit exists until they accept.</div>'
            : '';
      return `<article class="proposal-card status-${escapeAttr(opportunity.status)} community-opportunity-card">
        <div class="proposal-head">
          <div><span class="proposal-type">${escapeHtml(opportunity.kind === 'home_visit' ? 'Home invitation' : institution?.name || 'Community possibility')}</span><h4>${escapeHtml(opportunity.title)}</h4><p>${escapeHtml(when)}</p></div>
          <span class="pill ${statusTone}">${escapeHtml(Core.titleCase(opportunity.status))}</span>
        </div>
        ${compact ? '' : `<p>${escapeHtml(opportunity.description)}</p>`}
        <div class="pill-row">
          <span class="pill">${escapeHtml(place?.name || 'Unknown place')}</span>
          <span class="pill">${opportunity.participantIds.length}/${opportunity.capacity} people</span>
          ${opportunity.noDeadline ? '<span class="pill good">No deadline</span>' : ''}
          ${host ? `<span class="pill info">Host: ${escapeHtml(host.name)}</span>` : ''}
        </div>
        ${participantNames.length && !compact ? `<div class="causes">Already part of it: ${participantNames.map(escapeHtml).join(' · ')}</div>` : ''}
        ${opportunity.kind === 'home_visit' ? '<div class="callout">A visit grants no tenancy, storage, edit, employment, construction, or care authority.</div>' : ''}
        ${action}
      </article>`;
    },

    renderCommunityInstitutionCard(world, institution) {
      const membership = Community.membershipFor(institution, 'player');
      const active = Community.activeMembers(institution).length;
      const waiting = Community.waitingMembers(institution).length;
      const place = World.getPlace(world, institution.placeId);
      const button = membership?.status === 'active'
        ? `<button class="button ghost" data-action="leave-community-institution" data-id="${institution.id}">Leave membership without penalty</button>`
        : membership?.status === 'waiting'
          ? `<button class="button ghost" data-action="leave-community-institution" data-id="${institution.id}">Withdraw from waiting state</button>`
          : `<button class="button" data-action="request-community-membership" data-id="${institution.id}">${active >= institution.capacity ? 'Join visible waiting state' : 'Join without attendance duty'}</button>`;
      return `<article class="subtle-card community-institution-card">
        <div class="proposal-head"><div><h4>${escapeHtml(institution.name)}</h4><p>${escapeHtml(place?.name || institution.kind)}</p></div><span class="pill ${membership?.status === 'active' ? 'good' : membership?.status === 'waiting' ? 'warn' : ''}">${membership ? escapeHtml(Core.titleCase(membership.status)) : `${active}/${institution.capacity}`}</span></div>
        <p>${escapeHtml(institution.description)}</p>
        <div class="pill-row">${institution.tags.slice(0, 5).map((tag) => `<span class="pill">${escapeHtml(Core.titleCase(tag))}</span>`).join('')}</div>
        <div class="kv-list">
          <div class="kv-row"><span>Active places</span><strong>${active}/${institution.capacity}</strong></div>
          <div class="kv-row"><span>Waiting</span><strong>${waiting}</strong></div>
          <div class="kv-row"><span>Attendance requirement</span><strong>None</strong></div>
        </div>
        ${button}
      </article>`;
    },

    renderCommunityConnectionCard(world, connection) {
      const otherId = connection.personIds.find((id) => id !== 'player');
      const person = World.getPerson(world, otherId);
      const canInvite = person && !Family.isDependent(person);
      return `<article class="subtle-card community-connection-card">
        <div class="proposal-head"><div><h4>${escapeHtml(person?.name || otherId)}</h4><p>${escapeHtml(Core.titleCase(connection.kind))} · ${connection.sharedActivities} shared moment${connection.sharedActivities === 1 ? '' : 's'}</p></div><span class="pill info">Warmth ${Math.round(connection.warmth)}</span></div>
        <div class="kv-list"><div class="kv-row"><span>Trust</span><strong>${Math.round(connection.trust)}</strong></div><div class="kv-row"><span>Last shared day</span><strong>${connection.lastSharedDay}</strong></div></div>
        <div class="button-grid">
          <button class="button small" data-action="select-person" data-id="${otherId}">See person</button>
          ${canInvite ? `<button class="button small" data-action="invite-community-connection" data-id="${otherId}">Invite for a casual visit</button>` : ''}
        </div>
      </article>`;
    },

    renderAdventureCard(world, adventure, active = false) {
      const companion = adventure.companionId ? World.getPerson(world, adventure.companionId) : null;
      const stage = adventure.stages[adventure.stageIndex] || null;
      const completed = adventure.stages.filter((entry) => entry.status === 'completed').length;
      const progress = adventure.stages.length ? completed / adventure.stages.length * 100 : 0;
      return `<article class="proposal-card adventure-card status-${escapeAttr(adventure.status)}">
        <div class="proposal-head"><div><span class="proposal-type">${escapeHtml(Core.titleCase(adventure.theme))} adventure</span><h4>${escapeHtml(adventure.title)}</h4><p>Discovered day ${adventure.createdDay}${companion ? ` · with ${escapeHtml(companion.name)}` : ''}</p></div><span class="pill ${adventure.status === 'completed' ? 'good' : adventure.status === 'active' ? 'info' : ''}">${escapeHtml(Core.titleCase(adventure.status))}</span></div>
        <p>${escapeHtml(adventure.origin)}</p>
        <div class="callout">${escapeHtml(adventure.meaning)}</div>
        <div class="meter" title="${completed}/${adventure.stages.length} chapters lived"><span style="--value:${progress}%"></span></div>
        <div class="pill-row"><span class="pill">${completed}/${adventure.stages.length} chapters</span><span class="pill good">No deadline</span>${companion ? `<span class="pill info">Companion: ${escapeHtml(companion.name)}</span>` : ''}</div>
        ${active && stage ? `<div class="subtle-card"><h4>${escapeHtml(stage.title)}</h4><p>${escapeHtml(stage.description)}</p><div class="pill-row"><span class="pill">${stage.durationHours}h</span><span class="pill">${Core.formatMoney(stage.cost)}</span></div></div><div class="button-grid"><button class="button primary" data-action="continue-adventure" data-id="${adventure.id}"><strong>Live this chapter</strong><span>The next chapter remains optional and undated.</span></button><button class="button ghost" data-action="release-adventure" data-id="${adventure.id}">Release thread without penalty</button></div>` : ''}
      </article>`;
    },

    renderDirections(world) {
      const metrics = Directions.metrics(world);
      const playerProjects = Directions.projectsFor(world, 'player').slice().sort((a, b) => (b.updatedDay || b.createdDay) - (a.updatedDay || a.createdDay));
      const openProjects = playerProjects.filter((entry) => ['active', 'paused'].includes(entry.status));
      const closedProjects = playerProjects.filter((entry) => ['completed', 'released', 'archived'].includes(entry.status));
      const npcProjects = world.personalProjects.filter((entry) => entry.ownerId !== 'player').slice().sort((a, b) => (b.updatedDay || b.createdDay) - (a.updatedDay || a.createdDay));
      const owned = Directions.ownedObjects(world, 'player');
      const connections = world.communityConnections.filter((entry) => entry.status === 'active' && entry.personIds.includes('player'));
      const currentStage = world.player.lifeCourse?.stage || Family.stageForAge(world.player.age);
      const stageIndex = Family.LIFE_STAGE_ORDER.indexOf(currentStage);
      const nextStage = stageIndex >= 0 && stageIndex < Family.LIFE_STAGE_ORDER.length - 1 ? Family.LIFE_STAGE_ORDER[stageIndex + 1] : null;
      return `
        <div class="view-title-row">
          <div>
            <h2>Personal directions without a timetable</h2>
            <p>Begin something because it matters, not because age, productivity, or a quest clock says now. Every project is optional, undated, exportable, and free to pause, reshape, complete, archive, or release. Ordinary life remains complete without one.</p>
          </div>
          <div class="pill-row"><span class="pill ${metrics.playerOpen ? 'good' : 'info'}">${metrics.playerOpen} open direction${metrics.playerOpen === 1 ? '' : 's'}</span><span class="pill">${metrics.playerCompleted} completed</span><span class="pill">${metrics.playerReleased} released</span><span class="pill ${metrics.pendingCollaborations ? 'warn' : ''}">${metrics.pendingCollaborations} answer${metrics.pendingCollaborations === 1 ? '' : 's'} pending</span></div>
        </div>

        <section class="card community-root-card"><div class="card-inner">
          <div class="grid-4">
            <div class="agreement-principle"><strong>No age pressure</strong><span>No fertility clock, “too late” state, age gate, missed window, or forced life-stage schedule.</span></div>
            <div class="agreement-principle"><strong>Meaning before score</strong><span>A reason that matters to you is authoritative even when it is not profitable or efficient.</span></div>
            <div class="agreement-principle"><strong>Pause is valid</strong><span>Attention can move elsewhere indefinitely without decay, shame, or lost progress.</span></div>
            <div class="agreement-principle"><strong>History stays yours</strong><span>Objects, interventions, earlier meanings, collaboration evidence, and releases keep their provenance.</span></div>
          </div>
        </div></section>

        <div class="split" style="margin-top:16px">
          <div class="stack">
            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Open a direction <small>One honest reason is enough</small></h3>
              <div class="grid-2">
                <label class="field-label">Direction<select id="personalProjectTemplate" class="select-input full-width">${Directions.PROJECT_TEMPLATES.map((template) => `<option value="${template.id}">${escapeHtml(template.name)}</option>`).join('')}</select></label>
                <label class="field-label">Existing object for restoration<select id="personalProjectObject" class="select-input full-width">${owned.length ? owned.map(({ object, property, stored }) => { const definition = Content.furnitureById(object.catalogId); return `<option value="${object.id}">${escapeHtml(definition?.name || object.catalogId)} · condition ${Math.round(object.condition)} · ${stored ? 'stored' : escapeHtml(property?.name || 'placed')}</option>`; }).join('') : '<option value="">No eligible object</option>'}</select></label>
                <label class="field-label">Place for non-object directions<select id="personalProjectPlace" class="select-input full-width">${world.places.map((place) => `<option value="${place.id}">${escapeHtml(place.name)}</option>`).join('')}</select></label>
                <label class="field-label">Title<input id="personalProjectTitle" class="text-input full-width" maxlength="80" value=""></label>
              </div>
              <label class="field-label">Why it matters to you<textarea id="personalProjectMeaning" class="text-input full-width" rows="3" maxlength="320" placeholder="Not a productivity target—name the human, practical, strange, or personal reason."></textarea></label>
              <button class="button primary" data-action="create-personal-project"><strong>Open this undated direction</strong><span>No age requirement, due date, streak, compulsory unlock, or abandonment penalty will be created.</span></button>
            </div></section>

            <section class="card"><div class="card-inner">
              <h3 class="card-title">Open directions <small>Work one chapter, leave all quiet, or change course</small></h3>
              ${openProjects.length ? `<div class="stack">${openProjects.map((project) => this.renderPersonalProjectCard(world, project, connections, true)).join('')}</div>` : '<div class="empty-state">Nothing is demanding your time. A project can begin later—or never—and this life remains complete.</div>'}
            </div></section>

            ${closedProjects.length ? `<section class="card"><div class="card-inner"><h3 class="card-title">Preserved project history <small>Completed and released are different, not superior and failed</small></h3><div class="stack">${closedProjects.map((project) => this.renderPersonalProjectCard(world, project, connections, false)).join('')}</div></div></section>` : ''}
          </div>

          <aside class="stack">
            <section class="card choice-life-card"><div class="card-inner stack">
              <h3 class="card-title">Life context <small>Age is never a countdown</small></h3>
              <div class="callout"><strong>${escapeHtml(lifeContextLabel(world, world.player))}</strong><br>${world.settings.lifeCourseMode === 'choice' ? 'The simulation clock cannot push you out of this chapter.' : 'Calendar aging is optional and currently active because you selected it.'}</div>
              <div class="button-grid">
                <button class="button ${world.settings.lifeCourseMode === 'choice' ? 'primary' : ''}" data-action="set-life-course-mode" data-mode="choice" ${world.settings.lifeCourseMode === 'choice' ? 'disabled' : ''}>Choice-first</button>
                <button class="button ${world.settings.lifeCourseMode === 'calendar' ? 'secondary' : 'ghost'}" data-action="set-life-course-mode" data-mode="calendar" ${world.settings.lifeCourseMode === 'calendar' ? 'disabled' : ''}>Optional calendar</button>
                <button class="button ghost" data-action="toggle-exact-ages">${world.settings.showExactAges ? 'Hide exact ages' : 'Show exact ages'}</button>
                ${world.settings.lifeCourseMode === 'choice' && nextStage ? `<button class="button secondary" data-action="advance-life-chapter" data-id="player"><strong>Open ${escapeHtml(Core.titleCase(nextStage))}</strong><span>Only by explicit choice; every open project crosses with you.</span></button>` : ''}
              </div>
            </div></section>

            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Labeled foundation experiment</h3>
              <p class="muted small-text">Creates one real restoration direction from an existing owned object, lives its first chapter, and optionally sends one consent-preserving collaboration invitation.</p>
              <button class="button ${world.flags.personalDirectionsExperimentPrepared ? 'ghost' : 'secondary'}" data-action="prepare-directions-experiment" ${world.flags.personalDirectionsExperimentPrepared ? 'disabled' : ''}><strong>${world.flags.personalDirectionsExperimentPrepared ? 'Directions experiment already prepared' : 'Prepare personal-direction test'}</strong><span>Recorded as QA setup; no age, money, object, or relationship history is silently invented.</span></button>
            </div></section>

            <section class="card"><div class="card-inner">
              <h3 class="card-title">Direction evidence <small>Observed history, not a moral score</small></h3>
              <div class="kv-list">
                <div class="kv-row"><span>Chapters lived</span><strong>${world.metrics.personalProjectChaptersCompleted || 0}</strong></div>
                <div class="kv-row"><span>Projects reshaped</span><strong>${world.metrics.personalProjectsReshaped || 0}</strong></div>
                <div class="kv-row"><span>Collaborations accepted / declined</span><strong>${world.metrics.projectCollaborationsAccepted || 0} / ${world.metrics.projectCollaborationsDeclined || 0}</strong></div>
                <div class="kv-row"><span>NPC directions open</span><strong>${metrics.npcOpen}</strong></div>
                <div class="kv-row"><span>Age-pressure mechanics</span><strong>None</strong></div>
              </div>
            </div></section>

            ${npcProjects.length ? `<section class="card"><div class="card-inner"><h3 class="card-title">Residents following their own threads <small>Observe; do not puppeteer</small></h3><div class="stack">${npcProjects.slice(0, 8).map((project) => { const owner = World.getPerson(world, project.ownerId); return `<div class="subtle-card"><div class="proposal-head"><div><strong>${escapeHtml(owner?.name || project.ownerId)}</strong><p>${escapeHtml(project.title)}</p></div><span class="pill ${project.status === 'completed' ? 'good' : project.status === 'paused' ? 'warn' : 'info'}">${escapeHtml(Core.titleCase(project.status))}</span></div><div class="pill-row"><span class="pill">${project.stageIndex}/${project.chapters.length} chapters</span><span class="pill good">No age gate</span></div></div>`; }).join('')}</div></div></section>` : ''}
          </aside>
        </div>
      `;
    },

    renderPersonalProjectCard(world, project, connections, open) {
      const template = Directions.templateById(project.templateId);
      const chapter = Directions.currentChapter(project);
      const progress = project.chapters.length ? project.stageIndex / project.chapters.length * 100 : 0;
      const collaborators = project.collaboratorIds.map((id) => World.personName(world, id));
      const pending = project.collaborationRequests.filter((entry) => entry.status === 'pending_npc');
      const eligible = connections.map((connection) => connection.personIds.find((id) => id !== 'player')).filter((id) => id && !project.collaboratorIds.includes(id) && !pending.some((entry) => entry.personId === id));
      const materialText = chapter ? Object.entries(chapter.materials || {}).map(([id, amount]) => `${amount} ${Content.MATERIALS[id]?.name || id}`).join(' · ') : '';
      const tone = project.status === 'completed' ? 'good' : project.status === 'paused' ? 'warn' : project.status === 'active' ? 'info' : '';
      return `<article class="proposal-card status-${escapeAttr(project.status)} personal-project-card">
        <div class="proposal-head"><div><span class="proposal-type">${escapeHtml(template?.name || project.templateId)}</span><h4>${escapeHtml(project.title)}</h4><p>Opened day ${project.createdDay} · ${escapeHtml(project.target.label)} · ${escapeHtml(lifeContextLabel(world, world.player))}</p></div><span class="pill ${tone}">${escapeHtml(Core.titleCase(project.status))}</span></div>
        <div class="callout">${escapeHtml(project.meaning)}</div>
        <div class="meter" title="${project.stageIndex}/${project.chapters.length} chapters"><span style="--value:${progress}%"></span></div>
        <div class="pill-row"><span class="pill">${project.stageIndex}/${project.chapters.length} chapters</span><span class="pill good">No deadline</span><span class="pill good">No age gate</span>${collaborators.length ? `<span class="pill info">With ${collaborators.map(escapeHtml).join(' · ')}</span>` : ''}</div>
        ${chapter && open ? `<div class="subtle-card"><h4>${escapeHtml(chapter.title)}</h4><p>${escapeHtml(chapter.description)}</p><div class="pill-row"><span class="pill">${chapter.hours}h</span><span class="pill">${Core.formatMoney(chapter.money)}</span>${materialText ? `<span class="pill">${escapeHtml(materialText)}</span>` : ''}</div></div>` : ''}
        ${open ? `<div class="button-grid">
          ${project.status === 'active' && chapter ? `<button class="button primary" data-action="work-personal-project" data-id="${project.id}"><strong>Live this chapter</strong><span>Uses real time and resources; nothing after it becomes compulsory.</span></button><button class="button ghost" data-action="pause-personal-project" data-id="${project.id}">Pause indefinitely</button>` : ''}
          ${project.status === 'paused' ? `<button class="button primary" data-action="resume-personal-project" data-id="${project.id}">Return in your own time</button>` : ''}
          <button class="button ghost" data-action="release-personal-project" data-id="${project.id}">Release without failure</button>
        </div>
        <details class="proposal-history"><summary>Reshape or invite help</summary><div class="stack" style="margin-top:10px">
          <input id="project-title-${project.id}" class="text-input full-width" maxlength="80" value="${escapeAttr(project.title)}">
          <textarea id="project-meaning-${project.id}" class="text-input full-width" rows="3" maxlength="320">${escapeHtml(project.meaning)}</textarea>
          <button class="button small" data-action="reshape-personal-project" data-id="${project.id}">Preserve history and reshape</button>
          ${eligible.length ? `<select id="project-collaborator-${project.id}" class="select-input full-width">${eligible.map((id) => `<option value="${id}">${escapeHtml(World.personName(world, id))}</option>`).join('')}</select><button class="button small secondary" data-action="invite-project-collaborator" data-id="${project.id}">Invite; answer remains autonomous</button>` : '<p class="muted small-text">Meet someone through community history before inviting them. Collaboration never transfers target ownership.</p>'}
          ${pending.length ? `<div class="callout">Awaiting: ${pending.map((entry) => escapeHtml(World.personName(world, entry.personId))).join(' · ')}. Sending did not create consent.</div>` : ''}
        </div></details>` : `<div class="button-grid">${['completed', 'released'].includes(project.status) ? `<button class="button ghost" data-action="archive-personal-project" data-id="${project.id}">Archive preserved history</button>` : ''}</div>`}
        ${project.history?.length ? `<details class="proposal-history"><summary>${project.history.length} provenance event${project.history.length === 1 ? '' : 's'}</summary><div class="history-list">${project.history.slice(-8).reverse().map((entry) => this.renderHistoryEntry(entry)).join('')}</div></details>` : ''}
      </article>`;
    },


    renderEconomy(world) {
      Economy.ensureState(world);
      const metrics = Economy.metrics(world);
      const playerEnterprises = Economy.enterprisesFor(world, 'player').slice().sort((a, b) => (b.updatedDay || b.createdDay) - (a.updatedDay || a.createdDay));
      const residentEnterprises = world.enterprises.filter((entry) => entry.ownerId !== 'player').slice().sort((a, b) => (b.updatedDay || b.createdDay) - (a.updatedDay || a.createdDay));
      const premises = Economy.commercialPremises(world);
      const needs = world.localNeeds.slice().sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      const projects = Directions.projectsFor(world, 'player').filter((entry) => ['active', 'paused', 'completed'].includes(entry.status));
      const vacantPremises = premises.filter((entry) => entry.listedForLease && !entry.occupantEnterpriseId);
      const activeSession = Economy.sessionById(world, world.activeEnterpriseSessionId);
      const selected = Economy.enterpriseById(world, world.ui.selectedEnterpriseId) || playerEnterprises.find((entry) => entry.status !== 'closed') || playerEnterprises[0] || null;
      if (selected && world.ui.selectedEnterpriseId !== selected.id) world.ui.selectedEnterpriseId = selected.id;
      return `
        <div class="view-title-row">
          <div>
            <h2>Living local economy—not a mandatory business ladder</h2>
            <p>A personal direction may stay private forever, become occasional paid work, use one real commercial room, become a small cooperative, pause, pivot, or close. Customers are actual residents with money, homes, needs, and histories—not anonymous demand tokens.</p>
          </div>
          <div class="pill-row"><span class="pill ${metrics.playerDirections ? 'good' : 'info'}">${metrics.playerDirections} player direction${metrics.playerDirections === 1 ? '' : 's'}</span><span class="pill">${metrics.npcDirections} resident direction${metrics.npcDirections === 1 ? '' : 's'}</span><span class="pill">${metrics.vacantPremises}/${metrics.premises} rooms vacant</span><span class="pill">${metrics.customersServed} residents served</span><span class="pill ${metrics.pendingWorkOffers ? 'warn' : ''}">${metrics.pendingWorkOffers} work answer${metrics.pendingWorkOffers === 1 ? '' : 's'} pending</span><span class="pill">${metrics.activeWorkers} resident worker${metrics.activeWorkers === 1 ? '' : 's'}</span></div>
        </div>

        <section class="card community-root-card"><div class="card-inner">
          <div class="grid-4">
            <div class="agreement-principle"><strong>Business is optional</strong><span>No age gate, wealth gate, required scaling, prestige track, or compulsory endgame.</span></div>
            <div class="agreement-principle"><strong>Real residents</strong><span>Every customer is an existing person. Money and effects move through the same town state.</span></div>
            <div class="agreement-principle"><strong>Small stays valid</strong><span>Private practice and occasional service are complete directions—not failed versions of a larger company.</span></div>
            <div class="agreement-principle"><strong>Exit keeps history</strong><span>Pause, pivot, and closure preserve equipment, work, customers, source projects, and reasons.</span></div>
          </div>
        </div></section>

        ${activeSession ? this.renderActiveEnterpriseSession(world, activeSession) : ''}

        <div class="split" style="margin-top:16px">
          <div class="stack">
            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Begin one small direction <small>It may remain private forever</small></h3>
              <div class="grid-2">
                <label class="field-label">Shape<select id="enterpriseTemplate" class="select-input full-width">${Economy.ENTERPRISE_TEMPLATES.map((template) => `<option value="${template.id}">${escapeHtml(template.name)}</option>`).join('')}</select></label>
                <label class="field-label">Starting path<select id="enterprisePath" class="select-input full-width">${Economy.ENTERPRISE_PATHS.map((path) => `<option value="${path}" ${path === 'private_hobby' ? 'selected' : ''}>${escapeHtml(Core.titleCase(path))}</option>`).join('')}</select></label>
                <label class="field-label">Source personal direction<select id="enterpriseSourceProject" class="select-input full-width"><option value="">No source project required</option>${projects.map((project) => `<option value="${project.id}">${escapeHtml(project.title)} · ${escapeHtml(Core.titleCase(project.status))}</option>`).join('')}</select></label>
                <label class="field-label">Grounded neighborhood need<select id="enterpriseNeed" class="select-input full-width"><option value="">Let the engine choose the strongest fit</option>${needs.map((need) => `<option value="${need.id}">${escapeHtml(need.name)} · signal ${Math.round(need.score)}</option>`).join('')}</select></label>
                <label class="field-label">Commercial room for tiny/cooperative path<select id="enterprisePremise" class="select-input full-width"><option value="">No room</option>${vacantPremises.map((premise) => `<option value="${premise.id}">${escapeHtml(premise.name)} · ${Core.formatMoney(premise.deposit + premise.weeklyLease)} to begin</option>`).join('')}</select></label>
                <label class="field-label">Pricing<select id="enterprisePricing" class="select-input full-width">${Economy.PRICING_MODES.map((mode) => `<option value="${mode}" ${mode === 'pay_what_fits' ? 'selected' : ''}>${escapeHtml(Core.titleCase(mode))}</option>`).join('')}</select></label>
                <label class="field-label">Name<input id="enterpriseName" class="text-input full-width" maxlength="54" placeholder="A small name that fits the direction"></label>
                <label class="field-label">Base price<input id="enterpriseBasePrice" class="text-input full-width" type="number" min="0" max="500" step="1" value="18"></label>
              </div>
              <label class="field-label">Why this direction matters<textarea id="enterprisePurpose" class="text-input full-width" rows="3" maxlength="280" placeholder="A practical, personal, local, strange, or human reason—not a growth target."></textarea></label>
              <button class="button primary" data-action="create-enterprise"><strong>Begin without creating a life obligation</strong><span>Only the chosen path, attributable startup cost, and real authority are created.</span></button>
            </div></section>

            <section class="card"><div class="card-inner">
              <h3 class="card-title">Your living directions <small>Open one, leave all quiet, or close one honestly</small></h3>
              ${playerEnterprises.length ? `<div class="stack">${playerEnterprises.map((enterprise) => this.renderEnterpriseCard(world, enterprise, enterprise.id === selected?.id)).join('')}</div>` : '<div class="empty-state">No enterprise is waiting for you. Employment, personal projects, care, community, rest, and ordinary life remain complete paths.</div>'}
            </div></section>
          </div>

          <aside class="stack">
            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Neighborhood need signals <small>Evidence, not market pressure</small></h3>
              ${needs.map((need) => {
                const names = (need.evidence?.personIds || []).slice(0, 5).map((id) => World.personName(world, id));
                return `<article class="subtle-card"><div class="proposal-head"><div><h4>${escapeHtml(need.name)}</h4><p>${escapeHtml(need.description)}</p></div><span class="pill ${need.score >= 65 ? 'warn' : 'info'}">Signal ${Math.round(need.score)}</span></div><div class="meter"><span style="--value:${Core.clamp(need.score, 0, 100)}%"></span></div><div class="pill-row"><span class="pill">${need.servedCount} served</span><span class="pill">Satisfaction ${Math.round(need.satisfaction)}</span><span class="pill">${need.freeOrFlexibleCount} flexible/free</span></div>${names.length ? `<div class="causes">Current evidence includes ${names.map(escapeHtml).join(' · ')}${(need.evidence?.personIds || []).length > names.length ? ' · …' : ''}</div>` : '<div class="causes">No resident evidence currently raises this signal.</div>'}</article>`;
              }).join('')}
            </div></section>

            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Real commercial rooms <small>The town does not reserve them for you</small></h3>
              ${premises.map((premise) => {
                const enterprise = premise.occupantEnterpriseId ? Economy.enterpriseById(world, premise.occupantEnterpriseId) : null;
                return `<article class="subtle-card"><div class="proposal-head"><div><h4>${escapeHtml(premise.name)}</h4><p>${escapeHtml(premise.description)}</p></div><span class="pill ${premise.listedForLease ? 'good' : 'info'}">${premise.listedForLease ? 'Vacant' : 'Occupied'}</span></div><div class="kv-list"><div class="kv-row"><span>Weekly room cost</span><strong>${Core.formatMoney(premise.weeklyLease)}</strong></div><div class="kv-row"><span>Deposit</span><strong>${Core.formatMoney(premise.deposit)}</strong></div><div class="kv-row"><span>Condition</span><strong>${Math.round(premise.condition)}</strong></div><div class="kv-row"><span>Current direction</span><strong>${enterprise ? escapeHtml(enterprise.name) : 'None'}</strong></div></div><div class="button-grid"><button class="button small" data-action="select-place" data-id="${premise.id}">Inspect on town map</button>${enterprise ? `<button class="button small secondary" data-action="open-enterprise" data-id="${enterprise.id}">See direction</button>` : ''}</div></article>`;
              }).join('')}
            </div></section>

            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Resident-authored economy <small>NPCs can begin, remain small, work, pause, and change</small></h3>
              ${residentEnterprises.length ? residentEnterprises.slice(0, 10).map((enterprise) => {
                const owner = World.getPerson(world, enterprise.ownerId);
                const premise = Economy.premiseById(world, enterprise.premiseId);
                return `<article class="subtle-card"><div class="proposal-head"><div><h4>${escapeHtml(enterprise.name)}</h4><p>${escapeHtml(owner?.name || enterprise.ownerId)} · ${escapeHtml(Core.titleCase(enterprise.path))}${premise ? ` · ${escapeHtml(premise.name)}` : ''}</p></div><span class="pill ${enterprise.status === 'open' ? 'good' : enterprise.status === 'paused' ? 'warn' : ''}">${escapeHtml(Core.titleCase(enterprise.status))}</span></div><p>${escapeHtml(enterprise.purpose)}</p><div class="pill-row"><span class="pill">${enterprise.totals.customers} residents served</span><span class="pill">${enterprise.totals.sessions} sessions</span><span class="pill">${Core.formatMoney(enterprise.funds)} held</span></div><button class="button small" data-action="open-enterprise" data-id="${enterprise.id}">Inspect history</button></article>`;
              }).join('') : '<div class="empty-state">Residents have not opened any directions yet.</div>'}
            </div></section>

            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Labeled local-economy experiment</h3>
              <p class="muted small-text">Adds an explicit QA grant, begins one bounded repair direction, lawfully uses one vacant room when available, and runs one ordinary compressed session with actual residents.</p>
              <button class="button ${world.flags.enterpriseExperimentPrepared ? 'ghost' : 'secondary'}" data-action="prepare-enterprise-experiment" ${world.flags.enterpriseExperimentPrepared ? 'disabled' : ''}><strong>${world.flags.enterpriseExperimentPrepared ? 'Economy experiment already prepared' : 'Prepare local-economy test'}</strong><span>Clearly logged as accelerated QA—not ordinary progression.</span></button>
            </div></section>
          </aside>
        </div>`;
    },

    renderActiveEnterpriseSession(world, session) {
      const enterprise = Economy.enterpriseById(world, session.enterpriseId);
      const template = Economy.templateById(enterprise?.templateId);
      if (!enterprise || !template) return '';
      return `<section class="card active-shift-card" style="margin-top:16px"><div class="card-inner stack">
        <div class="proposal-head"><div><span class="proposal-type">Entered enterprise session</span><h3>${escapeHtml(enterprise.name)}</h3><p>${session.taskActions.length}/3 grounded work moments chosen · no hidden throughput bonus required</p></div><span class="pill warn">Active</span></div>
        <div class="callout">Choose how to influence this one work block. Three chosen moments finish it automatically. Cancelling creates no customers or revenue${session.workerIds?.length ? ` and returns the reserved ${Core.formatMoney(session.wageReserve)} worker wage` : ''}.</div>
        ${session.workerIds?.length ? `<div class="pill-row"><span class="pill good">Working by consent: ${session.workerIds.map((id) => escapeHtml(World.personName(world, id))).join(' · ')}</span><span class="pill">Reserved wage ${Core.formatMoney(session.wageReserve)}</span></div>` : '<div class="pill-row"><span class="pill">Owner-only session</span></div>'}
        <div class="button-grid">${template.actions.map((action) => `<button class="button" data-action="enterprise-task" data-id="${enterprise.id}" data-task="${action.id}" ${session.taskActions.length >= 3 ? 'disabled' : ''}><strong>${escapeHtml(action.name)}</strong><span>${escapeHtml(action.note)}</span></button>`).join('')}</div>
        <div class="button-grid">${session.taskActions.length ? `<button class="button primary" data-action="finish-enterprise-session" data-id="${enterprise.id}">Finish this bounded session</button>` : ''}<button class="button ghost" data-action="cancel-enterprise-session" data-id="${enterprise.id}">Cancel without invented customers</button></div>
      </div></section>`;
    },

    renderEnterpriseCard(world, enterprise, selected = false) {
      const owner = World.getPerson(world, enterprise.ownerId);
      const template = Economy.templateById(enterprise.templateId);
      const need = Economy.needById(world, enterprise.needId);
      const premise = Economy.premiseById(world, enterprise.premiseId);
      const source = enterprise.sourceProjectId ? Directions.projectById(world, enterprise.sourceProjectId) : null;
      const isPlayer = enterprise.ownerId === 'player';
      const canServe = isPlayer && ['occasional', 'open'].includes(enterprise.status) && !world.activeShift && !world.activeEnterpriseSessionId;
      const vacantPremises = Economy.commercialPremises(world).filter((entry) => entry.listedForLease || entry.id === enterprise.premiseId);
      const recentCustomers = enterprise.customerHistory.slice(-5).reverse();
      const workOffers = (world.enterpriseWorkOffers || []).filter((offer) => offer.enterpriseId === enterprise.id).slice().sort((a, b) => b.createdDay - a.createdDay || b.createdHour - a.createdHour);
      const activeWorkers = (enterprise.workerIds || []).map((id) => World.getPerson(world, id)).filter(Boolean);
      const eligibleWorkers = isPlayer ? world.people.filter((person) => Economy.eligibleEnterpriseWorker(world, enterprise, person)).slice(0, 18) : [];
      const net = Core.round(enterprise.totals.revenue - enterprise.totals.costs, 2);
      return `<article class="proposal-card status-${escapeAttr(enterprise.status)} ${selected ? 'selected-project-card' : ''}">
        <div class="proposal-head"><div><span class="proposal-type">${escapeHtml(template?.name || enterprise.templateId)} · ${escapeHtml(Core.titleCase(enterprise.path))}</span><h4>${escapeHtml(enterprise.name)}</h4><p>${escapeHtml(owner?.name || enterprise.ownerId)} · began day ${enterprise.createdDay}${source ? ` · from “${escapeHtml(source.title)}”` : ''}</p></div><span class="pill ${enterprise.status === 'open' ? 'good' : enterprise.status === 'paused' ? 'warn' : enterprise.status === 'closed' ? '' : 'info'}">${escapeHtml(Core.titleCase(enterprise.status))}</span></div>
        <p>${escapeHtml(enterprise.purpose)}</p>
        <div class="pill-row"><span class="pill good">Optional</span><span class="pill good">No age gate</span><span class="pill good">No growth requirement</span>${need ? `<span class="pill info">${escapeHtml(need.name)}</span>` : ''}${premise ? `<span class="pill">${escapeHtml(premise.name)}</span>` : '<span class="pill">No commercial room</span>'}</div>
        <div class="grid-2">
          <div class="kv-list"><div class="kv-row"><span>Enterprise funds</span><strong>${Core.formatMoney(enterprise.funds)}</strong></div><div class="kv-row"><span>Revenue / cost</span><strong>${Core.formatMoney(enterprise.totals.revenue)} / ${Core.formatMoney(enterprise.totals.costs)}</strong></div><div class="kv-row"><span>Wages paid</span><strong>${Core.formatMoney(enterprise.totals.wages || 0)}</strong></div><div class="kv-row"><span>Recorded net</span><strong>${Core.formatMoney(net)}</strong></div><div class="kv-row"><span>Sessions / residents</span><strong>${enterprise.totals.sessions} / ${enterprise.totals.customers}</strong></div></div>
          <div class="kv-list"><div class="kv-row"><span>Care reputation</span><strong>${Math.round(enterprise.reputation.care)}</strong></div><div class="kv-row"><span>Reliability</span><strong>${Math.round(enterprise.reputation.reliability)}</strong></div><div class="kv-row"><span>Need fit</span><strong>${Math.round(enterprise.reputation.fit)}</strong></div><div class="kv-row"><span>Flexible/free services</span><strong>${enterprise.totals.freeOrFlexibleServices}</strong></div></div>
        </div>
        ${recentCustomers.length ? `<details><summary>Recent actual resident customers</summary><div class="history-list">${recentCustomers.map((entry) => `<div class="history-entry"><strong>${escapeHtml(World.personName(world, entry.personId))}</strong><span>Day ${entry.day} · ${Core.formatMoney(entry.price)} · satisfaction ${Math.round(entry.satisfaction)}${entry.flexibleOrFree ? ' · flexible/free' : ''}</span></div>`).join('')}</div></details>` : '<div class="callout">No resident customer has used this direction yet. The engine will not fabricate demand to make the numbers look alive.</div>'}
        ${isPlayer && enterprise.status !== 'closed' ? `<div class="stack">
          <div class="button-grid">${canServe ? `<button class="button primary" data-action="start-enterprise-session" data-id="${enterprise.id}" data-mode="compressed"><strong>Run one compressed session</strong><span>Three hours pass; no penalty for not entering.</span></button><button class="button secondary" data-action="start-enterprise-session" data-id="${enterprise.id}" data-mode="interactive"><strong>Enter one work session</strong><span>Influence the block without making interaction compulsory.</span></button>` : ''}${enterprise.status === 'paused' ? `<button class="button" data-action="resume-enterprise" data-id="${enterprise.id}">Resume on your timetable</button>` : premise ? `<button class="button ghost" data-action="pause-enterprise-keep" data-id="${enterprise.id}" ${enterprise.currentSessionId ? 'disabled' : ''}>Pause; keep room and visible costs</button><button class="button ghost" data-action="pause-enterprise-release" data-id="${enterprise.id}" ${enterprise.currentSessionId ? 'disabled' : ''}>Pause and release room</button>` : `<button class="button ghost" data-action="pause-enterprise" data-id="${enterprise.id}" ${enterprise.currentSessionId ? 'disabled' : ''}>Pause without failure</button>`}<button class="button danger" data-action="close-enterprise" data-id="${enterprise.id}" ${enterprise.currentSessionId ? 'disabled' : ''}>Close and preserve history</button></div>
          <details><summary>Change scale without a growth ladder</summary><div class="grid-2"><label class="field-label">Path<select id="enterprise-path-${enterprise.id}" class="select-input full-width">${Economy.ENTERPRISE_PATHS.map((path) => `<option value="${path}" ${path === enterprise.path ? 'selected' : ''}>${escapeHtml(Core.titleCase(path))}</option>`).join('')}</select></label><label class="field-label">Room when required<select id="enterprise-premise-${enterprise.id}" class="select-input full-width"><option value="">No room selected</option>${vacantPremises.map((entry) => `<option value="${entry.id}" ${entry.id === enterprise.premiseId ? 'selected' : ''}>${escapeHtml(entry.name)} · ${Core.formatMoney(entry.deposit + entry.weeklyLease)}</option>`).join('')}</select></label></div><button class="button small" data-action="change-enterprise-path" data-id="${enterprise.id}">Apply explicit path choice</button></details>
          <details><summary>Pricing and attributable funds</summary><div class="grid-2"><label class="field-label">Pricing mode<select id="enterprise-pricing-${enterprise.id}" class="select-input full-width">${Economy.PRICING_MODES.map((mode) => `<option value="${mode}" ${mode === enterprise.pricing.mode ? 'selected' : ''}>${escapeHtml(Core.titleCase(mode))}</option>`).join('')}</select></label><label class="field-label">Base price<input id="enterprise-price-${enterprise.id}" class="text-input full-width" type="number" min="0" max="500" step="1" value="${escapeAttr(enterprise.pricing.basePrice)}"></label></div><div class="button-grid"><button class="button small" data-action="set-enterprise-pricing" data-id="${enterprise.id}">Update pricing</button><button class="button small ghost" data-action="withdraw-enterprise-funds" data-id="${enterprise.id}" ${enterprise.funds <= 0 ? 'disabled' : ''}>Withdraw available funds</button></div></details>
          <details><summary>Bounded resident work · ${activeWorkers.length} active</summary><div class="stack" style="margin-top:10px">
            <div class="callout">A work offer creates no labor, ownership, household role, tenancy, or control until the resident answers. Accepted work is capped at 1–3 sessions per week and each used session reserves its wage before it begins.</div>
            ${eligibleWorkers.length && ['occasional', 'open'].includes(enterprise.status) ? `<div class="grid-3"><label class="field-label">Resident<select id="enterprise-worker-${enterprise.id}" class="select-input full-width">${eligibleWorkers.map((person) => `<option value="${person.id}">${escapeHtml(person.name)} · ${escapeHtml(Content.jobById(person.jobId)?.name || 'between jobs')}</option>`).join('')}</select></label><label class="field-label">Wage per session<input id="enterprise-worker-wage-${enterprise.id}" class="text-input full-width" type="number" min="6" max="250" step="1" value="24"></label><label class="field-label">Sessions per week<input id="enterprise-worker-sessions-${enterprise.id}" class="text-input full-width" type="number" min="1" max="3" step="1" value="1"></label></div><button class="button small secondary" data-action="invite-enterprise-worker" data-id="${enterprise.id}">Send bounded offer; answer later</button>` : '<p class="muted small-text">No new eligible resident is available right now, or the direction is not open for service.</p>'}
            ${workOffers.length ? `<div class="stack">${workOffers.slice(0, 10).map((offer) => { const person = World.getPerson(world, offer.personId); return `<article class="subtle-card"><div class="proposal-head"><div><h4>${escapeHtml(person?.name || offer.personId)}</h4><p>${Core.formatMoney(offer.wagePerSession)} per session · up to ${offer.sessionsPerWeek}/week${offer.lastWorkedDay ? ` · last worked day ${offer.lastWorkedDay}` : ''}</p></div><span class="pill ${offer.status === 'accepted' ? 'good' : offer.status === 'pending_npc' ? 'warn' : ''}">${escapeHtml(Core.titleCase(offer.status))}</span></div><div class="pill-row"><span class="pill good">Enterprise work only</span><span class="pill">No ownership</span><span class="pill">No tenancy</span><span class="pill">No household authority</span></div>${offer.status === 'pending_npc' ? `<button class="button small ghost" data-action="withdraw-enterprise-work-offer" data-id="${offer.id}">Withdraw before consent</button>` : ''}${offer.status === 'accepted' ? `<button class="button small ghost" data-action="end-enterprise-worker" data-id="${enterprise.id}" data-person="${offer.personId}">End bounded agreement</button>` : ''}</article>`; }).join('')}</div>` : '<p class="muted small-text">No work offers have been made. Owner-only operation remains fully valid.</p>'}
          </div></details>
          <details><summary>Pivot while preserving equipment and provenance</summary><div class="grid-2"><label class="field-label">New direction<select id="enterprise-pivot-${enterprise.id}" class="select-input full-width">${Economy.ENTERPRISE_TEMPLATES.map((entry) => `<option value="${entry.id}" ${entry.id === enterprise.templateId ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}</select></label><label class="field-label">Need signal<select id="enterprise-pivot-need-${enterprise.id}" class="select-input full-width"><option value="">Strongest compatible signal</option>${world.localNeeds.map((entry) => `<option value="${entry.id}">${escapeHtml(entry.name)}</option>`).join('')}</select></label></div><button class="button small secondary" data-action="pivot-enterprise" data-id="${enterprise.id}">Pivot without deleting existing equipment</button></details>
        </div>` : ''}
        ${enterprise.equipment.length ? `<details><summary>${enterprise.equipment.length} repairable equipment object${enterprise.equipment.length === 1 ? '' : 's'}</summary><div class="stack">${enterprise.equipment.map((equipment) => `<article class="subtle-card"><div class="proposal-head"><div><h4>${escapeHtml(equipment.name)}</h4><p>Same object ID since day ${equipment.acquiredDay} · ${escapeHtml(equipment.acquisition)}</p></div><span class="pill ${equipment.condition < 45 ? 'warn' : 'good'}">Condition ${Math.round(equipment.condition)}</span></div><div class="pill-row">${Economy.EQUIPMENT_AXES.map((axis) => `<span class="pill">${escapeHtml(Core.titleCase(axis))} ${equipment.upgrades[axis]}/5</span>`).join('')}</div>${isPlayer && enterprise.status !== 'closed' ? `<div class="button-grid"><button class="button small" data-action="repair-enterprise-equipment" data-id="${enterprise.id}" data-equipment="${equipment.id}" ${equipment.condition >= 99 ? 'disabled' : ''}>Repair, don’t replace</button>${Economy.EQUIPMENT_AXES.map((axis) => `<button class="button small ghost" data-action="upgrade-enterprise-equipment" data-id="${enterprise.id}" data-equipment="${equipment.id}" data-axis="${axis}" ${equipment.upgrades[axis] >= 5 ? 'disabled' : ''}>+ ${escapeHtml(Core.titleCase(axis))}</button>`).join('')}</div>` : ''}</article>`).join('')}</div></details>` : ''}
        ${enterprise.history?.length ? `<details class="proposal-history"><summary>${enterprise.history.length} enterprise-history event${enterprise.history.length === 1 ? '' : 's'}</summary><div class="history-list">${enterprise.history.slice(-12).reverse().map((entry) => this.renderHistoryEntry(entry)).join('')}</div></details>` : ''}
      </article>`;
    },

    renderStewardship(world) {
      const metrics = Stewardship.metrics(world);
      const pending = world.stewardshipRequests
        .filter((request) => request.status === 'pending_player')
        .slice().sort((a, b) => a.createdDay - b.createdDay || a.createdHour - b.createdHour);
      const active = world.habitatIntentions
        .filter((intention) => !Stewardship.TERMINAL_INTENTION.has(intention.status))
        .slice().sort((a, b) => {
          const priority = { awaiting_permission: 0, working: 1, ready: 2, approved_saving: 3, saving: 4 };
          return (priority[a.status] ?? 9) - (priority[b.status] ?? 9) || b.createdDay - a.createdDay;
        });
      const recent = world.habitatIntentions
        .filter((intention) => Stewardship.TERMINAL_INTENTION.has(intention.status))
        .slice().sort((a, b) => (b.completedDay || b.createdDay) - (a.completedDay || a.createdDay))
        .slice(0, 12);
      const ownedOccupied = (world.player.ownedPropertyIds || [])
        .map((id) => World.getProperty(world, id))
        .filter((property) => property && property.tenants.some((id) => id !== 'player'));

      return `
        <div class="view-title-row">
          <div>
            <h2>Autonomous habitat shaping with real authority</h2>
            <p>Residents can notice a need, choose an exact change, save toward it, ask everyone whose authority matters, acquire recorded materials, and perform the same phased construction used by the player. Approval never becomes instant building; refusal never becomes hidden punishment.</p>
          </div>
          <div class="pill-row">
            <span class="pill ${pending.length ? 'warn' : 'good'}">${pending.length} decision${pending.length === 1 ? '' : 's'} for you</span>
            <span class="pill info">${metrics.activeIntentions} active intention${metrics.activeIntentions === 1 ? '' : 's'}</span>
            <span class="pill good">${metrics.completedIntentions} completed</span>
            <span class="pill">${Core.formatMoney(metrics.escrowMoney)} in active escrow</span>
          </div>
        </div>

        ${pending.length ? `<section class="card agreement-highlight"><div class="card-inner">
          <h3 class="card-title">Requests waiting for your decision <small>Nothing below has started construction</small></h3>
          <div class="stack">${pending.map((request) => this.renderStewardshipRequestCard(world, request)).join('')}</div>
        </div></section>` : `<section class="card"><div class="card-inner"><div class="callout">No resident request currently needs your answer. External landlords and co-tenants still make their own recorded decisions elsewhere in the town.</div></div></section>`}

        <div class="split" style="margin-top:16px">
          <div class="stack">
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Intentions in motion <small>Saving, permission, materials, and work remain separate stages</small></h3>
              ${active.length ? `<div class="stack">${active.map((intention) => this.renderHabitatIntentionCard(world, intention)).join('')}</div>` : '<div class="empty-state">No active intention right now. Residents will form new ones when needs, preferences, finances, and cooldowns align.</div>'}
            </div></section>
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Recent outcomes <small>Completions, refusals, withdrawals, and failures all remain visible</small></h3>
              ${recent.length ? `<div class="stack">${recent.map((intention) => this.renderHabitatIntentionCard(world, intention, true)).join('')}</div>` : '<div class="empty-state">No stewardship outcome has been recorded yet.</div>'}
            </div></section>
          </div>
          <aside class="stack">
            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Property stewardship lab <small>Explicitly labeled setup, not normal progression</small></h3>
              <p class="muted small-text">This creates one occupied remote property you own without evicting its tenant, transfers only building-bound fixtures with legal ownership, seeds a resident-authored surface request, and leaves the decision waiting for you.</p>
              <button class="button ${world.flags.stewardshipExperimentPrepared ? 'ghost' : 'primary'}" data-action="prepare-stewardship-experiment" ${world.flags.stewardshipExperimentPrepared ? 'disabled' : ''}>
                <strong>${world.flags.stewardshipExperimentPrepared ? 'Stewardship test already prepared' : 'Prepare one remote-tenant request'}</strong>
                <span>No AI service, no hidden displacement, and no fabricated consent.</span>
              </button>
            </div></section>

            <section class="card"><div class="card-inner">
              <h3 class="card-title">Your occupied properties <small>Ownership is not interior puppeteering</small></h3>
              ${ownedOccupied.length ? `<div class="stack">${ownedOccupied.map((property) => {
                const requests = (property.stewardship?.requestIds || []).map((id) => Stewardship.requestById(world, id)).filter(Boolean);
                return `<article class="subtle-card">
                  <div class="proposal-head"><div><h4>${escapeHtml(property.name)}</h4><p>${property.tenants.length} resident${property.tenants.length === 1 ? '' : 's'} · ${escapeHtml(property.stewardship.policy.name)}</p></div><span class="pill info">Reserve ${Core.formatMoney(property.maintenanceReserve)}</span></div>
                  <div class="kv-list">
                    <div class="kv-row"><span>Recorded requests</span><strong>${requests.length}</strong></div>
                    <div class="kv-row"><span>Completed resident changes</span><strong>${property.stewardship.completedIntentionIds.length}</strong></div>
                    <div class="kv-row"><span>Interior authority</span><strong>Residents retain authorship</strong></div>
                  </div>
                  <button class="button small" data-action="view-property" data-id="${property.id}">Inspect rooms and property history</button>
                </article>`;
              }).join('')}</div>` : '<div class="empty-state">You do not currently own an occupied property. This branch remains optional rather than an inevitable landlord endgame.</div>'}
            </div></section>

            <section class="card"><div class="card-inner">
              <h3 class="card-title">Evidence totals <small>Auditable rather than magical</small></h3>
              <div class="kv-list">
                <div class="kv-row"><span>Resident savings</span><strong>${Core.formatMoney(metrics.residentSavings)}</strong></div>
                <div class="kv-row"><span>Owner reserve contributions</span><strong>${Core.formatMoney(metrics.ownerContributions)}</strong></div>
                <div class="kv-row"><span>Construction phases</span><strong>${metrics.phasesCompleted}</strong></div>
                <div class="kv-row"><span>Declined intentions</span><strong>${metrics.declinedIntentions}</strong></div>
              </div>
            </div></section>
          </aside>
        </div>
      `;
    },

    renderStewardshipRequestCard(world, request) {
      const intention = Stewardship.intentionById(world, request.intentionId);
      const resident = World.getPerson(world, request.residentId);
      const property = World.getProperty(world, request.propertyId);
      if (!intention || !resident || !property) return '<article class="proposal-card status-failed"><div class="callout danger">Linked stewardship state is missing.</div></article>';
      const budget = intention.funding.budget;
      const contributed = intention.funding.contributionTotals.resident + intention.funding.contributionTotals.propertyReserve;
      const progress = budget.totalMoney > 0 ? Core.clamp(contributed / budget.totalMoney * 100, 0, 100) : 100;
      const coTenants = request.authorities.coTenants || [];
      const canOwnerShare = property.ownerId === 'player' && property.maintenanceReserve > 0;
      return `<article class="proposal-card status-${escapeAttr(request.status)}">
        <div class="proposal-head">
          <div><span class="proposal-type">Resident habitat request</span><h4>${escapeHtml(intention.summary)}</h4><p>${escapeHtml(resident.name)} · ${escapeHtml(property.name)} · submitted day ${request.createdDay}</p></div>
          <span class="pill warn">Your decision</span>
        </div>
        <div class="proposal-terms">
          <span><strong>Resident saved</strong>${Core.formatMoney(intention.funding.contributionTotals.resident)}</span>
          <span><strong>Total project budget</strong>${Core.formatMoney(budget.totalMoney)}</span>
          <span><strong>Suggested property share</strong>${Core.formatMoney(request.proposedOwnerContribution)}</span>
          <span><strong>Property reserve</strong>${Core.formatMoney(property.maintenanceReserve)}</span>
        </div>
        <div class="meter" title="${Core.round(progress, 1)}% funded"><span style="--value:${progress}%"></span></div>
        <div class="causes">Why they chose it: ${intention.reasons.map((reason) => escapeHtml(reason)).join(' · ')}</div>
        ${coTenants.length ? `<div class="pill-row">${coTenants.map((entry) => `<span class="pill ${entry.status === 'approved' ? 'good' : 'bad'}">${escapeHtml(World.personName(world, entry.personId))}: ${escapeHtml(entry.status)}</span>`).join('')}</div>` : '<div class="pill-row"><span class="pill">No additional co-tenant authority required</span></div>'}
        <div class="callout">Approving the exact request does not spend all money, buy materials, or alter the room instantly. The resident must continue funding and complete every validated phase.</div>
        <div class="property-actions">
          <button class="button small primary" data-action="respond-stewardship" data-id="${request.id}" data-response="approve_tenant_funded">Approve exact change · resident funds it</button>
          ${canOwnerShare ? `<button class="button small secondary" data-action="respond-stewardship" data-id="${request.id}" data-response="approve_owner_share">Approve + contribute up to ${Core.formatMoney(Math.min(request.proposedOwnerContribution, property.maintenanceReserve))}</button>` : ''}
          <button class="button small" data-action="respond-stewardship" data-id="${request.id}" data-response="decline">Decline exact change · no hidden penalty</button>
          <button class="button small ghost" data-action="view-property" data-id="${property.id}">Inspect property</button>
          <button class="button small ghost" data-action="select-person" data-id="${resident.id}">Open resident</button>
        </div>
        ${request.history.length ? `<details class="proposal-history"><summary>${request.history.length} permission evidence event${request.history.length === 1 ? '' : 's'}</summary><div class="history-list">${request.history.slice(-8).reverse().map((entry) => this.renderHistoryEntry(entry)).join('')}</div></details>` : ''}
      </article>`;
    },

    renderHabitatIntentionCard(world, intention, compact = false) {
      const resident = World.getPerson(world, intention.residentId);
      const property = World.getProperty(world, intention.propertyId);
      const request = Stewardship.intentionRequest(world, intention);
      const project = Stewardship.intentionProject(world, intention);
      const budget = intention.funding?.budget || { totalMoney: 0, materialMoney: 0, hours: 0 };
      const contributed = Core.safeNumber(intention.funding?.contributionTotals?.resident, 0) + Core.safeNumber(intention.funding?.contributionTotals?.propertyReserve, 0);
      const progress = budget.totalMoney > 0 ? Core.clamp(contributed / budget.totalMoney * 100, 0, 100) : 0;
      const statusTone = intention.status === 'completed' ? 'good'
        : ['declined', 'failed'].includes(intention.status) ? 'bad'
          : intention.status === 'withdrawn' ? 'warn'
            : intention.status === 'working' ? 'info' : '';
      const currentPhase = project && ['planned', 'active'].includes(project.status) ? project.phases[project.phaseIndex] : null;
      return `<article class="proposal-card status-${escapeAttr(intention.status)}">
        <div class="proposal-head">
          <div><span class="proposal-type">${escapeHtml(Core.titleCase(intention.kind))} intention</span><h4>${escapeHtml(intention.summary)}</h4><p>${escapeHtml(resident?.name || intention.residentId)} · ${escapeHtml(property?.name || intention.propertyId)} · formed day ${intention.createdDay}</p></div>
          <span class="pill ${statusTone}">${escapeHtml(Core.titleCase(intention.status))}</span>
        </div>
        <div class="proposal-terms">
          <span><strong>Resident contribution</strong>${Core.formatMoney(intention.funding.contributionTotals.resident)}</span>
          <span><strong>Property contribution</strong>${Core.formatMoney(intention.funding.contributionTotals.propertyReserve)}</span>
          <span><strong>Budget</strong>${Core.formatMoney(budget.totalMoney)}</span>
          <span><strong>Escrow remaining</strong>${Core.formatMoney(intention.funding.escrow.money)}</span>
        </div>
        ${!compact && !Stewardship.TERMINAL_INTENTION.has(intention.status) ? `<div class="meter" title="${Core.round(progress, 1)}% funded"><span style="--value:${progress}%"></span></div>` : ''}
        ${currentPhase ? `<div class="callout">Current work: ${escapeHtml(currentPhase.name)} · phase ${project.phaseIndex + 1}/${project.phases.length}. The resident—not the player—performs this work from recorded escrow.</div>` : ''}
        ${request ? `<div class="pill-row"><span class="pill ${request.status === 'approved' || request.status === 'completed' ? 'good' : request.status === 'declined' ? 'bad' : 'info'}">Permission: ${escapeHtml(Core.titleCase(request.status))}</span>${request.authorities.externalOwner?.score != null ? `<span class="pill">Owner score ${Core.round(request.authorities.externalOwner.score, 1)} / threshold ${request.authorities.externalOwner.evidence?.approvalThreshold ?? '?'}</span>` : ''}</div>` : ''}
        ${intention.failureReason ? `<div class="callout ${intention.status === 'failed' || intention.status === 'declined' ? 'danger' : 'warning'}">${escapeHtml(intention.failureReason)}</div>` : ''}
        <div class="property-actions">
          ${property ? `<button class="button small ghost" data-action="view-property" data-id="${property.id}">Inspect changed home</button>` : ''}
          ${resident ? `<button class="button small ghost" data-action="select-person" data-id="${resident.id}">Open resident</button>` : ''}
          ${project ? `<span class="pill">${project.completedPhaseIds.length}/${project.phases.length} phases</span>` : ''}
          ${intention.completedDay ? `<span class="pill">Outcome day ${intention.completedDay}</span>` : ''}
        </div>
        ${intention.history?.length ? `<details class="proposal-history"><summary>${intention.history.length} intention evidence event${intention.history.length === 1 ? '' : 's'}</summary><div class="history-list">${intention.history.slice(-10).reverse().map((entry) => this.renderHistoryEntry(entry)).join('')}</div></details>` : ''}
      </article>`;
    },

    renderWork(world) {
      const job = Content.jobById(world.player.jobId);
      const coworkers = world.people.filter((person) => person.jobId === job.id);
      return `
        <div class="view-title-row">
          <div>
            <h2>Work can be entered or compressed</h2>
            <p>Skipping a shift pays the normal wage and remains valid. Entering creates hour-by-hour influence, skill growth, coworker relationships, and small process experiments—not a punishment for players who prefer fast-forward.</p>
          </div>
          <div class="pill-row"><span class="pill info">${escapeHtml(job.name)}</span><span class="pill good">${Core.formatMoney(job.wage)}/hour</span><span class="pill">${job.hours}h shift</span></div>
        </div>
        <div class="split">
          <div class="stack">
            ${world.activeShift ? this.renderActiveShift(world) : this.renderWorkChoice(world, job)}
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Job market <small>Access comes from trained skills, not a fixed personality build</small></h3>
              <div class="grid-3">${Content.JOBS.map((entry) => this.renderJobCard(world, entry)).join('')}</div>
            </div></section>
          </div>
          <aside class="stack">
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Current job</h3>
              <p class="muted small-text">${escapeHtml(job.summary)}</p>
              <div class="kv-list">
                <div class="kv-row"><span>Shift</span><strong>${String(job.shiftStart).padStart(2, '0')}:00–${String(job.shiftStart + job.hours).padStart(2, '0')}:00</strong></div>
                <div class="kv-row"><span>Primary skill</span><strong>${Core.titleCase(job.primarySkill)} ${Core.round(world.player.skills[job.primarySkill], 1)}</strong></div>
                <div class="kv-row"><span>Experience</span><strong>${Math.round(world.player.jobExperience)}</strong></div>
                <div class="kv-row"><span>Coworkers</span><strong>${coworkers.length}</strong></div>
              </div>
              <div class="pill-row">${coworkers.slice(0, 8).map((person) => `<button class="button small" data-action="select-person" data-id="${person.id}">${escapeHtml(person.name)}</button>`).join('')}</div>
            </div></section>
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Fairness rule</h3>
              <div class="callout">Interactive work may give richer influence and modest variation. It is intentionally not tuned to make fast-forward economically wrong.</div>
            </div></section>
          </aside>
        </div>
      `;
    },

    renderWorkChoice(world, job) {
      return `
        <section class="card"><div class="card-inner">
          <h3 class="card-title">Next shift at ${escapeHtml(job.name)}</h3>
          <div class="grid-2">
            <button class="button primary" data-action="start-shift"><strong>Enter the workday</strong><span>Choose one grounded action for each of ${job.hours} hours.</span></button>
            <button class="button secondary" data-action="skip-shift"><strong>Fast-forward the shift</strong><span>Earn the standard ${Core.formatMoney(job.wage * job.hours)} without being penalized for time compression.</span></button>
          </div>
          <div class="divider"></div>
          <div class="grid-4">
            ${job.actions.map((task) => `<div class="activity-card"><h4>${escapeHtml(task.name)}</h4><p>${escapeHtml(task.note)}</p></div>`).join('')}
          </div>
        </div></section>`;
    },

    renderActiveShift(world) {
      const shift = world.activeShift;
      const job = Content.jobById(shift.jobId);
      return `
        <section class="shift-panel">
          <div class="shift-meter"><div><h3 style="margin:0">Active workday · ${escapeHtml(job.name)}</h3><p class="muted small-text" style="margin:4px 0 0">Choose what this hour means.</p></div><div class="shift-hours">${shift.remainingHours}h</div></div>
          <div class="grid-2">
            ${job.actions.map((task) => `<button class="button" data-action="work-task" data-id="${task.id}"><strong>${escapeHtml(task.name)}</strong><span>${escapeHtml(task.note)}</span></button>`).join('')}
          </div>
          <div class="pill-row" style="margin-top:10px"><span class="pill">Performance ${Math.round(shift.performance)}</span><span class="pill">Process experiments ${shift.innovation}</span>${Object.entries(shift.taskCounts).map(([id, count]) => `<span class="pill">${escapeHtml(job.actions.find((task) => task.id === id)?.name || id)} ×${count}</span>`).join('')}</div>
        </section>`;
    },

    renderJobCard(world, job) {
      const skill = world.player.skills[job.primarySkill] || 0;
      const qualified = skill >= job.requirement;
      const current = world.player.jobId === job.id;
      return `
        <article class="job-card ${current ? 'selected' : ''}">
          <div class="job-head"><div><h4>${escapeHtml(job.name)}</h4><p>${escapeHtml(job.summary)}</p></div><span class="pill ${qualified ? 'good' : 'warn'}">${Core.formatMoney(job.wage)}/h</span></div>
          <div class="pill-row" style="margin-top:8px"><span class="pill">${Core.titleCase(job.primarySkill)} ${job.requirement}</span><span class="pill">${job.hours}h</span></div>
          <div class="job-actions">${current ? '<span class="pill good">Current job</span>' : `<button class="button small ${qualified ? 'primary' : ''}" data-action="apply-job" data-id="${job.id}" ${qualified ? '' : 'disabled'}>${qualified ? 'Take job' : `Need ${Core.round(job.requirement - skill, 1)} more ${job.primarySkill}`}</button>`}</div>
        </article>`;
    },

    renderHousing(world) {
      const properties = world.places.filter((place) => place.kind === 'residential').slice().sort((a, b) => {
        const vacancyA = a.capacity - a.tenants.length;
        const vacancyB = b.capacity - b.tenants.length;
        return vacancyB - vacancyA || a.currentRent - b.currentRent;
      });
      const owned = properties.filter((property) => property.ownerId === 'player');
      return `
        <div class="view-title-row">
          <div>
            <h2>A real, changing housing market</h2>
            <p>Some homes are occupied and unavailable. NPCs compare rent, commute, condition, space, relationships, and preferences before moving. Late-game ownership preserves existing tenants and lets their autonomous décor continue.</p>
          </div>
          <div class="pill-row"><span class="pill warn">${properties.filter((property) => property.tenants.length < property.capacity).length} properties with space</span><span class="pill good">${owned.length} owned</span></div>
        </div>
        <div class="stack">
          ${owned.length ? `<section class="card"><div class="card-inner"><h3 class="card-title">Owned properties <small>Bounded rent controls for the foundation</small></h3><div class="grid-3">${owned.map((property) => this.renderOwnedProperty(world, property)).join('')}</div></div></section>` : ''}
          <section class="card"><div class="card-inner">
            <h3 class="card-title">All residential places <small>Occupied homes remain visible rather than disappearing from the map</small></h3>
            <div class="grid-3">${properties.map((property) => this.renderPropertyCard(world, property)).join('')}</div>
          </div></section>
        </div>
      `;
    },

    renderPropertyCard(world, property) {
      const vacancies = property.capacity - property.tenants.length;
      const isHome = world.player.homePropertyId === property.id;
      const residents = property.tenants.map((id) => World.personName(world, id));
      const household = Households.playerHousehold(world);
      const cohabiting = Households.isCohabiting(world, household);
      const agreementPartnerId = household ? Households.partnerIdFor(household) : null;
      const jointEligible = household && Households.eligibleJointMoveProperties(world, household).some((entry) => entry.id === property.id)
        && (!cohabiting || household.homePropertyId !== property.id);
      return `
        <article class="property-card ${isHome ? 'selected' : ''}">
          <div class="property-head"><div><h4>${escapeHtml(property.name)}</h4><p>${Core.titleCase(property.type)} · ${escapeHtml(Content.STYLES.find((style) => style.id === property.style)?.name || property.style)}</p></div><span class="pill ${vacancies > 0 ? 'warn' : ''}">${vacancies > 0 ? `${vacancies} open` : 'occupied'}</span></div>
          <div class="kv-list">
            <div class="kv-row"><span>Rent</span><strong>${Core.formatMoney(property.currentRent)}</strong></div>
            <div class="kv-row"><span>Condition</span><strong>${Math.round(property.condition)}</strong></div>
            <div class="kv-row"><span>Residents</span><strong>${property.tenants.length}/${property.capacity}</strong></div>
            <div class="kv-row"><span>Owner</span><strong>${escapeHtml(property.ownerLabel)}</strong></div>
          </div>
          <p>${residents.length ? escapeHtml(residents.join(', ')) : 'No current residents.'}</p>
          <div class="property-actions">
            <button class="button small" data-action="select-place" data-id="${property.id}">Inspect</button><button class="button small" data-action="view-property" data-id="${property.id}">Interior</button>
            ${jointEligible ? `<button class="button small primary" data-action="propose-home-property" data-id="${property.id}" data-partner="${agreementPartnerId}">${cohabiting ? 'Propose joint move' : 'Propose shared home'}</button>` : ''}
            ${!isHome && vacancies > 0 && !cohabiting ? `<button class="button small ${household ? '' : 'primary'}" data-action="rent-property" data-id="${property.id}">Rent yourself · ${Core.formatMoney(property.currentRent)}</button>` : ''}
            ${property.listedForSale && property.ownerId !== 'player' ? `<button class="button small secondary" data-action="buy-property" data-id="${property.id}">Buy · ${Core.formatMoney(property.purchasePrice)}</button>` : ''}
          </div>
        </article>`;
    },

    renderOwnedProperty(world, property) {
      const vacancies = property.capacity - property.tenants.length;
      const household = Households.playerHousehold(world);
      const cohabiting = Households.isCohabiting(world, household);
      const partnerId = household ? Households.partnerIdFor(household) : null;
      const jointEligible = household && Households.eligibleJointMoveProperties(world, household).some((entry) => entry.id === property.id)
        && (!cohabiting || household.homePropertyId !== property.id);
      return `
        <article class="property-card selected">
          <h4>${escapeHtml(property.name)}</h4><p>${property.tenants.length} residents · ${vacancies} open places · ${Core.formatMoney(property.maintenanceReserve)} maintenance reserve</p>
          <label class="small-text muted" for="rent-${property.id}">Monthly rent: ${Core.formatMoney(property.currentRent)} · allowed ${Core.formatMoney(property.rent * 0.7)}–${Core.formatMoney(property.rent * 1.3)}</label>
          <input id="rent-${property.id}" class="range-input" type="range" min="${Math.round(property.rent * 0.7)}" max="${Math.round(property.rent * 1.3)}" value="${property.currentRent}" data-action="set-rent" data-id="${property.id}">
          <div class="property-actions"><button class="button small" data-action="select-place" data-id="${property.id}">Inspect history</button>${jointEligible ? `<button class="button small primary" data-action="propose-home-property" data-id="${property.id}" data-partner="${partnerId}">${cohabiting ? 'Propose joint move' : 'Propose shared home'}</button>` : ''}${vacancies > 0 && world.player.homePropertyId !== property.id && !cohabiting ? `<button class="button small" data-action="move-owned" data-id="${property.id}">Move here yourself</button>` : ''}</div>
        </article>`;
    },

    renderLedger(world) {
      const types = ['all'].concat(Array.from(new Set(world.ledger.map((entry) => entry.type))).sort());
      const filter = world.ui.ledgerFilter || 'all';
      const entries = world.ledger.filter((entry) => filter === 'all' || entry.type === filter).slice(-180).reverse();
      return `
        <div class="view-title-row">
          <div>
            <h2>Append-only world ledger</h2>
            <p>Important changes record time, actors, location, causes, and evidence where available. The goal is not omniscience; it is enough traceability to diagnose why the living simulation changed.</p>
          </div>
          <div class="form-row"><button class="button primary" data-action="export-ledger">Export TXT ledger</button><button class="button" data-action="export-world">Export full JSON state</button></div>
        </div>
        <section class="card"><div class="card-inner">
          <div class="pill-row" style="margin-bottom:12px">${types.map((type) => `<button class="button small ${filter === type ? 'primary' : ''}" data-action="ledger-filter" data-id="${type}">${Core.titleCase(type)} · ${type === 'all' ? world.ledger.length : world.ledger.filter((entry) => entry.type === type).length}</button>`).join('')}</div>
          <div class="ledger-list">${entries.length ? entries.map((entry) => this.renderLedgerEntry(entry)).join('') : '<div class="empty-state">No entries match this filter.</div>'}</div>
        </div></section>
      `;
    },

    renderLedgerEntry(entry) {
      const evidence = entry.evidence ? summarizeEvidence(entry.evidence) : '';
      return `<article class="ledger-entry" data-type="${escapeAttr(entry.type)}"><div class="meta">Day ${entry.day}, ${String(entry.hour).padStart(2, '0')}:00 · ${escapeHtml(Core.titleCase(entry.type))}</div><div class="message">${escapeHtml(entry.message)}</div>${entry.causes?.length ? `<div class="causes">Causes: ${escapeHtml(entry.causes.join(' · '))}</div>` : ''}${evidence ? `<div class="causes">Evidence: ${escapeHtml(evidence)}</div>` : ''}</article>`;
    },

    renderHistoryEntry(entry) {
      return `<div class="history-entry"><div class="meta">Day ${entry.day}, ${String(entry.hour).padStart(2, '0')}:00 · ${escapeHtml(Core.titleCase(entry.type))}</div><div class="message">${escapeHtml(entry.message)}</div>${entry.causes?.length ? `<div class="causes">${escapeHtml(entry.causes.join(' · '))}</div>` : ''}</div>`;
    },

    renderLab(world) {
      const metrics = Systems.computeMetrics(world);
      const validation = Systems.validateWorld(world);
      const report = world.ui.lastObserverReport || null;
      return `
        <div class="view-title-row">
          <div>
            <h2>Deterministic observer and intake lab</h2>
            <p>Run the town forward, inspect diversity and churn, validate invariants, export readable state, or create the same starting city again from its seed. Observer runs freeze player needs and rent so testing does not become a hidden gameplay punishment.</p>
          </div>
          <div class="pill-row"><span class="pill ${validation.ok ? 'good' : 'bad'}">${validation.ok ? 'All invariants pass' : `${validation.errors.length} invariant errors`}</span><span class="pill">Schema ${escapeHtml(world.schema)}</span></div>
        </div>
        <div class="split">
          <div class="stack">
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Current world metrics <small>Day ${metrics.day}</small></h3>
              <div class="grid-4">
                ${this.metricCard('Population', metrics.population, 'One controlled player; all others autonomous')}
                ${this.metricCard('Occupied homes', `${metrics.occupiedProperties}/${metrics.residentialProperties}`, `${metrics.fullyVacantProperties} fully vacant`)}
                ${this.metricCard('Décor signatures', metrics.decorSignatureCount, `${metrics.colorVariety} colors · ${metrics.furnitureTypeVariety} object types`)}
                ${this.metricCard('Moves', metrics.moves, 'Explainable relocation events')}
                ${this.metricCard('Furniture objects', metrics.furnitureObjects, `${metrics.objectUpgradeLevels} total upgrade levels`)}
                ${this.metricCard('NPC décor actions', metrics.npcDecorActions, `${metrics.npcUpgradeActions} upgrades without replacement`)}
                ${this.metricCard('Social events', metrics.autonomousSocialEvents, `${metrics.playerFriends} player friendships`)}
                ${this.metricCard('NPC wealth spread', Core.formatMoney(metrics.npcWealthSpread), `Average ${Core.formatMoney(metrics.npcWealthAverage)}`)}
                ${this.metricCard('Active agreements', metrics.activeHouseholds, `Current revision ${metrics.householdAgreementRevision}`)}
                ${this.metricCard('Waiting proposals', metrics.pendingHouseholdProposals, 'NPC and player requests stay explicit')}
                ${this.metricCard('Open household issues', metrics.openHouseholdIssues, 'Conflict remains visible until repaired')}
                ${this.metricCard('Shared reserve', Core.formatMoney(metrics.sharedReserve), 'Separate from personal accounts')}
                ${this.metricCard('Ended agreements', metrics.householdSeparations, 'Exit never requires partner permission')}
                ${this.metricCard('Active family units', metrics.familyActiveUnits, `${metrics.familyActiveDependents} autonomous dependents`)}
                ${this.metricCard('Recent care coverage', `${metrics.familyCareCoverage}%`, 'Player, partner, and community hours remain attributable')}
                ${this.metricCard('Life-stage transitions', metrics.familyLifeStageTransitions, 'Aging preserves person, object, and relationship identity')}
                ${this.metricCard('Community possibilities', metrics.communityOpenOpportunities, `${metrics.communityAwaitingPlayer} awaiting your answer; expiry has no penalty`)}
                ${this.metricCard('Community connections', metrics.communityPlayerConnections, `${metrics.communityMentorLinks} bounded mentor links`)}
                ${this.metricCard('Personal adventures', metrics.communityActiveAdventures, `${metrics.communityCompletedAdventures} completed; no deadlines or streaks`)}
              </div>
            </div></section>
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Advance and observe</h3>
              <div class="button-grid">
                <button class="button" data-action="step-hours" data-hours="1"><strong>Step 1 hour</strong><span>Normal player and world time.</span></button>
                <button class="button" data-action="step-hours" data-hours="6"><strong>Step 6 hours</strong><span>Normal player and world time.</span></button>
                <button class="button" data-action="step-hours" data-hours="24"><strong>Step 1 day</strong><span>Includes rent, jobs, housing, and autonomy.</span></button>
                <button class="button secondary" data-action="observer-days" data-days="7"><strong>Observe 7 days</strong><span>Freeze player consequences; evolve residents.</span></button>
                <button class="button secondary" data-action="observer-days" data-days="30"><strong>Observe 30 days</strong><span>Look for housing churn and décor divergence.</span></button>
                <button class="button secondary" data-action="observer-days" data-days="100"><strong>Observe 100 days</strong><span>Stress the deterministic living foundation.</span></button>
              </div>
              ${report ? this.renderObserverReport(report) : ''}
            </div></section>
            <section class="card"><div class="card-inner">
              <h3 class="card-title">Invariant report</h3>
              ${validation.ok ? '<div class="callout">No resident appears in two homes, no property exceeds capacity, furniture does not overlap, all home pointers agree, adults have valid work state, dependents have no adult job or rent debt, household and family pointers agree, private rooms are enforced, and shared reserves remain non-negative, community visits invent no authority, opportunity expiry creates no penalty, and each person has at most one active no-deadline adventure.</div>' : `<div class="callout danger">${validation.errors.map(escapeHtml).join('<br>')}</div>`}
            </div></section>
          </div>
          <aside class="stack">
            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Local save and export</h3>
              <button class="button primary" data-action="export-world"><strong>Export world JSON</strong><span>Human-readable, portable, no cloud dependency.</span></button>
              <button class="button" data-action="export-ledger"><strong>Export world ledger TXT</strong><span>Time, changes, causes, and evidence.</span></button>
              <button class="button" data-action="trigger-import"><strong>Import world JSON</strong><span>Validates schema and invariants before accepting.</span></button>
              <input id="worldImport" type="file" accept="application/json,.json" hidden>
              <label class="form-row"><input id="autosaveToggle" type="checkbox" ${world.settings.autosave ? 'checked' : ''}> <span class="small-text">Use local browser autosave</span></label>
              <button class="button danger" data-action="clear-autosave">Clear stored autosave<span>The open in-memory world remains.</span></button>
            </div></section>
            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Identity and deterministic restart</h3>
              <div class="form-row"><input id="playerNameInput" class="text-input" value="${escapeAttr(world.player.name)}" maxlength="30"><button class="button" data-action="rename-player">Rename player</button></div>
              <div class="form-row"><input id="seedInput" class="text-input" value="${escapeAttr(world.seed)}"><button class="button secondary" data-action="new-world">Create world from seed</button></div>
              <div class="callout">The same seed recreates the same initial residents, jobs, homes, furniture, traits, and vacancies. Later choices then branch the state.</div>
            </div></section>
            <section class="card"><div class="card-inner stack">
              <h3 class="card-title">Prototype-only test access</h3>
              <p class="muted small-text">Ownership prices are intentionally late-game. This explicit grant exists only so the property and max-upgrade systems can be tested before full progression is built.</p>
              <button class="button secondary" data-action="developer-grant" ${world.flags.developerGrantUsed ? 'disabled' : ''}>${world.flags.developerGrantUsed ? 'Prototype grant already used' : 'Add labeled €260,000 test grant'}</button>
              <button class="button secondary" data-action="prepare-household-experiment" ${world.flags.householdExperimentPrepared || Households.playerHousehold(world) ? 'disabled' : ''}>${world.flags.householdExperimentPrepared ? 'Household experiment already prepared' : Households.playerHousehold(world) ? 'Active agreement already exists' : 'Prepare labeled household test state'}</button>
              <button class="button secondary" data-action="prepare-family-experiment" data-variant="young_child" ${world.flags.familyExperimentPrepared ? 'disabled' : ''}>${world.flags.familyExperimentPrepared ? 'Family experiment already prepared' : 'Prepare labeled family-continuity test'}</button>
              <button class="button secondary" data-action="prepare-community-experiment" ${world.flags.communityExperimentPrepared ? 'disabled' : ''}>${world.flags.communityExperimentPrepared ? 'Community experiment already prepared' : 'Prepare labeled community-freedom test'}</button>
              <button class="button secondary" data-action="prepare-directions-experiment" ${world.flags.personalDirectionsExperimentPrepared ? 'disabled' : ''}>${world.flags.personalDirectionsExperimentPrepared ? 'Directions experiment already prepared' : 'Prepare labeled personal-direction test'}</button>
              <button class="button secondary" data-action="prepare-enterprise-experiment" ${world.flags.enterpriseExperimentPrepared ? 'disabled' : ''}>${world.flags.enterpriseExperimentPrepared ? 'Economy experiment already prepared' : 'Prepare labeled local-economy test'}</button>
              <button class="button secondary" data-action="prepare-walkable-experiment" ${world.flags.walkableExperimentPrepared ? 'disabled' : ''}>${world.flags.walkableExperimentPrepared ? 'Walkable-place experiment already prepared' : 'Prepare labeled walkable-place test'}</button>
              <button class="button secondary" data-action="prepare-shell-experiment" ${world.flags.shellExperimentPrepared ? 'disabled' : ''}>${world.flags.shellExperimentPrepared ? 'Building-shell experiment already prepared' : 'Prepare labeled resident-frontage test'}</button>
              <button class="button secondary" data-action="prepare-presence-experiment" ${world.flags.presenceExperimentPrepared ? 'disabled' : ''}>${world.flags.presenceExperimentPrepared ? 'Lived-building experiment already prepared' : 'Prepare labeled lived-building presence test'}</button>
            </div></section>
          </aside>
        </div>
      `;
    },

    renderObserverReport(report) {
      const keys = [
        ['moves', 'Moves'],
        ['npcDecorActions', 'NPC décor'],
        ['npcUpgradeActions', 'NPC upgrades'],
        ['autonomousSocialEvents', 'Social events'],
        ['fullyVacantProperties', 'Fully vacant homes']
      ];
      const changedNames = (report.changedProperties || []).map((entry) => entry.name).join(', ');
      const changedCard = this.metricCard(
        'Homes visibly changed',
        report.changedPropertyCount ?? 0,
        changedNames || 'No visual-state changes detected'
      );
      return `<div class="subtle-card" style="margin-top:12px"><h4 class="card-title">Last observer delta <small>${report.validation.ok ? 'valid' : 'errors found'}</small></h4><div class="grid-3">${changedCard}${keys.map(([key, label]) => this.metricCard(label, signedDelta(report.after[key] - report.before[key]), `${report.before[key]} → ${report.after[key]}`)).join('')}</div></div>`;
    },

    metricCard(label, value, note) {
      return `<div class="stat-card"><span class="stat-label">${escapeHtml(String(label))}</span><span class="stat-value">${escapeHtml(String(value))}</span><div class="stat-note">${escapeHtml(String(note))}</div></div>`;
    },

    renderStatMeter(label, value, max) {
      const pct = Core.clamp(value / max * 100, 0, 100);
      return `<div class="stat-card"><span class="stat-label">${escapeHtml(label)}</span><span class="stat-value">${Core.round(value, 1)}</span><div class="meter"><span style="--value:${pct}%"></span></div></div>`;
    },

    renderToast(world) {
      const toast = world.ui.toast;
      if (!toast) return '';
      return `<div class="toast ${escapeAttr(toast.tone || 'info')}" role="status">${escapeHtml(toast.message)}<button class="icon-button toast-close" data-action="toast-close" aria-label="Close notification">×</button></div>`;
    },

    scheduleToast(world) {
      clearTimeout(this.toastTimer);
      if (!world.ui.toast) return;
      const nonce = world.ui.toast.nonce;
      this.toastTimer = setTimeout(() => {
        if (Game.world.ui.toast?.nonce === nonce) Game.clearToast();
      }, 4200);
    },

    bindEvents() {
      this.app.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action]');
        if (!button || button.disabled) return;
        const action = button.dataset.action;
        const id = button.dataset.id;
        switch (action) {
          case 'tab': this.activateTab(id); break;
          case 'tab-relative': {
            const key = Number(button.dataset.direction) < 0 ? 'ArrowLeft' : 'ArrowRight';
            this.activateTab(this.navigationTarget(Game.world.ui.activeTab, key));
            break;
          }
          case 'speed': Game.setSpeed(Number(button.dataset.value)); break;
          case 'select-place': Game.selectPlace(id); Game.setTab('town'); break;
          case 'open-street': Game.setTab('street'); break;
          case 'open-presence': Game.setTab('presence'); break;
          case 'open-visuals': Game.setTab('visuals'); break;
          case 'visual-scene':
            Game.mutate((world) => {
              Visuals.ensureUiState(world);
              if (Visuals.MODES.includes(id)) world.ui.visualSceneMode = id;
            }, 'visual-scene');
            break;
          case 'visual-motion':
            Game.mutate((world) => {
              Visuals.ensureUiState(world);
              if (!Visuals.MOTION_LEVELS.includes(id)) return;
              world.settings.visualMotion = id;
              world.settings.reducedMotion = id === 'still';
            }, 'visual-motion');
            break;
          case 'visual-room':
            Game.mutate((world) => {
              Visuals.ensureUiState(world);
              const room = Visuals.roomChoices(world).find((entry) => entry.id === id);
              if (!room) return;
              world.ui.visualSceneMode = 'room';
              world.ui.selectedVisualRoomId = room.id;
              world.ui.selectedVisualObjectId = null;
            }, 'visual-room');
            break;
          case 'visual-object':
            Game.mutate((world) => {
              Visuals.ensureUiState(world);
              world.ui.selectedVisualObjectId = world.ui.selectedVisualObjectId === id ? null : (id || null);
            }, 'visual-object');
            break;
          case 'visual-open-object': {
            const home = World.homeOf(Game.world, 'player');
            if (!home || !home.furniture.some((object) => object.id === id)) break;
            Game.viewProperty(home.id);
            Game.world.ui.selectedObjectId = id;
            Game.world.ui.selectedRoomId = button.dataset.room || Game.world.ui.selectedRoomId;
            Game.emit('visual-open-object');
            break;
          }
          case 'visual-activity':
            Visuals.ensureUiState(Game.world);
            Game.world.ui.visualSceneMode = 'room';
            Game.world.ui.selectedVisualRoomId = button.dataset.room || null;
            Game.world.ui.selectedVisualObjectId = button.dataset.object || null;
            Game.world.ui.pendingVisualActivity = {
              actionId: id,
              roomId: button.dataset.room || null,
              objectId: button.dataset.object || null
            };
            Game.invoke('performActivity', id);
            break;
          case 'visual-clear-moment':
            Game.mutate((world) => { world.ui.lastVisualActivityReceipt = null; }, 'visual-clear-moment');
            break;
          case 'start-indoor-arrival': Game.invoke('startIndoorArrival', id, button.dataset.mode || 'visible'); break;
          case 'start-indoor-departure': Game.invoke('startIndoorDeparture', button.dataset.mode || 'visible'); break;
          case 'move-presence-room': Game.invoke('startRoomTransition', id, button.dataset.mode || 'compressed'); break;
          case 'step-indoor-movement': Game.invoke('stepIndoorMovement'); break;
          case 'finish-indoor-movement': Game.invoke('finishIndoorMovementCompressed'); break;
          case 'respond-presence-encounter': Game.invoke('respondToOrdinaryEncounter', id, button.dataset.response); break;
          case 'prepare-presence-experiment': { const result = Game.invoke('prepareLivedBuildingExperiment'); if (result?.ok) { Game.world.ui.selectedPresenceBuildingId = result.buildingId; Game.world.ui.selectedPresencePlaceId = result.propertyId; Game.setTab('presence'); } break; }
          case 'open-building': Game.world.ui.selectedBuildingId = id; Game.setTab('buildings'); break;
          case 'select-building': Game.world.ui.selectedBuildingId = id; Game.afterMutation('select-building'); break;
          case 'propose-frontage': Game.invoke('proposePlayerFrontageChange', document.getElementById('shellPlaceSelect')?.value, document.getElementById('shellChangeType')?.value); break;
          case 'respond-frontage': Game.invoke('respondToFrontageProposal', id, button.dataset.response); break;
          case 'advance-frontage-project': Game.invoke('advanceFrontageProject', id); break;
          case 'prepare-shell-experiment': { const result = Game.invoke('prepareBuildingShellExperiment'); if (result?.ok) { Game.world.ui.selectedBuildingId = result.buildingId; Game.setTab('buildings'); } break; }
          case 'start-visible-travel': Game.invoke('startPlayerTravel', id, 'visible'); break;
          case 'start-compressed-travel': Game.invoke('startPlayerTravel', id, 'compressed'); break;
          case 'step-player-travel': Game.invoke('stepPlayerTravel'); break;
          case 'finish-player-travel': Game.invoke('finishPlayerTravelCompressed'); break;
          case 'end-player-travel-early': Game.invoke('endPlayerTravelEarly'); break;
          case 'view-property': Game.viewProperty(id); break;
          case 'select-person': Game.selectPerson(id); Game.setTab('people'); break;
          case 'select-object': Game.selectObject(id); break;
          case 'select-room': Game.selectRoom(id); break;
          case 'quick-room-purpose': Game.invoke('setRoomPurpose', button.dataset.property, button.dataset.room, button.dataset.purpose); break;
          case 'set-room-purpose': Game.invoke('setRoomPurpose', button.dataset.property, id, document.getElementById('habitatPurpose')?.value); break;
          case 'request-surface-project': Game.invoke('requestHabitatProject', button.dataset.property, {
            type: 'surface',
            target: { roomId: button.dataset.room, surface: document.getElementById('habitatSurface')?.value, finishId: document.getElementById('habitatFinish')?.value }
          }); break;
          case 'request-partition-project': Game.invoke('requestHabitatProject', button.dataset.property, {
            type: 'partition',
            target: { edgeKey: document.getElementById('habitatEdge')?.value, kind: document.getElementById('habitatPartitionKind')?.value, materialId: document.getElementById('habitatWallMaterial')?.value }
          }); break;
          case 'request-utility-project': Game.invoke('requestHabitatProject', button.dataset.property, {
            type: 'utility',
            target: { roomId: button.dataset.room, utilityType: document.getElementById('habitatUtility')?.value }
          }); break;
          case 'request-repair-project': Game.invoke('requestHabitatProject', button.dataset.property, { type: 'repair', target: { structure: 'whole_habitat' } }); break;
          case 'work-habitat-project': Game.invoke('workHabitatProject', id); break;
          case 'cancel-habitat-project': Game.invoke('cancelHabitatProject', id); break;
          case 'activity': Game.invoke('performActivity', id); break;
          case 'set-life-course-mode': Game.invoke('setLifeCourseMode', button.dataset.mode); break;
          case 'toggle-exact-ages': Game.invoke('setShowExactAges', !Game.world.settings.showExactAges); break;
          case 'advance-life-chapter': Game.invoke('advanceLifeChapter', id || 'player'); break;
          case 'create-personal-project': {
            const templateId = document.getElementById('personalProjectTemplate')?.value;
            Game.invoke('createPersonalProject', {
              templateId,
              targetObjectId: document.getElementById('personalProjectObject')?.value || null,
              targetPlaceId: document.getElementById('personalProjectPlace')?.value || null,
              title: document.getElementById('personalProjectTitle')?.value,
              meaning: document.getElementById('personalProjectMeaning')?.value
            });
            break;
          }
          case 'work-personal-project': Game.invoke('workPersonalProject', id); break;
          case 'pause-personal-project': Game.invoke('pausePersonalProject', id); break;
          case 'resume-personal-project': Game.invoke('resumePersonalProject', id); break;
          case 'release-personal-project': Game.invoke('releasePersonalProject', id); break;
          case 'archive-personal-project': Game.invoke('archivePersonalProject', id); break;
          case 'reshape-personal-project': Game.invoke('reshapePersonalProject', id, document.getElementById(`project-title-${id}`)?.value, document.getElementById(`project-meaning-${id}`)?.value); break;
          case 'invite-project-collaborator': Game.invoke('inviteProjectCollaborator', id, document.getElementById(`project-collaborator-${id}`)?.value); break;
          case 'prepare-directions-experiment': {
            const result = Game.invoke('preparePersonalDirectionsExperiment');
            if (result?.ok) Game.setTab('directions');
            break;
          }
          case 'open-economy': Game.setTab('economy'); break;
          case 'open-enterprise':
            Game.world.ui.selectedEnterpriseId = id;
            Game.setTab('economy');
            break;
          case 'create-enterprise': {
            const path = document.getElementById('enterprisePath')?.value;
            const result = Game.invoke('createEnterprise', {
              templateId: document.getElementById('enterpriseTemplate')?.value,
              path,
              sourceProjectId: document.getElementById('enterpriseSourceProject')?.value || null,
              needId: document.getElementById('enterpriseNeed')?.value || null,
              premiseId: ['tiny_enterprise', 'cooperative'].includes(path) ? document.getElementById('enterprisePremise')?.value || null : null,
              pricingMode: document.getElementById('enterprisePricing')?.value,
              basePrice: Number(document.getElementById('enterpriseBasePrice')?.value),
              name: document.getElementById('enterpriseName')?.value,
              purpose: document.getElementById('enterprisePurpose')?.value
            });
            if (result?.ok) {
              Game.world.ui.selectedEnterpriseId = result.enterprise.id;
              Game.setTab('economy');
            }
            break;
          }
          case 'change-enterprise-path': Game.invoke('changeEnterprisePath', id, document.getElementById(`enterprise-path-${id}`)?.value, document.getElementById(`enterprise-premise-${id}`)?.value || null); break;
          case 'start-enterprise-session': {
            const result = Game.invoke('startEnterpriseSession', id, button.dataset.mode || 'compressed');
            if (result?.ok) {
              Game.world.ui.selectedEnterpriseId = id;
              Game.setTab('economy');
            }
            break;
          }
          case 'enterprise-task': Game.invoke('performEnterpriseTask', id, button.dataset.task); break;
          case 'finish-enterprise-session': Game.invoke('finishEnterpriseSession', id); break;
          case 'cancel-enterprise-session': Game.invoke('cancelEnterpriseSession', id); break;
          case 'pause-enterprise': Game.invoke('pauseEnterprise', id, false); break;
          case 'pause-enterprise-keep': Game.invoke('pauseEnterprise', id, false); break;
          case 'pause-enterprise-release': Game.invoke('pauseEnterprise', id, true); break;
          case 'resume-enterprise': Game.invoke('resumeEnterprise', id); break;
          case 'close-enterprise': Game.invoke('closeEnterprise', id); break;
          case 'pivot-enterprise': Game.invoke('pivotEnterprise', id, document.getElementById(`enterprise-pivot-${id}`)?.value, document.getElementById(`enterprise-pivot-need-${id}`)?.value || null); break;
          case 'set-enterprise-pricing': Game.invoke('setEnterprisePricing', id, document.getElementById(`enterprise-pricing-${id}`)?.value, Number(document.getElementById(`enterprise-price-${id}`)?.value)); break;
          case 'invite-enterprise-worker': Game.invoke('inviteEnterpriseWorker', id, document.getElementById(`enterprise-worker-${id}`)?.value, { wagePerSession: Number(document.getElementById(`enterprise-worker-wage-${id}`)?.value), sessionsPerWeek: Number(document.getElementById(`enterprise-worker-sessions-${id}`)?.value) }); break;
          case 'withdraw-enterprise-work-offer': Game.invoke('withdrawEnterpriseWorkOffer', id); break;
          case 'end-enterprise-worker': Game.invoke('endEnterpriseWorker', id, button.dataset.person); break;
          case 'withdraw-enterprise-funds': Game.invoke('withdrawEnterpriseFunds', id); break;
          case 'repair-enterprise-equipment': Game.invoke('repairEnterpriseEquipment', id, button.dataset.equipment); break;
          case 'upgrade-enterprise-equipment': Game.invoke('upgradeEnterpriseEquipment', id, button.dataset.equipment, button.dataset.axis); break;
          case 'prepare-walkable-experiment': {
            const result = Game.invoke('prepareWalkableExperiment');
            if (result?.ok) Game.setTab('street');
            break;
          }
          case 'prepare-enterprise-experiment': {
            const result = Game.invoke('prepareEnterpriseExperiment');
            if (result?.ok) {
              Game.world.ui.selectedEnterpriseId = result.enterpriseId;
              Game.setTab('economy');
            }
            break;
          }
          case 'start-shift': Game.invoke('startInteractiveShift'); break;
          case 'skip-shift': Game.invoke('skipShift'); break;
          case 'work-task': Game.invoke('performWorkTask', id); break;
          case 'apply-job': Game.invoke('applyForJob', id); break;
          case 'buy-material': Game.invoke('buyMaterial', id, 1); break;
          case 'buy-furniture': Game.invoke('buyFurniture', id); break;
          case 'move-object': Game.invoke('moveFurniture', id, Number(button.dataset.dx), Number(button.dataset.dy)); break;
          case 'rotate-object': Game.invoke('rotateFurniture', id); break;
          case 'recolor-object': Game.invoke('recolorFurniture', id, button.dataset.color); break;
          case 'upgrade-object': Game.invoke('upgradeFurniture', id, button.dataset.axis); break;
          case 'repair-object': Game.invoke('repairFurniture', id); break;
          case 'store-object': Game.invoke('storeFurniture', id); break;
          case 'place-stored': Game.invoke('placeStoredFurniture', id); break;
          case 'suggestion-color': Game.setSuggestionColor(button.dataset.color); break;
          case 'social': Game.invoke('interactWithNpc', id, button.dataset.kind, { colorId: Game.world.ui.selectedSuggestionColor }); break;
          case 'open-agreements': Game.setTab('agreements'); break;
          case 'open-family': Game.setTab('family'); break;
          case 'select-dependent':
            Game.world.ui.selectedDependentId = id;
            Game.world.ui.selectedPersonId = id;
            Game.setTab('family');
            break;
          case 'propose-parenthood': Game.invoke('proposeParenthood', {
            path: document.getElementById('familyArrivalPath')?.value,
            preferredStage: document.getElementById('familyPreferredStage')?.value,
            careMode: document.getElementById('familyCareMode')?.value,
            educationMode: document.getElementById('familyEducationMode')?.value,
            preparationDays: Number(document.getElementById('familyPreparationDays')?.value),
            playerCommitmentHours: Number(document.getElementById('familyPlayerHours')?.value),
            partnerCommitmentHours: Number(document.getElementById('familyPartnerHours')?.value),
            weeklyBudget: Number(document.getElementById('familyWeeklyBudget')?.value)
          }); break;
          case 'propose-another-dependent': {
            const unit = Family.playerFamily(Game.world);
            Game.invoke('proposeParenthood', {
              path: document.getElementById('familyNextPath')?.value,
              preferredStage: document.getElementById('familyNextStage')?.value,
              careMode: unit?.carePlan?.mode,
              educationMode: unit?.carePlan?.educationMode,
              preparationDays: 14,
              playerCommitmentHours: unit?.carePlan?.playerTargetHours,
              partnerCommitmentHours: unit?.carePlan?.partnerTargetHours,
              weeklyBudget: unit?.carePlan?.weeklyBudget
            });
            break;
          }
          case 'family-care': Game.invoke('performCareAction', id, button.dataset.kind); break;
          case 'propose-family-care-plan': Game.invoke('proposeFamilyChange', id, 'care_plan', {
            mode: document.getElementById('familyPlanMode')?.value,
            playerTargetHours: Number(document.getElementById('familyPlanPlayerHours')?.value),
            partnerTargetHours: Number(document.getElementById('familyPlanPartnerHours')?.value),
            weeklyBudget: Number(document.getElementById('familyPlanBudget')?.value)
          }); break;
          case 'propose-family-education': Game.invoke('proposeFamilyChange', id, 'education_plan', {
            mode: document.getElementById('familyPlanEducation')?.value
          }); break;
          case 'propose-family-room': Game.invoke('proposeFamilyChange', id, 'room_plan', {
            personId: document.getElementById('familyRoomPerson')?.value,
            roomId: document.getElementById('familyRoomId')?.value,
            kind: document.getElementById('familyRoomKind')?.value
          }); break;
          case 'propose-family-ritual': Game.invoke('proposeFamilyChange', id, 'family_ritual', {
            label: document.getElementById('familyRitualLabel')?.value,
            meaning: document.getElementById('familyRitualMeaning')?.value
          }); break;
          case 'respond-family-proposal': Game.invoke('respondToFamilyProposal', id, button.dataset.response); break;
          case 'prepare-family-experiment': {
            const result = Game.invoke('prepareFamilyContinuityExperiment', button.dataset.variant || 'young_child');
            if (result?.ok) {
              Game.world.ui.selectedDependentId = result.dependentId;
              Game.setTab('family');
            }
            break;
          }
          case 'prepare-household-experiment': {
            const result = Game.invoke('prepareHouseholdExperiment');
            if (result?.ok && result.npcId) Game.selectPerson(result.npcId);
            break;
          }
          case 'propose-commitment': Game.invoke('proposeCommitment', id); break;
          case 'propose-cohabitation': Game.invoke('proposeCohabitation', id, document.getElementById('hhMoveDestination')?.value); break;
          case 'propose-home-property': Game.invoke('proposeCohabitation', button.dataset.partner, id); break;
          case 'propose-finance': Game.invoke('proposeHouseholdChange', id, 'finance', {
            mode: document.getElementById('hhFinanceMode')?.value,
            weeklyReserveTarget: Number(document.getElementById('hhReserveTarget')?.value)
          }); break;
          case 'propose-space': Game.invoke('proposeHouseholdChange', id, 'space', {
            mode: document.getElementById('hhSpaceMode')?.value
          }); break;
          case 'propose-goal': Game.invoke('proposeHouseholdChange', id, 'goal', {
            goalType: document.getElementById('hhGoalType')?.value,
            target: Number(document.getElementById('hhGoalTarget')?.value)
          }); break;
          case 'propose-renovation': {
            const kind = document.getElementById('hhRenovationKind')?.value;
            const terms = {
              kind,
              objectId: document.getElementById('hhRenovationObject')?.value
            };
            if (kind === 'partner_recolor') terms.colorId = document.getElementById('hhRenovationColor')?.value;
            else terms.axis = document.getElementById('hhRenovationAxis')?.value;
            Game.invoke('proposeHouseholdChange', id, 'renovation', terms);
            break;
          }
          case 'respond-proposal': Game.invoke('respondToHouseholdProposal', id, button.dataset.response); break;
          case 'withdraw-proposal': Game.invoke('withdrawHouseholdProposal', id); break;
          case 'repair-issue': Game.invoke('repairHouseholdIssue', button.dataset.household, id, button.dataset.approach); break;
          case 'end-household-agreement': Game.invoke('endHouseholdAgreement', id, document.getElementById('hhExitDestination')?.value || null, document.getElementById('hhEndAck')?.value.trim() === 'END'); break;
          case 'open-community': Game.setTab('community'); break;
          case 'request-community-membership': Game.invoke('requestCommunityMembership', id); break;
          case 'leave-community-institution': Game.invoke('leaveCommunityInstitution', id); break;
          case 'participate-community-opportunity': Game.invoke('participateCommunityOpportunity', id); break;
          case 'respond-community-opportunity': Game.invoke('respondToCommunityOpportunity', id, button.dataset.response); break;
          case 'invite-community-connection': Game.invoke('inviteCommunityConnection', id); break;
          case 'discover-adventure': Game.invoke('discoverAdventure'); break;
          case 'continue-adventure': Game.invoke('continueAdventure', id); break;
          case 'release-adventure': Game.invoke('releaseAdventure', id); break;
          case 'prepare-community-experiment': {
            const result = Game.invoke('prepareCommunityAdventureExperiment');
            if (result?.ok) Game.setTab('community');
            break;
          }
          case 'prepare-stewardship-experiment': {
            const result = Game.invoke('prepareStewardshipExperiment');
            if (result?.ok) Game.setTab('stewardship');
            break;
          }
          case 'respond-stewardship': Game.invoke('respondToStewardshipRequest', id, button.dataset.response); break;
          case 'rent-property': Game.invoke('rentProperty', id); break;
          case 'buy-property': Game.invoke('buyProperty', id); break;
          case 'move-owned': Game.invoke('moveIntoOwnedProperty', id); break;
          case 'ledger-filter': Game.setLedgerFilter(id); break;
          case 'step-hours': Game.invoke('advanceHours', Number(button.dataset.hours)); break;
          case 'observer-days': {
            const result = Game.invoke('runObserverDays', Number(button.dataset.days));
            if (result?.after) {
              Game.world.ui.lastObserverReport = result;
              Game.afterMutation('observer-report');
            }
            break;
          }
          case 'developer-grant': Game.invoke('developerGrant'); break;
          case 'export-world': Game.exportWorld(); break;
          case 'export-ledger': Game.exportLedger(); break;
          case 'trigger-import': document.getElementById('worldImport')?.click(); break;
          case 'clear-autosave': Game.clearAutosave(); break;
          case 'new-world': Game.newWorld(document.getElementById('seedInput')?.value); break;
          case 'rename-player': Game.invoke('renamePlayer', document.getElementById('playerNameInput')?.value); break;
          case 'toast-close': Game.clearToast(); break;
          default: break;
        }
      });

      this.app.addEventListener('keydown', (event) => {
        const tab = event.target.closest?.('.tab-button');
        if (!tab) return;
        const targetId = this.navigationTarget(tab.dataset.id, event.key);
        if (!targetId) return;
        event.preventDefault();
        this.activateTab(targetId);
      });

      this.app.addEventListener('change', (event) => {
        const target = event.target;
        if (target.id === 'worldImport' && target.files?.[0]) {
          Game.importWorldFile(target.files[0]);
          target.value = '';
        }
        if (target.id === 'autosaveToggle') Game.toggleAutosave(target.checked);
        if (target.dataset.action === 'set-rent') Game.invoke('setOwnedRent', target.dataset.id, Number(target.value));
      });
    },

    startLivingLoop(world) {
      const canvas = document.getElementById('livingCanvas');
      if (!canvas) return;
      const systemReduced = Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      const motion = Visuals.motionLevel(world, systemReduced);
      const staticQuery = typeof location !== 'undefined' && new URLSearchParams(location.search).get('static') === '1';
      if (motion === 'still' || staticQuery) {
        this.drawLivingCanvas(world, canvas, 0, 'still');
        return;
      }
      const interval = motion === 'gentle' ? 120 : 42;
      const draw = (timestamp) => {
        const liveCanvas = document.getElementById('livingCanvas');
        if (Game.world.ui.activeTab !== 'visuals' || !liveCanvas) return;
        if (timestamp - this.livingLastDraw >= interval) {
          this.drawLivingCanvas(Game.world, liveCanvas, timestamp, motion);
          this.livingLastDraw = timestamp;
        }
        this.livingFrame = requestAnimationFrame(draw);
      };
      this.livingFrame = requestAnimationFrame(draw);
    },

    cancelLivingLoop() {
      if (this.livingFrame) cancelAnimationFrame(this.livingFrame);
      this.livingFrame = null;
      this.livingLastDraw = 0;
    },

    drawLivingCanvas(world, canvas, timestamp, motion = 'full') {
      const logicalW = 960;
      const logicalH = 560;
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      const desiredW = Math.round(logicalW * dpr);
      const desiredH = Math.round(logicalH * dpr);
      if (canvas.width !== desiredW || canvas.height !== desiredH) {
        canvas.width = desiredW;
        canvas.height = desiredH;
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, logicalW, logicalH);
      const scene = Visuals.sceneFor(world);
      const amount = motion === 'still' ? 0 : motion === 'gentle' ? 0.38 : 1;
      if (!scene || !Visuals.validateScene(scene).ok) {
        ctx.fillStyle = '#111923';
        ctx.fillRect(0, 0, logicalW, logicalH);
        ctx.fillStyle = '#dce7eb';
        ctx.font = '700 24px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Visual scene held at the truth boundary', logicalW / 2, logicalH / 2);
        return;
      }
      if (scene.kind === 'room') this.drawRoomVisual(world, ctx, scene, timestamp, amount, logicalW, logicalH);
      else if (scene.kind === 'building') this.drawBuildingVisual(world, ctx, scene, timestamp, amount, logicalW, logicalH);
      else this.drawStreetVisual(world, ctx, scene, timestamp, amount, logicalW, logicalH);
      this.drawVisualFrameText(ctx, scene, motion, logicalW, logicalH);
    },

    drawRoomVisual(world, ctx, scene, timestamp, amount, width, height) {
      const hour = world.time.hour + (world.time.minute || 0) / 60;
      const daylight = hour >= 7 && hour < 19;
      const wallFinishes = {
        warm_clay: '#765d51', soft_white: '#6f7d7c', painted_plaster: '#607277', exposed_brick: '#75554d', patched_wall: '#625f5a'
      };
      const floorFinishes = {
        reclaimed_wood: '#756451', small_tile: '#66777a', worn_carpet: '#665e64', polished_concrete: '#5e686a', patched_floor: '#685f54'
      };
      const wallBase = wallFinishes[scene.finish?.wallFinishId] || (scene.purpose === 'bathroom' ? '#687879' : '#5c6b69');
      const floorBase = floorFinishes[scene.finish?.floorFinishId] || (scene.purpose === 'bathroom' ? '#66777a' : '#6f6254');
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, daylight ? '#b9d8d8' : '#121b31');
      sky.addColorStop(1, daylight ? '#5e8787' : '#202a3d');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      const wall = ctx.createLinearGradient(0, 55, 0, 355);
      wall.addColorStop(0, Core.mixHex(wallBase, daylight ? '#d8ebe5' : '#152132', daylight ? 0.23 : 0.55));
      wall.addColorStop(1, Core.mixHex(wallBase, '#172127', daylight ? 0.45 : 0.62));
      ctx.fillStyle = wall;
      roundedRect(ctx, 45, 38, 870, 468, 22);
      ctx.fill();
      ctx.strokeStyle = 'rgba(232,241,242,0.16)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = Core.mixHex(floorBase, daylight ? '#aa9578' : '#202a32', daylight ? 0.18 : 0.48);
      ctx.beginPath();
      ctx.moveTo(46, 326);
      ctx.lineTo(914, 326);
      ctx.lineTo(868, 506);
      ctx.lineTo(92, 506);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(22,26,28,0.24)';
      if (scene.finish?.floorFinishId === 'small_tile' || scene.purpose === 'bathroom') {
        for (let line = 0; line < 8; line += 1) {
          const y = 342 + line * 22;
          ctx.beginPath();
          ctx.moveTo(58 + line * 4, y);
          ctx.lineTo(902 - line * 4, y);
          ctx.stroke();
        }
        for (let line = 0; line < 13; line += 1) {
          const x = 76 + line * 66;
          ctx.beginPath();
          ctx.moveTo(x, 326);
          ctx.lineTo(width / 2 + (x - width / 2) * 0.88, 506);
          ctx.stroke();
        }
      } else {
        for (let line = 0; line < 8; line += 1) {
          const y = 342 + line * 22;
          ctx.beginPath();
          ctx.moveTo(58 + line * 4, y);
          ctx.lineTo(902 - line * 4, y);
          ctx.stroke();
        }
      }

      if (scene.purpose === 'work') {
        ctx.fillStyle = 'rgba(31,42,45,0.72)';
        roundedRect(ctx, 96, 86, 196, 102, 8);
        ctx.fill();
        ['#d0a85b', '#82b79a', '#8eb4cf'].forEach((color, index) => {
          ctx.fillStyle = color;
          ctx.fillRect(116 + index * 56, 106 + (index % 2) * 22, 38, 31);
        });
      }

      const windowX = 672;
      const windowY = 76;
      ctx.fillStyle = daylight ? '#a6d9dc' : '#17223b';
      ctx.fillRect(windowX, windowY, 168, 136);
      ctx.strokeStyle = '#17242a';
      ctx.lineWidth = 10;
      ctx.strokeRect(windowX, windowY, 168, 136);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(windowX + 84, windowY + 4);
      ctx.lineTo(windowX + 84, windowY + 132);
      ctx.moveTo(windowX + 4, windowY + 68);
      ctx.lineTo(windowX + 164, windowY + 68);
      ctx.stroke();
      if (daylight) {
        ctx.fillStyle = 'rgba(249,226,160,0.08)';
        ctx.beginPath();
        ctx.moveTo(windowX + 8, windowY + 136);
        ctx.lineTo(windowX + 160, windowY + 136);
        ctx.lineTo(738, 506);
        ctx.lineTo(430, 506);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#d7e3df';
        ctx.beginPath();
        ctx.arc(windowX + 34, windowY + 32, 11, 0, Math.PI * 2);
        ctx.fill();
      }

      const objects = this.arrangeRoomVisualObjects(scene.objects);
      objects.forEach((object, index) => {
        this.drawVisualObject(
          ctx,
          object,
          object.drawX,
          object.drawY,
          timestamp,
          amount,
          index,
          object.id === scene.selectedObjectId,
          scene.recentMoment
        );
      });

      if (scene.recentMoment) this.drawActivityEcho(ctx, scene.recentMoment, objects, timestamp, amount, width, height);

      scene.actors.forEach((actor, index) => {
        const phase = actor.phase + timestamp / (780 / Math.max(0.2, amount || 0.2));
        const x = 360 + index * 102 + Math.sin(phase * 0.35) * 10 * amount;
        const y = 392 + (index % 2) * 18;
        this.drawVisualPerson(ctx, actor, x, y, phase, amount, index === 0);
      });

      if (!scene.actors.length) {
        ctx.fillStyle = 'rgba(226,235,237,0.64)';
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Persistent room view · no person claimed present', width / 2, 292);
      }

      const motes = amount ? 18 : 7;
      for (let i = 0; i < motes; i += 1) {
        const seedX = Visuals.stableUnit(`${world.seed}:mote:x:${i}`);
        const seedY = Visuals.stableUnit(`${world.seed}:mote:y:${i}`);
        const x = 90 + ((seedX * 760 + timestamp * 0.008 * amount * (1 + i % 3)) % 760);
        const y = 80 + ((seedY * 320 + Math.sin(timestamp / 900 + i) * 14 * amount + 320) % 320);
        ctx.fillStyle = `rgba(245,236,201,${0.08 + (i % 4) * 0.025})`;
        ctx.beginPath();
        ctx.arc(x, y, 1 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    },

    arrangeRoomVisualObjects(objects) {
      const offsets = [[0, 0], [72, 0], [-72, 0], [0, 58], [72, 52], [-72, 52], [115, 22], [-115, 22], [0, 105]];
      const placed = [];
      objects.slice().sort((a, b) => a.ny - b.ny || a.nx - b.nx || a.id.localeCompare(b.id)).forEach((object) => {
        const baseX = 105 + object.nx * 730;
        const baseY = 274 + object.ny * 180;
        let candidate = { x: baseX, y: baseY };
        for (const [ox, oy] of offsets) {
          const test = { x: Core.clamp(baseX + ox, 100, 860), y: Core.clamp(baseY + oy, 300, 474) };
          if (!placed.some((entry) => Math.abs(entry.drawX - test.x) < 76 && Math.abs(entry.drawY - test.y) < 52)) {
            candidate = test;
            break;
          }
        }
        placed.push({ ...object, drawX: candidate.x, drawY: candidate.y });
      });
      return placed;
    },

    drawActivityEcho(ctx, moment, objects, timestamp, amount, width, height) {
      const target = objects.find((object) => object.id === moment.objectId) || null;
      const t = amount ? timestamp / 800 : 0;
      const x = target?.drawX || width / 2;
      const y = target?.drawY || 392;
      const pulse = 1 + Math.sin(t * 1.7) * 0.08 * amount;

      ctx.save();
      ctx.globalAlpha = 0.58;
      ctx.strokeStyle = 'rgba(139,224,175,0.72)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.ellipse(x, y + 18, 56 * pulse, 27 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (moment.actionId === 'sleep') {
        ctx.translate(x, y - 9);
        ctx.rotate(-0.08);
        ctx.fillStyle = '#8be0af';
        roundedRect(ctx, -30, -8, 62, 17, 8);
        ctx.fill();
        ctx.fillStyle = '#e2b894';
        ctx.beginPath();
        ctx.arc(-39, 0, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (moment.actionId === 'shower') {
        for (let drop = 0; drop < 8; drop += 1) {
          const dy = amount ? (drop * 19 + timestamp * 0.055) % 135 : drop * 16;
          ctx.strokeStyle = 'rgba(135,205,224,0.72)';
          ctx.beginPath();
          ctx.moveTo(x - 38 + (drop % 4) * 25, y - 104 + dy);
          ctx.lineTo(x - 41 + (drop % 4) * 25, y - 92 + dy);
          ctx.stroke();
        }
      } else if (moment.actionId === 'eat_home') {
        ctx.globalAlpha = 0.42;
        this.drawVisualPerson(ctx, { id: 'completed-meal-echo', color: '#8be0af', phase: 0, scale: 0.68 }, x - 62, y - 18, t, amount, false);
        ctx.globalAlpha = 0.62;
        ctx.fillStyle = '#d8d2bb';
        ctx.beginPath();
        ctx.ellipse(x + 4, y - 14, 22, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d7a86e';
        ctx.beginPath();
        ctx.ellipse(x + 4, y - 17, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(237,237,215,0.62)';
        for (let steam = 0; steam < 3; steam += 1) {
          const rise = amount ? (timestamp * 0.02 + steam * 11) % 29 : steam * 9;
          ctx.beginPath();
          ctx.moveTo(x - 8 + steam * 11, y - 24 - rise);
          ctx.quadraticCurveTo(x - 15 + steam * 11, y - 30 - rise, x - 7 + steam * 11, y - 37 - rise);
          ctx.stroke();
        }
      } else if (moment.actionId === 'play_pc' || moment.actionId === 'study_focus') {
        ctx.globalAlpha = 0.42;
        this.drawVisualPerson(ctx, { id: `completed-${moment.actionId}-echo`, color: '#8be0af', phase: 0, scale: 0.7 }, x - 58, y - 12, t, amount, false);
        ctx.globalAlpha = 0.58;
        ctx.strokeStyle = moment.actionId === 'play_pc' ? '#8eb4cf' : '#d0c795';
        ctx.lineWidth = 2;
        const marks = moment.actionId === 'play_pc' ? 5 : 4;
        for (let mark = 0; mark < marks; mark += 1) {
          const drift = amount ? Math.sin(t * 1.4 + mark) * 5 : 0;
          ctx.beginPath();
          ctx.moveTo(x + 20 + mark * 6, y - 62 + mark * 4 + drift);
          ctx.lineTo(x + 26 + mark * 6, y - 68 + mark * 4 + drift);
          ctx.stroke();
        }
        if (moment.actionId === 'study_focus') {
          ctx.fillStyle = 'rgba(239,235,214,0.82)';
          ctx.fillRect(x - 4, y - 22, 31, 18);
          ctx.strokeStyle = '#7f907f';
          ctx.beginPath();
          ctx.moveTo(x + 1, y - 16);
          ctx.lineTo(x + 20, y - 16);
          ctx.moveTo(x + 1, y - 10);
          ctx.lineTo(x + 15, y - 10);
          ctx.stroke();
        }
      } else if (moment.actionId === 'creative_time') {
        ctx.globalAlpha = 0.42;
        this.drawVisualPerson(ctx, { id: 'completed-creative-echo', color: '#8be0af', phase: 0, scale: 0.7 }, x - 56, y - 12, t, amount, false);
        ctx.globalAlpha = 0.62;
        const creativeColors = ['#d0a85b', '#8eb4cf', '#c58da5', '#82b79a'];
        creativeColors.forEach((color, index) => {
          const angle = t * 0.45 + index * Math.PI / 2;
          const radius = 31 + index * 4;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x + 18 + Math.cos(angle) * radius, y - 35 + Math.sin(angle) * radius * 0.55, 4, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.strokeStyle = '#e4d9b8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 14);
        ctx.lineTo(x + 27, y - 48);
        ctx.stroke();
      } else if (moment.actionId === 'clean_home') {
        ctx.strokeStyle = '#c9aa72';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x - 18, y - 74);
        ctx.lineTo(x + 18, y + 24);
        ctx.stroke();
        ctx.fillStyle = '#d7c19a';
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 18);
        ctx.lineTo(x + 41, y + 30);
        ctx.lineTo(x + 18, y + 42);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.44;
        this.drawVisualPerson(ctx, { id: 'completed-player-echo', color: '#8be0af', phase: 0, scale: 0.76 }, x - 42, y - 20, t, amount, false);
      }

      const particleCount = amount ? 6 : 3;
      for (let index = 0; index < particleCount; index += 1) {
        const angle = index / particleCount * Math.PI * 2 + t * 0.35;
        const radius = 38 + (index % 2) * 15;
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = ['#8be0af', '#d0a85b', '#8eb4cf'][index % 3];
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * radius, y - 12 + Math.sin(angle) * radius * 0.55, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = 'rgba(8,13,18,0.72)';
      roundedRect(ctx, width / 2 - 205, height - 62, 410, 30, 9);
      ctx.fill();
      ctx.fillStyle = '#cfe8da';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Completed here: ${abbreviate(moment.label, 34)} · visual echo, not current presence`, width / 2, height - 42);
    },

    drawVisualObject(ctx, object, x, y, timestamp, amount, index, focused = false, moment = null) {
      const phase = timestamp / 700 + index * 0.8;
      const color = object.color;
      const activeEcho = moment?.objectId === object.id;
      ctx.save();
      ctx.translate(x, y);
      if (focused) {
        ctx.strokeStyle = 'rgba(139,224,175,0.82)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.ellipse(0, 20, 52 + Math.sin(phase) * 3 * amount, 30, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 6;
      if (object.kind === 'rug') {
        ctx.fillStyle = Core.mixHex(color, '#111820', 0.18);
        ctx.beginPath();
        ctx.ellipse(0, 18, 56, 24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.setLineDash([6, 5]);
        ctx.stroke();
      } else if (object.kind === 'bed') {
        ctx.fillStyle = Core.mixHex(color, '#f2eee5', 0.28);
        roundedRect(ctx, -48, -4, 96, 52, 10);
        ctx.fill();
        ctx.fillStyle = 'rgba(241,239,224,0.72)';
        roundedRect(ctx, -42, 1, 34, 17, 6);
        ctx.fill();
        ctx.strokeStyle = activeEcho ? 'rgba(139,224,175,0.62)' : 'rgba(255,255,255,0.09)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-3, 9 + Math.sin(phase) * 2 * amount);
        ctx.quadraticCurveTo(20, 2, 44, 13 + Math.sin(phase + 1) * 2 * amount);
        ctx.stroke();
      } else if (object.kind === 'seat') {
        ctx.fillStyle = color;
        roundedRect(ctx, -28, -30, 56, 50, 11);
        ctx.fill();
        ctx.fillStyle = Core.mixHex(color, '#ffffff', 0.14);
        roundedRect(ctx, -24, 0, 48, 27, 9);
        ctx.fill();
      } else if (object.kind === 'table') {
        ctx.fillStyle = color;
        roundedRect(ctx, -42, -8, 84, 27, 7);
        ctx.fill();
        ctx.fillRect(-34, 14, 8, 28);
        ctx.fillRect(26, 14, 8, 28);
        if (activeEcho) {
          ctx.fillStyle = 'rgba(237,232,205,0.88)';
          ctx.fillRect(-20, -13, 31, 16);
          ctx.strokeStyle = '#8be0af';
          ctx.beginPath();
          ctx.moveTo(-14, -7);
          ctx.lineTo(4, -7);
          ctx.stroke();
        }
      } else if (object.kind === 'lamp') {
        const glow = 0.2 + (Math.sin(phase) + 1) * 0.08 * amount;
        ctx.shadowColor = `rgba(245,205,118,${glow + 0.22})`;
        ctx.shadowBlur = 30 + 10 * amount;
        ctx.fillStyle = '#e7c36e';
        ctx.beginPath();
        ctx.moveTo(-18, -22);
        ctx.lineTo(18, -22);
        ctx.lineTo(11, 3);
        ctx.lineTo(-11, 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = color;
        ctx.fillRect(-3, 2, 6, 38);
        ctx.fillRect(-14, 38, 28, 5);
      } else if (object.kind === 'screen') {
        ctx.fillStyle = '#111a21';
        roundedRect(ctx, -32, -28, 64, 43, 5);
        ctx.fill();
        const shimmer = 0.45 + Math.sin(phase * 1.7) * 0.06 * amount;
        ctx.fillStyle = `rgba(105,191,190,${shimmer})`;
        ctx.fillRect(-27, -23, 54, 32);
        if (activeEcho) {
          ctx.fillStyle = 'rgba(229,247,239,0.42)';
          const scanY = -21 + ((amount ? timestamp * 0.04 : 8) % 28);
          ctx.fillRect(-25, scanY, 50, 2);
        }
        ctx.fillStyle = '#44545c';
        ctx.fillRect(-4, 14, 8, 13);
        ctx.fillRect(-18, 27, 36, 4);
      } else if (object.kind === 'water') {
        ctx.fillStyle = Core.mixHex(color, '#d9e4e2', 0.36);
        roundedRect(ctx, -34, -34, 68, 68, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(229,239,237,0.74)';
        ctx.beginPath();
        ctx.ellipse(0, -4, 24, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#50646a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-8, -18);
        ctx.quadraticCurveTo(-8, -38, 9, -38);
        ctx.lineTo(9, -26);
        ctx.stroke();
        if (activeEcho) {
          ctx.strokeStyle = 'rgba(135,205,224,0.76)';
          ctx.lineWidth = 2;
          for (let drop = 0; drop < 4; drop += 1) {
            const fall = amount ? (timestamp * 0.045 + drop * 8) % 25 : drop * 6;
            ctx.beginPath();
            ctx.moveTo(-12 + drop * 8, -21 + fall);
            ctx.lineTo(-14 + drop * 8, -14 + fall);
            ctx.stroke();
          }
        }
      } else if (object.kind === 'plant') {
        ctx.fillStyle = color;
        roundedRect(ctx, -16, 11, 32, 30, 6);
        ctx.fill();
        ctx.translate(0, 8);
        ctx.rotate(Math.sin(phase * 0.7) * 0.035 * amount);
        ['#76a873', '#5b9162', '#89b77d'].forEach((leaf, leafIndex) => {
          ctx.fillStyle = leaf;
          ctx.beginPath();
          ctx.ellipse((leafIndex - 1) * 11, -10 - leafIndex * 7, 9, 20, (leafIndex - 1) * 0.45, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (object.kind === 'music') {
        ctx.fillStyle = '#1a2228';
        roundedRect(ctx, -28, -24, 56, 54, 7);
        ctx.fill();
        for (let bar = 0; bar < 4; bar += 1) {
          const h = 7 + (amount ? (Math.sin(phase * 1.5 + bar) + 1) * 6 : 5);
          ctx.fillStyle = ['#82b79a', '#d0a85b', '#8eb4cf', '#c58da5'][bar];
          ctx.fillRect(-19 + bar * 10, 18 - h, 6, h);
        }
      } else if (object.kind === 'kitchen') {
        ctx.fillStyle = color;
        roundedRect(ctx, -40, -34, 80, 72, 7);
        ctx.fill();
        ctx.fillStyle = '#202a2e';
        for (let burner = 0; burner < 2; burner += 1) {
          ctx.beginPath();
          ctx.arc(-17 + burner * 34, -20, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        if (activeEcho) {
          ctx.strokeStyle = 'rgba(237,237,215,0.58)';
          ctx.lineWidth = 3;
          for (let steam = 0; steam < 3; steam += 1) {
            const rise = amount ? (timestamp * 0.025 + steam * 14) % 34 : steam * 10;
            ctx.beginPath();
            ctx.moveTo(-17 + steam * 17, -31 - rise);
            ctx.quadraticCurveTo(-25 + steam * 17, -39 - rise, -16 + steam * 17, -47 - rise);
            ctx.stroke();
          }
        }
      } else if (object.kind === 'storage') {
        ctx.fillStyle = color;
        roundedRect(ctx, -34, -34, 68, 72, 7);
        ctx.fill();
        ctx.strokeStyle = 'rgba(17,24,28,0.45)';
        ctx.beginPath();
        ctx.moveTo(-28, -8);
        ctx.lineTo(28, -8);
        ctx.moveTo(-28, 15);
        ctx.lineTo(28, 15);
        ctx.stroke();
      } else if (object.kind === 'wall') {
        ctx.fillStyle = color;
        ctx.fillRect(-29, -95, 58, 44);
        ctx.strokeStyle = 'rgba(244,239,221,0.68)';
        ctx.lineWidth = 4;
        ctx.strokeRect(-29, -95, 58, 44);
      } else {
        ctx.fillStyle = color;
        roundedRect(ctx, -25, -22, 50, 50, 9);
        ctx.fill();
      }
      if (focused) {
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(7,12,16,0.82)';
        roundedRect(ctx, -52, 48, 104, 22, 7);
        ctx.fill();
        ctx.fillStyle = '#d9f2e3';
        ctx.font = '700 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(abbreviate(object.name, 16), 0, 63, 94);
      }
      ctx.restore();
    },

    drawVisualPerson(ctx, actor, x, y, phase, amount, primary = false) {
      const bob = Math.sin(phase) * 2.6 * amount;
      const sway = Math.sin(phase * 0.55) * 2 * amount;
      ctx.save();
      ctx.translate(x + sway, y + bob);
      ctx.scale(actor.scale || 1, actor.scale || 1);
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = 'rgba(8,14,18,0.42)';
      ctx.beginPath();
      ctx.ellipse(0, 42, 21, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = Core.mixHex(actor.color, '#0a1015', 0.62);
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-5, 25);
      ctx.lineTo(-8 - Math.sin(phase) * 3 * amount, 41);
      ctx.moveTo(5, 25);
      ctx.lineTo(8 + Math.sin(phase) * 3 * amount, 41);
      ctx.stroke();
      ctx.fillStyle = actor.color;
      roundedRect(ctx, -13, -14, 26, 43, 11);
      ctx.fill();
      ctx.fillStyle = '#e2b894';
      ctx.beginPath();
      ctx.arc(0, -25, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222c33';
      ctx.beginPath();
      ctx.arc(0, -29, 11, Math.PI, 0);
      ctx.fill();
      if (primary) {
        ctx.strokeStyle = 'rgba(139,224,175,0.78)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 1, 25 + Math.sin(phase) * 2 * amount, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },

    drawBuildingVisual(world, ctx, scene, timestamp, amount, width, height) {
      const night = world.time.hour >= 19 || world.time.hour < 7;
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, night ? '#11182d' : '#7ca4ad');
      sky.addColorStop(1, night ? '#263145' : '#c5d7cf');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 5; i += 1) {
        const drift = amount ? (timestamp * 0.006 * (1 + i * 0.08)) % 1100 : 0;
        const x = ((Visuals.stableUnit(`${scene.buildingId}:cloud:${i}`) * 1000 + drift) % 1100) - 80;
        const y = 70 + i * 34;
        ctx.fillStyle = night ? 'rgba(209,220,229,0.06)' : 'rgba(242,245,240,0.22)';
        ctx.beginPath();
        ctx.ellipse(x, y, 54, 16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = night ? '#171d22' : '#4f6252';
      ctx.fillRect(0, height - 72, width, 72);

      const storeys = scene.storeys.slice().sort((a, b) => a.level - b.level);
      const floorH = Math.min(95, 340 / Math.max(1, storeys.length));
      const buildingH = floorH * storeys.length;
      const bx = 180;
      const by = height - 72 - buildingH;
      const bw = 600;
      ctx.fillStyle = '#5e6b70';
      ctx.fillRect(bx, by, bw, buildingH);
      ctx.strokeStyle = 'rgba(16,22,27,0.65)';
      ctx.lineWidth = 4;
      ctx.strokeRect(bx, by, bw, buildingH);

      storeys.forEach((storey, index) => {
        const y = by + buildingH - (index + 1) * floorH;
        ctx.fillStyle = index % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(13,18,23,0.08)';
        ctx.fillRect(bx, y, bw, floorH);
        ctx.strokeStyle = 'rgba(14,20,24,0.35)';
        ctx.beginPath();
        ctx.moveTo(bx, y);
        ctx.lineTo(bx + bw, y);
        ctx.stroke();
        const windows = Math.max(2, Math.min(8, storey.windows || 2));
        for (let wi = 0; wi < windows; wi += 1) {
          const wx = bx + 34 + wi * ((bw - 68) / windows);
          const glowSeed = Visuals.stableUnit(`${scene.buildingId}:${storey.id}:window:${wi}`);
          const glow = night && glowSeed > 0.35;
          const flicker = glow ? 0.62 + Math.sin(timestamp / 1800 + wi) * 0.06 * amount : 0.52;
          ctx.fillStyle = glow ? `rgba(244,205,121,${flicker})` : `rgba(174,211,219,${night ? 0.2 : 0.58})`;
          ctx.fillRect(wx, y + 21, 38, Math.max(30, floorH - 43));
          ctx.strokeStyle = 'rgba(22,29,33,0.66)';
          ctx.strokeRect(wx, y + 21, 38, Math.max(30, floorH - 43));
        }
        ctx.fillStyle = 'rgba(235,241,241,0.58)';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(storey.label, bx - 16, y + floorH / 2);
      });
      ctx.fillStyle = '#354148';
      ctx.beginPath();
      ctx.moveTo(bx - 18, by);
      ctx.lineTo(bx + bw / 2, by - 58);
      ctx.lineTo(bx + bw + 18, by);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6b4b3b';
      ctx.fillRect(bx + bw / 2 - 28, height - 72 - 66, 56, 66);

      if (scene.playerLevel != null || scene.activeMovement) {
        const activeProgress = scene.activeMovement
          ? scene.activeMovement.index / Math.max(1, scene.activeMovement.total)
          : 0;
        const level = scene.playerLevel == null ? activeProgress * Math.max(1, storeys.length - 1) : scene.playerLevel;
        const markerY = height - 72 - floorH * (level + 0.5);
        const markerX = bx + bw - 42 + Math.sin(timestamp / 500) * 4 * amount;
        const actor = { id: 'player', color: '#8be0af', phase: 0, scale: 0.72 };
        this.drawVisualPerson(ctx, actor, markerX, markerY, timestamp / 650, amount, true);
      }

      ctx.fillStyle = 'rgba(220,232,233,0.76)';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${scene.coarseOccupants} occupants summarized across the shell · no private-room markers`, 24, height - 30);
    },

    drawStreetVisual(world, ctx, scene, timestamp, amount, width, height) {
      const night = world.time.hour >= 19 || world.time.hour < 7;
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, night ? '#10182b' : '#75a1ae');
      sky.addColorStop(0.66, night ? '#283248' : '#d7cdb8');
      sky.addColorStop(1, night ? '#34313a' : '#c99571');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = night ? '#d8e0dc' : '#f2cf7a';
      ctx.beginPath();
      ctx.arc(120, 94, night ? 22 : 36, 0, Math.PI * 2);
      ctx.fill();

      const cloudCount = amount ? 5 : 3;
      for (let i = 0; i < cloudCount; i += 1) {
        const drift = amount ? timestamp * 0.009 * (0.55 + i * 0.08) : 0;
        const x = ((Visuals.stableUnit(`${scene.placeId}:street-cloud:${i}`) * 1080 + drift) % 1080) - 70;
        const y = 72 + (i % 3) * 54;
        ctx.fillStyle = night ? 'rgba(221,228,233,0.07)' : 'rgba(249,246,235,0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y, 58, 17, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#263238';
      ctx.fillRect(0, 392, width, 168);
      ctx.fillStyle = '#bcae91';
      ctx.fillRect(0, 390, width, 18);
      ctx.fillStyle = 'rgba(246,221,150,0.5)';
      for (let x = 18; x < width; x += 92) ctx.fillRect(x, 478, 48, 4);

      const bx = 252;
      const by = 116;
      const bw = 456;
      const bh = 276;
      ctx.fillStyle = scene.facade.color;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = 'rgba(16,22,28,0.58)';
      ctx.lineWidth = 5;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = Core.mixHex(scene.facade.color, '#101820', 0.48);
      ctx.beginPath();
      ctx.moveTo(bx - 18, by);
      ctx.lineTo(bx + bw / 2, by - 52);
      ctx.lineTo(bx + bw + 18, by);
      ctx.closePath();
      ctx.fill();

      const windows = Math.max(2, Math.min(8, scene.facade.windows));
      for (let wi = 0; wi < windows; wi += 1) {
        const cols = Math.min(4, windows);
        const row = Math.floor(wi / cols);
        const col = wi % cols;
        const wx = bx + 48 + col * 92;
        const wy = by + 46 + row * 88;
        const glow = night && Visuals.stableUnit(`${scene.placeId}:facade-window:${wi}`) > 0.36;
        ctx.fillStyle = glow ? 'rgba(247,210,126,0.7)' : night ? 'rgba(135,171,188,0.23)' : 'rgba(174,216,220,0.66)';
        ctx.fillRect(wx, wy, 54, 48);
        ctx.strokeStyle = 'rgba(22,29,34,0.58)';
        ctx.strokeRect(wx, wy, 54, 48);
      }
      ctx.fillStyle = scene.facade.doorColor;
      ctx.fillRect(bx + bw / 2 - 30, by + bh - 82, 60, 82);
      ctx.fillStyle = 'rgba(15,20,25,0.7)';
      roundedRect(ctx, bx + 88, by + bh - 32, 180, 26, 7);
      ctx.fill();
      ctx.fillStyle = '#efe8d6';
      ctx.font = '800 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(abbreviate(scene.facade.signText, 24), bx + 178, by + bh - 15, 164);

      const traceCount = Math.min(4, scene.ambientRouteCount);
      for (let i = 0; i < traceCount; i += 1) {
        const seed = Visuals.stableUnit(`${scene.placeId}:route-trace:${i}`);
        const travel = amount ? (timestamp * (0.025 + i * 0.003) + seed * width) % (width + 140) : seed * width;
        const x = travel - 70;
        const y = 430 + (i % 2) * 38;
        const actor = { id: `trace-${i}`, color: 'rgba(223,232,235,0.72)', phase: seed * 6, scale: 0.55 };
        this.drawVisualPerson(ctx, actor, x, y, timestamp / 520 + i, amount, false);
      }
      if (scene.playerHere || scene.activeTravel) {
        const baseProgress = scene.activeTravel ? scene.activeTravel.progress : 0.52;
        const x = 90 + baseProgress * 780 + Math.sin(timestamp / 660) * 8 * amount;
        const actor = { id: 'player', color: '#8be0af', phase: 0, scale: 0.78 };
        this.drawVisualPerson(ctx, actor, x, 454, timestamp / 560, amount, true);
      }

      ctx.fillStyle = 'rgba(220,232,233,0.74)';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Anonymous walkers are recent public route traces, not continuous resident tracking.', 24, height - 28);
    },

    drawVisualFrameText(ctx, scene, motion, width, height) {
      ctx.fillStyle = 'rgba(8,13,18,0.62)';
      roundedRect(ctx, 18, 18, 340, 58, 12);
      ctx.fill();
      ctx.fillStyle = '#86d0a7';
      ctx.font = '800 10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${scene.kind.toUpperCase()} · ${motion.toUpperCase()} · NON-AUTHORITATIVE`, 32, 40);
      ctx.fillStyle = '#eff4f2';
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.fillText(abbreviate(scene.title, 35), 32, 63, 310);
      ctx.fillStyle = 'rgba(234,241,241,0.56)';
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('NO TIME · NO NEED COST · NO WATCHING REWARD', width - 20, height - 12);
    },

    startMapLoop(world) {
      const canvas = document.getElementById('townCanvas') || document.getElementById('streetCanvas');
      if (!canvas) return;
      const pointerHandler = (event) => this.handleMapPointer(event, canvas);
      canvas.addEventListener('click', pointerHandler, { once: false });
      if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('static') === '1') {
        this.drawTownCanvas(world, canvas, 0);
        return;
      }
      const draw = (timestamp) => {
        if (!['town', 'street'].includes(Game.world.ui.activeTab) || !(document.getElementById('townCanvas') || document.getElementById('streetCanvas'))) return;
        if (timestamp - this.mapLastDraw > 180) {
          this.drawTownCanvas(Game.world, canvas, timestamp);
          this.mapLastDraw = timestamp;
        }
        this.mapFrame = requestAnimationFrame(draw);
      };
      this.mapFrame = requestAnimationFrame(draw);
    },

    cancelMapLoop() {
      if (this.mapFrame) cancelAnimationFrame(this.mapFrame);
      this.mapFrame = null;
    },

    handleMapPointer(event, canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (960 / rect.width);
      const y = (event.clientY - rect.top) * (650 / rect.height);
      const hit = this.mapHitboxes.slice().reverse().find((box) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h);
      if (hit) Game.selectPlace(hit.id);
    },

    drawTownCanvas(world, canvas, timestamp) {
      const logicalW = 960;
      const logicalH = 650;
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      const desiredW = Math.round(logicalW * dpr);
      const desiredH = Math.round(logicalH * dpr);
      if (canvas.width !== desiredW || canvas.height !== desiredH) {
        canvas.width = desiredW;
        canvas.height = desiredH;
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, logicalW, logicalH);
      const tileW = logicalW / world.map.width;
      const tileH = logicalH / world.map.height;
      const pulse = (Math.sin(timestamp / 520) + 1) / 2;

      const gradient = ctx.createLinearGradient(0, 0, 0, logicalH);
      gradient.addColorStop(0, '#1d3029');
      gradient.addColorStop(1, '#17251f');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, logicalW, logicalH);

      ctx.fillStyle = '#1f4652';
      ctx.fillRect(0, 0, logicalW, tileH * 0.58);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 18; i += 1) {
        const waveX = i * 65 + ((timestamp / 80) % 65);
        ctx.fillRect(waveX - 65, tileH * 0.28 + Math.sin(i) * 4, 26, 2);
      }

      ctx.fillStyle = '#3a4248';
      ctx.fillRect(0, tileH * 5.05, logicalW, tileH * 1.65);
      ctx.fillRect(tileW * 8.35, tileH * 0.5, tileW * 1.15, logicalH - tileH * 0.5);
      ctx.fillStyle = 'rgba(239,220,158,0.22)';
      for (let x = 0; x < logicalW; x += 48) ctx.fillRect(x + 5, tileH * 5.82, 24, 3);
      for (let y = 42; y < logicalH; y += 48) ctx.fillRect(tileW * 8.88, y, 3, 22);

      ctx.fillStyle = '#45694c';
      for (let i = 0; i < 42; i += 1) {
        const x = (Core.hashString(`${world.seed}:tree-x:${i}`) % 930) + 15;
        const y = (Core.hashString(`${world.seed}:tree-y:${i}`) % 595) + 40;
        if ((y > tileH * 5 && y < tileH * 6.7) || (x > tileW * 8.2 && x < tileW * 9.7)) continue;
        ctx.beginPath();
        ctx.arc(x, y, 3 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }

      const network = world.streetNetwork;
      if (network?.edges?.length) {
        ctx.save();
        ctx.lineCap = 'round';
        network.edges.filter((edge) => edge.kind !== 'frontage').forEach((edge) => {
          const from = Exteriors.networkNode(world, edge.from);
          const to = Exteriors.networkNode(world, edge.to);
          if (!from || !to) return;
          ctx.beginPath();
          ctx.moveTo(from.x * tileW, from.y * tileH);
          ctx.lineTo(to.x * tileW, to.y * tileH);
          ctx.lineWidth = edge.kind === 'passage' ? 5 : 7;
          ctx.strokeStyle = edge.kind === 'passage' ? 'rgba(189,196,185,0.34)' : 'rgba(215,200,157,0.42)';
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(from.x * tileW, from.y * tileH);
          ctx.lineTo(to.x * tileW, to.y * tileH);
          ctx.lineWidth = 1.2;
          ctx.setLineDash(edge.kind === 'passage' ? [4, 5] : [10, 8]);
          ctx.strokeStyle = edge.kind === 'passage' ? 'rgba(242,245,238,0.52)' : 'rgba(255,242,193,0.58)';
          ctx.stroke();
          ctx.setLineDash([]);
        });
        (network.lanes || []).forEach((lane) => {
          ctx.fillStyle = 'rgba(245,244,230,0.52)';
          ctx.font = '700 9px system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(lane.name, 12, lane.y * tileH - 5);
        });
        ctx.restore();
      }

      const previewRoute = Exteriors.previewRoute(world, world.ui.selectedPlaceId || world.player.locationId);
      const drawRoute = (route, active = false) => {
        if (!route?.nodeIds?.length) return;
        ctx.save();
        ctx.beginPath();
        route.nodeIds.forEach((nodeId, index) => {
          const node = Exteriors.networkNode(world, nodeId);
          if (!node) return;
          const px = node.x * tileW;
          const py = node.y * tileH;
          if (index === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.lineWidth = active ? 5 : 3;
        ctx.strokeStyle = active ? 'rgba(130,183,154,0.95)' : 'rgba(188,169,228,0.86)';
        if (!active) ctx.setLineDash([9, 7]);
        ctx.shadowColor = active ? 'rgba(130,183,154,0.45)' : 'rgba(188,169,228,0.32)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      };
      if (previewRoute) drawRoute(previewRoute, Boolean(previewRoute.active));

      const recentRouteRecords = (world.travelRecords || []).filter((record) => record.actorId !== 'player' && record.status !== 'active').slice(-7);
      recentRouteRecords.forEach((record, routeIndex) => {
        if (!record.route?.nodeIds?.length) return;
        const fraction = ((timestamp / 2600) + (Core.hashString(record.id) % 100) / 100 + routeIndex * 0.09) % 1;
        const position = routePoint(world, record.route.nodeIds, fraction);
        if (!position) return;
        ctx.beginPath();
        ctx.arc(position.x * tileW, position.y * tileH, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(237,242,244,0.68)';
        ctx.fill();
      });

      this.mapHitboxes = [];
      world.places.forEach((place) => {
        const x = place.x * tileW + 5;
        const y = place.y * tileH + 5;
        const w = place.w * tileW - 10;
        const h = place.h * tileH - 10;
        this.mapHitboxes.push({ id: place.id, x, y, w, h });
        const selected = world.ui.selectedPlaceId === place.id;
        const vacancy = (place.kind === 'residential' && place.tenants.length < place.capacity) || (place.kind === 'commercial' && place.listedForLease);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.28)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;
        roundedRect(ctx, x, y, w, h, 9);
        ctx.fillStyle = place.color || '#758590';
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = selected ? 4 : vacancy ? 2.5 : 1.2;
        ctx.strokeStyle = selected ? '#bca9e4' : vacancy ? '#e1b95f' : 'rgba(255,255,255,0.28)';
        if (vacancy && !selected) ctx.setLineDash([7, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        const exterior = place.exterior;
        if (exterior) {
          const contrast = Core.contrastingText(place.color || '#758590');
          ctx.strokeStyle = Core.mixHex(place.color || '#758590', '#101820', 0.5);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 5, y + 5);
          ctx.lineTo(x + w - 5, y + 5);
          ctx.stroke();
          const windowCount = Math.max(1, Math.min(6, exterior.facade.windowCount || 1));
          const windowWidth = Math.max(5, Math.min(11, (w - 18) / windowCount - 3));
          for (let wi = 0; wi < windowCount; wi += 1) {
            const wx = x + 9 + wi * ((w - 18) / windowCount);
            const wy = y + Math.max(12, h * 0.25);
            ctx.fillStyle = world.time.hour >= 18 || world.time.hour < 7 ? 'rgba(244,211,132,0.72)' : 'rgba(190,220,225,0.62)';
            ctx.fillRect(wx, wy, windowWidth, Math.max(5, Math.min(10, h * 0.16)));
            ctx.strokeStyle = 'rgba(20,28,34,0.45)';
            ctx.lineWidth = 1;
            ctx.strokeRect(wx, wy, windowWidth, Math.max(5, Math.min(10, h * 0.16)));
          }
          const doorW = Math.max(7, Math.min(13, w * 0.18));
          const doorH = Math.max(10, Math.min(19, h * 0.34));
          const doorX = x + w / 2 - doorW / 2;
          const doorY = exterior.entrance.side === 'south' ? y + h - doorH - 2 : y + 2;
          ctx.fillStyle = exterior.entrance.doorColor;
          ctx.fillRect(doorX, doorY, doorW, doorH);
          ctx.strokeStyle = 'rgba(15,21,25,0.65)';
          ctx.strokeRect(doorX, doorY, doorW, doorH);
          if (exterior.facade.signVisible && place.kind !== 'residential' && w > 36) {
            ctx.fillStyle = 'rgba(16,22,27,0.72)';
            ctx.fillRect(x + 6, y + h - 15, w - 12, 10);
            ctx.fillStyle = '#f0eadc';
            ctx.font = '700 7px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(abbreviate(exterior.facade.signText, 16), x + w / 2, y + h - 10, w - 16);
          }
          ctx.fillStyle = contrast;
        }

        ctx.fillStyle = Core.contrastingText(place.color || '#758590');
        ctx.font = `800 ${Math.max(10, Math.min(15, w / 7))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = place.kind === 'residential' ? abbreviate(place.name, 16) : (place.symbol || abbreviate(place.name, 10));
        ctx.fillText(label, x + w / 2, y + h / 2 - 2, w - 8);
        if (place.kind === 'residential') {
          ctx.font = '700 9px system-ui, sans-serif';
          ctx.fillText(`${place.tenants.length}/${place.capacity}`, x + w / 2, y + h - 10);
        } else if (place.kind === 'commercial') {
          ctx.font = '700 8px system-ui, sans-serif';
          ctx.fillText(place.listedForLease ? 'VACANT' : 'ACTIVE', x + w / 2, y + h - 8);
        }
        ctx.restore();
      });

      const peopleByPlace = new Map();
      world.people.forEach((person) => {
        if (!peopleByPlace.has(person.locationId)) peopleByPlace.set(person.locationId, []);
        peopleByPlace.get(person.locationId).push(person);
      });
      if (!world.activeTravel) {
        if (!peopleByPlace.has(world.player.locationId)) peopleByPlace.set(world.player.locationId, []);
        peopleByPlace.get(world.player.locationId).unshift(world.player);
      }

      peopleByPlace.forEach((people, placeId) => {
        const place = World.getPlace(world, placeId);
        if (!place) return;
        const centerX = (place.x + place.w / 2) * tileW;
        const centerY = (place.y + place.h / 2) * tileH;
        people.slice(0, 10).forEach((person, index) => {
          const angle = (index / Math.max(1, people.length)) * Math.PI * 2 + timestamp / 4000 + (Core.hashString(person.id) % 20) / 10;
          const radius = 11 + (index % 3) * 5;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius + 6;
          const player = person.id === 'player';
          ctx.beginPath();
          ctx.arc(x, y, player ? 5.5 + pulse * 1.4 : 3.6, 0, Math.PI * 2);
          ctx.fillStyle = player ? '#82b79a' : '#edf2f4';
          ctx.fill();
          ctx.lineWidth = player ? 2 : 1;
          ctx.strokeStyle = player ? '#173429' : 'rgba(20,25,30,0.7)';
          ctx.stroke();
        });
      });

      if (world.activeTravel) {
        const activeRecord = Exteriors.recordById(world, world.activeTravel.recordId);
        const nodeId = activeRecord?.route?.nodeIds?.[activeRecord.currentNodeIndex || 0];
        const node = Exteriors.networkNode(world, nodeId);
        if (node) {
          ctx.beginPath();
          ctx.arc(node.x * tileW, node.y * tileH, 6 + pulse * 1.4, 0, Math.PI * 2);
          ctx.fillStyle = '#82b79a';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#173429';
          ctx.stroke();
        }
      }

      ctx.fillStyle = 'rgba(255,255,255,0.62)';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Day ${world.time.day} · ${Core.weekdayName(world.time.day)} · ${Core.formatClock(world)}`, 14, logicalH - 14);
    }
  };

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

  function lifeContextLabel(world, person) {
    if (!person) return 'Unknown life chapter';
    const stage = person.lifeCourse?.stage || Family.stageForAge(person.age);
    const chapter = `${Core.titleCase(stage)} chapter`;
    return world.settings?.showExactAges ? `${chapter} · age ${person.age}` : `${chapter} · no age countdown`;
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function abbreviate(text, max) {
    const value = String(text || '');
    return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
  }

  function signedDelta(value) {
    const amount = Number(value) || 0;
    return amount > 0 ? `+${Core.round(amount, 1)}` : String(Core.round(amount, 1));
  }

  function compactDuration(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(total / 60);
    const remainder = total % 60;
    if (!hours) return `${remainder}m`;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  }

  function summarizeEvidence(value) {
    if (value == null) return '';
    if (typeof value !== 'object') return String(value);
    const entries = Object.entries(value).slice(0, 8).map(([key, item]) => {
      if (item && typeof item === 'object') return `${Core.titleCase(key)}: ${JSON.stringify(item).slice(0, 100)}`;
      return `${Core.titleCase(key)}: ${item}`;
    });
    return entries.join(' · ');
  }

  function routePoint(world, nodeIds, fraction) {
    const nodes = (nodeIds || []).map((id) => Exteriors.networkNode(world, id)).filter(Boolean);
    if (!nodes.length) return null;
    if (nodes.length === 1) return nodes[0];
    const lengths = [];
    let total = 0;
    for (let index = 1; index < nodes.length; index += 1) {
      const dx = nodes[index].x - nodes[index - 1].x;
      const dy = nodes[index].y - nodes[index - 1].y;
      const length = Math.sqrt(dx * dx + dy * dy);
      lengths.push(length);
      total += length;
    }
    let cursor = Core.clamp(fraction, 0, 1) * total;
    for (let index = 0; index < lengths.length; index += 1) {
      if (cursor <= lengths[index] || index === lengths.length - 1) {
        const t = lengths[index] ? cursor / lengths[index] : 0;
        return {
          x: nodes[index].x + (nodes[index + 1].x - nodes[index].x) * t,
          y: nodes[index].y + (nodes[index + 1].y - nodes[index].y) * t
        };
      }
      cursor -= lengths[index];
    }
    return nodes[nodes.length - 1];
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => UI.init());
  else UI.init();

  AXM.UI = UI;
}(typeof window !== 'undefined' ? window : globalThis));
