# Audit test baseline and classification

## Candidate 15 — War settings save controller/local mutation queue, 26 October 2026

All **81/81** commands pass. tests/war-settings.test.mjs executes actual extracted module functions settingsTickets, acknowledgeSettings, saveWarSettings and requestWarStatus. Captured-before-await payloads, local-vs-faction acknowledgement boundaries, partial failure, preserved newer revisions, duplicate saves, unchanged saves, officer loss and no stopped-module redraw are covered. Generation fencing preserves newly confirmed settings/config/terms but deliberately not old session/role data; fresh runtime remains usable. Existing whole background route/War regressions also pass.

The same test executes the actual background defaults/settings/saveSettings functions with controlled storage and network dependencies. Concurrent disjoint writes merge, failed writes do not poison the queue, blanks retain keys, unknown stored fields survive and numeric bounds are returned. Explicit storage-write completion signals prove blocked public-status/terms waits do not hold the mutation queue; no arbitrary timing sleeps. This does not make separate Chrome writes or local/remote config writes one transaction.

Local qa-war-settings.cjs uses real browser document/Shadow DOM, actual settingsHtml/save controller and shared form guard at 1000px/360px. Tests pending edits, partial failure, terms release, validated returned values and newer typing. Initial fixture omitted the module-local SLINK alias; diagnosed from the captured pre-request error and supplied that alias without changing production behavior. Approved isolated elevated browser run then passed. Not a full module bootstrap or real faction/API acceptance test. Source status calls now share a revision fence; normal War controls still use the existing guarded rerender, unlike Mugging's persistent DOM. Faction endpoint still accepts a complete configuration snapshot for changed faction forms; cross-officer conflict handling and target-sort reload persistence are not solved here. No main/PDA/worker/assets/provider/budget/permission contract changes.

## Candidate 14 — Mugging acknowledgement/stable controls, 26 October 2026

Full inventory **80/80** commands passed. New tests/mugging-editor.test.mjs executes the actual module and shared form guard, delayed/failed/out-of-order replies and stale visibility/assignment results. Checks per-field patch payloads, unchanged other fields, normalized acknowledgements, newer typing, rapid checkbox toggles, Find ordering/double clicks/failure plus unrelated save, stopped-instance isolation, one full mount and exact input identity. Existing settings-queue tests continue covering the unchanged background Mugging queue. No service/formula/budget/provider changes.

Mugging uses per-control guard tickets and applies confirmed normalized values only where that revision is still current. Save requests go immediately to the existing background owner, not a second local queue that could reorder commits across module restarts. Reply sequence fences model assignment; cache generation fences stale results. Failure remains a rejection so Find cannot proceed on a failed submission merely because an unrelated field succeeded later. DOM controls are mounted once per module instance; only changed summary/target markup and message/busy state are updated. Unchanged target actions retain identity too.

Local qa-mugging-editor.cjs real-browser check passed narrow overlay Shadow DOM (360px) and dashboard document-root protection (1000px). Covers immediate acknowledgement during native blur before both Find clicks, failed/overlapping replies and stable input/target-button identity. Initial browser fixture incorrectly acknowledged the native blur's 2.1 edit as 3; corrected the synthetic replies to match submitted values, not production behavior. Unit DOM fixture needed initial summary markup once unchanged-region writes were correctly skipped. Final failed-Find regression additionally covers a newer unrelated successful save. Approved elevated isolated profile, mocked all network, no user profile/API keys. Physical PDA behavior not claimed. Candidate is extension-only; all previous counts below are historical.

## Candidate 13 — Bounties explicit editor commits, 26 October 2026

All **79/79** local commands passed after final source/version changes. Added bounties-editor.test.mjs; extended settings-queue.test.mjs to execute the actual Bounties service/public status. Module test loads real form-state/module code in a VM DOM fixture and executes registered handlers. Coverage: failed-save numeric/checkbox/password drafts, pending double-click coalescing, changed-only payloads, normalized successful values, typing during pending save, stale scan responses, explicit cancel, retained open editor across stop/resume and no stopped-instance redraw. Existing guard tests cover caret/selection/scroll behavior.

