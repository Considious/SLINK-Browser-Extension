# SLINK Browser Extension Changelog

## 0.18.45 — 2026-10-05

### Added

- Added permission-session authenticated rough Fair Fight assignments backed by the Mugging Worker’s existing R2 target intelligence.
- Added one shared-limiter Torn battle-stat request for the requesting player, configurable rough FF range, result limit, cached assignment display, and manual **Find targets** refresh.
- Every assignment is explicitly labeled **Rough FF** with estimate age/confidence. Contributor polling is still disabled until Phase 9.

### Security and efficiency

- The browser never receives the Mugging Worker service token; its existing SLINK permission session is validated server-side against current individual and faction grants.
- Candidate discovery uses cached backend target estimates and does not call FFScouter from the client or auto-copy candidates into Target List.

### Rollback baseline

- The completed permission-gated Mugging UI before rough assignment is preserved at commit `2e1bcb11eb83fa29969d408a7af5db66b4c02662`.
- GitHub backup branch: `backup/pre-mugging-assignments-phase8-2026-10-05`.

## 0.18.44 — 2026-10-05

### Added

- Added the permission-gated **Combat / Mugging** interface. The module is registered only for authenticated sessions carrying the backend-managed `slink.mugging` scope.
- Added a local Mugging enable/disable control, cached-result shell, and explicit **Save Target** handoff into the shared Target List.
- Added an intentionally non-networked Phase 7 boundary: rough Fair Fight assignment and contributor scheduling remain disabled until their dedicated phases.

### Security and permissions

- A refreshed permission snapshot now restarts in-page modules without navigating or reloading Torn, so granting or revoking `slink.mugging` takes effect after the normal **Refresh Permissions** action.
- No test users, faction IDs, or client-side permission overrides are embedded in the extension.

### Rollback baseline

- The completed Stakeout release before Mugging UI is preserved at commit `5928b9d1cd063fe60163d45bae814c321d7b11ba`.
- GitHub backup branch: `backup/pre-mugging-ui-phase7-2026-10-05`.

## 0.18.43 — 2026-10-05

### Added

- Added per-target **Stakeout** monitoring with configurable 10–3600 second evaluation intervals. Active Stakeouts sort to the top and are visually distinguished.
- Added smart Stakeout scheduling that reuses fresh DOM observations, recent cache records, in-flight lookups, and known Hospital/Jail/Travel timers before requesting Torn.
- Added Stakeout status and bounty-change alerts with Profile and Attack links, 5-minute and 1-hour snoozes, and background alert audio through the existing SLINK alert pipeline.
- Added a Torn-page heartbeat so 10-second Stakeouts can be evaluated while Torn is open; the existing background alarm remains a lower-frequency safety pass.
- Added clear API-load estimates and a warning that Stakeout should be used sparingly. Three 10-second Stakeouts are shown as up to 18 evaluations per minute before smart skips.

### Changed

- Stakeout targets are excluded from ordinary rolling Target List polling so they are not scheduled twice.
- Efficiency Alerts now include active Stakeout alerts instead of creating a separate alert interface.

### Rollback baseline

- The completed rolling Target List release before Stakeout is preserved at commit `7df6af3106f43a520f479114422f91182e6a824b`.
- GitHub backup branch: `backup/pre-stakeout-phase6-2026-10-05`.

## 0.18.42 — 2026-10-05

### Added

- Added configurable automatic Target List status checking with an enable/disable switch, a 1–1440 minute rolling cycle, and an option to check only targets tagged **Mug**.
- Added a persistent distributed schedule: targets are spread across the selected interval instead of being requested simultaneously.
- Added polling visibility in Target List, including eligible target count, estimated scheduled checks per minute, last cycle time, and the latest polling error.

### Efficiency

- Every scheduled target still passes through shared player intelligence before an API request. Fresh DOM observations, recent cache entries, unexpired known timers, and concurrent in-flight checks are reused or skipped.
- Automatic checks use the existing shared Torn API limiter at low priority. Manual Target List refresh remains available for every saved target, including non-Mug targets.

### Rollback baseline

- The completed DOM-first release before rolling polling is preserved at commit `f6ce243da15101000b15bbbcef69540c8c9c16a0`.
- GitHub backup branch: `backup/pre-target-polling-phase5-2026-10-05`.

## 0.18.41 — 2026-10-05

### Added

