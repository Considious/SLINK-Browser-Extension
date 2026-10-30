# Saved follow-up — Fair Fight in Torn chat

Deferred by the owner on 29 October 2026 until the public-estimate backup foundation is in place. Not implemented in this backup update.

Offer an optional badge beside native chat sender names and profile links posted in messages. Leave Torn's name/link contents, listeners and mini-profile gestures unchanged. Use SLINK's shared public BSS backup and current authenticated local observer score, not an FF number copied from another account or an outdated community estimate of the observer. Live FFScouter stays primary, local cache then targeted SLINK backup are fallback. Show N/A and source/age honestly when unknown/stale. Existing permission architecture includes admin.*.

Review reference supplied by the owner: Torn FF in chat, version 1, https://greasyfork.org/scripts/583344 . Its idea is useful, but do not copy its background polling, hard-coded class hashes, permanent ffApplied flag, direct sender text replacement, unbounded detached-node arrays, invalid/null `.toFixed()` handling, overlapping requests, or context-free FF cache. No license is stated in the supplied header; confirm reuse permission before copying source and credit the author if adapted.

Implementation should use a chat-root-scoped observer of newly displayed entries, batch/cache duplicate players, bound negative/error retries, clean detached nodes and verify player identity when Torn recycles entries. Extension DOM work only while visible, focused and the active SLINK runner; PDA only while active/visible. No automated mini-profile opening, clicks, gameplay actions or sending. Preserve the retained chat tools/media picker. Actual chat-channel/device fixtures and live acceptance are required.
