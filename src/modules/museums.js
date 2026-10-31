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
      let stopped = false;
      let actionBusy = false;
      const panels = new Map();
      const previousExplicit = root.dataset.uiExplicitCommit;
      root.dataset.uiExplicitCommit = 'true';
      const guard = SLINK.core.formState.protect(root.getRootNode?.() || root);
      root.innerHTML = '<div class="slink-museum"><article class="slink-museum-summary"><div class="slink-museum-head"><div><strong>Museum Sets</strong><small data-museum-progress></small></div><button type="button" data-museum-refresh>Refresh inventory</button></div><p data-museum-updated></p><p data-museum-notice role="status"></p></article><div class="slink-museum" data-museum-sets></div></div>';
      const text = (node,value) => {if (node.textContent !== value) node.textContent = value;};
      function validatePrice(input) {
        const value = Number(input.value);
        const valid = String(input.value).trim() !== '' && Number.isSafeInteger(value) && value > 0;
        input.setAttribute('aria-invalid',String(!valid));return valid;
      }

      ui.setModuleStyles(`
        .slink-museum{display:grid;gap:9px}.slink-museum-summary,.slink-museum-set{min-width:0;padding:10px;border:1px solid var(--slink-border-soft);border-radius:8px;background:var(--slink-bg-control)}
        .slink-museum-head,.slink-museum-actions{display:flex;gap:8px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.slink-museum-head>div{min-width:0;flex:1}.slink-museum-head strong,.slink-museum-head small{display:block}.slink-museum-head small{margin-top:3px;color:var(--slink-muted);line-height:1.35}
        .slink-museum-items{display:grid;gap:7px;margin-top:9px}.slink-museum-item{display:grid;grid-template-columns:minmax(0,1fr) minmax(135px,auto);gap:9px;align-items:center;padding:8px;border:1px solid var(--slink-border-soft);border-radius:7px}.slink-museum-item>div:first-child{min-width:0}
        .slink-museum-item strong,.slink-museum-item small{display:block}.slink-museum-item small{margin-top:3px;color:var(--slink-muted);line-height:1.35}.slink-museum-item.complete{opacity:.68}.slink-museum-market{display:grid;grid-template-columns:minmax(105px,1fr) minmax(120px,auto);gap:6px;align-items:end}.slink-museum-market input{box-sizing:border-box;width:100%;min-height:40px}.slink-museum-market button{min-height:40px}
        .slink-museum-set summary{cursor:pointer;font-weight:700;line-height:1.4}.slink-museum-good{color:var(--slink-ready)}.slink-museum-missing{color:var(--slink-warning)}
        .slink-museum-market input[aria-invalid="true"]{border-color:var(--slink-error)}
        @media(max-width:620px){.slink-museum-item,.slink-museum-market{grid-template-columns:1fr}}
      `);

      function render() {
        if (stopped || context.signal?.aborted) return;
        const sets = status?.sets || [];
        const progress = root.querySelector('[data-museum-progress]');
        text(progress,status?.summary ? `${status.summary.completed}/${status.summary.total} currently complete · ${Number(status.summary.redeemablePoints).toLocaleString()} redeemable points` : 'Compare your inventory against every Museum set.');
        text(root.querySelector('[data-museum-updated]'),status?.fetchedAt ? `Updated ${relativeTime(status.fetchedAt)}. Torn caches inventory by category for one hour.` : 'Refresh to load your inventory.');
        const message = root.querySelector('[data-museum-notice]');text(message,notice || status?.lastError || '');message.hidden = !message.textContent;
        const refresh = root.querySelector('[data-museum-refresh]');refresh.disabled = busy;text(refresh,busy ? 'Checking…' : 'Refresh inventory');
        const presentSets = new Set();
        for (const set of sets) {
          presentSets.add(set.id);
          let panel = panels.get(set.id);
          if (!panel) {
            const node = document.createElement('details');node.className = 'slink-museum-set';node.id = 'museum-set-' + encodeURIComponent(set.id);node.dataset.museumSet = set.id;node.open = !set.complete;
            node.innerHTML = '<summary></summary><div class="slink-museum-head"><small></small></div><div class="slink-museum-items"></div>';
            panel = {node,rows:new Map()};panels.set(set.id,panel);root.querySelector('[data-museum-sets]').append(node);
          }
          const summary = panel.node.querySelector('summary');
          const summaryHtml = `<span class="${set.complete ? 'slink-museum-good' : 'slink-museum-missing'}">${set.complete ? 'Complete' : 'Needs items'}</span> · ${escapeHtml(set.name)} · ${set.points.toLocaleString()} points`;
          if (summary.innerHTML !== summaryHtml) summary.innerHTML = summaryHtml;
          text(panel.node.querySelector('.slink-museum-head small'),`${set.completeSets} complete set${set.completeSets === 1 ? '' : 's'} in inventory`);
          let abroad = panel.node.querySelector('[data-museum-abroad]');
          if (set.travel && !abroad) {abroad = document.createElement('button');abroad.type = 'button';abroad.dataset.museumAbroad = set.id;abroad.textContent = 'Track in Abroad Stocks';panel.node.querySelector('.slink-museum-head').append(abroad);}
          if (!set.travel) abroad?.remove();
          const presentItems = new Set();
          for (const item of set.items) {
            const key = item.name;presentItems.add(key);
            let row = panel.rows.get(key);
            if (!row) {
              const node = document.createElement('div');node.className = 'slink-museum-item';node.innerHTML = '<div><strong></strong><small></small></div>';
              row = {node,itemId:item.itemId};panel.rows.set(key,row);panel.node.querySelector('.slink-museum-items').append(node);
            }
            row.itemId = item.itemId;row.node.classList.toggle('complete',item.complete);
            text(row.node.querySelector('strong'),item.name);
            text(row.node.querySelector('small'),`Owned ${item.owned.toLocaleString()} / ${item.required.toLocaleString()}${item.needed ? ' · need ' + item.needed.toLocaleString() : ''}${item.marketPrice ? ' · market ' + money(item.marketPrice) : ''}`);
            let editor = row.node.querySelector('.slink-museum-market');
            if (!editor && item.needed && item.itemId) {
              editor = document.createElement('div');editor.className = 'slink-museum-market';
              editor.innerHTML = `<input id="museum-price-${escapeHtml(encodeURIComponent(set.id))}-${escapeHtml(encodeURIComponent(item.name))}" type="number" min="1" step="1" aria-label="Maximum price for ${escapeHtml(item.name)}" value="${Math.max(1,item.marketPrice)}"><button type="button">Add to Market Watch</button>`;
              row.node.append(editor);
            }
            // Keep an existing editor and its draft even if inventory now has
            // enough of this item. Only authoritative row removal deletes it.
            if (editor) {
              editor.querySelector('input').dataset.museumPrice = item.itemId;
              const button = editor.querySelector('button');button.dataset.museumMarket = item.itemId;button.dataset.museumSet = set.id;button.dataset.museumItem = key;button.disabled = actionBusy || !item.itemId;
            }
          }
          for (const [key,row] of panel.rows) if (!presentItems.has(key)) {row.node.remove();panel.rows.delete(key);}
        }
        for (const [id,panel] of panels) if (!presentSets.has(id)) {panel.node.remove();panels.delete(id);}
        root.querySelectorAll('[data-museum-abroad]').forEach(button => {button.disabled = actionBusy;});
      }

      async function load(force = false) {
        if (busy || stopped || context.signal?.aborted) return;
        busy = true; notice = ''; render();
        try {
          const response = await SLINK.core.messaging.send(force ? 'museum.refresh' : 'museum.status', { refreshIfDue:true });
          if (stopped || context.signal?.aborted) return;
          status = response;
          ui.setStatus(status.lastError || `${status.summary.completed}/${status.summary.total} Museum sets complete.`, status.lastError ? 'error' : 'ready');
        } catch (error) {
          if (stopped || context.signal?.aborted) return;
          notice = SLINK.core.format.errorMessage(error);
          ui.setStatus(notice, 'error');
        } finally { busy = false; render(); }
      }

      context.listen(root, 'click', async event => {
        if (stopped || context.signal?.aborted) return;
        if (event.target.closest('[data-museum-refresh]')) { void load(true); return; }
        if (actionBusy) return;
        const abroad = event.target.closest('[data-museum-abroad]');
        if (abroad) {
          const setId = abroad.dataset.museumAbroad;
          actionBusy = true;notice = '';render();
          try {
            const result = await SLINK.core.messaging.send('museum.abroad.track', { setId });
            if (stopped || context.signal?.aborted) return;
            if (!Number.isInteger(result?.added) || result.added < 0) throw new Error('Abroad Stocks did not confirm the new watches. Check Abroad Stocks before trying again.');
            notice = result.added ? `Added ${result.added} Abroad Stocks watch${result.added === 1 ? '' : 'es'}.` : 'All matching Abroad Stocks rows are already tracked. Refresh Abroad Stocks first if no rows were available.';
          } catch (error) { if (!stopped && !context.signal?.aborted) notice = SLINK.core.format.errorMessage(error); }
          finally {actionBusy = false;render();}
          return;
        }
        const market = event.target.closest('[data-museum-market]');
        if (market) {
          const row = panels.get(market.dataset.museumSet)?.rows.get(market.dataset.museumItem);
          const input = row?.node.querySelector('input');
          if (!input || !validatePrice(input)) {notice = 'Enter a maximum price of at least $1 in whole dollars.';render();input?.focus();return;}
          const itemId = row.itemId;
          const maxPrice = Number(input.value);
          const ticket = guard?.begin(input);
          actionBusy = true;notice = '';render();
          try {
            const result = await SLINK.core.messaging.send('museum.market.add', { itemId, maxPrice, priority:'normal' });
            if (result?.ok !== true || result.itemId !== itemId || result.maxPrice !== maxPrice) throw new Error('Market Watch did not confirm this item and price. Check Market Watch before trying again.');
            if (row.itemId === itemId) guard?.commit(ticket);
            if (!stopped && !context.signal?.aborted) notice = `Museum item added to Market Watch at ${money(maxPrice)}. It counts toward your active Market Watch slot limit.`;
          } catch (error) {if (!stopped && !context.signal?.aborted) notice = SLINK.core.format.errorMessage(error);}
          finally {actionBusy = false;render();}
        }
      });
      context.listen(root,'input',event => {if (!stopped && event.target.matches('[data-museum-price]')) validatePrice(event.target);});

      await load(false);
      return { stop() {
        stopped = true;
        if (previousExplicit === undefined) delete root.dataset.uiExplicitCommit;
        else root.dataset.uiExplicitCommit = previousExplicit;
      } };
    }
  });
})(globalThis);
