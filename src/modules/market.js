(function registerMarketModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Market Watch.');
  const escapeHtml = value => SLINK.core.format.escapeHtml(value ?? '');

  function relativeTime(timestamp) {
    if (!Number(timestamp)) return 'not checked yet';
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
    return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
  }

  SLINK.modules.register({
    id:'market',
    title:'SLINK Market Watch',
    shortTitle:'Market',
    group:'efficiency',
    groupTitle:'Efficiency',
    permissionTest:permissions => SLINK.core.adhd.marketWatchLimit(permissions) > 0,
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      let stopped = false;
      let current = null;
      let timer = null;
      let clockTimer = null;
      let observer = null;
      let formatTimer = null;
      let shareArm = null;

      ui.setModuleStyles(`
        .slink-market-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.slink-market-summary>div{padding:7px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control);text-align:center}.slink-market-summary strong,.slink-market-summary small{display:block}.slink-market-summary small{color:var(--slink-muted)}
        .slink-market-list{display:grid;gap:7px}.slink-market-deal{padding:8px;border:1px solid var(--slink-border-soft);border-left:4px solid var(--slink-ready);border-radius:7px;background:var(--slink-bg-control)}.slink-market-deal strong,.slink-market-deal span{display:block}.slink-market-deal span{margin-top:2px;color:var(--slink-muted)}
        .slink-market-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.slink-market-actions a,.slink-market-actions button{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:4px 8px;border:1px solid var(--slink-border);border-radius:6px;background:var(--slink-bg);color:var(--slink-text);font:inherit;text-decoration:none;cursor:pointer}.slink-market-actions button:disabled{opacity:.45;cursor:not-allowed}.slink-market-empty{padding:16px;border-radius:7px;background:var(--slink-bg-control);color:var(--slink-muted);text-align:center}
      `);

      function focusedTornPage() {
        return document.visibilityState === 'visible' && document.hasFocus();
      }

      function copyText(text) {
        if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
        const textarea = document.createElement('textarea');
        textarea.value = text; textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
        document.body.append(textarea); textarea.select();
        const copied = document.execCommand('copy'); textarea.remove();
        return Promise.resolve(copied);
      }

      function factionContainer() {
        const exact = [...document.querySelectorAll('[id^="faction-"]')].find(node => node.querySelector('textarea[placeholder="Type your message here..."],textarea[class*="textarea"]'));
        if (exact) return exact;
        return [...document.querySelectorAll('div,section')].find(node => {
          const composer = node.querySelector('textarea[placeholder*="message" i],[contenteditable="true"]');
          const title = node.querySelector('button span,header span');
          return composer && String(title?.textContent || '').trim().toLowerCase() === 'faction';
        }) || null;
      }

      function factionLauncher() {
        return [...document.querySelectorAll('button,a,[role="button"]')].find(node => {
          const label = [node.getAttribute?.('aria-label'), node.getAttribute?.('title'), node.textContent].filter(Boolean).join(' ').trim().toLowerCase();
          return label === 'faction' || label.includes('faction chat') || label.includes('open faction');
        }) || null;
      }

      function composer(container) {
        return container?.querySelector('textarea[placeholder="Type your message here..."],textarea[class*="textarea"],textarea,[contenteditable="true"]') || null;
      }

      function setComposer(node, text) {
        node.focus();
        if (node.matches('textarea,input')) {
          const prototype = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (setter) setter.call(node, text); else node.value = text;
        } else {
          node.innerHTML = '';
          try { document.execCommand('insertHTML', false, text); } catch { node.innerHTML = text; }
        }
        node.dispatchEvent(new Event('input', { bubbles:true, composed:true }));
        node.dispatchEvent(new Event('change', { bubbles:true, composed:true }));
      }

      async function waitFor(check, timeoutMs = 2000) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
          const result = check(); if (result) return result;
          await new Promise(resolve => global.setTimeout(resolve, 75));
        }
        return null;
      }

      async function sendToFaction(text) {
        if (!focusedTornPage()) return false;
        let container = factionContainer(); let input = composer(container);
        if (!input) {
          const launcher = factionLauncher(); if (!launcher) return false;
          launcher.click();
          const found = await waitFor(() => { const next = factionContainer(); const field = composer(next); return field ? { next, field } : null; });
          container = found?.next; input = found?.field;
        }
        if (!input || !focusedTornPage()) return false;
        setComposer(input, text);
        const send = await waitFor(() => [...(container?.querySelectorAll('button,[role="button"]') || [])].find(button => {
          const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent].filter(Boolean).join(' ').toLowerCase();
          return !button.disabled && (button.type === 'submit' || label.trim() === 'send' || label.includes('send message'));
        }), 1500);
        if (!send || !focusedTornPage()) return false;
        send.click(); return true;
      }

      function targetFromUrl() {
        const url = new URL(location.href);
        const joined = `${url.search}&${url.hash}`;
        const itemId = Number(joined.match(/(?:itemID|itemId)=(\d+)/i)?.[1] || url.searchParams.get('itemId')) || 0;
        const price = Number(joined.match(/slinkPrice=(\d+)/i)?.[1] || url.searchParams.get('price')) || 0;
        const bazaar = url.pathname.toLowerCase().endsWith('/bazaar.php') && url.searchParams.get('slinkHighlight') === '1';
        const market = String(url.searchParams.get('sid') || '').toLowerCase() === 'itemmarket' || /itemmarket/i.test(url.pathname);
        return itemId > 0 && price > 0 ? { itemId, price, bazaar, market } : null;
      }

      function nodePrice(node) {
        const preferred = node.querySelector('[data-testid="price"],[class*="price___"]');
        const match = String(preferred?.textContent || node.textContent || '').match(/\$\s*([\d,]+)/);
        return match ? Number(match[1].replaceAll(',', '')) : 0;
      }

      function nodeItemId(node) {
        const image = node.querySelector('img[src*="/images/items/"],img[srcset*="/images/items/"]');
        return Number(`${image?.src || ''} ${image?.srcset || ''}`.match(/\/images\/items\/(\d+)\//i)?.[1]) || 0;
      }

      function purchaseNodes(target) {
        if (target.bazaar) {
          const container = document.querySelector('[data-testid="bazaar-items"]');
          return [...(container?.querySelectorAll('[data-testid="item"]') || [])];
        }
        return [...new Set([...document.querySelectorAll('ul[class*="sellerList___"] li[class*="rowWrapper___"]')].filter(node => node.querySelector('[class*="sellerRow___"]')))];
      }

      function fillMaximum(node, price) {
        const input = node.querySelector('input[data-testid="legacy-money-input"]:not([type="hidden"]),input.input-money:not([type="hidden"]),input[type="number"]');
        if (!input || input.disabled || input.readOnly) return;
        const dataStock = Number(String(input.dataset?.money || '').replace(/[^\d]/g, '')) || 0;
        const textStock = Number(String(node.textContent || '').match(/([\d,]+)\s+(?:available|in stock)/i)?.[1]?.replaceAll(',', '')) || 0;
        const stock = dataStock || textStock || Number(input.max) || 1;
        const money = Number(String(document.querySelector('#user-money')?.dataset?.money || '').replace(/[^\d]/g, '')) || Number.POSITIVE_INFINITY;
        const maximum = Math.max(1, Math.min(stock, Number.isFinite(money) && price > 0 ? Math.floor(money / price) : stock));
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(input, String(maximum)); else input.value = String(maximum);
        input.dispatchEvent(new Event('input', { bubbles:true })); input.dispatchEvent(new Event('change', { bubbles:true }));
      }

      function installQuickBuy(node, target) {
        if (!current?.settings?.quickBuyEnabled || node.querySelector('[data-slink-market-buy]')) return;
        const native = [...node.querySelectorAll('button,[role="button"]')].find(button => !button.disabled && /\b(?:buy|purchase)\b/i.test(`${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`));
        if (!native) return;
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.slinkMarketBuy = 'true'; button.textContent = 'SLINK Buy';
        button.style.cssText = 'margin:3px;padding:4px 8px;border:1px solid #78ff45;border-radius:5px;background:#17340f;color:#dfffd4;font-weight:700;cursor:pointer';
        button.addEventListener('click', event => {
          if (!event.isTrusted || !focusedTornPage()) return;
          event.preventDefault(); event.stopPropagation(); fillMaximum(node, target.price); native.click();
        });
        native.insertAdjacentElement('afterend', button);
      }

      function formatPurchasePage() {
        if (stopped) return;
        const target = targetFromUrl();
        const cleanup = node => {
          node.removeAttribute('data-slink-market-highlight');
          node.style.removeProperty('outline');
          node.style.removeProperty('box-shadow');
          node.querySelector('[data-slink-market-buy]')?.remove();
        };
        if (!target) {
          document.querySelectorAll('[data-slink-market-highlight]').forEach(cleanup);
          return;
        }
        const nodes = purchaseNodes(target);
        const matched = new Set();
        for (const node of nodes) {
          const itemMatches = !target.itemId || !nodeItemId(node) || nodeItemId(node) === target.itemId;
          if (!itemMatches || nodePrice(node) !== target.price) { if (node.hasAttribute('data-slink-market-highlight')) cleanup(node); continue; }
          matched.add(node);
          node.dataset.slinkMarketHighlight = 'true';
          node.style.setProperty('outline', '4px solid #39ff14', 'important');
          node.style.setProperty('box-shadow', '0 0 18px 5px rgba(57,255,20,.72)', 'important');
          if (current?.settings?.quickBuyEnabled) installQuickBuy(node, target);
          else node.querySelector('[data-slink-market-buy]')?.remove();
        }
        document.querySelectorAll('[data-slink-market-highlight]').forEach(node => { if (!matched.has(node)) cleanup(node); });
      }

      function scheduleFormat() {
        if (formatTimer) return;
        formatTimer = global.setTimeout(() => { formatTimer = null; formatPurchasePage(); }, 80);
      }

      function aggregateShare(opportunities) {
        return opportunities.slice(0, 12).map(row => row.shareText).join('\n');
      }

      function updateStatus() {
        if (!current) return;
        ui.setStatus(current.lastError || (current.permitted ? `API watches updated ${relativeTime(current.fetchedAt)}` : 'A Market Watch permission tier is required.'), current.lastError ? 'error' : current.permitted ? 'ready' : 'normal');
      }

      function render(status) {
        current = status;
        updateStatus();
        const deals = Array.isArray(status?.opportunities) ? status.opportunities : [];
        const root = ui.getContentElement();
        root.innerHTML = `<div class="slink-market-summary"><div><strong>${status?.settings?.watches?.length || 0}/${status?.marketWatchLimit || 0}</strong><small>Watches</small></div><div><strong>${deals.length}</strong><small>Deals</small></div><div><strong>${status?.tornApiUsage?.count || 0}/${status?.tornApiUsage?.limit || 60}</strong><small>API / min</small></div></div>
          <div class="slink-market-actions"><button type="button" data-market-copy-all ${deals.length ? '' : 'disabled'}>Copy item list</button><button type="button" data-market-send-all disabled>Send list to Faction</button></div>
          <div class="slink-market-list">${deals.length ? deals.map(row => `<article class="slink-market-deal"><strong>${escapeHtml(row.source)} · ${escapeHtml(row.itemName)}</strong><span>${escapeHtml(row.detail)}</span><div class="slink-market-actions"><a href="${escapeHtml(row.href)}" target="_self">Open &amp; highlight</a><button type="button" data-market-copy="${escapeHtml(row.id)}">Copy</button></div></article>`).join('') : '<div class="slink-market-empty">No watched listing is currently at or below its target.</div>'}</div>`;
        const copyAll = root.querySelector('[data-market-copy-all]');
        const sendAll = root.querySelector('[data-market-send-all]');
        copyAll?.addEventListener('click', async () => {
          const text = aggregateShare(deals); const copied = await copyText(text);
          copyAll.textContent = copied ? 'List copied' : 'Copy failed';
          if (copied) { shareArm = { text, expiresAt:Date.now() + 120_000 }; sendAll.disabled = false; }
        });
        sendAll?.addEventListener('click', async () => {
          if (!shareArm || shareArm.expiresAt <= Date.now()) { sendAll.disabled = true; return; }
          sendAll.disabled = true; sendAll.textContent = 'Sending…';
          const sent = await sendToFaction(shareArm.text); sendAll.textContent = sent ? 'Sent to Faction' : 'Open/focus Faction Chat';
          if (sent) shareArm = null; else sendAll.disabled = false;
        });
        root.querySelectorAll('[data-market-copy]').forEach(button => button.addEventListener('click', async () => {
          const row = deals.find(item => item.id === button.dataset.marketCopy);
          button.textContent = row && await copyText(row.shareText) ? 'Copied' : 'Copy failed';
        }));
        scheduleFormat();
      }

      async function load(refreshIfDue = true) {
        try { render(await SLINK.core.messaging.send('market.status', { refreshIfDue })); }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
      }

      ui.setActions([
        { id:'refresh', label:'Refresh', onClick:async event => { event.currentTarget.disabled = true; try { render(await SLINK.core.messaging.send('market.refresh')); } catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); } finally { event.currentTarget.disabled = false; } } },
        { id:'settings', label:'Settings', onClick:() => SLINK.core.messaging.send('ui.dashboard.open', { page:'alerts', efficiencyView:'market' }) }
      ]);
      observer = new MutationObserver(scheduleFormat);
      observer.observe(document.body, { childList:true, subtree:true });
      global.addEventListener('hashchange', scheduleFormat);
      global.addEventListener('popstate', scheduleFormat);
      await load(true);
      timer = global.setInterval(() => { if (!stopped) void load(true); }, 15_000);
      clockTimer = global.setInterval(() => { if (!stopped) updateStatus(); }, 1_000);
      return { stop() { stopped = true; observer?.disconnect(); if (timer) global.clearInterval(timer); if (clockTimer) global.clearInterval(clockTimer); if (formatTimer) global.clearTimeout(formatTimer); global.removeEventListener('hashchange', scheduleFormat); global.removeEventListener('popstate', scheduleFormat); document.querySelectorAll('[data-slink-market-buy]').forEach(node => node.remove()); document.querySelectorAll('[data-slink-market-highlight]').forEach(node => { node.removeAttribute('data-slink-market-highlight'); node.style.removeProperty('outline'); node.style.removeProperty('box-shadow'); }); } };
    }
  });
})(globalThis);
