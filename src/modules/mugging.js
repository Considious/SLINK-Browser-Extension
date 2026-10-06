(function registerMugging(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const SETTINGS_KEY = 'mugging.settings.v1';
  const CACHE_KEY = 'mugging.cache.v1';
  const REQUIRED_SCOPE = 'slink.mugging';
  const MODULE_STYLES = `
    .mugging-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; }
    .mugging-stat { padding:7px; border-radius:6px; background:#202c39; text-align:center; }
    .mugging-stat b { display:block; font-size:13px; }
    .mugging-stat span { color:#8fa3b6; font-size:9px; }
    .mugging-note { padding:8px; border-radius:6px; background:#202c39; color:#b9dcfb; }
    .mugging-controls { display:grid; gap:7px; padding:8px; border:1px solid rgba(255,255,255,.1); border-radius:7px; background:#111821; }
    .mugging-check { display:flex; align-items:flex-start; gap:7px; color:#edf7ff; }
    .mugging-target { padding:8px 0; border-top:1px solid rgba(255,255,255,.08); }
    .mugging-head,.mugging-meta,.mugging-actions { display:flex; flex-wrap:wrap; align-items:center; gap:5px; }
    .mugging-head a { min-width:0; flex:1; overflow:hidden; color:#fff; font-weight:700; text-decoration:none; text-overflow:ellipsis; white-space:nowrap; }
    .mugging-meta { margin-top:4px; color:#9eb0c2; }
    .mugging-badge { padding:1px 5px; border-radius:8px; background:#303e4d; color:#e3edf6; }
    .mugging-actions { margin-top:6px; }
    .mugging-actions a,.mugging-actions button { min-height:28px; padding:4px 7px; border:1px solid rgba(255,255,255,.15); border-radius:5px; background:#2b3745; color:#fff; text-decoration:none; }
    .mugging-empty { padding:14px 3px; color:#9eb0c2; text-align:center; }
  `;

  function escape(value) { return SLINK.core.format.escapeHtml(String(value ?? '')); }
  function normalizeSettings(value = {}) { return { enabled:value.enabled === true }; }
  function normalizeCache(value = {}) {
    return {
      updatedAt:Math.max(0, Number(value.updatedAt) || 0),
      targets:(Array.isArray(value.targets) ? value.targets : []).map(target => ({
        id:Math.max(0, Math.trunc(Number(target?.id ?? target?.playerId) || 0)),
        name:String(target?.name || '').trim(),
        status:target?.status && typeof target.status === 'object' ? target.status : null,
        fairFight:Number.isFinite(Number(target?.fairFight)) ? Number(target.fairFight) : null,
        battleStatsEstimate:Number.isFinite(Number(target?.battleStatsEstimate)) ? Number(target.battleStatsEstimate) : null,
        bountyCount:Math.max(0, Math.trunc(Number(target?.bountyCount) || 0)),
        bountyTotal:Math.max(0, Number(target?.bountyTotal) || 0),
        confidence:String(target?.confidence || '')
      })).filter(target => target.id > 0)
    };
  }
  function statusLabel(target) {
    const state = String(target?.status?.state || target?.status?.label || 'Unknown');
    const until = Number(target?.status?.until) || 0;
    if (until > Date.now() / 1000 && ['Hospital', 'Jail', 'Traveling'].includes(state)) {
      return `${state} · ${SLINK.core.format.formatHumanDuration(Math.ceil(until - Date.now() / 1000))}`;
    }
    return state;
  }

  SLINK.modules.register({
    id:'mugging',
    title:'SLINK Mugging',
    shortTitle:'Mugging',
    group:'combat',
    groupTitle:'Combat',
    defaultShowInTorn:true,
    requiredScopes:[REQUIRED_SCOPE],
    matches:url => url.hostname === 'www.torn.com',

    async start(context) {
      let settings = normalizeSettings(await SLINK.core.storage.get(SETTINGS_KEY, {}));
      let cache = normalizeCache(await SLINK.core.storage.get(CACHE_KEY, {}));
      let notice = '';
      context.ui.setTitle('SLINK Mugging');
      context.ui.setModuleStyles(MODULE_STYLES);

      function targetsHtml() {
        if (!cache.targets.length) return '<div class="mugging-empty">No cached Mugging assignments yet. Rough Fair Fight assignment is introduced in Phase 8; this Phase 7 interface performs no Mugging API calls.</div>';
        return cache.targets.map(target => {
          const profile = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(target.id)}`;
          const attack = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(target.id)}`;
          return `<article class="mugging-target">
            <div class="mugging-head"><a href="${profile}">${escape(target.name || `Player ${target.id}`)} [${target.id}]</a></div>
            <div class="mugging-meta">
              <span class="mugging-badge">${escape(statusLabel(target))}</span>
              <span class="mugging-badge">FF ${target.fairFight === null ? '?' : target.fairFight.toFixed(2)}</span>
              <span class="mugging-badge">BS ${target.battleStatsEstimate === null ? '?' : escape(SLINK.core.format.shortNumber(target.battleStatsEstimate))}</span>
              ${target.bountyCount ? `<span class="mugging-badge">${target.bountyCount} bounties · $${target.bountyTotal.toLocaleString()}</span>` : ''}
              ${target.confidence ? `<span class="mugging-badge">${escape(target.confidence)}</span>` : ''}
            </div>
            <div class="mugging-actions"><a href="${profile}">Profile</a><a href="${attack}">Attack</a><button type="button" data-mugging-save="${target.id}">Save Target</button></div>
          </article>`;
        }).join('');
      }

      function render() {
        context.ui.setSubtitle(settings.enabled ? 'Testing access enabled' : 'Disabled locally');
        context.ui.setStatus(settings.enabled ? 'Mugging permission granted.' : 'Mugging is available but disabled on this device.', settings.enabled ? 'ready' : 'normal');
        context.ui.setActions([{ id:'refresh', label:'Refresh cache', onClick:async () => {
          cache = normalizeCache(await SLINK.core.storage.get(CACHE_KEY, {}));
          notice = 'Cached Mugging data refreshed.';
          render();
        } }]);
        context.ui.setContentHtml(`
          <div class="mugging-summary">
            <div class="mugging-stat"><b>${cache.targets.length}</b><span>Cached targets</span></div>
            <div class="mugging-stat"><b>10/min</b><span>Future active budget</span></div>
            <div class="mugging-stat"><b>5/min</b><span>Future inactive budget</span></div>
          </div>
          <div class="mugging-controls">
            <label class="mugging-check"><input id="mugging-enabled" type="checkbox" ${settings.enabled ? 'checked' : ''}><span>Enable Mugging on this device</span></label>
            <div class="mugging-note">Phase 7 establishes the permission and interface only. It does not assign targets or begin contributor polling. Cached results are retained when disabled.</div>
            ${notice ? `<div class="mugging-note">${escape(notice)}</div>` : ''}
          </div>
          <div>${targetsHtml()}</div>
        `);
        bind();
      }

      function bind() {
        const root = context.ui.getContentElement();
        root.querySelector('#mugging-enabled')?.addEventListener('change', async event => {
          settings = normalizeSettings({ enabled:event.target.checked });
          await SLINK.core.storage.set(SETTINGS_KEY, settings);
          notice = settings.enabled ? 'Mugging enabled locally.' : 'Mugging disabled locally; cached results were kept.';
          render();
        });
        root.querySelectorAll('[data-mugging-save]').forEach(button => button.addEventListener('click', async () => {
          const target = cache.targets.find(row => row.id === Number(button.dataset.muggingSave));
          if (!target) return;
          button.disabled = true;
          try {
            await SLINK.core.messaging.send('targetList.add', {
              playerId:target.id, name:target.name, tags:['Mug'],
              source:'mugging', sourceLabel:'Mugging', sourceContext:'Cached Mugging assignment',
              status:target.status || undefined
            });
            button.textContent = 'Saved';
          } catch (error) {
            button.textContent = 'Save failed';
            button.title = SLINK.core.format.errorMessage(error);
          } finally {
            global.setTimeout(() => {
              if (!button.isConnected) return;
              button.disabled = false;
              button.textContent = 'Save Target';
            }, 1600);
          }
        }));
      }

      render();
      return { stop() {} };
    }
  });
})(globalThis);
