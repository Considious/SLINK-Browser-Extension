(async function startDashboard() {
  'use strict';

  const SLINK = globalThis.SLINK_EXTENSION;
  const byId = id => document.getElementById(id);
  let system = null;
  let leveling = null;
  let war = null;
  let contribution = null;
  let contributionTerms = null;
  let termsExpanded = false;
  let accessExpanded = null;
  let targetView = 'leveling';
  let adminUser = null;
  let activeTheme = SLINK.core.themes.get();

  function setBusy(button, busy) {
    if (button) button.disabled = Boolean(busy);
  }

  function errorText(error) {
    return SLINK.core.format.errorMessage(error);
  }

  function hasScope(scope) {
    return SLINK.core.permissions.hasScope(system?.permissions || {}, scope);
  }

  function showError(id, error) {
    const element = byId(id);
    if (!element) return;
    element.textContent = errorText(error);
    element.hidden = false;
  }

  function clearError(id) {
    const element = byId(id);
    if (!element) return;
    element.hidden = true;
    element.textContent = '';
  }

  function pill(text, className = '') {
    const span = document.createElement('span');
    span.className = `pill ${className}`.trim();
    span.textContent = text;
    return span;
  }

  async function copyText(value) {
    const text = String(value || '');
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const input = document.createElement('textarea');
    input.value = text; input.style.position = 'fixed'; input.style.opacity = '0';
    document.body.append(input); input.select(); document.execCommand('copy'); input.remove();
  }

  function targetCard(target) {
    const article = document.createElement('article');
    article.className = 'target';
    const profile = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(target.id)}`;
    const attack = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(target.id)}`;
    const ff = Number(target.fair_fight);
    article.innerHTML = '<div class="target-head"><a></a><span class="level"></span></div><div class="target-meta"></div><div class="target-meta secondary-meta"></div><div class="target-actions"><a class="button" target="_blank" rel="noopener noreferrer">Attack</a><a class="button secondary" target="_blank" rel="noopener noreferrer">Profile</a></div>';
    const links = article.querySelectorAll('a');
    links[0].href = profile; links[0].textContent = `${target.name || 'Unknown'} [${target.id}]`;
    links[1].href = attack; links[2].href = profile;
    article.querySelector('.level').textContent = `Lv ${target.level ?? '?'}`;
    for (const text of [target.status || 'Unknown', `FF ${Number.isFinite(ff) ? `${target.fair_fight_estimated ? '~' : ''}${ff.toFixed(2)}` : '?'}`, target.local_difficulty, `BS ${SLINK.core.format.shortNumber(target.bs_estimate ?? target.total_stats)}`].filter(Boolean)) article.querySelector('.target-meta').append(pill(text));
    article.querySelector('.secondary-meta').textContent = `${target.competition_tier || 'Prime'} ${Number(target.competition_score) || 0}`;
    return article;
  }

  function warTargetCard(member, outside = false) {
    const article = document.createElement('article');
    article.className = 'target';
    const profile = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(member.id)}`;
    const attack = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(member.id)}`;
    const remaining = SLINK.core.war.statusSeconds(member);
    article.innerHTML = '<div class="target-head"><a></a><span class="level"></span></div><div class="target-meta"></div><div class="target-meta secondary-meta"></div><div class="target-actions"><a class="button" target="_blank" rel="noopener noreferrer">Attack</a><a class="button secondary" target="_blank" rel="noopener noreferrer">Profile</a><button class="secondary copy-war-target" type="button">Copy for faction chat</button><button class="secondary claim-war-target" type="button">Claim med-out</button></div>';
    const links = article.querySelectorAll('a');
    links[0].href = profile; links[0].textContent = `${member.name || 'Unknown'} [${member.id}]`;
    links[1].href = attack; links[2].href = profile;
    article.querySelector('.level').textContent = `Lv ${member.level || '?'}`;
    const readyAt = SLINK.core.war.isHospitalized(member) ? SLINK.core.war.tctTime(member.statusUntil) : '';
    for (const text of [member.activity || 'Unknown', member.statusState || 'Okay', SLINK.core.war.isHospitalized(member) ? `Hospital ${SLINK.core.format.formatHumanDuration(remaining)}${readyAt ? ` / ${readyAt} TCT` : ''}` : '', Number.isFinite(member.battleStatsEstimate) ? `Estimated BS ${SLINK.core.format.shortNumber(member.battleStatsEstimate)}` : 'Estimated BS ?', Number.isFinite(member.fairFight) ? `FF ${member.fairFight.toFixed(2)}` : 'FF ?'].filter(Boolean)) article.querySelector('.target-meta').append(pill(text));
    article.querySelector('.secondary-meta').textContent = [member.statusDescription, member.lastActionRelative].filter(Boolean).join(' • ');
    const copyButton = article.querySelector('.copy-war-target');
    copyButton.addEventListener('click', async () => {
      await copyText(SLINK.core.war.factionCallout(member));
      copyButton.textContent = 'Copied';
      setTimeout(() => { if (copyButton.isConnected) copyButton.textContent = 'Copy for faction chat'; }, 1400);
    });
    const claim = (war?.runtime?.snapshot?.claims || []).find(row => Number(row.targetId) === Number(member.id));
    const claimButton = article.querySelector('.claim-war-target');
    if (outside) {
      claimButton.remove();
      return article;
    }
    const mine = Number(claim?.claimedById) === Number(war?.session?.userId);
    claimButton.textContent = claim ? (mine ? 'Release my claim' : `Claimed by ${claim.claimedByName || claim.claimedById}`) : 'Claim med-out';
    claimButton.disabled = Boolean(claim && !mine && !war?.session?.officer);
    claimButton.addEventListener('click', async () => {
      try {
        war = await SLINK.core.messaging.send('war.claims.update', { operation:claim ? 'release' : 'claim', targetId:member.id, targetName:member.name });
        byId('war-action-message').textContent = claim ? `Released ${member.name}.` : `Claimed ${member.name} as your med-out target.`;
        renderTargets(); renderWar();
      } catch (error) { byId('war-action-message').textContent = errorText(error); }
    });
    return article;
  }

  function claimCard(claim) {
    const article = document.createElement('article');
    article.className = 'target';
    const mine = Number(claim.claimedById) === Number(war?.session?.userId);
    article.innerHTML = '<div class="target-head"><a target="_blank" rel="noopener noreferrer"></a><span class="pill"></span></div><div class="target-meta"></div><div class="target-actions"><button class="secondary" type="button">Release claim</button></div>';
    article.querySelector('a').href = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(claim.targetId)}`;
    article.querySelector('a').textContent = `${claim.targetName || `Player ${claim.targetId}`} [${claim.targetId}]`;
    article.querySelector('.pill').textContent = `Claimed by ${claim.claimedByName || claim.claimedById}`;
    article.querySelector('.target-meta').textContent = `Expires ${new Date(Number(claim.expiresAt)).toLocaleTimeString()}`;
    const button = article.querySelector('button');
    button.hidden = !mine && !war?.session?.officer;
    button.addEventListener('click', async () => {
      try {
        war = await SLINK.core.messaging.send('war.claims.update', { operation:'release', targetId:claim.targetId });
        byId('war-action-message').textContent = `Released ${claim.targetName || claim.targetId}.`;
        renderTargets(); renderWar();
      } catch (error) { byId('war-action-message').textContent = errorText(error); }
    });
    return article;
  }

  function renderAccess() {
    const levelAccepted = leveling?.terms?.accepted === true;
    const warAccepted = war?.terms?.accepted === true;
    byId('use-leveling').checked = leveling?.settings?.hasTornKey === true;
    byId('use-war').checked = war?.settings?.hasTornKey === true;
    byId('shared-torn-key').placeholder = levelAccepted || warAccepted ? 'Saved locally — leave blank to keep' : 'Enter once for selected SLINK modules';
    byId('shared-ff-key').placeholder = leveling?.settings?.hasFfKey || war?.settings?.hasFfKey ? 'Saved locally — leave blank to keep' : 'Optional FFScouter key';
    const terms = leveling?.terms || war?.terms || {};
    byId('shared-terms-summary').textContent = terms.summary || war?.terms?.summary || 'Current SLINK terms are loading.';
    byId('shared-terms-link').href = terms.documentUrl || war?.terms?.documentUrl || '#';
    byId('shared-terms-state').textContent = `Leveling: ${levelAccepted ? 'accepted' : 'acceptance required'} / War: ${warAccepted ? 'accepted' : 'acceptance required'}`;
    byId('shared-terms-full').hidden = !termsExpanded && levelAccepted && warAccepted;
    byId('toggle-shared-terms').textContent = byId('shared-terms-full').hidden ? 'View terms' : 'Hide terms';
    const authenticated = [leveling?.session, war?.session].find(session => session?.authenticated);
    byId('identity-state').textContent = authenticated ? `Torn ID ${authenticated.userId}` : 'Enter a key to unlock access';
    if (accessExpanded === null) accessExpanded = !authenticated;
    const compact = Boolean(authenticated && !accessExpanded);
    byId('access-card').classList.toggle('expanded', !compact);
    byId('access-config').hidden = compact;
    byId('toggle-access').textContent = compact ? 'API & access settings' : authenticated ? 'Collapse' : 'Setup required';
    byId('toggle-access').disabled = !authenticated && accessExpanded;
    byId('access-summary').textContent = compact
      ? `${leveling?.settings?.hasTornKey ? 'Leveling' : ''}${leveling?.settings?.hasTornKey && war?.settings?.hasTornKey ? ' + ' : ''}${war?.settings?.hasTornKey ? 'War' : ''} enabled with locally saved credentials.`
      : 'Enter each local credential once, then choose which SLINK modules may use it.';
  }

  function renderLeveling() {
    const runtime = leveling?.runtime || { targets:[] };
    byId('target-count').textContent = runtime.targets?.length || 0;
    byId('assigned-count').textContent = runtime.lastCycleChecked || 0;
    byId('reported-count').textContent = runtime.lastCycleReported || 0;
    byId('api-usage').textContent = `${leveling?.tornApiUsage?.count || 0}/${leveling?.tornApiUsage?.limit || 60}`;
    byId('leveling-role').textContent = runtime.contributorOnly || runtime.idle ? 'API contributor' : runtime.collector ? 'API collector' : leveling?.configured ? 'Standby device' : 'Setup required';
    byId('leveling-status').textContent = runtime.cycleStatus || 'Ready';
    const settings = leveling?.settings || {};
    byId('poll-seconds').value = settings.pollSeconds || 300;
    byId('min-ff').value = settings.minFF || 1;
    byId('max-ff').value = settings.maxFF || 3;
    byId('contributor-only').checked = settings.contributorOnly === true;
    byId('zero-contribution-row').hidden = !hasScope('admin.*');
    byId('zero-contribution').checked = hasScope('admin.*') && Number(settings.apiContributionLimit) === 0;
    byId('page-panel').checked = Boolean(system?.levelingInTorn);
    if (runtime.lastError) showError('leveling-error', runtime.lastError); else clearError('leveling-error');
  }

  function renderRetals() {
    const root = byId('war-retals');
    const retals = war?.runtime?.snapshot?.retals || [];
    byId('retal-summary').textContent = retals.length ? `${retals.length} active retaliation opportunit${retals.length === 1 ? 'y' : 'ies'}` : 'No active retaliation opportunities';
    if (!retals.length) {
      const empty = document.createElement('p');
      empty.className = 'muted retal-empty';
      empty.textContent = war?.configured ? 'SLINK War is watching for retals.' : 'Enable SLINK War in API & access settings to watch for retals.';
      root.replaceChildren(empty);
      return;
    }
    root.replaceChildren(...retals.slice(0, 6).map(retal => {
      const div = document.createElement('div');
      div.className = 'retal-item';
      const remaining = SLINK.core.format.formatHumanDuration(Number(retal.expiresAt) - Math.floor(Date.now() / 1000));
      div.innerHTML = `<a target="_blank" rel="noopener noreferrer"></a><div class="muted"></div>`;
      div.querySelector('a').href = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(retal.attackerId)}`;
      div.querySelector('a').textContent = `Retal: ${retal.attackerName || `Player ${retal.attackerId}`}`;
      div.querySelector('.muted').textContent = `${remaining} remaining`;
      return div;
    }));
  }

  function renderLogs() {
    const permitted = war?.session?.canViewLogs === true || hasScope('admin.*') || hasScope('slink.war.officer');
    byId('war-logs-panel').hidden = !permitted;
    if (!permitted) return;
    const warning = war?.runtime?.logsWarning || '';
    byId('war-logs-warning').textContent = warning;
    byId('war-logs-warning').hidden = !warning;
    const rows = war?.runtime?.logs || [];
    byId('war-logs').replaceChildren(...rows.slice(0, 20).map(row => {
      const div = document.createElement('div');
      div.className = 'mini-item';
      div.textContent = `${row.attacker_name || row.attacker_id} → ${row.defender_name || row.defender_id}: ${String(row.outcome || '').replace('_', ' ')} × ${Number(row.event_count) || 0}`;
      return div;
    }));
  }

  function renderWar() {
    const settings = war?.settings || {};
    const sharedConfig = war?.sharedConfig || {};
    const snapshot = war?.runtime?.snapshot || {};
    const stats = war?.runtime?.panelStats || {};
    byId('war-role').textContent = war?.session?.authenticated ? (war.session.officer ? 'War officer' : war.session.factionCapable ? 'Faction API' : 'Public API') : 'Setup required';
    byId('war-opponent').textContent = war?.activeWar ? `${war.activeWar.opponentName} [${war.activeWar.opponentFactionId}]` : 'No active ranked war detected by API';
    byId('war-attack-count').textContent = stats.attacks || 0;
    byId('war-ranked-count').textContent = stats.warAttacks || 0;
    byId('war-mug-count').textContent = stats.mugs || 0;
    byId('war-retal-count').textContent = snapshot.retals?.length || 0;
    const chain = stats.chain;
    byId('war-chain').textContent = chain?.current ? `${chain.current}${chain.target ? `/${chain.target}` : ''}${chain.secondsLeft ? ` • ${SLINK.core.format.formatHumanDuration(chain.secondsLeft)}` : ''}` : 'No active chain';
    const turtle = stats.turtle;
    const turtleSeconds = Math.max(0, Number(turtle?.until) - Math.floor(Date.now() / 1000));
    byId('war-turtle').textContent = turtle?.hospitalized ? `${SLINK.core.format.formatHumanDuration(turtleSeconds)} remaining` : 'Not hospitalized';
    byId('war-turtle-row').classList.toggle('slink-alerting', Boolean(turtle?.hospitalized && turtleSeconds <= (Number(settings.turtleMinutes) || 5) * 60));
    byId('war-status').textContent = war?.runtime?.status || 'Ready';
    byId('war-display-mode').value = settings.displayMode || 'hybrid';
    byId('war-mode').value = sharedConfig.mode || settings.warMode || 'war';
    byId('war-idle-minutes').value = sharedConfig.idleMinutes ?? settings.idleMinutes ?? 5;
    byId('war-mode').disabled = !war?.session?.officer;
    byId('war-idle-minutes').disabled = !war?.session?.officer;
    byId('war-config-note').textContent = war?.session?.officer
      ? 'War mode and idle filtering are shared faction-wide. Your other alert and display settings remain local.'
      : `Faction-wide mode: ${sharedConfig.mode === 'termed' ? 'Termed war' : 'Real war'}. A slink.war.officer may change it.`;
    byId('war-turtle-minutes').value = settings.turtleMinutes || 5;
    byId('war-alert-sound').checked = settings.alertSound !== false;
    byId('war-alert-panel').checked = settings.alertPanelFlash !== false;
    byId('war-alert-page').checked = settings.alertPageFlash === true;
    byId('war-chain-alert').checked = settings.chainAlert !== false;
    byId('war-turtle-alert').checked = settings.turtleAlert !== false;
    byId('outside-min-ff').value = settings.outsideMinFF || 1;
    byId('outside-max-ff').value = settings.outsideMaxFF || 3;
    renderRetals(); renderLogs();
    if (war?.runtime?.lastError) showError('war-error', war.runtime.lastError); else clearError('war-error');
  }

  function renderTargets() {
    const root = byId('targets');
    const levelingTab = document.querySelector('[data-target-view="leveling"]');
    const warTab = document.querySelector('[data-target-view="war"]');
    const claimsTab = document.querySelector('[data-target-view="claims"]');
    const outsideTab = document.querySelector('[data-target-view="outside"]');
    levelingTab.hidden = Boolean(system?.permissions?.userId) && !hasScope('slink.level');
    warTab.hidden = Boolean(system?.permissions?.userId) && !hasScope('slink.war');
    claimsTab.hidden = warTab.hidden;
    outsideTab.hidden = warTab.hidden;
    if ((targetView === 'leveling' && levelingTab.hidden) || ((targetView === 'war' || targetView === 'outside' || targetView === 'claims') && warTab.hidden)) targetView = levelingTab.hidden ? 'war' : 'leveling';
    for (const button of document.querySelectorAll('.target-tab')) button.classList.toggle('active', button.dataset.targetView === targetView);
    byId('war-sort-row').hidden = targetView !== 'war';
    byId('outside-filter-row').hidden = targetView !== 'outside';
    if (targetView === 'claims') {
      const claims = war?.runtime?.snapshot?.claims || [];
      root.replaceChildren(...claims.map(claimCard));
      byId('target-deck-title').textContent = 'Med-out claims';
      byId('target-summary').textContent = claims.length ? `${claims.length} claimed targets` : 'No med-out targets claimed';
    } else if (targetView === 'outside') {
      const members = SLINK.core.war.sortMembers(war?.runtime?.outsideTargets || [], Date.now(), 'fairFightAsc');
      root.replaceChildren(...members.map(member => warTargetCard(member, true)));
      byId('target-deck-title').textContent = 'Outside targets';
      byId('target-summary').textContent = members.length ? `${members.length} FFScouter targets` : (war?.runtime?.outsideError || 'Choose a Fair Fight range and poll FFScouter');
    } else if (targetView === 'war') {
      const members = SLINK.core.war.sortMembers(war?.runtime?.snapshot?.members || [], Date.now(), byId('war-target-sort').value);
      root.replaceChildren(...members.map(warTargetCard));
      byId('target-deck-title').textContent = 'War targets';
      byId('target-summary').textContent = members.length ? `${members.length} eligible opponents` : 'No War targets loaded';
    } else {
      const targets = leveling?.runtime?.targets || [];
      root.replaceChildren(...targets.map(targetCard));
      byId('target-deck-title').textContent = 'Leveling targets';
      byId('target-summary').textContent = targets.length ? `${targets.length} recommendations` : 'No Leveling targets loaded';
    }
  }

  function renderContribution() {
    const donation = contribution?.donation;
    byId('donation-state').textContent = donation?.active ? `Active for Torn ID ${donation.user_id}` : 'No saved donation';
    byId('donation-summary').textContent = contributionTerms?.summary || 'Current donation terms are unavailable.';
    byId('donation-terms-link').href = contributionTerms?.document_url || '#';
    byId('donation-agreement').textContent = `I agree to donation terms ${contributionTerms?.version || ''} and understand this Public Only key is saved on SLINK servers.`;
    byId('donation-submit').textContent = donation?.active ? 'Validate and replace saved key' : 'Validate, encrypt, and donate';
    byId('donation-revoke').hidden = !donation?.active;
  }

  function renderThemes() {
    const root = byId('theme-options');
    const themes = SLINK.core.themes.list(system?.permissions || {});
    root.replaceChildren(...themes.map(theme => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'theme-option';
      button.dataset.themeId = theme.id;
      button.disabled = !theme.unlocked;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(activeTheme.id === theme.id));
      const swatch = document.createElement('span');
      swatch.className = 'theme-swatch';
      for (const color of theme.swatch) {
        const colorBand = document.createElement('span');
        colorBand.style.background = color;
        swatch.append(colorBand);
      }
      const copy = document.createElement('span');
      const title = document.createElement('strong');
      const description = document.createElement('small');
      title.textContent = theme.label;
      description.textContent = theme.description;
      copy.append(title, description);
      const access = document.createElement('span');
      access.className = 'muted';
      access.textContent = theme.unlocked ? (activeTheme.id === theme.id ? 'Active' : 'Use') : 'Locked';
      button.append(swatch, copy, access);
      return button;
    }));
    byId('theme-summary').textContent = `${activeTheme.label} is active. Theme changes apply to the dashboard, popup, and Torn panels.`;
  }

  async function applySavedTheme() {
    const preferred = await SLINK.core.storage.get(
      SLINK.core.themes.STORAGE_KEY,
      SLINK.core.themes.DEFAULT_THEME_ID
    );
    activeTheme = SLINK.core.themes.applyToElement(
      document.documentElement,
      preferred,
      system?.permissions || {}
    );
    renderThemes();
  }

  function renderAdminScopes(scopes) {
    const root = byId('admin-scope-list');
    const categories = new Map();
    for (const scope of scopes || []) {
      const category = String(scope.category || 'Products');
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category).push(scope);
    }
    root.replaceChildren(...[...categories].map(([category, entries]) => {
      const section = document.createElement('section');
      section.className = 'scope-category';
      const heading = document.createElement('h3');
      heading.textContent = category;
      section.append(heading);
      for (const scope of entries) {
        const label = document.createElement('label');
        label.className = 'scope-row';
        label.innerHTML = '<input type="checkbox"><span><strong></strong><small></small></span><span class="muted"></span>';
        label.querySelector('input').dataset.scope = scope.scope;
        label.querySelector('input').checked = scope.active;
        label.querySelector('strong').textContent = `${scope.title} (${scope.scope})`;
        label.querySelector('small').textContent = scope.description;
        label.lastElementChild.textContent = scope.active
          ? (scope.expires_at ? `Expires ${new Date(scope.expires_at).toLocaleString()}` : 'No expiration')
          : scope.status.replace('_', ' ');
        section.append(label);
      }
      return section;
    }));
  }

  function renderAccessTabs() {
    const admin = hasScope('admin.*');
    byId('admin-tab').hidden = !admin;
    byId('diagnostics-tab').hidden = !admin;
    if (!admin && [...document.querySelectorAll('[data-dashboard-page]')].some(page => !page.hidden && page.dataset.dashboardPage !== 'workspace')) switchPage('workspace');
  }

  function switchPage(name) {
    if ((name === 'admin' || name === 'diagnostics') && !hasScope('admin.*')) name = 'workspace';
    for (const page of document.querySelectorAll('[data-dashboard-page]')) page.hidden = page.dataset.dashboardPage !== name;
    for (const button of document.querySelectorAll('[data-page-tab]')) button.classList.toggle('active', button.dataset.pageTab === name);
  }

  function formatDiagnostic(report) {
    if (!report) return 'Run a diagnostic to inspect the extension and Workers.';
    return [
      `Overall: ${String(report.overall || 'unknown').toUpperCase()}`,
      `Run: ${new Date(report.at).toLocaleString()}`,
      `Extension: v${report.extensionVersion}`,
      `Core: v${report.coreVersion}`,
      '',
      `Background: ${report.background?.ok ? 'OK' : 'FAILED'}`,
      `Storage: ${report.storage?.ok ? 'OK' : 'FAILED'}`,
      `Torn injection: ${report.pageInjection ? `OK (${new Date(report.pageInjection.at).toLocaleString()})` : 'NOT DETECTED'}`,
      '',
      `Leveling Worker: ${report.worker?.connected ? 'CONNECTED' : 'OFFLINE'}`,
      `Permissions database: ${report.worker?.permissionsDatabase || 'not checked'}`,
      `War Worker: ${report.war?.worker?.connected ? 'CONNECTED' : 'OFFLINE'}`,
      `War database: ${report.war?.worker?.database || 'not checked'}`,
      `War coordinator: ${report.war?.worker?.coordinator || 'not checked'}`
    ].join('\n');
  }

  async function refresh() {
    const [status, terms] = await Promise.all([
      SLINK.core.messaging.send('system.status'),
      SLINK.core.messaging.send('contribution.terms').catch(() => null)
    ]);
    system = status; leveling = status.leveling; war = status.war; contribution = status.contribution; contributionTerms = terms;
    system.levelingInTorn = await SLINK.core.storage.get('ui.modules.leveling.showInTorn', true);
    await SLINK.core.storage.set('ui.modules.contribution.showInTorn', false);
    byId('connection').textContent = status.worker.connected ? 'Worker connected' : 'Worker offline';
    byId('connection').className = status.worker.connected ? 'badge ready' : 'badge error';
    await applySavedTheme();
    renderAccess(); renderLeveling(); renderWar(); renderTargets(); renderContribution(); renderAccessTabs();
    if (hasScope('admin.*')) byId('diagnostic').textContent = formatDiagnostic(status.lastDiagnostic);
  }

  async function saveModuleSettings(tornKey, ffKey, acceptTerms) {
    const tasks = [];
    if (byId('use-leveling').checked) tasks.push(SLINK.core.messaging.send('leveling.settings.save', {
      tornKey, ffKey, pollSeconds:byId('poll-seconds').value, contributorOnly:byId('contributor-only').checked,
      apiContributionLimit:byId('zero-contribution').checked ? 0 : 60, minFF:byId('min-ff').value, maxFF:byId('max-ff').value,
      acceptTerms:acceptTerms && !leveling?.terms?.accepted
    })); else if (leveling?.settings?.hasTornKey) tasks.push(SLINK.core.messaging.send('leveling.settings.save', { clearTornKey:true, clearFfKey:true }).then(() => SLINK.core.messaging.send('leveling.session.clear')));
    if (byId('use-war').checked) tasks.push(SLINK.core.messaging.send('war.settings.save', {
      tornKey, ffKey, displayMode:byId('war-display-mode').value, warMode:byId('war-mode').value, idleMinutes:byId('war-idle-minutes').value,
      minFF:byId('min-ff').value, maxFF:byId('max-ff').value, alertSound:byId('war-alert-sound').checked,
      alertPanelFlash:byId('war-alert-panel').checked, alertPageFlash:byId('war-alert-page').checked, chainAlert:byId('war-chain-alert').checked,
      turtleAlert:byId('war-turtle-alert').checked, turtleMinutes:byId('war-turtle-minutes').value, acceptTerms:acceptTerms && !war?.terms?.accepted
    })); else if (war?.settings?.hasTornKey) tasks.push(SLINK.core.messaging.send('war.settings.save', { clearTornKey:true, clearFfKey:true }).then(() => SLINK.core.messaging.send('war.session.clear')));
    const results = await Promise.allSettled(tasks);
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) throw new Error(failures.map(result => errorText(result.reason)).join(' / '));
  }

  byId('refresh-all').addEventListener('click', async event => { const button = event.currentTarget; setBusy(button, true); try { await refresh(); } finally { setBusy(button, false); } });
  byId('toggle-access').addEventListener('click', () => { accessExpanded = !accessExpanded; renderAccess(); });
  byId('toggle-shared-terms').addEventListener('click', () => { termsExpanded = !termsExpanded; renderAccess(); });
  byId('theme-options').addEventListener('click', async event => {
    const button = event.target.closest('[data-theme-id]');
    if (!button || button.disabled) return;
    const theme = SLINK.core.themes.get(button.dataset.themeId);
    if (!SLINK.core.themes.isUnlocked(theme, system?.permissions || {})) return;
    await SLINK.core.storage.set(SLINK.core.themes.STORAGE_KEY, theme.id);
    activeTheme = SLINK.core.themes.applyToElement(document.documentElement, theme.id, system.permissions);
    renderThemes();
  });
  byId('access-form').addEventListener('submit', async event => {
    event.preventDefault(); const submit = byId('save-access'); setBusy(submit, true); byId('access-message').textContent = '';
    try {
      if (!byId('use-leveling').checked && !byId('use-war').checked) throw new Error('Choose at least one SLINK module for this key.');
      const needsTerms = (byId('use-leveling').checked && !leveling?.terms?.accepted) || (byId('use-war').checked && !war?.terms?.accepted);
      if (needsTerms && !byId('accept-shared-terms').checked) throw new Error('Accept the current SLINK terms before verification.');
      await saveModuleSettings(byId('shared-torn-key').value.trim(), byId('shared-ff-key').value.trim(), byId('accept-shared-terms').checked);
      if ((byId('use-leveling').checked && byId('page-panel').checked) || (byId('use-war').checked && byId('war-display-mode').value !== 'extension')) await SLINK.core.storage.set('ui.pagePanelHidden', false);
      byId('shared-torn-key').value = ''; byId('shared-ff-key').value = ''; byId('accept-shared-terms').checked = false;
      byId('access-message').textContent = 'Saved locally and verified. Available features are now unlocked by signed SLINK permissions.';
      accessExpanded = false;
      await refresh();
    } catch (error) { byId('access-message').textContent = errorText(error); } finally { setBusy(submit, false); }
  });
  byId('remove-local-keys').addEventListener('click', async () => { if (!confirm('Remove locally saved Torn and FFScouter keys from all SLINK modules? Remote Public Only donations are not affected.')) return; await Promise.all([SLINK.core.messaging.send('leveling.settings.save',{clearTornKey:true,clearFfKey:true}),SLINK.core.messaging.send('war.settings.save',{clearTornKey:true,clearFfKey:true})]); await SLINK.core.messaging.send('leveling.session.clear'); await SLINK.core.messaging.send('war.session.clear'); accessExpanded = true; await refresh(); });
  byId('page-panel').addEventListener('change', async event => { await SLINK.core.storage.set('ui.modules.leveling.showInTorn', event.currentTarget.checked); if (event.currentTarget.checked) await SLINK.core.storage.set('ui.pagePanelHidden', false); system.levelingInTorn = event.currentTarget.checked; });
  byId('reset-position').addEventListener('click', () => SLINK.core.storage.remove('ui.main.position'));
  byId('war-reset-position').addEventListener('click', () => SLINK.core.storage.remove('ui.main.position'));
  byId('refresh-targets').addEventListener('click', async event => { const button = event.currentTarget; setBusy(button, true); try { leveling = await SLINK.core.messaging.send('leveling.activity.touch'); const result = await SLINK.core.messaging.send('leveling.cycle.prepare',{contribute:false}); leveling = result.status; renderLeveling(); renderTargets(); } catch (error) { showError('leveling-error', error); } finally { setBusy(button, false); } });
  byId('war-refresh').addEventListener('click', async event => { const button = event.currentTarget; setBusy(button, true); try { war = await SLINK.core.messaging.send('war.cycle.prepare',{forceOpponentRefresh:true}); renderWar(); renderTargets(); } catch (error) { showError('war-error', error); } finally { setBusy(button, false); } });
  byId('outside-refresh').addEventListener('click', async event => { const button=event.currentTarget; setBusy(button,true); byId('war-action-message').textContent=''; try { war=await SLINK.core.messaging.send('war.outside.refresh',{minFF:byId('outside-min-ff').value,maxFF:byId('outside-max-ff').value}); byId('war-action-message').textContent=`Loaded ${war?.runtime?.outsideTargets?.length || 0} outside targets from FFScouter.`; renderWar(); renderTargets(); } catch(error){ byId('war-action-message').textContent=errorText(error); } finally{setBusy(button,false);} });
  byId('war-save-settings').addEventListener('click', async event => {
    const button = event.currentTarget; setBusy(button, true); clearError('war-error');
    try {
      war = await SLINK.core.messaging.send('war.settings.save', {
        displayMode:byId('war-display-mode').value,
        alertSound:byId('war-alert-sound').checked,
        alertPanelFlash:byId('war-alert-panel').checked,
        alertPageFlash:byId('war-alert-page').checked,
        chainAlert:byId('war-chain-alert').checked,
        turtleAlert:byId('war-turtle-alert').checked,
        turtleMinutes:byId('war-turtle-minutes').value
      });
      if (war?.session?.officer) war = await SLINK.core.messaging.send('war.config.save', { mode:byId('war-mode').value, idleMinutes:byId('war-idle-minutes').value });
      war = await SLINK.core.messaging.send('war.cycle.prepare');
      byId('war-action-message').textContent = war?.session?.officer ? 'Local alerts and faction-wide War settings saved.' : 'Local War display and alert settings saved.';
      renderWar(); renderTargets();
    } catch (error) { showError('war-error', error); } finally { setBusy(button, false); }
  });
  for (const button of document.querySelectorAll('[data-target-view]')) button.addEventListener('click', () => { targetView = button.dataset.targetView; renderTargets(); });
  byId('war-target-sort').addEventListener('change', renderTargets);
  for (const button of document.querySelectorAll('[data-page-tab]')) button.addEventListener('click', () => switchPage(button.dataset.pageTab));
  byId('donation-form').addEventListener('submit', async event => { event.preventDefault(); const submit = byId('donation-submit'); setBusy(submit,true); byId('donation-message').textContent=''; try { contribution=await SLINK.core.messaging.send('contribution.donate',{apiKey:byId('donation-key').value,acceptTerms:byId('donation-accept').checked}); byId('donation-key').value=''; byId('donation-accept').checked=false; byId('donation-message').textContent='Public Only key validated and saved on SLINK servers in encrypted form.'; renderContribution(); } catch(error){ byId('donation-message').textContent=errorText(error); } finally{ setBusy(submit,false); } });
  byId('donation-revoke').addEventListener('click', async () => { if (!confirm('Revoke this saved donation and erase its encrypted key material?')) return; contribution=await SLINK.core.messaging.send('contribution.revoke'); byId('donation-message').textContent='Donation revoked and encrypted key material erased.'; renderContribution(); });
  byId('run-diagnostic').addEventListener('click', async event => { const button=event.currentTarget; setBusy(button,true); try { byId('diagnostic').textContent=formatDiagnostic(await SLINK.core.messaging.send('diagnostics.run')); } catch(error){ byId('diagnostic').textContent=errorText(error); } finally{ setBusy(button,false); } });
  byId('admin-lookup-form').addEventListener('submit', async event => { event.preventDefault(); const button=byId('admin-lookup'); setBusy(button,true); byId('admin-message').textContent=''; try { adminUser=await SLINK.core.messaging.send('war.admin.permissions.get',{userId:byId('admin-user-id').value}); renderAdminScopes(adminUser.scopes); byId('admin-permissions-form').hidden=false; byId('admin-message').textContent=`Loaded direct grants for Torn ID ${adminUser.user_id}.`; } catch(error){ byId('admin-message').textContent=errorText(error); } finally{ setBusy(button,false); } });
  byId('admin-permissions-form').addEventListener('submit', async event => { event.preventDefault(); const button=byId('admin-save'); setBusy(button,true); try { const scopes=[...byId('admin-scope-list').querySelectorAll('input[data-scope]:checked')].map(input=>input.dataset.scope); adminUser=await SLINK.core.messaging.send('war.admin.permissions.save',{userId:adminUser.user_id,scopes,hours:byId('admin-hours').value,note:byId('admin-note').value}); byId('admin-message').textContent=`Permissions saved for Torn ID ${adminUser.user_id}. They take effect on the user's next authentication.`; byId('admin-lookup-form').requestSubmit(); } catch(error){ byId('admin-message').textContent=errorText(error); } finally{ setBusy(button,false); } });

  await refresh();
  setInterval(async () => { if (!war?.configured) return; try { war=await SLINK.core.messaging.send('war.cycle.prepare'); renderWar(); if(targetView==='war'||targetView==='claims')renderTargets(); } catch(error){ showError('war-error',error); } },10_000);
})();
