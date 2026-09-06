(function registerPlayerStatsModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Player Stats.');

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function countWithAverage(value, days, decimals = 0) {
    const number = finite(value);
    if (number === null) return '—';
    return `${number.toLocaleString('en-US', { maximumFractionDigits:decimals })} <small>(${(number / days).toLocaleString('en-US', { maximumFractionDigits:2 })}/d)</small>`;
  }

  function activityAverage(value, days) {
    const number = finite(value);
    return number === null ? '—' : `${(number / days / 3600).toLocaleString('en-US', { maximumFractionDigits:2 })}h/d`;
  }

  function money(value) {
    const number = finite(value);
    return number === null ? '—' : `$${Math.round(number).toLocaleString('en-US')}`;
  }

  function trend(value, days = 0) {
    const number = finite(value);
    if (number === null) return '<strong>—</strong>';
    const sign = number > 0 ? '+' : number < 0 ? '−' : '';
    const className = number > 0 ? 'positive' : number < 0 ? 'negative' : '';
    const daily = days ? ` <small>(${sign}$${Math.round(Math.abs(number / days)).toLocaleString('en-US')}/d)</small>` : '';
    return `<strong class="${className}">${sign}$${Math.round(Math.abs(number)).toLocaleString('en-US')}${daily}</strong>`;
  }

  SLINK.modules.register({
    id:'player-stats',
    title:'Player Stats',
    shortTitle:'Stats',
    group:'combat',
    groupTitle:'Combat',
    defaultShowInTorn:true,
    requiredScopes:[],
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      let stopped = false;
      let timer = null;

      ui.setModuleStyles(`
        .slink-stats-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
        .slink-stat-card{min-width:0;padding:8px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control)}
        .slink-stat-card h3{margin:0 0 5px;padding-bottom:4px;border-bottom:1px solid var(--slink-border-soft);font-size:11px}
        .slink-stat-table{display:grid;gap:3px}.slink-stat-row,.slink-stat-head{display:grid;grid-template-columns:minmax(48px,1fr) minmax(52px,auto) minmax(58px,auto);gap:4px;align-items:start}
        .slink-stat-head{color:var(--slink-muted);font-size:9px;text-align:right}.slink-stat-row>span{color:var(--slink-muted)}.slink-stat-row strong{text-align:right;white-space:nowrap}.slink-stat-row small{display:block;color:var(--slink-muted);font-size:8px;font-weight:400}
        .slink-stat-list{display:grid;gap:3px}.slink-stat-list>div{display:flex;justify-content:space-between;gap:6px}.slink-stat-list span{color:var(--slink-muted)}.slink-stat-list strong{text-align:right}.slink-stat-list small{display:block;color:var(--slink-muted);font-size:8px;font-weight:400}
        .slink-workstats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.slink-workstats>div{padding:5px;border-radius:5px;background:var(--slink-bg)}.slink-workstats span,.slink-workstats strong{display:block}.slink-workstats span{color:var(--slink-muted);font-size:9px}
        .slink-stat-wide{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:8px}.slink-stat-wide span{color:var(--slink-muted)}.slink-stat-wide strong{font-size:14px}.positive{color:var(--slink-ready)}.negative{color:var(--slink-error)}
      `);

      function table(title, rows, seven, thirty) {
        return `<section class="slink-stat-card"><h3>${title}</h3><div class="slink-stat-table"><div class="slink-stat-head"><span></span><b>7 days</b><b>30 days</b></div>${rows.map(([label, property, decimals = 0, formatter = countWithAverage]) => `<div class="slink-stat-row"><span>${label}</span><strong>${formatter(seven[property], 7, decimals)}</strong><strong>${formatter(thirty[property], 30, decimals)}</strong></div>`).join('')}</div></section>`;
      }

      function render(status) {
        const snapshot = status?.data;
        if (!snapshot) {
          ui.setStatus(status?.error || (status?.configured ? 'No daily player snapshot has been collected yet.' : 'Add a Torn API key in the extension dashboard first.'), status?.error ? 'error' : 'normal');
          ui.getContentElement().innerHTML = '<div class="slink-stat-card">Player stats update once per Torn day and stay in this browser.</div>';
          return;
        }
        const seven = snapshot.periods?.[7] || {};
        const thirty = snapshot.periods?.[30] || {};
        const work = snapshot.workstats || {};
        ui.setStatus(status?.error || `Updated ${new Date(snapshot.refreshedAt).toLocaleString()} · daily after 00:00 TCT`, status?.error ? 'error' : 'ready');
        ui.getContentElement().innerHTML = `<div class="slink-stats-grid">
          ${table('Consumables', [['Xanax','xanax'],['Energy cans','energyDrinks'],['Refills','refills']], seven, thirty)}
          ${table('Combat', [['Attacks','attacks'],['Respect','respect',2],['Retals','retals'],['Activity','activitySeconds',0,activityAverage]], seven, thirty)}
          <section class="slink-stat-card"><h3>Networth</h3><div class="slink-stat-list"><div><span>Current</span><strong>${money(snapshot.networth?.current)}</strong></div><div><span>Yesterday</span>${trend(snapshot.networth?.yesterday)}</div><div><span>Day before</span>${trend(snapshot.networth?.dayBeforeYesterday)}</div><div><span>7 days</span>${trend(snapshot.networth?.sevenDays, 7)}</div><div><span>30 days</span>${trend(snapshot.networth?.thirtyDays, 30)}</div></div></section>
          <section class="slink-stat-card"><h3>Working stats</h3><div class="slink-workstats">${[['Manual',work.manualLabor],['Intelligence',work.intelligence],['Endurance',work.endurance],['Total',work.total]].map(([label,value]) => `<div><span>${label}</span><strong>${finite(value) === null ? '—' : Number(value).toLocaleString('en-US')}</strong></div>`).join('')}</div></section>
          <section class="slink-stat-card slink-stat-wide"><span>Current armory balance</span><strong>${money(snapshot.armoryBalance)}</strong></section>
        </div>`;
      }

      async function load(refreshIfStale = true) {
        try { render(await SLINK.core.messaging.send('playerStats.status', { refreshIfStale })); }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
      }

      ui.setActions([{ id:'refresh', label:'Refresh stats', onClick:async event => {
        event.currentTarget.disabled = true;
        try { render(await SLINK.core.messaging.send('playerStats.refresh')); }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
        finally { event.currentTarget.disabled = false; }
      } }]);
      await load(true);
      timer = global.setInterval(() => { if (!stopped) void load(true); }, 60_000);
      return { stop() { stopped = true; if (timer) global.clearInterval(timer); } };
    }
  });
})(globalThis);