- Added the shared DOM-first player-status collector for deliberately opened Torn profile pages.
- Active, focused profile pages can now contribute reliable status, Hospital/Jail/Travel timers, player identity, and visible bounty totals to the same player-intelligence cache used by API responses.
- Target List profile links register a short-lived observation intent, and manual Target List refresh now checks the currently visible matching profile before considering an API request.
- Player intelligence now records separate last-DOM-observation and last-API-check timestamps.

### Changed

- Bounties now uses the shared profile collector instead of maintaining its own DOM observer.
- Fresh DOM observations and unexpired known timers suppress redundant Torn API status checks.

### Safety

- DOM collection runs only on a visible, focused Torn profile page. It does not scrape attack-result pages or hidden/background pages.

### Rollback baseline

- The completed source-integration release before DOM-first collection is preserved at commit `6acc2c9d058f0ffcd0c668a7fe619617143ab32f`.
- GitHub backup branch: `backup/pre-dom-status-phase4-2026-10-05`.

## 0.18.40 — 2026-10-05

### Added

- Added explicit **Save Target** actions to Leveling, Bounties, the ranked-war target panel, and Outside Targets.
- Source saves reuse the Target List service, preserve source context, merge tags by Torn player ID, and feed already-visible status, timer, Fair Fight, battle-stat estimate, and bounty details into the shared player-intelligence cache.
- No source automatically imports players; every saved target still requires a deliberate button press.

### Rollback baseline

- The completed Target List release before source integrations is preserved at commit `e570eb0a1849713a1a761a24ea9a6da5bd3f1bfb`.
- GitHub backup branch: `backup/pre-target-list-integrations-phase3-2026-10-05`.

## 0.18.39 — 2026-10-05

### Added

- Added the reusable Combat / Target List with explicit manual saving, player-ID deduplication, multiple tags, notes, source metadata, Profile/Attack shortcuts, editing, removal confirmation, and smart manual status refresh.
- Saved targets immediately display shared cached player status, status timers, last checked time, Last Seen Mugged, and bounty totals when those fields are already known.
- Added a reusable Target List service so Mugging, Leveling, War, and Outside Targets can add selected players in the next integration phase without duplicating storage logic.

### Rollback baseline

- The completed shared-intelligence foundation before Target List is preserved at commit `db5a718f382eb379d1e5c0f8050c41d8e2aeed02`.
- GitHub backup branch: `backup/pre-target-list-phase2-2026-10-05`.

## 0.18.38 — 2026-10-04

### Added

- Added the shared player-intelligence foundation used by upcoming Mugging, Target List, and Stakeout work.
- Player status observations now share one persistent cache, one in-flight lookup per player, and known Hospital/Jail/Travel timers that suppress redundant API checks.
- Bounty profile DOM observations now feed the shared intelligence cache instead of a Bounty-only status store.

### Rollback baseline

- The last pre-foundation working release is **0.18.37** at commit `97d7584f20a2164c9056e015a3dc2ed8c1f3eed6`.
- GitHub backup branch: `backup/pre-mugging-foundation-2026-10-04`.

This changelog covers the `0.18.x` release series. It focuses on user-visible behavior, reliability, privacy, and compatibility changes.

## 0.18.37 — 2026-10-04

### Fixed

- Every item shown below its configured filter by the five-second Weaver bulk summary is now expanded immediately through the item-detail API.
- Unchanged listing identities continue to use the existing Market Watch alert and sound deduplication, while Weaver's rolling request cap handles bursts.

## 0.18.36 — 2026-10-04

### Changed

- Weaver's single market-wide lowest-price summary is now refreshed every five seconds while Bazaar watches are active.
- Item-specific Weaver detail requests retain their existing priority cadence and also run immediately when the bulk summary crosses a configured price threshold.

## 0.18.33 — 2026-09-30

### Fixed

- Send to Faction now recognizes Torn’s exact `#faction` chat container and current resizable textarea after the chat redesign.
- A collapsed faction chat now reopens through its current header before SLINK attempts to populate and send the message.

## 0.18.32 — 2026-09-30

### Fixed

- Race and travel alerts now use one lightweight mobility refresh per minute, so finishing a race or landing re-arms the reminder without rerunning the full Efficiency API snapshot.

## 0.18.31 — 2026-09-27

### Changed

- Empty Leveling and Bounty views now explain that Refresh starts or restarts their five-minute activity cycle.

## 0.18.30 — 2026-09-27

### Fixed

- Bounty status scraping now runs only on a profile deliberately opened from the Bounty module. Ordinary profiles and all attack-result pages are ignored.
- Removed the attack-result hospital fallback request that could repeatedly react to Torn DOM changes after Leave, Mug, or Hospitalize.

