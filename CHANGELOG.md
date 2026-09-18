# SLINK Browser Extension Changelog

This changelog covers the `0.18.x` release series. It focuses on user-visible behavior, reliability, privacy, and compatibility changes.

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
