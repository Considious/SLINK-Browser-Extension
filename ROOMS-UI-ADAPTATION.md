# Torn Rooms UI in SLINK

The room selector, tabs, room cards, native message/header/composer structure, forms, icon grid and swatches are adapted from Manuel [3747263] / Manuel Cecchetto's Torn Rooms project, with permission and attribution. Upstream is pinned to `6dd9f46fa422f4a5da12dfe34465dd87242722e3`.

Originals and the MIT license are in `vendor/torn-rooms/`. Generated Torn CSS/SVG files remain the property of TORN LTD, as upstream's license notes. The source comments and generated runtime retain these notices.

SLINK's existing service/client, permissions, quotas, read/write grants, moderation, media delivery and saved preferences remain in use. The UI adapter never imports Manuel's API, login or store. Public discovery/invite features requiring his server are not presented as functioning SLINK features; the selector uses the existing SLINK faction and personal rooms instead.

Adaptations live in `src/rooms-ui/`. `tools/build-room-ui.mjs` bundles them into the existing `src/core/faction-node-ui.js` and PDA addon entry points; there is no extra runtime dependency, remote script load or dynamic evaluation. Supply an installed esbuild module through `SLINK_ESBUILD_PACKAGE` when it is not installed in this package. Use `--check` to verify generated parity.

## Testing

`tests/torn-rooms-ui.browser.mjs` exercises desktop extension and phone-width PDA adapters, room search/tabs, personal creation and limits, icon search, saved colors, left-of-hub placement, Enter to send, minimize/close, sound preferences, retained management drafts, member filtering and server edit payloads. It saves screenshots for visual review. The existing docking test covers native spacing, zoom, delayed chat-bar restoration and unread badge stacking. Worker tests cover appearance validation and ownership with the existing SQLite/Durable Object implementation.

Real-device Torn PDA testing remains necessary; desktop mobile-width tests do not substitute for an iPhone or Android WebView.
