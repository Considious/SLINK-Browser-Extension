(function installMessaging(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before messaging.');

  let nextRequestId = 1;
  let staleContextPromise = null;

  function suspendStaleContext(detail) {
    if (!staleContextPromise) {
      console.info('[SLINK] This page belongs to an older extension version and is now inactive.', detail);
      staleContextPromise = new Promise(() => {});
    }
    return staleContextPromise;
  }

  function requestMessage(type, payload) {
    return {
      channel: 'slink',
      requestId: nextRequestId++,
      type: String(type || ''),
      payload
    };
  }

  async function send(type, payload = {}) {
    let response;
    if (staleContextPromise) return staleContextPromise;
    if (!global.chrome?.runtime?.id) return suspendStaleContext('Extension context invalidated.');
    const message = requestMessage(type, payload);
    try {
      response = await chrome.runtime.sendMessage(message);
    } catch (cause) {
      let detail = String(cause?.message || cause || 'Chrome runtime messaging failed.');
      if (/context invalidated|extension context/i.test(detail) || !global.chrome?.runtime?.id) return suspendStaleContext(detail);
      if (/receiving end does not exist/i.test(detail)) {
        await new Promise(resolve => setTimeout(resolve, 150));
        if (!global.chrome?.runtime?.id) return suspendStaleContext(detail);
        try { response = await chrome.runtime.sendMessage(message); }
        catch (retryCause) {
          cause = retryCause;
          detail = String(retryCause?.message || retryCause || detail);
          if (/context invalidated|extension context/i.test(detail) || !global.chrome?.runtime?.id) return suspendStaleContext(detail);
        }
      }
      if (!response) {
        const error = new Error(`Could not contact the SLINK background service: ${detail}`);
        error.code = 'SLINK_RUNTIME_UNAVAILABLE';
        error.cause = cause;
        throw error;
      }
    }

    if (!response?.ok) {
      const error = new Error(response?.error?.message || 'SLINK background request failed.');
      error.code = response?.error?.code || 'SLINK_MESSAGE_FAILED';
      throw error;
    }
    return response.data;
  }

  function createRouter(routes) {
    const routeMap = Object.freeze({ ...routes });

    return (message, sender, sendResponse) => {
      if (message?.channel !== 'slink') return false;

      const handler = routeMap[message.type];
      if (typeof handler !== 'function') {
        sendResponse({
          ok: false,
          requestId: message.requestId,
          error: { code: 'SLINK_ROUTE_NOT_FOUND', message: `Unknown SLINK route: ${message.type}` }
        });
        return false;
      }

      Promise.resolve()
        .then(() => handler(message.payload || {}, sender))
        .then(data => sendResponse({ ok: true, requestId: message.requestId, data }))
        .catch(error => sendResponse({
          ok: false,
          requestId: message.requestId,
          error: {
            code: String(error?.code || 'SLINK_BACKGROUND_ERROR'),
            message: SLINK.core.format?.errorMessage(error) || String(error)
          }
        }));

      return true;
    };
  }

  SLINK.define('core', 'messaging', Object.freeze({
    createRouter,
    send
  }));
})(globalThis);