## 0.18.29 — 2026-09-26

### Fixed

- Faction Chat sharing now selects Torn's exact paper-plane send control instead of clicking the first button near the composer, which could repeatedly scroll chat history without sending.
- All alert types retain the single shared sender, with a one-send lock and confirmation that Torn cleared the composer before reporting success.
- Fixed Market Watch referencing the removed `sent` variable after adopting the shared sender.

## 0.18.26 — 2026-09-26

### Added

- Added a compact Armory TCT (UTC) date/time converter with your device's local time and a copyable relative Discord timestamp. Conversion follows the device timezone, including daylight saving, and needs no API calls.
- Added a separate, persistent 24-hour countdown to Efficiency in the dashboard and Torn panel, with start, restart, and cancel/dismiss controls. Its completion reminder uses the existing visibility and sound settings.
- Added Stack mode to pause both full-energy and energy-refill reminders, including their sounds. A fresh API reading below 150 energy automatically ends Stack mode and evaluates both reminders normally. Stacked or missing energy readings keep it enabled; checks continue at most five minutes apart using the existing API refresh.

### Fixed

- Fixed Retrieve Next staying disabled until the next ten-second War refresh. The button now updates immediately when retrieval finishes, fails, or finds no eligible items.
- Adapted retrieval and pagination from Considious Armory Recaller 1.2.6 while retaining SLINK's interface and shared API access. Includes whitelist skip counts, strict level-15 filtering, and Torn's exact hash-route pagination fallback. Each click retrieves at most one item, with only 50 ms confirmation checks and no added cooldown.
- Background alerts now play through an actual audio element in the offscreen extension document, using generated WAV tones instead of a Web Audio context that could remain suspended while Torn or the dashboard was unfocused.
- The offscreen player keeps audio alive until playback finishes and retries the first message if Chrome has created the document but has not attached its listener yet.
- The **$1 Bazaars** tab now shows exactly one row per seller bazaar and uses Weaver's complete `totalMarketValue` for that bazaar instead of listing each $1 item separately.

### Privacy and API use

- Complete $1 bazaar totals come from Weaver's `/api/dollar-bazaars/bazaars` JSON endpoint. The extension does not scrape Weaver's website.

## 0.18.25 — 2026-09-20

### Fixed

- Efficiency, Market Watch, and War alert sounds now play through a Chrome extension offscreen-audio document instead of depending on a focused Torn or extension-dashboard page.
- Background Efficiency and Market Watch alarms now deliver enabled sounds even when Torn is in another tab, Chrome is showing another page, or the extension dashboard is unfocused.
- Focus and visibility checks remain in place for Torn DOM actions such as quick buying, Armory retrieval, and Faction Chat; they no longer gate audio delivery.

## 0.18.24 — 2026-09-20

### Fixed

- The in-Torn interface now remembers the last selected tab independently for Combat and Efficiency. For example, moving from **Combat → War** to **Efficiency → Market** and back returns to War instead of resetting Combat to Leveling.
- The most recently open section and its selected tab remain restored after Torn page changes and reloads. Existing saved module selection is retained as a backward-compatible fallback.

## 0.18.23 — 2026-09-20

### Added

- Added a fourth **$1 Bazaars** Efficiency tab to both the dedicated extension dashboard and the in-Torn interface.
- The tab uses Weaver's public Dollar Bazaars JSON API, ranks the top 100 listings by total market value, and links directly to each seller's Torn bazaar.
- Results refresh automatically once per hour, can be refreshed manually, and retain the last successful response when Weaver is temporarily unavailable or rate-limited.

### Privacy and API use

- Dollar Bazaar discovery makes one shared API request per refresh and does not scrape Weaver or Torn pages.

## 0.18.22 — 2026-09-19

### Changed

- Market Watch permissions now govern one shared pool of actively searched item slots instead of limiting how many watches may be saved.
- SLINK watches can remain saved but inactive and can be swapped into the active pool without deletion or re-entry.
- Weaver price-list entries are imported as inactive choices and receive individual activation checkboxes; imported prices no longer provide unmetered searches.
- Selecting the same item through both a SLINK watch and the Weaver price list consumes one shared slot while retaining both configured sources and thresholds.

### Added

- The dedicated dashboard now displays active-slot usage, saved-watch state, imported Weaver prices, per-entry activation controls, and a clear-selection action.

## 0.18.21 — 2026-09-19

### Fixed

