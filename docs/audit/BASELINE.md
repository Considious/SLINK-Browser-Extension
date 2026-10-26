# Audit test baseline and classification

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
