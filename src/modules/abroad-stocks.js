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
    private:'Private Jet'
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

      function filteredRows() {
        const needle = query.trim().toLocaleLowerCase();
        if (!needle) return status?.rows || [];
        return (status?.rows || []).filter(row => mode === 'country'
          ? (row.countryName + ' ' + row.countryCode).toLocaleLowerCase().includes(needle)
          : (row.itemName + ' ' + (row.itemId || '')).toLocaleLowerCase().includes(needle));
      }

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

      function render() {
        if (!status) return;
        const root = ui.getContentElement();
        const providerStrip = PROVIDER_ORDER.map(providerId => {
          const provider = status.providers?.[providerId] || {};
          return '<span data-ok="' + String(provider.ok === true) + '">' + escapeHtml(ABROAD.PROVIDERS[providerId].label) + ': ' +
            (provider.ok ? relativeTime(provider.fetchedAt) : provider.rows ? 'cached' : 'unavailable') + '</span>';
        }).join('');
        const rows = filteredRows();
        root.innerHTML =
          '<div class="slink-provider-strip">' + providerStrip + '</div>' +
          '<div class="slink-abroad-toolbar"><select data-search-mode><option value="item">Item</option><option value="country">Country</option></select>' +
          '<input data-search-query type="search" placeholder="Search by ' + mode + '..." value="' + escapeHtml(query) + '">' +
          '<button type="button" data-refresh>Refresh</button></div>' +
          '<div class="slink-abroad-list">' + (rows.length ? rows.map(rowCard).join('') : '<div class="slink-abroad-empty">No matching abroad stock is currently available.</div>') + '</div>' +
          '<details class="slink-abroad-settings"><summary>Travel and alert settings</summary><div class="slink-abroad-grid">' +
          '<label>Travel method<select data-setting="travelMethod">' + Object.entries(TRAVEL_LABELS).map(([value,label]) => '<option value="' + value + '">' + escapeHtml(label) + '</option>').join('') + '</select><small>' + (status.settings.travelMethodExplicit ? 'Manually selected' : 'Automatically selected from your current property') + '</small></label>' +
          '<label>Arrival buffer (minutes)<input data-setting="arrivalBufferMinutes" type="number" min="0" max="30" value="' + Number(status.settings.arrivalBufferMinutes) + '"></label>' +
          '<label>Alert before leave time (minutes)<input data-setting="alertLeadMinutes" type="number" min="0" max="180" value="' + Number(status.settings.alertLeadMinutes) + '"></label>' +
          '<label><span>Departure reminders</span><input data-setting="alertsEnabled" type="checkbox"' + (status.settings.alertsEnabled ? ' checked' : '') + '></label>' +
          '<label><span>Reminder sound</span><input data-setting="soundEnabled" type="checkbox"' + (status.settings.soundEnabled ? ' checked' : '') + '></label>' +
          '<button type="button" data-save-settings>Save settings</button></div></details>';

        root.querySelector('[data-search-mode]').value = mode;
        root.querySelector('[data-setting="travelMethod"]').value = status.settings.travelMethod;
        root.querySelector('[data-search-mode]').addEventListener('change', event => { mode = event.target.value; query = ''; render(); });
        root.querySelector('[data-search-query]').addEventListener('input', event => {
          query = event.target.value;
          const needle = query.trim().toLocaleLowerCase();
          root.querySelectorAll('.slink-abroad-card').forEach(card => {
            card.hidden = Boolean(needle) && !String(card.dataset[mode === 'country' ? 'searchCountry' : 'searchItem'] || '').includes(needle);
          });
        });
        root.querySelector('[data-refresh]').addEventListener('click', async event => {
          event.currentTarget.disabled = true;
          try { status = await SLINK.core.messaging.send('abroadStocks.refresh'); render(); updateStatus(); }
          catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
        });
        root.querySelectorAll('[data-watch-key]').forEach(button => button.addEventListener('click', async () => {
          const row = status.rows.find(candidate => candidate.key === button.dataset.watchKey);
          status = await SLINK.core.messaging.send('abroadStocks.watch.toggle', {
            key:row.key, countryCode:row.countryCode, countryName:row.countryName, itemId:row.itemId, itemName:row.itemName
          });
          render(); updateStatus();
        }));
        root.querySelector('[data-save-settings]').addEventListener('click', async event => {
          const next = {
            ...status.settings,
            travelMethod:root.querySelector('[data-setting="travelMethod"]').value,
            arrivalBufferMinutes:Number(root.querySelector('[data-setting="arrivalBufferMinutes"]').value),
            alertLeadMinutes:Number(root.querySelector('[data-setting="alertLeadMinutes"]').value),
            alertsEnabled:root.querySelector('[data-setting="alertsEnabled"]').checked,
            soundEnabled:root.querySelector('[data-setting="soundEnabled"]').checked
          };
          event.currentTarget.disabled = true;
          try { status = await SLINK.core.messaging.send('abroadStocks.settings.save', { settings:next }); render(); updateStatus(); }
          catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
        });
      }

      function updateStatus() {
        const alertCount = status?.activeAlerts?.length || 0;
        ui.setAlertCount('abroad-stocks', alertCount, { group:'quality-of-life', label:'abroad departure reminders' });
        ui.setStatus(status?.fetchedAt ? 'Updated ' + relativeTime(status.fetchedAt) + ' · ' + status.watches.length + ' departure watch' + (status.watches.length === 1 ? '' : 'es') : 'Open this tab or press Refresh to load abroad stock.', status?.fetchedAt ? 'ready' : 'normal');
      }

      async function load(touch = false) {
        status = await SLINK.core.messaging.send(touch ? 'abroadStocks.activity.touch' : 'abroadStocks.status');
        if (stopped) return;
        render();
        updateStatus();
      }

      await load(true);
      timer = global.setInterval(() => {
        if (stopped) return;
        const section = ui.getContentElement()?.parentElement;
        if (section && !section.hidden && document.visibilityState === 'visible') void load(true);
      }, 60_000);

      return {
        stop() {
          stopped = true;
          if (timer) global.clearInterval(timer);
          ui.setAlertCount('abroad-stocks', 0);
        }
      };
    }
  });
})(globalThis);
