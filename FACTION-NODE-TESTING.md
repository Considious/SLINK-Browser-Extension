# Faction Node client preview

Feature branch only. This does not deploy or enable the new Central service routes. Do not treat the preview as ready for existing live users until the separate backend deployment and real Torn/PDA checks are complete.

The new **Faction Rooms** QOL entry is separate from Chat customization and requires the faction's `slink.chat` license. It is off by default. It enables a Rooms button in Torn's bottom chat row. Leaders manage rooms, member access, timed mutes/blocks and links from that window. The extension dashboard exposes the same enable setting. Existing settings are not reset.

Client/state/UI/settings source lives in `src/core/faction-node-*.js`. PDA mirrors these files; `node tools/sync-faction-node.mjs --pda-root <SLINK-PDA folder>` checks them, and `--write` regenerates mirrors. Run the PDA build afterwards. Messages and credentials are not stored in the small view preference; it remembers the last room/management view and whether the window was open. Unsent text remains in the current page only.

## Local checks

- `npm run test:faction-node`: deterministic client and background-service checks.
- `npm run test:faction-node:browser`: headless DOM/scroll/focus test. Install Playwright/browser or provide `SLINK_BROWSER_PACKAGE` and `SLINK_BROWSER_EXECUTABLE` paths.
- `npm run test:faction-node:server`: actual client plus local Worker/SQLite/WebSocket integration. Set `SLINK_NODE_TEST_ROOT` to the Cloudflare repo's `workers/faction-node` package after installing its dependencies. The default path is the adjacent local development mirror.
- Optional `node tests/faction-node-csp.browser.mjs` requires an extension-capable Chromium build and temporary profiles. It checks an actual isolated content script on a page with strict CSP; it is not the same test as injecting UI into a synthetic page.

The ordinary Chrome UI test and real backend/client round-trip passed. The additional isolated-extension probe could not launch Edge in the current restricted environment (browser/crash-handler failure), so **its CSP/origin conclusion is not verified**. That remains an acceptance gate; no policy bypass or background keepalive workaround was added based on an assumption.

Use the single user-facing checklist in the Cloudflare repository's `FACTION-NODE-TESTER-CHANGELOG.md`. Remaining acceptance work includes actual Torn/PDA layout, native WebSocket behavior, customer account deployment, abuse/load/billing, provider media responses and an appropriate terms/privacy review before production.
