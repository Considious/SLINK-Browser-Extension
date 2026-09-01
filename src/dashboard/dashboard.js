(async function startDashboard() {
  'use strict';

  const SLINK = globalThis.SLINK_EXTENSION;
  const byId = id => document.getElementById(id);
  let system = null;
  let leveling = null;
  let war = null;
  let contribution = null;
  let contributionTerms = null;
  let playerStats = null;
  let termsExpanded = false;
  let accessExpanded = null;
  let targetView = 'leveling';
  let adminUser = null;
  let activeTheme = SLINK.core.themes.get();
  let warLeader = false;
  let dismissedRetals = {};
  let warTargetFilters = { minFF:1, maxFF:3, status:'all', sort:'availability' };
  const warLeaderClientId = `war-dashboard:${globalThis.crypto?.randomUUID?.() || `${Date.now()}:${Math.random()}`}`;
  const INSIDE_WINDOWS = Object.freeze([[0, 100], [200, 250], [450, 500], [950, 1000], [2350, 2500], [4850, 5000], [9900, 10000]]);

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

  function money(value) {
    return `$${Math.max(0, Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits:0 })}`;
  }

  function setPeriodValue(id, value, days, { decimals = 0 } = {}) {
    const element = byId(id);
    element.replaceChildren();
    if (value === null || value === undefined || value === '') {
      element.textContent = '—';
      return;
    }
    const number = Number(value);
    if (!Number.isFinite(number)) {
      element.textContent = '—';
      return;
    }
    const total = document.createElement('span');
    total.textContent = number.toLocaleString('en-US', { minimumFractionDigits:0, maximumFractionDigits:decimals });
    const average = document.createElement('small');
    average.textContent = `${(number / days).toFixed(2)}/d`;
    element.append(total, average);
  }

  function activityAverage(seconds, days) {
    if (seconds === null || seconds === undefined || seconds === '') return '—';
    const value = Number(seconds);
    if (!Number.isFinite(value)) return '—';
    return `${(value / 3600 / days).toFixed(2)}h/d`;
  }

  function signedMoney(value) {
    if (value === null || value === undefined || value === '') return '—';
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    const prefix = number > 0 ? '+' : number < 0 ? '−' : '';
    const absolute = `$${Math.abs(number).toLocaleString('en-US', { maximumFractionDigits:0 })}`;
    return `${prefix}${absolute}`;
  }

  function setTrend(id, value, days = 0) {
    const element = byId(id);
    element.replaceChildren();
    const total = document.createElement('span');
    total.textContent = signedMoney(value);
    element.append(total);
    if (days > 1 && value !== null && value !== undefined && Number.isFinite(Number(value))) {
      const average = document.createElement('small');
      average.textContent = `${signedMoney(Number(value) / days)}/d`;
      element.append(average);
    }
    element.classList.toggle('positive', Number(value) > 0);
    element.classList.toggle('negative', Number(value) < 0);
  }

  function renderPlayerStats() {
    const snapshot = playerStats?.data;
    const seven = snapshot?.periods?.[7] || {};
    const thirty = snapshot?.periods?.[30] || {};
    const pairs = [
      ['ps-xanax', 'xanax', 0],
      ['ps-cans', 'energyDrinks', 0],
      ['ps-refills', 'refills', 0],
      ['ps-attacks', 'attacks', 0],
      ['ps-respect', 'respect', 2],
      ['ps-retals', 'retals', 0]
    ];
    for (const [id, property, decimals] of pairs) {
      setPeriodValue(`${id}-7`, seven[property], 7, { decimals });
      setPeriodValue(`${id}-30`, thirty[property], 30, { decimals });
    }
    byId('ps-activity-7').textContent = activityAverage(seven.activitySeconds, 7);
    byId('ps-activity-30').textContent = activityAverage(thirty.activitySeconds, 30);
    byId('ps-networth').textContent = snapshot?.networth?.current !== null && snapshot?.networth?.current !== undefined && Number.isFinite(Number(snapshot.networth.current)) ? money(snapshot.networth.current) : '—';
    setTrend('ps-networth-yesterday', snapshot?.networth?.yesterday);
    setTrend('ps-networth-day-before', snapshot?.networth?.dayBeforeYesterday);
    setTrend('ps-networth-7', snapshot?.networth?.sevenDays, 7);
    setTrend('ps-networth-30', snapshot?.networth?.thirtyDays, 30);
    for (const [id, property] of [['ps-work-manual','manualLabor'],['ps-work-intelligence','intelligence'],['ps-work-endurance','endurance'],['ps-work-total','total']]) {
      const value = snapshot?.workstats?.[property];
      byId(id).textContent = value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : '—';
    }
    byId('ps-armory-balance').textContent = snapshot?.armoryBalance !== null && snapshot?.armoryBalance !== undefined && Number.isFinite(Number(snapshot.armoryBalance)) ? money(snapshot.armoryBalance) : '—';
    byId('player-stats-status').textContent = !playerStats?.configured
      ? 'Add a Limited Access Torn API key above to load your private stats.'
      : snapshot
        ? 'One combined current pull plus four historical Torn snapshots; stored only in this browser.'
        : 'No player snapshot has been collected yet.';
    byId('player-stats-updated').textContent = snapshot?.refreshedAt
      ? `Updated ${new Date(snapshot.refreshedAt).toLocaleString()} • daily after 00:00 TCT`
      : 'Updates daily after 00:00 TCT';
    const error = playerStats?.error || '';
    byId('player-stats-error').textContent = error;
    byId('player-stats-error').hidden = !error;
  }

  function insideGate(targetId) {
    const config = war?.sharedConfig || {};
    const chain = war?.runtime?.panelStats?.chain;
    const mode = ['off', 'warn', 'block'].includes(config.insideBlockMode) ? config.insideBlockMode : 'warn';
    if (war?.activeWar?.phase !== 'active' || config.mode !== 'termed' || !chain || mode === 'off') return null;
    const count = Math.max(0, Number(chain.current) || 0);
    const range = INSIDE_WINDOWS.find(([minimum, maximum]) => count >= minimum && count <= maximum);
    if (!range) return null;
    const ids = new Set([...(war?.runtime?.snapshot?.opponentMemberIds || []), ...(war?.runtime?.snapshot?.members || []).map(member => member.id)].map(Number));
    return ids.has(Number(targetId)) ? { mode, count, minimum:range[0], maximum:range[1] } : null;
  }

  function insideMessage(gate) {
    return `INSIDE HITS DISABLED — chain ${gate.count} is inside the ${gate.minimum}–${gate.maximum} major bonus window.`;
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
    const gate = insideGate(member.id);
    if (gate) {
      article.style.outline = '3px solid var(--slink-error)';
      article.style.boxShadow = '0 0 18px var(--slink-error)';
    }
    const profile = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(member.id)}`;
    const attack = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(member.id)}`;
    const remaining = SLINK.core.war.statusSeconds(member);
    article.innerHTML = '<div class="target-head"><a></a><span class="level"></span></div><div class="target-meta"></div><div class="target-meta secondary-meta"></div><div class="target-actions"><a class="button" target="_blank" rel="noopener noreferrer">Attack</a><a class="button secondary" target="_blank" rel="noopener noreferrer">Profile</a><button class="secondary copy-war-target" type="button">Copy for faction chat</button></div>';
    const links = article.querySelectorAll('a');
    links[0].href = profile; links[0].textContent = `${member.name || 'Unknown'} [${member.id}]`;
    links[1].href = attack; links[2].href = profile;
    if (gate) {
      links[1].textContent = gate.mode === 'block' ? 'INSIDES DISABLED' : 'Attack (warning)';
      const warning = document.createElement('div');
      warning.className = 'error';
      warning.textContent = insideMessage(gate);
      article.querySelector('.target-actions').before(warning);
      links[1].addEventListener('click', async event => {
        event.preventDefault();
        if (gate.mode === 'warn' && confirm(`${insideMessage(gate)}\n\nOpen this target anyway?`)) {
          await SLINK.core.storage.set('war.insideUnlock.v1', { targetId:Number(member.id), expiresAt:Date.now() + 2 * 60_000 });
          window.open(attack, '_blank', 'noopener');
        }
      });
    }
    article.querySelector('.level').textContent = `Lv ${member.level || '?'}`;
    const readyAt = SLINK.core.war.isHospitalized(member) ? SLINK.core.war.tctTime(member.statusUntil) : '';
    for (const text of [member.activity || 'Unknown', member.statusState || 'Okay', SLINK.core.war.isHospitalized(member) ? `Hospital ${SLINK.core.format.formatHumanDuration(remaining)}${readyAt ? ` / ${readyAt} TCT` : ''}` : '', Number.isFinite(member.battleStatsEstimate) ? `Estimated BS ${SLINK.core.format.shortNumber(member.battleStatsEstimate)}` : 'Estimated BS ?', Number.isFinite(member.fairFight) ? `FF ${member.fairFight.toFixed(2)}` : 'FF ?'].filter(Boolean)) article.querySelector('.target-meta').append(pill(text));
    const statusDescription = String(member.statusDescription || '').trim();
    const duplicateStatus = [member.statusState, member.activity].some(value => String(value || '').trim().toLowerCase() === statusDescription.toLowerCase());
    article.querySelector('.secondary-meta').textContent = [duplicateStatus ? '' : statusDescription, member.lastActionRelative].filter(Boolean).join(' • ');
    const copyButton = article.querySelector('.copy-war-target');
    copyButton.addEventListener('click', async () => {
      await copyText(SLINK.core.war.factionCallout(member));
      copyButton.textContent = 'Copied';
      setTimeout(() => { if (copyButton.isConnected) copyButton.textContent = 'Copy for faction chat'; }, 1400);
    });
    return article;
  }

  function filteredWarTargets(values) {
    const minimum = Math.min(Number(warTargetFilters.minFF) || 1, Number(warTargetFilters.maxFF) || 3);
    const maximum = Math.max(Number(warTargetFilters.minFF) || 1, Number(warTargetFilters.maxFF) || 3);
    return SLINK.core.war.sortMembers(values || [], Date.now(), warTargetFilters.sort || 'availability').filter(member => {
      const ff = Number(member.fairFight);
      if (!Number.isFinite(ff) || ff < minimum || ff > maximum) return false;
      const okay = /^okay$/i.test(String(member.statusState || '').trim());
      if (warTargetFilters.status === 'okay' && !okay) return false;
      if (warTargetFilters.status === 'notOkay' && okay) return false;
      return true;
    });
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
    const now = Math.floor(Date.now() / 1000);
    const retals = (war?.runtime?.snapshot?.retals || []).filter(retal => {
      const key = `user:${Number(retal.attackerId) || String(retal.attackId || '')}`;
      return Number(retal.expiresAt) > now && !dismissedRetals[key] && !dismissedRetals[String(retal.attackId)];
    });
    byId('retal-summary').textContent = retals.length ? `${retals.length} active retaliation opportunit${retals.length === 1 ? 'y' : 'ies'}` : 'No active retaliation opportunities';
    if (!retals.length) {
      const empty = document.createElement('p');
      empty.className = 'muted retal-empty';
      empty.textContent = war?.configured ? 'SLINK War is watching for retals.' : 'Enable SLINK War in API & access settings to watch for retals.';
      root.replaceChildren(empty);
      return;
    }
    root.replaceChildren(...retals.slice(0, 12).map(retal => {
      const div = document.createElement('article');
      div.className = 'retal-item retal-detail';
      const remaining = SLINK.core.format.formatHumanDuration(Number(retal.expiresAt) - Math.floor(Date.now() / 1000));
      div.innerHTML = '<button class="retal-dismiss" type="button" title="Dismiss alerts for this player" aria-label="Dismiss this player">×</button><div class="retal-head"><a target="_blank" rel="noopener noreferrer"></a><strong></strong></div><div class="retal-badges"></div><dl class="retal-report"></dl><div class="retal-actions"><button class="small secondary retal-copy" type="button">📋 Copy</button><a class="button small retal-attack" target="_blank" rel="noopener noreferrer">⚔ ATTACK</a><a class="button small secondary retal-profile" target="_blank" rel="noopener noreferrer">Profile</a></div>';
      const retalAttack = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(retal.attackerId)}`;
      const retalProfile = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(retal.attackerId)}`;
      const retalGate = insideGate(retal.attackerId);
      div.querySelector('.retal-head a').href = retalProfile;
      div.querySelector('.retal-head a').textContent = `${retal.attackerName || `Player ${retal.attackerId}`} [${retal.attackerId}]`;
      div.querySelector('.retal-profile').href = retalProfile;
      div.querySelector('.retal-attack').href = retalAttack;
      if (retalGate) div.querySelector('.retal-attack').addEventListener('click', async event => {
        event.preventDefault();
        if (retalGate.mode === 'warn' && confirm(`${insideMessage(retalGate)}\n\nOpen this target anyway?`)) {
          await SLINK.core.storage.set('war.insideUnlock.v1', { targetId:Number(retal.attackerId), expiresAt:Date.now() + 2 * 60_000 });
          window.open(retalAttack, '_blank', 'noopener');
        }
      });
      div.querySelector('.retal-head strong').textContent = remaining;
      const badges = div.querySelector('.retal-badges');
      for (const label of [retal.isWar ? 'War hit' : '', retal.isRetal ? 'Retal hit' : ''].filter(Boolean)) badges.append(pill(label));
      const faction = retal.attackerFactionName || (retal.attackerFactionId ? `Faction ${retal.attackerFactionId}` : 'No faction');
      const details = [
        ['Faction', `${faction}${retal.attackerFactionTag ? ` [${retal.attackerFactionTag}]` : ''}`],
        ['Attacked', `${retal.defenderName || `Player ${retal.defenderId}`}${retal.defenderId ? ` [${retal.defenderId}]` : ''}`],
        ['Status', `${retal.attackerStatus || retal.attackerActivity || 'Unknown'}${retal.attackerStatusDescription ? ` • ${retal.attackerStatusDescription}` : ''}`],
        ['Estimated BS', Number.isFinite(retal.battleStatsEstimate) ? SLINK.core.format.shortNumber(retal.battleStatsEstimate) : 'Unknown'],
        ['Fair Fight', Number.isFinite(retal.fairFight) ? retal.fairFight.toFixed(2) : 'Unknown']
      ];
      const report = div.querySelector('.retal-report');
      for (const [label, value] of details) {
        const dt = document.createElement('dt'); dt.textContent = label;
        const dd = document.createElement('dd'); dd.textContent = value;
        report.append(dt, dd);
      }
      div.querySelector('.retal-copy').addEventListener('click', async event => {
        const flags = [retal.isWar ? 'War hit' : '', retal.isRetal ? 'Retal hit' : ''].filter(Boolean).join(' / ');
        await copyText(`🚨 Retal: ${retal.attackerName || `Player ${retal.attackerId}`} [${retal.attackerId}] • ${faction} • ${flags} • attacked ${retal.defenderName || `Player ${retal.defenderId}`} [${retal.defenderId}] • status ${retal.attackerStatus || retal.attackerActivity || 'Unknown'} • BS ${Number.isFinite(retal.battleStatsEstimate) ? SLINK.core.format.shortNumber(retal.battleStatsEstimate) : '?'} • FF ${Number.isFinite(retal.fairFight) ? retal.fairFight.toFixed(2) : '?'} • https://www.torn.com/page.php?sid=attack&user2ID=${retal.attackerId}`);
        event.currentTarget.textContent = 'Copied';
      });
      div.querySelector('.retal-dismiss').addEventListener('click', async () => {
        dismissedRetals[`user:${Number(retal.attackerId) || String(retal.attackId || '')}`] = Number(retal.expiresAt) || now + 300;
        await SLINK.core.storage.set('war.dismissedRetals.v1', dismissedRetals);
        renderRetals();
      });
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
    const grouped = new Map();
    for (const row of rows) {
      const id = Number(row.attacker_id) || 0;
      if (!grouped.has(id)) grouped.set(id, { id, name:String(row.attacker_name || `Player ${id}`), total:0, loss:0, escape:0, online:0, rows:[] });
      const group = grouped.get(id);
      const count = Number(row.event_count) || 0;
      group.total += count;
      if (row.outcome === 'loss') group.loss += count;
      else if (row.outcome === 'escape') group.escape += count;
      else if (row.outcome === 'online_hit') group.online += count;
      group.rows.push(row);
    }
    byId('war-logs').replaceChildren(...[...grouped.values()].sort((a, b) => b.total - a.total).map(group => {
      const details = document.createElement('details');
      details.className = 'mini-item war-log-person';
      const summary = document.createElement('summary');
      summary.textContent = `${group.name}${group.id ? ` [${group.id}]` : ''} — ${group.total} recorded • ${group.loss} lost • ${group.escape} escaped • ${group.online} online hits`;
      details.append(summary);
      for (const row of group.rows.sort((a, b) => Number(b.last_seen_at) - Number(a.last_seen_at))) {
        const event = document.createElement('div');
        event.className = 'war-log-event';
        const seen = new Date(Number(row.last_seen_at) || 0);
        event.textContent = `${String(row.outcome || '').replace('_', ' ')} × ${Number(row.event_count) || 0} against ${row.defender_name || `Player ${row.defender_id}`} [${row.defender_id}] • ${seen.toLocaleDateString()} • ${seen.toLocaleTimeString()}${row.observed_status ? ` • observed ${row.observed_status}` : ''}`;
        details.append(event);
      }
      return details;
    }));
  }

  function renderItemRequests() {
    const requests = war?.runtime?.snapshot?.itemRequests || [];
    const root = byId('war-item-requests');
    root.replaceChildren(...requests.map(request => {
      const item = document.createElement('div');
      item.className = 'mini-item';
      const text = document.createElement('span');
      const rawName = String(request.requesterName || '').trim();
      const requesterName = Number(request.requesterId) === Number(war?.session?.userId) && war?.session?.userName
        ? war.session.userName
        : (!rawName || rawName === String(request.requesterId) || rawName.toLowerCase() === `player ${request.requesterId}`.toLowerCase() ? 'Player' : rawName);
      text.textContent = `${requesterName} [${request.requesterId}] requests ${request.bonusName || 'ranked'} ${request.itemName || 'item'} from ${request.holderName || `Player ${request.holderId}`} • ${request.holderStatus || 'Unknown'} • ${request.holderLastAction || 'Unknown'}`;
      const open = document.createElement('a');
      open.className = 'button small secondary';
      open.target = '_blank'; open.rel = 'noopener noreferrer';
      open.href = request.armoryUrl || 'https://www.torn.com/factions.php?step=your#/tab=armoury';
      open.textContent = 'Open armory';
      const dismiss = document.createElement('button');
      dismiss.className = 'small secondary'; dismiss.type = 'button'; dismiss.textContent = 'Dismiss';
      dismiss.addEventListener('click', async () => {
        dismiss.disabled = true;
        try {
          war = await SLINK.core.messaging.send('war.armory.request', { operation:'resolve', requestId:request.requestId });
          renderWar();
        } catch (error) { showError('war-error', error); }
      });
      item.append(text, open, dismiss);
      return item;
    }));
  }

  function renderWar() {
    const settings = war?.settings || {};
    const sharedConfig = war?.sharedConfig || {};
    const snapshot = war?.runtime?.snapshot || {};
    const stats = war?.runtime?.panelStats || {};
    byId('war-role').textContent = war?.session?.authenticated ? (war.session.officer ? 'War officer' : war.session.factionCapable ? 'Faction API' : 'Public API') : 'Setup required';
    const phase = war?.activeWar?.phase;
    byId('copy-chain-report').disabled = phase !== 'active';
    const startsAt = Number(war?.activeWar?.startedAt) || 0;
    const phaseLabel = phase === 'scheduled'
      ? `Assigned • starts ${new Date(startsAt).toLocaleString()}`
      : phase === 'prewar' ? 'Pre-war status checks' : phase === 'active' ? 'War active' : '';
    byId('war-opponent').textContent = war?.activeWar
      ? `${war.activeWar.opponentName} [${war.activeWar.opponentFactionId}]${phaseLabel ? ` • ${phaseLabel}` : ''}`
      : 'No assigned or active ranked war detected by API';
    byId('war-attack-count').textContent = stats.attacks || 0;
    const insideCap = Math.max(0, Number(sharedConfig.insideHitCap) || 0);
    byId('war-ranked-count').textContent = `${Number(stats.warAttacks) || 0}${insideCap ? `/${insideCap}` : ''}`;
    byId('war-mug-count').textContent = stats.mugs || 0;
    byId('war-mug-summary').textContent = Number(stats.mugs)
      ? `Mugs ${money(stats.mugTotal)} total • ${money(stats.mugMin)} min • ${money(stats.mugAverage)} avg • ${money(stats.mugMax)} max`
      : 'Mug totals appear after a mug.';
    const now = Math.floor(Date.now() / 1000);
    byId('war-retal-count').textContent = (snapshot.retals || []).filter(retal => Number(retal.expiresAt) > now && !dismissedRetals[`user:${Number(retal.attackerId) || String(retal.attackId || '')}`] && !dismissedRetals[String(retal.attackId)]).length;
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
    byId('war-inside-cap').value = insideCap;
    byId('war-inside-mode').value = sharedConfig.insideBlockMode || 'warn';
    byId('war-mode').disabled = !war?.session?.officer;
    byId('war-idle-minutes').disabled = !war?.session?.officer;
    byId('war-inside-cap').disabled = !war?.session?.officer;
    byId('war-inside-mode').disabled = !war?.session?.officer;
    byId('war-open-armory').hidden = !war?.session?.officer;
    byId('war-config-note').textContent = war?.session?.officer
      ? 'War mode, idle filtering, inside-hit cap, and the major-window inside gate are shared faction-wide. Your other alert and display settings remain local.'
      : `Faction-wide mode: ${sharedConfig.mode === 'termed' ? 'Termed war' : 'Real war'}. A slink.war.officer may change it.`;
    byId('war-turtle-minutes').value = settings.turtleMinutes || 5;
    byId('war-alert-sound').checked = settings.alertSound !== false;
    byId('war-alert-panel').checked = settings.alertPanelFlash !== false;
    byId('war-alert-page').checked = settings.alertPageFlash === true;
    byId('war-chain-alert').checked = settings.chainAlert !== false;
    byId('war-turtle-alert').checked = settings.turtleAlert !== false;
    byId('outside-min-ff').value = settings.outsideMinFF || 1;
    byId('outside-max-ff').value = settings.outsideMaxFF || 3;
    renderRetals(); renderLogs(); renderItemRequests();
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
    byId('war-filter-row').hidden = targetView !== 'war';
    byId('outside-filter-row').hidden = targetView !== 'outside';
    byId('claim-assignee-row').hidden = !war?.session?.authenticated || !['war', 'claims'].includes(targetView);
    for (const field of document.querySelectorAll('.claim-officer-field')) field.hidden = !war?.session?.officer;
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
      const members = filteredWarTargets(war?.runtime?.snapshot?.members || []);
      root.replaceChildren(...members.map(warTargetCard));
      byId('target-deck-title').textContent = 'War targets';
      byId('target-summary').textContent = members.length ? `${members.length} matching opponents` : 'No War targets match the current filters';
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
    const revision = SLINK.core.themes.catalog()?.revision || 'bundled';
    byId('theme-summary').textContent = `${activeTheme.label} is active. Theme catalog ${revision}; visual changes apply without a Web Store update.`;
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
        const input = label.querySelector('input');
        input.dataset.scope = scope.scope;
        input.checked = scope.active;
        input.disabled = Boolean(scope.inherited_active && !scope.direct_active);
        label.querySelector('strong').textContent = `${scope.title} (${scope.scope})`;
        label.querySelector('small').textContent = scope.description;
        label.lastElementChild.textContent = scope.inherited_active
          ? `Inherited from faction ${scope.inherited_from_faction}`
          : scope.active
          ? (scope.expires_at ? `Direct grant expires ${new Date(scope.expires_at).toLocaleString()}` : 'Direct grant; no expiration')
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
    const [status, terms, themeRecord, statsStatus] = await Promise.all([
      SLINK.core.messaging.send('system.status'),
      SLINK.core.messaging.send('contribution.terms').catch(() => null),
      SLINK.core.messaging.send('themes.catalog').catch(() => null),
      SLINK.core.messaging.send('playerStats.status', { refreshIfStale:true }).catch(error => ({ configured:false, stale:true, error:errorText(error), data:null }))
    ]);
    if (themeRecord?.catalog) SLINK.core.themes.installCatalog(themeRecord.catalog);
    system = status; leveling = status.leveling; war = status.war; contribution = status.contribution; contributionTerms = terms; playerStats = statsStatus;
    dismissedRetals = await SLINK.core.storage.get('war.dismissedRetals.v1', {});
    dismissedRetals = Object.fromEntries(Object.entries(dismissedRetals || {}).filter(([, expiresAt]) => Number(expiresAt) > Math.floor(Date.now() / 1000)));
    warTargetFilters = { ...warTargetFilters, ...(await SLINK.core.storage.get('ui.war.targetFilters.v1', {})) };
    byId('war-min-ff').value = warTargetFilters.minFF;
    byId('war-max-ff').value = warTargetFilters.maxFF;
    byId('war-status-filter').value = warTargetFilters.status;
    byId('war-target-sort').value = warTargetFilters.sort;
    system.levelingInTorn = await SLINK.core.storage.get('ui.modules.leveling.showInTorn', true);
    await SLINK.core.storage.set('ui.modules.contribution.showInTorn', false);
    byId('connection').textContent = status.worker.connected ? 'Worker connected' : 'Worker offline';
    byId('connection').className = status.worker.connected ? 'badge ready' : 'badge error';
    await applySavedTheme();
    renderAccess(); renderLeveling(); renderWar(); renderTargets(); renderContribution(); renderPlayerStats(); renderAccessTabs();
    if (hasScope('admin.*')) byId('diagnostic').textContent = formatDiagnostic(status.lastDiagnostic);
  }

  async function claimWarLeader() {
    if (document.visibilityState !== 'visible') {
      if (warLeader) void SLINK.core.messaging.send('war.leader.release', { clientId:warLeaderClientId }).catch(() => {});
      warLeader = false;
      return false;
    }
    try {
      const result = await SLINK.core.messaging.send('war.leader.claim', { clientId:warLeaderClientId });
      warLeader = result?.leader === true;
    } catch { warLeader = false; }
    return warLeader;
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
  byId('player-stats-refresh').addEventListener('click', async event => {
    const button = event.currentTarget;
    setBusy(button, true);
    byId('player-stats-error').hidden = true;
    try {
      playerStats = await SLINK.core.messaging.send('playerStats.refresh');
      renderPlayerStats();
    } catch (error) {
      playerStats = { ...(playerStats || {}), error:errorText(error) };
      renderPlayerStats();
    } finally { setBusy(button, false); }
  });
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
  byId('remove-local-keys').addEventListener('click', async () => { if (!confirm('Remove locally saved Torn and FFScouter keys from all SLINK modules? Remote Public Only donations are not affected.')) return; try { await Promise.all([SLINK.core.messaging.send('leveling.settings.save',{clearTornKey:true,clearFfKey:true}),SLINK.core.messaging.send('war.settings.save',{clearTornKey:true,clearFfKey:true})]); await SLINK.core.messaging.send('leveling.session.clear'); await SLINK.core.messaging.send('war.session.clear'); accessExpanded = true; await refresh(); } catch(error) { byId('access-message').textContent=errorText(error); } });
  byId('page-panel').addEventListener('change', async event => { await SLINK.core.storage.set('ui.modules.leveling.showInTorn', event.currentTarget.checked); if (event.currentTarget.checked) await SLINK.core.storage.set('ui.pagePanelHidden', false); system.levelingInTorn = event.currentTarget.checked; });
  byId('reset-position').textContent = 'Restore GUI in Torn';
  byId('war-reset-position').textContent = 'Restore GUI in Torn';
  async function restoreTornGui(button) {
    setBusy(button, true);
    try {
      const result = await SLINK.core.messaging.send('ui.torn.restore');
      byId('war-action-message').textContent = result.restored
        ? `Restored the SLINK GUI in ${result.restored} open Torn tab${result.restored === 1 ? '' : 's'}.`
        : 'No current Torn tab accepted the restore request. Open Torn once, then try again.';
    } catch (error) {
      byId('war-action-message').textContent = errorText(error);
    } finally { setBusy(button, false); }
  }
  byId('reset-position').addEventListener('click', event => restoreTornGui(event.currentTarget));
  byId('war-reset-position').addEventListener('click', event => restoreTornGui(event.currentTarget));
  byId('refresh-targets').addEventListener('click', async event => { const button = event.currentTarget; setBusy(button, true); try { leveling = await SLINK.core.messaging.send('leveling.activity.touch'); const result = await SLINK.core.messaging.send('leveling.cycle.prepare',{contribute:false}); leveling = result.status; renderLeveling(); renderTargets(); } catch (error) { showError('leveling-error', error); } finally { setBusy(button, false); } });
  byId('war-refresh').addEventListener('click', async event => { const button = event.currentTarget; setBusy(button, true); try { war = await SLINK.core.messaging.send('war.cycle.prepare',{forceOpponentRefresh:true,manual:true}); renderWar(); renderTargets(); } catch (error) { showError('war-error', error); } finally { setBusy(button, false); } });
  byId('war-open-armory').addEventListener('click', async () => {
    await SLINK.core.storage.set('ui.war.requestedTab', 'armory');
    window.open('https://www.torn.com/factions.php?step=your#/tab=armoury', '_blank', 'noopener');
    byId('war-action-message').textContent = 'Opened Faction Armoury. Use the officer-only Armory tab in the in-Torn War panel.';
  });
  byId('copy-chain-report').addEventListener('click', async event => {
    const button = event.currentTarget; setBusy(button, true); byId('war-action-message').textContent = '';
    try {
      const report = await SLINK.core.messaging.send('war.chain.report');
      await copyText(report.text);
      byId('war-action-message').textContent = 'Current chain and SLINK War report copied for faction chat.';
    } catch (error) { byId('war-action-message').textContent = errorText(error); }
    finally { setBusy(button, false); }
  });
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
      if (war?.session?.officer) war = await SLINK.core.messaging.send('war.config.save', { mode:byId('war-mode').value, idleMinutes:byId('war-idle-minutes').value, insideHitCap:byId('war-inside-cap').value, insideBlockMode:byId('war-inside-mode').value });
      war = await SLINK.core.messaging.send('war.cycle.prepare', { manual:true });
      byId('war-action-message').textContent = war?.session?.officer ? 'Local alerts and faction-wide War settings saved.' : 'Local War display and alert settings saved.';
      renderWar(); renderTargets();
    } catch (error) { showError('war-error', error); } finally { setBusy(button, false); }
  });
  for (const button of document.querySelectorAll('[data-target-view]')) button.addEventListener('click', () => { targetView = button.dataset.targetView; renderTargets(); });
  for (const id of ['war-min-ff', 'war-max-ff', 'war-status-filter', 'war-target-sort']) byId(id).addEventListener('change', async () => {
    warTargetFilters = {
      minFF:Math.max(0, Math.min(100, Number(byId('war-min-ff').value) || 0)),
      maxFF:Math.max(0, Math.min(100, Number(byId('war-max-ff').value) || 3)),
      status:byId('war-status-filter').value,
      sort:byId('war-target-sort').value
    };
    await SLINK.core.storage.set('ui.war.targetFilters.v1', warTargetFilters);
    renderTargets();
  });
  byId('claim-submit').addEventListener('click', async event => {
    const button = event.currentTarget;
    const targetId = Number(byId('claim-target-id').value) || 0;
    if (!targetId) { byId('war-action-message').textContent = 'Enter the med-out target Torn ID.'; return; }
    const member = (war?.runtime?.snapshot?.members || []).find(row => Number(row.id) === targetId);
    const targetName = byId('claim-target-name').value.trim() || member?.name || `Player ${targetId}`;
    const assigneeId = war?.session?.officer ? Number(byId('claim-assignee-id').value) || 0 : 0;
    const assigneeName = war?.session?.officer ? byId('claim-assignee-name').value.trim() : '';
    setBusy(button, true);
    try {
      war = await SLINK.core.messaging.send('war.claims.update', { operation:'claim', targetId, targetName, assigneeId, assigneeName });
      byId('war-action-message').textContent = assigneeId ? `Assigned ${targetName} [${targetId}] to Torn ID ${assigneeId}.` : `Claimed ${targetName} [${targetId}] as your med-out partner.`;
      byId('claim-target-id').value = '';
      byId('claim-target-name').value = '';
      renderTargets(); renderWar();
    } catch (error) { byId('war-action-message').textContent = errorText(error); }
    finally { setBusy(button, false); }
  });
  for (const button of document.querySelectorAll('[data-page-tab]')) button.addEventListener('click', () => switchPage(button.dataset.pageTab));
  byId('donation-form').addEventListener('submit', async event => { event.preventDefault(); const submit = byId('donation-submit'); setBusy(submit,true); byId('donation-message').textContent=''; try { contribution=await SLINK.core.messaging.send('contribution.donate',{apiKey:byId('donation-key').value,acceptTerms:byId('donation-accept').checked}); byId('donation-key').value=''; byId('donation-accept').checked=false; byId('donation-message').textContent='Public Only key validated and saved on SLINK servers in encrypted form.'; renderContribution(); } catch(error){ byId('donation-message').textContent=errorText(error); } finally{ setBusy(submit,false); } });
  byId('donation-revoke').addEventListener('click', async () => { if (!confirm('Revoke this saved donation and erase its encrypted key material?')) return; try { contribution=await SLINK.core.messaging.send('contribution.revoke'); byId('donation-message').textContent='Donation revoked and encrypted key material erased.'; renderContribution(); } catch(error) { byId('donation-message').textContent=errorText(error); } });
  byId('run-diagnostic').addEventListener('click', async event => { const button=event.currentTarget; setBusy(button,true); try { byId('diagnostic').textContent=formatDiagnostic(await SLINK.core.messaging.send('diagnostics.run')); } catch(error){ byId('diagnostic').textContent=errorText(error); } finally{ setBusy(button,false); } });
  byId('admin-lookup-form').addEventListener('submit', async event => { event.preventDefault(); const button=byId('admin-lookup'); setBusy(button,true); byId('admin-message').textContent=''; try { adminUser=await SLINK.core.messaging.send('war.admin.permissions.get',{userId:byId('admin-user-id').value}); renderAdminScopes(adminUser.scopes); byId('admin-permissions-form').hidden=false; const identity=adminUser.faction_id ? ` Current faction: ${adminUser.faction_id}. Faction access is marked as inherited and does not create a personal grant row.` : ' No current faction entitlement was found; only direct grants are shown.'; byId('admin-message').textContent=`Loaded effective access for Torn ID ${adminUser.user_id}.${identity}${adminUser.identity_warning ? ` ${adminUser.identity_warning}` : ''}`; } catch(error){ byId('admin-message').textContent=errorText(error); } finally{ setBusy(button,false); } });
  byId('admin-permissions-form').addEventListener('submit', async event => { event.preventDefault(); const button=byId('admin-save'); setBusy(button,true); try { const scopes=[...byId('admin-scope-list').querySelectorAll('input[data-scope]:checked:not(:disabled)')].map(input=>input.dataset.scope); adminUser=await SLINK.core.messaging.send('war.admin.permissions.save',{userId:adminUser.user_id,scopes,hours:byId('admin-hours').value,note:byId('admin-note').value}); byId('admin-message').textContent=`Permissions saved for Torn ID ${adminUser.user_id}. They take effect on the user's next authentication.`; byId('admin-lookup-form').requestSubmit(); } catch(error){ byId('admin-message').textContent=errorText(error); } finally{ setBusy(button,false); } });

  try { await refresh(); }
  catch (error) {
    byId('connection').textContent = 'Extension background unavailable';
    byId('connection').className = 'badge error';
    showError('war-error', error);
    showError('leveling-error', error);
  }
  await claimWarLeader();
  setInterval(() => void claimWarLeader(), 5_000);
  addEventListener('visibilitychange', () => void claimWarLeader());
  setInterval(async () => {
    if (!war?.configured) return;
    try {
      war = warLeader
        ? await SLINK.core.messaging.send('war.cycle.prepare')
        : await SLINK.core.messaging.send('war.status');
      renderWar();
      if (targetView === 'war' || targetView === 'claims') renderTargets();
    } catch (error) { showError('war-error', error); }
  }, 10_000);
  addEventListener('pagehide', () => { void SLINK.core.messaging.send('war.leader.release', { clientId:warLeaderClientId }).catch(() => {}); }, { once:true });
})();

