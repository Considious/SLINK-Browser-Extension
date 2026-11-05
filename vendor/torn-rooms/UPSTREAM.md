# Torn Rooms UI source

Author: Manuel [3747263] / Manuel Cecchetto
Repository: https://github.com/manuelcecchetto/torn-rooms
Revision: 6dd9f46fa422f4a5da12dfe34465dd87242722e3

MIT-licensed source is retained here with its license. Generated Torn styles/icons are identified by upstream as property of TORN LTD, not covered by Manuel's MIT license; preserve that notice. SLINK uses these only within Torn's chat integration.

SLINK adapts the directory cards, headers, message markup, composer, form controls, icon grid and color picker. The SLINK transport, authentication, permissions, moderation, storage, personal-room quotas and paid grants remain SLINK implementations. No upstream backend, API key handling, polling or database is used.

Rebuild the packaged UI with `node tools/build-room-ui.mjs`. Upstream originals are preserved unchanged; SLINK adaptations live in `src/rooms-ui/`.
