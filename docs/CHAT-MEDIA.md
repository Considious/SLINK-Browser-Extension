# Shared chat media picker — Audit Test 35

## Audit Test 36 — actual Torn chat-window entry

Open an ordinary Torn private/faction/company chat and click the **✦** in the header, next to minimize. The retained popup offers Custom buttons / GIFs / Stickers. QOL → Chat stays as the configuration/editor surface. This uses the same media client, settings, attribution, provider sections and manual Copy link → paste → send pipeline; it does not create a second media provider or automatically fill/send a message. No provider request occurs until the user chooses GIFs/Stickers. Settings refresh when opening media, but concurrent edits and the retained search node are not replaced. Closing, backgrounding or switching back to Custom buttons suspends media/search work.

Current Torn IDs from the supplied capture are recognized: numeric private IDs, `faction`, `company`, plus the older faction-/private- IDs. Numeric private chats are no longer mistaken for faction chats merely because their header contains an arrow. Notes and Settings are excluded. Existing custom-template destination scopes are unchanged: faction, private and newsletter; this update does not reinterpret private templates as company messages. Company has the media entry, but no newly invented company-template scope. Global/Trade/Abroad windows were not separately captured/certified. A concrete mismatch can be reviewed without collecting every page again.

The macro renderer now updates only its own sub-container, never replacing the media picker or its input. Activity gating prevents an inactive/revoked extension runner from opening/sending via stale controls; PDA continues using its page-activity generation checks for a pending send. Scoped popup overflow/width keeps all controls reachable on phone/desktop. No unrelated shell/theming/storage change or backend migration. Automated shared-helper checks and four sanitized supplied-header/composer browser cases cover both platform copies at 360/1100px, destination filtering, two-click native send, media copy without autosend, retained drafts through macro updates, viewport bounds and background/resume. Physical PDA/live Torn acceptance remains required.

Quality of Life → Chat uses the existing optional picker, storage keys, chat permission and manual Copy link/paste/send workflow. No new message sender, automatic send, chat-history scraper, observer, cloud service or background poll was added. Existing GIF sharing still copies the GIPHY permalink; stickers copy the provider's usable image URL through the very same selection control. Native Torn/third-party rendering of a pasted image URL must be confirmed by testers; SLINK does not claim to add inline chat rendering in this update.

## Provider adapters

The existing `chat-giphy.js` owns both fetching/parsing adapters, and `chat-giphy-ui.js` owns the same picker. PDA startup add-ons are byte-identical copies, checked by regression tests. No standalone sticker module or duplicate platform implementation.

- GIPHY GIFs retain `/v1/gifs/search` and `/trending`, 12 results, offset pagination and the existing `pg-13` filter.
- GIPHY stickers use `/v1/stickers/search` or `/trending`, 12 results and `rating=g`. Returned order and media query strings are preserved. Transparent WebP/GIF is used instead of MP4 for sticker playback.
- ChatSticker uses `/api/v1/search?q=...` or `/api/v1/top?range=week`, `page` and `limit=12`. Live responses verified the `{data,total,page,limit}` envelope and item fields. Only approved HTTPS ChatSticker/LINE media hosts are accepted. Repeated ChatSticker URLs/permalinks/provider IDs are deduplicated. Its public catalog has no documented equivalent of a GIPHY rating filter; it must not be described as independently guaranteed G-rated.

Both become normalized rows with `id`, `provider`, `type`, `title`, `creator`, `previewUrl`, `imageUrl`, `animated`, `permalink`, `width`, `height` and `shareUrl`. Legacy GIF fields remain for compatibility. ChatSticker uses `animated_url` when actually supplied; otherwise it explicitly reports a still fallback rather than inventing an animation URL. Some providers return APNG which native Torn/other chat scripts may display as a still.

## Approved provider-rule adjustment

GIPHY prohibits mixed-provider grids, cached responses/media URLs and reordering/filtering returned results. The owner approved separate labeled sections in one picker. Sticker requests run in parallel with independent failures; a successful provider is shown normally without raw API errors. Each provider has its own pagination cursor. GIPHY is neither cached nor deduplicated/reordered. No optional All tab was added.

ChatSticker alone has a bounded, three-minute, in-memory cache (20 query/page entries) and duplicate in-flight suppression. It is not persisted or included in backups. Each user/client is throttled below 60 requests/minute; this cannot coordinate unrelated clients sharing an IP, so 429 receives a provider-specific cooldown without key rotation or automatic retries. GIPHY rate limits are independent. Search typing debounces 450 ms, with a minimum 1.1 seconds between searches; stale results are ignored, newest input remains intact and only the latest queued search is issued. No provider request is made merely by mounting Chat settings.

## Configuration and privacy

No new key is required. Existing integrated/user-provided GIPHY modes are preserved. The existing owner-approved public application key was not replaced or newly copied into another module. It is a client-side key, not a server secret. ChatSticker receives no GIPHY/Torn key, no chat contents and no player identifier—only the search query/page. The picker discloses the direct third-party connections. Previews contact the image host; animated content plays on click and stops when inactive. Official Powered by GIPHY artwork and Carol's original-script credit remain visible.

Extension adds only `https://chatsticker.com/*` host access and PDA adds its `@connect` entry. Existing background-service/PDA native HTTP/GM/fetch helpers are reused; no Cloudflare proxy or deployment. Live ChatSticker requests with Torn Origin returned HTTP 200 and `Access-Control-Allow-Origin: *`. Real Torn CSP/native PDA behavior still needs device acceptance.

## Evidence / tester checklist

See the single cumulative `TESTER-CHANGELOG.md`, Candidate 35. Automated adapters cover both endpoints/providers, response normalization, partial failures, cache/expiry, pagination, safe URL validation, animation fallback, disabled/revoked access, no key leakage and preserved GIF behavior. Browser fixtures run both platform copies at 360/1000px for grouping, responsive layout, click playback, copy links, drafts/node identity, debounce, stale responses, independent errors and empty states. Fixture tests do not certify native Torn rendering or a physical PDA.

Sources: [GIPHY endpoints](https://developers.giphy.com/docs/api/endpoint/), [GIPHY integration practices](https://developers.giphy.com/docs/api/#best-practices), [ChatSticker API](https://www.chatsticker.com/developers).
