(function registerTravelSafetyModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before the Travel Safety module.');
  const TRAVEL = SLINK.core.travelSafety;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  }

  SLINK.modules.register({
    id:'travel-safety',
    title:'SLINK Travel Safety',
    shortTitle:'Travel Safety',
    group:'quality-of-life',
    groupTitle:'Quality of Life',
    requiredScopes:[],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      // Travel safety is an always-on background safeguard, not a visible dashboard tab.
      ui.remove?.();
      const bypass = new WeakSet();
      const pending = new WeakSet();
      let stopped = false;
      let latest = null;
      let modal = null;

      ui.setModuleStyles('.slink-travel-summary{display:grid;gap:6px}.slink-travel-summary article{padding:8px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control)}.slink-travel-summary strong,.slink-travel-summary span{display:block}.slink-travel-summary span{color:var(--slink-muted);font-size:10px}.slink-travel-summary button{margin-top:7px;padding:4px 8px}');

      function render() {
        const crime = latest?.crime;
        ui.getContentElement().innerHTML = '<div class="slink-travel-summary"><article><strong>Organized Crime travel protection is active</strong><span>Round trips use Torn\'s displayed one-way time twice, plus a 10% return buffer.</span>' +
          (crime ? '<span>Current crime ready: ' + escapeHtml(TRAVEL.formatTct(crime.readyAt)) + '</span>' : '<span>No upcoming organized crime is currently cached.</span>') +
          '<button type="button" data-travel-refresh>Refresh crime time</button></article></div>';
      }

      async function loadStatus(force = false) {
        latest = await SLINK.core.messaging.send('travelSafety.status', { force });
        render();
        ui.setStatus(latest?.crime ? 'Travel protection is ready.' : 'Travel protection is ready; no upcoming crime was found.', 'ready');
        return latest;
      }

      function closeModal() {
        modal?.remove();
        modal = null;
      }

      function showConflict(button, destination, assessment) {
        closeModal();
        modal = document.createElement('div');
        modal.dataset.slinkTravelGuard = 'true';
        modal.innerHTML = '<style>[data-slink-travel-guard]{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.72);font:14px/1.45 Arial,sans-serif}[data-slink-travel-dialog]{width:min(440px,100%);padding:16px;border:2px solid #d86a22;border-radius:10px;background:#15191f;color:#f4f6f8;box-shadow:0 18px 50px #000}[data-slink-travel-dialog] h2{margin:0 0 8px;font-size:19px}[data-slink-travel-dialog] p{margin:7px 0}[data-slink-travel-times]{padding:9px;border-radius:7px;background:#0b0e12;color:#ccd3dc}[data-slink-travel-actions]{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}[data-slink-travel-actions] button{min-height:38px;padding:7px 11px;border:1px solid #65717e;border-radius:7px;background:#252c35;color:#fff;cursor:pointer}[data-slink-travel-actions] [data-leave]{border-color:#d86a22;background:#6b2b16}</style>' +
          '<section data-slink-travel-dialog role="alertdialog" aria-modal="true" aria-labelledby="slink-travel-title"><h2 id="slink-travel-title">Organized crime conflict</h2><p>This trip is unlikely to return you to Torn before your organized crime is ready. Leaving may delay your faction teammates. Consider choosing a shorter destination or waiting until the crime is complete.</p><p data-slink-travel-times>' +
          escapeHtml(destination) + ' estimated return: <strong>' + escapeHtml(TRAVEL.formatTct(assessment.returnAt)) + '</strong><br>Organized crime ready: <strong>' + escapeHtml(TRAVEL.formatTct(assessment.readyAt)) + '</strong></p><div data-slink-travel-actions><button type="button" data-cancel>Cancel — choose another destination</button><button type="button" data-leave>Leave anyway</button></div></section>';
        modal.querySelector('[data-cancel]').addEventListener('click', closeModal, { once:true });
        modal.querySelector('[data-leave]').addEventListener('click', () => {
          closeModal();
          bypass.add(button);
          button.click();
        }, { once:true });
        modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
        document.documentElement.append(modal);
        modal.querySelector('[data-cancel]').focus({ preventScroll:true });
      }

      async function handleTravelClick(event) {
        if (stopped || event.defaultPrevented) return;
        const button = TRAVEL.travelButton(event.target);
        if (!button || button.disabled || !/^\/travelagency\.php$/i.test(global.location.pathname)) return;
        if (bypass.has(button)) { bypass.delete(button); return; }
        if (pending.has(button)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        const oneWayMs = TRAVEL.oneWayMsFromButton(button);
        if (!oneWayMs) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        pending.add(button);
        try {
          const status = await loadStatus(false);
          const assessment = TRAVEL.assessTrip({ oneWayMs, crime:status?.crime });
          if (assessment.blocked) {
            showConflict(button, TRAVEL.destinationFromLabel(button.getAttribute('aria-label')), assessment);
            return;
          }
          bypass.add(button);
          button.click();
        } catch (error) {
          ui.setStatus('Travel safety could not verify the crime time, so the flight was not blocked: ' + SLINK.core.format.errorMessage(error), 'error');
          bypass.add(button);
          button.click();
        } finally {
          pending.delete(button);
        }
      }

      function handleModuleClick(event) {
        if (event.target.closest('[data-travel-refresh]')) void loadStatus(true).catch(error => ui.setStatus(SLINK.core.format.errorMessage(error), 'error'));
      }

      render();
      ui.getContentElement().addEventListener('click', handleModuleClick);
      document.addEventListener('click', handleTravelClick, true);
      void loadStatus(false).catch(error => ui.setStatus(SLINK.core.format.errorMessage(error), 'error'));

      return {
        stop() {
          stopped = true;
          closeModal();
          ui.getContentElement().removeEventListener('click', handleModuleClick);
          document.removeEventListener('click', handleTravelClick, true);
        }
      };
    }
  });
})(globalThis);

