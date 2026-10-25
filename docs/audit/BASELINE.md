# Audit test baseline and classification

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
