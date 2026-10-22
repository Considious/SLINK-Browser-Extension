(function installUiShell(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before the UI shell.');

  const HOST_ID = 'slink-extension-panel';
  const ACTIVE_MODULE_STORAGE_KEY = 'ui.main.activeModule';
  const ACTIVE_MODULES_BY_GROUP_STORAGE_KEY = 'ui.main.activeModulesByGroup';
  const NAVIGATION_STATE_STORAGE_KEY = 'ui.main.navigation.v2';
  const ACTIVE_NAVIGATION_MIRROR_KEY = 'slink-extension:ui:main:navigation:v2';
  const LEGACY_NAVIGATION_MIRROR_KEY = 'slink-extension:ui:main:navigation:v1';
  const MAIN_SIZE_STORAGE_KEY = 'ui.main.size';
  const MAIN_SIZE_MIRROR_KEY = 'slink-extension:ui:main:size:v1';
  const NAVIGATION_FALLBACK_ORDER = Object.freeze(['leveling','bounties','mugging','target-list','war','player-stats','adhd','market','merits','dollar-bazaars','racing']);
  const STYLES = `
    :host { all: initial; ${SLINK.core.themes.cssVariables('slink-dark')} }
    * { box-sizing:border-box; }
    .window { position:fixed; z-index:999999; width:min(350px,calc(100vw - 16px)); overflow:hidden; border:1px solid var(--slink-border); border-radius:10px; background:var(--slink-bg); color:var(--slink-text); box-shadow:0 10px 28px var(--slink-shadow); font:12px/1.4 Arial,sans-serif; }
    .window.main { display:flex; flex-direction:column; width:min(350px,calc(100vw - 16px)); height:min(560px,calc(100dvh - 16px)); min-width:min(300px,calc(100vw - 16px)); min-height:220px; max-width:calc(100vw - 8px); max-height:calc(100dvh - 8px); resize:both; }
    .window.main > .head, .window.main > .groups, .window.main > .tabs { flex:0 0 auto; }
    .window.main > .module-view { display:flex; flex:1 1 auto; flex-direction:column; min-height:0; overflow:hidden; }
    .window[hidden], .module-view[hidden], .groups[hidden], .tabs[hidden], .tab[hidden] { display:none !important; }
    .bubble { position:fixed; right:12px; top:88px; z-index:999999; display:grid; place-items:center; width:50px; height:50px; padding:0; border:1px solid var(--slink-border); border-radius:50%; background:var(--slink-panel-bg); color:var(--slink-text); box-shadow:-3px 0 14px var(--slink-glow-left),3px 0 14px var(--slink-glow-right),0 8px 22px var(--slink-shadow); cursor:grab; touch-action:none; user-select:none; }
    .bubble[hidden] { display:none; }
    .bubble[data-dragging="true"] { cursor:grabbing; }
    .bubble-coil { position:relative; display:block; width:28px; height:24px; }
    .bubble-coil span { position:absolute; left:2px; width:24px; height:9px; border:2px solid var(--slink-metal); border-radius:50%; background:transparent; box-shadow:0 0 5px var(--slink-glow-right); }
    .bubble-coil span:nth-child(1) { top:0; }
    .bubble-coil span:nth-child(2) { top:5px; }
    .bubble-coil span:nth-child(3) { top:10px; }
    .bubble-coil span:nth-child(4) { top:15px; }
    .bubble-alert-icon { display:none; font-size:23px; line-height:1; filter:drop-shadow(0 0 5px currentColor); }
    .bubble-alert-count { display:none; position:absolute; right:-3px; top:-4px; min-width:18px; height:18px; padding:1px 4px; border:2px solid #fff; border-radius:999px; background:#d51919; color:#fff; font:bold 10px/12px Arial,sans-serif; }
    .bubble[data-alert-kind] .bubble-coil { display:none; }
    .bubble[data-alert-kind] .bubble-alert-icon, .bubble[data-alert-kind] .bubble-alert-count { display:block; }
    .bubble[data-alert-kind="retal"] { border-color:#ff5a5a; background:#5f0606; color:#fff; animation:slinkBubbleRetal .65s ease-in-out infinite alternate; }
    .bubble[data-alert-kind="armory"] { border-color:#ffb24b; background:#4d2600; color:#fff; animation:slinkBubbleArmory .85s ease-in-out infinite alternate; }
    .bubble[data-alert-kind="adhd"] { border-color:var(--slink-warning); background:var(--slink-bg-control); color:var(--slink-warning); animation:slinkBubbleAdhd 1s ease-in-out infinite alternate; }
    @keyframes slinkBubbleRetal { to { background:#b20d0d; box-shadow:0 0 8px #fff,0 0 26px #f00; transform:scale(1.08); } }
    @keyframes slinkBubbleArmory { to { background:#875000; box-shadow:0 0 8px #fff,0 0 24px #ff8a00; transform:scale(1.06); } }
    @keyframes slinkBubbleAdhd { to { box-shadow:0 0 8px #fff,0 0 22px var(--slink-warning); transform:scale(1.05); } }
    :host([data-slink-theme="slink-dark"]) .bubble { background:linear-gradient(145deg,#3478b9,#172f4c); }
    .main { right:12px; top:88px; }
    .popup { left:12px; top:88px; }
    .head { display:flex; align-items:center; gap:8px; padding:9px 10px; border-bottom:1px solid var(--slink-border-soft); cursor:grab; touch-action:none; user-select:none; }
    .head[data-dragging="true"] { cursor:grabbing; }
    .mark { display:grid; place-items:center; width:32px; height:32px; flex:0 0 auto; border-radius:9px; background:linear-gradient(145deg,#3478b9,#172f4c); font-weight:800; }
    .heading { min-width:0; flex:1; }
    .title { font-size:13px; font-weight:700; }
    .subtitle { overflow:hidden; color:var(--slink-muted); font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
    button { min-height:30px; border:1px solid var(--slink-border-soft); border-radius:6px; background:var(--slink-bg-control); color:var(--slink-text); cursor:pointer; }
    button:hover { filter:brightness(1.15); }
    .icon-button { width:30px; padding:0; }
    .groups,.tabs { display:grid; gap:4px; overflow:auto; padding:6px 7px; border-bottom:1px solid var(--slink-border-soft); }
    .groups { grid-template-columns:repeat(2,minmax(0,1fr)); padding-bottom:4px; background:var(--slink-bg-raised); }
    .tabs { grid-template-columns:repeat(auto-fit,minmax(70px,1fr)); padding-top:4px; }
    .group-tab { min-height:29px; padding:3px 7px; color:var(--slink-muted); font-weight:700; }
    .group-tab[aria-selected="true"] { border-color:var(--slink-accent-alt); background:var(--slink-selected-bg); color:var(--slink-text); box-shadow:0 0 10px var(--slink-glow-right); }
    .tab { flex:1 0 auto; min-height:27px; padding:3px 7px; color:var(--slink-muted); }
    .tab[aria-selected="true"] { border-color:var(--slink-border); background:var(--slink-accent); color:var(--slink-text); }
    .group-tab,.tab { position:relative; display:flex; align-items:center; justify-content:center; gap:5px; text-align:center; }
    .nav-alert-count { display:inline-grid; place-items:center; min-width:18px; height:18px; padding:0 4px; border:2px solid #050505; border-radius:999px; background:#d71920; color:#fff; box-shadow:0 0 0 1px rgba(255,255,255,.32); font:bold 10px/14px Arial,sans-serif; }
    .nav-alert-count[hidden] { display:none; }
    .module-head { display:flex; align-items:center; gap:7px; padding:6px 9px 0; }
    .module-head strong { flex:1; }
    .status { padding:7px 10px; border-bottom:1px solid var(--slink-border-soft); color:var(--slink-accent); }
    .status[data-tone="ready"] { color:var(--slink-ready); }
    .status[data-tone="error"] { max-height:72px; overflow:auto; overscroll-behavior:contain; overflow-wrap:anywhere; white-space:normal; color:var(--slink-error); }
    .content { display:grid; align-content:start; grid-auto-rows:max-content; gap:7px; width:100%; min-width:0; max-height:min(420px,calc(100dvh - 210px)); overflow:auto; padding:9px 10px; }
    .content > * { min-width:0; max-width:100%; }
    .window.main > .module-view > .module-head, .window.main > .module-view > .status, .window.main > .module-view > .actions { flex:0 0 auto; }
    .window.main > .module-view > .content { flex:1 1 auto; min-height:0; max-height:none; overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; }
    .row { display:grid; grid-template-columns:105px minmax(0,1fr); gap:8px; }
    .label { color:var(--slink-muted); }
    .value { overflow-wrap:anywhere; color:var(--slink-text); }
    .actions { display:flex; gap:6px; padding:0 10px 10px; }
    .actions:empty { display:none; }
    .actions button { flex:1; padding:4px 8px; }
    .slink-alert { width:min(330px,calc(100vw - 16px)); }
    .slink-alert .content { max-height:min(300px,calc(100dvh - 170px)); }
    .slink-alert-body { display:grid; gap:7px; }
    :host(:not([data-slink-theme="slink-dark"])) .window { border-color:var(--slink-border); background:var(--slink-panel-bg); box-shadow:-5px 0 20px var(--slink-glow-left),5px 0 20px var(--slink-glow-right),0 10px 28px var(--slink-shadow); }
    :host(:not([data-slink-theme="slink-dark"])) .mark { background:var(--slink-mark-bg); color:#050607; box-shadow:inset 0 0 0 1px var(--slink-metal),0 0 12px var(--slink-glow-right); text-shadow:0 1px rgba(255,255,255,.45); }
    :host(:not([data-slink-theme="slink-dark"])) .tab[aria-selected="true"] { background:var(--slink-selected-bg); box-shadow:0 0 12px var(--slink-glow-right); }
    :host(:not([data-slink-theme="slink-dark"])) .actions button { background:var(--slink-button-bg); }
    :host([data-slink-ornament="coil"]) .module-head strong::before { display:inline-block; width:20px; height:15px; margin-right:6px; vertical-align:-3px; background:repeating-radial-gradient(ellipse at center,transparent 0 2px,var(--slink-metal) 3px 4px,transparent 5px 7px); filter:drop-shadow(0 0 4px var(--slink-glow-right)); content:""; }
    :host([data-slink-image-theme="true"]) .window { border-color:var(--slink-border); background-color:var(--slink-bg); background-image:linear-gradient(color-mix(in srgb,rgb(5 3 9) var(--slink-theme-veil-top,24%),transparent),color-mix(in srgb,rgb(5 3 9) var(--slink-theme-veil-bottom,46%),transparent)),var(--slink-theme-background-image); background-position:center top; background-size:cover; box-shadow:-5px 0 20px var(--slink-glow-left),5px 0 22px var(--slink-glow-right),0 14px 34px var(--slink-shadow); }
    :host([data-slink-image-theme="true"]) .head,:host([data-slink-image-theme="true"]) .groups,:host([data-slink-image-theme="true"]) .tabs,:host([data-slink-image-theme="true"]) .module-view { background:color-mix(in srgb,var(--slink-bg) var(--slink-theme-panel-opacity,72%),transparent); backdrop-filter:blur(var(--slink-theme-panel-blur,7px)) saturate(1.12); }
    :host([data-slink-image-theme="true"]) .group-tab[aria-selected="true"],:host([data-slink-image-theme="true"]) .tab[aria-selected="true"] { border-color:var(--slink-accent-alt); background:var(--slink-selected-bg); box-shadow:-3px 0 11px var(--slink-glow-left),3px 0 13px var(--slink-glow-right); }
    :host([data-slink-image-theme="true"]) .content > * { border-color:var(--slink-border-soft); }
    :host([data-slink-icon-theme="true"]) .group-tab::before,:host([data-slink-icon-theme="true"]) .tab::before,:host([data-slink-icon-theme="true"]) .module-head strong::before { display:inline-block; width:17px; height:17px; flex:0 0 17px; margin-right:4px; vertical-align:-4px; background-image:var(--slink-theme-icon-sheet); background-repeat:no-repeat; background-size:400% 500%; filter:drop-shadow(0 0 4px var(--slink-glow-right)); content:""; }
    :host([data-slink-icon-theme="true"]) .group-tab::before,:host([data-slink-icon-theme="true"]) .tab::before { position:absolute; left:6px; top:50%; margin-right:0; transform:translateY(-50%); }
    .group-tab > .nav-alert-count,.tab > .nav-alert-count { position:absolute; right:5px; top:50%; transform:translateY(-50%); }
    :host([data-slink-icon-theme="true"]) [data-slink-group="combat"]::before { background-position:66.666% 75%; }
    :host([data-slink-icon-theme="true"]) [data-slink-group="efficiency"]::before { background-position:0 25%; }
    :host([data-slink-icon-theme="true"]) [data-slink-group="quality-of-life"]::before { background-position:66.666% 0; }
    :host([data-slink-icon-theme="true"]) [data-slink-module="adhd"]::before { background-position:0 0; }
    :host([data-slink-icon-theme="true"]) [data-slink-module="market"]::before { background-position:33.333% 0; }
    :host([data-slink-icon-theme="true"]) [data-slink-module="merits"]::before { background-position:66.666% 0; }
    :host([data-slink-icon-theme="true"]) [data-slink-module="dollar-bazaars"]::before { background-position:100% 0; }
    :host([data-slink-icon-theme="true"]) [data-slink-module="player-stats"]::before { background-position:0 25%; }
    :host([data-slink-icon-theme="true"]) [data-slink-module="company"]::before { background-position:66.666% 25%; }
    :host([data-slink-icon-theme="true"]) [data-slink-module="faction-officers"]::before { background-position:33.333% 25%; }
    :host([data-slink-icon-theme="true"]) [data-slink-module="money-property"]::before { background-position:100% 0; }
    :host([data-slink-icon-theme="true"]) [data-slink-module="bounties"]::before,:host([data-slink-icon-theme="true"]) [data-slink-module="target-list"]::before { background-position:66.666% 75%; }
    :host([data-slink-icon-theme="true"]) .module-head strong::before { background-position:0 25%; }
    :host([data-slink-image-theme="true"]) .bubble { background:var(--slink-mark-bg); }
    @media(max-width:420px) { .window{width:min(300px,calc(100vw - 8px))}.main{right:4px;top:4px}.popup{left:4px;top:4px}.bubble{right:6px;top:64px;width:46px;height:46px}.row{grid-template-columns:90px minmax(0,1fr)}.content{max-height:calc(100dvh - 190px)} }
  `;

  function createShell(options = {}) {
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      document.documentElement.appendChild(host);
    }
    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    shadow.replaceChildren();
    const style = document.createElement('style');
    style.textContent = STYLES;
    const themeStyle = document.createElement('style');
    shadow.append(style, themeStyle);
    SLINK.core.formState?.protect(shadow);

    function setThemePanelOpacity(value) {
      return SLINK.core.themes.applyPanelOpacity(host, value);
    }

    function setTheme(id, permissions = {}) {
      const theme = SLINK.core.themes.resolve(id, permissions);
      host.dataset.slinkTheme = theme.id;
      host.dataset.slinkOrnament = theme.ornament || 'none';
      host.dataset.slinkImageTheme = theme.assets?.background ? 'true' : 'false';
      host.dataset.slinkIconTheme = theme.assets?.iconSheet ? 'true' : 'false';
      themeStyle.textContent = `:host{${SLINK.core.themes.cssVariables(theme.id, permissions)}}`;
      return theme;
    }
    setTheme(options.themeId || SLINK.core.themes.DEFAULT_THEME_ID, options.permissions || {});

    const main = createWindow('main', options.title || 'SLINK', options.subtitle || 'Extension systems');
    const mainSizeMemory = rememberMainSize(main.element, main.mover);
    main.element.querySelector('.hide').textContent = '−';
    main.element.querySelector('.hide').title = 'Collapse SLINK to a movable bubble';
    const groups = document.createElement('nav');
    groups.className = 'groups';
    groups.setAttribute('aria-label', 'SLINK sections');
    const tabs = document.createElement('nav');
    tabs.className = 'tabs';
    tabs.setAttribute('aria-label', 'SLINK tools');
    main.head.after(groups, tabs);
    const bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.className = 'bubble';
    bubble.title = 'Open SLINK';
    bubble.setAttribute('aria-label', 'Open SLINK panel');
    bubble.innerHTML = '<span class="bubble-coil" aria-hidden="true"><span></span><span></span><span></span><span></span></span><span class="bubble-alert-icon" aria-hidden="true"></span><span class="bubble-alert-count" aria-hidden="true"></span>';
    shadow.append(main.element, bubble);
    const views = new Map();
    const groupButtons = new Map();
    const alerts = new Map();
    const navigationAlerts = new Map();
    let hidden = false;
    let collapsed = false;
    let activeId = '';
    let activeGroup = '';
    let preferredActiveId = '';
    let preferredActiveGroup = '';
    const preferredActiveIdsByGroup = new Map();
    let navigationSelectionChanged = false;
    let hasRestoredNavigationSelection = false;
    let navigationUpdatedAt = 0;
    let navigationWriteQueue = Promise.resolve();
    const bubbleAlertSources = new Map();

    function normalizeNavigationState(value) {
      const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      const activeModulesByGroup = {};
      if (source.activeModulesByGroup && typeof source.activeModulesByGroup === 'object' && !Array.isArray(source.activeModulesByGroup)) {
        for (const [groupId, moduleId] of Object.entries(source.activeModulesByGroup)) {
          const group = String(groupId || '').trim();
          const module = typeof moduleId === 'string' ? moduleId.trim() : '';
          if (group && module) activeModulesByGroup[group] = module;
        }
      }
      return {
        activeModule:typeof source.activeModule === 'string' ? source.activeModule.trim() : '',
        activeGroup:typeof source.activeGroup === 'string' ? source.activeGroup.trim() : '',
        activeModulesByGroup,
        updatedAt:Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : 0
      };
    }

    function hasNavigationSelection(state) {
      return Boolean(state.activeModule || Object.keys(state.activeModulesByGroup).length);
    }

    function applyNavigationState(state) {
      const normalized = normalizeNavigationState(state);
      preferredActiveId = normalized.activeModule;
      preferredActiveGroup = normalized.activeGroup;
      preferredActiveIdsByGroup.clear();
      for (const [groupId, moduleId] of Object.entries(normalized.activeModulesByGroup)) preferredActiveIdsByGroup.set(groupId, moduleId);
      navigationUpdatedAt = Math.max(navigationUpdatedAt, normalized.updatedAt);
      hasRestoredNavigationSelection = hasNavigationSelection(normalized);
    }

    function currentNavigationState() {
      return {
        activeModule:preferredActiveId,
        activeGroup:preferredActiveGroup || activeGroup,
        activeModulesByGroup:Object.fromEntries(preferredActiveIdsByGroup),
        updatedAt:navigationUpdatedAt
      };
    }

    function readNavigationMirror() {
      try {
        const current = normalizeNavigationState(JSON.parse(global.localStorage.getItem(ACTIVE_NAVIGATION_MIRROR_KEY) || 'null'));
        if (hasNavigationSelection(current)) return current;
        return normalizeNavigationState(JSON.parse(global.localStorage.getItem(LEGACY_NAVIGATION_MIRROR_KEY) || 'null'));
      } catch {
        return normalizeNavigationState(null);
      }
    }

    function writeNavigationMirror(state = currentNavigationState()) {
      try {
        global.localStorage.setItem(ACTIVE_NAVIGATION_MIRROR_KEY, JSON.stringify(state));
      } catch {}
    }

    function persistNavigationState() {
      navigationUpdatedAt = Math.max(Date.now(), navigationUpdatedAt + 1);
      const snapshot = currentNavigationState();
      writeNavigationMirror(snapshot);
      navigationWriteQueue = navigationWriteQueue.then(async () => {
        await SLINK.core.storage.set(NAVIGATION_STATE_STORAGE_KEY, snapshot);
        await Promise.all([
          SLINK.core.storage.set(ACTIVE_MODULE_STORAGE_KEY, snapshot.activeModule),
          SLINK.core.storage.set(ACTIVE_MODULES_BY_GROUP_STORAGE_KEY, snapshot.activeModulesByGroup)
        ]);
      }).catch(() => {});
    }

    const mirroredNavigation = readNavigationMirror();
    const navigationPreferencesReady = Promise.all([
      SLINK.core.storage.get(NAVIGATION_STATE_STORAGE_KEY, null),
      SLINK.core.storage.get(ACTIVE_MODULE_STORAGE_KEY, ''),
      SLINK.core.storage.get(ACTIVE_MODULES_BY_GROUP_STORAGE_KEY, {})
    ]).then(([storedNavigation, legacyActiveId, legacyByGroup]) => {
      if (navigationSelectionChanged) return;
      const stored = normalizeNavigationState(storedNavigation);
      const legacy = normalizeNavigationState({
        activeModule:legacyActiveId,
        activeModulesByGroup:legacyByGroup
      });
      let selected = legacy;
      if (hasNavigationSelection(stored)) {
        selected = hasNavigationSelection(mirroredNavigation) && mirroredNavigation.updatedAt > stored.updatedAt
          ? mirroredNavigation
          : stored;
      } else if (!hasNavigationSelection(legacy) && hasNavigationSelection(mirroredNavigation)) {
        selected = mirroredNavigation;
      }
      applyNavigationState(selected);
    });

    function displayAlertCount(count) {
      return Number(count) > 99 ? '99+' : String(Math.max(1, Number(count) || 1));
    }

    function updateNavigationAlerts() {
      for (const [moduleId, view] of views) {
        const alert = navigationAlerts.get(moduleId);
        const count = Math.max(0, Number(alert?.count) || 0);
        view.alertBadge.hidden = count === 0;
        view.alertBadge.textContent = count ? displayAlertCount(count) : '';
        const description = count ? `${count} ${alert.label || 'active alerts'}` : '';
        view.tab.title = description;
        view.tab.setAttribute('aria-label', description ? `${view.title}: ${description}` : view.title);
      }
      for (const [groupId, button] of groupButtons) {
        const count = [...navigationAlerts.values()].filter(alert => alert.group === groupId).reduce((total, alert) => total + Math.max(0, Number(alert.count) || 0), 0);
        const badge = button.querySelector('.nav-alert-count');
        badge.hidden = count === 0;
        badge.textContent = count ? displayAlertCount(count) : '';
        const label = button.dataset.label || groupId;
        button.title = count ? `${count} active alert${count === 1 ? '' : 's'} in ${label}` : '';
        button.setAttribute('aria-label', count ? `${label}: ${count} active alert${count === 1 ? '' : 's'}` : label);
      }
    }

    function setAlertCount(source, count = 0, details = {}) {
      const sourceId = String(source || '').trim();
      if (!sourceId) return;
      const normalized = Math.max(0, Math.trunc(Number(count) || 0));
      if (normalized) navigationAlerts.set(sourceId, {
        count:normalized,
        group:String(details.group || views.get(sourceId)?.group || ''),
        label:String(details.label || 'active alerts')
      });
      else navigationAlerts.delete(sourceId);
      updateNavigationAlerts();
    }

    function setBubbleAlert(kind = '', count = 0, source = 'default') {
      const sourceId = String(source || 'default');
      const candidate = ['retal', 'armory', 'adhd'].includes(String(kind)) && Number(count) > 0
        ? { kind:String(kind), count:Number(count) }
        : null;
      if (candidate) bubbleAlertSources.set(sourceId, candidate); else bubbleAlertSources.delete(sourceId);
      const priority = { retal:3, armory:2, adhd:1 };
      const selected = [...bubbleAlertSources.values()].sort((left, right) => priority[right.kind] - priority[left.kind])[0] || null;
      const normalized = selected?.kind || '';
      count = selected?.count || 0;
      if (normalized) bubble.dataset.alertKind = normalized; else delete bubble.dataset.alertKind;
      bubble.querySelector('.bubble-alert-icon').textContent = normalized === 'retal' ? '🚨' : normalized === 'armory' ? '🔫' : normalized === 'adhd' ? '🔔' : '';
      bubble.querySelector('.bubble-alert-count').textContent = normalized ? String(Math.min(99, Math.max(1, Number(count) || 1))) : '';
      bubble.title = normalized === 'retal' ? `${count} active retaliation alert${Number(count) === 1 ? '' : 's'}` : normalized === 'armory' ? `${count} active armory request${Number(count) === 1 ? '' : 's'}` : normalized === 'adhd' ? `${count} active Efficiency reminder${Number(count) === 1 ? '' : 's'}` : 'Open SLINK';
      bubble.setAttribute('aria-label', bubble.title);
    }

    function createWindow(kind, title, subtitle) {
      const element = document.createElement('section');
      element.className = `window ${kind}`;
      element.innerHTML = `<header class="head"><div class="mark" aria-hidden="true">SL</div><div class="heading"><div class="title"></div><div class="subtitle"></div></div><button class="icon-button hide" type="button" title="Hide SLINK UI">X</button></header>`;
      element.querySelector('.title').textContent = title;
      element.querySelector('.subtitle').textContent = subtitle;
      const head = element.querySelector('.head');
      const mover = makeMovable(element, head, kind === 'main' ? 'ui.main.position' : `ui.alerts.${kind}.position`);
      return { element, head, mover };
    }

    function makeMovable(element, head, storageKey) {
      let drag = null;
      const setPosition = (position, persist = false) => {
        if (!Number.isFinite(Number(position?.left)) || !Number.isFinite(Number(position?.top))) return;
        const width = element.getBoundingClientRect().width || 300;
        const height = element.getBoundingClientRect().height || 100;
        const next = {
          left: Math.round(Math.max(4, Math.min(Number(position.left), global.innerWidth - width - 4))),
          top: Math.round(Math.max(4, Math.min(Number(position.top), global.innerHeight - height - 4)))
        };
        element.style.left = `${next.left}px`; element.style.top = `${next.top}px`; element.style.right = 'auto';
        if (persist) void SLINK.core.storage.set(storageKey, next);
      };
      head.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('button')) return;
        const box = element.getBoundingClientRect();
        drag = { id:event.pointerId, x:event.clientX, y:event.clientY, left:box.left, top:box.top };
        head.dataset.dragging = 'true'; head.setPointerCapture(event.pointerId); event.preventDefault();
      });
      head.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) return;
        setPosition({ left:drag.left + event.clientX - drag.x, top:drag.top + event.clientY - drag.y });
      });
      const finish = event => {
        if (!drag || event.pointerId !== drag.id) return;
        const box = element.getBoundingClientRect(); drag = null; delete head.dataset.dragging;
        setPosition({ left:box.left, top:box.top }, true);
      };
      head.addEventListener('pointerup', finish); head.addEventListener('pointercancel', finish);
      void SLINK.core.storage.get(storageKey, null).then(position => { if (position) setPosition(position); });
      return Object.freeze({
        clamp(persist = false) {
          const box = element.getBoundingClientRect();
          setPosition({ left:box.left, top:box.top }, persist);
        },
        reset() {
          element.style.removeProperty('left');
          element.style.removeProperty('top');
          element.style.removeProperty('right');
        }
      });
    }

    function rememberMainSize(element, mover) {
      let preferredSize = null;
      let resizing = false;

      function normalizeSize(value) {
        const width = Number(value?.width);
        const height = Number(value?.height);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
        return {
          width:Math.round(width),
          height:Math.round(height),
          updatedAt:Number.isFinite(Number(value?.updatedAt)) ? Number(value.updatedAt) : 0
        };
      }

      function clampedSize(value) {
        const normalized = normalizeSize(value);
        if (!normalized) return null;
        const maxWidth = Math.max(120, global.innerWidth - 8);
        const maxHeight = Math.max(120, global.innerHeight - 8);
        const minWidth = Math.min(300, maxWidth);
        const minHeight = Math.min(220, maxHeight);
        return {
          width:Math.round(Math.min(Math.max(normalized.width, minWidth), maxWidth)),
          height:Math.round(Math.min(Math.max(normalized.height, minHeight), maxHeight))
        };
      }

      function applySize(value) {
        const normalized = normalizeSize(value);
        const bounded = clampedSize(normalized);
        if (!normalized || !bounded) return;
        preferredSize = normalized;
        element.style.width = `${bounded.width}px`;
        element.style.height = `${bounded.height}px`;
        global.requestAnimationFrame(() => mover.clamp());
      }

      function readSizeMirror() {
        try {
          return normalizeSize(JSON.parse(global.localStorage.getItem(MAIN_SIZE_MIRROR_KEY) || 'null'));
        } catch {
          return null;
        }
      }

      function persistSize() {
        const box = element.getBoundingClientRect();
        const next = normalizeSize({ width:box.width, height:box.height, updatedAt:Date.now() });
        if (!next) return;
        preferredSize = next;
        try { global.localStorage.setItem(MAIN_SIZE_MIRROR_KEY, JSON.stringify(next)); } catch {}
        void SLINK.core.storage.set(MAIN_SIZE_STORAGE_KEY, next);
        mover.clamp(true);
      }

      const mirroredSize = readSizeMirror();
      if (mirroredSize) applySize(mirroredSize);
      void SLINK.core.storage.get(MAIN_SIZE_STORAGE_KEY, null).then(storedValue => {
        const storedSize = normalizeSize(storedValue);
        const selected = storedSize && (!mirroredSize || storedSize.updatedAt >= mirroredSize.updatedAt) ? storedSize : mirroredSize;
        if (selected) applySize(selected);
      });

      element.addEventListener('pointerdown', event => {
        const box = element.getBoundingClientRect();
        resizing = event.clientX >= box.right - 24 && event.clientY >= box.bottom - 24;
      });
      const finishResize = () => {
        if (!resizing) return;
        resizing = false;
        persistSize();
      };
      global.addEventListener('pointerup', finishResize);
      global.addEventListener('pointercancel', finishResize);
      global.addEventListener('resize', () => {
        if (preferredSize) applySize(preferredSize);
        else mover.clamp();
      });

      return Object.freeze({
        reset() {
          preferredSize = null;
          element.style.removeProperty('width');
          element.style.removeProperty('height');
          try { global.localStorage.removeItem(MAIN_SIZE_MIRROR_KEY); } catch {}
        }
      });
    }

    function setActive(id, persist = false) {
      if (!views.has(id)) return;
      activeId = id;
      activeGroup = views.get(id).group;
      if (persist) {
        navigationSelectionChanged = true;
        preferredActiveId = id;
        preferredActiveGroup = activeGroup;
        preferredActiveIdsByGroup.set(activeGroup, id);
        persistNavigationState();
      }
      for (const [moduleId, view] of views) {
        view.element.hidden = moduleId !== id;
        view.tab.hidden = view.group !== activeGroup;
        view.tab?.setAttribute('aria-selected', String(moduleId === id));
      }
      for (const [groupId, button] of groupButtons) button.setAttribute('aria-selected', String(groupId === activeGroup));
    }

    function setActiveGroup(groupId, persist = true) {
      const matches = [...views.values()].filter(view => view.group === groupId);
      if (!matches.length) return;
      const groupPreference = preferredActiveIdsByGroup.get(groupId);
      const preferred = matches.find(view => view.id === groupPreference) || matches.find(view => view.id === preferredActiveId);
      setActive((preferred || matches[0]).id, persist);
    }

    function refreshShell() {
      const docked = [...views.values()];
      const firstRunFallback = NAVIGATION_FALLBACK_ORDER.map(id => views.get(id)).find(Boolean) || docked[0] || null;
      if (views.has(preferredActiveId)) {
        activeId = preferredActiveId;
      } else if (!navigationSelectionChanged && !hasRestoredNavigationSelection && firstRunFallback) {
        activeId = firstRunFallback.id;
      } else if (!docked.some(view => view.id === activeId)) {
        const preferredForSavedGroup = preferredActiveIdsByGroup.get(preferredActiveGroup);
        const preferred = views.get(preferredActiveId)
          || views.get(preferredForSavedGroup)
          || firstRunFallback;
        activeId = preferred?.id || '';
      }
      if (activeId) setActive(activeId, false);
      const activeViews = docked.filter(view => view.group === activeGroup);
      groups.hidden = groupButtons.size < 2;
      tabs.hidden = activeViews.length === 0;
      main.element.hidden = hidden || collapsed || docked.length === 0;
      bubble.hidden = hidden || !collapsed || views.size === 0;
      for (const alert of alerts.values()) alert.element.hidden = hidden;
    }

    async function setCollapsed(value, persist = true) {
      collapsed = Boolean(value);
      if (persist) await SLINK.core.storage.set('ui.main.collapsed', collapsed);
      refreshShell();
    }

    function makeBubbleMovable() {
      let drag = null;
      let moved = false;
      const setPosition = (position, persist = false) => {
        if (!Number.isFinite(Number(position?.left)) || !Number.isFinite(Number(position?.top))) return;
        const size = bubble.getBoundingClientRect().width || 50;
        const next = {
          left:Math.round(Math.max(4, Math.min(Number(position.left), global.innerWidth - size - 4))),
          top:Math.round(Math.max(4, Math.min(Number(position.top), global.innerHeight - size - 4)))
        };
        bubble.style.left = `${next.left}px`; bubble.style.top = `${next.top}px`; bubble.style.right = 'auto';
        if (persist) void SLINK.core.storage.set('ui.bubble.position', next);
      };
      bubble.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const box = bubble.getBoundingClientRect();
        drag = { id:event.pointerId, x:event.clientX, y:event.clientY, left:box.left, top:box.top };
        moved = false; bubble.dataset.dragging = 'true'; bubble.setPointerCapture(event.pointerId); event.preventDefault();
      });
      bubble.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) return;
        if (Math.abs(event.clientX - drag.x) > 3 || Math.abs(event.clientY - drag.y) > 3) moved = true;
        setPosition({ left:drag.left + event.clientX - drag.x, top:drag.top + event.clientY - drag.y });
      });
      const finish = event => {
        if (!drag || event.pointerId !== drag.id) return;
        const box = bubble.getBoundingClientRect(); drag = null; delete bubble.dataset.dragging;
        if (moved) setPosition({ left:box.left, top:box.top }, true);
      };
      bubble.addEventListener('pointerup', finish);
      bubble.addEventListener('pointercancel', finish);
      bubble.addEventListener('click', event => {
        if (moved) { moved = false; event.preventDefault(); return; }
        void setCollapsed(false);
      });
      void SLINK.core.storage.get('ui.bubble.position', null).then(position => { if (position) setPosition(position); });
      return Object.freeze({
        reset() {
          bubble.style.removeProperty('left');
          bubble.style.removeProperty('top');
          bubble.style.removeProperty('right');
        }
      });
    }

    function dismissAlert(id) {
      const key = String(id || '');
      const alert = alerts.get(key);
      if (!alert) return;
      alert.element.remove();
      alerts.delete(key);
    }

    function showAlert(definition = {}) {
      const id = String(definition.id || '').trim();
      if (!id) throw new Error('A SLINK alert ID is required.');
      let alert = alerts.get(id);
      if (!alert) {
        alert = createWindow(`alert-${id}`, definition.title || 'SLINK alert', definition.subtitle || '');
        alert.element.classList.add('popup', 'slink-alert');
        alert.content = document.createElement('div');
        alert.content.className = 'content slink-alert-body';
        alert.actions = document.createElement('div');
        alert.actions.className = 'actions';
        alert.element.append(alert.content, alert.actions);
        alert.element.querySelector('.hide').addEventListener('click', () => {
          if (typeof alert.onDismiss === 'function') void alert.onDismiss();
          dismissAlert(id);
        });
        alerts.set(id, alert);
        shadow.append(alert.element);
      }
      alert.onDismiss = definition.onDismiss;
      alert.element.querySelector('.title').textContent = String(definition.title || 'SLINK alert');
      alert.element.querySelector('.subtitle').textContent = String(definition.subtitle || '');
      alert.content.innerHTML = String(definition.contentHtml || '');
      const buttons = [];
      for (const action of definition.actions || []) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = String(action.label || 'Action');
        if (action.href) button.addEventListener('click', () => global.open(String(action.href), '_blank', 'noopener'));
        else if (typeof action.onClick === 'function') button.addEventListener('click', event => void action.onClick(event));
        buttons.push(button);
      }
      alert.actions.replaceChildren(...buttons);
      refreshShell();
      return Object.freeze({ dismiss:() => dismissAlert(id), element:alert.element });
    }

    async function createModuleView(module) {
      await navigationPreferencesReady;
      if (views.has(module.id)) return views.get(module.id).api;
      const element = document.createElement('section');
      element.className = 'module-view';
      element.dataset.slinkModuleId = module.id;
      element.innerHTML = `<div class="module-head"><strong></strong></div><div class="status" role="status"></div><div class="content"></div><div class="actions"></div>`;
      element.querySelector('strong').textContent = module.title;
      const tab = document.createElement('button');
      tab.className = 'tab'; tab.type = 'button'; tab.setAttribute('role', 'tab');
      tab.dataset.slinkModule = module.id;
      const tabLabel = document.createElement('span'); tabLabel.textContent = module.shortTitle || module.title;
      const tabAlertBadge = document.createElement('span'); tabAlertBadge.className = 'nav-alert-count'; tabAlertBadge.hidden = true; tabAlertBadge.setAttribute('aria-hidden', 'true');
      tab.append(tabLabel, tabAlertBadge);
      tabs.append(tab); main.element.append(element);
      const group = String(module.group || 'other');
      if (!groupButtons.has(group)) {
        const groupButton = document.createElement('button');
        groupButton.className = 'group-tab';
        groupButton.type = 'button';
        groupButton.dataset.slinkGroup = group;
        const groupLabel = String(module.groupTitle || group);
        groupButton.dataset.label = groupLabel;
        const label = document.createElement('span'); label.textContent = groupLabel;
        const alertBadge = document.createElement('span'); alertBadge.className = 'nav-alert-count'; alertBadge.hidden = true; alertBadge.setAttribute('aria-hidden', 'true');
        groupButton.append(label, alertBadge);
        groupButton.setAttribute('role', 'tab');
        groupButton.addEventListener('click', () => setActiveGroup(group, true));
        groupButtons.set(group, groupButton);
        groups.append(groupButton);
      }
      const view = { id:module.id, title:module.title, group, element, tab, alertBadge:tabAlertBadge };
      views.set(module.id, view);
      tab.addEventListener('click', () => setActive(module.id, true));
      const moduleStyle = document.createElement('style'); shadow.append(moduleStyle);
      const content = element.querySelector('.content'); const status = element.querySelector('.status'); const actions = element.querySelector('.actions');
      const api = {
        host,
        setHidden(value) { hidden = Boolean(value); refreshShell(); },
        setTitle(value) { element.querySelector('strong').textContent = String(value || module.title); },
        setSubtitle(value) { status.title = String(value || ''); },
        setModuleStyles(value) { moduleStyle.textContent = String(value || ''); },
        setContentHtml(value) { content.innerHTML = String(value || ''); },
        getContentElement() { return content; },
        setStatus(message, tone = 'normal') { status.textContent = String(message || ''); status.dataset.tone = String(tone || 'normal'); },
        setRows(rows) {
          content.replaceChildren();
          for (const row of rows || []) {
            const item = document.createElement('div'); item.className = 'row';
            const label = document.createElement('span'); label.className = 'label'; label.textContent = String(row.label || '');
            const value = document.createElement('span'); value.className = 'value'; value.textContent = String(row.value ?? '');
            item.append(label, value); content.append(item);
          }
        },
        setActions(definitions) {
          actions.replaceChildren();
          for (const definition of definitions || []) {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = String(definition.label || 'Action'); button.disabled = Boolean(definition.disabled);
            if (definition.id) button.dataset.action = String(definition.id);
            if (typeof definition.onClick === 'function') button.addEventListener('click', event => void definition.onClick(event));
            actions.append(button);
          }
        },
        navigateTo(moduleId) { if (views.has(String(moduleId || ''))) setActive(String(moduleId), true); },
        showAlert,
        dismissAlert,
        setBubbleAlert,
        setAlertCount,
        remove() {
          view.tab.remove(); element.remove(); moduleStyle.remove(); views.delete(module.id); navigationAlerts.delete(module.id);
          if (![...views.values()].some(candidate => candidate.group === view.group)) {
            groupButtons.get(view.group)?.remove();
            groupButtons.delete(view.group);
          }
          updateNavigationAlerts();
          refreshShell();
        },
        ui: null
      };
      api.ui = api;
      view.api = Object.freeze(api);
      if (!activeId && !preferredActiveId && preferredActiveIdsByGroup.size === 0) {
        const existingFallback = NAVIGATION_FALLBACK_ORDER.map(id => views.get(id)).find(Boolean);
        activeId = existingFallback?.id || module.id;
      }
      if (!preferredActiveIdsByGroup.has(group) && preferredActiveId === module.id) preferredActiveIdsByGroup.set(group, module.id);
      const groupPreference = preferredActiveIdsByGroup.get(group);
      if (groupPreference === module.id || (!groupPreference && preferredActiveId === module.id)) activeId = module.id;
      updateNavigationAlerts();
      refreshShell();
      return view.api;
    }

    const bubbleMover = makeBubbleMovable();
    main.element.querySelector('.hide').addEventListener('click', () => void setCollapsed(true));
    void navigationPreferencesReady.then(() => {
      if (navigationSelectionChanged) return;
      const preferredForSavedGroup = preferredActiveIdsByGroup.get(preferredActiveGroup);
      const selection = views.has(preferredActiveId) ? preferredActiveId : views.has(preferredForSavedGroup) ? preferredForSavedGroup : '';
      if (selection) setActive(selection, false);
    });
    void SLINK.core.storage.get('ui.main.collapsed', false).then(value => setCollapsed(Boolean(value), false));
    async function restore() {
      await Promise.all([
        SLINK.core.storage.remove('ui.main.position'),
        SLINK.core.storage.remove('ui.bubble.position'),
        SLINK.core.storage.remove('ui.main.collapsed'),
        SLINK.core.storage.remove(MAIN_SIZE_STORAGE_KEY),
        SLINK.core.storage.set('ui.pagePanelHidden', false)
      ]);
      hidden = false;
      collapsed = false;
      main.mover.reset();
      mainSizeMemory.reset();
      bubbleMover.reset();
      refreshShell();
      return { restored:true, modules:views.size };
    }
    return Object.freeze({
      host,
      createModuleView,
      dismissAlert,
      showAlert,
      setBubbleAlert,
      setAlertCount,
      setTheme,
      setThemePanelOpacity,
      setCollapsed,
      setHidden(value) { hidden = Boolean(value); refreshShell(); },
      resetPosition:restore,
      restore,
      setPosition() {},
      setRows() {},
      setStatus() {}
    });
  }

  SLINK.define('core', 'uiShell', Object.freeze({ createShell }));
})(globalThis);


