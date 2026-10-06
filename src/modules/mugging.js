(function registerMugging(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const SETTINGS_KEY = 'mugging.settings.v1';
  const CACHE_KEY = 'mugging.cache.v1';
  const REQUIRED_SCOPE = 'slink.mugging';
  const MODULE_STYLES = `
    .mugging-summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; }
    .mugging-stat { padding:7px; border-radius:6px; background:#202c39; text-align:center; }
    .mugging-stat b { display:block; font-size:13px; }
    .mugging-stat span { color:#8fa3b6; font-size:9px; }
    .mugging-note { padding:8px; border-radius:6px; background:#202c39; color:#b9dcfb; }
    .mugging-controls { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; padding:8px; border:1px solid rgba(255,255,255,.1); border-radius:7px; background:#111821; }
    .mugging-controls label { display:grid; gap:3px; color:#edf7ff; }
    .mugging-controls input { box-sizing:border-box; width:100%; min-width:0; }
    .mugging-controls .mugging-check,.mugging-controls .mugging-wide { grid-column:1/-1; }
    .mugging-check { display:flex!important; align-items:flex-start; gap:7px; }
    .mugging-check input { width:auto; }
    .mugging-target { padding:8px 0; border-top:1px solid rgba(255,255,255,.08); }
    .mugging-head,.mugging-meta,.mugging-actions { display:flex; flex-wrap:wrap; align-items:center; gap:5px; }
    .mugging-head a { min-width:0; flex:1; overflow:hidden; color:#fff; font-weight:700; text-decoration:none; text-overflow:ellipsis; white-space:nowrap; }
    .mugging-meta { margin-top:4px; color:#9eb0c2; }
    .mugging-badge { padding:1px 5px; border-radius:8px; background:#303e4d; color:#e3edf6; }
    .mugging-actions { margin-top:6px; }
    .mugging-actions a,.mugging-actions button,.mugging-controls button { min-height:28px; padding:4px 7px; border:1px solid rgba(255,255,255,.15); border-radius:5px; background:#2b3745; color:#fff; text-decoration:none; }
    .mugging-empty { padding:14px 3px; color:#9eb0c2; text-align:center; }
  `;

  function escape(value) { return SLINK.core.format.escapeHtml(String(value ?? '')); }
  function clamp(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
  }
  function normalizeSettings(value = {}) {
    return {
      enabled:value.enabled === true,
      minFairFight:clamp(value.minFairFight, 1, 3, 1),
      maxFairFight:clamp(value.maxFairFight, 1, 3, 3),
      limit:Math.trunc(clamp(value.limit, 1, 100, 50))
    };
  }
  function normalizeCache(value = {}) {
    return {
      updatedAt:Math.max(0, Number(value.updatedAt ?? value.generated_at) || 0),
      estimateKind:String((value.estimateKind ?? value.estimate_kind) || 'rough'),
      estimateSource:String((value.estimateSource ?? value.estimate_source) || 'cached battle-stat estimate'),
      userBattleStats:Math.max(0, Number(value.userBattleStats ?? value.user_battle_stats) || 0),
      pool:{
        total:Math.max(0, Number(value.pool?.total) || 0),
        estimable:Math.max(0, Number(value.pool?.estimable) || 0),
        eligible:Math.max(0, Number(value.pool?.eligible) || 0)
      },
      contribution:{
        enabled:value.contribution?.enabled === true,
        mode:String(value.contribution?.mode || 'disabled'),
        apiBudgetPerMinute:Math.max(0, Number(value.contribution?.apiBudgetPerMinute) || 0),
        fetched:Math.max(0, Number(value.contribution?.fetched) || 0),
        skipped:Math.max(0, Number(value.contribution?.skipped) || 0),
        errors:Math.max(0, Number(value.contribution?.errors) || 0),
        pendingSync:Math.max(0, Number(value.contribution?.pendingSync) || 0),
        lastSyncAt:Math.max(0, Number(value.contribution?.lastSyncAt) || 0),
        synced:Math.max(0, Number(value.contribution?.synced) || 0),
        syncError:String(value.contribution?.syncError || ''),
        at:Math.max(0, Number(value.contribution?.at) || 0)
      },
      targets:(Array.isArray(value.targets) ? value.targets : []).map(target => ({
        id:Math.max(0, Math.trunc(Number(target?.id ?? target?.playerId) || 0)),
        name:String(target?.name || '').trim(),
        companyName:String((target?.companyName ?? target?.company_name) || ''),
        companyType:String((target?.companyType ?? target?.company_type) || ''),
        companyRating:Math.max(0, Number(target?.companyRating ?? target?.company_rating) || 0),
        position:String(target?.position || ''),
        status:target?.status && typeof target.status === 'object' ? target.status : null,
        fairFight:Number.isFinite(Number(target?.fairFight ?? target?.fair_fight)) ? Number(target?.fairFight ?? target?.fair_fight) : null,
        battleStatsEstimate:Number.isFinite(Number(target?.battleStatsEstimate ?? target?.battle_stats_estimate)) ? Number(target?.battleStatsEstimate ?? target?.battle_stats_estimate) : null,
        estimateKind:String((target?.estimateKind ?? target?.estimate_kind) || 'rough'),
        estimateSource:String((target?.estimateSource ?? target?.estimate_source) || 'cached'),
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
      try {
        cache = normalizeCache(await SLINK.core.messaging.send('mugging.status'));
        if (settings.enabled) await SLINK.core.messaging.send('mugging.activity.touch');
      } catch {}
      let notice = '';
      let error = '';
      let busy = false;
      context.ui.setTitle('SLINK Mugging');
      context.ui.setModuleStyles(MODULE_STYLES);

      async function persistSettings() {
        await SLINK.core.storage.set(SETTINGS_KEY, settings);
      }

      async function refreshAssignments() {
        if (busy) return;
        if (!settings.enabled) {
          error = 'Enable Mugging on this device before requesting assignments.';
          render();
          return;
        }
        busy = true; error = ''; notice = ''; render();
        try {
          cache = normalizeCache(await SLINK.core.messaging.send('mugging.assignments.refresh', settings));
          notice = `Loaded ${cache.targets.length} rough Fair Fight assignments from cached Mugging intelligence.`;
        } catch (caught) {
          error = SLINK.core.format.errorMessage(caught);
        } finally {
          busy = false;
          render();
        }
      }

      function targetsHtml() {
        if (!cache.targets.length) return '<div class="mugging-empty">No rough assignments are cached yet. Enable the module, choose a Fair Fight range, then press Find targets.</div>';
        return cache.targets.map(target => {
          const profile = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(target.id)}`;
          const attack = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(target.id)}`;
          const company = [target.companyName, target.companyRating ? `${target.companyRating}★` : '', target.position].filter(Boolean).join(' · ');
          return `<article class="mugging-target">
            <div class="mugging-head"><a href="${profile}">${escape(target.name || `Player ${target.id}`)} [${target.id}]</a></div>
            <div class="mugging-meta">
              <span class="mugging-badge">${escape(statusLabel(target))}</span>
              <span class="mugging-badge">Rough FF ${target.fairFight === null ? '?' : target.fairFight.toFixed(2)}</span>
              <span class="mugging-badge">Estimated BS ${target.battleStatsEstimate === null ? '?' : escape(SLINK.core.format.shortNumber(target.battleStatsEstimate))}</span>
              ${company ? `<span class="mugging-badge">${escape(company)}</span>` : ''}
              ${target.confidence ? `<span class="mugging-badge">${escape(target.confidence)}</span>` : ''}
            </div>
            <div class="mugging-actions"><a href="${profile}">Profile</a><a href="${attack}">Attack</a><button type="button" data-mugging-save="${target.id}">Save Target</button></div>
          </article>`;
        }).join('');
      }

      function render() {
        context.ui.setSubtitle(settings.enabled ? 'Rough Fair Fight assignments' : 'Disabled locally');
        context.ui.setStatus(error || (settings.enabled ? 'Mugging permission granted.' : 'Mugging is available but disabled on this device.'), error ? 'error' : settings.enabled ? 'ready' : 'normal');
        context.ui.setActions([{ id:'refresh', label:busy ? 'Finding…' : 'Find targets', onClick:refreshAssignments }]);
        context.ui.setContentHtml(`
          <div class="mugging-summary">
            <div class="mugging-stat"><b>${cache.targets.length}</b><span>Assignments</span></div>
            <div class="mugging-stat"><b>${cache.pool.eligible}</b><span>Eligible pool</span></div>
            <div class="mugging-stat"><b>${cache.userBattleStats ? escape(SLINK.core.format.shortNumber(cache.userBattleStats)) : '—'}</b><span>Your BS</span></div>
            <div class="mugging-stat"><b>${escape(cache.contribution.mode)}</b><span>${cache.contribution.fetched}/${cache.contribution.apiBudgetPerMinute || 0} contributor checks</span></div>
          </div>
          <div class="mugging-controls">
            <label class="mugging-check"><input id="mugging-enabled" type="checkbox" ${settings.enabled ? 'checked' : ''}><span>Enable Mugging on this device</span></label>
            <label>Minimum rough FF<input id="mugging-min-ff" type="number" min="1" max="3" step=".1" value="${settings.minFairFight}"></label>
            <label>Maximum rough FF<input id="mugging-max-ff" type="number" min="1" max="3" step=".1" value="${settings.maxFairFight}"></label>
            <label>Target count<input id="mugging-limit" type="number" min="1" max="100" step="1" value="${settings.limit}"></label>
            <button class="mugging-wide" id="mugging-find" type="button" ${busy ? 'disabled' : ''}>${busy ? 'Finding targets…' : 'Find targets'}</button>
            <div class="mugging-note mugging-wide">Contributor checks use the shared Torn limiter: up to 10/min while Mugging was used in the last five minutes, then up to 5/min at low priority. Results are deduplicated locally and synchronized to shared SLINK intelligence in acknowledged batches every six hours. Pending: ${cache.contribution.pendingSync}${cache.contribution.lastSyncAt ? ` · Last sync ${escape(new Date(cache.contribution.lastSyncAt).toLocaleString())}` : ''}${cache.contribution.syncError ? ` · Sync retry pending: ${escape(cache.contribution.syncError)}` : ''}.</div>
            ${error ? `<div class="mugging-note mugging-wide">${escape(error)}</div>` : ''}
            ${notice ? `<div class="mugging-note mugging-wide">${escape(notice)}</div>` : ''}
          </div>
          <div>${targetsHtml()}</div>
        `);
        bind();
      }

      function bind() {
        const root = context.ui.getContentElement();
        root.querySelector('#mugging-enabled')?.addEventListener('change', async event => {
          settings = normalizeSettings({ ...settings, enabled:event.target.checked });
          await persistSettings();
          error = '';
          notice = settings.enabled ? 'Mugging enabled locally; contributor scheduling started.' : 'Mugging disabled locally; cached assignments were kept.';
          if (settings.enabled) {
            await SLINK.core.messaging.send('mugging.activity.touch').catch(() => null);
            void SLINK.core.messaging.send('mugging.contribution.run').then(value => {
              cache = normalizeCache({ ...cache, contribution:value });
              render();
            }).catch(() => null);
          }
          render();
        });
        const saveFilters = async () => {
          settings = normalizeSettings({
            ...settings,
            minFairFight:root.querySelector('#mugging-min-ff')?.value,
            maxFairFight:root.querySelector('#mugging-max-ff')?.value,
            limit:root.querySelector('#mugging-limit')?.value
          });
          await persistSettings();
          if (settings.enabled) await SLINK.core.messaging.send('mugging.activity.touch').catch(() => null);
        };
        root.querySelector('#mugging-min-ff')?.addEventListener('change', saveFilters);
        root.querySelector('#mugging-max-ff')?.addEventListener('change', saveFilters);
        root.querySelector('#mugging-limit')?.addEventListener('change', saveFilters);
        root.querySelector('#mugging-find')?.addEventListener('click', async () => {
          await saveFilters();
          await refreshAssignments();
        });
        root.querySelectorAll('[data-mugging-save]').forEach(button => button.addEventListener('click', async () => {
          const target = cache.targets.find(row => row.id === Number(button.dataset.muggingSave));
          if (!target) return;
          button.disabled = true;
          try {
            await SLINK.core.messaging.send('targetList.add', {
              playerId:target.id, name:target.name, tags:['Mug'],
              source:'mugging', sourceLabel:'Mugging', sourceContext:'Rough Fair Fight assignment',
              status:target.status || undefined,
              fairFight:target.fairFight,
              battleStatsEstimate:target.battleStatsEstimate
            });
            button.textContent = 'Saved';
          } catch (caught) {
            button.textContent = 'Save failed';
            button.title = SLINK.core.format.errorMessage(caught);
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
