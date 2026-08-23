(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  const Core = AXM.Core;
  const Content = AXM.Content;
  const Career = AXM.CareerSkills;

  if (!Core || !Content || !Career) throw new Error('Living City career UI requires Core, Content and CareerSkills.');
  if (AXM.CareerUI) return;

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

  function requirementText(job, world) {
    const eligibility = Career.jobEligibility(world, job.id);
    return Object.entries(eligibility.requirements || {})
      .map(([key, value]) => `${Core.titleCase(key)} ${value}`)
      .join(' · ');
  }

  function skillMixText(job) {
    return Object.entries(job.skillProfile || { [job.primarySkill]: 1 })
      .sort((a, b) => b[1] - a[1])
      .map(([key, weight]) => `${Core.titleCase(key)} ${Math.round(weight * 100)}%`)
      .join(' · ');
  }

  function renderSkillEvidence(world) {
    const state = Career.peekState(world);
    return `<section class="card"><div class="card-inner stack">
      <div class="proposal-head"><div><h3>Transferable skills</h3><p>Skills grow through things you actually do, then travel with you between jobs. They never decay because you chose another direction.</p></div><span class="pill good">No skill decay</span></div>
      <div class="grid-3">${Career.SKILL_DEFINITIONS.map((definition) => {
        const value = Core.safeNumber(world.player.skills?.[definition.id], 0);
        const evidence = state.skillEvidence?.[definition.id] || { events: 0, hours: 0, totalGain: 0, sources: [] };
        const latest = (evidence.sources || []).slice(-2).reverse();
        return `<article class="stat-card">
          <span class="stat-label">${escapeHtml(definition.name)}</span>
          <span class="stat-value">${Core.round(value, 1)}</span>
          <div class="meter"><span style="--value:${Core.clamp(value, 0, 100)}%"></span></div>
          <div class="stat-note"><strong>${escapeHtml(Career.skillTier(value))}</strong> · ${evidence.events || 0} evidenced practice event${evidence.events === 1 ? '' : 's'}</div>
          <p class="muted small-text">${escapeHtml(definition.description)}</p>
          ${latest.length ? `<div class="history-list">${latest.map((entry) => `<div class="history-entry"><div class="meta">Day ${entry.day} · +${Core.round(entry.gain, 2)}</div><div class="message">${escapeHtml(entry.label)}</div></div>`).join('')}</div>` : `<div class="causes">Ways to grow: ${definition.routes.map(escapeHtml).join(' · ')}</div>`}
        </article>`;
      }).join('')}</div>
    </div></section>`;
  }

  function renderCurrentJobDepth(world) {
    const job = Content.jobById(world.player.jobId);
    if (!job) return '';
    const record = Career.jobRecord(world, job.id, false);
    const fit = Career.jobFit(world, job.id);
    const taskEntries = Object.entries(record?.tasks || {}).sort((a, b) => b[1] - a[1]);
    return `<section class="card"><div class="card-inner stack">
      <div class="proposal-head"><div><h3>Your history with ${escapeHtml(job.name)}</h3><p>Practice is preserved per job. Leaving and returning does not erase what you already learned here.</p></div><span class="pill info">${escapeHtml(Career.practiceStage(record))}</span></div>
      <div class="grid-4">
        <div class="metric-card"><span>Worked</span><strong>${Core.round(record?.hours || 0, 1)}h</strong><small>${record?.shifts || 0} completed shifts</small></div>
        <div class="metric-card"><span>Entered / compressed</span><strong>${record?.interactiveShifts || 0} / ${record?.compressedShifts || 0}</strong><small>Both remain valid work modes.</small></div>
        <div class="metric-card"><span>Skill fit</span><strong>${fit.score}/100</strong><small>${escapeHtml(fit.band)} · descriptive, not destiny.</small></div>
        <div class="metric-card"><span>Recorded pay</span><strong>${Core.formatMoney(record?.totalPayObserved || 0)}</strong><small>Evidence only; no hidden promotion ladder.</small></div>
      </div>
      <div class="grid-2">
        <div class="subtle-card"><strong>Transferable skill mix</strong><p>${escapeHtml(skillMixText(job))}</p><div class="pill-row">${Object.entries(job.entryRequirements || {}).map(([key, value]) => `<span class="pill">${escapeHtml(Core.titleCase(key))} ${value} entry</span>`).join('')}</div></div>
        <div class="subtle-card"><strong>Ways you have worked here</strong>${taskEntries.length ? `<div class="pill-row">${taskEntries.slice(0, 8).map(([taskId, count]) => { const task = job.actions.find((entry) => entry.id === taskId); return `<span class="pill">${escapeHtml(task?.name || taskId)} ×${count}</span>`; }).join('')}</div>` : '<p class="muted small-text">No entered task history yet. Compressed work still counts as real completed work.</p>'}</div>
      </div>
      <div class="callout">There is no mandatory promotion, career deadline, prestige track, or “wrong” job. Deep experience makes your history richer; it does not make changing direction a failure.</div>
    </div></section>`;
  }

  function renderCareerDepth(world) {
    return `<div class="stack" style="margin-top:16px">
      ${renderCurrentJobDepth(world)}
      ${renderSkillEvidence(world)}
    </div>`;
  }

  function renderJobCard(world, job) {
    const eligibility = Career.jobEligibility(world, job.id);
    const fit = Career.jobFit(world, job.id);
    const record = Career.jobRecord(world, job.id, false);
    const current = world.player.jobId === job.id;
    const styles = Array.from(new Set((job.actions || []).map((action) => action.style).filter(Boolean)));
    return `<article class="job-card ${current ? 'selected' : ''}">
      <div class="job-head"><div><h4>${escapeHtml(job.name)}</h4><p>${escapeHtml(job.summary)}</p></div><span class="pill ${eligibility.ok ? 'good' : 'warn'}">${Core.formatMoney(job.wage)}/h</span></div>
      <div class="pill-row" style="margin-top:8px">
        <span class="pill info">${escapeHtml(fit.band)} · ${fit.score}</span>
        <span class="pill">${job.hours}h</span>
        <span class="pill">${escapeHtml(Core.titleCase(job.family || 'work'))}</span>
        ${record ? `<span class="pill good">${escapeHtml(Career.practiceStage(record))}</span>` : ''}
      </div>
      <div class="causes">Entry: ${escapeHtml(requirementText(job, world))}</div>
      <div class="causes">Skill mix: ${escapeHtml(skillMixText(job))}</div>
      ${styles.length ? `<div class="pill-row">${styles.map((style) => `<span class="pill">${escapeHtml(Core.titleCase(style))}</span>`).join('')}</div>` : ''}
      <div class="job-actions">${current ? '<span class="pill good">Current job</span>' : `<button class="button small ${eligibility.ok ? 'primary' : ''}" data-action="apply-job" data-id="${escapeAttr(job.id)}" ${eligibility.ok ? '' : 'disabled'}>${eligibility.ok ? 'Take job' : escapeHtml(eligibility.reason)}</button>`}</div>
    </article>`;
  }

  const CareerUI = Object.freeze({
    renderSkillEvidence,
    renderCurrentJobDepth,
    renderCareerDepth,
    renderJobCard
  });
  AXM.CareerUI = CareerUI;

  if (AXM.UI && !AXM.UI.__careerSkillsPatched) {
    const UI = AXM.UI;
    const originalRenderWork = UI.renderWork;
    UI.renderWork = function renderWorkWithCareerDepth(world) {
      return `${originalRenderWork.call(this, world)}${renderCareerDepth(world)}`;
    };
    UI.renderJobCard = function renderJobCardWithCareerDepth(world, job) {
      return renderJobCard(world, job);
    };
    UI.__careerSkillsPatched = true;
  }
}(typeof window !== 'undefined' ? window : globalThis));