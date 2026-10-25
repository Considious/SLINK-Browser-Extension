(function registerMuseumModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Museums.');
  const MUSEUM = SLINK.core.museum;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  }

  function money(value) {
    return '$' + Math.max(0, Number(value) || 0).toLocaleString();
  }

  function relativeTime(timestamp) {
    if (!Number(timestamp)) return 'not checked yet';
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
    return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
  }

  SLINK.modules.register({
    id:'museums',
    title:'Museums',
    shortTitle:'Museums',
    group:'quality-of-life',
    groupTitle:'Quality of Life',
    requiredScopes:[MUSEUM.SCOPE],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      const root = ui.getContentElement();
      let status = null;
      let busy = false;
      let notice = '';

      ui.setModuleStyles(`
        .slink-museum{display:grid;gap:9px}.slink-museum-summary,.slink-museum-set{min-width:0;padding:10px;border:1px solid var(--slink-border-soft);border-radius:8px;background:var(--slink-bg-control)}
        .slink-museum-head,.slink-museum-actions{display:flex;gap:8px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.slink-museum-head>div{min-width:0;flex:1}.slink-museum-head strong,.slink-museum-head small{display:block}.slink-museum-head small{margin-top:3px;color:var(--slink-muted);line-height:1.35}
        .slink-museum-items{display:grid;gap:7px;margin-top:9px}.slink-museum-item{display:grid;grid-template-columns:minmax(0,1fr) minmax(135px,auto);gap:9px;align-items:center;padding:8px;border:1px solid var(--slink-border-soft);border-radius:7px}.slink-museum-item>div:first-child{min-width:0}
        .slink-museum-item strong,.slink-museum-item small{display:block}.slink-museum-item small{margin-top:3px;color:var(--slink-muted);line-height:1.35}.slink-museum-item.complete{opacity:.68}.slink-museum-market{display:grid;grid-template-columns:minmax(105px,1fr) minmax(120px,auto);gap:6px;align-items:end}.slink-museum-market input{box-sizing:border-box;width:100%;min-height:40px}.slink-museum-market button{min-height:40px}
        .slink-museum-set summary{cursor:pointer;font-weight:700;line-height:1.4}.slink-museum-good{color:var(--slink-ready)}.slink-museum-missing{color:var(--slink-warning)}
        @media(max-width:620px){.slink-museum-item,.slink-museum-market{grid-template-columns:1fr}}
      `);

      function render() {
        if (!status?.sets?.length) {
          root.innerHTML = `<div class="slink-museum"><article class="slink-museum-summary"><div class="slink-museum-head"><strong>Museum Sets</strong><button type="button" data-museum-refresh>${busy ? 'Checking…' : 'Refresh inventory'}</button></div><p>${escapeHtml(status?.lastError || 'Refresh to compare your inventory against every Museum set.')}</p></article></div>`;
          return;
        }
        root.innerHTML = `<div class="slink-museum">
          <article class="slink-museum-summary"><div class="slink-museum-head"><div><strong>Museum Sets</strong><small>${status.summary.completed}/${status.summary.total} currently complete · ${Number(status.summary.redeemablePoints).toLocaleString()} redeemable points</small></div><button type="button" data-museum-refresh>${busy ? 'Checking…' : 'Refresh inventory'}</button></div><p>Updated ${relativeTime(status.fetchedAt)}. Torn caches inventory by category for one hour.</p>${notice ? `<p>${escapeHtml(notice)}</p>` : ''}</article>
          ${status.sets.map(set => `<details class="slink-museum-set" ${set.complete ? '' : 'open'}><summary><span class="${set.complete ? 'slink-museum-good' : 'slink-museum-missing'}">${set.complete ? 'Complete' : 'Needs items'}</span> · ${escapeHtml(set.name)} · ${set.points.toLocaleString()} points</summary><div class="slink-museum-head"><small>${set.completeSets} complete set${set.completeSets === 1 ? '' : 's'} in inventory</small>${set.travel ? `<button type="button" data-museum-abroad="${escapeHtml(set.id)}">Track in Abroad Stocks</button>` : ''}</div><div class="slink-museum-items">${set.items.map(item => `<div class="slink-museum-item ${item.complete ? 'complete' : ''}"><div><strong>${escapeHtml(item.name)}</strong><small>Owned ${item.owned.toLocaleString()} / ${item.required.toLocaleString()}${item.needed ? ` · need ${item.needed.toLocaleString()}` : ''}${item.marketPrice ? ` · market ${money(item.marketPrice)}` : ''}</small></div>${item.needed && item.itemId ? `<div class="slink-museum-market"><input type="number" min="1" step="1" aria-label="Maximum price for ${escapeHtml(item.name)}" data-museum-price="${item.itemId}" value="${Math.max(1,item.marketPrice)}"><button type="button" data-museum-market="${item.itemId}">Add to Market Watch</button></div>` : ''}</div>`).join('')}</div></details>`).join('')}
        </div>`;
      }

      async function load(force = false) {
        if (busy) return;
        busy = true; notice = ''; render();
        try {
          status = await SLINK.core.messaging.send(force ? 'museum.refresh' : 'museum.status', { refreshIfDue:true });
          ui.setStatus(status.lastError || `${status.summary.completed}/${status.summary.total} Museum sets complete.`, status.lastError ? 'error' : 'ready');
        } catch (error) {
          notice = SLINK.core.format.errorMessage(error);
          ui.setStatus(notice, 'error');
        } finally { busy = false; render(); }
      }

      context.listen(root, 'click', async event => {
        if (event.target.closest('[data-museum-refresh]')) { void load(true); return; }
        const abroad = event.target.closest('[data-museum-abroad]');
        if (abroad) {
          abroad.disabled = true;
          try {
            const result = await SLINK.core.messaging.send('museum.abroad.track', { setId:abroad.dataset.museumAbroad });
            notice = result.added ? `Added ${result.added} Abroad Stocks watch${result.added === 1 ? '' : 'es'}.` : 'All matching Abroad Stocks rows are already tracked. Refresh Abroad Stocks first if no rows were available.';
          } catch (error) { notice = SLINK.core.format.errorMessage(error); }
          render(); return;
        }
        const market = event.target.closest('[data-museum-market]');
        if (market) {
          const itemId = Number(market.dataset.museumMarket);
          const maxPrice = Number(root.querySelector(`[data-museum-price="${itemId}"]`)?.value);
          market.disabled = true;
          try {
            await SLINK.core.messaging.send('museum.market.add', { itemId, maxPrice, priority:'normal' });
            notice = 'Museum item added to Market Watch. It counts toward your active Market Watch slot limit.';
          } catch (error) { notice = SLINK.core.format.errorMessage(error); }
          render();
        }
      });

      await load(false);
      return { stop() {} };
    }
  });
})(globalThis);
