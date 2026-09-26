(function registerDollarBazaarsModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before $1 Bazaars.');

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  const money = value => `$${Math.max(0, Math.trunc(Number(value) || 0)).toLocaleString('en-US')}`;
  const relativeTime = timestamp => {
    if (!Number(timestamp)) return 'not checked yet';
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ago`;
  };

  SLINK.modules.register({
    id:'dollarBazaars',
    title:'SLINK $1 Bazaars',
    shortTitle:'$1 Bazaars',
    group:'efficiency',
    groupTitle:'Efficiency',
    requiredScopes:[SLINK.core.adhd.ALERT_SCOPE],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      let stopped = false;
      let current = null;
      let apiTimer = null;
      let clockTimer = null;

      ui.setModuleStyles(`
        .slink-dollar-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.slink-dollar-summary>div{padding:7px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control);text-align:center}.slink-dollar-summary strong,.slink-dollar-summary span{display:block}.slink-dollar-summary span{color:var(--slink-muted);font-size:9px}
        .slink-dollar-list{display:grid;gap:6px;max-height:440px;overflow:auto;padding-right:2px}.slink-dollar-row{padding:7px;border:1px solid var(--slink-border-soft);border-left:3px solid var(--slink-ready);border-radius:7px;background:var(--slink-bg-control)}.slink-dollar-row header{display:flex;align-items:start;justify-content:space-between;gap:7px}.slink-dollar-row header>div{min-width:0}.slink-dollar-row strong,.slink-dollar-row small{display:block}.slink-dollar-row small{color:var(--slink-muted)}.slink-dollar-row .slink-dollar-total{flex:0 0 auto;color:var(--slink-ready);text-align:right}.slink-dollar-row footer{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:6px}.slink-dollar-row a{display:inline-flex;min-height:24px;align-items:center;padding:2px 7px;border-radius:5px;background:var(--slink-accent);color:#fff;text-decoration:none}.slink-dollar-empty{padding:18px 8px;color:var(--slink-muted);text-align:center}
      `);

      function setStatus() {
        if (!current) return;
        const message = current.lastError
          ? `${current.lastError}${current.fetchedAt ? ` · showing results from ${relativeTime(current.fetchedAt)}` : ''}`
          : current.fetchedAt ? `Weaver API updated ${relativeTime(current.fetchedAt)} · cached for one hour` : 'Ready for the first Weaver API refresh';
        ui.setStatus(message, current.lastError ? 'error' : current.fetchedAt ? 'ready' : 'normal');
      }

      function render(status) {
        current = status;
        setStatus();
        const bazaars = Array.isArray(status?.bazaars) ? [...status.bazaars].sort((left, right) => Number(right.totalValue) - Number(left.totalValue)) : [];
        const next = Number(status?.nextRefreshAt) ? new Date(status.nextRefreshAt).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }) : '—';
        ui.getContentElement().innerHTML = `<div class="slink-dollar-summary"><div><strong>${bazaars.length}</strong><span>bazaars</span></div><div><strong>${status?.fetchedAt ? escapeHtml(relativeTime(status.fetchedAt)) : '—'}</strong><span>updated</span></div><div><strong>${escapeHtml(next)}</strong><span>next API update</span></div></div>
          <div class="slink-dollar-list">${bazaars.length ? bazaars.map(bazaar => `<article class="slink-dollar-row"><header><div><strong>${escapeHtml(bazaar.sellerName)} [${Number(bazaar.sellerId)}]</strong><small>${Number(bazaar.itemCount).toLocaleString('en-US')} $1 item${Number(bazaar.itemCount) === 1 ? '' : 's'}</small></div><div class="slink-dollar-total"><strong>${money(bazaar.totalValue)}</strong><small>total market value</small></div></header><footer><small>Weaver bazaar total</small><a href="${escapeHtml(bazaar.href)}" target="_blank" rel="noopener noreferrer">Open bazaar</a></footer></article>`).join('') : `<div class="slink-dollar-empty">${status?.lastError ? 'The refresh failed and there are no saved results yet.' : 'Weaver returned no active $1 Bazaars.'}</div>`}</div>`;
      }

      async function load(refreshIfDue = true) {
        try { render(await SLINK.core.messaging.send('market.dollar.status', { refreshIfDue })); }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
      }

      ui.setActions([{ id:'refresh', label:'Refresh $1 Bazaars', onClick:async event => {
        event.currentTarget.disabled = true;
        try { render(await SLINK.core.messaging.send('market.dollar.refresh')); }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
        finally { event.currentTarget.disabled = false; }
      } }]);
      await load(false);
      apiTimer = global.setInterval(() => { if (!stopped) void load(true); }, 60_000);
      clockTimer = global.setInterval(() => { if (!stopped) setStatus(); }, 1_000);
      return { stop() { stopped = true; if (apiTimer) global.clearInterval(apiTimer); if (clockTimer) global.clearInterval(clockTimer); } };
    }
  });
})(globalThis);
