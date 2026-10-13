(function registerEventsModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Events.');
  const CORE = SLINK.core.events;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  }

  function relativeTime(timestamp) {
    if (!Number(timestamp)) return 'not checked yet';
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
    return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
  }

  function dateTime(timestamp) {
    if (!Number(timestamp)) return 'Schedule not published';
    return new Intl.DateTimeFormat(undefined, {
      timeZone:'UTC', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false
    }).format(new Date(Number(timestamp))) + ' TCT';
  }

  function countdown(timestamp) {
    if (!Number(timestamp)) return '';
    const ms = Number(timestamp) - Date.now();
    if (ms <= 0) return 'Now';
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    const minutes = Math.ceil((ms % 3_600_000) / 60_000);
    return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  SLINK.modules.register({
    id:'events',
    title:'Events',
    shortTitle:'Events',
    group:'quality-of-life',
    groupTitle:'Quality of Life',
    requiredScopes:[CORE.SCOPE],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      const root = ui.getContentElement();
      let data = null;
      let busy = false;
      let notice = '';

      ui.setModuleStyles(`
        .slink-events{display:grid;gap:9px}.slink-event-card{padding:10px;border:1px solid var(--slink-border-soft);border-radius:9px;background:var(--slink-bg-control)}
        .slink-event-head,.slink-event-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
        .slink-event-picker{display:grid;gap:5px;margin-top:9px}.slink-event-picker select{width:100%;min-height:42px}
        .slink-event-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px}
        .slink-event-stat{padding:8px;border:1px solid var(--slink-border-soft);border-radius:7px}.slink-event-stat strong,.slink-event-stat small{display:block}.slink-event-stat small{color:var(--slink-muted)}
        .slink-event-status{text-transform:capitalize}.slink-event-progress{border-left:3px solid var(--slink-warning)}
        @media(max-width:620px){.slink-event-stats{grid-template-columns:1fr}}
      `);

      function render() {
        const calendar = data?.calendar;
        const selected = data?.selected;
        if (!calendar?.events?.length || !selected) {
          root.innerHTML = `<div class="slink-events"><article class="slink-event-card"><div class="slink-event-head"><div><strong>Torn Events</strong><small>Official Torn calendar data with personal start times when available.</small></div><button type="button" data-events-refresh>${busy ? 'Checking…' : 'Refresh'}</button></div><p>${escapeHtml(data?.lastError || 'Refresh to load Torn’s current event calendar.')}</p></article></div>`;
          return;
        }
        root.innerHTML = `<div class="slink-events">
          <article class="slink-event-card"><div class="slink-event-head"><div><strong>Torn Events</strong><small>Updated ${relativeTime(data.fetchedAt)} · one permission covers every event</small></div><button type="button" data-events-refresh>${busy ? 'Checking…' : 'Refresh'}</button></div>
            ${data.lastError ? `<p>${escapeHtml(data.lastError)}</p>` : ''}${notice ? `<p>${escapeHtml(notice)}</p>` : ''}
            <label class="slink-event-picker">Choose event<select data-events-select>${calendar.events.map(event => `<option value="${escapeHtml(event.id)}" ${event.id === selected.id ? 'selected' : ''}>${escapeHtml(event.name)} · ${escapeHtml(event.state)}</option>`).join('')}</select></label>
          </article>
          <article class="slink-event-card"><div class="slink-event-head"><div><strong>${escapeHtml(selected.name)}</strong><small class="slink-event-status">${escapeHtml(selected.state)}${selected.personalized ? ' · personalized Torn start time' : ''}</small></div><a href="${CORE.CALENDAR_URL}">Open Torn calendar</a></div>
            <div class="slink-event-stats"><div class="slink-event-stat"><strong>${escapeHtml(dateTime(selected.startAt))}</strong><small>Starts${selected.startAt > Date.now() ? ' · ' + escapeHtml(countdown(selected.startAt)) : ''}</small></div><div class="slink-event-stat"><strong>${escapeHtml(dateTime(selected.endAt))}</strong><small>Ends</small></div><div class="slink-event-stat"><strong>${calendar.events.length}</strong><small>Events currently published</small></div></div>
            ${selected.description ? `<p>${escapeHtml(selected.description)}</p>` : ''}
          </article>
          <article class="slink-event-card slink-event-progress"><strong>Event guide in progress</strong><p>Event-specific guides, preparation checklists, and SLINK best practices will be added here later. The framework is ready; this update does not guess at unfinished guidance.</p></article>
        </div>`;
      }

      async function load(force = false) {
        if (busy) return;
        busy = true; notice = ''; render();
        try {
          data = await SLINK.core.messaging.send(force ? 'events.refresh' : 'events.status', { refreshIfDue:true });
          ui.setStatus(data.lastError || 'Torn event calendar ready.', data.lastError ? 'error' : 'ready');
        } catch (error) {
          notice = SLINK.core.format.errorMessage(error);
          ui.setStatus(notice, 'error');
        } finally { busy = false; render(); }
      }

      root.addEventListener('click', event => {
        if (event.target.closest('[data-events-refresh]')) void load(true);
      });

      root.addEventListener('change', async event => {
        const select = event.target.closest('[data-events-select]');
        if (!select) return;
        select.disabled = true;
        try {
          data = await SLINK.core.messaging.send('events.selection.save', { id:select.value });
          notice = '';
        } catch (error) { notice = SLINK.core.format.errorMessage(error); }
        render();
      });

      await load(false);
      return { stop() {} };
    }
  });
})(globalThis);