Background queue now reads current storage within each serialized mutation, preserves unknown stored fields, retains blank keys, returns redacted normalized public settings and recovers after write rejection. Public status/migration stays outside the settings mutation queue. Concurrent scan-runtime writes are not made globally transactional by this patch. VM tests do not establish native PDA storage guarantees.

qa-bounties-editor.cjs local isolated Playwright fixture additionally ran real MutationObserver/Shadow DOM/input/button behavior at 360px and 1000px. Initial restricted Edge launch failed; approved elevated temporary-profile run succeeded. No real API keys, user profile or network used. No theme/layout asset changes. Test-only core shell fixture is not full authenticated Torn acceptance. This candidate modifies only extension Bounties plus release metadata/tests/docs; PDA unchanged. Remaining editors and Phase 2/3 acceptance work remain open.

## Batch 12 — baseline closure, 26 October 2026

Full local inventory **78/78 commands passed**. Added purchase-controls.test.mjs; repaired background.test.mjs, validate-extension.mjs and PDA test-overlay.mjs. Runtime/build versions unchanged; this batch changes only tests, test entry points and documentation.

The general validator's eleven obsolete expectations used old Market function names/attributes, inline Faction Chat focus checks, removed Armory row decoration, direct dashboard module startup and old officer routes/admin-only module registration. Replaced with current contracts, executable purchase helper checks, maintained Armory retrieval and shared dashboard-host regressions. Native Armory restructuring remains explicitly forbidden, while the Recaller stays covered. PDA's seven obsolete expectations concerned chat-mode launcher visibility, legitimate landscape bar CSS, old Market markers/text and previously combined officer tabs. Retained all other static safety checks and added actual open/close and scope-isolation execution.

Background fixture now supplies AbortController, previously missing from the VM despite production HTTP using it for FF requests. Its shared API limiter was also waiting in real time after earlier test routes filled the ledger. A fixture-only Date plus cancellable immediate timers advance simulated time after promise work, preserving production limiter/HTTP code and all route assertions. The fresh-energy test explicitly advances the same clock. FF local refinement, War estimates, Stack mode, timer and permissions assertions now execute and pass rather than stopping at timeouts. Dedicated limiter/backoff tests also remain passing.

This is not a claim of live API correctness, physical PDA storage guarantees, real purchases or full audit completion. Remaining Phase 2/3 editor/lifecycle/native-device work, dashboard acceptance and owner-approved Phase 6 update policy are still open. Earlier counts below are historical.

## Candidate 11 — extension player-cache storage

Full inventory 74/77 pass; same three outstanding baseline failures. New tests/player-intelligence-storage.test.mjs covers the migration and service with a transactional fault-injection IndexedDB fixture. It reproduces quota rejection with a 7.5 MB intelligence cache, verifies exact preservation by content hash, frees Chrome quota only after commit, and confirms a War-sized write then succeeds. Tests also cover per-record updates, reopen, stale rollback legacy merge, failed write queue recovery, migration abort after request success, cleanup failure/retry and detecting a legacy change before deletion. qa-player-intelligence-storage.cjs is a local real-browser fixture, not an installed-extension acceptance test; it independently validates the actual IndexedDB transaction semantics and quota simulation. Final targeted checks rerun after the last cleanup guard passed.

No settings/target/cache-estimate eviction or new extension permission. Only the obsolete Chrome aggregate copy is removed after database commit. Raw simultaneous Chrome imports and IndexedDB do not share a global transaction; tester instructions require not editing/importing raw legacy cache during migration. Candidate remains testing-only pending review and explicit main promotion.

## Candidate 10 — 26 October 2026

Full inventory: **73/76** pass, including the startup hotfix regression and three new travel/company-safety commands. Original Company, Abroad Stocks and Target List integration scripts now pass. Company fixture used individual CompanyId where OpenAPI UserCompanyPoints.company.id is CompanyTypeId. Corrected the fixture (with unrelated-type negative coverage) rather than corrupting the existing type-based production lookup. Once that assertion was reached, the same script exposed an actual null-self alert crash; guarded it in extension and PDA with director/snooze regressions.

