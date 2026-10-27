(function registerMoneyPropertyModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Money & Property.');
  const CORE = SLINK.core.moneyProperty;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  }

  function money(value) {
    const amount = Math.max(0, Number(value) || 0);
    if (amount < 1_000_000) return '$' + amount.toLocaleString(undefined, { maximumFractionDigits:0 });
    const units = [[1e12,'T'],[1e9,'B'],[1e6,'M']];
    const [scale, suffix] = units.find(([scale]) => amount >= scale);
    const digits = amount / scale >= 100 ? 0 : amount / scale >= 10 ? 1 : 2;
    return '$' + (amount / scale).toFixed(digits).replace(/\.0+$|(?<=\.[0-9])0+$/,'') + suffix;
  }

  function exactMoney(value) {
    return '$' + Math.max(0, Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits:0 });
  }

  function percent(value) {
    return Number(value) > 0 ? (Number(value) * 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + '%' : 'Unavailable';
  }

  function relativeTime(timestamp) {
    if (!Number(timestamp)) return 'not checked yet';
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
    return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
  }

  function due(timestamp) {
    if (!Number(timestamp)) return 'Unavailable';
    const seconds = Math.ceil((Number(timestamp) - Date.now()) / 1000);
    if (seconds <= 0) return 'Ready now';
    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3_600);
    const minutes = Math.ceil((seconds % 3_600) / 60);
    return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  function stockCard(stock, settings) {
    return `<article class="slink-stock-row">
      <div class="slink-stock-title"><strong>${escapeHtml(stock.name)} ${escapeHtml(stock.acronym)}</strong><small>${escapeHtml(stock.benefitDescription)}</small></div>
      <div class="slink-stock-payout"><strong title="${escapeHtml(exactMoney(stock.payoutValue))}">${money(stock.payoutValue)} per payout</strong><small>${escapeHtml(stock.cadenceLabel)}</small></div>
      <div class="slink-stock-metrics">
        <span><strong title="${escapeHtml(exactMoney(stock.incrementalCost))}">${money(stock.incrementalCost)}</strong><small>Cost to next block · ${stock.sharesNeeded.toLocaleString()} shares</small></span>
        <span><strong>${money(stock.weeklyValue)}</strong><small>Estimated weekly value</small></span>
        <span><strong>${money(stock.monthlyValue)}</strong><small>Estimated monthly value</small></span>
        <span><strong>${percent(stock.monthlyRoi)}</strong><small>Estimated monthly ROI</small></span>
      </div>
      <label><input id="money-stock-${escapeHtml(encodeURIComponent(stock.alertKey))}" type="checkbox" data-stock-alert="${escapeHtml(stock.alertKey)}" ${settings.stockAlerts[stock.alertKey] ? 'checked' : ''}> Alert when affordable</label>
    </article>`;
  }

  function bankResults(status, amount) {
    if (String(amount ?? '').trim() === '') return '<p>Enter an amount from $0 to $2,000,000,000.</p>';
    const comparison=CORE.bankComparison(status?.bankPlanner,amount);
    if(comparison.error)return `<p>${escapeHtml(comparison.error)}</p>`;
    return `<p>Bank interest merits: ${comparison.meritLevel}/10 (+${comparison.meritLevel*5}%) · ${escapeHtml(comparison.stock.label)}</p><div class="slink-bank-terms">${comparison.rows.map(row=>`<article class="slink-finance-stat"><strong>${row.label}${row.days===comparison.best?' · Best daily ROI':''}</strong>${row.available?`<small>APR ${row.effectiveApr.toFixed(3)}% · ${row.days} days</small><p><strong>${exactMoney(row.profit)} profit</strong><small>${exactMoney(row.perDay)} per day</small><small>${exactMoney(row.total)} returned at maturity</small><small>Term ROI ${percent(row.roi)}</small><small>Daily ROI ${percent(row.dailyRoi)}</small></p>`:'<p>No rate returned for this term.</p>'}</article>`).join('')}</div>`;
  }

  function bankCard(status, settings) {
    return `<article class="slink-finance-card"><div class="slink-finance-head"><div><strong>Bank investment comparison</strong><small data-money-readonly="rates-age">Rates checked ${relativeTime(status.bankPlanner?.fetchedAt)} · cached for up to 1 hour</small></div><a href="${CORE.BANK_URL}">Open bank</a></div><p>Each term uses its own Torn APR, your bank interest merits, and your active bank stock benefit. Daily income is an average; interest is paid at maturity.</p><p data-money-readonly="rates-error">${escapeHtml(status.bankPlanner?.error || '')}</p><label class="slink-bank-amount">Amount to invest (maximum $2 billion)<input id="money-setting-bankAmount" type="number" inputmode="numeric" min="0" max="2000000000" step="1" data-bank-amount value="${settings.bankAmount}"></label><div data-bank-results>${bankResults(status,settings.bankAmount)}</div></article>`;
  }

  SLINK.modules.register({
    id:'money-property',
    title:'Money & Property',
    shortTitle:'Money',
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
      let stopped = false;
      let mounted = false;
      let settingsRevision = 0;
      let previewTimer = null;
      let previewPending = false;
      let actionBusy = false;
      let saveState = {state:'idle'};
      const stocks = new Map();
      const fields = Object.fromEntries(['bankAmount','bankLeadHours','rentalLeadDays','cashierLeadHours','upkeepThreshold','loanReminder','soundEnabled'].map(key => ['money-setting-' + key,key]));
      const patchHtml = (node, html) => { if (node && node.innerHTML !== html) node.innerHTML = html; };
      function updateBankPreview() {
        const input = root.querySelector('[data-bank-amount]');
        if (input) patchHtml(root.querySelector('[data-bank-results]'),bankResults(data?.status,input.value));
      }
      function showSaveState() {
        if (stopped || context.signal?.aborted || !mounted) return;
        root.querySelector('[data-money-save-state]').textContent = ({idle:'Changes save automatically.',saving:'Saving…',saved:'Saved.',invalid:'Enter a complete number before saving.',failed:'Not saved. Retry your changes.',unsaved:'Changes not saved yet.'})[saveState.state] || '';
        root.querySelector('[data-money-retry]').hidden = saveState.state !== 'failed';
        updateBankPreview();
      }
      function schedulePreview() {
        if (stopped || context.signal?.aborted || busy || actionBusy || !previewPending) return;
        if (previewTimer) global.clearTimeout(previewTimer);
        previewTimer = global.setTimeout(() => {
          previewTimer = null;
          if (busy || actionBusy || autosave.busy) return;
          previewPending = false;void load(false,false);
        },250);
      }
      const autosave = SLINK.core.formState.autosave({
        root, fields,
        read:key => key.startsWith('stock:') ? data?.settings?.stockAlerts?.[key.slice(6)] === true : data?.settings?.[key],
        async save(patch) {
          settingsRevision++;
          const key = Object.keys(patch)[0];
          try { return await SLINK.core.messaging.send(key.startsWith('stock:') ? 'money-property.stock-alert' : 'money-property.settings.save',key.startsWith('stock:') ? {key:key.slice(6),enabled:patch[key]} : patch); }
          finally { settingsRevision++; }
        },
        select:response => response.settings,
        onCommit:patch => {
          const settings = {...data.settings,stockAlerts:{...data.settings.stockAlerts}};
          for (const [key,value] of Object.entries(patch)) {
            if (key.startsWith('stock:')) settings.stockAlerts[key.slice(6)] = value;
            else settings[key] = value;
          }
          data = {...data,settings};render();
        },
        onState:state => {
          saveState = state;showSaveState();
          if (state.state !== 'saved' || stopped || context.signal?.aborted) return;
          previewPending = true;schedulePreview();
        }
      });

      ui.setModuleStyles(`
        .slink-money-property{display:grid;gap:10px}.slink-finance-card{min-width:0;padding:11px;border:1px solid var(--slink-border-soft);border-radius:9px;background:var(--slink-bg-control)}
        .slink-finance-head,.slink-finance-actions{display:flex;gap:9px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.slink-finance-head>div{min-width:0;flex:1}.slink-finance-head strong,.slink-finance-head small{display:block}.slink-finance-head small{margin-top:3px;color:var(--slink-muted);line-height:1.35}
        .slink-finance-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:7px;margin-top:9px}.slink-finance-stat{min-width:0;padding:8px;border:1px solid var(--slink-border-soft);border-radius:7px}.slink-finance-stat strong,.slink-finance-stat small{display:block}.slink-finance-stat strong{font-size:14px;overflow-wrap:anywhere}.slink-finance-stat small{margin-top:3px;color:var(--slink-muted);line-height:1.25}
        .slink-finance-settings{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:8px}.slink-finance-settings label{display:grid;gap:4px;color:var(--slink-muted)}.slink-finance-settings input:not([type="checkbox"]){width:100%;box-sizing:border-box;min-height:40px}
        .slink-stock-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr));gap:8px;margin-top:9px}.slink-stock-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;padding:10px;border:1px solid var(--slink-border-soft);border-radius:8px;background:var(--slink-bg)}.slink-stock-row>div,.slink-stock-row span{min-width:0}.slink-stock-row strong,.slink-stock-row small{display:block}.slink-stock-row small{margin-top:3px;color:var(--slink-muted);line-height:1.3}.slink-stock-title{min-width:0}.slink-stock-payout{text-align:right}.slink-stock-metrics{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.slink-stock-metrics span{padding:7px;border:1px solid var(--slink-border-soft);border-radius:6px}.slink-stock-row label{grid-column:1/-1;display:flex;gap:6px;align-items:center}
        .slink-finance-alerts{display:grid;gap:6px;margin-top:8px}.slink-finance-alert{padding:8px;border-left:3px solid var(--slink-warning);background:var(--slink-bg)}.slink-finance-alert strong,.slink-finance-alert small{display:block}.slink-finance-alert small{margin-top:3px}
        .slink-bank-terms{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));gap:8px}.slink-bank-terms small{display:block;margin-top:4px;line-height:1.4;color:var(--slink-muted)}.slink-bank-terms p{margin-bottom:0}.slink-bank-amount{display:grid;gap:6px;margin:10px 0}.slink-bank-amount input{box-sizing:border-box;width:100%;min-height:42px}
        @media(max-width:420px){.slink-finance-stats,.slink-finance-settings{grid-template-columns:1fr 1fr}.slink-stock-row{grid-template-columns:minmax(0,1fr)}.slink-stock-payout{text-align:left}.slink-stock-metrics,.slink-stock-row label{grid-column:1}.slink-stock-metrics{grid-template-columns:1fr 1fr}}
      `);

      function render() {
        if(stopped || context.signal?.aborted)return;
        const status = data?.status;
        const settings = data?.settings || CORE.normalizeSettings();
        if (!status) {
          mounted = false;stocks.clear();
          root.innerHTML = `<div class="slink-money-property"><article class="slink-finance-card"><div class="slink-finance-head"><div><strong>Money &amp; Property</strong><small>Bank, property, Duke loan, and stock-benefit planning.</small></div><button type="button" data-money-refresh>${busy ? 'Checking…' : 'Refresh'}</button></div><p>${escapeHtml(data?.lastError || 'Refresh to load your Torn financial information.')}</p></article></div>`;
          return;
        }
        const property = status.currentProperty;
        const markup = `<div class="slink-money-property">
          <article class="slink-finance-card"><div class="slink-finance-head"><div><strong>Money &amp; Property</strong><small data-money-readonly="updated">Updated ${relativeTime(data.fetchedAt)}</small></div><button type="button" data-money-refresh>${busy ? 'Checking…' : 'Refresh'}</button></div>
            <p data-money-readonly="error">${escapeHtml(data.lastError || '')}</p><p data-money-readonly="notice">${escapeHtml(notice)}</p>
            <div class="slink-finance-stats" data-money-readonly="balances"><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(status.money.cashOnHand))}">${money(status.money.cashOnHand)}</strong><small>Cash on hand</small></div><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(status.money.factionCash))}">${money(status.money.factionCash)}</strong><small>Faction armory cash</small></div><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(status.money.availableCash))}">${money(status.money.availableCash)}</strong><small>Available for alerts</small></div><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(status.money.vaultCash))}">${money(status.money.vaultCash)}</strong><small>Property vault</small></div></div>
          </article>
          <article class="slink-finance-card"><div class="slink-finance-head"><strong>Bank and obligations</strong><a href="${CORE.BANK_URL}">Open bank</a></div>
            <div class="slink-finance-stats" data-money-readonly="obligations"><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(status.bank.amount))}">${money(status.bank.amount)}</strong><small>Bank investment</small></div><div class="slink-finance-stat"><strong>${due(status.bank.maturedAt)}</strong><small>Bank maturity</small></div><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(status.loan.amount))}">${money(status.loan.amount)}</strong><small>Duke loan</small></div><div class="slink-finance-stat"><strong>${status.cashierChecks.length}</strong><small>Cashier checks returned</small></div></div>
          </article>
          <article class="slink-finance-card"><div class="slink-finance-head"><strong>Current property</strong><a href="${CORE.PROPERTY_URL}">Open properties</a></div>
            <div data-money-readonly="property">${property ? `<p><strong>${escapeHtml(property.name)}</strong> · rental ${due(property.rentalEndsAt)}</p><div class="slink-finance-stats"><div class="slink-finance-stat"><strong>${Number.isFinite(property.upkeepOwed) ? money(property.upkeepOwed) : '—'}</strong><small>${Number.isFinite(property.upkeepOwed) ? 'Upkeep owed' : 'Owed upkeep is not exposed by Torn API'}</small></div><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(property.upkeepPerDay))}">${money(property.upkeepPerDay)}</strong><small>Daily upkeep (property + staff)</small></div><div class="slink-finance-stat"><strong>${property.leaseExtension ? escapeHtml(property.leaseExtension.status) : 'None'}</strong><small>Extension offer</small></div></div>` : '<p>No property details were returned.</p>'}</div>
          </article>
          ${bankCard(status,settings)}
          <article class="slink-finance-card"><details id="money-reminder-settings"><summary><strong>Reminder settings</strong></summary><div class="slink-finance-settings">
            <label>Bank warning (hours)<input type="number" min="0" max="168" id="money-setting-bankLeadHours" data-money-setting="bankLeadHours" value="${settings.bankLeadHours}"></label>
            <label>Rental warning (days)<input type="number" min="0" max="30" id="money-setting-rentalLeadDays" data-money-setting="rentalLeadDays" value="${settings.rentalLeadDays}"></label>
            <label>Cashier-check warning (hours)<input type="number" min="0" max="168" id="money-setting-cashierLeadHours" data-money-setting="cashierLeadHours" value="${settings.cashierLeadHours}"></label>
            <label>Upkeep alert threshold<input type="number" min="0" step="1000" id="money-setting-upkeepThreshold" data-money-setting="upkeepThreshold" value="${settings.upkeepThreshold}"></label>
            <label><input type="checkbox" id="money-setting-loanReminder" data-money-setting="loanReminder" ${settings.loanReminder ? 'checked' : ''}> Remind me about Loan Shark</label>
            <label><input type="checkbox" id="money-setting-soundEnabled" data-money-setting="soundEnabled" ${settings.soundEnabled ? 'checked' : ''}> Play alert sounds</label>
            <div role="status"><span data-money-save-state></span> <button type="button" data-money-retry hidden>Retry</button></div>
          </div></details></article>
          <article class="slink-finance-card"><div class="slink-finance-head"><div><strong>Stock benefit ROI</strong><small>Estimated from current share price and Torn benefit data.</small></div><a href="${CORE.STOCKS_URL}">Open stocks</a></div>
            <div class="slink-stock-list">${status.stocks.map(stock => stockCard(stock, settings)).join('')}<p data-money-stock-empty>No income-producing stock benefit could be valued from Torn’s current stock and item data.</p></div>
          </article>
          <article class="slink-finance-card"><strong>Active reminders</strong><div class="slink-finance-alerts" data-money-readonly="alerts">${data.activeAlerts?.length ? data.activeAlerts.map(alert => `<div class="slink-finance-alert"><strong>${escapeHtml(alert.title)}</strong><small>${escapeHtml(alert.detail)}</small></div>`).join('') : '<p>Nothing needs your attention right now.</p>'}</div></article>
        </div>`;
        const initialMount = !mounted;
        if (!mounted) {
          root.innerHTML = markup;mounted = true;
          for (const node of root.querySelectorAll('.slink-stock-row')) stocks.set(node.querySelector('[data-stock-alert]').dataset.stockAlert,node);
        } else {
          const fresh = document.createElement('div');fresh.innerHTML = markup;
          for (const node of root.querySelectorAll('[data-money-readonly]')) {
            const replacement = fresh.querySelector('[data-money-readonly="' + node.dataset.moneyReadonly + '"]');
            if (replacement) patchHtml(node,replacement.innerHTML);
          }
          const present = new Set();
          for (const row of fresh.querySelectorAll('.slink-stock-row')) {
            const key = row.querySelector('[data-stock-alert]').dataset.stockAlert;
            present.add(key);
            const current = stocks.get(key);
            if (!current) {
              root.querySelector('.slink-stock-list').insertBefore(row,root.querySelector('[data-money-stock-empty]'));
              stocks.set(key,row);
            } else {
              for (const selector of ['.slink-stock-title','.slink-stock-payout','.slink-stock-metrics']) patchHtml(current.querySelector(selector),row.querySelector(selector).innerHTML);
            }
          }
          for (const [key,node] of stocks) if (!present.has(key)) {node.remove();stocks.delete(key);}
        }
        for (const node of root.querySelectorAll('[data-money-readonly]')) if (node.tagName === 'P') node.hidden = !node.textContent.trim();
        for (const [key,node] of stocks) fields[node.querySelector('[data-stock-alert]').id] = 'stock:' + key;
        root.querySelector('[data-money-stock-empty]').hidden = stocks.size !== 0;
        root.querySelector('[data-money-refresh]').disabled = busy || actionBusy;
        if (initialMount) autosave.mount();
        showSaveState();
      }

      async function load(force = false, refreshIfDue = true) {
        if (busy || stopped || context.signal?.aborted) return;
        busy = true;notice = '';
        if (mounted) root.querySelector('[data-money-refresh]').disabled = true;
        else render();
        const revision = settingsRevision;
        try {
          const response = await SLINK.core.messaging.send(force ? 'money-property.refresh' : 'money-property.status', {refreshIfDue});
          if (stopped || context.signal?.aborted) return;
          data = {...response,settings:revision === settingsRevision && !autosave.busy ? response.settings : data?.settings || response.settings};
          ui.setStatus(data.lastError || 'Money and property information ready.', data.lastError ? 'error' : 'ready');
        } catch (error) {
          if (stopped || context.signal?.aborted) return;
          notice = SLINK.core.format.errorMessage(error);ui.setStatus(notice,'error');
        } finally {busy = false;render();schedulePreview();}
      }

      context.listen(root,'click',async event => {
        if (stopped || context.signal?.aborted) return;
        if (event.target.closest('[data-money-retry]')) {void autosave.retry().catch(() => {});return;}
        if (!event.target.closest('[data-money-refresh]') || busy || actionBusy) return;
        actionBusy = true;render();
        try {
          await autosave.flush();
          if (stopped || context.signal?.aborted) return;
          if (previewTimer) global.clearTimeout(previewTimer);
          previewTimer = null;previewPending = false;
          await load(true);
        } catch (error) {notice = SLINK.core.format.errorMessage(error);}
        finally {actionBusy = false;render();schedulePreview();}
      });
      context.listen(root,'input',event => {
        if (!stopped && event.target.matches('[data-bank-amount]')) updateBankPreview();
      });

      await load(false);
      return { async stop() {
        stopped = true;previewPending = false;
        if (previewTimer) global.clearTimeout(previewTimer);
        await autosave.stop();
      } };
    }
  });
})(globalThis);