- Market and Bazaar highlighting now uses the proven ADHD Dashboard listing detection, including Bazaar grid cards and Item Market seller rows whose native Buy button stays disabled until quantity is entered.
- SLINK Buy now remains anchored over the original purchase control through open, maximum-quantity, and confirmation stages instead of moving between Torn buttons or disappearing mid-purchase.
- Regular Efficiency and Market Watch sounds now survive Chrome autoplay blocking and remain pending until Torn receives a user interaction and playback succeeds.

### Added

- Torn-side Efficiency Alerts and Market Watch now include visible sound toggles; Market Watch also has a matching persistent toggle in the dedicated dashboard.

## 0.18.20 — 2026-09-19

### Fixed

- The weekly Google Play Points reminder no longer sends every device to the non-claimable Play website.
- Android now receives a direct Play Store app intent, Windows receives the correct Google Play Games claim path, and iOS clearly explains that claiming requires Android or Windows.
- Every platform retains a link to Google's current official claiming instructions.

## 0.18.19 — 2026-09-19

### Fixed

- Combat once again shows only Leveling, War, and Stats, while Efficiency shows only Alerts, Market, and Merits.
- Explicit hidden-state styling prevents the module button layout from overriding section visibility when all tabs are created during fast startup.

## 0.18.18 — 2026-09-19

### Fixed

- Torn-side module tabs are now created before any module begins loading, so a slow War or Alerts refresh can no longer make later Efficiency tabs appear missing or leave the interface stuck on Combat.
- Modules start independently and report their own loading failures without preventing the remaining tabs from loading.
- Alerts, Market Watch, Merits, and Player Stats render their saved background state first when a Torn page opens instead of treating every page change as a request to repeat due API work.

## 0.18.17 — 2026-09-19

### Added

- Market Watch can now use manually listed SLINK watches, the signed-in player's public Weaver price list, or both, with a configurable source-check order and manual price-list sync.
- Weaver price-list bulk thresholds are honored per seller quantity, while disabled prices and Weaver set pseudo-items are excluded.

### Improved

- Weaver Bazaar monitoring now downloads one all-item marketplace summary, compares it locally with every active SLINK and Weaver target, and requests seller details only for items whose lowest price can qualify.
- Both target sources share each qualifying detail request, avoiding duplicate API calls when the same item appears in both lists.

## 0.18.16 — 2026-09-18

### Fixed

- Armory item rows and their header now use the same fixed seven-column grid, preventing borrowed and available items from wrapping into different layouts.
- Every item row reserves an identical SLINK status/request cell; non-requestable items keep an empty action slot instead of shifting neighboring columns.
- Status, last activity, and the request button have dedicated fixed-height lines, keeping rows uniform while preserving horizontal scrolling on narrower screens.

## 0.18.15 — 2026-09-18

### Fixed

- Market Watch permission tiers can now be refreshed explicitly from both the dedicated dashboard and the in-Torn Market interface.
- A newly assigned or upgraded tier replaces the cached signed permission session immediately; `.10`, `.15`, and higher tiers no longer appear to require a separate `.5` grant.

## 0.18.14 — 2026-09-18

### Fixed

- Mug totals now read Torn's completed green attack-result dialog on `page.php?sid=attack`, so personal mug reporting no longer requires a Full Access API key.
- Only the victim name, victim ID from the attack URL, and stolen amount are recorded locally; no attack-page HTML is retained or sent to a Worker.
- Repeated rendering of the same Torn result is deduplicated, and a later personal/faction API attack is reconciled without counting the mug twice.

## 0.18.13 — 2026-09-18

### Added

- Added theme-independent red notification badges with white numbers and black outlines to the in-Torn module and section tabs.
- Efficiency now rolls up normal reminder and Market Watch deal counts, while each Alerts and Market tab keeps its own count.
- Combat and War now show the combined active retaliation and officer Armory-request count, while the in-Torn Armory subtab shows its own request count.
- Added the same Combat, Efficiency, Alerts, and Market count badges to the dedicated extension dashboard.

## 0.18.12 — 2026-09-18

### Fixed

- Permission assignment is now additive: adding checked permissions never revokes or changes any unselected permission.
- Existing longer-lived and permanent direct grants are never shortened when more access is added.
- Added permanent direct grants with no expiration date.
- Added a confirmed Revoke button to each active direct permission, so revocation is explicit and limited to that one permission.

## 0.18.11 — 2026-09-18

### Added

