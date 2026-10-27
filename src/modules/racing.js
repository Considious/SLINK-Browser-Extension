(function registerRacingModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before the Racing module.');

  const racing = SLINK.core.racing;
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
    requiredScopes:['slink.qol.racing'],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      let stopped = false;
      let observer = null;
      let scanTimer = null;
      let highlightedNode = null;
      let recommendationLabel = null;
      let recommendationKey = '';
      let assistantRoot = null;
      let assistantSignature = '';
      let userState = racing.normalizeUserState((await SLINK.core.messaging.send('racing.status')).state);
      if (context.signal?.aborted) return { stop() {} };
      let mounted = false;
      let actionBusy = false;
      let actionError = '';
      let saveState = {state:'idle'};
      let assistant = { status:'waiting', track:null, nickname:'', message:'Open an official race to receive a recommendation.' };

      ui.setModuleStyles(`
        .slink-racing-toolbar{display:flex;align-items:center;justify-content:space-between;gap:7px;flex-wrap:wrap}.slink-racing-filters{display:flex;gap:5px}.slink-racing-filters button{min-height:28px;padding:3px 8px}.slink-racing-filters button[aria-selected="true"]{border-color:var(--slink-accent);background:var(--slink-accent);color:#fff}.slink-racing-progress{color:var(--slink-muted);font-size:10px}
        .slink-racing-assistant{margin:7px 0;padding:8px;border:1px solid var(--slink-border-soft);border-left:3px solid var(--slink-accent);border-radius:7px;background:var(--slink-bg-control)}.slink-racing-assistant[data-tone="ready"]{border-left-color:var(--slink-ready)}.slink-racing-assistant[data-tone="warn"]{border-left-color:var(--slink-warning)}.slink-racing-assistant strong,.slink-racing-assistant span{display:block}.slink-racing-assistant span{color:var(--slink-muted);font-size:10px}
        .slink-racing-list{display:grid;gap:7px;max-height:470px;overflow:auto;padding-right:2px}.slink-racing-card{padding:8px;border:1px solid var(--slink-border-soft);border-radius:8px;background:var(--slink-bg-control)}.slink-racing-card[data-completed="true"]{border-left:3px solid var(--slink-ready)}.slink-racing-card header{display:flex;align-items:start;justify-content:space-between;gap:7px}.slink-racing-card h3{margin:0;font-size:12px}.slink-racing-card header span{color:var(--slink-muted);font-size:10px}.slink-racing-specs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin:7px 0}.slink-racing-specs div{padding:5px;border-radius:5px;background:var(--slink-bg)}.slink-racing-specs small,.slink-racing-specs strong{display:block}.slink-racing-specs small{color:var(--slink-muted);font-size:9px}
        .slink-racing-name{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;align-items:end}.slink-racing-name label{display:grid;gap:3px;color:var(--slink-muted);font-size:9px}.slink-racing-name input{width:100%;box-sizing:border-box;min-height:34px;padding:5px 7px;border:1px solid var(--slink-border);border-radius:6px;background:var(--slink-bg);color:var(--slink-text)}.slink-racing-name input[aria-invalid="true"]{border-color:var(--slink-error)}.slink-racing-count{min-width:39px;color:var(--slink-muted);text-align:right}.slink-racing-count[data-invalid="true"]{color:var(--slink-error);font-weight:bold}.slink-racing-card footer{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:7px;flex-wrap:wrap}.slink-racing-card footer small{color:var(--slink-muted)}.slink-racing-card footer button{min-height:28px;padding:3px 8px}.slink-racing-empty{padding:18px 8px;color:var(--slink-muted);text-align:center}.slink-racing-card[hidden],.slink-racing-empty[hidden]{display:none}
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
        highlightedNode?.classList.remove(HIGHLIGHT_CLASS);
        recommendationLabel?.remove();
        highlightedNode = null;
        recommendationLabel = null;
        recommendationKey = '';
      }

      function setAssistant(next) {
        assistant = next;
        const root = ui.getContentElement().querySelector('[data-racing-assistant]');
        if (!root) return;
        const signature = JSON.stringify(next);
        if (root === assistantRoot && signature === assistantSignature) return;
        assistantRoot = root;
        assistantSignature = signature;
        const tone = next.status === 'ready' ? 'ready' : ['not-completed','not-found','invalid-nickname'].includes(next.status) ? 'warn' : 'normal';
        root.dataset.tone = tone;
        root.innerHTML = `<strong>${escapeHtml(next.track ? `${next.track}: ${next.message}` : next.message)}</strong>${next.nickname ? `<span>Expected car: ${escapeHtml(next.nickname)}</span>` : '<span>Uses Torn page text only; no API calls.</span>'}`;
      }

      function onRacewayPage() {
        const page = new URL(global.location.href);
        return /rac(?:e|ing)/i.test(page.pathname) || /rac(?:e|ing)/i.test(page.hash) || /rac(?:e|ing)/i.test(String(page.searchParams.get('sid') || ''));
      }

      function scanOfficialRaceDom() {
        if (stopped) return;
        if (!pageEligible()) { clearHighlight(); return; }
        if (!onRacewayPage()) { clearHighlight(); return; }
        const trackNode = [...document.querySelectorAll(racing.RACEWAY_DOM.OFFICIAL_RACE_TRACK_SELECTOR)]
          .find(node => node.getClientRects?.().length !== 0 && /-\s*Official race\s*$/i.test(String(node.textContent || '').trim()));
        const track = racing.parseOfficialRaceTrack(trackNode?.textContent);
        if (!track) {
          clearHighlight();
          setAssistant({ status:'waiting', track:null, nickname:'', message:'Open an official race to receive a recommendation.' });
          return;
        }
        const recommendation = racing.recommendationForTrack(track, userState);
        if (recommendation.status === 'not-completed') {
          clearHighlight();
          setAssistant({ ...recommendation, message:'Recommended build is not marked complete.' });
          return;
        }
        if (recommendation.status === 'invalid-nickname') {
          clearHighlight();
          setAssistant({ ...recommendation, message:'Saved nickname is invalid. Fix it in the Racing guide.' });
          return;
        }
        if (recommendation.status !== 'ready') {
          clearHighlight();
          setAssistant({ ...recommendation, message:'No saved Racing build is configured for this track.' });
          return;
        }
        const nodes = [...document.querySelectorAll(racing.RACEWAY_DOM.OFFICIAL_RACE_CAR_NAME_SELECTOR)]
          .filter(node => node.getClientRects?.().length !== 0);
        const match = racing.matchVisibleCar(recommendation.nickname, nodes.map(node => ({ name:node.textContent, node })));
        if (!match?.node) {
          clearHighlight();
          setAssistant({ ...recommendation, status:'not-found', message:'Recommended car not found in Torn\'s visible car list.' });
          return;
        }
        ensureHighlightStyle();
        const key = `${track}|${recommendation.nickname}`;
        if (highlightedNode === match.node && recommendationLabel?.isConnected && recommendationKey === key) {
          match.node.classList.add(HIGHLIGHT_CLASS);
          return;
        }
        clearHighlight();
        highlightedNode = match.node;
        recommendationKey = key;
        match.node.classList.add(HIGHLIGHT_CLASS);
        const label = document.createElement('span');
        recommendationLabel = label;
        label.setAttribute(LABEL_ATTRIBUTE, 'true');
        label.textContent = 'SLINK Recommended';
        match.node.after(label);
        setAssistant({ ...recommendation, status:'ready', message:'Recommended car highlighted.' });
      }

      function scheduleScan(delay = 80) {
        if (stopped || !pageEligible() || scanTimer) return;
        scanTimer = global.setTimeout(() => { scanTimer = null; scanOfficialRaceDom(); }, delay);
      }

      function pageEligible() {
        return context.presentation !== 'dashboard' && context.isActive?.() !== false && !document.hidden && document.hasFocus();
      }

      function onPageActivity() {
        if (pageEligible()) { scheduleScan(0); return; }
        if (scanTimer) global.clearTimeout(scanTimer);
        scanTimer = null;
        clearHighlight();
      }

      function queueSave(settings) {
        return SLINK.core.messaging.send('racing.settings.save', {settings});
      }
      const content = ui.getContentElement();
      const fields = Object.fromEntries(racing.RECOMMENDED_BUILDS.map(build => [`racing-name-${build.id}`,`${build.id}:name`]));
      function adopt(settings) {
        for (const [key,value] of Object.entries(settings)) {
          if (key === 'view') { userState.view = value; continue; }
          const definition = racing.RECOMMENDED_BUILDS.find(build => key.startsWith(build.id + ':'));
          if (!definition) continue;
          const build = userState.builds[definition.id];
          if (key.endsWith(':completed')) build.completed = value;
          else build.customName = value === racing.suggestNickname(definition.tracks).value ? '' : value;
        }
        render(); scheduleScan(0);
      }
      function showSaveState() {
        if (stopped || context.signal?.aborted || !mounted) return;
        content.querySelector('[data-racing-save-state]').textContent = actionError || ({idle:'Changes save automatically.',saving:'Saving…',saved:'Saved.',failed:'Nickname not saved. Check the name and retry.',invalid:'Finish the nickname before saving.',unsaved:'Changes not saved yet.'})[saveState.state] || '';
        content.querySelector('[data-racing-retry]').hidden = saveState.state !== 'failed';
        content.querySelectorAll('[data-racing-name]').forEach(validateInput);
      }
      const autosave = SLINK.core.formState.autosave({
        root:content, fields,
        read:key => {
          const definition = racing.RECOMMENDED_BUILDS.find(build => key === `${build.id}:name`);
          return definition ? racing.effectiveNickname(definition,userState) : undefined;
        },
        save:queueSave, select:response => response.settings,
        onCommit:adopt,
        onState:state => { saveState = state; showSaveState(); }
      });

      function render() {
        if (stopped || context.signal?.aborted) return;
        userState = racing.normalizeUserState(userState);
        const definitions = racing.RECOMMENDED_BUILDS;
        const completed = racing.RECOMMENDED_BUILDS.filter(definition => userState.builds[definition.id].completed).length;
        ui.setStatus(`${completed} of ${racing.RECOMMENDED_BUILDS.length} recommended builds complete`, completed === racing.RECOMMENDED_BUILDS.length ? 'ready' : 'normal');
        if (!mounted) { content.innerHTML = `
          <div class="slink-racing-toolbar"><div class="slink-racing-filters" role="tablist" aria-label="Racing build status">
            ${['needed','completed','all'].map(view => `<button type="button" data-racing-view="${view}" aria-selected="${String(userState.view === view)}">${view[0].toUpperCase() + view.slice(1)}</button>`).join('')}
          </div><span class="slink-racing-progress">${completed}/${racing.RECOMMENDED_BUILDS.length} complete</span></div>
          <div class="slink-racing-assistant" data-racing-assistant></div>
          <div role="status"><span data-racing-save-state></span> <button type="button" data-racing-retry hidden>Retry</button></div>
          <div class="slink-racing-list">${definitions.length ? definitions.map(definition => {
            const buildState = userState.builds[definition.id];
            const suggested = racing.suggestNickname(definition.tracks).value;
            const effective = racing.effectiveNickname(definition, userState);
            const validation = racing.validateNickname(effective);
            return `<article class="slink-racing-card" data-racing-build="${escapeHtml(definition.id)}" data-completed="${String(buildState.completed)}">
              <header><div><h3>${escapeHtml(definition.car)}</h3><span>Class ${escapeHtml(definition.class)} · ${escapeHtml(definition.tracks.join(', '))}</span></div><span data-racing-completion>${buildState.completed ? 'COMPLETE' : 'NEEDED'}</span></header>
              <div class="slink-racing-specs"><div><small>Turbo</small><strong>${escapeHtml(definition.build.turbo)}</strong></div><div><small>Transmission</small><strong>${escapeHtml(definition.build.transmission)}</strong></div><div><small>Gearbox</small><strong>${escapeHtml(definition.build.gearbox)}</strong></div><div><small>Tires</small><strong>${escapeHtml(definition.build.tires)}</strong></div></div>
              <div class="slink-racing-name"><label>Expected Torn nickname<input id="racing-name-${escapeHtml(definition.id)}" type="text" maxlength="100" data-racing-name value="${escapeHtml(effective)}" placeholder="${escapeHtml(suggested)}" aria-invalid="${String(!validation.valid)}"></label><span class="slink-racing-count" data-racing-count data-invalid="${String(!validation.valid)}">${validation.length}/${validation.maxLength}</span></div>
              <footer><small>${buildState.customName ? 'Custom nickname' : 'Suggested nickname'} · 22 characters maximum</small><div><button type="button" data-racing-reset-name>Use suggestion</button> <button type="button" data-racing-toggle>${buildState.completed ? 'Move to Needed' : 'Mark Complete'}</button></div></footer>
            </article>`;
          }).join('') : ''}<div class="slink-racing-empty" hidden>No builds in this view.</div></div>`;
          mounted = true;
          autosave.mount();
        }
        content.querySelectorAll('[data-racing-view]').forEach(button => {
          button.setAttribute('aria-selected',String(userState.view === button.dataset.racingView));
          button.disabled = actionBusy;
        });
        content.querySelector('.slink-racing-progress').textContent = `${completed}/${definitions.length} complete`;
        let visible = 0;
        for (const definition of definitions) {
          const card = content.querySelector(`[data-racing-build="${definition.id}"]`);
          const done = userState.builds[definition.id].completed;
          card.hidden = userState.view !== 'all' && (userState.view === 'completed') !== done;
          if (!card.hidden) visible++;
          card.dataset.completed = String(done);
          card.querySelector('[data-racing-completion]').textContent = done ? 'COMPLETE' : 'NEEDED';
          card.querySelector('[data-racing-toggle]').textContent = done ? 'Move to Needed' : 'Mark Complete';
          card.querySelectorAll('button').forEach(button => { button.disabled = actionBusy; });
          card.querySelector('footer small').textContent = `${userState.builds[definition.id].customName ? 'Custom nickname' : 'Suggested nickname'} · 22 characters maximum`;
          validateInput(card.querySelector('[data-racing-name]'));
        }
        content.querySelector('.slink-racing-empty').hidden = visible !== 0;
        showSaveState();
        setAssistant(assistant);
      }

      async function action(settings) {
        if (actionBusy || stopped || context.signal?.aborted) return;
        actionBusy = true; actionError = ''; render();
        try {
          await autosave.flush();
          if (stopped || context.signal?.aborted) return;
          const result = await queueSave(settings);
          if (!stopped && !context.signal?.aborted) adopt(result.settings);
        } catch (error) { actionError = SLINK.core.format.errorMessage(error); }
        finally { actionBusy = false; render(); }
      }
      context.listen(content, 'click', event => {
        if (stopped || context.signal?.aborted) return;
        if (event.target.closest('[data-racing-retry]')) { actionError = ''; void autosave.retry().catch(() => {}); return; }
        const viewButton = event.target.closest('[data-racing-view]');
        if (viewButton) {
          void action({view:viewButton.dataset.racingView});
          return;
        }
        const card = event.target.closest('[data-racing-build]');
        if (!card) return;
        const buildState = userState.builds[card.dataset.racingBuild];
        if (!buildState) return;
        if (event.target.closest('[data-racing-toggle]')) {
          void action({[`${card.dataset.racingBuild}:completed`]:!buildState.completed});
        } else if (event.target.closest('[data-racing-reset-name]')) {
          if (actionBusy) return;
          const definition = racing.RECOMMENDED_BUILDS.find(build => build.id === card.dataset.racingBuild);
          const input = card.querySelector('[data-racing-name]');
          input.value = racing.suggestNickname(definition.tracks).value;
          input.dispatchEvent(new Event('input',{bubbles:true}));
          input.dispatchEvent(new Event('change',{bubbles:true}));
        }
      });
      function validateInput(input) {
        const card = input.closest('[data-racing-build]');
        const validation = racing.validateNickname(input.value);
        input.setAttribute('aria-invalid',String(!validation.valid));
        const counter = card.querySelector('[data-racing-count]');
        if (counter) {
          counter.textContent = `${validation.length}/${validation.maxLength}`;
          counter.dataset.invalid = String(!validation.valid);
        }
      }
      context.listen(content, 'input', event => {
        if (stopped || !event.target.matches('[data-racing-name]')) return;
        actionError = ''; validateInput(event.target); showSaveState();
      });

      render();
      if(context.presentation!=='dashboard'){ensureHighlightStyle();
      observer = new MutationObserver(mutations => {
        if (!pageEligible()) return;
        if (!onRacewayPage()) return;
        if (mutations.every(mutation => {
          if (mutation.target?.closest?.('[data-slink-racing-label],#slink-extension-panel')) return true;
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const withoutHighlight = value => String(value || '').split(/\s+/).filter(token => token && token !== HIGHLIGHT_CLASS).sort().join(' ');
            if (withoutHighlight(mutation.oldValue) === withoutHighlight(mutation.target?.getAttribute?.('class'))) return true;
          }
          if (mutation.type === 'attributes') {
            const selector = `${racing.RACEWAY_DOM.OFFICIAL_RACE_TRACK_SELECTOR},${racing.RACEWAY_DOM.OFFICIAL_RACE_CAR_NAME_SELECTOR}`;
            if (!mutation.target?.closest?.(selector) && !mutation.target?.querySelector?.(selector)) return true;
          }
          const changed = [...mutation.addedNodes, ...mutation.removedNodes];
          return changed.length > 0 && changed.every(node => node.nodeType === 1 && node.matches?.('[data-slink-racing-label]'));
        })) return;
        scheduleScan();
      });
      observer.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeOldValue:true, attributeFilter:['class','style','hidden','aria-hidden'] });
      global.addEventListener('hashchange', scheduleScan);
      global.addEventListener('popstate', scheduleScan);
      global.addEventListener('focus', onPageActivity);
      global.addEventListener('blur', onPageActivity);
      document.addEventListener('visibilitychange', onPageActivity);
      scheduleScan(0);}

      return {
        async stop() {
          stopped = true;
          const pendingSave = autosave.stop();
          observer?.disconnect();
          if (scanTimer) global.clearTimeout(scanTimer);
          global.removeEventListener('hashchange', scheduleScan);
          global.removeEventListener('popstate', scheduleScan);
          global.removeEventListener('focus', onPageActivity);
          global.removeEventListener('blur', onPageActivity);
          document.removeEventListener('visibilitychange', onPageActivity);
          clearHighlight();
          document.getElementById(HIGHLIGHT_STYLE_ID)?.remove();
          await pendingSave;
        }
      };
    }
  });
})(globalThis);
