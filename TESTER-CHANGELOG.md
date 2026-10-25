# SLINK tester changelog

This is the single running changelog for the entire audit implementation, covering the extension and PDA. It explains what changed, what to test and how to try to break it. New builds and tester follow-ups will be added here; earlier entries will remain available.

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
