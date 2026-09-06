(function registerAdhdModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Efficiency.');

  function relativeTime(timestamp) {
    if (!Number(timestamp)) return 'not checked yet';
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
    return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s ago` : `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ago`;
  }

  SLINK.modules.register({
    id:'adhd',
    title:'SLINK Efficiency',
    shortTitle:'Alerts',
    group:'efficiency',
    groupTitle:'Efficiency',
    requiredScopes:[SLINK.core.adhd.ALERT_SCOPE],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      let stopped = false;
      let timer = null;
      let clockTimer = null;
      let current = null;
      let chatShareArm = null;

      ui.setModuleStyles(`
        .slink-adhd-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
        .slink-adhd-summary>div{padding:7px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control);text-align:center}
        .slink-adhd-summary strong,.slink-adhd-summary small{display:block}.slink-adhd-summary small{color:var(--slink-muted)}
        .slink-adhd-list{display:grid;gap:7px}.slink-adhd-alert{padding:8px;border-left:4px solid var(--slink-warning);border-radius:7px;background:var(--slink-bg-control)}
        .slink-adhd-alert[data-tone="urgent"]{border-left-color:var(--slink-error)}.slink-adhd-alert[data-tone="ready"]{border-left-color:var(--slink-ready)}
        .slink-adhd-alert strong,.slink-adhd-alert span{display:block}.slink-adhd-alert span{margin-top:2px;color:var(--slink-muted)}
        .slink-adhd-links{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.slink-adhd-links a,.slink-adhd-links button{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:4px 8px;border:1px solid var(--slink-border);border-radius:6px;background:var(--slink-bg);color:var(--slink-text);box-shadow:inset 0 0 0 1px rgba(255,255,255,.035);font:inherit;text-decoration:none;cursor:pointer}.slink-adhd-links a:hover,.slink-adhd-links button:hover{border-color:var(--slink-accent-alt);background:var(--slink-selected-bg);filter:brightness(1.12)}.slink-adhd-links button:disabled{cursor:not-allowed;opacity:.48;filter:none}
        .slink-adhd-empty{padding:16px;border-radius:7px;background:var(--slink-bg-control);color:var(--slink-muted);text-align:center}
      `);

      function focusedTornPage() {
        return document.visibilityState === 'visible' && document.hasFocus();
      }

      async function copyAlertText(value) {
        const text = String(value || '').trim();
        if (!text) return false;
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
          document.body.append(textarea);
          textarea.select();
          const copied = document.execCommand('copy');
          textarea.remove();
          return copied;
        }
      }

      function findFactionChatContainer() {
        const exact = [...document.querySelectorAll('[id^="faction-"]')].find(node => node.querySelector('textarea[placeholder="Type your message here..."],textarea[class*="textarea"]'));
        if (exact) return exact;
        return [...document.querySelectorAll('div,section')].find(node => {
          const title = node.querySelector('button span,header span');
          const composer = node.querySelector('textarea[placeholder*="message" i],[contenteditable="true"]');
          return composer && String(title?.textContent || '').trim().toLowerCase() === 'faction';
        }) || null;
      }

      function findFactionChatLauncher() {
        return [...document.querySelectorAll('button,a,[role="button"]')].find(node => {
          const label = [node.getAttribute?.('aria-label'), node.getAttribute?.('title'), node.textContent].filter(Boolean).join(' ').trim().toLowerCase();
          return label === 'faction' || label.includes('faction chat') || label.includes('open faction');
        }) || null;
      }

      function findFactionChatComposer(container) {
        return container?.querySelector('textarea[placeholder="Type your message here..."],textarea[class*="textarea"],textarea,[contenteditable="true"]') || null;
      }

      function setFactionChatComposerContent(composer, text) {
        composer.focus();
        if (composer.matches('textarea,input')) {
          const prototype = composer.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (setter) setter.call(composer, text); else composer.value = text;
        } else {
          composer.innerHTML = '';
          try { document.execCommand('insertHTML', false, text); }
          catch { composer.innerHTML = text; }
        }
        try { composer.dispatchEvent(new InputEvent('input', { bubbles:true, composed:true, inputType:'insertText', data:text })); }
        catch { composer.dispatchEvent(new Event('input', { bubbles:true, composed:true })); }
        composer.dispatchEvent(new Event('change', { bubbles:true, composed:true }));
      }

      function findFactionChatSendButton(container, composer) {
        const sibling = composer?.parentElement?.querySelector('button');
        if (sibling) return sibling;
        return [...(container?.querySelectorAll('button,[role="button"]') || [])].find(button => {
          const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent].filter(Boolean).join(' ').trim().toLowerCase();
          return button.type === 'submit' || label === 'send' || label.includes('send message') || Boolean(button.querySelector('svg[viewBox="0 0 18 18"]'));
        }) || null;
      }

      async function waitFor(check, timeoutMs, intervalMs = 75) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
          if (!focusedTornPage()) return null;
          const result = check();
          if (result) return result;
          await new Promise(resolve => global.setTimeout(resolve, intervalMs));
        }
        return null;
      }

      async function sendListingToFaction(text) {
        if (!focusedTornPage()) return { ok:false, label:'Focus Torn first' };
        let container = findFactionChatContainer();
        let composer = findFactionChatComposer(container);
        if (!container || !composer) {
          const launcher = findFactionChatLauncher();
          if (!launcher) return { ok:false, label:'Faction Chat not found' };
          launcher.click();
          const found = await waitFor(() => {
            const nextContainer = findFactionChatContainer();
            const nextComposer = findFactionChatComposer(nextContainer);
            return nextContainer && nextComposer ? { container:nextContainer, composer:nextComposer } : null;
          }, 2500, 100);
          container = found?.container; composer = found?.composer;
        }
        if (!container || !composer) return { ok:false, label:'Faction message box not found' };
        if (!focusedTornPage()) return { ok:false, label:'Focus Torn first' };
        setFactionChatComposerContent(composer, text);
        const sendButton = await waitFor(() => {
          const button = findFactionChatSendButton(container, composer);
          return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true' ? button : null;
        }, 1500, 50);
        if (!sendButton || !focusedTornPage()) return { ok:false, label:sendButton ? 'Focus Torn first' : 'Faction send not ready' };
        sendButton.click();
        return { ok:true, label:'Sent to Faction' };
      }

      function chatShareArmed(alertId) {
        return Boolean(chatShareArm && chatShareArm.alertId === alertId && chatShareArm.expiresAt > Date.now());
      }

      function updateChatButtons(root) {
        root.querySelectorAll('[data-slink-chat-send]').forEach(button => {
          button.disabled = !chatShareArmed(button.dataset.alertId);
          button.title = button.disabled ? 'Copy this listing first to unlock Faction Chat sending' : 'Send the copied listing directly to Faction Chat';
        });
      }

      function updateStatus() {
        if (!current) return;
        ui.setStatus(current?.lastError || (current?.configured ? `API timers updated ${relativeTime(current.fetchedAt)}` : 'Enable Efficiency from the extension dashboard.'), current?.lastError ? 'error' : current?.configured ? 'ready' : 'normal');
      }

      function render(status) {
        current = status;
        const alerts = Array.isArray(status?.activeAlerts) ? status.activeAlerts : [];
        updateStatus();
        const root = ui.getContentElement();
        root.replaceChildren();
        const summary = document.createElement('div');
        summary.className = 'slink-adhd-summary';
        const cells = [
          [alerts.length, 'Active'],
          [status?.city?.bought ?? '—', 'City / 100'],
          [`${status?.tornApiUsage?.count || 0}/${status?.tornApiUsage?.limit || 60}`, 'API / min']
        ];
        for (const [value, label] of cells) {
          const cell = document.createElement('div');
          const strong = document.createElement('strong'); strong.textContent = String(value);
          const small = document.createElement('small'); small.textContent = label;
          cell.append(strong, small); summary.append(cell);
        }
        root.append(summary);
        const list = document.createElement('div');
        list.className = 'slink-adhd-list';
        if (!alerts.length) {
          const empty = document.createElement('div'); empty.className = 'slink-adhd-empty';
          empty.textContent = status?.fetchedAt ? 'You’re caught up. No active API reminders.' : 'Refresh after setup to load your timers.';
          list.append(empty);
        }
        for (const alert of alerts) {
          const card = document.createElement('article'); card.className = 'slink-adhd-alert'; card.dataset.tone = alert.tone || '';
          const title = document.createElement('strong'); title.textContent = alert.title || 'Reminder';
          const detail = document.createElement('span'); detail.textContent = alert.detail || '';
          const links = document.createElement('div'); links.className = 'slink-adhd-links';
          for (const [label, href] of alert.links || []) {
            const anchor = document.createElement('a'); anchor.href = String(href); anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = String(label || 'Open'); links.append(anchor);
          }
          if (alert.shareText) {
            const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy'; copy.title = 'Copy the compact city-stock listing and HTML link';
            const send = document.createElement('button'); send.type = 'button'; send.textContent = 'Send to Faction'; send.dataset.slinkChatSend = 'true'; send.dataset.alertId = alert.id;
            copy.addEventListener('click', async () => {
              const original = copy.textContent;
              const copied = await copyAlertText(alert.shareText);
              copy.textContent = copied ? 'Copied' : 'Copy failed';
              if (copied) {
                const arm = { alertId:alert.id, text:alert.shareText, expiresAt:Date.now() + 120_000 };
                chatShareArm = arm;
                updateChatButtons(root);
                global.setTimeout(() => { if (chatShareArm === arm) { chatShareArm = null; updateChatButtons(root); } }, 120_100);
              }
              global.setTimeout(() => { if (copy.isConnected) copy.textContent = original; }, 1500);
            });
            send.addEventListener('click', async () => {
              if (!chatShareArmed(alert.id)) { updateChatButtons(root); return; }
              const arm = chatShareArm;
              const original = send.textContent;
              send.disabled = true; send.textContent = 'Sending…';
              const result = await sendListingToFaction(arm.text);
              if (!send.isConnected) return;
              send.textContent = result.label;
              if (result.ok) chatShareArm = null;
              updateChatButtons(root);
              global.setTimeout(() => { if (send.isConnected) send.textContent = original; }, 1800);
            });
            links.append(copy, send);
          }
          for (const [label, durationMs] of [['Snooze 5m', 5 * 60_000], ['Snooze 1h', 60 * 60_000]]) {
            const snooze = document.createElement('button'); snooze.type = 'button'; snooze.textContent = label;
            snooze.addEventListener('click', async () => {
              render(await SLINK.core.messaging.send('adhd.alert.snooze', { id:alert.id, durationMs }));
            });
            links.append(snooze);
          }
          if (alert.id === 'cityItem') {
            const done = document.createElement('button'); done.type = 'button'; done.textContent = 'Bought — hide today';
            done.addEventListener('click', async () => render(await SLINK.core.messaging.send('adhd.city.acknowledge')));
            links.append(done);
          }
          card.append(title, detail, links); list.append(card);
        }
        root.append(list);
        updateChatButtons(root);
        ui.setBubbleAlert('adhd', alerts.length, 'adhd');
      }

      async function load(refreshIfDue = true) {
        try {
          render(await SLINK.core.messaging.send('adhd.status', { refreshIfDue }));
          try {
            const claim = await SLINK.core.messaging.send('adhd.sound.claim');
            if (claim?.play) await SLINK.core.adhd.playNotificationSound(claim);
          } catch {}
        }
        catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
      }

      ui.setActions([
        { id:'refresh', label:'Refresh', onClick:async event => {
          event.currentTarget.disabled = true;
          try {
            render(await SLINK.core.messaging.send('adhd.refresh'));
            try {
              const claim = await SLINK.core.messaging.send('adhd.sound.claim');
              if (claim?.play) await SLINK.core.adhd.playNotificationSound(claim);
            } catch {}
          }
          catch (error) { ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); }
          finally { event.currentTarget.disabled = false; }
        } },
        { id:'settings', label:'Settings', onClick:async () => {
          await SLINK.core.storage.set('ui.dashboard.activePage', 'alerts');
          await chrome.runtime.openOptionsPage();
        } }
      ]);
      await load(true);
      timer = global.setInterval(() => { if (!stopped) void load(true); }, 15_000);
      clockTimer = global.setInterval(() => { if (!stopped) updateStatus(); }, 1_000);
      return {
        stop() {
          stopped = true;
          if (timer) global.clearInterval(timer);
          if (clockTimer) global.clearInterval(clockTimer);
          ui.setBubbleAlert('', 0, 'adhd');
        },
        status:() => current
      };
    }
  });
})(globalThis);
