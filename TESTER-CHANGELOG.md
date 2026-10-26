# SLINK tester changelog

This is the single running changelog for the entire audit implementation, covering the extension and PDA. It explains what changed, what to test and how to try to break it. New builds and tester follow-ups will be added here; earlier entries will remain available.

## Approved stable quota hotfix — 26 October 2026

At the owner's explicit request, the storage-quota fix was selectively published to extension **main 0.19.12**, commit **d1da2aa2248e2cc49ea85cbd091f1bb66b3b039f**. No other audit changes were merged. Stable's existing legacy player merge is retained, with migration collision inputs ordered by observation age so an old rollback copy does not replace a newer database observation. This compatibility path passed the same migration/retry unit tests and the real IndexedDB quota-recovery browser fixture against stable sources. Main's original player-intelligence regression and source syntax checks passed too.

The installed Chrome Store extension needs the new package; a GitHub push does not update it immediately. Migration runs automatically when the updated worker starts. Do not clear data or reinstall. Tester Candidate 11 remains available and the remaining audit is not promoted. Candidate 11 notes below describe its original testing-only release before this explicit approval.

## Candidate 11 — 26 October 2026 — Player-cache storage migration (extension only)

Tester extension **0.19.11.3 / Audit Test 11**. PDA stays Candidate 10. This storage change is on the testing branch only; main and the installed Chrome Store extension are not changed by it.

The owner’s storage-size table identifies the player-intelligence entry as the dominant record: **7,546,432 bytes**, versus much smaller War caches. Code review confirms that player observations accumulated indefinitely in one Chrome storage object, rewritten in full for each update. The shared Chrome quota can therefore reject a War write even though War is not the largest consumer.

- Move cached player observations into per-player IndexedDB records, outside Chrome storage.local’s 10 MB budget. No unlimitedStorage permission or arbitrary deletion/eviction of player estimates is introduced.
- Copy existing records and an import receipt in one transaction. Remove the old Chrome copy only after that entire transaction commits and the legacy copy still matches. Interrupted/failed migrations retain the old copy. Failed cleanup can retry without overwriting newer records; a changed rollback-era legacy copy is merged using the existing field-freshness rules.
- Start migration before normal worker initialization writes. Single-player updates then write one record rather than rewriting the multi-megabyte blob. Existing whole-cache consumers still receive a complete map, and normal data freshness/permission/API-budget rules are unchanged.
- Saved targets, notes, own battle stats, API keys, settings, snoozes and theme choices stay in their existing storage locations. No automatic cloud restore, logout or reset. Never uninstall or clear storage to test this.

**What to test:** on a backed-up isolated tester profile, load a realistic existing player cache before startup, then update/start SLINK. In the extension worker console, the old slink.playerIntelligence.cache.v1 entry should disappear only after successful copying; IndexedDB slink-player-intelligence / players should contain the records. War should save its refreshed runtime without the quota error. Check known targets/estimates, saved notes and alert settings, then reload the worker and browser. New observations must not recreate the large Chrome entry. Do not import another backup or edit raw storage while migration is running; raw Chrome writes and IndexedDB are not a single cross-store transaction. Report database errors without deleting either copy.

**Verification:** the full inventory is 74/77 passing; the same three unrelated baseline failures remain. New transaction-fault tests cover a synthetic 7.5 MB cache, exact-content hashes, recovery of a previously rejected War-sized write, per-player writes, persisted reopen, failed observation/queue recovery, interrupted transactions, cleanup failure and a changed legacy copy. A real headless-browser IndexedDB fixture independently passed exact 7.5 MB migration, unchanged settings/targets, quota recovery, new-page persistence, abort after request success and cleanup retry. Final migration safety changes were rechecked by the unit and real-browser fixtures. This is not yet validation on the affected installed extension; tester review/main promotion and Chrome distribution remain separate.

## Candidate 10 — 26 October 2026 — Correct travel forecasts and safer Company alerts

Tester builds: extension **0.19.11.2 / Audit Test 10**, PDA **0.4.109-audit-test10**. This batch is testing-branch-only; stable/main remains the separately approved startup hotfix.

- Corrected Abroad Stocks travel estimates and therefore the suggested departure/reminder times. Private (WLT benefit) and Business Class had been reversed. UK, UAE and Switzerland standard times were outdated. Estimates now use the official Torn Wiki's displayed without-book values for all 11 destinations and four methods, rather than multiplying and rounding differently from Torn. Your chosen travel method and arrival buffer stay saved. Unknown provider countries still have no invented travel time. Book perks and Torn's flight-time variance are not modeled as precise personal ETA promises.
- Fixed a Company alert crash when the current user has no employee entry in the returned roster. Other eligible director alerts and saved snoozes still work. This also protects callers that combine Company alerts with the general alert list.
- Verified the job-point contract in Torn's current OpenAPI: balances are keyed by company TYPE, not the individual company ID. Corrected the test fixture; the production type-based lookup was not changed to an incorrect company-ID lookup. Added coverage for unrelated types and moving between companies of the same type.
- Repaired the War/Outside Save Target integration test to execute actual save handlers. It checks the real IDs, tags, sources and busy-state release. Modernized old import/catalog/Market-markup assertions; the remaining general validator and PDA overlay checks still expose obsolete later assumptions and are not marked fixed.

