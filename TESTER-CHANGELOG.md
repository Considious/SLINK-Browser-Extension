# SLINK testing changelog and checklist

## Start here

This is the combined test list for the current testing build. You only need the newest build—not 40 separate installs.

- **Extension:** 0.19.14.2 — Audit Test 40
- **PDA:** 0.4.126
- **Testing branch:** audit/test-foundation

These are testing builds, not the Chrome Web Store release. Publishing this document on main does **not** release the testing code. Some urgent fixes below are already on main; they still need checking alongside the rest.

## Downloads

- [Download the extension tester ZIP](https://github.com/Considious/SLINK-Browser-Extension/archive/refs/heads/audit/test-foundation.zip)
- [Extension installation instructions](https://github.com/Considious/SLINK-Browser-Extension/blob/audit/test-foundation/TESTING.md)
- [Install/update the PDA testing script](https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js)
- [PDA installation instructions](https://github.com/Considious/Torn-Scripts/blob/audit/test-foundation/SLINK-PDA/TESTING.md)

Back up important settings first. Use a separate Chrome profile for the unpacked extension, and keep the stable PDA script disabled while testing. Update an existing tester install in place: **do not uninstall SLINK or clear app data.** A separate test profile/install may need its own authentication.

## What changed

- **Settings and saved data:** safer saving, less chance of an older page replacing newer settings, and better PDA storage/recovery handling. Cloud recovery remains manual.
- **Editors and checkboxes:** background updates should no longer close settings, replace what you are typing, or make unrelated checkboxes act as one.
- **Autosave:** many personal settings now save as you change them, with failed-save/retry feedback. Authentication, some shared settings and explicit actions still need their normal buttons.
- **Startup and performance:** better use of cached startup data, fewer unnecessary page scans and repeated requests, and cleaner pause/resume when changing tabs or backgrounding PDA.
- **Shared stats and prices:** modules reuse newer authenticated battle stats and shared item information. Slow or incomplete replies should not overwrite newer data or invent zero values.
- **Extension storage:** large player-information caches are separated from ordinary settings to reduce storage-limit problems.
- **Dashboard access:** repaired module loading, permissions and action buttons on the standalone extension dashboard, including Museums, Officer tools and the Armory Recaller entry.
- **Mugging and Fair Fight:** known suitable targets come first; unchecked targets can be offered for checks rather than leaving the list empty. Failed checks must not erase known estimates. Provider outages should leave other module controls usable.
- **Racing and other QOL tools:** repaired car highlighting, steadier saved names/progress, safer travel forecasts and Company alerts, and more stable Money, Museums and Events controls.
- **Chat:** custom buttons and GIF/sticker tools are accessible from supported native chat windows. There is an optional GIPHY picker and optional Fair Fight bubbles beside chat profile links.
- **Themes:** optional CSS theming for Torn pages, using your selected SLINK theme and existing supplied image assets.
- **Errors:** clearer explanations for full device storage, API caps, outages, access problems and startup failures, with a support code.

These are changes to test—not a promise that every reported issue is already resolved on every device.

## Please test these first

Try the checks that apply to your permissions and normal Torn use. We especially need **physical PDA testing**, plus both the **Torn panel and standalone extension dashboard** on desktop.

### 1. Saved settings and alerts

- [ ] Change a few harmless alert choices. Navigate away, refresh, close/reopen SLINK, and restart PDA/the browser. Confirm the saved choices remain.
- [ ] Use Enable all / Disable all, then change individual alerts. The checkboxes, enabled count and alerts that actually appear must agree.
- [ ] Snooze a medical/cooldown alert, then change pages and refresh. It must stay snoozed and must not repeatedly announce itself.
- [ ] Check that saved keys, targets, notes and themes remain. Report repeated authentication prompts even if the key is still present.

### 2. Forms, checkboxes and autosave

- [ ] Leave a settings section open and type while normal refreshes happen. It must not close, move the cursor, erase text or change your selections.
- [ ] Add/edit a clearly disposable target. Try an invalid ID first: your notes should remain so you can correct it and retry.
- [ ] Change one Market Watch item and one Officer permission checkbox. Unrelated items/permissions must not toggle with it.
- [ ] Where autosave is shown, wait for Saved, then reopen/reload. A failed save must not claim success.
- [ ] Change different harmless settings from the dashboard and Torn panel. Both saved changes should remain.

Unsaved text is protected from background updates; that does not promise it survives a full page reload. Credentials, shared policies and explicit Save/Send actions are not all autosaved.

### 3. Navigation, resizing and speed

- [ ] Open Alerts or Market Watch, change Torn pages and refresh. SLINK should return to that same module—not default to Quality of Life.
- [ ] Resize and reposition the extension panel. Reopen/change pages: its saved size and position should remain within the screen.
- [ ] Check narrow and wide layouts. Buttons should stay readable, alerts fit the width, and extra height should not create huge gaps between controls.
- [ ] On PDA, reach every Combat and QOL subtab. No buttons should be trapped offscreen.
- [ ] Switch Torn tabs/windows; background and return to PDA several times. Watch for duplicate controls, repeated actions, theme flicker, full-looking restarts or noticeable lag.

### 4. Battle stats, Mugging and provider failures

- [ ] Refresh your battle stats in Mugging. Close SLINK, change pages and refresh. The newer stats must not revert to an older total.
- [ ] Compare your own stats across the relevant combat modules. Report conflicting values with the time each was refreshed.
- [ ] Find Mugging targets. Check that unchecked rows are clearly marked, do not claim fake zero stats, and can become estimated entries after successful checks/refresh.
- [ ] Check the selected Fair Fight ceiling: known targets above it must not be presented as within range.
- [ ] If Fair Fight is genuinely unavailable, War/other module controls should still work, using identified cached estimates or N/A—not fabricated values.

Do not attack someone, revoke a key or intentionally exhaust an API allowance just to run a test.

### 5. Racing, QOL and Officer tools

- [ ] Racing: mark a build complete, save the exact nickname, and open a matching official race. The correct car should highlight once, without selecting it or repeatedly scrolling.
- [ ] Abroad Stocks: check the destination, travel method and displayed leave time. Missing provider data must not look like confirmed zero stock or a certain forecast.
- [ ] Money/Museums/Company: check that available figures and prices are readable, missing values are honest, and your inputs survive refreshes.
- [ ] Events: select Halloween outside the event dates, then another event. Guides must not disappear just because the event is inactive.
- [ ] On the extension dashboard, open your permitted QOL and combat modules and try their ordinary buttons.
- [ ] Officers: check restock/missing-item reports and Copy. The Recaller entry should open the armory; opening it must not recall items automatically.
- [ ] If you already have suitable test accounts, check ordinary feature access, officer access and admin access. Do not change important faction grants solely for testing.

### 6. Chat tools and themes

- [ ] Open supported faction, company and private chats. Check the custom/media menu appears, opens once, and does not cover native controls.
- [ ] Test custom profile/retaliation links. Names and 【ATTACK】 links should remain clickable after chat updates; IDs should not break profile links.
- [ ] Enable the optional GIF picker. Search, view still previews, manually play/pause and copy a link. Nothing should send without your action.
- [ ] Check GIF/sticker searches and custom templates without sending unwanted messages. Existing drafts must remain untouched.
- [ ] Enable Fair Fight in chat. Check names/profile links remain usable, bubbles do not duplicate, and unavailable estimates show N/A or an identified fallback.
- [ ] Enable Apply my SLINK theme to Torn. Check Crimes, Travel, an existing attack log and Chat for readable text, intact controls and meaningful status colors. Toggle it off: Torn styling should return.
- [ ] Change theme/opacity, navigate and reload. Saved choices should remain, and decoration must not block buttons.

### 7. Errors and recovery

- [ ] If a normal check fails, does the message tell you what happened and what to do next? Include the support code in your report.
- [ ] After a temporary connection failure, reconnect and retry. Your settings and drafts must not be cleared.
- [ ] “Device storage full” must not be described as an API cap. Unknown limit reset periods must not be presented as definite minute/daily limits.

Do not fill, corrupt or clear your real storage to provoke an error. Controlled storage/API failures are covered by developer tests.

## What is not ready to claim yet

- The shared **remote Fair Fight backup** and other testing-worker changes still need their separate backend rollout. Local backup behavior can work without that deployment.
- Automatic mini-profiles, inline GIF/image embedding, the large emoji picker and /tableflip-style shortcuts are **not included** in this build.
- Automated tests are passing (116 client checks and 93 backend cases), but they do not replace real-device and live-Torn testing.
- A main-branch document update is not a Chrome Web Store update or a deployment of the testing services.

## How to report a result

Please include:

- **Build and platform:** extension version + Torn panel/dashboard, or PDA script version + phone/OS/PDA app version.
- **Check:** which checklist item you tried.
- **Result:** PASS, FAIL, or NOT TESTED.
- **If it failed:** what you clicked, what you expected, what happened, and whether it happens again.
- A screenshot or exact error/support code if useful.

Never include API keys, session tokens or private messages. If something threatens saved data or triggers an unintended action, stop and report the first failure rather than repeating it.

---

<details>
<summary>Earlier development notes — historical detail, not the current installation instructions</summary>

Older version numbers, unresolved items and “not implemented yet” notes below describe those earlier builds. Use the combined checklist above for the current build.

## Candidate 40 — 30 October 2026 — Errors that explain what happened

**Testing only: extension 0.19.14.2 / PDA 0.4.126 / Cloudflare audit/test-foundation.** Main is unchanged. This is an error-message pass, not a settings reset, API-budget increase or automatic repair.

When a check fails, SLINK now distinguishes device storage being full, API request limits, server/database setup problems, service outages, blocked connections, expired access, unverified keys, unsupported API requests and runtime/component loading problems. Messages explain what to try next and include a short support code. Known providers are named. Minute/daily limits are only named when identified; unknown reset periods are not guessed. Existing useful input-validation messages are retained.

The old “Resource::kQuotaBytes quota exceeded” means device storage was full—not an API limit. The replacement warns that recent changes may not have saved, and tells you to back up before removing cached data. Nothing automatically deletes data. Error text hides labeled keys/tokens. Successful responses, access rules, status codes, retry schedules and saved preferences stay unchanged.

**What to test:** On both clients, try a failed refresh, an unavailable provider, a refused/expired permission and a temporary connection failure. In a disposable browser profile only, simulate full storage: it must say storage, not API. Do not fill or clear your real profile. A 502 should name the unavailable service; 429 without a reset period must not claim it is a daily/minute cap. Reopen your existing settings, targets, snoozes, theme and last tab and confirm they are unchanged. Leave an editor open while an error arrives: it must not replace your draft or collapse the editor. PDA startup errors also give a short reason instead of exposing raw exceptions.

Validation: 116/116 client commands and 93/93 backend/pipeline cases pass locally, with zero skipped backend cases. The matrix covers 36 representative errors, and integration checks exercise extension HTTP/messaging, all three PDA request methods, native-to-GM fallback, and all four worker response boundaries. An old Leveling policy test was corrected to the existing policy file/full-document fingerprint; production policy/acceptance requirements were not changed. Physical PDA and live service-failure acceptance still need testers. Cloudflare source is on testing only; no deployment or migration was run.

Downloads: [Extension tester ZIP](https://github.com/Considious/SLINK-Browser-Extension/archive/refs/heads/audit/test-foundation.zip) · [PDA tester installer](https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js).

## Candidate 39 — 30 October 2026 — Main Mugging repair carried into testing

**Extension0.19.14.1 / PDA0.4.125, audit/test-foundation.** Includes the complete urgent main Mugging repair below, while retaining Candidate38's chat bubbles/media, public FF backup, shared providers, retained editors/settings, themes and all other audit changes. This is a targeted backport, not replacement of testing with main. Backend testing branch receives the same Mugging worker0.6.3 repair while retaining the separate public-backup implementation. Main/live services are not redeployed by this testing update.

Validation:112/112 client commands and28/28 backend/pipeline cases passed, including four round trips against the actual testing-client functions with zero local skips. Two existing test fixtures were updated for the new helper import and serialized acknowledgement path. The retained FF-check notice updates in place. PDA source digest rebuilt; launcher17618bytes,16 external fragments. These checks do not certify physical PDA or live account recovery.

Known in-range targets stay first; unchecked targets fill remaining spaces, clearly labeled with no fake0 stats/FF or direct Attack shortcut. Both clients batch public FF checks and preserve pending estimates separately from status observations. Find targets uploads useful results, awaits ACK and fetches assignments again. Background FF checks also work without spare Torn calls. Failed uploads/unknown estimates remain pending; positive estimates survive status-only write races. Existing keys, settings and user lists are unchanged.

Test the full sequence: Find targets → unchecked entries → FF batch → acknowledged contribution → refreshed estimated assignments. Also test missing keys, provider outage, failed upload retry, hard FF ceilings and hospital/cooldown exclusions. Confirm unsaved editor fields remain untouched and Candidate38 chat tools still work. The FF check message uses retained text updates, not rebuilding the editor. Physical PDA and live authenticated client/R2 catch-up remain acceptance checks; a passing local round trip is not a claim that the live pool has recovered.

Downloads: [Extension tester ZIP](https://github.com/Considious/SLINK-Browser-Extension/archive/refs/heads/audit/test-foundation.zip) · [PDA tester installer](https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js).

## Urgent MAIN Mugging recovery — 30 October 2026

Worker0.6.3-client-ff-recovery / extension0.19.14 / PDA0.4.124. Isolated main repair only, not promotion of the audit branch. Known eligible targets first; missing estimates now fill remaining slots as visibly unchecked, not FF0 or fake zero stats. Both clients actually batch FFScouter checks, upload public estimates with original timestamps, wait for ACK on Find targets, and fetch assignments again. Missing keys/failures stay honest and queued work is retained. No mass-zeroing or schema migration. Race-safe R2 writes preserve newer positive estimates. Admin wildcard accepted. Unchecked rows have no direct Attack shortcut. Existing settings/keys unchanged.

Test: update PDA in place / extension to0.19.14, Find targets, observe known-first + FF-check-pending rows, then successful checks becoming estimated assignments on refresh. Verify known too-strong targets stay outside the hard FF ceiling; hospital/cooldown filters remain. Disable/block FF in an isolated test session: pending rows must not become0 or erase prior estimates. Failed uploads must retry; refreshed status must not erase queued FF results. Test FF contributions with zero spare Torn calls. Check live health version and growth in estimate coverage, rather than interpreting a successful source push as verified production behavior. Installed Chrome needs a store release/adoption; repository code alone cannot change an installed build.

Evidence:28 local worker/pipeline cases pass (including four actual-client-function round trips), six client FF/report/stat checks plus PDA runtime build pass. Physical PDA/native bridge and authenticated live R2/client acceptance remain unverified until observed. Deployment status is recorded in the implementation checkpoint. Audit branch Candidate38 remains separate and has NOT been promoted to main by this repair.

## Candidate 38 — 30 October 2026 — Optional Fair Fight chat bubbles

**Testing only: extension 0.19.13.11 / PDA 0.4.123.** Enable **Quality of Life → Chat → Fair Fight in chat**. It defaults OFF and saves immediately. The extension dashboard page has the same setting. Existing Chat permission/faction grants and admin.* apply; no new permission or migration.

Independent SLINK code/CSS: no FF Scouter V2 GPL renderer, helpers, React, polling or stylesheet was copied/adapted. Its authors are acknowledged as the visual reference, not as authors of SLINK code. The small rounded bubbles display FF beside visible native sender/profile links, not inside their text. Existing profile navigation/long-press and manual message sending are unchanged. Values above 3 remain real values, not clamped. N/A means no usable score. † identifies fallback data; desktop hover/accessibility text supplies source and age. This is not the external FFScouter script's full interactive tooltip.

Uses saved FFScouter credentials and the existing shared HTTP/circuit/public-backup path. Current provider results win; matching observer/stat-context player-intelligence FF is an additional fallback. No stale FF from another account or older own-stat context is reused. Existing public-BSS backup computes a personal FF locally or returns N/A. No extra Torn stat/profile calls. The shared remote backup remains undeployed/disabled as explained in Candidate 37.

Visible players are deduplicated in batches up to 200, with at least five seconds between chat batches (event-driven, at most 12/minute). A bounded temporary result cache (five-minute success / ten-minute missing) avoids repeated chat lookup traffic. No polling timers. Chat-root mutations, intersection visibility and the existing active runner govern work. Background/inactive clients remove their own badges and stop DOM observation; in-flight results are fenced. Detached/recycled link identities are cleaned, and names, anchors, listeners and composer drafts are never replaced.

Verification: all 110 declared client validation commands passed. Four isolated browser cases (both platform engines, 360/1000px) passed layout, original link/listener/draft preservation, recycled IDs, inactive shutdown, preference off/on and chat-root replacement. Saved-key/admin/expired-session adapter tests pass. Physical PDA and actual Torn/other-script coexistence remain acceptance work.

### Test this / try to break it

1. Update in place. Confirm keys, alerts/snoozes, targets, theme, last page/size and chat media/custom buttons are preserved. The new option must initially be off.
2. Enable it in QOL → Chat (or extension dashboard). Check sender names and profile links in faction, company and private chats. Global/trade/abroad channels need live acceptance too. Repeated references to one player should share results; attack/non-profile/external links should not gain bubbles.
3. Check short/long names, phone/desktop widths, very large FF and unknown players. Link text remains unchanged and usable, chat drafts stay put, and bubbles should not cover controls. No automatic mini-profile opening or sending.
4. With an isolated provider outage, verify honest †/source/age or N/A. Do not revoke a key as an outage test: invalid credentials are not disguised as successful backup. Change accounts or update own stats: old observer-bound intelligence must not be used for the new context.
5. Scroll/recycle entries, close/reopen chats, replace the chat root, switch tabs/windows and background PDA. There must be no duplicate badges, stale player assignments or inactive DOM/API scanning. Resume should restore badges without rewriting chat messages.
6. Toggle off/on, reload, and verify the preference persists. Test with standalone FFScouter/TornTools enabled for coexistence; SLINK uses its own classes and does not modify their controls. Physical PDA/native bridge and live Torn remain tester acceptance, not claimed by fixture tests.

**Follow-up for the owner:** choose/apply a SLINK license and review third-party license/notice obligations. No license decision is included in this update.

Downloads: [Extension ZIP](https://github.com/Considious/SLINK-Browser-Extension/archive/refs/heads/audit/test-foundation.zip) · [PDA installer](https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js).

## Candidate 37 — 30 October 2026 — Passive public Fair Fight backup

**Testing only: extension 0.19.13.10 and PDA 0.4.122. Main/stable is unchanged.** The Fair Fight chat badge idea is saved for later in `docs/FF-CHAT-FOLLOWUP.md`; this update builds its fallback foundation, not the badge itself.

- [Extension tester ZIP](https://github.com/Considious/SLINK-Browser-Extension/archive/refs/heads/audit/test-foundation.zip).
- [PDA tester installer](https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js).
- [Backend implementation/deployment/usage notes](https://github.com/Considious/SLINK-Cloudflare-Services/blob/audit/test-foundation/workers/contribution/FF-BACKUP.md).

### What changes

SLINK quietly keeps public BSS estimates from FFScouter requests it already makes. FFScouter remains primary; no random-player scans, extra Torn requests or new private-stat refreshes are added. Separate IndexedDB storage avoids the extension's Chrome local-storage quota and does not touch settings/API keys. Backup records never contain personal FF scores, keys, private stats or spies. Your own authenticated local BSS is used to derive a personal fallback score; if unavailable, show N/A rather than guessing.

If FFScouter fails, locally known public estimates are used first. Only missing requested players can be looked up remotely. Backup results include source/age and are retained locally; missing results have a short negative cache. A lightweight circuit reduces repeated provider failures and later probes recovery. Existing missing/cached/N/A handling stays available when both services fail. A stalled/failed backup write cannot indefinitely hold up a successful primary result.

Automated verification: 107/107 client validation commands and 17/17 backend tests pass. Both client copies also pass real-browser IndexedDB reload, conditional acknowledgement and unrelated-settings preservation checks. Physical PDA/live Cloudflare acceptance remains open.

### Important backend status

The contribution/lookup routes, migration and separate R2 snapshot runner are committed as SOURCE to the Cloudflare testing branch, NOT deployed. Their switches default OFF. No production D1 schema, R2 bucket, secrets or main branch was changed. Clients use the existing contribution-service origin; until the new routes are deliberately enabled there, remote backup attempts fail quietly and retain queued records. Fully isolated external staging requires separately configuring a client origin and matching existing session validation; it is not provisioned by these commits. Automated tests exercise the actual client wrappers, SQLite route code and real IndexedDB; they do not constitute a live Cloudflare/native PDA deployment.

Uploads are deduplicated, acknowledged batches up to 200, triggered by 100 queued rows or an hour of normal activity. No new polling/shutdown upload. There is a 15-minute minimum attempt gap and five attempts/day/client. Failed uploads keep the queue. The backend has a conservative default 20,000 newer-candidate/day shared write budget and 1,000 submissions/day/signed user; queued excess waits. Existing unrelated services still share account allowances.

### Test this / try to break it

1. Update in place without clearing settings. Confirm API keys, alert choices/snoozes, target lists, theme, tabs/sizing and Candidate 36's actual chat-window tools remain unchanged. There should be no new normal-user infrastructure text.
2. Use normal War/Leveling/Bounties lookups. Successful live FFScouter results should remain preferred. Visit the same targets repeatedly: this must not cause one upload per player or extra Torn requests. Ordinary successful complete responses cause no backup lookup.
3. After a successful normal lookup has populated the new cache, simulate blocking FFScouter in an isolated browser test session (do not revoke your key or flood the provider). Known targets should show source-labeled SLINK Backup results. Their age must refer to FFScouter's timestamp, not the current page load. If current authenticated private BSS is unavailable, FF is N/A rather than another user's score. Existing module ceilings still apply.
4. Reload and revisit during the simulated outage. Local estimates/queued contributions should persist independently of settings; there must be no whole-database download. Unknown targets remain unknown if remote routes are not deployed. Never use the same unknown target to generate repeated test traffic.
5. When backend staging is deliberately configured, use the documented migration/routes. A lookup for 100 targets with 67 local should request only the 33 missing. Returned records should persist locally; misses should suppress repeat lookups ten minutes. One provider miss must not mark the whole service down. Healthy FFScouter recovery must override backup data.
6. Test failed uploads, interrupted acknowledgements and quota responses: newer queued records must remain, and ordinary UI/live FF lookups must continue working. Invalid/revoked FF keys must remain authentication errors, not a silently fabricated backup success.
7. Backend maintainers: verify old/equal timestamps cannot overwrite newer rows, duplicate contributors collapse to one player row, private/premium fields and oversized/invalid payloads are rejected, anonymous access is rejected and admin status is not available to ordinary users. A signed authorized client can still submit fabricated values; this is bounded validation/quota protection, not claimed cryptographic attestation.
8. Enable the separate snapshot runner only after test D1/R2 bindings are ready. Check daily gzip output and 14-day prefix-isolated retention. Snapshot failure must not affect live lookups or existing collection jobs. Large snapshot CPU/memory on Workers Free remains an actual staging acceptance check, not an assumed guarantee.

Developer evidence: shared engine/unit tests for passive capture, privacy, timestamp dedupe, 500 records in 200/200/100 batches, conditional acknowledgements, negative caching, outage/recovery and fail-safe quota/stalled storage; actual extension/PDA HTTP wrappers; real IndexedDB reload/queue/settings-isolation tests for both platform copies; SQLite tests for actual JSON SQL upserts/lookup/auth/quota behavior and gzip snapshots/retention/R2 failure. Physical PDA, live Cloudflare deployment/CPU metrics and broad device/UI acceptance remain open. Existing server-side Mugging raw responses never delivered to a client are not secretly crawled or intercepted.

Usage example: 100 active users × 500 useful public estimates/day → roughly 300–500 upload attempts/day with 100–200/batch, plus possible CORS preflights; the default server cap admits at most 20,000 newer candidate rows/day plus quota overhead, not the full potential 50,000 submissions. Batching reduces requests/transactions, not per-row D1 billing. Complete healthy responses need zero backup reads. One daily snapshot of N rows adds about N D1 reads and one R2 put plus cleanup. Shared free quotas and CPU still need measured headroom; no paid service was enabled and no zero-cost guarantee is made.

## Candidate 36 — 29 October 2026 — Chat tools inside Torn's chat windows

**Testing only: extension 0.19.13.9 and PDA 0.4.121. Main/stable is unchanged.** Open a Torn chat window, then click **✦ beside its minimize control**. The popup now has **Custom buttons / GIFs / Stickers**. You do not have to navigate to SLINK's QOL → Chat tab first; that page remains the settings/editor view.

- [Download the extension tester ZIP](https://github.com/Considious/SLINK-Browser-Extension/archive/refs/heads/audit/test-foundation.zip). Extract and update/load the folder in Chrome Developer mode; keep stable disabled or use another browser profile.
- [Install/update the PDA tester script](https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js). Update the existing AUDIT TEST script in place; do not uninstall or clear settings.

### Test this / try to break it

1. Leave SLINK on a different tab (for example Alerts), open a private/faction/company Torn chat and find ✦ next to minimize. Click it: all three tool tabs should be reachable. It must not minimize/drag the chat accidentally or insert controls into Notes/Settings. If another standalone custom-buttons script is installed, disable that duplicate while testing.
2. Custom buttons should list only their configured destination presets. First click loads the message; the second click on the same preset sends. Edit the draft before confirmation: it should disarm rather than send changed text. Private/faction templates must not leak into each other's destinations. Existing template scopes remain faction/private/newsletter; company gets media access, not a newly broadened private-template scope.
3. Click GIFs/Stickers directly in the popup. Enable the optional picker if needed; saved shared/custom keys and existing settings are reused. Search, preview, Next results and Copy link work as in Candidate 35. Paste into the desired Torn chat and manually send; choosing/copying media must never send a message automatically. GIPHY/ChatSticker keep separate grids and independent failures. No media request occurs simply from opening the custom-buttons menu.
4. Keep a partially typed media search, wait through normal updates or a custom-preset settings update, switch tools and reopen. The picker/input must not be rebuilt by macro updates. Switch GIFs/Stickers rapidly while settings/search responses are slow: the last selection should win.
5. Close the popup with Escape/outside tap, minimize/close the native chat, reopen it, background/resume PDA, and change the active browser tab. Search/playback should pause when inactive. Controls/styles must not multiply, and an old pending custom send must not fire after returning. Existing active/focused extension and visible-PDA rules remain.
6. At phone/desktop widths, check popup scrolling, all three tool tabs, bottom actions and native chat controls. QOL → Chat settings remain accessible and unrelated SLINK layout/tab/size/theme/data must be unchanged. Global/Trade/Abroad windows were not individually supplied/certified; report actual mismatches if found.

Developer evidence includes both platform copies against sanitized header/composer elements from the supplied Torn chat capture, at 360/1100px: private/faction/company entry, exclusion of Notes/Settings, scoped templates, two-click native send, media copying without autosend, retained search inputs through macro updates, viewport bounds, idempotent styles/controls and activity suspend/resume. Actual images/network were blocked in these fixtures. This is not physical PDA/live Torn certification. Candidate 35's provider/key/privacy tests remain in the regression suite.

## Candidate 35 — 29 October 2026 — Stickers in the chat media picker

**Testing only: extension 0.19.13.8 and PDA 0.4.120. Main/stable is unchanged.** In Quality of Life → Chat, the existing optional picker now has **GIFs / Stickers** buttons and one shared search box. Existing enabled choices, integrated/custom GIPHY keys and other SLINK settings stay in place. No migration or reset. Enable the picker if you have not used it before.

- [Download the extension tester ZIP](https://github.com/Considious/SLINK-Browser-Extension/archive/refs/heads/audit/test-foundation.zip). Extract and load/update the folder through Chrome Developer mode. Disable stable SLINK while testing, or use another browser profile.
- [Install/update the PDA tester script](https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js). Update the existing AUDIT TEST installation in place; do not uninstall or clear data. Keep stable disabled.

Stickers searches GIPHY and ChatSticker together, with separate labeled result grids in the same picker. This separation is required by GIPHY's rules; mixing providers in one grid and caching GIPHY responses are prohibited. ChatSticker alone has a short three-minute memory cache. No new API key or Cloudflare service is needed. Searches/previews connect directly to the providers and image hosts. ChatSticker uses its public catalog, which has no documented G-rated filter; GIPHY sticker searches use `g` and GIFs retain the existing `pg-13` filter.

### Test this / try to break it

1. Check the old GIF search, Trending and Next results. Select a GIF, Copy link, paste into Torn chat and manually send. It should work as before; SLINK never sends automatically.
2. Select Stickers and search, for example, `hello` or `cat`. Both provider headings should appear when both services work. Clear the query/use Trending / popular for default results. No provider calls happen merely from opening the Chat settings panel.
3. Preview an animated/transparent sticker and pause it. Initial cards use lazy still images and dark transparent-friendly tiles, not dozens of autoplaying animations. GIPHY stickers avoid MP4, which would lose transparency. If ChatSticker supplies no animation URL, it explicitly uses a still fallback rather than guessing one. Some supplied animations are APNG and may display as stills in Torn/other embedder scripts.
4. Copy one sticker from each provider, paste and send manually. The selected field contains the usable image URL. This update does not add automatic inline rendering to native Torn chat; report whether your chat/embedder setup recognizes these links. Existing GIFs keep their previous GIPHY permalink sharing.
5. Type quickly, change searches while a previous request is slow, switch GIFs/Stickers, then use Next results. Only the latest search should replace the results; your input should not reset. Pagination is independent per provider. Search is debounced and throttled, with no polling.
6. If one provider is unavailable/rate-limited, the other should still display normally. If neither works, expect one plain temporary-unavailable message. Empty searches/results must not show stale previous cards. No raw API errors or keys should appear. Try ChatSticker with custom GIPHY mode but no saved key: its results should still work.
7. At phone width and after resizing, verify all tabs, search/actions and result cards are accessible with no forced horizontal scroll. Powered by GIPHY and Carol's original-script credit remain. Switch pages/background the app: previews must stop, saved keys/options must persist and unrelated modules must behave as before.

Developer checks cover normalized adapters, endpoints, ratings, URL validation, cache/expiry, duplicate suppression, independent limits/failures, paging, access revocation and preserved GIF behavior. Browser fixtures exercise both platform copies at 360/1000px, retained controls/drafts, playback, copy links, debounce, out-of-order responses, empty/error states and layout. Live GIPHY GIF/sticker and ChatSticker search requests returned HTTP 200; ChatSticker returned `Access-Control-Allow-Origin: *` with Torn Origin. These checks do not replace physical PDA/live Torn/CSP and actual sent-message rendering acceptance. Existing audit acceptance remains open.

Implementation details and provider references: `docs/CHAT-MEDIA.md` in the extension testing branch. No Fair Fight chat badge, mini-profile automation, new permission, backend deployment, unrelated layout change or main promotion is part of this update.

## Candidate 34 — 28 October 2026 — Torn-page themes

**Testing branches only: extension 0.19.13.7 and PDA 0.4.119. Main/stable is unchanged.** This publishes the previously local theme work after the owner authorized the testing-branch push. The earlier LOCAL ONLY notes below are historical; Candidate 34 is the installable combined build.

### Download and enable

- Extension ZIP: https://github.com/Considious/SLINK-Browser-Extension/archive/refs/heads/audit/test-foundation.zip — extract, then load/update the folder in chrome://extensions with Developer mode. Use an isolated Chrome profile, or disable the stable SLINK extension while testing. This is not a Chrome Web Store release.
- PDA script: https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js — update your existing AUDIT TEST installation in place; keep stable SLINK disabled. Do not uninstall or clear application data. Back up important settings first.
- Enable **Apply my SLINK theme to Torn** in the **Theme Torn pages** controls beside the existing theme selector: extension dashboard Themes, or PDA's Themes/recovery section. The new feature starts OFF, so installing alone will not recolor Torn.

The page styling follows your selected, permission-resolved SLINK theme. Existing image files are used unchanged. Options control the page background, supplied frame/textures, health artwork, optional experimental chat styling and panel color opacity. Textured panel artwork remains opaque; turn textures off to see through panel backgrounds. Settings autosave with retry feedback. The previous GIPHY API picker remains included.

### One combined test pass

1. Confirm the version, saved theme, API credentials, alert choices, targets/notes and last-used SLINK tab after updating. Enable Torn-page theming, change to an unlocked theme, navigate and reload. Both the choice and opt-in must persist; existing controls/settings must not reset.
2. Review Crimes hub, Shoplifting and Bootlegging. Neutral panels/headings should follow the palette; security, notoriety/progress indicators, maximum-level cards and native action states should remain meaningful. Other crime pages reuse the shared structure; report an actual mismatch rather than collecting all pages in advance.
3. Review Travel Agency: panel backgrounds, flight-method dropdown and inventory/departure sections. Selected/unavailable choices, map imagery and Travel controls must remain native and readable. Do not take a flight solely to test styling.
4. On a naturally visited attack page or existing attack log, check readability without performing a test attack. Health/damage, weapon glows, outcome colors and log event colors must remain intact. Styling must not rearrange or trigger an action.
5. Enable the optional chat styling. Check Company, Faction, private chats, Settings and the private-chat list. Notes should work if available and be safely absent otherwise. Button order is not used for matching. Unread badges, status indicators, message drafts and native send/minimize controls must remain usable. Global/Trade/Abroad chats were not individually supplied and are not certified from the provided captures.
6. Toggle background/textures/chat independently; drag opacity; open a draft, wait through ordinary updates and resize. Text must not fade with panel color opacity, fields must not reset, and no whole-page blur or image desaturation should appear. Disable the entire option: Torn's own styling must return without a page reload.
7. Switch active tabs/windows and background/resume PDA. Look for flicker, lag, stuck styling or duplicated controls. Start with other whole-page theme scripts disabled, then report any specific coexistence issue. Do not remove saved data or expose keys in reports.

**Developer evidence:** all 99 declared automated checks pass. Eight theme/viewport browser fixtures, 28 sanitized supplied-DOM cases and actual extension-shell/PDA-runtime smoke tests passed. Captures covered hub, Shoplifting, Bootlegging, Travel, Attack/Logs and Chat at phone/desktop widths. Source scripts/requests were blocked and private text stripped in the capture harness. Those fixtures do not include Torn's original stylesheet bundles and do not certify live Torn appearance, native PDA/CSP/network behavior or physical-device performance. That is what the tester pass must establish.

No new permission migration, worker deployment, generated artwork, page scraping or API polling accompanies this build. Only the existing testing branches are updated.

## LOCAL ONLY — 28 October 2026 — Optional Torn-page themes (not published)

**Follow-up: supplied pages are now combined.** Crimes hub, Shoplifting, Bootlegging, Travel, Attack/Logs and Chat use shared stable-root rules derived from the actual captures. Optional Notes and chat button order do not control matching. Page-specific additions change only neutral background/text colors, not native geometry or actions. All 99 source checks, 28 sanitized supplied-DOM cases, eight theme/viewport fixtures and both actual adapter smoke tests pass. No more blanket HTML collection is requested; live Torn/physical PDA appearance remains the next acceptance step. This follow-up is still local only, with no commits/pushes or version bump.

No commit, push, release, candidate number, or installed version change. Existing testing links still install Candidate 33, not these local changes. The owner asked to hold all commits.

A local opt-in “Theme Torn pages” section now appears beside the existing theme controls: extension dashboard Themes, and PDA's Themes/recovery section. It follows the selected permission-resolved SLINK theme rather than maintaining another theme picker. Options cover the page background, supplied frame/panel textures, supplied health artwork, experimental chat styling and panel color opacity. The whole feature defaults off. Settings autosave with failure/retry feedback; extension field patches serialize in the worker across pages. No input, checkbox or native Torn panel is rebuilt by the styling engine.

The engine uses a scoped neutral CSS-variable map adapted from Verified-Madgod's Theme Hub plus original SLINK page/image integration. It does not import their runtime or generated hardcoded-color override file. It uses the existing validated image assets unchanged; panel artwork is CSS nine-sliced to keep ornament edges clear of content. Textures remain opaque: turn them off to use see-through panel color backgrounds. No new image files, global blur, image desaturation, API calls, whole-page scraping or polling were added. Static styles may remain in background tabs, while the narrowly scoped repair observer pauses when the page is inactive and stops after repeated conflicts.

Developer checks: 99/99 source/test commands; eight synthetic browser cases (Halloween/Gothic, extension/PDA engine copies, 380/1100px) covering control identity/drafts, toggles, native actions, semantic colors, opacity, disabling/restoration, save failure/retry, background/resume and 10,000 unrelated mutations. Actual extension shell and concatenated PDA runtime smoke tests verify opt-in wiring, saved changes and disabling. Supplied artwork screenshots were visually reviewed. Native PDA launcher remains 17,585 bytes, with additional code loaded as external fragments at startup—not appended to the installed launcher.

This is not full live-Torn coverage or physical-device certification. See TORN-THEME-LOCAL-REVIEW.md beside the local audit documents for screenshots, known limits and the exact inspection list. Test in an isolated profile first when publication is authorized. Disable any other whole-Torn theming script during initial review. Existing SLINK-only themes and gameplay controls must continue to work with this option off.

## Candidate 33 — 28 October 2026 — GIPHY API integration

**Testing branches only: extension 0.19.13.6 and PDA 0.4.118. Main/stable is unchanged.** Quality of Life → Chat now contains the direct-API GIF picker. It is optional and initially off. Choose SLINK's shared application key or your own GIPHY API key. The owner expressly approved publishing the shared application key; it is visible client-side and has shared provider limits. Your own saved key is not echoed by the settings service. PDA cloud backups exclude that key and restoring a settings backup preserves the existing local key.

The picker searches only when you press Search, Trending, Enter, or Next results. It shows still thumbnails, with explicit Play / pause and Copy link controls. Paste the copied link into Torn chat and send it yourself. Clipboard-denied environments show a selectable link instead. Nothing sends a message automatically. Requests go directly to GIPHY from the client; no Cloudflare proxy, persistent search/media cache, background search, automatic key rotation, or mixed-provider results. Provider timeouts, rejected keys and rate limits show a bounded error rather than a retry loop. Settings save automatically, show failed saves, and offer Retry. The original custom-button/highlight settings are preserved. Attribution uses GIPHY's supplied artwork; the picker credits Carol [4021053]'s original script as inspiration.

### Test together on the extension dashboard, Torn panel, and PDA

1. Update the existing tester install in place; do not uninstall or clear data. Open Quality of Life → Chat. Confirm prior macros, highlight settings and unrelated data remain. Turn Enable GIPHY on, navigate away/back and reload; the setting must persist.
2. Search for a harmless term, try Trending and Next results. Confirm no search runs just because you open the page or type. Still previews should not animate until Play is pressed. Switch tabs/background PDA or scroll the picker out of view; playing previews must pause. Return and play again manually.
3. Copy a link, paste it into a harmless chat draft and confirm nothing sends without your own Send action. If copying is blocked, use the selectable link shown beneath the picker.
4. Select My own GIPHY API key, enter your key, and wait for Saved. Reload; the field should be empty/masked with a saved-key placeholder, while the custom mode still works. Switch back to the integrated option: your own saved key should remain until Remove saved key is clicked. Do not put keys in reports.
5. Disable the picker, refresh and navigate: it must remain disabled. Other Chat controls should still work. Rapidly change key mode/toggle while searching; older results must not replace the changed state. Keep a key/search field focused during ordinary GUI updates: the field/node must remain intact.
6. If the shared key is genuinely rate limited, it should show that error, not switch keys or keep retrying. Do not intentionally exhaust it. Developer failure-injection fixtures cover denied access, rejected keys, quota, network errors and failed storage writes.

**Evidence:** 97/97 declared automated source/fixture commands pass across both repositories. The new picker passed headless-browser interaction, autosave/retry and layout checks at 360px and 1000px for both packaged copies. One live Search and one Trending request using the supplied key each returned 12 results with usable stills, MP4s and share URLs. Physical PDA/native networking and authenticated Torn chat acceptance still need testers; desktop fixtures are not device certification.

**Scope / what is still separate:** this is the requested direct-API backend/key-option/picker integration. Inline chat image/GIF embedding, quick replies, the large emoji picker and slash-text shortcuts are not implemented by this candidate. The mini-profile proposal is not enabled. The original audit's live/device acceptance also remains open; this entry does not declare it complete. No provider key upgrade or paid plan was requested or activated.

## Combined acceptance pass — Candidates 31 and 32 (no new code build)

This is the planned Update 3 acceptance pass, not another install/version. Use the latest testing-branch candidates only: **PDA 0.4.117 / Candidate 31** and **extension 0.19.13.5 / Candidate 32**. Main/stable is unchanged. Do not install an older candidate, run stable and tester copies together, uninstall SLINK, clear app data, or change important live faction grants for this test. Back up settings first and use a harmless sample target if a target action is needed.

### One combined test session

1. **Install/startup and saved data:** In an isolated Chrome profile, load Candidate 32; in PDA, update the existing Candidate 31 script in place. Confirm the displayed build on each. Check your current alert choices, API credentials, targets/notes, theme, last-used page/tab, panel size and alert snoozes. Navigate away/back and reload; values must remain and no blank/empty shell or repeated authentication prompt should appear. Do not paste keys into a report.
2. **Extension dashboard and Torn panel:** Use the same account in both surfaces. Open Alerts and a few ordinary modules, change harmless settings, and keep a form/draft open while a normal refresh occurs. Controls and drafts must not reset or close. Snooze/dismiss an available reminder and verify the action result. Wait through several unchanged 15-second Torn status refreshes; alert controls must remain usable. A stale/denied officer action should show an error and remain retryable.
3. **PDA persistence and recovery:** Make one harmless settings change and, if appropriate, add/edit/remove a clearly disposable sample target. Wait for save acknowledgement before leaving. Navigate, background the app, return, and reload; acknowledged changes must remain, failed/interrupted changes must not claim success or erase unrelated data, and refreshed battle stats must not revert to an older value. After one successful startup, briefly test cached startup without network; the last-known-good runtime should still open. Restore connectivity afterward. Do not intentionally corrupt storage or test a cold first install with all source hosts blocked.
4. **Page ownership and return behavior:** On Chrome, open Torn in multiple tabs/windows and switch focus repeatedly. Only the focused active Torn page should perform DOM reading; returning should reuse the panel, retain the selected view and size, and resume once without duplicate controls. In PDA, background/switch page and return; DOM readers should pause/resume without duplicate work. Repeat normal navigation to confirm it does not restart into a different/default module.
5. **Permission and account separation:** Without changing real grants, test with accounts/roles that already have the relevant exact permission, faction officer grant, `admin.*`, or no grant. Confirm each receives only its allowed controls; admin retains the documented admin override, and denied/cached data does not expose restricted actions. If you have a safe second account, confirm its stats/settings do not bleed into the first account. If no suitable account/role is available, mark this item NOT TESTED; source tests cannot prove the live grant configuration.
6. **Usability/performance:** On ordinary use, repeat page changes, a few refreshes, and one harmless action. Note whether the panel flickers/reboots, lags Torn interactions, jumps position, changes theme, or causes duplicate alerts/actions. Do not infer performance from one background/API timer. Report device/browser, approximate viewport, exact candidate and surface.

### What developer checks establish—and what they do not

The full declared source/fixture inventories for PDA Candidate 31 and extension Candidate 32 passed. Coverage includes supported migration and non-destructive storage recovery, failed writes/retries, loader/cache recovery, account and shared-data freshness, form/control retention, page ownership/resume, extension standalone-dashboard/Torn action parity and permissions, and a 10,000-unrelated-mutation check with zero DOM rescans. Those are automated test results. They do **not** certify a physical PDA installation, a real authenticated Torn session, actual faction grant propagation, a production worker/backend response, or device performance. Update 3 remains open until the manual results below are reviewed and any evidenced corrections are completed in one complete batch.

### Tester result template

Reply with one line for each check: `PDA / Extension dashboard / Torn panel — PASS, FAIL, or NOT TESTED — exact step and expected vs actual`. Include candidate version, device/OS or browser, and screenshots/log text if useful. Never include API keys, session tokens, or other people's private data. If something fails, stop before repeating a potentially destructive action and report the first reproducible failure.

**Current status:** automated checks pass; physical PDA, real Chrome/Torn behavior, and live faction/backend acceptance are pending. No new code build is implied by this checklist. Chat expansion remains the next planned work only after Update 3 is closed.

This is the single running changelog for the entire audit implementation, covering the extension and PDA. It explains what changed, what to test and how to try to break it. New builds and tester follow-ups will be added here; earlier entries will remain available.

## Candidate 29 — 27 October 2026 — Company and Officer actions/results

**Extension tester only:0.19.13.4 /Audit Test29.** PDA stays0.4.115/audit-test27; main is unchanged. Awaiting tester confirmation.

Officers now shows the actual restock amounts and missing OC items, not just counts. Separate Copy buttons use the same report wording as alerts; armory access does not expose OC-only reports. Failed checks label retained results as older data. Company uses retained employee controls during refresh. Its dashboard Copy reminder works through a shared clipboard helper, with selectable manual text if copying is blocked. Unknown Company values no longer display as a made-up zero.

On Torn, Company Send chat now requires a reminder explicitly loaded with Fill chat. If you edit that draft, switch company, or already sent it, Send refuses instead of overwriting/reloading your text. It never automatically sends from the dashboard.

**Test with harmless data:**

1. In Officers, configure a threshold and run the appropriate manual check. Confirm the displayed item/current/target values and missing member/item/crime details match the results. Copy the list into a harmless draft and check its text; do not send it merely for testing.
2. With armory-only access, confirm OC results/copy are absent. With OC access, check both OC stock and assigned missing-item reports. If the latest check fails, any copied retained report must clearly say it is older data. Never alter important grants solely to test this.
3. As your company director, use Copy reminder on the dashboard. If clipboard access fails, select and copy the readonly reminder below it. Regular employees must not see director reminders. Refresh while copying; employee buttons and threshold fields should retain their identity and your settings.
4. On Torn, open an employee chat and click Fill chat. Edit its text, then click Send chat: SLINK must refuse and preserve your edited draft. A fresh Fill followed by Send is an explicit real message, so use only a consenting test recipient if you test that step. A second Send must require a fresh Fill.

**Try to break it:** clipboard denied, delayed copy plus refresh, director/access removal, repeated clicks and a narrow window. Do not expose API keys. Synthetic browser checks passed at360px Torn panel/1000px dashboard, alongside the existing Company autosave and Officer/Chat editor checks. No saved-data keys, permission scopes, theme assets, API polling or backend endpoints changed. PDA/live faction acceptance remains separate, and the whole parity phase is not yet complete.

## Candidate 28 — 27 October 2026 — dashboard and Torn toolbar actions

**Extension tester only:0.19.13.3 /Audit Test28.** PDA stays0.4.115 /audit-test27; main is unchanged. Awaiting tester confirmation.

The dashboard now passes the actual click to shared toolbar actions. Both extension surfaces keep the clicked button available while a request is pending, block a repeated click on that same pending action, and recover from a failure. Disposed/revoked module actions cannot run from retained old buttons. Real-browser testing also found/fixed a lifecycle error with the Torn shell's frozen API. Officer Recaller handoff opens an extension-created Torn tab, and reports failed navigation instead of silently relying on a delayed popup. It does not retrieve any items automatically.

**Test:**

1. Open a permitted module on the extension dashboard. Use Refresh/Find targets/Add target/Settings as applicable; repeat on the Torn panel. Buttons should work without currentTarget/undefined errors.
2. During a slow request, try the same button again. The pending button should not start another copy. After an error, retry should remain possible. Keep a harmless draft open and confirm it is not replaced.
3. With officer Armory permission or admin.*, open Officers then Open Armory Recaller. It should open the faction armory, ready for the existing manual Recaller workflow. No automatic retrieval. If opening fails, the page should show a useful error and retain the Open faction armory link.
4. Switch modules/windows during a pending action and return. Old action controls must not act after their module is stopped or access is revoked. Your page selection, theme, panel size and other settings should remain.

**Try to break it:** double-click, delayed reply, deliberate offline/retry, narrow window and permission removal in an isolated tester profile. Do not change important shared officer grants merely to run a test. Report candidate, module, surface and steps, without API keys. Real browser checks passed for both surfaces at360px/1000px; live Torn/backend permission and physical PDA acceptance remain separate. This does not complete every dashboard-parity item.

## Candidate 27 — 27 October 2026 — shared stats and price freshness

**Testing only:** extension0.19.13.2 /Audit Test27; PDA0.4.115 /audit-test27. Awaiting tester confirmation. Main is unchanged.

A slow older reply can now fill a missing item price without replacing a newer price, rolling back an item name or bringing back an entry removed by a newer catalog. Missing prices stay distinguishable from a real zero. Shared personal stats no longer fail just because an otherwise valid reply lacks player level. Features that require level still report incomplete coverage; a retained older level keeps its real age instead of becoming falsely fresh. Different accounts remain separated. No formulas, settings keys, layout, permissions, theme assets or polling intervals changed.

**Test on harmless records:**

1. Open Money, Museums, Market and Abroad Stocks in turn; refresh and compare prices for the same item. A missing quote should not turn into a believable zero, and an available price should not revert when a slower response finishes.
2. Refresh your battle stats through Mugging or Leveling, then switch between those pages and reload. Your newer authenticated stats should remain. Level-dependent features should report missing data if it cannot be established, not invent a level.
3. Keep a settings/target draft open while another view refreshes. Text, selected page, theme and saved choices should remain unchanged. Repeat on PDA and the standalone extension dashboard.

**Try to break it:** refresh two compatible modules close together, switch views before replies finish, temporarily interrupt connectivity, and reopen after recovery. Report candidate/platform, the module pair and which value changed backwards; never send keys. Controlled out-of-order/partial/zero/account/write-failure cases are developer tests, not a request to edit your saved data or API responses. Physical PDA/live API acceptance is still needed.

## Candidate 26 — 27 October 2026 — emergency event performance and connection recovery

**Released to main FIRST:** extension0.19.13, PDA0.4.113. This tester follow-through is extension0.19.13.1 /Audit Test26 and PDA0.4.114 /audit-test26. No unrelated audit work was promoted.

- PDA can use a public source mirror when raw GitHub refuses a connection. Working cached startup does not wait for source downloads. Stable checks the manifest at most once per15minutes and applies discovered updates on a normal page load; the immutable tester pin uses its matching revision directly. Cold/update downloads use two workers, not all files at once.
- Xanax decoration ignores unrelated attack/log text and skips energy searches without a Xanax button. Real clicks still check current energy. Extension chat-button discovery reacts to inserted contexts/headers, not every page mutation. Existing tester focused-page/profile/lifecycle ownership is retained.
- No settings/key reset, permission/theme/asset changes, automatic recovery or added Torn API polling. Update the existing PDA script in place; never uninstall or clear data. Chrome packaged changes require its extension update.

**Test:** navigate repeatedly with an existing cache, then interrupt internet and return to a normal Torn page. SLINK should use its valid cache, without blocking Torn. First-time startup cannot work if both source hosts are unavailable and no runtime is cached. Fight/refresh a rapidly changing page; unrelated combat text should no longer trigger Xanax scans. Open a real Xanax action above750energy and confirm the warning still uses current energy; Cancel must not use it. Switch windows/lock PDA/return and check controls resume and settings persist. Check custom chat triggers still appear when a new chat/newsletter opens.

Production VM tests cover refused origins, fallback, offline cache retention, current-energy confirmation and10,000 irrelevant mutations. Real Edge MutationObservers passed on both platforms. This proves the fixed paths, not that every source of event lag is eliminated or physical PDA is certified.

## Candidate 25 — 27 October 2026 — background and page-return reliability

**Extension 0.19.11.15 / Audit Test25; PDA 0.4.112 / audit-test25.** PDA page observers now pause when hidden and reconnect once on return. Queued old page scans and pending chat sends cannot replay after resume. Target polling restarts after pagehide instead of staying stopped. Same-build reuse keeps one activity owner. Hidden/zero-size viewport events no longer reset launcher position. Extension pause subscribers are isolated against one callback failing.

Settings, credentials, storage keys, manual-only cloud recovery, permissions and theme assets are unchanged. Authorized background API policy is retained; this does not stop every network request while hidden.

**Try this on tester builds:**

- Update in place and reload once, without uninstalling or clearing data. Confirm disabled alerts, targets/notes, theme, last tab and launcher position remain.
- Open Chat, Racing, Market or a profile; background/lock and return five times. No duplicate buttons/highlights or catch-up burst should appear; target checks should resume.
- Keep a draft field open through those cycles. Text, open controls and selected page should remain. Rotate while backgrounded; launcher position should not reset.
- If a confirmed custom chat message is waiting for Torn to enable Send, leave and return. It must not send on return. Reload/confirm explicitly if still wanted.
- Extension: switch focused Torn tabs/windows; only the eligible page should scrape. PDA: visible pages should work without desktop-focus detection.

Source tests and real headless Edge observers cover hidden startup, five return cycles, stale callbacks and retained draft controls at 360px/1000px. Physical PDA lock/unlock, process suspension/termination and independent WebViews still need acceptance. The full audit is not complete.

## Candidate 24 — 27 October 2026 — PDA storage completion and retention

**PDA tester only, 0.4.111 / audit-test24.** SLINK now uses Torn PDA's app-backed storage when the installed app exposes it. Existing browser/GM data is kept and copied to native storage when missing there; no reset or automatic cloud restore is performed. Older apps without that API retain a browser-storage fallback, which does not provide native durability.

Startup now keeps add-on/unknown settings rather than rebuilding only known ones. Settings, saved targets and protected credentials/session fields use captured changes so an unchanged older snapshot does not replace newer stored values. Target deletions and independent note/name edits are retained in the tested serialized-write paths.

Target Save, source-panel Save Target, deletion and Access authentication completion now wait for write confirmation. A failed target save leaves its editor open; newer edits survive an older acknowledgement. Access shows a save failure and Retry when a write fails. Failed changes are retained for retry or a later successful save. UI choices and snoozes use the same acknowledged bridge. No new paid storage service or Torn API polling was added.

**Try this, using the tester install only:**

- Before updating, export a local backup. Update the same tester script in place (do not uninstall it), reload Torn, and confirm your API keys, disabled alerts, notes, target list, theme and last tab are retained.
- Change a Chat/add-on setting, alert choice and theme. Save a target with a note. Navigate, close/reopen PDA and confirm all of them remain.
- Edit a target and click Save, then type more while waiting. The newer draft should remain. Remove a target, navigate through other pages and confirm it does not reappear.
- If Access reports an unsaved change, keep the page open, resolve the storage/app problem and use Retry. It must not claim the failed target save succeeded. Do not deliberately clear application data or uninstall PDA for testing.
- On a PDA version with native storage, optionally clear only the app's browser cache after exporting a backup, then verify recovery. Native app-data deletion/uninstallation is not covered. On older PDA versions with no native API, browser-cache survival cannot be promised.
- Exercise multiple open Torn pages, slow app transitions and background/resume. Report exact app version and steps if values revert.

**Limits:** automated tests use real production functions with synthetic native/GM adapters, not a physical PDA installation. Torn PDA's documented store has no compare-and-swap transaction primitive, so simultaneous independent WebViews still need device/concurrency acceptance. This is not a claim that every module's old save message has been converted to awaited native acknowledgement, nor that abrupt app termination can never interrupt an in-flight write. The remaining lifecycle/provider/performance audit and final Chat expansion are still pending. Main and the extension runtime are unchanged.

## Candidate 23 — 27 October 2026 — Combined editor stability and autosave

**Extension tester only:** the remaining Officer, existing Chat, Market, Merits, Leveling and War editor work is grouped into one update. Background updates retain the controls being edited. Personal Officer stock settings, Chat highlights, Market preferences, Merits choices, and Leveling poll/Fair Fight preferences save without a separate Save click. A failed preference save keeps the choice visible with Retry.

**Actions stay deliberate:** authentication/terms, contribution-mode consent, shared faction-role policy, the advanced War settings form, saving a full Chat message-template collection, watch creation/removal, purchases and sending messages still require their own explicit action. New Chat image/GIF/mini-profile/shortcut features are not included. Native PDA storage changes are not included.

**Try to break it:**

- Officers: change two item thresholds quickly, change OC checks to 0 (manual only), then reopen. Each value must remain independent. Each role checkbox must act independently. Shared role assignments must not submit until Save. Edit another checkbox while that request is waiting; the newer choice must remain.
- Chat: edit a term, its color and enabled switch. Add/remove another term without losing the first field's text or focus. Save a message template, then keep typing while waiting; the newer text must remain.
- Market: edit watch A and click Save, then begin editing watch B while A is waiting. A's acknowledgement must not clear B's form. Background updates must not re-enable the in-flight Save button. Watch/Weaver checkboxes must act individually and stay mounted. Retry a failed toggle without having to change its desired value. A delayed edit must not recreate a watch that was removed.
- Merits: change the filter and refresh interval quickly, and pin different goals. Refresh must retain the actual dropdown controls. Each setting and pin must remain saved.
- Leveling: change poll seconds and Fair Fight limits without authenticating again. Try an empty/invalid number, then correct it. Type a newer API key while an explicit authentication request is waiting; the newer draft must not disappear. Later authentication completion must not write an older poll/FF snapshot over your saved choices.
- War: leave Settings, target filters, or med-partner assignment fields open while status updates occur. The controls should stay in place, remain singly bound, and retain your drafts. Shared settings still use explicit Save. Confirm a successful clamped value is displayed only for the submitted field; newer typing must remain. Losing officer access must remove/disable officer-only controls.
- Across the editors: repeat in a narrow Torn panel and the extension dashboard, then close/reopen and change Torn pages. A failed save must not be shown as saved. Old replies must not undo newer choices. Preferences must not force a provider refresh for every click.

**Data safety:** existing storage keys and saved records are retained, including unknown/legacy fields where these owners merge records. No settings reset, API-key deletion, automatic cloud restore, production deployment or theme-asset change is part of this batch. Physical-device/native-PDA durability and the broader audit remain separate acceptance work.

## Candidate 22 — 27 October 2026 — Museum panels and price drafts stay put

**Extension tester only:** Museums now retains each set panel, price field and button through inventory refreshes and watch actions. Open/closed sets, focus and typed maximum prices are not rebuilt from current market values. Read-only owned counts and prices still update. Existing editors remain in place if you gain enough inventory while viewing them; newly opening a completed item keeps the previous no-editor default. Genuinely removed item/set rows are removed.

**Watch actions stay deliberate:** typing, opening or refreshing Museums never creates a watch. Add to Market Watch validates a positive whole-dollar price locally, captures the item/price before waiting, and releases only that field's submitted draft after a matching confirmed watch receipt. Newer typing and other panels stay untouched. Failures or missing/mismatched confirmations keep the draft and ask you to check Market Watch before retrying. Track in Abroad Stocks is also explicit. One pending action per Museum view prevents duplicate submissions from that view.

**Try this:** open Quality of Life → Museums. Close one set, open another and type a price different from the displayed market value. Refresh inventory: the field and panels should stay put while owned/market labels update. Try blank, 0, negative and fractional prices: no watch should be submitted. Click Add to Market Watch with a valid price, then edit the price while waiting: the result must not erase your newer typing. Verify the saved watch in Market Watch and check your slot limit. Try Track in Abroad Stocks, then confirm the sets are still expanded/collapsed as you left them. Avoid repeatedly creating live duplicate watches merely to test; delayed/failed replies are covered by synthetic tests.

**Verification:** all 81 local extension/PDA commands pass. Actual service regressions cover captured inputs before authorization, positive validation, specific item/price acknowledgement, permission/slot failures and explicit Abroad delegation. Actual load-controller tests cover duplicate refreshes, read-failure recovery and stopped replies. Real-browser tests passed at 360px Shadow DOM and 1000px dashboard with production module styles/shared form guard: width fit, stable actual inputs/panels/buttons/focus, no unsolicited watches, invalid input, new typing during pending actions, duplicate-action exclusion, inventory completion updates, retained drafts after reopen, receipt/failure retry, scoped acknowledgement, authoritative removal and no late redraw after stop.

**Limits:** 0.19.11.13 / Audit Test 22, testing branch only. PDA remains Candidate 18. Museum prices are action drafts, not a new permanently autosaved preference; the confirmed watch is stored in Market Watch. This batch does not make cross-context Market/Abroad writers transaction-safe or guarantee provider refresh after watch creation; missing confirmation is reported rather than guessed. An already-authorized user action may finish after leaving the view, but must not redraw it. No main, workers, themes, keys, target data, API endpoints or Museum set definitions changed. Physical-device/live-account acceptance and remaining audit work remain open.

## Candidate 21 — 27 October 2026 — Events choice saving without rebuilding the picker

**Extension tester only:** Events already saved choices on change; it now uses the shared acknowledged save path. The picker stays enabled and mounted while saving, supports rapid changes, and shows Saving/Saved or a retained failed choice with Retry. Ordered writes preserve the last choice even when permission checks finish out of order. Other stored Events fields are no longer discarded.

**Stable guide:** refreshing the calendar cannot undo a newer selection. The same event picker, Refresh button and unchanged guide links remain in place. Calendar options update by ID, with changes deferred while you are focused on the picker or a save is pending. Published events genuinely removed from the calendar use the existing fallback; failed unavailable choices remain visibly unavailable until corrected. The existing next-event fallback and year-round Halloween guide remain available—no new date gate or forced default was added.

**Try this:** open Quality of Life → Events. Select Halloween outside its published season and confirm the guide, including Cat in Hell, is readable. Rapidly select different events, wait for Saved, switch modules and reopen. Keep the picker focused during updates: it should not be disabled/recreated. Refresh while changing the selection and confirm your new choice wins. If a save fails, the choice must stay visible with Retry rather than silently reverting. Check the existing default when no valid saved selection exists. No need to reset storage or change live account data.

**Verification:** 81/81 local extension/PDA commands pass. Actual service tests cover scoped authorization, selection order, unknown settings, invalid IDs, rejected storage/authentication recovery, lean acknowledgement and unchanged calendar runtime. Actual status-controller tests cover duplicate reads, newer selection versus delayed calendar, fresh calendar/permission metadata, failed reads and stopped-instance isolation. Real-browser checks passed at 360px Shadow DOM and 1000px dashboard using production module styles: width fit, no initial default writes, year-round guide/next-event behavior, enabled stable picker, rapid/out-of-order choices, failure/retry, guide-link identity, stale refresh, focused option deferral, new/removed calendar entries and awaited cleanup without late redraw.

**Limits:** 0.19.11.12 / Audit Test 21, testing branch only. PDA remains Candidate 18. No main, worker, theme, credentials, calendar API endpoint, Halloween upgrade order, relic guidance or basket-helper layout changes. Selection saving uses the cached calendar; existing permission-session verification can still need the access service. Tests use synthetic data, not live-account/physical-device sign-off. Remaining editors/native PDA/lifecycle/performance work and final Chat additions are still pending.

## Candidate 20 — 27 October 2026 — Money & Property autosave and independent stock alerts

**Extension tester only:** the bank comparison amount, reminder thresholds/options and individual stock affordability checkboxes save automatically. Numeric typing is briefly debounced; toggles save immediately. Saved means the local write was acknowledged. Invalid/failed drafts stay visible with status/Retry, and explicit Refresh waits for valid confirmed settings.

**Stable controls:** data updates no longer rebuild the bank input, expanded reminder section, existing stock checkboxes, links or Refresh button. Balances, property information, bank results and stock metrics still update in read-only regions. Newly discovered stock rows do not cause untouched existing settings to be submitted again. Truly removed stock rows disappear without resetting other stock alert choices.

**Persistence:** personal settings, stock toggles and snoozes merge through one local mutation owner, preserving unrelated/unknown fields and existing snoozes. Queues recover after failed writes. Feature authorization remains required for preferences and stock toggles; a slow authorization does not block local snoozes. Valid zero thresholds now stay zero rather than reverting to defaults. Saving no longer rewrites the cached financial snapshot. Post-save reminder previews read local cached status; they do not refetch balances, rates or catalogs. An expired access session may still need the existing permission service.

**Try this:** open Quality of Life → Money. Type a bank amount, wait for Saved and reopen the module. Clear the amount temporarily: it must request a number rather than showing a zero-principal result. Enter more than $2 billion and confirm the existing cap is applied after saving. Expand Reminder settings, set thresholds to 0, toggle two different stocks quickly and verify both choices after reopening. Keep inputs focused/the reminder section open during Refresh: your controls should remain in place. Check that new/removed stock rows do not affect unrelated settings. Do not clear storage or manufacture live transfers/investments to test this; the failure cases use synthetic data.

**Verification:** all 81 local extension/PDA commands pass. Actual mutation-owner regressions cover concurrent settings/stock/snooze edits, failure recovery, old/unknown data retention, normalized zero/bounds, authorization denial, preference ordering when authorization finishes out of order, and snoozing during blocked authorization. Actual status-controller tests cover cached-only reads, late replies versus newer settings, failed-read recovery and stopped instances. Real-browser tests passed at 360px Shadow DOM and 1000px dashboard with production module styles: width fit, five existing bank-term calculations, debounce/blank/zero/retry/response order, independent stock checkboxes, stable actual inputs/details/buttons, stock additions/removals, no untouched-field resubmission on blur, cached previews, invalid-draft Refresh blocking and cleanup flush.

**Limits:** extension 0.19.11.11 / Audit Test 20, testing branch only. PDA remains Candidate 18; its native storage/autosave conversion is separate. No main, worker, theme, key reset, bank-formula or API-endpoint changes. Synthetic browser tests are not real-account/physical-device sign-off. The renderer still builds detached read-only snapshot markup; this is not a completed performance-profile/serialization audit. Abrupt termination before acknowledgement remains best effort. Remaining editors and the final Chat follow-up are still pending.

## Candidate 19 — 27 October 2026 — Abroad Stocks settings autosave without closing the panel

**Extension tester only:** travel method, arrival buffer, reminder lead time, departure reminders, sound and landing recommendations now save automatically. Toggles/selects save immediately; typing is collected briefly or saved when you leave the field. Saving/Saved, invalid-number feedback and Retry distinguish pending/failed writes from confirmed settings. Explicit Refresh and departure-watch actions remain explicit.

**What stays put:** the open settings section, inputs, caret/focus, search query/mode and existing watch buttons are not rebuilt by feed/status updates or saves. Search can reach all loaded rows after a previous filter. Read-only prices, source ages, leave times and watch labels still update; rows truly removed from the authoritative response are removed rather than kept forever.

**Persistence fixes:** each edit merges into the latest settings through one recoverable background queue, preserving unrelated/unknown settings and legacy keys. Zero minutes is now a valid saved value instead of silently becoming the default. Unrelated reminder edits no longer turn automatic travel-method detection into a manual selection. A delayed property-default response cannot replace a travel method you selected while it was loading. Preference acknowledgements exclude the legacy Torn Intel key and do not fetch provider/Torn data; a coalesced cached-only status read updates leave-time presentation.

**Try this:** open Quality of Life → Abroad Stocks → Travel and alert settings. Change multiple settings quickly, wait for Saved, leave/reopen and confirm them. Set either timing to 0, temporarily clear a number, then correct it. Search by item, change the query to another item, then search by country. Keep the settings open during Refresh/the normal minute update: inputs/search must stay put. Add/remove a departure watch and check the label/count while settings remain open. Refresh with unfinished/failed input must wait for a valid confirmed preference. Existing saved values should survive the update; do not clear storage or reinstall to test.

**Verification:** 81/81 extension/PDA commands pass. Expanded actual service regressions cover concurrent disjoint edits, failed-write recovery, unknown/legacy-key retention, zero, normalization, lean acknowledgements and delayed property detection versus a manual choice. The actual status controller is exercised with old/new delayed responses, cached-only preview, watch guard and stopped instances. Real-browser checks passed at 360px Shadow DOM and 1000px dashboard with production module styles: stable actual controls/details/search/watch nodes, bounded writes, invalid/zero/retry/out-of-order saves, no preference-triggered feed refresh, search/filter recovery, explicit Refresh and cleanup flush. Synthetic responses, not authenticated provider/device acceptance.

**Limits:** 0.19.11.10 / Audit Test 19 stays on the testing branch. PDA runtime remains Candidate 18; native PDA storage/autosave work is still separate. No main, worker, theme, credential reset or provider-integration change. Watch-list/snooze background mutation consolidation is not claimed complete here. Abrupt process termination before acknowledgement is still best effort. Chat media, mini profiles and optional shortcuts such as /tableflip remain queued after existing audit work; nothing is auto-sent.

## Candidate 18 — 26 October 2026 — Racing saved progress, stable nicknames and car highlights

**Extension:** Racing now saves nickname changes through one background owner, one build/field at a time. Typing is briefly debounced, saves are acknowledged, and failures show Retry instead of silently claiming success. Blank/over-22-character drafts remain visible but are not saved. Existing garage names/completion progress and unknown stored fields are preserved in the same storage key. Needed/Completed/All and completion actions no longer rebuild the nickname fields; they first flush valid pending names.

**Extension and PDA:** fixed a reproduced highlighting failure involving hidden/stale race or matching-car rows before the visible ones. The assistant now uses visible rows from the supplied Torn selectors and responds to relevant visibility/class/style and text changes, not only inserted/removed elements. It ignores its own highlight class changes to avoid self-triggered scans, and ignores unrelated attribute changes. PDA's additional Racing observer is separate from Market/profile readers and disconnects in the background. Recommendations still require a completed build and matching nickname, and never select/click cars automatically.

**Try this:** keep existing Racing progress, rename a car, wait for Saved, switch views/modules and reopen. Rapidly change different builds, complete/uncomplete one, and use Use suggestion. Temporarily enter 23 characters: it should warn, retain your typing and refuse completion/view actions until corrected. On Raceway, join an official race with a saved completed build and exact matching nickname; the visible car should highlight even after Torn changes/replaces the list. Switch away/back and check recovery. Confirm custom races, uncompleted builds and absent names do not recommend an unrelated car. Check both clients and current native DOM; the reproduced hidden-row case may not explain every reported live failure.

**Verification:** all 81 local extension/PDA commands pass. Expanded queue regressions cover disjoint build/name/completion edits, failure recovery, normalization, invalid-name rejection, legacy/unknown-field retention and absence of direct whole-garage UI writes. Both DOM regressions cover hidden track/car rows, idempotence, list replacement and foreground gating. Isolated styled browser checks use the real extension module/shared helper plus actual PDA highlight functions: narrow/desktop fit, bounded writes, invalid names, retry, out-of-order replies, mounted-node identity, completion/views/reset, cleanup flush, supplied selectors, dynamic/hidden rows, no auto-click, and active PDA with hasFocus=false.

**Limits:** extension tester 0.19.11.9 / Audit Test 18; PDA tester 0.4.110 / 0.4.110-audit-test18 receives the highlight fix only, not native storage/autosave migration. Synthetic browser tests are not physical PDA or authenticated live-race sign-off. No main promotion, settings reset, key/target migration, worker or theme changes. Abrupt termination before save acknowledgement remains best effort.

## Candidate 17 — 26 October 2026 — Company alert thresholds save as you type

**Extension tester only:** Company now saves your personal addiction-alert thresholds automatically. There is no Save alerts button. Typing is collected briefly before saving; leaving the field saves immediately. A small message confirms Saving/Saved, flags an unfinished number, or offers Retry after a failure. Director employee thresholds remain director-only.

**Try this:** open Quality of Life → Company, change your threshold, wait for Saved, then switch modules and reopen. Change it again while pressing Refresh: the input should keep its value/focus instead of being rebuilt. Clear the number temporarily: it must not silently become zero. If you are a director, edit both thresholds quickly and confirm both survive reopening. Ordinary employees must not see the employee/director section. Refresh, profile links, Copy reminder/Fill chat and Send chat remain deliberate actions; changing a threshold must never send a message or refresh the roster.

**Verification:** all 81 local extension/PDA commands pass, including expanded real Company controller and background mutation-owner regressions. Isolated real-browser checks passed at 360px Shadow DOM and 1000px dashboard using production module styles and synthetic replies: debounce/write count, blank numbers, newer/out-of-order responses, failed-save retry, actual input-node identity during refresh, stale-response fencing, cleanup flush and director visibility loss. Existing settings and unknown stored fields are preserved; no keys, targets, cloud recovery or storage-key migration.

**Limits:** this batch does not change native PDA runtime/storage behavior, other editors, shared company policy, job-point API/formulas or company alert delivery. Physical-device/authenticated acceptance remains necessary. Normal cleanup flushes valid drafts; abrupt browser/process death before acknowledgement cannot guarantee unsubmitted typing. Main, workers and theme assets are unchanged.

## Candidate 16 — 26 October 2026 — Bounties personal settings autosave

Extension tester **0.19.11.7 / Audit Test 16**, testing branch only. Main, PDA, workers and theme assets are unchanged. PDA remains 0.4.109 / Audit Test 10. This is the first consumer of the new shared autosave helper, not a claim that all settings throughout SLINK have been converted.

- Bounties toggles/dropdowns save immediately. Numbers save after a 600ms typing pause or when you leave the field. There is no Save button for these preferences. The small status shows Saving, Saved, invalid input or a failed save with Retry. Blank/incomplete numbers stay as drafts rather than being turned into a default.
- API-key inputs are excluded from autosave. Their separate button is labelled **Save API keys**; typing or leaving a key field does not authenticate or save it automatically. Blank key fields continue to keep existing saved keys.
- The open editor stays mounted through writes and result updates. Newer typing and rapid checkbox changes survive delayed/out-of-order replies. Close settings flushes valid pending preferences rather than cancelling them; invalid/failed edits keep the editor open with a message. Leaving the module flushes pending valid preferences and retains failed/incomplete local drafts for return.
- Filter edits do not restart the crawl or make Torn requests per keystroke. Settings acknowledgement is lightweight and does not read the full player-intelligence cache. Cached result refreshes are coalesced after editing settles. A scan already scheduled before an edit resumes after the write instead of silently stopping. Enabling the tracker intentionally resumes its normal scheduler.
- Manual Refresh/Restart waits for valid saved preferences and does not proceed if saving fails. Ordinary page navigation also attempts to flush pending edits. As with any autosave, an abrupt process/browser kill before acknowledgement cannot guarantee preservation of unfinished typing; **Saved** means the write was acknowledged.

**What to test in both extension surfaces:** open Bounties settings, toggle individual options and change dropdowns without pressing Save API keys. Type a number in several steps: it should not save on every keystroke, but should show Saved after a pause or leaving the field. Clear a numeric field temporarily; it should stay blank and unsaved, not become zero/default. Correct it and check recovery. Try a value above its allowed range and confirm the returned normalized value without losing a newer edit. Close/reopen, change modules and reload after Saved; preferences should remain. Try rapid toggles and editing while results refresh. API keys should remain manual. Never clear storage or remove keys to manufacture failures; automated checks inject them safely.

**Verification:** **81/81** test commands pass, with substantially expanded assertions in the existing Bounties editor/storage tests. Coverage includes debounce/write counts, validation, invalid acknowledgements, rapid toggles, per-field patches, failed/retried/newer drafts, stable input identity, explicit credentials, deferred local result reads, scan resumption, navigation flush and stop/resume with an incomplete draft. Storage tests confirm autosave neither resets the crawl nor reads the full player cache. A real-browser fixture uses production module styles at 360px overlay and 1000px dashboard, checks width fit, and verifies no startup default writes or automatic scan restarts. Synthetic data only; physical PDA/native storage and other editors remain pending.

## Candidate 15 — 26 October 2026 — War settings save what you actually submitted

Extension tester **0.19.11.6 / Audit Test 15**, testing branch only. Main, PDA and workers are unchanged. PDA remains 0.4.109 / Audit Test 10. This covers the Torn War settings save flow and the background local-settings owner also used by the extension dashboard; it does not claim all War/dashboard editors or PDA are finished.

- War now captures all settings when you press Save. Editing a faction field while the first request is pending no longer changes that earlier submission. Newer edits remain available to save afterward.
- Local settings/terms and faction settings are acknowledged separately. If local settings save but the faction request fails, the message explains the partial result; faction drafts remain intact. Confirmed terms do not stay as an old checked input. A second Save is blocked while the first is pending, and Clear session cannot interrupt that save.
- Unchanged local fields are not resubmitted. Unchanged faction settings no longer trigger a faction-wide write. Officer access is checked again before the faction request; loss of access does not silently submit or mark those drafts saved.
- Old cycle/action responses cannot roll confirmed settings, faction configuration or terms presentation backward. Runtime results and permission/session information still update normally. Pending local setting writes are serialized and recover after failure; terms/authentication/network waits do not block unrelated local commits. Blank key fields retain existing keys.

**What to test:** in Torn's War Settings, change display mode and a faction setting if you are an officer. Press Save, then type a different faction value while it waits. The first submission should use the original values; the later edit should remain unsaved. Save again and confirm the returned validated values. Try double Save clicks, changing War sub-tabs during a save, and letting normal refreshes run. Regular members must not gain faction controls. If a save fails, read whether local settings succeeded and retry the retained faction edit. Never clear storage, remove keys or change live faction policy merely to manufacture an error; failure cases are covered automatically.

**Verification:** **81/81** local extension/PDA commands pass. New regression executes the real save/revision helpers with delayed/failed replies, partial acknowledgement, newer typing, officer revocation, no-change saves and stopped-module isolation. It executes the actual background mutation function with concurrent disjoint edits, rejected writes/recovery, saved-key retention and blocked network continuations. Real-browser checks of the production settings template/save controller and core form guard passed at 360px Shadow DOM and 1000px document scope. These use fake responses, not a real authenticated faction or full War-page acceptance test.

**Limits:** a local save plus a faction save are not one transaction. The faction endpoint still receives its existing full configuration snapshot when faction fields change; simultaneous edits by different officers are not made conflict-free by this update. General War rendering is still guarded/restored rather than fully converted to Mugging's stable-control rendering. This batch captures target sort consistently but does not change its existing reload-persistence policy. Remaining editor/PDA storage work continues separately.

## Candidate 14 — 26 October 2026 — Mugging autosave without rebuilding the controls

Extension tester **0.19.11.5 / Audit Test 14**, testing branch only. Main, PDA and live workers are unchanged. PDA remains 0.4.109 / Audit Test 10. This batch covers the shared Mugging UI in the extension overlay and standalone dashboard; it does not claim every editor or PDA has been converted.

- Changing a Mugging filter now saves only that field, rather than resubmitting the other filters. Values and the enable checkbox are confirmed before changing the saved model. Failed saves leave the visible edit available to retry. An older reply cannot undo a newer confirmed choice.
- Mugging's filter controls now stay mounted during saves and cache updates. Their actual input elements are no longer rebuilt on each update. Unchanged results and target buttons stay mounted too. Only confirmed normalization may change a submitted field, and typing made after that submission remains protected.
- Both Find Targets buttons submit edited/pending fields, wait for confirmation and use the confirmed values. A double click while waiting does not start duplicate searches. If settings fail to save, no search starts—even if another field saved successfully meanwhile.
- Older visibility/assignment responses cannot replace a newer assignment or own-stat display. Rapid enable/disable replies cannot reverse the latest confirmed checkbox state or start contributor work for an already superseded toggle. Completed work cannot redraw a stopped module.

**What to test on both extension surfaces:** change one Mugging filter, then immediately edit another while saves finish. Try a target count above 100 and an FF value above 3; after confirmation they should show the allowed values, without touching a newer edit. Click each Find Targets button directly from a focused input. Try quick double clicks, rapid enable/disable toggles, refreshes, and switching away/back. Verify saved values survive page reload and existing target results/actions remain usable. Report a save error without clearing data or reauthenticating unnecessarily. Existing personal battle-stat sources, Fair Fight formula, permission gates, request budgets and credentials are unchanged.

**Verification:** all **80/80** local extension/PDA test commands pass. New executable autosave test uses the actual module/form guard with failed, overlapping and out-of-order replies, per-field payloads, newer typing, normalized Find, duplicate clicks, failed Find plus unrelated successful edit, stale caches and stop isolation. It asserts one full editor mount and the same input object throughout updates. The real-browser fixture passed at 360px overlay Shadow DOM and 1000px dashboard document, including native blur events, immediate save acknowledgement, both Find buttons and unchanged target-button identity. Synthetic data only; no real profile, keys or API requests. Native PDA acceptance and remaining audit phases are still pending.

## Candidate 13 — 26 October 2026 — Bounties settings stay under your control

Extension tester **0.19.11.4 / Audit Test 13**. Testing branch only: no main release, worker deployment or PDA runtime change. PDA remains 0.4.109 / Audit Test 10. This is the next partial editable-settings batch, not a claim that every editor has been converted.

- Bounties now keeps your settings editor open after Save so you can see the saved values. Failed saves keep your typed values and checkboxes. Typing while a save is pending remains an unsaved draft rather than being overwritten by that earlier save.
- Saved values are shown after validation (for example, FF batches/minute above 20 returns to 20). Saved API-key text leaves the input after acknowledgement; blank key fields still keep the existing keys. No saved credentials or settings are reset.
- Save submits only changed fields. Concurrent changes to different Bounties settings are merged in the background, not written as competing full snapshots. A failed write does not break later saves. Older scan/activity responses cannot roll newly saved settings back.
- Background refreshes do not close the editor. Pausing/resuming the retained module keeps its open editor and draft. Clicking Close settings is an explicit cancel of that editor's unsaved changes; reopening shows saved settings. A second Save click while one is pending does not submit twice.

**What to test in both the Torn overlay and extension dashboard:** open Bounties settings, change several numbers and checkboxes, and let the scan update while you type. Save, reopen, refresh and switch pages: verify the saved settings persist. Enter 999 for FF batches/minute and Save; it should show 20, not keep a stale 999. Leave saved key fields blank and check the tracker remains configured. Close without saving and reopen; only those unsaved changes should be discarded. Resize and scroll while editing. If you use two windows, change different fields and save from each; one window's untouched fields must not undo the other's change. Do not clear storage, uninstall or expose real API keys to test failures.

**Verification:** all **79/79** local extension/PDA commands pass. New executable module regression uses the real form guard and save handlers, delayed/failed acknowledgements, late scans, duplicate clicks, key drafts, normalization, cancel and stop/resume. Background regression executes the actual Bounties service with concurrent patch writes, injected storage failure/recovery, key retention/redaction and unknown saved-field preservation. A separate real-browser Shadow DOM interaction check passed at 360px and 1000px with fake data and blocked network. This is not physical PDA testing, a real Torn purchase or completion of the remaining editors/native-storage work.

## Batch 12 — 26 October 2026 — regression checks repaired

This is a **testing-branch-only test/documentation update**, not a new gameplay release. Install links and build versions stay the same: extension 0.19.11.3 / Audit Test 11, PDA 0.4.109 / Audit Test 10. No runtime, theme, settings, API keys or saved targets changed. No main branch or live worker update.

- All three remaining baseline test failures are resolved. The full local inventory now passes **78/78 commands**, including the new purchase-control regression. This does not mean the entire audit or real-device acceptance testing is complete.
- The extension validator now checks today's shared dashboard host, officer access routes and focus-guarded chat helper. It no longer demands the intentionally removed Armory row decorations. The working Armory Recaller is tested by executing its retrieval, confirmation, focus and recovery functions.
- Added executable checks that SLINK Buy keeps its original button position while Torn opens purchase controls, recovers from stuck transitions, respects disabled/read-only inputs, and does not mistake Torn's temporarily disabled Buy button for a sold-out listing.
- PDA checks now execute open/close behavior for bubble, bar and chat-button modes, verifying that the saved page survives, alerts remain counted, and the right launcher regains focus. Armory-only permissions are checked separately from full War officer access.
- The combined background test now provides the browser cancellation API used by Fair Fight and advances simulated time instead of waiting for real rate-limit delays. Its existing Leveling, War, permissions, timers and Stack-mode assertions remain in place. No production limiter or Fair Fight formula was changed.

**What testers should try:** keep using the existing tester builds. Switch between Alerts, Combat and Quality of Life, close/reopen and reload, and confirm the exact saved page returns. Try each minimize mode. On a harmless Market listing, verify highlighting and control placement without purchasing unwanted items. Officers should check the Recaller remains available; Armory-only access must not unlock War settings. Continue the earlier settings, quota-migration and draft-preservation tests below. These are manual acceptance checks, not claims that a real PDA device or authenticated Torn purchase was tested automatically.

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

</details>