Abroad's Mexico private-flight assertion exposed a real calculation bug. Verified official Torn Wiki Travel (26 October): Private is WLT, Business is faster; transport multipliers were swapped, and UK/UAE/Switzerland times were stale. Both clients now use the exact without-book destination/method table rather than rounding multipliers. New regression checks all 44 combinations plus buffers/departure/unknown-country behavior. The old background import assertion was repaired to match grouped imports; that original script passes without changing its expected Mexico private result.

Target List integration now executes the actual War and Outside Save Target bindings. General validation now follows the shared catalog provider/current Market DOM markers; it still fails later at a historical quickPurchaseAnchor pattern. PDA overlay now discovers runtime via the manifest but fails later at the old launcher.hidden=false pattern. These are partial harness repairs, not green scripts. Background still times out at leveling.cycle.prepare in the bounded combined fixture.

Remaining three failed scripts are unchanged in count and preserved in full: extension background.test.mjs, validate-extension.mjs; PDA test-overlay.mjs. Company/Abroad contract questions are resolved using https://www.torn.com/swagger/openapi.json and https://wiki.torn.com/wiki/Travel, not assumptions or relaxed assertions. No main publication or live worker change in this audit batch.

## Candidate 8 — 26 October 2026

Current inventory **66/72 commands pass**. Another six original scripts now pass: PDA armory, reminders, module-activity, market-dom, travel-safety; extension permissions-sweep. Tests use the manifest runtime and actual functions/predicates, including PDA visibility rather than desktop focus, independent activity clocks, shared-capacity bounds, cooldown freshness, no-permission travel safety and exact/admin/denied module grants.

Repairing the combined background harness exposed a real behavior defect: Weaver detail polling ignored per-item nextCheckAt when an unrelated watch changed. Both clients now filter to due consumers unless forced. New tests/weaver-due.test.mjs and PDA test-weaver-due.mjs cover cached, invalidated, forced, retry-delayed, shared manual/pricelist items. The original background request-count assertion was retained and succeeds past this section after the fix; it was not relaxed from four requests to six.

Remaining six failures: extension Abroad travel-time contract, Company job-point contract, Target List source-pattern fixture, general Market source-pattern validation, combined background fixture; PDA overlay version/discovery fixture. Background listener registration/dispatch, initialization, crypto and storage-namespace problems are repaired. The long fixture now reaches Leveling: a real-clock run eventually reported FFScouter result not applied; the bounded inventory reports a 15-second leveling.cycle.prepare timeout. Neither establishes a production FF defect; controlled clock/limiter and current personal-stat fixtures are the next investigation. Do not remove its assertions or increase production budgets to make it pass.

No original test removed/skipped. Production change is limited to redundant Weaver detail requests; saved data and gameplay formulas unchanged. Historical inventories below are not the current count.

## Candidate 7 — 26 October 2026

Current complete inventory: **58/70** test/build commands pass. Six original failures are repaired: extension core.test.mjs, mugging.test.mjs, travel-safety.test.mjs; PDA test-mugging.mjs, test-racing.mjs, test-timestamps.mjs. They retain their safety/behavior assertions while using current source discovery and contracts. Newly reachable stale fixture expectations were corrected: backend-issued admin.* applies to any granted user, player IDs stay outside chat profile anchors, and a missing-unique alert requires a crime catalog/completion snapshot. No production permission, alert, time, FF or travel formula changed.

PDA test-support/runtime.mjs discovers fragments in manifest order, checks launcher/package/runtime revision consistency and extracts functions with JavaScript parsing rather than historical indentation. Its new executable regression passes. Three already-working PDA scripts and the tester-channel test now use version consistency instead of literals that would fail on the next release.

**Still failing (12):** extension abroad-stocks, background, company, permissions-sweep, target-list-integrations and validate-extension; PDA armory, market-dom, module-activity, overlay, reminders and travel-safety. Original classifications below remain the next-action guide for those scripts. All failures remain in the inventory; no test was deleted or skipped. Company job-point and Abroad travel-time disagreements remain unresolved contracts, not proven production defects. The next baseline batch should repair listener dispatch and remaining source discovery before deciding whether later assertions expose behavior defects.

Historical entries below describe the earlier state, not the current pass count. Main received separately approved Mugging-only hotfixes; Candidate 7 itself is side-branch-only.

