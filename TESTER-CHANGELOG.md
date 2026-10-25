# SLINK tester changelog

This is the single running changelog for the entire audit implementation, covering the extension and PDA. It explains what changed, what to test and how to try to break it. New builds and tester follow-ups will be added here; earlier entries will remain available.

## Candidate 2 — 25 October 2026 — awaiting combined tester review

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
