(function registerAdhdModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Efficiency.');

  function relativeTime(timestamp) {
    if (!Number(timestamp)) return 'not checked yet';
    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
    return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
  }

  SLINK.modules.register({
    id:'adhd',
    title:'Efficiency',
    requiredScopes:[SLINK.core.adhd.ALERT_SCOPE],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      let stopped = false;
      let timer = null;
      let current = null;

      ui.setModuleStyles(`
        .slink-adhd-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
        .slink-adhd-summary>div{padding:7px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control);text-align:center}
        .slink-adhd-summary strong,.slink-adhd-summary small{display:block}.slink-adhd-summary small{color:var(--slink-muted)}
        .slink-adhd-list{display:grid;gap:7px}.slink-adhd-alert{padding:8px;border-left:4px solid var(--slink-warning);border-radius:7px;background:var(--slink-bg-control)}
        .slink-adhd-alert[data-tone="urgent"]{border-left-color:var(--slink-error)}.slink-adhd-alert[data-tone="ready"]{border-left-color:var(--slink-ready)}
        .slink-adhd-alert strong,.slink-adhd-alert span{display:block}.slink-adhd-alert span{margin-top:2px;color:var(--slink-muted)}
        .slink-adhd-links{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.slink-adhd-links a,.slink-adhd-links button{min-height:26px;padding:3px 7px;color:var(--slink-text);text-decoration:none}
        .slink-adhd-empty{padding:16px;border-radius:7px;background:var(--slink-bg-control);color:var(--slink-muted);text-align:center}
      `);

      function render(status) {
        current = status;
        const alerts = Array.isArray(status?.activeAlerts) ? status.activeAlerts : [];
        ui.setStatus(status?.lastError || (status?.configured ? `API timers updated ${relativeTime(status.fetchedAt)}` : 'Enable Efficiency from the extension dashboard.'), status?.lastError ? 'error' : status?.configured ? 'ready' : 'normal');
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
      return {
        stop() {
          stopped = true;
          if (timer) global.clearInterval(timer);
          ui.setBubbleAlert('', 0, 'adhd');
        },
        status:() => current
      };
    }
  });
})(globalThis);
