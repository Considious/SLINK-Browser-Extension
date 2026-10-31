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
    .mugging-level { border:1px solid rgba(255,255,255,.22); color:#fff; font-weight:800; text-shadow:0 1px 1px rgba(0,0,0,.55); }
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
  function levelBadge(targetLevel, userLevel) {
    const target = Math.max(0, Math.trunc(Number(targetLevel) || 0));
    const own = Math.max(0, Math.trunc(Number(userLevel) || 0));
    if (!target) return '<span class="mugging-badge">Level unknown</span>';
    if (!own) return `<span class="mugging-badge">Level ${target}</span>`;
    const difference = target - own;
    const intensity = Math.min(1, Math.abs(difference) / 50);
    const hue = difference === 0 ? 48 : difference < 0 ? 128 : 0;
    const saturation = Math.round(72 + intensity * 22);
    const lightness = Math.round(48 - intensity * 23);
    const relation = difference === 0 ? 'same as you' : difference < 0 ? `${Math.abs(difference)} below you` : `${difference} above you`;
    return `<span class="mugging-badge mugging-level" style="background:hsl(${hue} ${saturation}% ${lightness}%)" title="${escape(`Level ${target} · ${relation}`)}">Level ${target}</span>`;
  }
  function normalizeCache(value = {}) {
    return {
      updatedAt:Math.max(0, Number(value.updatedAt ?? value.generated_at) || 0),
      estimateKind:String((value.estimateKind ?? value.estimate_kind) || 'rough'),
      estimateSource:String((value.estimateSource ?? value.estimate_source) || 'cached battle-stat estimate'),
      ffCheckNotice:String(value.ffCheckNotice||''),
      userBattleStats:Math.max(0, Number(value.userBattleStats ?? value.user_battle_stats) || 0),
      userLevel:Math.max(0, Math.trunc(Number(value.userLevel ?? value.user_level) || 0)),
      pool:{
        total:Math.max(0, Number(value.pool?.total) || 0),
        estimable:Math.max(0, Number(value.pool?.estimable) || 0),
        eligible:Math.max(0, Number(value.pool?.eligible) || 0),
        excluded:value.pool?.excluded && typeof value.pool.excluded === 'object' ? value.pool.excluded : null
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
        level:Math.max(0, Math.trunc(Number(target?.level) || 0)),
        status:target?.status && typeof target.status === 'object' ? target.status : null,
        fairFight:global.SLINK_MUGGING_FF.positive(target?.fairFight ?? target?.fair_fight),
        battleStatsEstimate:global.SLINK_MUGGING_FF.positive(target?.battleStatsEstimate ?? target?.battle_stats_estimate),
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
      } catch {}
      let notice = '';
      let error = '';
      let busy = false;
      let finding = false;
      let stopped = false;
      let saveSequence = 0;
      let appliedSaveSequence = 0;
      let enableSequence = 0;
      let cacheRevision = 0;
      const pendingFields = new Map();
      const controlKeys = { 'mugging-enabled':'enabled', 'mugging-min-ff':'minFairFight', 'mugging-max-ff':'maxFairFight', 'mugging-limit':'limit' };
      let mounted = false;
      let actionState = '';
      let renderedSummary = '';
      let renderedTargets = '';
      let moduleView = null;
      let visibilityObserver = null;
      let lastActivityTouchAt = 0;
      context.ui.setTitle('SLINK Mugging');
      context.ui.setModuleStyles(MODULE_STYLES);
      const contentRoot = context.ui.getContentElement();
      contentRoot.dataset.uiExplicitCommit = 'true';
      const draftGuard = SLINK.core.formState?.protect(contentRoot.getRootNode?.() || contentRoot);

      async function persistSettings(patch, element) {
        const controls = element?.matches?.('input') ? [element] : [...(element?.querySelectorAll?.('input') || [])];
        const tickets = controls.map(control => ({ id:control.id, ticket:draftGuard?.begin(control) }));
        const sequence = ++saveSequence;
        cacheRevision++;
        const fields = Object.keys(patch);
        for (const key of fields) pendingFields.set(key, (pendingFields.get(key) || 0) + 1);
        try {
          // Submit immediately to the background's existing settings queue.
          // Delaying writes in a second UI queue could reorder user intent
          // across a paused/resumed module or another window.
          const saved = fields.length
            ? await SLINK.core.messaging.send('mugging.settings.save', patch) : settings;
          const acknowledged = tickets.filter(({ticket}) => ticket ? draftGuard.commit(ticket) : true);
          if (stopped || context.signal?.aborted) return null;
          if (sequence >= appliedSaveSequence) {
            settings = normalizeSettings(saved);
            appliedSaveSequence = sequence;
            error = '';
          }
          for (const {id} of acknowledged) {
            const control = contentRoot.querySelector('#'+id);
            if (!control) continue;
            if (control.type === 'checkbox') control.checked = settings[controlKeys[id]];
            else if (control.value !== String(settings[controlKeys[id]])) control.value = String(settings[controlKeys[id]]);
          }
          render();
          return settings;
        } finally {
          for (const key of fields) {
            const count = (pendingFields.get(key) || 1) - 1;
            if (count) pendingFields.set(key, count); else pendingFields.delete(key);
          }
        }
      }

      function saveError(caught) {
        if (stopped || context.signal?.aborted) return;
        error = SLINK.core.format.errorMessage(caught);
        render();
      }

      async function findTargets() {
        if (finding || busy || stopped || context.signal?.aborted) return;
        finding = true;
        const values = {
          enabled:contentRoot.querySelector('#mugging-enabled')?.checked === true,
          minFairFight:contentRoot.querySelector('#mugging-min-ff')?.value,
          maxFairFight:contentRoot.querySelector('#mugging-max-ff')?.value,
          limit:contentRoot.querySelector('#mugging-limit')?.value
        };
        const patch = Object.fromEntries(Object.entries(values).filter(([key,value]) =>
          pendingFields.has(key) || String(value) !== String(settings[key])
        ));
        render();
        try {
          const saved = await persistSettings(patch, contentRoot.querySelector('.mugging-controls'));
          if (saved) await refreshAssignments();
        } catch (caught) { saveError(caught); }
        finally { finding = false; render(); }
      }

      function moduleVisible() {
        return Boolean(!stopped && !context.signal?.aborted && moduleView && !moduleView.hidden);
      }

      async function touchMuggingUi(force = false) {
        if (!moduleVisible() || !settings.enabled) return false;
        const now = Date.now();
        if (!force && now - lastActivityTouchAt < 10_000) return true;
        lastActivityTouchAt = now;
        await SLINK.core.messaging.send('mugging.activity.touch').catch(() => null);
        return true;
      }

      function noteMuggingInteraction() {
        if (moduleVisible()) void touchMuggingUi(false);
      }

      function syncMuggingVisibility() {
        if (!moduleVisible()) return;
        void touchMuggingUi(true);
        const revision = cacheRevision;
        void SLINK.core.messaging.send('mugging.status').then(value => {
          if (stopped || context.signal?.aborted || revision !== cacheRevision) return;
          cache = normalizeCache(value);
          render();
        }).catch(() => null);
      }

      async function refreshAssignments() {
        if (busy || stopped || context.signal?.aborted) return;
        if (!settings.enabled) {
          error = 'Enable Mugging on this device before requesting assignments.';
          render();
          return;
        }
        busy = true; error = ''; notice = ''; render();
        const revision = ++cacheRevision;
        try {
          const value = await SLINK.core.messaging.send('mugging.assignments.refresh', { ...settings, forceBattleStats:true });
          if (stopped || context.signal?.aborted || revision !== cacheRevision) return;
          cache = normalizeCache(value);
          notice = `Loaded ${cache.targets.length} rough Fair Fight assignments from cached Mugging intelligence.`;
        } catch (caught) {
          if (revision === cacheRevision) error = SLINK.core.format.errorMessage(caught);
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
          return `<article class="mugging-target">
            <div class="mugging-head"><a href="${profile}">${escape(target.name || `Player ${target.id}`)} [${target.id}]</a></div>
            <div class="mugging-meta">
              <span class="mugging-badge">${escape(statusLabel(target))}</span>
              ${levelBadge(target.level, cache.userLevel)}
              <span class="mugging-badge">${target.estimateKind==='unchecked'?'FF check pending':`Rough FF ${target.fairFight === null ? '?' : target.fairFight.toFixed(2)}`}</span>
              <span class="mugging-badge">Estimated BS ${target.battleStatsEstimate === null ? '?' : escape(SLINK.core.format.shortNumber(target.battleStatsEstimate))}</span>
              ${target.confidence ? `<span class="mugging-badge">${escape(target.confidence)}</span>` : ''}
            </div>
            <div class="mugging-actions"><a href="${profile}">Profile</a>${target.estimateKind==='unchecked'?'':`<a href="${attack}">Attack</a>`}<button type="button" data-mugging-save="${target.id}">Save Target</button></div>
          </article>`;
        }).join('');
      }

      function render() {
        if (stopped || context.signal?.aborted) return;
        context.ui.setSubtitle(settings.enabled ? 'Rough Fair Fight assignments' : 'Disabled locally');
        context.ui.setStatus(error || (settings.enabled ? 'Mugging permission granted.' : 'Mugging is available but disabled on this device.'), error ? 'error' : settings.enabled ? 'ready' : 'normal');
        const nextActionState = busy || finding ? 'busy' : 'ready';
        if (actionState !== nextActionState) {
          actionState = nextActionState;
          context.ui.setActions([{ id:'refresh', label:busy || finding ? 'Finding…' : 'Find targets', disabled:busy || finding, onClick:findTargets }]);
        }
        const summary = summaryHtml();
        const targets = targetsHtml();
        if (mounted) {
          if (summary !== renderedSummary) {
            contentRoot.querySelector('#mugging-summary').innerHTML = summary;
            renderedSummary = summary;
          }
          if (targets !== renderedTargets) {
            contentRoot.querySelector('#mugging-targets').innerHTML = targets;
            renderedTargets = targets;
            bindTargetActions();
          }
          const find = contentRoot.querySelector('#mugging-find');
          find.disabled = busy || finding;
          find.textContent = busy || finding ? 'Finding targets…' : 'Find targets';
          updateMessages();
          return;
        }
        mounted = true;
        renderedSummary = summary;
        renderedTargets = targets;
        context.ui.setContentHtml(`
          <div class="mugging-summary" id="mugging-summary">${summary}</div>
          <p class="mugging-note" id="mugging-pool-note" hidden></p>
          <p class="mugging-note" id="mugging-ff-note" hidden></p>
          <div class="mugging-controls">
            <label class="mugging-check"><input id="mugging-enabled" type="checkbox" ${settings.enabled ? 'checked' : ''}><span>Enable Mugging on this device</span></label>
            <label>Minimum rough FF<input id="mugging-min-ff" type="number" min="1" max="3" step=".1" value="${settings.minFairFight}"></label>
            <label>Maximum rough FF<input id="mugging-max-ff" type="number" min="1" max="3" step=".1" value="${settings.maxFairFight}"></label>
            <label>Target count<input id="mugging-limit" type="number" min="1" max="100" step="1" value="${settings.limit}"></label>
            <button class="mugging-wide" id="mugging-find" type="button" ${busy || finding ? 'disabled' : ''}>${busy || finding ? 'Finding targets…' : 'Find targets'}</button>
            <div class="mugging-note mugging-wide" id="mugging-sync" hidden></div>
            <div class="mugging-note mugging-wide" id="mugging-error" hidden></div>
            <div class="mugging-note mugging-wide" id="mugging-notice" hidden></div>
          </div>
          <div id="mugging-targets">${targets}</div>
        `);
        updateMessages();
        bind();
      }

      function summaryHtml() {
        return `<div class="mugging-stat"><b>${cache.targets.length}</b><span>Assignments</span></div>
          <div class="mugging-stat"><b>${cache.pool.eligible}</b><span>Eligible pool</span></div>
          <div class="mugging-stat"><b>${cache.userBattleStats ? escape(SLINK.core.format.shortNumber(cache.userBattleStats)) : '—'}</b><span>Your BS</span></div>
          <div class="mugging-stat"><b>${escape(cache.contribution.mode)}</b><span>${cache.contribution.fetched}/${cache.contribution.apiBudgetPerMinute || 0} contributor checks</span></div>`;
      }

      function updateMessages() {
        const excluded = cache.pool.excluded;
        const messages = {
          'mugging-ff-note':cache.ffCheckNotice,
          'mugging-error':error,
          'mugging-notice':notice,
          'mugging-sync':cache.contribution.lastSyncAt ? `Last sync ${new Date(cache.contribution.lastSyncAt).toLocaleString()}` : '',
          'mugging-pool-note':excluded ? `Pool exclusions: ${Number(excluded.no_estimate)||0} without estimates · ${Number(excluded.timed_unavailable)||0} hospital/jail timers · ${Number(excluded.mug_cooldown)||0} post-mug cooldowns · ${Number(excluded.fair_fight_range)||0} outside your FF range.` : ''
        };
        for (const [id,text] of Object.entries(messages)) {
          const node = contentRoot.querySelector('#'+id);
          if (!node) continue;
          if (node.textContent !== text) node.textContent = text;
          node.hidden = !text;
        }
      }

      function bind() {
        const root = context.ui.getContentElement();
        root.querySelector('#mugging-enabled')?.addEventListener('change', async event => {
          const sequence = ++enableSequence;
          try {
            const saved = await persistSettings({ enabled:event.target.checked }, event.target);
            if (!saved || sequence !== enableSequence) return;
            notice = settings.enabled ? 'Mugging enabled locally; contributor scheduling started.' : 'Mugging disabled locally; cached assignments were kept.';
            if (settings.enabled && contentRoot.querySelector('#mugging-enabled')?.checked === true) {
              await SLINK.core.messaging.send('mugging.activity.touch').catch(() => null);
              if (stopped || context.signal?.aborted || sequence !== enableSequence) return;
              void SLINK.core.messaging.send('mugging.contribution.run').then(value => {
                if (stopped || context.signal?.aborted) return;
                cache = normalizeCache({ ...cache, contribution:value });
                render();
              }).catch(() => null);
            }
            render();
          } catch (caught) { if (sequence === enableSequence) saveError(caught); }
        });
        for (const [id,key] of [['mugging-min-ff','minFairFight'],['mugging-max-ff','maxFairFight'],['mugging-limit','limit']]) {
          root.querySelector('#'+id)?.addEventListener('change', async event => {
            try {
              const saved = await persistSettings({ [key]:event.target.value }, event.target);
              if (saved?.enabled) await touchMuggingUi(true);
            } catch (caught) { saveError(caught); }
          });
        }
        root.querySelector('#mugging-find')?.addEventListener('click', findTargets);
        bindTargetActions();
      }

      function bindTargetActions() {
        const root = context.ui.getContentElement();
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
      moduleView = context.ui.getContentElement()?.closest('.module-view') || null;
      if (moduleView) {
        visibilityObserver = new MutationObserver(syncMuggingVisibility);
        visibilityObserver.observe(moduleView, { attributes:true, attributeFilter:['hidden'] });
        moduleView.addEventListener('click', noteMuggingInteraction, true);
        moduleView.addEventListener('input', noteMuggingInteraction, true);
        moduleView.addEventListener('change', noteMuggingInteraction, true);
      }
      syncMuggingVisibility();
      return { stop() {
        stopped = true;
        visibilityObserver?.disconnect();
        moduleView?.removeEventListener('click', noteMuggingInteraction, true);
        moduleView?.removeEventListener('input', noteMuggingInteraction, true);
        moduleView?.removeEventListener('change', noteMuggingInteraction, true);
      } };
    }
  });
})(globalThis);
