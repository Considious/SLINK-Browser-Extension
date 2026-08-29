(function installMessaging(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before messaging.');

  let nextRequestId = 1;

  async function send(type, payload = {}) {
    let response;
    try {
      if (!global.chrome?.runtime?.id) throw new Error('Extension context invalidated.');
      response = await chrome.runtime.sendMessage({
        channel: 'slink',
        requestId: nextRequestId++,
        type: String(type || ''),
        payload
      });
    } catch (cause) {
      const detail = String(cause?.message || cause || 'Chrome runtime messaging failed.');
      const invalidated = /context invalidated|extension context|receiving end does not exist/i.test(detail);
      const error = new Error(invalidated
        ? 'The extension was updated while this page was open. Reopen the extension page or reload Torn manually; SLINK will never refresh Torn automatically.'
        : `Could not contact the SLINK background service: ${detail}`);
      error.code = invalidated ? 'SLINK_EXTENSION_CONTEXT_STALE' : 'SLINK_RUNTIME_UNAVAILABLE';
      error.cause = cause;
      throw error;
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
