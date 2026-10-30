(function installHttp(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before HTTP helpers.');

  const CAPABILITY_ORIGINS = Object.freeze({
    tornApi: 'https://api.torn.com',
    ffscouter: 'https://ffscouter.com',
    weaver: 'https://weav3r.dev',
    yataTravel: 'https://yata.yt',
    prometheusTravel: 'https://prombot.co.uk:8443',
    tornIntelTravel: 'https://torn-intel.com',
    droqsTravel: 'https://droqsdb.com',
    slinkWorker: 'https://slinkyleveling.richard-johnson554.workers.dev',
    contributionWorker: 'https://slinkcontributionworker.richard-johnson554.workers.dev',
    warWorker: 'https://slinkwarworker.richard-johnson554.workers.dev',
    muggingWorker: 'https://slinkmuggingworker.richard-johnson554.workers.dev'
  });

  async function hasCapability(name) {
    const capability = SLINK.core.permissions.getCapability(name);
    return chrome.permissions.contains({ origins: [...capability.origins] });
  }

  function validateUrl(capabilityName, input) {
    const expectedOrigin = CAPABILITY_ORIGINS[capabilityName];
    if (!expectedOrigin) throw new Error(`No HTTP origin is configured for ${capabilityName}.`);
    const url = new URL(String(input));
    if (url.origin !== expectedOrigin) {
      const error = new Error(`Blocked ${capabilityName} request to ${url.origin}.`);
      error.code = 'SLINK_ORIGIN_BLOCKED';
      throw error;
    }
    return url;
  }

  const ffRetryAt = new Map();
  async function requestJson(capabilityName, input, options = {}) {
    if (capabilityName !== 'ffscouter') return requestJsonRaw(capabilityName, input, options);
    if(global.SLINK_FF_BACKUP_CLIENT&&/\/get-(stats|targets)$/.test(new URL(input).pathname))return global.SLINK_FF_BACKUP_CLIENT.run(input,async()=>{
      const controller=new AbortController();let timer;
      try{return await Promise.race([requestJsonRaw(capabilityName,input,{...options,signal:controller.signal}),new Promise((_,reject)=>{timer=global.setTimeout(()=>{controller.abort();reject(Error('FFScouter timed out.'));},5000);})]);}finally{global.clearTimeout(timer);}
    });
    const audience = validateUrl(capabilityName, input).searchParams.get('key') || '';
    if (Date.now() < (ffRetryAt.get(audience) || 0)) {
      const error = new Error('FFScouter is temporarily unavailable; cached estimates or N/A are being used.');
      error.code = 'SLINK_FF_BACKOFF';
      throw error;
    }
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = global.setTimeout(() => { controller.abort(); reject(new Error('FFScouter timed out.')); }, 5_000);
      });
      const value = await Promise.race([requestJsonRaw(capabilityName, input, { ...options, signal:controller.signal }), timeout]);
      if (!value || value.error) throw new Error('FFScouter could not provide estimates.');
      if (new URL(input).pathname.endsWith('/get-stats') && !Array.isArray(value) && !Array.isArray(value.data) && !Array.isArray(value.results)) throw new Error('Invalid FFScouter estimates response.');
      ffRetryAt.delete(audience);
      return value;
    } catch (error) {
      ffRetryAt.set(audience, Date.now() + Math.max(60_000, Math.min(30 * 60_000, Number(error.retryAfterMs) || 0)));
      throw error;
    } finally { global.clearTimeout(timer); }
  }

  async function requestJsonRaw(capabilityName, input, options = {}) {
    const url = validateUrl(capabilityName, input);
    if (!await hasCapability(capabilityName)) {
      const error = new Error(`${SLINK.core.permissions.getCapability(capabilityName).label} permission has not been granted.`);
      error.code = 'SLINK_BROWSER_PERMISSION_REQUIRED';
      throw error;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        const error = new Error(`Expected JSON from ${url.hostname}.`);
        error.code = 'SLINK_INVALID_JSON';
        throw error;
      }
    }
    if (!response.ok) {
      const primaryMessage = data?.error?.message || data?.error || `HTTP ${response.status}`;
      const diagnosticDetail = typeof data?.detail === 'string' && data.detail.trim()
        ? data.detail.trim()
        : '';
      const error = new Error(diagnosticDetail && !String(primaryMessage).includes(diagnosticDetail)
        ? `${primaryMessage} (${diagnosticDetail})`
        : primaryMessage);
      error.code = 'SLINK_HTTP_ERROR';
      error.status = response.status;
      const retryAfter = response.headers?.get?.('retry-after');
      if (retryAfter) {
        const seconds = Number(retryAfter);
        const date = Date.parse(retryAfter);
        error.retryAfterMs = Number.isFinite(seconds)
          ? Math.max(0, seconds * 1_000)
          : Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
      }
      error.data = data;
      throw error;
    }
    return data;
  }

  async function requestText(capabilityName, input, options = {}) {
    const url = validateUrl(capabilityName, input);
    if (!await hasCapability(capabilityName)) {
      const error = new Error(`${SLINK.core.permissions.getCapability(capabilityName).label} permission has not been granted.`);
      error.code = 'SLINK_BROWSER_PERMISSION_REQUIRED';
      throw error;
    }

    const response = await fetch(url, options);
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.code = 'SLINK_HTTP_ERROR';
      error.status = response.status;
      throw error;
    }
    return text;
  }

  SLINK.define('core', 'http', Object.freeze({
    CAPABILITY_ORIGINS,
    hasCapability,
    requestJson,
    requestText,
    validateUrl
  }));
})(globalThis);


