(function registerTargetList(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const MODULE_STYLES = `
    .target-list-note,.target-list-error { margin:7px 0; padding:7px; border-radius:6px; background:#202c39; color:#a9d5ff; }
    .target-list-error { background:#432929; color:#ffc0c0; }
    .target-list-form { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin:7px 0; }
    .target-list-form label { display:grid; gap:3px; color:#9eb0c2; }
    .target-list-form input,.target-list-form textarea { min-width:0; padding:6px; border:1px solid #45586b; border-radius:5px; background:#111821; color:#edf7ff; }
    .target-list-form textarea { min-height:64px; resize:vertical; }
    .target-list-form .wide,.target-list-tags,.target-list-form-actions { grid-column:1/-1; }
    .target-list-tags,.target-list-actions,.target-list-meta,.target-list-sources { display:flex; flex-wrap:wrap; gap:5px; align-items:center; }
    .target-list-tags label { display:flex; flex-direction:row; align-items:center; gap:4px; color:#e6f0f8; }
    .target-list-form-actions { display:flex; flex-wrap:wrap; gap:6px; }
    .target-list-entry { padding:9px 0; border-top:1px solid rgba(255,255,255,.08); }
    .target-list-entry:first-child { border-top:0; }
    .target-list-head { display:flex; align-items:center; gap:7px; }
    .target-list-head a { min-width:0; flex:1; overflow:hidden; color:#fff; font-weight:700; text-decoration:none; text-overflow:ellipsis; white-space:nowrap; }
    .target-list-tag,.target-list-badge,.target-list-source { padding:1px 5px; border-radius:8px; background:#303e4d; color:#e3edf6; }
    .target-list-tag { background:#243c54; color:#bde2ff; }
    .target-list-badge[data-state="Hospital"] { background:#522c35; color:#ffc4cc; }
    .target-list-badge[data-state="Okay"] { background:#244b36; color:#b9f3cc; }
    .target-list-description { margin-top:5px; color:#dce8f3; white-space:pre-wrap; }
    .target-list-meta,.target-list-sources { margin-top:5px; color:#9eb0c2; }
    .target-list-actions { margin-top:7px; }
    .target-list-actions a,.target-list-actions button { min-height:28px; padding:4px 7px; border:1px solid rgba(255,255,255,.15); border-radius:5px; background:#2b3745; color:#fff; text-decoration:none; }
    .target-list-empty { padding:15px 4px; color:#9eb0c2; text-align:center; }
    .target-list-polling { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin:8px 0; padding:8px; border:1px solid #45586b; border-radius:7px; background:#111821; }
    .target-list-polling label { display:grid; gap:3px; color:#9eb0c2; }
    .target-list-polling .wide { grid-column:1/-1; }
    .target-list-polling .check { display:flex; align-items:center; gap:6px; color:#e6f0f8; }
    .target-list-polling input[type="number"] { min-width:0; padding:6px; border:1px solid #45586b; border-radius:5px; background:#18222d; color:#edf7ff; }
    .target-list-polling-summary { grid-column:1/-1; color:#9eb0c2; }
    @media (max-width:420px) { .target-list-form,.target-list-polling { grid-template-columns:1fr; } .target-list-form .wide,.target-list-tags,.target-list-form-actions,.target-list-polling .wide,.target-list-polling-summary { grid-column:auto; } }
  `;

  function escape(value) {
    return SLINK.core.format.escapeHtml(String(value ?? ''));
  }

  function elapsed(value) {
    const at = Number(value) || 0;
    if (!at) return 'Never';
    const seconds = Math.max(0, Math.floor((Date.now() - at) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function statusLabel(target) {
    const status = target.status || {};
    if (status.state === 'Hospital' && Number(status.until) > Date.now() / 1000) {
      return `Hospital · ${SLINK.core.format.formatHumanDuration(Math.ceil(Number(status.until) - Date.now() / 1000))}`;
    }
    return status.state || 'Unknown';
  }

  SLINK.modules.register({
    id:'target-list',
    title:'Target List',
    shortTitle:'Targets',
    group:'combat',
    groupTitle:'Combat',
    defaultShowInTorn:true,
    requiredScopes:[],
    matches:url => url.hostname === 'www.torn.com',

    async start(context) {
      let current = { targets:[], availableTags:['Level', 'Mug', 'War', 'Target'] };
      let editingId = null;
      let formOpen = false;
      let pollingOpen = false;
      let busyId = null;
      let localError = '';
      let countdownTimer = null;

      context.ui.setTitle('Target List');
      context.ui.setModuleStyles(MODULE_STYLES);

      function editingTarget() {
        return current.targets.find(target => Number(target.id) === Number(editingId)) || null;
      }

      function formHtml() {
        const target = editingTarget();
        const tags = new Set(target?.tags || ['Target']);
        return `<div class="target-list-form">
          <label>Player ID<input id="target-list-id" type="number" min="1" inputmode="numeric" value="${target?.id || ''}" ${target ? 'disabled' : ''} placeholder="123456"></label>
          <label>Name (optional)<input id="target-list-name" type="text" maxlength="80" value="${escape(target?.name || '')}" placeholder="Player name"></label>
          <label class="wide">Notes<textarea id="target-list-description" maxlength="500" placeholder="Why are you tracking this player?">${escape(target?.description || '')}</textarea></label>
          <div class="target-list-tags">${current.availableTags.map(tag => `<label><input type="checkbox" data-target-list-tag="${escape(tag)}" ${tags.has(tag) ? 'checked' : ''}>${escape(tag)}</label>`).join('')}</div>
          <div class="target-list-form-actions"><button id="target-list-save" type="button">${target ? 'Save changes' : 'Add target'}</button><button id="target-list-cancel" type="button">Cancel</button></div>
        </div>`;
      }

      function pollingHtml() {
        const polling = current.polling || {};
        const settings = polling.settings || {};
        const runtime = polling.runtime || {};
        return `<div class="target-list-polling">
          <label class="wide check"><input id="target-list-poll-enabled" type="checkbox" ${settings.enabled ? 'checked' : ''}>Automatically check saved targets</label>
          <label>Complete each rolling cycle every
            <input id="target-list-poll-interval" type="number" min="1" max="1440" step="1" value="${Number(settings.intervalMinutes) || 10}">
          </label>
          <label class="check"><input id="target-list-poll-mug-only" type="checkbox" ${settings.mugOnly ? 'checked' : ''}>Only auto-check targets tagged Mug</label>
          <div class="target-list-polling-summary">${Number(polling.eligibleCount) || 0} eligible · up to ${Number(polling.estimatedChecksPerMinute) || 0} scheduled checks/min before cache and timer skips${runtime.lastRunAt ? ` · last cycle ${escape(elapsed(runtime.lastRunAt))}` : ''}${runtime.lastError ? ` · ${escape(runtime.lastError)}` : ''}</div>
          <button id="target-list-poll-save" type="button">Save polling</button>
        </div>`;
      }

      function targetHtml(target) {
        const profile = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(target.id)}`;
        const attack = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(target.id)}`;
        return `<article class="target-list-entry" data-target-list-id="${target.id}">
          <div class="target-list-head"><a href="${profile}" data-target-list-profile="${target.id}">${escape(target.name)} [${target.id}]</a><span class="target-list-badge" data-state="${escape(target.status?.state || 'Unknown')}">${escape(statusLabel(target))}</span></div>
          <div class="target-list-tags">${target.tags.map(tag => `<span class="target-list-tag">${escape(tag)}</span>`).join('')}</div>
          ${target.description ? `<div class="target-list-description">${escape(target.description)}</div>` : ''}
          <div class="target-list-meta">
            <span>Observed: ${escape(elapsed(target.lastChecked))}</span>
            ${target.intelligence?.lastDomObservedAt ? `<span>DOM: ${escape(elapsed(target.intelligence.lastDomObservedAt))}</span>` : ''}
            ${target.intelligence?.lastApiCheckAt ? `<span>API: ${escape(elapsed(target.intelligence.lastApiCheckAt))}</span>` : ''}
            ${target.lastSeenMugged ? `<span>Mugged: ${escape(elapsed(target.lastSeenMugged))}</span>` : ''}
            ${target.bountyCount ? `<span>Bounties: ${target.bountyCount} · $${Number(target.bountyTotal).toLocaleString()}</span>` : ''}
          </div>
          <div class="target-list-sources">${target.sources.map(source => `<span class="target-list-source">${escape(source.label || source.source)}</span>`).join('')}</div>
          <div class="target-list-actions">
            <a href="${profile}" data-target-list-profile="${target.id}">Profile</a><a href="${attack}">Attack</a>
            <button type="button" data-target-list-action="refresh" ${busyId === target.id ? 'disabled' : ''}>${busyId === target.id ? 'Refreshing…' : 'Refresh'}</button>
            <button type="button" data-target-list-action="edit">Edit</button>
            <button type="button" data-target-list-action="remove">Remove</button>
          </div>
        </article>`;
      }

      function render() {
        context.ui.setSubtitle(`${current.count || 0} saved target${current.count === 1 ? '' : 's'} · local`);
        context.ui.setStatus(localError || 'Targets are added only when you explicitly save them.', localError ? 'error' : 'ready');
        context.ui.setActions([
          { id:'add', label:formOpen ? 'Close form' : 'Add target', onClick:() => { formOpen = !formOpen; editingId = null; localError = ''; render(); } },
          { id:'polling', label:pollingOpen ? 'Close polling' : 'Polling', onClick:() => { pollingOpen = !pollingOpen; localError = ''; render(); } }
        ]);
        context.ui.setContentHtml(`
          <div class="target-list-note">This list is user-curated. Other SLINK target feeds are not copied here automatically.${current.polling?.settings?.enabled ? ` Rolling checks are spread across ${current.polling.settings.intervalMinutes} minutes.` : ''}</div>
          ${localError ? `<div class="target-list-error">${escape(localError)}</div>` : ''}
          ${formOpen ? formHtml() : ''}
          ${pollingOpen ? pollingHtml() : ''}
          <div>${current.targets.length ? current.targets.map(targetHtml).join('') : '<div class="target-list-empty">No saved targets yet. Use Add target to save one manually.</div>'}</div>
        `);
        bindEvents();
      }

      function bindEvents() {
        const root = context.ui.getContentElement();
        root.querySelectorAll('[data-target-list-profile]').forEach(link => {
          link.addEventListener('click', () => {
            SLINK.core.playerIntelligenceDom.rememberIntent(
              Number(link.dataset.targetListProfile),
              'target-list'
            );
          });
        });
        root.querySelector('#target-list-poll-save')?.addEventListener('click', async () => {
          const button = root.querySelector('#target-list-poll-save');
          if (button) { button.disabled = true; button.textContent = 'Saving…'; }
          try {
            localError = '';
            current = await SLINK.core.messaging.send('targetList.polling.configure', {
              enabled:root.querySelector('#target-list-poll-enabled')?.checked === true,
              intervalMinutes:root.querySelector('#target-list-poll-interval')?.value,
              mugOnly:root.querySelector('#target-list-poll-mug-only')?.checked === true
            });
          } catch (error) {
            localError = SLINK.core.format.errorMessage(error);
          }
          render();
        });
        root.querySelector('#target-list-cancel')?.addEventListener('click', () => {
          formOpen = false; editingId = null; localError = ''; render();
        });
        root.querySelector('#target-list-save')?.addEventListener('click', async () => {
          const playerId = Number(root.querySelector('#target-list-id')?.value || editingId);
          const tags = [...root.querySelectorAll('[data-target-list-tag]:checked')].map(node => node.dataset.targetListTag);
          const payload = {
            playerId,
            name:root.querySelector('#target-list-name')?.value || '',
            description:root.querySelector('#target-list-description')?.value || '',
            tags,
            source:'manual',
            sourceLabel:'Manual'
          };
          try {
            localError = '';
            current = await SLINK.core.messaging.send(editingId ? 'targetList.update' : 'targetList.add', payload);
            formOpen = false; editingId = null;
          } catch (error) { localError = SLINK.core.format.errorMessage(error); }
          render();
        });
        root.querySelectorAll('[data-target-list-action]').forEach(button => {
          button.addEventListener('click', async () => {
            const card = button.closest('[data-target-list-id]');
            const playerId = Number(card?.dataset.targetListId);
            const action = button.dataset.targetListAction;
            if (action === 'edit') {
              editingId = playerId; formOpen = true; localError = ''; render(); return;
            }
            if (action === 'remove' && !global.confirm('Remove this player from Target List?')) return;
            try {
              localError = '';
              if (action === 'remove') current = await SLINK.core.messaging.send('targetList.remove', { playerId });
              if (action === 'refresh') {
                busyId = playerId; render();
                await SLINK.core.playerIntelligenceDom.observeCurrentPage({
                  playerId,
                  source:'target-list',
                  requireIntent:false
                });
                current = await SLINK.core.messaging.send('targetList.refresh', { playerId });
              }
            } catch (error) { localError = SLINK.core.format.errorMessage(error); }
            finally { busyId = null; render(); }
          });
        });
      }

      current = await SLINK.core.messaging.send('targetList.status');
      if (!current.targets.length) formOpen = true;
      countdownTimer = setInterval(render, 30_000);
      render();

      return Object.freeze({
        stop() { clearInterval(countdownTimer); }
      });
    }
  });
})(globalThis);