**What to test:** in Abroad Stocks, compare Mexico across the four travel methods (Standard 24m, airstrip 17m, Private/WLT 12m, Business 7m before your buffer). Check UK, UAE and Switzerland departure times as well. Existing departure watches should use corrected times when reevaluated; no settings reset or manual recreation is required. For Company, confirm a missing roster/self row does not stop the whole Alerts panel, while director reminders and snoozes still work. Save one War and one Outside target and confirm their stored source/tags.

**Automated results:** 73/76 commands pass. Remaining failures: the long background Leveling timing/FF fixture, the general extension Market-flow source-pattern validator, and the PDA overlay source-pattern test. New regressions cover all 44 destination/method combinations on both clients, departure times/buffers/unknown destinations, and missing-self Company alerts. No authenticated Torn session or physical PDA acceptance is claimed.

**502 report:** origin/module/URL/time not supplied, so the failing provider cannot yet be identified. Public Mugging health was inaccessible from the checking tool, not verified down. Cloudflare's documentation says a 502/504 may originate from the origin or Cloudflare; the text alone does not establish overload or a SLINK deployment defect. No speculative worker deployment, secret changes, cache clearing, API-key invalidation or new automatic retries were made. Need the affected module/page and time, with API keys redacted.

Sources checked 26 October: [official travel table](https://wiki.torn.com/wiki/Travel), [Torn OpenAPI](https://www.torn.com/swagger/openapi.json) (UserCompany / UserCompanyPoints), [Cloudflare 502/504 guidance](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-502-504/).

## Extension startup hotfix — 26 October 2026 — Candidate 9 integration

Stable extension **0.19.11** and tester extension **0.19.11.1 / Audit Test 9** contain the same focused startup fix. PDA remains Candidate 8 and is unchanged. This main release is explicitly authorized by the owner; unrelated audit code is not promoted.

- SLINK restores its saved layout and theme from local storage before showing the panel, instead of appearing on the wrong side in the default theme first.
- A slow theme service or page-registration message no longer holds up the cached interface and module startup. Live theme refresh still happens separately; API-data freshness rules are unchanged.
- Reading the same permissions no longer creates a new permission change. Renewing timestamps without changing grants does not restart all modules. Real grants, revocations, expired products and active-page ownership still apply.
- There is no settings reset, extra login, lazy module download, new storage schema or theme-asset change. A full Torn navigation still creates a new content script, but it can reuse the existing extension data immediately rather than waiting on the theme network path.

**What to test:** resize and move SLINK to the left, choose a theme and Alerts/Market/another module, then navigate between Torn pages and refresh. It should first appear in the saved location/size/theme, with the saved tab restored as modules mount. Try a slow/offline theme service: cached startup must still work. Switch tabs/windows: only the eligible Torn page should work actively. Leave an editor open during a routine permission renewal; it should not close or reset. A real permission removal should still remove access.

**Verification:** new executable startup tests pass on stable and tester sources, including stalled theme/registration requests, batched local UI reads, permission write deduplication, real grant changes/expiry and worker suspension. A headless synthetic browser fixture passed two fresh navigations on each source line: every sampled visible frame had the saved theme identity, left position and width, while cached module content appeared despite permanently stalled theme/registration requests. The first fixture failures were missing local dependencies and an incomplete synthetic live-theme catalog/activity mock, corrected without relaxing production behavior. This is not an authenticated Torn session or a measured ten-second production speed claim. Existing focused activity, permissions, theme and form-commit checks pass; earlier baseline failures remain open.

## Candidate 8 — 26 October 2026 — Fewer redundant Market Watch requests

Tester builds: extension **0.19.10.6 / Audit Test 8** and PDA **0.4.108-audit-test8**. Testing branches only; no main, worker deployment, settings migration, credentials, or theme changes.

- Fixed a confirmed efficiency problem in both clients: editing or adding one Market Watch item no longer fetches Weaver details again for unrelated items whose next check is not due. Normal due checks still run. An explicit Refresh still refreshes all active targets. A manual watch and pricelist watch for the same item still share one detail request. Failed checks keep their retry delay.
- Repaired another six original failing test scripts: PDA Armory, reminders, module activity, Market DOM and Travel Safety, plus the extension permission sweep. These now test actual runtime functions and registered module gates. PDA checks deliberately allow visible WebViews reporting hasFocus=false and stop after visibility/pagehide suspension. Armory retrieval stays user-triggered, double-click protected, and subject to whitelist/rank/level checks.
- Background test discovery now dispatches through all registered listeners, joins initialization, supplies required crypto support, uses the actual storage namespace, and expects inactive Market polling to be paused. It exposes the redundant Weaver request defect above. This long combined fixture is **not green**: later Leveling/Fair Fight checks still need investigation with controlled time/budget fixtures. Its timeout is recorded, not hidden.

**What to test:** save two Market Watch items, change the price of only one, and confirm the other watch retains its cached result until its next normal check. Use Refresh and confirm current results still load. Check a selected Weaver pricelist item, then an item shared with a manual watch. Let normal monitoring continue; do not test by clearing settings or corrupting caches. On PDA, try one armory recall while visible, then background the app before confirming; it must not continue clicking in the background. Confirm stacking and snoozed reminders still behave normally.

**Automated results:** 66/72 test/build commands passed (previously 58/70). Six original failures remain: extension Abroad Stocks, background, Company, Target List integration, general validation; PDA overlay. New due-time regressions pass on both clients. No claim of measured production speed improvement, live-provider acceptance, physical Android testing, or completion of the remaining storage/lifecycle audit.

## Candidate 7 — 26 October 2026 — Cleaner Mugging panel and more reliable test checks

Tester builds: extension **0.19.10.5 / Audit Test 7** and PDA **0.4.107-audit-test7**. This batch stays on `audit/test-foundation`; it does not change main or live worker settings.

- Mugging now keeps only Last sync from the long contributor explanation. No API-budget commentary, upload-cadence text, pending-count block, or internal retry details in that paragraph. Before the first successful sync, there is no empty box. Contribution still works the same way.
- Repaired six previously failing test scripts: extension Core, Mugging and Travel Safety; PDA Mugging, Racing and timestamp conversion. They now inspect the real code and compare current versions instead of demanding historical version numbers. Permission checks follow backend-granted admin.* access without a hard-coded owner; chat expectations keep player IDs outside the profile hyperlink. The Shoplifting alert fixture supplies the catalog/completion information the current alert logic requires.
- Added reusable manifest-based PDA test discovery and a regression for it. Updated three existing PDA tests and the tester-channel test so future tester version bumps do not fail their historical version assumptions. No gameplay formulas, API keys, saved settings or theme assets changed.

**What to test:** open Mugging in Torn, the extension dashboard and PDA. Confirm the former technical paragraph is gone, Last sync appears after successful reporting, and enabling/disabling Mugging or finding targets still works. Reopen SLINK and navigate Torn pages; settings, your selected tab, drafts and cached battle stats should behave as before. Continue the earlier combined test checklist below.

**Automated result:** 58/70 test/build commands passed, up from 51/69. Six of the 18 baseline failures are repaired; 12 remain listed in docs/audit/BASELINE.md. Those remaining failures are not silently skipped or claimed fixed. Real Android/PDA and live Torn acceptance are still tester work; this test-maintenance batch does not establish native-storage safety or complete the audit.

## Mugging interface cleanup request — included in Candidate 7

Remove the contributor implementation explanation, API-budget details, inactivity rules, upload cadence, pending count, and retry diagnostics from the normal Mugging interface on extension and PDA. Keep only "Last sync" and its time when a successful sync exists. Do not show an empty placeholder before the first sync. Internal diagnostics and contributor behavior stay unchanged.

Test: open Mugging on both clients and the extension dashboard; confirm only the last-sync line remains from that paragraph, no blank block appears before the first sync, and uploads still work. Included in Candidate 7, not pushed to main.

## Urgent Mugging-only release to main — 25 October 2026

At the owner's explicit request, the Mugging reliability changes were released separately from the audit work: extension **0.19.10** (825f733bd69b44fe1671eb8c4e08edc330bf609c), PDA **0.4.104** (8656cad32609565de81f571c540928f3024f96b8), and worker **0.6.2-client-report-safety** (f8581131f63b02173fdf5d51395fb95f1781bd52). All three source releases are on their respective main branches. Cloudflare activation and Chrome Store distribution are not established by these commits.

What to test: enable Mugging, allow checks to accumulate, and confirm queued reports upload about five minutes apart while the client is running. During a temporary worker failure, reports should remain pending and retry after one to five minutes. Reopen SLINK and change Torn pages; saved settings and cached personal battle stats should remain intact. Unknown target stats must not become zero estimates. Where supplied by the worker, pool explanations should distinguish missing estimates, timed unavailability, mug cooldowns, and Fair Fight range exclusions.

Only this urgent fix was promoted. The other audit changes remain on testing branches. Candidate 6 notes below describe the original candidate state before this release.

## Candidate 6 — 25 October 2026 — Mugging client-report reliability

Testing builds: extension **0.19.10.4 / 0.19.10 Audit Test 6**, PDA **0.4.106-audit-test6**, on the existing audit/test-foundation installation links. Worker source candidate **0.6.2-client-report-safety-test** is on the separate SLINK-Cloudflare-Services branch **audit/mugging-reliability**. Main branches and the production worker are unchanged.

IMPORTANT: installing a tester client does not deploy the backend patch. New backend exclusion counters, health telemetry, server protection against old clients and retry behavior require a separately approved worker deployment. Do not clear saved data, reactivate donated keys or run a production recovery job to test this candidate.

### Keep valid estimates instead of replacing them with zero

Both clients now send an unknown/zero/invalid estimate as unknown, not a real zero. The worker candidate also rejects zero estimates from older clients. It preserves the estimate's original observation time: checking a player's status does not make an old stat estimate fresh. A legacy estimate with no stat timestamp cannot replace an existing positive estimate. These changes protect the target state and the FF metadata shard.

1. In an isolated tester installation, note a known target estimate. Allow ordinary status checks and a normal acknowledged report batch. The target must not lose its estimate merely because a status response contains no battle stats.
2. Close/reopen SLINK and refresh Torn. Settings, API keys, target lists, FF filters and snoozes must remain unchanged.
3. Recheck the shared own-battle-stat tests from Candidate 4. This patch concerns target estimates; it must not replace your own authenticated battle stats or change the FF formula/ceiling.

### Share reports sooner, with bounded retries

While the client is running, successful report batches now run about every five minutes instead of six hours. Temporary failures retain unacknowledged work and retry after one minute, backing off to at most five minutes. Empty queues do not upload or pretend a new delivery succeeded. The existing Torn API call budget/interactive reserve and report queue/batch limits remain unchanged. More frequent report uploads do increase Worker/R2 activity; no live quota validation is claimed.

1. With Mugging enabled and a valid session, observe Pending and Last sync through a normal batch. Pending should decrease only after acknowledgement.
2. If a real temporary connection failure occurs, Pending must remain and Sync retry pending must explain the problem. After recovery, batches should resume without waiting six hours.
3. Switching pages or briefly backgrounding PDA must not reset settings. PDA cannot be expected to run checks while its app/runtime is suspended.
4. Developer-only tests simulate delayed acknowledgements and newer observations for the same player; the older acknowledgement must not delete the newer report. Ordinary testers should not alter queues or expose credentials.

### Worker-side changes and diagnostics (deployment gated)

- Failed, missing and unusable FF responses remain pending. Retries respect the existing 25-target / ten-minute global limit; a failed attempt is not a successful 14-day refresh. Failed IDs rotate behind other pending work.
- Client status reports now use the existing mug-transition/cooldown rules without donated Torn keys. First observations and repeated identical hospital states must not create new mug events.
- Health separates accepted client-report counts/times from donated-key collector capacity and indicates whether an FF secret is configured. Counts start with the new instrumentation, not historical activity; accepted reports are not a count of unique active clients.
- Estimate coverage reports how many state shards have new counters. Partial coverage is not a full-pool audit.
- Find targets responses include exclusion counts. When supplied by the worker candidate, extension/PDA show a compact summary for missing estimates, hospital/jail timers, post-mug cooldowns and your FF range. Old workers omit it rather than displaying invented zeros.

Test these server behaviors only in an approved test environment after deploying the candidate there. The production health version remains 0.6.1 until an explicit deployment occurs.

Developer validation: **22 worker tests pass**. Both client report-safety tests cover unknown estimates, original stat timestamps, acknowledgement preservation, five-minute batching, one-minute retry and empty queues. All **26 focused commands** pass. Full client inventory: **51/69 scripts pass**, retaining the same 18 documented baseline failures. Synthetic Edge checks pass the Mugging summary at 390/1100px; no physical PDA or live provider behavior was claimed. A dated authenticated worker fixture was corrected to use a recent timestamp because its intentional observation-age clamp made the old October 6 fixture expire.

Limits and next work: no automatic reconstruction of already-zeroed records and no mass requeue of legacy lost work. Recovery needs a separate, evidence-based plan. Clients still do not replace company catalog/discovery; FF fetching remains server-side and is independent of donated Torn capacity. This batch does not finish the broader audit or close the remaining native-storage tasks. Keep the earlier test checklist, and report build/platform/steps without keys or tokens.

## Candidate 5 — 25 October 2026 — dashboard parity, awaiting combined tester review

Extension **0.19.10.3 / 0.19.10 Audit Test 5** on the same testing branch. PDA stays at **0.4.105-audit-test4**: this batch changes the standalone extension dashboard and its shared extension presenters, not the PDA launcher. Main and the Chrome Store release are unchanged. Test this newest extension together with the earlier entries below.

### Dashboard combat tools

Combat now has Leveling & War (the original overview), Bounties, Mugging and Target List. The added views use the same modules/services as the Torn panel rather than independently copied forms. Existing permissions apply, including admin override and inherited faction scopes. Only the selected permitted dashboard module runs; leaving its view, hiding the dashboard or losing access stops its presentation loops. This does not disable configured background alerts or contribution services.

1. Open the extension dashboard with the appropriate permissions. Verify each permitted Combat view appears, and denied views do not.
2. In Target List, add a harmless sample target, edit its tags/notes, try Refresh, toggle a stakeout, open polling settings and remove only the sample when finished. A failed save must keep the entered values.
3. Leave a Target List edit open, switch to Mugging, then back. The edit must remain. Explicit Cancel must discard it. Recheck the earlier delayed/failed-save tests.
4. In Mugging, check enable/filters/count, Find targets, your own stats and Save Target. In Bounties, check filters/settings, results, restart and Save Target. Live searches still need valid feature access/credentials.
5. Leveling, War and outside-target cards now have Save Target. Check the saved list has the expected name, Level/War tag and source, with no duplicates from repeated updates.
6. Profile and attack links should open Torn separately, leaving the dashboard usable. Target Refresh uses the background service, not a scrape of the dashboard.

### Chat settings and native-page handoffs

QoL now includes Chat on the dashboard: configure highlighted terms/colors and custom message button labels, messages, destinations and enabled state. Sending remains your action in Torn chat.

1. Open Torn with Chat access once to import existing custom buttons. Then open dashboard QoL > Chat. Your old buttons should be present; their original local copy is not cleared.
2. Add a harmless test macro and highlight term. Save, reopen Chat and refresh the dashboard. Verify labels, quoted links, message text, destination, color and enabled state survive.
3. Edit macros in the dashboard and Torn editor at the same time. A stale save must explain the conflict and retain its draft, not overwrite newer accepted settings. Copy any unsaved draft before reopening after a conflict.
4. Remove the test macro and reload Torn. The one-time import must not resurrect the deleted button. Do not clear application data to test migration.
5. In a director's Company view, the dashboard offers Copy reminder, Message and Open profile/chat instead of pretending it can fill/send a nonexistent native chat. Actual fill/send controls remain on Torn.
6. Officers > Open Armory Recaller should open Torn's faction armory with the existing War Armory subtab requested. Actual recalling remains a deliberate Torn-page action.

### Navigation and nearby regression checks

Choose an existing main page and a subview, reload/reopen the dashboard and verify it restores both. Opening the dashboard without requesting a specific destination must not force Combat or QoL. Switch rapidly, use two dashboard tabs, revoke/regrant access where safe, and recheck existing Torn panel behavior. Saved settings, keys, themes and supplied image assets must remain intact. No automatic cloud restore or permission migration is included.

Developer validation: **49/67 scripts pass**, with the same **18 documented baseline failures**; all focused checks pass, including the new real-host/macro tests. A synthetic headless Edge fixture exercises actual dashboard HTML/CSS/modules at **390px and 1100px**, target draft retention/refresh, Chat editing, Company/Recaller handoffs and denied access. Its service replies are mocked; it does not prove live Torn API behavior or physical PDA persistence.

Known limits: original source-specific profile-scraping intent is not carried from the extension origin into the newly opened Torn tab; use the normal Refresh action for dashboard target updates. Live scans, faction/officer operations and full War action-by-action parity still need tester acceptance. Earlier lifecycle/native-storage tasks remain open. See docs/audit/DASHBOARD-PARITY.md for the implemented/delegated/unresolved inventory. This is not a full-audit completion claim.

Try to break it: rapid view changes during slow responses; newer typing during Save; Cancel and reopen; two editors saving different revisions; repeated open/close; denied versus exact-grant versus admin accounts; narrow windows. Report build, platform, steps and expected/actual behavior, without API keys or tokens.

## Candidate 4 — 25 October 2026 — shared data providers

Builds: extension **0.19.10.2 / 0.19.10 Audit Test 4**, PDA **0.4.105-audit-test4**. Install the newest build using the same testing-branch links below; earlier candidates' checks remain part of this combined test. Main is unchanged.

### Your own battle stats — reuse the newest authenticated record

Leveling and Mugging on the extension now use one personal-stat provider. PDA Mugging uses the identical provider code through its native runtime adapter. It stores the four raw stat components, their total, authenticated player ID, level, source and times. Leveling still uses its original distribution-dependent score; it is not guessed from a legacy total or FFScouter's community estimates. Compatible requests share a request; a forced refresh cannot be overwritten by an earlier request arriving late. Different API credentials are kept separate until validated; using two different keys for one player may still cause separate fetches. No key is stored in the provider cache.

Test:
1. Refresh your own battle stats in Mugging. Note the total and time. Close/reopen SLINK, change Torn pages and reload. The last confirmed record must not revert to the old Mugging result.
2. On the extension, visit Leveling after refreshing Mugging with the same Torn key configured. It should reuse compatible fresh raw stats, without changing the Fair Fight formula.
3. Refresh again during a slow connection, then switch pages. Older responses must not replace the newer result. Developer tests deliberately reverse response order; ordinary testers need not edit storage.
4. If you use separate test accounts, switch through normal authentication. The canonical provider must not reuse account A's record for account B. A missing/failed response must not invent zero battle stats. Do not share API keys or recordings containing them.

### One item catalog, separate live observations

Market Watch, Museums, Abroad Stocks landing recommendations and Money now share the compatible full Torn item catalog rather than fetching independent copies. Metadata and price ages are tracked separately. Explicit zero prices remain zero; omitted prices keep their previous value and original age, or remain unavailable. Requests that need fresh prices report an incomplete response instead of pretending old/unknown values are current. Private inventory, YATA/Prometheus/Intel observations and actual market listings are still separate.

Test:
1. Open each of those four modules in turn. Existing item names, museum valuations, stock payouts and landing recommendations should continue working.
2. Use normal Refresh controls. Check that refreshing catalog data does not reset Museum inventory, supplier stock timestamps, watch settings or entered amounts.
3. Return to Money after viewing Abroad Stocks. Market prices should be usable without changing bank-rate caching or investment calculations.
4. During an API failure, good saved data must not be replaced by an empty catalog or false zero prices. Developer tests cover partial/missing data, coalescing and write failure/recovery.

### Target intelligence — each kind of information has its own age

Status, name, level, battle-stat estimate, Fair Fight and bounty observations now carry independent source/time metadata on both clients. Newer hospital status no longer makes an old estimate look newly checked. Older observations cannot replace newer values in the same field; a missing bounty field is not an authoritative zero. Shared contributor reports send raw target estimates, not an unbound Fair Fight value calculated for someone else. Unbound shared FF is shown as unknown rather than reused for the wrong observer; existing feature-owned FF retrieval/fallback remains in place.

Test:
1. Refresh target status from profiles/War/Targets and confirm known estimates are retained without their estimate date becoming the status-check date.
2. Check bounty count/value after new observations. A confirmed zero may clear an old bounty; a response lacking bounty information must not.
3. With FF unavailable, repeat the earlier War/Bounties/Leveling outage checks. Targets must still load; unavailable estimates must remain N/A rather than false certainty.

Regression checks: saved alerts/snoozes, checkbox independence, open editors, last page/size, themes and all earlier candidate checks. No UI redesign, theme asset, permission grant, terms or automatic cloud recovery change is included.

Developer validation: **48/66 scripts pass; the same 18 classified baseline failures remain**. All **23 focused commands** pass. New executable tests cover both runtimes' provider contract and target field freshness; Money tests exercise the actual provider integration; startup checks load every PDA fragment/add-on from one immutable revision. No live authenticated Torn API or physical PDA session was used.

Limits: this is the selective provider batch, not completion of the full audit. Earlier native-storage acknowledgement/cross-WebView guarantees and remaining editor/lifecycle/dashboard work are still open. PDA preserves the existing dedicated own-stat key and adds provider metadata; it does not promise stronger native write durability. Legacy total-only records are not accepted as canonical score/identity data. Existing feature-owned FF caches are not globally replaced or reformulated.

## Candidate 3 — 25 October 2026 — awaiting combined tester review

Builds: extension **0.19.10.1 / 0.19.10 Audit Test 3**, PDA **0.4.104-audit-test3**. Use the same `audit/test-foundation` install links. This candidate combines candidates 1/2 with both main hotfixes (working profile/【ATTACK】 links and FF outage fallback), then adds the form work below. Install only this newest candidate and work through all entries in this document; earlier versions do not need separate installations. Main was not changed for this batch. Keep the stable PDA copy disabled and use an isolated Chrome test profile as described in TESTING.md.

### Target List — failed saves and late responses must not erase your edits

What changed: both clients now have a shared explicit draft acknowledgement API. Target List uses it rather than clearing its protected fields just because a button says Save or Cancel. On the extension, a successful save releases only the draft version it actually saved; typing after Save is protected from that earlier response. Its open editor/polling selection also stays in memory across worker pause/resume instead of closing merely because another tab became active. Explicit cancellation and deleting the target being edited release that editor. Target polling edits are separate from the target editor. Auto-saved model controls can opt out of draft restoration; the extension alert-sound checkbox uses this so an old draft cannot override the acknowledged setting.

How to test:

1. Use a harmless sample target (your own profile ID is suitable). Open Add target and type a name/notes, choose tags and a checkbox, then leave the form open through a normal background update. Your input, focus/caret and selected controls must remain unchanged.
2. Enter an invalid ID and press Add target. A validation/save failure must retain the notes and other edits. Correct the ID and save again; the target should be saved without re-entering the form.
3. On the extension, if you can reproduce a slow save, type more notes after pressing Save. The earlier response must not close the new draft or replace its text. Saving those newer edits should update the target already added rather than create another copy. Developer tests inject the delay; ordinary testers need not corrupt storage or expose API keys.
4. After an ordinary successful save, reopen Add target. The old target's notes/tags must not reappear as a new draft.
5. Change notes, explicitly Cancel, and reopen the form. The cancelled changes must be gone. Open Edit for another target and verify the previous target's draft does not bleed into it.
6. While editing one target, remove a different target. Your active editor should remain intact. Removing the target currently being edited should close/release that editor, not resurrect it later.
7. Keep Target polling settings open alongside Add target where available. Saving/cancelling the target must not silently clear polling edits. In the extension, change polling values while a configure request is pending if practical; newer values must remain editable after the older acknowledgement.
8. In Alerts, check the Play alert sounds control, use the normal settings actions, and revisit. Its visible state should follow the saved model, not a stale checkbox snapshot. Recheck medical snoozes and alert counts as existing regression checks.

### Core field protection — less interference during harmless updates

Text-only updates such as countdowns no longer trigger a full extension draft reapply. Both clients also capture the field before deferring focus-out work: a real Shadow DOM browser fixture exposed an event.target-null exception, now fixed on both. Check moving between fields and buttons, opening/closing SLINK, expanded sections and normal last-tab/size behavior. No layout/theme redesign, stored-data reset or storage-key/schema change is included.

Try to break it: fast edits, repeated Save, failed validation, opening another target, cancelling during a delayed extension save, periodic updates, page refresh after a confirmed save and switching among test tabs/windows. Newer drafts should not be discarded or mixed between records. Unsaved drafts are protected from rendering, NOT newly promised to survive a full navigation or app termination.

Developer validation: **46/64 script checks passed, with the same 18 classified baseline failures.** Shared contract regressions pass for both clients (late/failed saves, per-field normalized acknowledgement, cancel, caret, expanded details, auto-saved controls and text-only updates). Actual Target List rendering in headless Edge passed periodic replacement, delayed saves with newer typing, failure retention, update-versus-add, cancellation and worker-pause draft retention. The actual PDA guard also passed native browser Shadow DOM transitions. The first browser fixtures exposed their own reserved-window.status/incomplete-target-data mistakes; corrected those fixtures and asserted no hidden page errors. Physical Android/native storage was not simulated.

Important limits: other editors still use their existing compatibility behavior until explicitly migrated. This does NOT mark the complete form/persistence phase finished. PDA Target List acknowledgement here means its existing synchronous local model accepted the edit; native-storage transactions, cross-WebView durability and target tombstone migration remain separate work. Automatic cloud restore was not added. The 18 previously classified baseline script failures remain visible; this is not a full-suite-green claim.

## Candidate 2 — 25 October 2026 — awaiting combined tester review
 
Latest stable hotfix, published 25 October 2026: extension **0.19.09** (`3c372be8c31461ec0cb833e5b0ce199019176001`) and PDA **0.4.103** (`5d1deed8f3deacc72de18717f69573c04650ec82`). The owner explicitly authorized ONLY hyperlinks and FF outage handling for main. No other audit changes were promoted. Candidate 2 predates this hotfix; integrate it into the tester branches before continuing the audit.

Hotfix test additions: send a retaliation callout using SLINK Copy/Send and a custom macro. Confirm the clickable name has `[ID]` outside it and the second link reads 【ATTACK】, including after refreshing chat. Quoted/unquoted inputs should normalize consistently without double-encoding ampersands. The owner already confirmed the proposed exact message format live. For FF, keep War open during a provider outage: roster, status, retals and manual controls should remain usable, known cached scores should be marked cached, and unknown scores should show N/A/unverified rather than zero. FF-unknown War rows are visible but not certified as within the chosen FF range. Existing Bounty unknown-estimate preferences remain respected; an outage must not abort the underlying scan. Verify Leveling still returns available recommendations. Repeat after provider recovery. Developer-only timeout/rate-limit/partial-response/failure-injection tests pass for extension and PDA; real live-outage incidence is not claimed. No credentials, settings keys or saved-data schema were changed. GitHub main publication is not a Chrome Web Store installation/update.

Builds: extension **0.19.9.2 / 0.19.09 Audit Test 2**, PDA **0.4.102-audit-test2**. This candidate includes candidate 1. Use the same tester branch and installation links below; stable/main remain unchanged. Once published, testers can install just this newest candidate and work through ALL entries in this file together. Earlier candidate numbers describe when each change was introduced; do not install older candidates to run their checks.

### One active extension page; PDA pauses page readers when hidden

What changed: Chrome, not a page's own claim, decides which Torn page may run page-reading helpers. Switching focus away immediately invalidates its workers, including during a slow startup. The panel stays mounted while workers stop. Standalone chat discovery, profile readers and Xanax decoration now follow the activity adapter. PDA uses visibility and pagehide/pageshow, not desktop focus, for these readers, Racing, Market and the basket helper. Background API alert schedules are separate and were not disabled.

How to test:

1. Open Torn in two Chrome tabs, then two Chrome windows. Switch between them rapidly. SLINK should remain usable on the focused Torn page; inactive pages must not continue scraping. There must not be repeated panel removal/recreation merely from switching focus.
2. Focus a non-Torn tab, another app, or minimize Chrome, then return. Cached panels should remain available and helpers should resume on the current page.
3. Refresh Torn, switch tabs before SLINK finishes loading, then return. You must not get stuck with workers permanently paused, duplicate labels or duplicate actions.
4. In PDA, background the app or switch its page, then return. Check Racing, basket recommendations, profile status, Market buy highlighting and custom chat buttons. A visible PDA page must not need desktop-style focus to work.
5. Confirm the normal background alert/sound behavior is unchanged. Do not interpret a legitimate scheduled API alert as proof of an inactive-page DOM scrape.

Try to break it: rapid tab/window switching while loading, closing the active tab, opening a non-Torn page in the active tab, background/resume, and browser Back/Forward navigation. Developer-only: restart the extension service worker and inspect DOM reader activity; only the focused Torn page may resume. A physical PDA device is still needed to confirm its lifecycle signals.

Watch for: a frozen panel, helpers never resuming, activity in the wrong window, lost selected tab/size/scroll/draft, or repeated API calls/notifications. No API-budget limit or notification-policy change is intended.

### One click stays one action after repeated switching

What changed: retained Racing, Events, Company, Museums, Money and Leveling root handlers now have a shared disposal mechanism. An invalidated module cannot use its UI adapter to redraw after a late response. Cleanup of one broken module no longer prevents cleanup of the rest. A pending Racing nickname/build save is flushed rather than discarded when workers pause.

How to test:

1. Open each listed module, switch to another Torn tab and back at least five times.
2. Use a harmless sample build or small setting. One click should perform exactly one action—not toggle twice, issue repeated saves, or select several options.
3. Edit a Racing nickname and immediately switch away or refresh after saving. Return and verify the value and completion state.
4. Start a refresh and switch away immediately. Returning must not let an old response overwrite the current module instance.

Try to break it: repeated open/close, rapid focus changes, a refresh on a slow connection, and editing immediately before switching. Keep real targets and important settings backed up; do not deliberately corrupt storage.

### Extension alert and Mugging saves cannot overwrite unrelated newer edits

What changed: alert settings, snoozes, city acknowledgements, reminders and automatic crime-completion/Stack-mode changes now read and modify the latest settings in one recoverable background queue. Mugging enable/filter writes from both extension surfaces use background patch saves instead of replacing a full local snapshot. Unknown saved Mugging fields are preserved. This is the first settings-integrity batch, NOT the entire persistence overhaul; PDA target-record migration and the shared form-draft redesign are still pending.

How to test:

1. In a test profile, open SLINK's Torn panel and standalone extension dashboard. Change different alert settings quickly across the two surfaces. Reload both and verify both changes remain.
2. Snooze a medical alert while changing another alert setting. Refresh Torn: the snooze and unrelated setting should both remain. Mark the city purchases done and start/cancel the 24-hour timer; those must not undo other settings.
3. Change Mugging filters in the Torn panel while enabling/disabling Mugging from the dashboard. Reload and verify the filter changes and final enable choice survive independently.
4. Confirm alert totals, checkbox values and actual alerts agree. Any mismatch remains a failure, even though the broader form-draft repair is not part of this candidate.

Try to break it: rapid disjoint setting changes from two surfaces, reload immediately after an acknowledged save, and repeat a change after a temporary failed save. Developer-only failure injection confirms a rejected write does not poison later writes. No cloud restore, settings reset, credential change or saved-data schema migration was added.

Developer validation: full inventory **42/60 scripts passed**, with the same **18 classified baseline failures** as candidate 1. New arbitration, content-transition, lifecycle, settings-queue and PDA visibility tests pass. A real headless Edge fixture also passed repeated Racing suspend/resume, one-action-per-click, native list replacement and no automatic scrolling. These are not live authenticated Torn or physical Android results.

Remaining work: broader lifecycle/container coverage, PDA durable target storage, explicit draft/acknowledgement semantics, shared data providers, dashboard parity and startup cache/performance work. Nothing in this entry marks those phases complete. Report candidate version, platform, steps, expected/actual result and screenshots if useful; never include keys or tokens.

## Candidate 1 — 24 October 2026 — awaiting tester review

Builds: extension **0.19.9.1 / 0.19.09 Audit Test 1** and PDA **0.4.101-audit-test1**. Both use the `audit/test-foundation` branch. These are early audit test builds, not stable updates. Main and the stable PDA download links are unchanged.

- [Extension download and install instructions](https://github.com/Considious/SLINK-Browser-Extension/blob/audit/test-foundation/TESTING.md)
- [PDA install instructions](https://github.com/Considious/Torn-Scripts/blob/audit/test-foundation/SLINK-PDA/TESTING.md)
- [Install PDA tester script](https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js)

Use a separate Chrome profile for the unpacked extension. In PDA, disable the stable script before enabling the tester script. Keep a settings backup and use harmless sample records. Do not run both SLINK copies together. A new profile or separately named PDA script may need its own authentication; this is not a settings deletion.

### Racing helper — extension and PDA

What changed: the recommended car should stay highlighted without the helper repeatedly rebuilding the label or scrolling the page. The normal Raceway link is recognized correctly. SLINK still does not select a car for you.

How to test:

1. In Racing, mark a build complete and make its saved nickname match one of your cars exactly.
2. Open an official race for a track covered by that build. The matching car should receive one Recommended label.
3. Wait, scroll around and open/close SLINK. The page should not keep scrolling back, and the label should not multiply.
4. Change the race/car list or reopen the race. The recommendation should update to the actual car currently shown.
5. Try a track whose build is still Needed or whose saved nickname is absent. You should get the appropriate warning, not a highlight on an unrelated car.

Try to break it: switch pages quickly, replace the list by opening another race, rename the expected nickname, hide/background the page and return, or repeat opening/closing the race. In the extension, focus another window; the Racing scanner should pause. PDA does not require desktop-style window focus.

Watch for: missing highlights, duplicate labels, constant jumping/scrolling, an old car remaining highlighted, or a car being selected without your click. Test the ordinary build guide controls as well.

Status: developer tests and an isolated browser fixture passed; actual Torn and Android PDA tester confirmation is pending.

### Museums and Officer controls in the extension dashboard

What changed: dashboard dependencies and permission checks now allow the existing Museums and Officer pages to load for the appropriate users. Officer access is no longer hidden behind an admin-only navigation check. The Recaller entry opens Torn's faction armory; it does not recall items automatically.

How to test:

1. Open the standalone extension dashboard, then Quality of Life.
2. With Museum access, open Museums and confirm its controls load.
3. With Officer, Armory or OC access, open Faction Officers. Confirm only your permitted controls are shown.
4. With Armory access, press Open Armory Recaller. It should open Torn's faction armory, where the in-Torn controls can be used.
5. If you help test permissions, use a non-admin account with the specific feature access. Confirm an account without access cannot use the page. Admin access should continue working.

Try to break it: open the page repeatedly, switch between QoL tabs, refresh the dashboard, and test an account with only one of the Officer permissions. If access is revoked during testing, the old page should clear when permissions refresh.

Watch for: blank pages, missing permitted tabs, unrelated Officer controls appearing, error messages while loading, or the Recaller button doing nothing. Do not use real recall actions just to test that the destination opens.

Status: dashboard imports, exact permission combinations, revocation cleanup and navigation passed developer checks; tester review is pending.

### Recovery after a failed target-information save — extension

What changed: one temporary failure saving target information should no longer prevent every later target update from being saved.

How to test: use normal player/target features across a few page changes and confirm later observations continue updating. There is no need to provoke a storage failure yourself.

Developer-only break-it check: a synthetic failed write must reject that individual save; the next independent save and a later batch must still succeed. This test passed. Do not clear, fill or corrupt browser storage to test it manually.

### Known limits and test results

- The wider foreground ownership, module cleanup, saved-target migration, shared providers, additional dashboard pages and loading optimizations are not implemented yet.
- The tester PDA launcher uses a separate downloaded-runtime cache and a pinned source revision. Its update link remains on the testing branch.
- The full test inventory has **39 passing and 18 failing scripts**, including four new passing regression scripts. The 18 failure entries match the pre-audit baseline and remain unresolved; this is not a fully green suite. Developer details are in `docs/audit/BASELINE.md` on the extension testing branch.
- Android installation/background/resume and live Torn behavior still require testers. No lag-reduction percentage is claimed.
- All changes remain on side branches. Tester confirmation and owner approval are required before anything reaches main.

Follow-ups: none received yet. Keep dated tester reports and retest results under the relevant entry in this same file.

## What each future entry will contain

- **Build and platform:** Which version to install, where to get it, and whether it affects the extension, PDA or both.
- **What changed:** What you should notice while using SLINK.
- **Before you start:** Any permissions, settings or harmless sample records needed.
- **How to test:** Step-by-step actions with the expected result.
- **Try to break it:** Relevant checks such as fast repeated clicks, switching pages, refreshing while editing, closing and reopening SLINK, or backgrounding PDA.
- **Watch for:** Signs of failure and existing behavior that should still work.
- **Known issues and test status:** What remains uncertain, what testers reported, and what needs another test after a fix.

## Reporting a problem

Include the tester version, your device/platform, what you clicked, what you expected and what happened instead. A screenshot or recording can help. Never include an API key or login token. Use a harmless test target or isolated test profile for checks involving saved records; do not delete important data to test a change.
