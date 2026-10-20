(function installFactionOfficerService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const BASE_URL = 'https://slinkcontributionworker.richard-johnson554.workers.dev';
  const OFFICER_SCOPE = 'slink.war.officer';
  const REFRESH_MS = 5 * 60_000;
  const KEYS = Object.freeze({
    runtime:'faction.onboarding.runtime.v1',
    dismissed:'faction.onboarding.dismissed.v1'
  });
  let refreshing = null;

  async function accessKey() {
    const [access, leveling, war] = await Promise.all([
      SLINK.services.permissionAccess.settings(),
      SLINK.core.storage.get('leveling.settings.v1', {}),
      SLINK.core.storage.get('war.settings.v1', {})
    ]);
    return String(access?.tornKey || leveling?.tornKey || war?.tornKey || '').trim();
  }

  async function session(requiredScope = OFFICER_SCOPE) {
    return SLINK.services.permissionAccess.ensureSession(false, requiredScope);
  }

  async function workerRequest(path, options = {}, requiredScope = OFFICER_SCOPE) {
    const current = await session(requiredScope);
    return SLINK.core.http.requestJson('contributionWorker', `${BASE_URL}${path}`, {
      ...options,
      headers:{ Authorization:`Bearer ${current.token}`, ...(options.headers || {}) },
      body:options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
    });
  }

  async function tornMembers() {
    const key = await accessKey();
    if (!key) throw new Error('Save your Torn API key before checking faction members.');
    await SLINK.core.tornApiLimiter.reserve({ wait:true });
    const response = await SLINK.core.http.requestJson(
      'tornApi',
      'https://api.torn.com/v2/faction/members?comment=SLINK%20faction%20onboarding',
      { headers:{ Authorization:`ApiKey ${key}` }, cache:'no-store' }
    );
    if (response?.error) throw new Error(response.error.message || response.error.error || 'Torn could not return the faction roster.');
    const source = response?.members ?? response?.faction?.members ?? [];
    const rows = Array.isArray(source) ? source : Object.entries(source || {}).map(([id, member]) => ({ id, ...(member || {}) }));
    const members = rows.map(row => {
      const id = Number(row?.id ?? row?.user_id ?? row?.player_id);
      if (!Number.isInteger(id) || id <= 0) return null;
      const position = row?.position;
      return {
        id,
        name:String(row?.name || `Player ${id}`),
        position:String(position?.name ?? row?.position_name ?? position ?? row?.rank ?? 'Member').trim() || 'Member',
        level:Math.max(0, Math.trunc(Number(row?.level) || 0))
      };
    }).filter(Boolean);
    if (!members.length) throw new Error('Torn returned no faction members. A faction-capable API key may be required.');
    return members;
  }

  async function runtime() {
    return { fetchedAt:0, nextRefreshAt:0, alerts:[], lastError:'', ...(await SLINK.core.storage.get(KEYS.runtime, {})) };
  }

  async function saveRuntime(changes) {
    const next = { ...(await runtime()), ...changes };
    await SLINK.core.storage.set(KEYS.runtime, next);
    return next;
  }

  async function refresh(force = false) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const previous = await runtime();
      if (!force && Number(previous.nextRefreshAt) > Date.now()) return previous;
      try {
        const members = await tornMembers();
        const response = await workerRequest('/api/faction/onboarding/sync', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:{ members }
        });
        return saveRuntime({
          fetchedAt:Date.now(),
          nextRefreshAt:Date.now() + REFRESH_MS,
          alerts:Array.isArray(response?.alerts) ? response.alerts : [],
          viewerIsAdmin:response?.viewer_is_admin === true,
          factionId:Number(response?.faction_id) || 0,
          initialized:response?.initialized === true,
          rosterCount:Number(response?.roster_count) || members.length,
          lastError:''
        });
      } catch (error) {
        await saveRuntime({ nextRefreshAt:Date.now() + 60_000, lastError:SLINK.core.format.errorMessage(error) });
        throw error;
      }
    })();
    try { return await refreshing; }
    finally { refreshing = null; }
  }

  async function status(refreshIfDue = true) {
    let current = await runtime();
    if (refreshIfDue && Number(current.nextRefreshAt) <= Date.now()) {
      try { current = await refresh(false); } catch {}
    }
    return current;
  }

  async function dismissed() {
    const value = await SLINK.core.storage.get(KEYS.dismissed, {});
    return value && typeof value === 'object' ? value : {};
  }

  function alertId(row) {
    return `factionOnboarding:${Number(row.user_id)}:${Number(row.joined_at) || 0}`;
  }

  async function activeAlerts(refreshIfDue = true) {
    const [current, hidden, adhdSettings] = await Promise.all([
      status(refreshIfDue),
      dismissed(),
      SLINK.core.storage.get('adhd.settings.v1', {})
    ]);
    const settings = SLINK.core.adhd.normalizeSettings(adhdSettings);
    if (settings.enabled.factionOnboarding === false) return [];
    const now = Date.now();
    return (Array.isArray(current.alerts) ? current.alerts : [])
      .filter(row => Number(hidden[row.user_id]) !== Number(row.joined_at))
      .map(row => {
        const id = alertId(row);
        return {
          id,
          settingId:'factionOnboarding',
          kind:'faction-onboarding',
          memberId:Number(row.user_id),
          joinedAt:Number(row.joined_at) || 0,
          active:Number(settings.snoozedUntil[id] || 0) <= now,
          title:`New faction member: ${row.user_name} [${row.user_id}]`,
          detail:(() => {
            const level = Math.max(0, Number(row.level) || 0);
            const position = String(row.position || 'Member');
            const checklist = [
              ...(level > 0 && level < 15 ? ['proficiency weapon'] : []),
              'armor',
              '20 Pepper Spray',
              '20 Morphine',
              ...(position.toLowerCase().includes('recruit') ? ['4 Xanax only if stacking and still recruit'] : [])
            ];
            return `${position}${level ? ` · Level ${level}` : ''} · Check: ${checklist.join('; ')}.`;
          })(),
          tone:'urgent',
          links:[['Profile', `https://www.torn.com/profiles.php?XID=${row.user_id}`]],
          viewerIsAdmin:current.viewerIsAdmin === true,
          officerVerifiedAt:Number(row.officer_verified_at) || 0
        };
      })
      .filter(alert => alert.active);
  }

  async function verify(input = {}) {
    const memberId = Number(input.memberId);
    if (!Number.isInteger(memberId) || memberId <= 0) throw new Error('A valid faction member is required.');
    const response = await workerRequest(`/api/faction/onboarding/${memberId}/verify`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:{}
    });
    await saveRuntime({
      fetchedAt:Date.now(),
      nextRefreshAt:Date.now() + REFRESH_MS,
      alerts:Array.isArray(response?.alerts) ? response.alerts : [],
      viewerIsAdmin:response?.viewer_is_admin === true,
      factionId:Number(response?.faction_id) || 0,
      lastError:''
    });
    return response;
  }

  async function dismiss(input = {}) {
    const memberId = Number(input.memberId);
    const joinedAt = Number(input.joinedAt) || 0;
    if (!Number.isInteger(memberId) || memberId <= 0) throw new Error('A valid faction member is required.');
    const value = await dismissed();
    value[memberId] = joinedAt;
    await SLINK.core.storage.set(KEYS.dismissed, value);
    return { ok:true, memberId, joinedAt };
  }

  async function officerRolesStatus() {
    const current = await session('admin.*');
    const members = await tornMembers();
    const factionId = Number(current.factionId) || 0;
    if (!factionId) throw new Error('Your authenticated Torn account is not in a faction.');
    const response = await workerRequest(`/api/admin/factions/${factionId}/officer-roles`, {}, 'admin.*');
    const configured = new Set((Array.isArray(response?.roles) ? response.roles : []).filter(role => role?.active).map(role => String(role.name || '').trim()));
    const roles = [...new Set(members.map(member => member.position).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right))
      .map(name => ({ name, memberCount:members.filter(member => member.position === name).length, selected:configured.has(name) }));
    return { factionId, roles, configuredRoles:[...configured].sort(), memberCount:members.length };
  }

  async function saveOfficerRoles(input = {}) {
    const current = await session('admin.*');
    const factionId = Number(current.factionId) || 0;
    if (!factionId) throw new Error('Your authenticated Torn account is not in a faction.');
    await workerRequest(`/api/admin/factions/${factionId}/officer-roles`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:{ roles:Array.isArray(input.roles) ? input.roles : [] }
    }, 'admin.*');
    await SLINK.services.permissionAccess.ensureSession(true, 'admin.*');
    return officerRolesStatus();
  }

  const routes = Object.freeze({
    'faction.onboarding.status':payload => status(payload?.refreshIfDue !== false),
    'faction.onboarding.refresh':() => refresh(true),
    'faction.onboarding.verify':verify,
    'faction.onboarding.dismiss':dismiss,
    'faction.officer-roles.status':officerRolesStatus,
    'faction.officer-roles.save':saveOfficerRoles
  });

  SLINK.define('services', 'factionOfficer', Object.freeze({ OFFICER_SCOPE, activeAlerts, refresh, routes, status }));
})(globalThis);
