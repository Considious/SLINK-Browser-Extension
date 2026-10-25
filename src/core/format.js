(function installFormat(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before format helpers.');

  const ATTACK_LABEL = '【ATTACK】';

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function attackLink(href, options = {}) {
    const attributes = [`href="${escapeHtml(href)}"`];
    if (options.target) attributes.push(`target="${escapeHtml(options.target)}"`);
    if (options.rel) attributes.push(`rel="${escapeHtml(options.rel)}"`);
    if (options.className) attributes.push(`class="${escapeHtml(options.className)}"`);
    return `<a ${attributes.join(' ')}>${escapeHtml(options.label || ATTACK_LABEL)}</a>`;
  }

  function normalizeChatHtml(value) {
    // Torn accepts HTML input but may convert it to another internal format.
    // Keep numeric IDs outside link labels to avoid nested square brackets.
    return String(value ?? '').replace(/<a\b([^>]*?)\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
      (_match, before, doubleQuoted, singleQuoted, bare) => `<a${before}href="${String(doubleQuoted ?? singleQuoted ?? bare ?? '').replace(/&(?!(?:[a-z][a-z0-9]+|#\d+|#x[\da-f]+);)/gi, '&amp;').replaceAll('"', '&quot;')}"`)
      .replace(/<a\b([^>]*\bhref="https:\/\/www\.torn\.com\/profiles\.php\?[^">]*"[^>]*)>([^<]*?)\s*(\[\d+\])\s*<\/a>/gi,
        (_match, attributes, name, id) => `<a${attributes}>${name.trim()}</a> ${id}`);
  }

  function finiteEstimate(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function fairFightNumber(value) {
    const score = finiteEstimate(value);
    return score !== null && score >= 1 && score <= 3 ? score : null;
  }

  function fairFightLabel(value) {
    const score = fairFightNumber(value?.fairFight ?? value?.fair_fight);
    if (score === null) return 'N/A — unverified';
    return `${score.toFixed(2)}${value?.fairFightStale || value?.fair_fight_stale ? ' (cached estimate)' : ''}`;
  }

  function errorMessage(error, fallback = 'Unknown error') {
    if (typeof error === 'string' && error.trim()) return error.trim();
    if (error?.message) return String(error.message);
    if (error?.error?.error) return String(error.error.error);
    if (error?.error) return String(error.error);
    return fallback;
  }

  function shortNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value ?? '');

    for (const [size, suffix] of [
      [1e15, 'Q'],
      [1e12, 'T'],
      [1e9, 'B'],
      [1e6, 'M'],
      [1e3, 'K']
    ]) {
      if (Math.abs(number) >= size) {
        return `${Number((number / size).toFixed(2))}${suffix}`;
      }
    }
    return String(number);
  }

  function formatHumanDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  }

  SLINK.define('core', 'format', Object.freeze({
    ATTACK_LABEL,
    attackLink,
    normalizeChatHtml,
    finiteEstimate,
    fairFightLabel,
    fairFightNumber,
    errorMessage,
    escapeHtml,
    formatHumanDuration,
    shortNumber
  }));
})(globalThis);

