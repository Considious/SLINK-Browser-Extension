(function registerAbroadStocksModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before the Abroad Stocks module.');

  const ABROAD = SLINK.core.abroadStocks;
  const PROVIDER_ORDER = ['yata','prometheus','tornIntel'];
  const TRAVEL_LABELS = Object.freeze({
    standard:'Standard',
    airstrip:'Private Island airstrip',
    business:'Business Class',
    private:'Private (WLT benefit)'
  });

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  }

  function relativeTime(timestamp) {
    const age = Math.max(0, Date.now() - Number(timestamp || 0));
    if (!timestamp) return 'unknown';
    if (age < 60_000) return Math.floor(age / 1000) + 's ago';
    if (age < 3_600_000) return Math.floor(age / 60_000) + 'm ago';
    return Math.floor(age / 3_600_000) + 'h ago';
  }

  function money(value) {
    return Number.isFinite(Number(value)) ? '$' + Number(value).toLocaleString() : '—';
  }

  SLINK.modules.register({
    id:'abroad-stocks',
    title:'SLINK Abroad Stocks',
    shortTitle:'Abroad Stocks',
    group:'quality-of-life',
    groupTitle:'Quality of Life',
    requiredScopes:['slink.qol.abroad-stocks'],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      let stopped = false;
      let status = null;
      let mode = 'item';
      let query = '';
      let timer = null;

      ui.setModuleStyles(
        '.slink-abroad-toolbar{display:grid;grid-template-columns:auto 1fr auto;gap:6px;margin-bottom:7px}' +
        '.slink-abroad-toolbar select,.slink-abroad-toolbar input,.slink-abroad-settings select,.slink-abroad-settings input{min-width:0;padding:6px;border:1px solid var(--slink-border);border-radius:6px;background:var(--slink-bg);color:var(--slink-text);font:inherit}' +
        '.slink-abroad-toolbar button,.slink-abroad-card button,.slink-abroad-settings button,.slink-provider-access a{display:inline-flex;align-items:center;justify-content:center;min-height:29px;padding:4px 8px;border:1px solid var(--slink-border);border-radius:6px;background:var(--slink-bg);color:var(--slink-text);font:inherit;text-decoration:none;cursor:pointer}' +
        '.slink-abroad-list{display:grid;gap:7px;max-height:480px;overflow:auto;padding-right:2px}.slink-abroad-card{padding:8px;border:1px solid var(--slink-border-soft);border-radius:8px;background:var(--slink-bg-control)}' +
        '.slink-abroad-card header{display:flex;align-items:start;justify-content:space-between;gap:7px}.slink-abroad-card header>div{min-width:0;flex:1}.slink-abroad-card h3,.slink-abroad-card header span{display:block}.slink-abroad-card h3{margin:0;font-size:12px}.slink-abroad-card header span{margin-top:3px;color:var(--slink-muted);font-size:10px}' +
        '.slink-abroad-sources{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:7px}.slink-abroad-source{padding:5px;border-radius:6px;background:var(--slink-bg)}.slink-abroad-source strong,.slink-abroad-source span,.slink-abroad-source small{display:block}.slink-abroad-source span{font-size:10px}.slink-abroad-source small{color:var(--slink-muted);font-size:9px}' +
        '.slink-abroad-restock{display:grid;gap:4px;margin-top:8px;color:var(--slink-muted);font-size:10px}.slink-abroad-restock span{display:block;line-height:1.35}.slink-abroad-restock .slink-leave-time{padding:6px 7px;border-left:3px solid var(--slink-ready);border-radius:4px;background:var(--slink-bg);color:var(--slink-text);font-size:11px;font-weight:700}.slink-abroad-actions{display:flex;gap:5px;margin-top:7px}.slink-abroad-actions button[data-watched="true"]{border-color:var(--slink-ready);color:var(--slink-ready)}' +
        '.slink-abroad-empty{padding:16px;text-align:center;color:var(--slink-muted);background:var(--slink-bg-control);border-radius:7px}.slink-abroad-settings{margin-top:8px;padding:7px;border:1px solid var(--slink-border-soft);border-radius:7px}.slink-abroad-settings summary{cursor:pointer;font-weight:bold}.slink-abroad-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}.slink-abroad-grid label{display:grid;gap:3px;color:var(--slink-muted);font-size:10px}.slink-provider-access{grid-column:1/-1;display:grid;gap:5px;padding:6px;border-radius:6px;background:var(--slink-bg)}' +
        '.slink-provider-strip{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px;color:var(--slink-muted);font-size:10px}.slink-provider-strip span[data-ok="true"]{color:var(--slink-ready)}.slink-provider-strip span[data-ok="false"]{color:var(--slink-warning)}'
      );

      function providerCell(providerId, row) {
        const source = row.sources?.[providerId];
        const label = ABROAD.PROVIDERS[providerId].label;
        if (!source) return '<div class="slink-abroad-source"><strong>' + escapeHtml(label) + '</strong><span>Unavailable</span></div>';
        return '<div class="slink-abroad-source"><strong>' + escapeHtml(label) + '</strong><span>' +
          (source.quantity === null ? 'Stock unknown' : Number(source.quantity).toLocaleString() + ' in stock') +
          '</span><span>' + money(source.cost) + '</span><small>' + escapeHtml(relativeTime(source.updatedAt)) + '</small></div>';
      }

      function rowCard(row) {
        const leaveAt = Number(row.departureAt) || 0;
        const last = Number(row.lastRestockAt) || 0;
        const next = Number(row.nextRestockAt) || 0;
        return '<article class="slink-abroad-card" data-search-country="' + escapeHtml((row.countryName + ' ' + row.countryCode).toLocaleLowerCase()) +
          '" data-search-item="' + escapeHtml((row.itemName + ' ' + (row.itemId || '')).toLocaleLowerCase()) + '">' +
          '<header><div><h3>' + escapeHtml(row.itemName) + '</h3><span>' + escapeHtml(row.countryName) + '</span></div>' +
          '<span>' + (row.itemId ? '#' + row.itemId : '') + '</span></header>' +
          '<div class="slink-abroad-sources">' + PROVIDER_ORDER.map(providerId => providerCell(providerId,row)).join('') + '</div>' +
          '<div class="slink-abroad-restock">' +
          (last ? '<span>Last observed restock: ' + escapeHtml(ABROAD.formatTct(last)) + '</span>' : '<span>Restock history is still learning.</span>') +
          (next ? '<span>Estimated next restock: ' + escapeHtml(ABROAD.formatTct(next)) + (row.predictionSource ? ' · ' + escapeHtml(row.predictionSource) : '') + '</span>' : '') +
          (leaveAt ? '<span class="slink-leave-time">Leave at ' + escapeHtml(ABROAD.formatTct(leaveAt)) + '</span>' : '<span>Leave time will appear when a provider publishes a restock estimate.</span>') +
          '</div><div class="slink-abroad-actions"><button type="button" data-watch-key="' + escapeHtml(row.key) + '" data-watched="' + String(row.watched === true) + '">' +
          (row.watched ? 'Watching departure' : 'Alert me when to leave') + '</button></div></article>';
      }

      const root = ui.getContentElement();
      const fields = Object.fromEntries(['travelMethod','arrivalBufferMinutes','alertLeadMinutes','alertsEnabled','soundEnabled','landingRecommendationEnabled'].map(key => ['abroad-setting-' + key,key]));
      let mounted = false;
      let settingsRevision = 0;
      let requestSequence = 0;
      let appliedSequence = 0;
      let saveState = {state:'idle'};
      let previewTimer = null;
      let refreshing = false;
      const cards = new Map();
      const pendingWatches = new Set();
      function changedHtml(node, html) { if (node.innerHTML !== html) node.innerHTML = html; }
      function showSaveState() {
        if (stopped || context.signal?.aborted || !mounted) return;
        root.querySelector('[data-abroad-save-state]').textContent = ({idle:'Changes save automatically.',saving:'Saving…',saved:'Saved.',invalid:'Enter a complete number before saving.',failed:'Not saved. Retry your changes.',unsaved:'Changes not saved yet.'})[saveState.state] || '';
        root.querySelector('[data-abroad-retry]').hidden = saveState.state !== 'failed';
      }
      function schedulePreview() {
        if (previewTimer) global.clearTimeout(previewTimer);
        if (stopped || context.signal?.aborted) return;
        previewTimer = global.setTimeout(() => {
          previewTimer = null;
          if (autosave.busy) return;
          void load(false).catch(showError);
        },250);
      }
      const autosave = SLINK.core.formState.autosave({
        root,fields,
        read:key => status?.settings?.[key],
        async save(settings) {
          settingsRevision++;
          try { return await SLINK.core.messaging.send('abroadStocks.settings.save',{settings}); }
          finally { settingsRevision++; }
        },
        select:response => response.settings,
        onCommit:patch => {
          status = {...status,settings:{...status?.settings,...patch,
            ...(Object.hasOwn(patch,'travelMethod') ? {travelMethodExplicit:true} : {})}};
          render();
        },
        onState:state => {
          saveState = state;showSaveState();
          if (state.state === 'saved') schedulePreview();
        }
      });
      function showError(error) {
        if (!stopped && !context.signal?.aborted) ui.setStatus(SLINK.core.format.errorMessage(error),'error');
      }
      function filterCards() {
        const needle = query.trim().toLocaleLowerCase();
        let visible = 0;
        for (const record of cards.values()) {
          record.node.hidden = Boolean(needle) && !String(record.node.dataset[mode === 'country' ? 'searchCountry' : 'searchItem'] || '').includes(needle);
          if (!record.node.hidden) visible++;
        }
        root.querySelector('[data-abroad-empty]').hidden = visible !== 0;
      }
      function render() {
        if (stopped || context.signal?.aborted || !status) return;
        if (!mounted) {
          root.innerHTML =
            '<div class="slink-provider-strip"></div>' +
            '<div class="slink-abroad-toolbar"><select id="abroad-search-mode" data-search-mode><option value="item">Item</option><option value="country">Country</option></select>' +
            '<input id="abroad-search-query" data-search-query type="search" placeholder="Search by item..."><button type="button" data-refresh>Refresh</button></div>' +
            '<div class="slink-abroad-list"><div class="slink-abroad-empty" data-abroad-empty>No matching abroad stock is currently available.</div></div>' +
            '<details class="slink-abroad-settings" id="abroad-settings"><summary>Travel and alert settings</summary><div class="slink-abroad-grid">' +
            '<label>Travel method<select id="abroad-setting-travelMethod" data-setting="travelMethod">' + Object.entries(TRAVEL_LABELS).map(([value,label]) => '<option value="' + value + '">' + escapeHtml(label) + '</option>').join('') + '</select><small data-abroad-method-hint></small></label>' +
            '<label>Arrival buffer (minutes)<input id="abroad-setting-arrivalBufferMinutes" data-setting="arrivalBufferMinutes" type="number" min="0" max="30" value="' + Number(status.settings.arrivalBufferMinutes) + '"></label>' +
            '<label>Alert before leave time (minutes)<input id="abroad-setting-alertLeadMinutes" data-setting="alertLeadMinutes" type="number" min="0" max="180" value="' + Number(status.settings.alertLeadMinutes) + '"></label>' +
            '<label><span>Departure reminders</span><input id="abroad-setting-alertsEnabled" data-setting="alertsEnabled" type="checkbox"' + (status.settings.alertsEnabled ? ' checked' : '') + '></label>' +
            '<label><span>Reminder sound</span><input id="abroad-setting-soundEnabled" data-setting="soundEnabled" type="checkbox"' + (status.settings.soundEnabled ? ' checked' : '') + '></label>' +
            '<label style="grid-column:1/-1"><span>Two-minute landing purchase recommendation</span><input id="abroad-setting-landingRecommendationEnabled" data-setting="landingRecommendationEnabled" type="checkbox"' + (status.settings.landingRecommendationEnabled ? ' checked' : '') + '><small>Checks YATA, Prometheus, and Torn Intel, then recommends the in-stock item with the best return against Torn market value.</small></label>' +
            '</div><div role="status"><span data-abroad-save-state></span> <button type="button" data-abroad-retry hidden>Retry</button></div></details>';
          root.querySelector('[data-search-mode]').value = mode;
          root.querySelector('[data-search-query]').value = query;
          root.querySelector('[data-setting="travelMethod"]').value = status.settings.travelMethod;
          mounted = true;autosave.mount();
        }
        changedHtml(root.querySelector('.slink-provider-strip'),PROVIDER_ORDER.map(providerId => {
          const provider = status.providers?.[providerId] || {};
          return '<span data-ok="' + String(provider.ok === true) + '">' + escapeHtml(ABROAD.PROVIDERS[providerId].label) + ': ' + (provider.ok ? relativeTime(provider.fetchedAt) : provider.rows ? 'cached' : 'unavailable') + '</span>';
        }).join(''));
        const list = root.querySelector('.slink-abroad-list');
        const present = new Set();
        for (const row of status.rows || []) {
          present.add(row.key);
          const html = rowCard(row);
          let record = cards.get(row.key);
          if (!record) {
            const holder = document.createElement('div');holder.innerHTML = html;
            record = {node:holder.firstElementChild,html};cards.set(row.key,record);
            list.insertBefore(record.node,root.querySelector('[data-abroad-empty]'));
          } else if (record.html !== html) {
            const holder = document.createElement('div');holder.innerHTML = html;
            const fresh = holder.firstElementChild;
            for (const selector of ['header','.slink-abroad-sources','.slink-abroad-restock']) changedHtml(record.node.querySelector(selector),fresh.querySelector(selector).innerHTML);
            record.node.dataset.searchCountry = fresh.dataset.searchCountry;
            record.node.dataset.searchItem = fresh.dataset.searchItem;
            record.html = html;
          }
          const button = record.node.querySelector('[data-watch-key]');
          button.dataset.watched = String(row.watched === true);
          button.textContent = row.watched ? 'Watching departure' : 'Alert me when to leave';
          button.disabled = pendingWatches.has(row.key);
        }
        for (const [key,record] of cards) if (!present.has(key)) {record.node.remove();cards.delete(key);}
        root.querySelector('[data-abroad-method-hint]').textContent = status.settings.travelMethodExplicit ? 'Manually selected' : 'Automatically selected from your current property';
        root.querySelector('[data-refresh]').disabled = refreshing;
        filterCards();showSaveState();
      }
      context.listen(root,'input',event => {
        if (event.target.matches('[data-search-query]')) {query = event.target.value;filterCards();}
      });
      context.listen(root,'change',event => {
        if (event.target.matches('[data-search-mode]')) {
          mode = event.target.value;
          root.querySelector('[data-search-query]').placeholder = 'Search by ' + mode + '...';
          filterCards();
        }
      });
      context.listen(root,'click',async event => {
        if (stopped || context.signal?.aborted) return;
        if (event.target.closest('[data-abroad-retry]')) {void autosave.retry().catch(() => {});return;}
        if (event.target.closest('[data-refresh]')) {
          if (refreshing) return;
          refreshing = true;render();
          try {await autosave.flush();if (!stopped && !context.signal?.aborted) await load(false,'abroadStocks.refresh');}
          catch (error) {showError(error);}
          finally {refreshing = false;render();}
          return;
        }
        const button = event.target.closest('[data-watch-key]');
        if (!button || pendingWatches.has(button.dataset.watchKey)) return;
        const row = status.rows.find(candidate => candidate.key === button.dataset.watchKey);
        if (!row) return;
        pendingWatches.add(row.key);render();
        try {
          await load(false,'abroadStocks.watch.toggle',{key:row.key,countryCode:row.countryCode,countryName:row.countryName,itemId:row.itemId,itemName:row.itemName});
        } catch (error) {showError(error);}
        finally {pendingWatches.delete(row.key);render();schedulePreview();}
      });

      function updateStatus() {
        if (stopped || context.signal?.aborted) return;
        const alertCount = status?.activeAlerts?.length || 0;
        ui.setAlertCount('abroad-stocks', alertCount, { group:'quality-of-life', label:'abroad departure reminders' });
        ui.setStatus(status?.fetchedAt ? 'Updated ' + relativeTime(status.fetchedAt) + ' · ' + status.watches.length + ' departure watch' + (status.watches.length === 1 ? '' : 'es') : 'Open this tab or press Refresh to load abroad stock.', status?.fetchedAt ? 'ready' : 'normal');
      }

      async function load(touch = false, type = '', payload = {refreshIfDue:false}) {
        if (!type && pendingWatches.size) return;
        const sequence = ++requestSequence;
        const revision = settingsRevision;
        const response = await SLINK.core.messaging.send(type || (touch ? 'abroadStocks.activity.touch' : 'abroadStocks.status'),payload);
        if (stopped || context.signal?.aborted || sequence < appliedSequence) return;
        appliedSequence = sequence;
        status = {...response,settings:revision === settingsRevision && !autosave.busy ? response.settings : status?.settings || response.settings};
        render();
        updateStatus();
      }

      try {await load(true);}
      catch (error) {stopped = true;await autosave.stop();throw error;}
      if (stopped || context.signal?.aborted) {await autosave.stop();return {stop(){}};}
      timer = global.setInterval(() => {
        if (stopped || context.signal?.aborted || context.isActive?.() === false) return;
        const section = ui.getContentElement()?.parentElement;
        if (section && !section.hidden && document.visibilityState === 'visible') void load(true).catch(showError);
      }, 60_000);

      return {
        async stop() {
          stopped = true;
          if (timer) global.clearInterval(timer);
          if (previewTimer) global.clearTimeout(previewTimer);
          await autosave.stop();
        }
      };
    }
  });
})(globalThis);
