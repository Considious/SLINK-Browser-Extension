# SLINK tester changelog

This is the single running changelog for the entire audit implementation, covering the extension and PDA. It explains what changed, what to test and how to try to break it. New builds and tester follow-ups will be added here; earlier entries will remain available.

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