- Added a local weekly Google Play Points prize reminder to the dashboard and in-Torn Efficiency interface.
- The shared Google Play Points link works from desktop and can hand off to the Play Store on supported Android devices.
- Marking the prize claimed hides the reminder for exactly seven days without making any Torn or SLINK API request.

## 0.18.10 — 2026-09-17

### Fixed

- Restored the Armory Recaller whitelist behavior from the proven standalone v1.2.6 script: Torn-displayed rank hierarchy, name/rank/ID search, 12-hour roster caching, and bulk select or clear of every shown member.
- Added reusable GUI interaction-state preservation so API refreshes retain open sections, typed searches, focus, cursor position, and scroll position instead of collapsing controls under the user.
- Reduced the Armory tab to Armory controls only; War totals, mug reporting, item-request cards, and retaliation cards remain on their relevant War views.
- Suppressed retaliation cards and alerts for members of the current opponent while Termed-war mode is active.

## 0.18.9 — 2026-09-15

### Changed

- Leveling collectors now load one private R2-backed assignment for the full UTC hour instead of querying the D1 scheduling path every five minutes.
- Each collector executes only its frozen share at the Worker's exact due times; collectors that appear after the hourly roster was built wait for the next generation.
- The current five-minute D1 claim route remains as an automatic compatibility fallback while the new Worker and bucket are rolled out.

### Reliability

- Hourly assignments are cached locally until their advertised refresh time and are cleared whenever the signed Leveling session changes.
- Daily freshness checks retain their required Worker submission instead of being incorrectly completed as unchanged local `Okay` results.
- If R2 is missing or temporarily unavailable, Leveling continues with the existing scheduler and exposes the active scheduling mode in runtime diagnostics.

## 0.18.8 — 2026-09-13

### Fixed

- Restored the ADHD Dashboard quick-buy presentation by placing **SLINK Buy** directly over Torn's native cart or Buy control instead of inserting a second button beneath it.
- The replacement control now inherits the native button's exact position and dimensions and follows it while scrolling, resizing, or changing purchase stages, preventing overlap with adjacent Bazaar items.
- Moved five-minute dismissal to individual Market Watch deals in both interfaces. Normal Efficiency alerts retain their existing five-minute and one-hour snooze controls without a redundant third dismissal button.

## [0.18.7](https://github.com/Considious/SLINK-Browser-Extension/commit/e6aa5263c3f7ecf8b1517c34e4db145cd96258d6) — 2026-09-13

### Added

- Added a **Dismiss** button to each Efficiency alert in both the extension dashboard and the in-Torn GUI. Dismissed alerts remain suppressed for five minutes while the existing five-minute and one-hour snooze choices remain available.
- Added an individual **Send to Faction** action beside every Market Watch deal in the in-Torn GUI. Copying a deal arms only its matching send button.

### Fixed

- Restored purchase-page formatting on manually opened Item Market and Bazaar pages instead of requiring a special SLINK result URL.
- API-linked listings are highlighted green, `$1` opportunities remain highlighted, and listings below their Torn city-shop sell price are highlighted pink.
- Expanded listing, item ID, item name, and price detection to support Torn's alternate Item Market and Bazaar layouts.
- Excluded unavailable and blocked listings from profit and quick-buy opportunities.
- Made **SLINK Buy** follow every eligible highlighted listing and use that listing's actual price.

## [0.18.6](https://github.com/Considious/SLINK-Browser-Extension/commit/781e9cd6e5ee1778daad35696f5d82df49c0cb6f) — 2026-09-13

### Fixed

- Added Torn's active `icons` API selection to race detection.
- Treats waiting, scheduled, open, and in-progress races—including **Waiting for a race to start**—as already participating, preventing an incorrect race reminder.
- Corrected the city-item daily baseline to use the final second before the current Torn reset.
- Versioned the city baseline cache so previously stored incorrect same-day baselines are automatically discarded and recalculated.
- Reaching the shared 100-item city purchase cap now suppresses both the general city-item reminder and all individual city-stock alerts.

## [0.18.5](https://github.com/Considious/SLINK-Browser-Extension/commit/0eb5468206a3081aa7cae87a89d9fe027b9031c3) — 2026-09-13

### Changed

- Unified the live API-per-minute display used by the Alerts, Market, dashboard, and Torn GUI views.
- Improved cross-script Torn API accounting by assigning stable identities to imported TornLib requests and deduplicating them in the shared rolling ledger.
- Market Watch now stops issuing additional Torn calls during the same cycle after shared capacity is exhausted and queues the remaining checks for the next available time.

