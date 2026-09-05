(function installPermissionService(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const BASE_URL = 'https://slinkcontributionworker.richard-johnson554.workers.dev';
  const KEYS = Object.freeze({
    settings:'access.settings.v1',
    terms:'access.terms.v1',
    acceptedTerms:'access.acceptedTerms.v1',
    session:'access.session.v1',
    permissions:'permissions.access'
  });
  let authenticating = null;

  async function settings() {
    return { enabled:false, tornKey:'', ...(await SLINK.core.storage.get(KEYS.settings, {})) };
  }

  async function fetchTerms(force = false) {
    const cached = await SLINK.core.storage.get(KEYS.terms, null);
    if (!force && cached?.version && cached?.sha256) return cached;
    const response = await SLINK.core.http.requestJson('contributionWorker', `${BASE_URL}/api/permissions/terms`, { cache:'no-store' });
    const terms = {
      version:String(response?.terms?.version || ''),
      sha256:String(response?.terms?.sha256 || ''),
      documentUrl:String(response?.terms?.url || ''),
      summary:String(response?.terms?.summary || '')
    };
    if (!terms.version || !terms.sha256) throw new Error('The SLINK permission service returned incomplete terms.');
    await SLINK.core.storage.set(KEYS.terms, terms);
    return terms;
  }

  async function acceptedCurrentTerms(current = null) {
    const terms = current || await fetchTerms();
    const records = await Promise.all([
      SLINK.core.storage.get(KEYS.acceptedTerms, null),
      SLINK.core.storage.get('war.acceptedTerms.v1', null),
      SLINK.core.storage.get('leveling.acceptedTerms.v1', null)
    ]);
    return records.some(accepted => accepted?.version === terms.version && accepted?.sha256 === terms.sha256);
  }

  async function clearSession() {
    await Promise.all([
      SLINK.core.storage.remove(KEYS.session),
      SLINK.core.storage.remove(KEYS.permissions)
    ]);
    return SLINK.core.permissions.recomputeStoredSnapshot();
  }

  async function ensureSession(force = false, requiredScope = SLINK.core.adhd.ALERT_SCOPE) {
    if (authenticating) return authenticating;
    authenticating = (async () => {
      const currentSettings = await settings();
      const [levelingSettings, warSettings] = await Promise.all([
        SLINK.core.storage.get('leveling.settings.v1', {}),
        SLINK.core.storage.get('war.settings.v1', {})
      ]);
      const tornKey = String(currentSettings.tornKey || '').trim()
        || String(levelingSettings?.tornKey || '').trim()
        || String(warSettings?.tornKey || '').trim();
      if (requiredScope === SLINK.core.adhd.ALERT_SCOPE && !currentSettings.enabled) {
        const error = new Error('Enable Efficiency first.');
        error.code = 'SLINK_ADHD_KEY_REQUIRED';
        throw error;
      }
      if (!tornKey) {
        const error = new Error('Save your Torn API key first.');
        error.code = 'SLINK_API_KEY_REQUIRED';
        throw error;
      }
      const terms = await fetchTerms();
      if (!await acceptedCurrentTerms(terms)) {
        const error = new Error('Review and accept the current SLINK API & Data Terms for Efficiency.');
        error.code = 'SLINK_ADHD_TERMS_REQUIRED';
        throw error;
      }
      const existing = await SLINK.core.storage.get(KEYS.session, null);
      if (!force && existing?.token && Number(existing.expiresAt) > Date.now() + 60_000) return existing;
      await SLINK.core.tornApiLimiter.reserve({ wait:true });
      const response = await SLINK.core.http.requestJson('contributionWorker', `${BASE_URL}/api/permissions/auth`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        cache:'no-store',
        body:JSON.stringify({
          api_key:tornKey,
          terms_accepted:true,
          terms_version:terms.version,
          terms_sha256:terms.sha256,
          client_name:'SLINK Browser Extension',
          client_version:SLINK.VERSION
        })
      });
      if (!response?.session_token) throw new Error('SLINK did not return a permission session.');
      const session = {
        token:String(response.session_token),
        expiresAt:Date.parse(response.expires_at) || 0,
        userId:Number(response.user_id) || null,
        userName:String(response.user_name || `Player ${response.user_id}`),
        factionId:Number(response.faction_id) || 0,
        roles:Array.isArray(response.roles) ? response.roles : [],
        scopes:Array.isArray(response.scopes) ? response.scopes : []
      };
      if (requiredScope && !SLINK.core.permissions.hasScope(session, requiredScope)) {
        const error = new Error(`Your SLINK account does not have ${requiredScope} permission.`);
        error.code = 'SLINK_PERMISSION_DENIED';
        throw error;
      }
      await SLINK.core.storage.set(KEYS.session, session);
      await SLINK.core.storage.set(KEYS.permissions, {
        userId:session.userId,
        roles:session.roles,
        scopes:session.scopes,
        source:'slink-permission-session',
        issuedAt:Date.now(),
        expiresAt:session.expiresAt
      });
      await SLINK.core.permissions.recomputeStoredSnapshot();
      return session;
    })();
    try { return await authenticating; }
    finally { authenticating = null; }
  }

  async function saveSettings(input = {}) {
    const previous = await settings();
    const [levelingSettings, warSettings] = await Promise.all([
      SLINK.core.storage.get('leveling.settings.v1', {}),
      SLINK.core.storage.get('war.settings.v1', {})
    ]);
    const sharedLocalKey = String(input.tornKey || '').trim()
      || previous.tornKey
      || String(levelingSettings?.tornKey || '').trim()
      || String(warSettings?.tornKey || '').trim();
    const next = {
      enabled:Object.hasOwn(input, 'enabled') ? input.enabled === true : previous.enabled,
      tornKey:input.clearTornKey ? '' : sharedLocalKey
    };
    await SLINK.core.storage.set(KEYS.settings, next);
    if (input.acceptTerms === true) {
      const terms = await fetchTerms(true);
      await SLINK.core.storage.set(KEYS.acceptedTerms, { version:terms.version, sha256:terms.sha256, acceptedAt:Date.now() });
    }
    if (next.tornKey !== previous.tornKey || next.enabled !== previous.enabled || input.acceptTerms === true) await clearSession();
    if (next.enabled && next.tornKey) await ensureSession(true);
    return status();
  }

  async function permissionRequest(path, options = {}) {
    const session = await ensureSession(false, 'admin.*');
    return SLINK.core.http.requestJson('contributionWorker', `${BASE_URL}${path}`, {
      ...options,
      headers:{
        Authorization:`Bearer ${session.token}`,
        ...(options.headers || {})
      },
      body:options.body && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body
    });
  }

  async function adminPermissionsGet(payload = {}) {
    const session = await ensureSession(false, 'admin.*');
    if (!SLINK.core.permissions.hasScope(session, 'admin.*')) throw new Error('admin.* permission is required.');
    const userId = Number(payload.userId);
    if (!Number.isInteger(userId) || userId <= 0) throw new Error('Enter a valid Torn user ID.');
    let factionId = 0;
    let identityWarning = '';
    try {
      const currentSettings = await settings();
      await SLINK.core.tornApiLimiter.reserve({ wait:true });
      const data = await SLINK.core.http.requestJson('tornApi', `https://api.torn.com/v2/user/${encodeURIComponent(userId)}/basic`, {
        headers:{ Authorization:`ApiKey ${currentSettings.tornKey}` },
        cache:'no-store'
      });
      const profile = data?.profile || data?.basic || data;
      factionId = Number(profile?.faction_id || profile?.faction?.faction_id || profile?.faction?.id || 0);
      if (!Number.isInteger(factionId) || factionId < 0) factionId = 0;
    } catch (error) {
      identityWarning = `Current faction could not be checked: ${SLINK.core.format.errorMessage(error)}`;
    }
    const query = factionId > 0 ? `?faction_id=${factionId}` : '';
    const result = await permissionRequest(`/api/admin/users/${userId}/permissions${query}`);
    return { ...result, identity_warning:identityWarning };
  }

  async function status() {
    const [currentSettings, terms, accepted, session, permissions] = await Promise.all([
      settings(),
      fetchTerms(),
      acceptedCurrentTerms(),
      SLINK.core.storage.get(KEYS.session, null),
      SLINK.core.storage.get('permissions.snapshot', null)
    ]);
    return {
      configured:Boolean(currentSettings.enabled && currentSettings.tornKey && accepted),
      settings:{ enabled:currentSettings.enabled, hasTornKey:Boolean(currentSettings.tornKey) },
      terms:{ ...terms, accepted },
      session:{ authenticated:Boolean(session?.token && Number(session.expiresAt) > Date.now()), userId:session?.userId || null, expiresAt:Number(session?.expiresAt) || 0 },
      permissions:SLINK.core.permissions.normalizeSnapshot(permissions || {})
    };
  }

  const routes = Object.freeze({
    'access.status':status,
    'access.settings.save':saveSettings,
    'access.session.clear':async () => { await clearSession(); return status(); },
    'access.admin.scopes':async () => {
      const session = await ensureSession(false, 'admin.*');
      if (!SLINK.core.permissions.hasScope(session, 'admin.*')) throw new Error('admin.* permission is required.');
      return permissionRequest('/api/admin/scopes');
    },
    'access.admin.permissions.get':adminPermissionsGet,
    'access.admin.permissions.save':async payload => {
      const session = await ensureSession(false, 'admin.*');
      if (!SLINK.core.permissions.hasScope(session, 'admin.*')) throw new Error('admin.* permission is required.');
      const userId = Number(payload?.userId);
      if (!Number.isInteger(userId) || userId <= 0) throw new Error('Enter a valid Torn user ID.');
      return permissionRequest(`/api/admin/users/${userId}/permissions`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:{ scopes:Array.isArray(payload?.scopes) ? payload.scopes : [], hours:payload?.hours, note:payload?.note }
      });
    }
  });

  SLINK.define('services', 'permissionAccess', Object.freeze({ clearSession, ensureSession, routes, settings, status }));
})(globalThis);
