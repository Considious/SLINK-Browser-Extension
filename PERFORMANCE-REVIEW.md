# Chat performance review — 1 November 2026

PDA and extension main and the faction-room branch receive the same scoped-chat fixes. No faction-room feature is promoted to main.

## Reproduced causes

- Extension FF iterated all tracked senders and measured each visible sender on every chat mutation, even unrelated text updates.
- Extension media rescanned the whole conversation on each message change. This was worse than the already partly scoped PDA renderer.
- Both clients' custom-button discovery searched newly inserted gameplay subtrees outside chat.
- FF duplicate detection compared new links with earlier links. Fixed sender-container slots now use direct lookup. Replacing chat markup could preserve an old badge and add another; stale SLINK badges are now removed from that exact slot.
- Highlight observers searched the page/conversation instead of changed containers. They now stay under chat, batch changed messages, pause when inactive and exclude their own rendering.
- PDA also scheduled market/attack/profile readers from unrelated chat updates. Its gameplay mutation gate now excludes chat and SLINK controls.
- Media retained originals of ordinary text it never modified. Only modified media text is now retained, and URL-free text skips walking. The credited original URL conversion/embedding functions remain in use.

## Browser regression measurements

The fixtures load the actual chat engines, custom-button code and highlight module with 200 rows in headless Chrome. Providers are synthetic; no real API credentials are used. This is not a physical PDA benchmark.

| Workload | Before | After |
| --- | --- | --- |
| Extension: 40 single-message updates | 8,000 text walks; 8,000 sender layout reads | 1 text walk; 0 sender layout reads |
| Either client: 40 unrelated attack updates | 80 chat queries | 0 chat queries |
| PDA: initial text walks, 200 plain messages with highlights | 400 | 200 |
| Replacing markup with 200 existing badges | 400 badges | 200 badges |

GIF rendering, highlights, fixed badges, chat tools, inactive gating and resume/root replacement pass. FF primary/backup/context fences, GIPHY/sticker settings and picker tests pass. Forty-five main-baseline extension regression commands pass, covering lifecycle, settings, dashboard/background services, War, market, racing and storage recovery. PDA native-storage and main regression suites pass; see Torn-Scripts/SLINK-PDA/PERFORMANCE-REVIEW.md for that sweep.

## Preserved and limitations

No storage keys, native PDA bridge protocol, acknowledgement/readback logic, API keys or migrations are changed. No polling is added. Existing FF batching/cache/account fences remain. Rendered media/badges remain during inactivity while observers stop. Extension activity still requires the active focused page; PDA uses visibility/page lifecycle.

The sweep also reviewed theme updates, scheduler/service cadence, Items-only Halloween observation, racing and Xanax mutation filters. Existing guarded/tested paths were not rewritten without a reproduced fault. Animated-image decoding and blur may still impose device-specific GPU/memory costs. Physical users must confirm whether remaining lag is resolved; these fixtures do not prove a universal frame-rate improvement.