### Fixed

- Prevented duplicated imported API events from falsely filling the shared 60-call allowance.
- Collapsed repeated Market Watch capacity failures into a single summary instead of printing one full error for every watch.
- Constrained long Market Watch error output to a compact scrollable area so it cannot overtake the GUI.
- Kept Weaver checks independent when Torn's API allowance is full.

## [0.18.4](https://github.com/Considious/SLINK-Browser-Extension/commit/925f299dcd2560c07653a76dd0872738a007ca3b) — 2026-09-13

### Added

- Added a local IndexedDB recovery vault for durable SLINK configuration.
- Mirrors API settings, accepted terms, Market Watches, alert settings, themes, UI preferences, and other durable configuration locally.
- Restores missing durable records during extension installation, update, startup, and service-worker initialization.

### Fixed

- Protected the recovery vault from suspicious bulk-removal events so Store-extension settings can be recovered after an update or disable/enable cycle.
- Serialized background initialization to avoid competing startup and installation recovery operations.

## [0.18.3](https://github.com/Considious/SLINK-Browser-Extension/commit/0a70d379ae7aeb5ee00f17ae7f2eb8dd3adc761b) — 2026-09-13

### Added

- Added JSON backup and restore controls for moving local SLINK data between Chrome Store and unpacked builds.
- Backups include API keys, Market Watches, Efficiency settings, themes, and interface preferences, with an explicit warning that exported files contain readable credentials and must remain private.

### Changed

- Rebuilt the in-Torn Player Stats layout as a compact single-column presentation suited to the narrow Torn panel.
- Improved alignment and numeric spacing for 7-day and 30-day consumables, combat activity, networth, working stats, and faction armory balance.
- Removed the horizontal overflow that made Player Stats difficult to read in the Torn GUI.

## [0.18.2](https://github.com/Considious/SLINK-Browser-Extension/commit/c064b40273326b43acf8befdf5a96f240b8f17b2) — 2026-09-12

### Fixed

- Top-aligned the Market Watch editor fields so the Item selector and its helper text no longer pull the Item label above the rest of the form row.

## [0.18.1](https://github.com/Considious/SLINK-Browser-Extension/commit/2a953f7d330608159d8bea4bea7cdee2c9a22cdc) — 2026-09-08

### Added

- Expanded Market Watch permissions from the original tiers to five-slot increments through 40 watches.
- Added Points Market as a combined 30-second API watch.
- Added an automatically loaded searchable item picker that displays Torn item names, IDs, item types, and city-shop sell prices while storing the exact item ID internally.
- Added responsive three-, two-, and one-column watch-card layouts.

### Changed

- Torn Item Market checks now follow the returned global cache timestamp plus Torn's reported delay and one safety second.
- High, normal, and low priorities may use up to 60, 50, and 40 calls respectively from the shared local 60-call rolling ledger.
- Watches with an active qualifying deal temporarily rise to high priority.
- Weaver Bazaar checks now use 35-, 70-, and 140-second priority intervals with an 80-call rolling budget, minimum request spacing, and `Retry-After` backoff.
- Item Market and Weaver Bazaar selectors were grouped more tightly.
- The last selected priority is retained when creating the next watch.

### Fixed

- Editing one watch no longer forces unrelated watches to refresh.
- Removed the need to manually press **Load item list** before using the item picker.

## [0.18.0](https://github.com/Considious/SLINK-Browser-Extension/commit/76037959c9f53c6b1f3b96ad8011af12cb23e29e) — 2026-09-07

### Added

- Introduced permission-tiered **Market Watch** and **Bazaar Watch** tools in the Efficiency dashboard and in-Torn SLINK GUI.
- Added local watch creation for Torn Item Market and Weaver Bazaar sources with configurable target price and priority.
- Added API-matched Torn listing links, green listing highlights, and an optional **SLINK Buy** control that fills the maximum affordable quantity before invoking Torn's native purchase flow.
- Added compact deal-list copying and an explicitly armed faction-chat send action in the Torn GUI.
- Added Torn city-shop sell prices to item choices, deal descriptions, and shared deal text when supplied by the Torn item catalog.

### Privacy and permissions

- Market Watch prices are sourced only from Torn's v2 Item Market API and Weaver's marketplace JSON API; the extension does not scrape Torn pages for listing data.
- Watch configuration, item catalogs, and results remain in local extension storage. SLINK's permission service only authenticates the signed Market Watch tier.
- Added the Weaver API host permission required for API-only Bazaar Watch requests.