Baseline source: extension 6c249c2384c8af236f236b73d4921d86d3aa1cf9 and SLINK-PDA 43cf003370750ab30dfd2945870ed7f9955d239e. Main is unchanged. Candidate 1 adds four executable regression scripts and a focused `test:audit` command per client.

On 24 October 2026, all candidate test scripts were run individually against isolated local source copies. **39 of 57 scripts passed; 18 failed.** The failure inventory matches the independent audit.

On 25 October 2026, candidate 2 passed 42/60 scripts, retaining these same 18 baseline failures. Three additional executable regression scripts cover arbitration/lifecycle, serialized settings and PDA page activity. Market DOM fixtures now distinguish the extension ownership adapter from PDA visibility; PDA readiness fixtures match candidate metadata. A real headless Edge fixture passed repeated Racing resume, one click moving the intended build out of Needed, stable labels and no automatic scrolling. No native-device validation is claimed. These are script exits, not individual assertion counts. The focused candidate checks pass; the full legacy suite does not.

| Client | Script | Classification / next action |
|---|---|---|
| Extension | abroad-stocks.test.mjs | Unresolved travel-time fixture/contract disagreement. Verify current travel rules before changing implementation or expectation. |
| Extension | company.test.mjs | Unresolved job-point fixture/contract disagreement. Inspect the actual expected/returned shape. |
| Extension | background.test.mjs | Test assumes exactly one message listener. Test route behavior across the separate activity and service listeners instead. |
| Extension | core.test.mjs | Historical runtime-version literal; replace with manifest/package consistency checks. |
| Extension | mugging.test.mjs | Historical version literal; retain its attack-safety assertions after repairing discovery. |
| Extension | permissions-sweep.test.mjs | Expects scope literals inside modules that use registered core constants. Test actual permission predicates and allowed/denied behavior. |
| Extension | target-list-integrations.test.mjs | Obsolete source-text pattern. Verify Save Target routing and stored source values behaviorally. |
| Extension | travel-safety.test.mjs | Broken fixture/source path; load the current core source without altering gameplay logic. |
| Extension | validate-extension.mjs | Obsolete Market markup/function assertions. Retain actual highlighted-buy invariants and use existing executable Market DOM tests. |
| PDA | test-armory.mjs | Old discovery/function-name expectation; exercise current direct runtime fragments. |
| PDA | test-market-dom.mjs | Obsolete expected purchase-helper name. Verify current behavior before changing tests. |
| PDA | test-module-activity.mjs | Looks for an old constant/implementation in the launcher rather than current fragments. |
| PDA | test-mugging.mjs | Historical version literal. |
| PDA | test-overlay.mjs | Historical version literal and old monolithic entry point. |
| PDA | test-racing.mjs | Historical version literal; new Racing DOM regression runs independently. |
| PDA | test-reminders.mjs | Searches launcher for runtime helper `finite`; repair runtime discovery. |
| PDA | test-timestamps.mjs | Runtime-discovery/assertion failure; investigate intended timestamp units before modifying logic. |
| PDA | test-travel-safety.mjs | Expects a removed Travel Safety permission despite the feature's intentional headless/unpermissioned design. Preserve safety behavior tests. |

Candidate 3 retains the 18 classified baseline failures, adds explicit form-commit regressions for both clients and integrates the two main hotfix regressions. Its browser checks cover actual Target List delayed-save and cancellation behavior plus PDA Shadow DOM focus transitions. The Faction Chat fixture now loads its real format dependency rather than an incomplete API stub.

Do not delete these tests, silently skip them or rewrite production behavior just to pass them. Classification is triage, not proof that all later assertions in each script would pass. Repair incrementally with the relevant phase. The original audit's full stdout/stderr remains preserved locally; candidate results are recorded in the implementation checkpoint.

Developer-only write-failure injection uses synthetic storage; ordinary testers should not delete saved data or intentionally corrupt their installation. The Racing browser fixture check passed in isolated headless Edge: one settled label, one replacement when Torn's car list is replaced, zero automatic scroll calls and cleanup on stop. This is not a live Torn/PDA production performance measurement.
