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

      ui.setModuleStyles(`
        .slink-money-property{display:grid;gap:10px}.slink-finance-card{min-width:0;padding:11px;border:1px solid var(--slink-border-soft);border-radius:9px;background:var(--slink-bg-control)}
        .slink-finance-head,.slink-finance-actions{display:flex;gap:9px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.slink-finance-head>div{min-width:0;flex:1}.slink-finance-head strong,.slink-finance-head small{display:block}.slink-finance-head small{margin-top:3px;color:var(--slink-muted);line-height:1.35}
        .slink-finance-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:7px;margin-top:9px}.slink-finance-stat{min-width:0;padding:8px;border:1px solid var(--slink-border-soft);border-radius:7px}.slink-finance-stat strong,.slink-finance-stat small{display:block}.slink-finance-stat strong{font-size:14px;overflow-wrap:anywhere}.slink-finance-stat small{margin-top:3px;color:var(--slink-muted);line-height:1.25}
        .slink-finance-settings{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:8px}.slink-finance-settings label{display:grid;gap:4px;color:var(--slink-muted)}.slink-finance-settings input:not([type="checkbox"]){width:100%;box-sizing:border-box;min-height:40px}
        .slink-stock-list{display:grid;gap:8px;margin-top:9px}.slink-stock-row{display:grid;grid-template-columns:minmax(170px,1.35fr) repeat(3,minmax(105px,1fr));gap:9px;align-items:start;padding:9px;border:1px solid var(--slink-border-soft);border-radius:7px}.slink-stock-row>div{min-width:0}.slink-stock-row strong,.slink-stock-row small{display:block}.slink-stock-row small{margin-top:3px;color:var(--slink-muted);line-height:1.3}.slink-stock-row label{grid-column:1/-1;display:flex;gap:6px;align-items:center}
        .slink-finance-alerts{display:grid;gap:6px;margin-top:8px}.slink-finance-alert{padding:8px;border-left:3px solid var(--slink-warning);background:var(--slink-bg)}.slink-finance-alert strong,.slink-finance-alert small{display:block}.slink-finance-alert small{margin-top:3px}
        @media(max-width:760px){.slink-stock-row{grid-template-columns:repeat(2,minmax(0,1fr))}.slink-stock-row>div:first-child{grid-column:1/-1}}@media(max-width:420px){.slink-finance-stats,.slink-finance-settings,.slink-stock-row{grid-template-columns:1fr 1fr}}
      `);

      function render() {
        const status = data?.status;
        const settings = data?.settings || CORE.normalizeSettings();
        if (!status) {
          root.innerHTML = `<div class="slink-money-property"><article class="slink-finance-card"><div class="slink-finance-head"><div><strong>Money &amp; Property</strong><small>Bank, property, Duke loan, and stock-benefit planning.</small></div><button type="button" data-money-refresh>${busy ? 'Checking…' : 'Refresh'}</button></div><p>${escapeHtml(data?.lastError || 'Refresh to load your Torn financial information.')}</p></article></div>`;
          return;
        }
        const property = status.currentProperty;
        root.innerHTML = `<div class="slink-money-property">
          <article class="slink-finance-card"><div class="slink-finance-head"><div><strong>Money &amp; Property</strong><small>Updated ${relativeTime(data.fetchedAt)}</small></div><button type="button" data-money-refresh>${busy ? 'Checking…' : 'Refresh'}</button></div>
            ${data.lastError ? `<p>${escapeHtml(data.lastError)}</p>` : ''}${notice ? `<p>${escapeHtml(notice)}</p>` : ''}
            <div class="slink-finance-stats"><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(status.money.cashOnHand))}">${money(status.money.cashOnHand)}</strong><small>Cash on hand</small></div><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(status.money.factionCash))}">${money(status.money.factionCash)}</strong><small>Faction armory cash</small></div><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(status.money.availableCash))}">${money(status.money.availableCash)}</strong><small>Available for alerts</small></div><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(status.money.vaultCash))}">${money(status.money.vaultCash)}</strong><small>Property vault</small></div></div>
          </article>
          <article class="slink-finance-card"><div class="slink-finance-head"><strong>Bank and obligations</strong><a href="${CORE.BANK_URL}">Open bank</a></div>
            <div class="slink-finance-stats"><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(status.bank.amount))}">${money(status.bank.amount)}</strong><small>Bank investment</small></div><div class="slink-finance-stat"><strong>${due(status.bank.maturedAt)}</strong><small>Bank maturity</small></div><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(status.loan.amount))}">${money(status.loan.amount)}</strong><small>Duke loan</small></div><div class="slink-finance-stat"><strong>${status.cashierChecks.length}</strong><small>Cashier checks returned</small></div></div>
          </article>
          <article class="slink-finance-card"><div class="slink-finance-head"><strong>Current property</strong><a href="${CORE.PROPERTY_URL}">Open properties</a></div>
            ${property ? `<p><strong>${escapeHtml(property.name)}</strong> · rental ${due(property.rentalEndsAt)}</p><div class="slink-finance-stats"><div class="slink-finance-stat"><strong>${Number.isFinite(property.upkeepOwed) ? money(property.upkeepOwed) : '—'}</strong><small>${Number.isFinite(property.upkeepOwed) ? 'Upkeep owed' : 'Owed upkeep is not exposed by Torn API'}</small></div><div class="slink-finance-stat"><strong title="${escapeHtml(exactMoney(property.upkeepPerDay))}">${money(property.upkeepPerDay)}</strong><small>Daily upkeep (property + staff)</small></div><div class="slink-finance-stat"><strong>${property.leaseExtension ? escapeHtml(property.leaseExtension.status) : 'None'}</strong><small>Extension offer</small></div></div>` : '<p>No property details were returned.</p>'}
          </article>
          <article class="slink-finance-card"><details><summary><strong>Reminder settings</strong></summary><div class="slink-finance-settings">
            <label>Bank warning (hours)<input type="number" min="0" max="168" data-money-setting="bankLeadHours" value="${settings.bankLeadHours}"></label>
            <label>Rental warning (days)<input type="number" min="0" max="30" data-money-setting="rentalLeadDays" value="${settings.rentalLeadDays}"></label>
            <label>Cashier-check warning (hours)<input type="number" min="0" max="168" data-money-setting="cashierLeadHours" value="${settings.cashierLeadHours}"></label>
            <label>Upkeep alert threshold<input type="number" min="0" step="1000" data-money-setting="upkeepThreshold" value="${settings.upkeepThreshold}"></label>
            <label><input type="checkbox" data-money-setting="loanReminder" ${settings.loanReminder ? 'checked' : ''}> Remind me about Loan Shark</label>
            <label><input type="checkbox" data-money-setting="soundEnabled" ${settings.soundEnabled ? 'checked' : ''}> Play alert sounds</label>
            <button type="button" data-money-save>Save reminder settings</button>
          </div></details></article>
          <article class="slink-finance-card"><div class="slink-finance-head"><div><strong>Stock benefit ROI</strong><small>Estimated from current share price and Torn benefit data.</small></div><a href="${CORE.STOCKS_URL}">Open stocks</a></div>
            <div class="slink-stock-list">${status.stocks.length ? status.stocks.map(stock => `<div class="slink-stock-row"><div><strong>${escapeHtml(stock.name)} ${escapeHtml(stock.acronym)}</strong><small>${escapeHtml(stock.benefitDescription)}</small></div><div><strong title="${escapeHtml(exactMoney(stock.incrementalCost))}">${money(stock.incrementalCost)}</strong><small>Cost · ${stock.sharesNeeded.toLocaleString()} shares needed</small></div><div><strong>${money(stock.weeklyValue)}</strong><small>Weekly estimate · ROI ${percent(stock.weeklyRoi)}</small></div><div><strong>${money(stock.monthlyValue)}</strong><small>Monthly estimate · ROI ${percent(stock.monthlyRoi)}</small></div><label><input type="checkbox" data-stock-alert="${escapeHtml(stock.alertKey)}" ${settings.stockAlerts[stock.alertKey] ? 'checked' : ''}> Alert when affordable</label></div>`).join('') : '<p>No stock-benefit tiers were returned.</p>'}</div>
          </article>
          <article class="slink-finance-card"><strong>Active reminders</strong><div class="slink-finance-alerts">${data.activeAlerts?.length ? data.activeAlerts.map(alert => `<div class="slink-finance-alert"><strong>${escapeHtml(alert.title)}</strong><small>${escapeHtml(alert.detail)}</small></div>`).join('') : '<p>Nothing needs your attention right now.</p>'}</div></article>
        </div>`;
      }

      async function load(force = false) {
        if (busy) return;
        busy = true; notice = ''; render();
        try {
          data = await SLINK.core.messaging.send(force ? 'money-property.refresh' : 'money-property.status', { refreshIfDue:true });
          ui.setStatus(data.lastError || 'Money and property information ready.', data.lastError ? 'error' : 'ready');
        } catch (error) {
          notice = SLINK.core.format.errorMessage(error);
          ui.setStatus(notice, 'error');
        } finally { busy = false; render(); }
      }

      root.addEventListener('click', async event => {
        if (event.target.closest('[data-money-refresh]')) { void load(true); return; }
        const save = event.target.closest('[data-money-save]');
        if (save) {
          save.disabled = true;
          try {
            const value = name => root.querySelector(`[data-money-setting="${name}"]`);
            data = await SLINK.core.messaging.send('money-property.settings.save', {
              bankLeadHours:value('bankLeadHours')?.value,
              rentalLeadDays:value('rentalLeadDays')?.value,
              cashierLeadHours:value('cashierLeadHours')?.value,
              upkeepThreshold:value('upkeepThreshold')?.value,
              loanReminder:value('loanReminder')?.checked,
              soundEnabled:value('soundEnabled')?.checked
            });
            notice = 'Money and property reminder settings saved.';
          } catch (error) { notice = SLINK.core.format.errorMessage(error); }
          render();
        }
      });

      root.addEventListener('change', async event => {
        const control = event.target.closest('[data-stock-alert]');
        if (!control) return;
        control.disabled = true;
        try {
          data = await SLINK.core.messaging.send('money-property.stock-alert', { key:control.dataset.stockAlert, enabled:control.checked });
          notice = control.checked ? 'Stock affordability alert enabled.' : 'Stock affordability alert disabled.';
        } catch (error) { notice = SLINK.core.format.errorMessage(error); }
        render();
      });

      await load(false);
      return { stop() {} };
    }
  });
})(globalThis);
