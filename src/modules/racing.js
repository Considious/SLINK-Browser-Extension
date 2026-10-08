(function registerRacingModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before the Racing module.');

  const racing = SLINK.core.racing;
  const STORAGE_KEY = 'racing.buildGuide.v1';
  const HIGHLIGHT_STYLE_ID = 'slink-racing-highlight-style';
  const HIGHLIGHT_CLASS = 'slink-racing-recommended-car';
  const LABEL_ATTRIBUTE = 'data-slink-racing-label';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));

  SLINK.modules.register({
    id:'racing',
    title:'SLINK Racing',
    shortTitle:'Racing',
    group:'quality-of-life',
    groupTitle:'Quality of Life',
    requiredScopes:[],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      let stopped = false;
      let observer = null;
      let scanTimer = null;
      let saveTimer = null;
      let userState = racing.normalizeUserState(await SLINK.core.storage.get(STORAGE_KEY, null));
      let assistant = { status:'waiting', track:null, nickname:'', message:'Open an official race to receive a recommendation.' };

      ui.setModuleStyles(`
        .slink-racing-toolbar{display:flex;align-items:center;justify-content:space-between;gap:7px;flex-wrap:wrap}.slink-racing-filters{display:flex;gap:5px}.slink-racing-filters button{min-height:28px;padding:3px 8px}.slink-racing-filters button[aria-selected="true"]{border-color:var(--slink-accent);background:var(--slink-accent);color:#fff}.slink-racing-progress{color:var(--slink-muted);font-size:10px}
        .slink-racing-assistant{margin:7px 0;padding:8px;border:1px solid var(--slink-border-soft);border-left:3px solid var(--slink-accent);border-radius:7px;background:var(--slink-bg-control)}.slink-racing-assistant[data-tone="ready"]{border-left-color:var(--slink-ready)}.slink-racing-assistant[data-tone="warn"]{border-left-color:var(--slink-warning)}.slink-racing-assistant strong,.slink-racing-assistant span{display:block}.slink-racing-assistant span{color:var(--slink-muted);font-size:10px}
        .slink-racing-list{display:grid;gap:7px;max-height:470px;overflow:auto;padding-right:2px}.slink-racing-card{padding:8px;border:1px solid var(--slink-border-soft);border-radius:8px;background:var(--slink-bg-control)}.slink-racing-card[data-completed="true"]{border-left:3px solid var(--slink-ready)}.slink-racing-card header{display:flex;align-items:start;justify-content:space-between;gap:7px}.slink-racing-card h3{margin:0;font-size:12px}.slink-racing-card header span{color:var(--slink-muted);font-size:10px}.slink-racing-specs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin:7px 0}.slink-racing-specs div{padding:5px;border-radius:5px;background:var(--slink-bg)}.slink-racing-specs small,.slink-racing-specs strong{display:block}.slink-racing-specs small{color:var(--slink-muted);font-size:9px}
        .slink-racing-name{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;align-items:end}.slink-racing-name label{display:grid;gap:3px;color:var(--slink-muted);font-size:9px}.slink-racing-name input{width:100%;min-height:34px;padding:5px 7px;border:1px solid var(--slink-border);border-radius:6px;background:var(--slink-bg);color:var(--slink-text)}.slink-racing-name input[aria-invalid="true"]{border-color:var(--slink-error)}.slink-racing-count{min-width:39px;color:var(--slink-muted);text-align:right}.slink-racing-count[data-invalid="true"]{color:var(--slink-error);font-weight:bold}.slink-racing-card footer{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:7px}.slink-racing-card footer small{color:var(--slink-muted)}.slink-racing-card footer button{min-height:28px;padding:3px 8px}.slink-racing-empty{padding:18px 8px;color:var(--slink-muted);text-align:center}
      `);

      function ensureHighlightStyle() {
        let style = document.getElementById(HIGHLIGHT_STYLE_ID);
        if (style) return style;
        style = document.createElement('style');
        style.id = HIGHLIGHT_STYLE_ID;
        style.textContent = `
          .${HIGHLIGHT_CLASS}{display:inline-block!important;padding:3px 6px!important;border:3px solid #ff39bb!important;border-radius:6px!important;background:#152317!important;color:#fff!important;box-shadow:0 0 0 2px #111,0 0 12px #ff39bb!important;font-weight:900!important}
          [${LABEL_ATTRIBUTE}]{display:inline-block;margin-left:6px;padding:2px 6px;border:1px solid #111;border-radius:999px;background:#ff39bb;color:#fff;font:bold 10px/1.4 Arial,sans-serif;vertical-align:middle}
        `;
        (document.head || document.documentElement).append(style);
        return style;
      }

      function clearHighlight() {
        document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(node => node.classList.remove(HIGHLIGHT_CLASS));
        document.querySelectorAll(`[${LABEL_ATTRIBUTE}]`).forEach(node => node.remove());
      }

      function setAssistant(next) {
        assistant = next;
        const root = ui.getContentElement().querySelector('[data-racing-assistant]');
        if (!root) return;
        const tone = next.status === 'ready' ? 'ready' : ['not-completed','not-found','invalid-nickname'].includes(next.status) ? 'warn' : 'normal';
        root.dataset.tone = tone;
        root.innerHTML = `<strong>${escapeHtml(next.track ? `${next.track}: ${next.message}` : next.message)}</strong>${next.nickname ? `<span>Expected car: ${escapeHtml(next.nickname)}</span>` : '<span>Uses Torn page text only; no API calls.</span>'}`;
      }

      function scanOfficialRaceDom() {
        if (stopped) return;
        clearHighlight();
        const trackNode = [...document.querySelectorAll(racing.RACEWAY_DOM.OFFICIAL_RACE_TRACK_SELECTOR)]
          .find(node => /-\s*Official race\s*$/i.test(String(node.textContent || '').trim()));
        const track = racing.parseOfficialRaceTrack(trackNode?.textContent);
        if (!track) {
          setAssistant({ status:'waiting', track:null, nickname:'', message:'Open an official race to receive a recommendation.' });
          return;
        }
        const recommendation = racing.recommendationForTrack(track, userState);
        if (recommendation.status === 'not-completed') {
          setAssistant({ ...recommendation, message:'Recommended build is not marked complete.' });
          return;
        }
        if (recommendation.status === 'invalid-nickname') {
          setAssistant({ ...recommendation, message:'Saved nickname is invalid. Fix it in the Racing guide.' });
          return;
        }
        if (recommendation.status !== 'ready') {
          setAssistant({ ...recommendation, message:'No saved Racing build is configured for this track.' });
          return;
        }
        const nodes = [...document.querySelectorAll(racing.RACEWAY_DOM.OFFICIAL_RACE_CAR_NAME_SELECTOR)];
        const match = racing.matchVisibleCar(recommendation.nickname, nodes.map(node => ({ name:node.textContent, node })));
        if (!match?.node) {
          setAssistant({ ...recommendation, status:'not-found', message:'Recommended car not found in Torn\'s visible car list.' });
          return;
        }
        ensureHighlightStyle();
        match.node.classList.add(HIGHLIGHT_CLASS);
        const label = document.createElement('span');
        label.setAttribute(LABEL_ATTRIBUTE, 'true');
        label.textContent = 'SLINK Recommended';
        match.node.after(label);
        try { match.node.scrollIntoView({ block:'nearest', behavior:'smooth' }); } catch {}
        setAssistant({ ...recommendation, status:'ready', message:'Recommended car highlighted.' });
      }

      function scheduleScan(delay = 80) {
        if (stopped || scanTimer) return;
        scanTimer = global.setTimeout(() => { scanTimer = null; scanOfficialRaceDom(); }, delay);
      }

      function queueSave() {
        if (saveTimer) global.clearTimeout(saveTimer);
        saveTimer = global.setTimeout(() => {
          saveTimer = null;
          void SLINK.core.storage.set(STORAGE_KEY, userState);
          scheduleScan(0);
        }, 180);
      }

      function render() {
        userState = racing.normalizeUserState(userState);
        const definitions = racing.buildsForView(userState.view, userState);
        const completed = racing.RECOMMENDED_BUILDS.filter(definition => userState.builds[definition.id].completed).length;
        ui.setStatus(`${completed} of ${racing.RECOMMENDED_BUILDS.length} recommended builds complete`, completed === racing.RECOMMENDED_BUILDS.length ? 'ready' : 'normal');
        ui.getContentElement().innerHTML = `
          <div class="slink-racing-toolbar"><div class="slink-racing-filters" role="tablist" aria-label="Racing build status">
            ${['needed','completed','all'].map(view => `<button type="button" data-racing-view="${view}" aria-selected="${String(userState.view === view)}">${view[0].toUpperCase() + view.slice(1)}</button>`).join('')}
          </div><span class="slink-racing-progress">${completed}/${racing.RECOMMENDED_BUILDS.length} complete</span></div>
          <div class="slink-racing-assistant" data-racing-assistant></div>
          <div class="slink-racing-list">${definitions.length ? definitions.map(definition => {
            const buildState = userState.builds[definition.id];
            const suggested = racing.suggestNickname(definition.tracks).value;
            const effective = racing.effectiveNickname(definition, userState);
            const validation = racing.validateNickname(effective);
            return `<article class="slink-racing-card" data-racing-build="${escapeHtml(definition.id)}" data-completed="${String(buildState.completed)}">
              <header><div><h3>${escapeHtml(definition.car)}</h3><span>Class ${escapeHtml(definition.class)} · ${escapeHtml(definition.tracks.join(', '))}</span></div><span>${buildState.completed ? 'COMPLETE' : 'NEEDED'}</span></header>
              <div class="slink-racing-specs"><div><small>Turbo</small><strong>${escapeHtml(definition.build.turbo)}</strong></div><div><small>Transmission</small><strong>${escapeHtml(definition.build.transmission)}</strong></div><div><small>Gearbox</small><strong>${escapeHtml(definition.build.gearbox)}</strong></div><div><small>Tires</small><strong>${escapeHtml(definition.build.tires)}</strong></div></div>
              <div class="slink-racing-name"><label>Expected Torn nickname<input type="text" maxlength="100" data-racing-name value="${escapeHtml(effective)}" placeholder="${escapeHtml(suggested)}" aria-invalid="${String(!validation.valid)}"></label><span class="slink-racing-count" data-racing-count data-invalid="${String(!validation.valid)}">${validation.length}/${validation.maxLength}</span></div>
              <footer><small>${buildState.customName ? 'Custom nickname' : 'Suggested nickname'} · 22 characters maximum</small><div><button type="button" data-racing-reset-name>Use suggestion</button> <button type="button" data-racing-toggle>${buildState.completed ? 'Move to Needed' : 'Mark Complete'}</button></div></footer>
            </article>`;
          }).join('') : '<div class="slink-racing-empty">No builds in this view.</div>'}</div>`;
        setAssistant(assistant);
      }

      const content = ui.getContentElement();
      content.addEventListener('click', event => {
        const viewButton = event.target.closest('[data-racing-view]');
        if (viewButton) {
          userState.view = viewButton.dataset.racingView;
          queueSave();
          render();
          return;
        }
        const card = event.target.closest('[data-racing-build]');
        if (!card) return;
        const buildState = userState.builds[card.dataset.racingBuild];
        if (!buildState) return;
        if (event.target.closest('[data-racing-toggle]')) {
          buildState.completed = !buildState.completed;
          queueSave();
          render();
        } else if (event.target.closest('[data-racing-reset-name]')) {
          buildState.customName = '';
          queueSave();
          render();
        }
      });
      content.addEventListener('input', event => {
        if (!event.target.matches('[data-racing-name]')) return;
        const card = event.target.closest('[data-racing-build]');
        const buildState = userState.builds[card?.dataset.racingBuild];
        if (!buildState) return;
        const definition = racing.RECOMMENDED_BUILDS.find(entry => entry.id === card.dataset.racingBuild);
        const value = event.target.value;
        const suggestion = racing.suggestNickname(definition.tracks).value;
        buildState.customName = value.trim() === suggestion ? '' : value;
        const validation = racing.validateNickname(value);
        event.target.setAttribute('aria-invalid', String(!validation.valid));
        const counter = card.querySelector('[data-racing-count]');
        if (counter) {
          counter.textContent = `${validation.length}/${validation.maxLength}`;
          counter.dataset.invalid = String(!validation.valid);
        }
        queueSave();
      });

      render();
      ensureHighlightStyle();
      observer = new MutationObserver(mutations => {
        if (mutations.every(mutation => mutation.target?.closest?.('[data-slink-racing-label],#slink-extension-panel'))) return;
        scheduleScan();
      });
      observer.observe(document.body, { childList:true, subtree:true, characterData:true });
      global.addEventListener('hashchange', scheduleScan);
      global.addEventListener('popstate', scheduleScan);
      scheduleScan(0);

      return {
        stop() {
          stopped = true;
          observer?.disconnect();
          if (scanTimer) global.clearTimeout(scanTimer);
          if (saveTimer) global.clearTimeout(saveTimer);
          global.removeEventListener('hashchange', scheduleScan);
          global.removeEventListener('popstate', scheduleScan);
          clearHighlight();
          document.getElementById(HIGHLIGHT_STYLE_ID)?.remove();
        }
      };
    }
  });
})(globalThis);
