# SLINK audit tester build — candidate 36

Current builds: extension **0.19.13.9**, PDA **0.4.121**. Open a native Torn private, faction or company chat and click **✦** in its header, beside minimize. The menu now offers **Custom buttons / GIFs / Stickers**. QOL → Chat remains available for configuration. See Candidate 36 in the single tester changelog. Main/stable remains untouched.

Current builds: extension **0.19.13.8**, PDA **0.4.120**. Quality of Life → Chat's existing optional media picker now has GIFs/Stickers tabs, one query field and separate GIPHY/ChatSticker sections. No automatic sending. See Candidate 35 in the single TESTER-CHANGELOG.md. Earlier version notes below are historical; main/stable remains untouched.

Current combined builds: extension **0.19.13.7** and PDA **0.4.119**. Optional Torn-page theming is included and initially off. Enable “Apply my SLINK theme to Torn” beside the existing theme controls. Use Candidate 34 at the top of TESTER-CHANGELOG.md for downloads, setup and the combined page checklist. Older entries below describe prior work; main/stable is unchanged.

Extension 0.19.13.5 / Audit Test 32 closes the extension onboarding-alert access and refresh-state regressions. PDA remains 0.4.117 / audit-test31. Main/stable is unchanged. Use the single cumulative TESTER-CHANGELOG.md for the install, action, permission and break-it checklist; no new Chat features are included.

Extension0.19.13.3 /Audit Test28 fixes shared toolbar click handling on the standalone dashboard and Torn shell, including stable clicked-button access across awaits, pending-click exclusion, failure recovery and revoked actions. The frozen shell API now works through lifecycle guards. Officer Recaller handoff uses extension tab creation and reports rejection. PDA stays0.4.115 /audit-test27; main is unchanged. See the single TESTER-CHANGELOG.md.

Extension0.19.13.2 /Audit Test27 and PDA0.4.115 /audit-test27 improve shared-provider partial/out-of-order response handling. No main promotion, UI redesign, setting-key migration, formula change or extra polling. Use the single TESTER-CHANGELOG.md for cross-module price/stats tests and retained earlier checks.

Extension0.19.13.1 /Audit Test26 carries main's emergency attack-mutation and chat-context filtering while preserving tester lifecycle/storage/editor work. PDA0.4.114 carries refused-source recovery and immutable cache-first loading. Main received the isolated fix first as extension0.19.13 /PDA0.4.113. Use the single cumulative TESTER-CHANGELOG.md.

Extension 0.19.11.15 / Audit Test25 isolates activity subscribers so one failing callback cannot block the others from pausing. PDA 0.4.112 adds background/page-return fixes. Use the single TESTER-CHANGELOG.md for combined testing; main is unchanged. Previous editor/storage acceptance checks remain relevant.

Current batch: stable Officer, existing Chat, Market, Merits, Leveling and War editors; field-level personal preference saves and retry; captured explicit actions; serialized local mutation owners; dashboard response fences; retained controls and duplicate-binding protection. Credentials/terms, contribution mode, advanced War/shared-policy saves, full Chat template saves, watch creation/removal and gameplay/message actions remain explicit. New Chat features and native PDA storage work are separate. Use the single running TESTER-CHANGELOG.md for the complete test checklist.

26 October follow-up (Batch 12): testing-only regression/documentation updates now pass all 78 local test commands. No runtime/version change; use the same installer below. Main's quota hotfix was separately approved and published as 0.19.12; this branch still contains the unpromoted audit work. See the running changelog for the current manual test checklist. Automated checks do not replace real-device acceptance.

This is an early testing build, not the Chrome Web Store release. This audit batch does not change main; the separately approved Mugging hotfix is already on main. The full audit plan is not implemented yet.

- Version: **0.19.11.14**, displayed as **0.19.11 Audit Test 23**. PDA tester is **0.4.111 / 0.4.111-audit-test24**.
- Branch: `audit/test-foundation`.
- [Download the tester ZIP](https://github.com/Considious/SLINK-Browser-Extension/archive/refs/heads/audit/test-foundation.zip).
- [One running tester changelog for extension and PDA](https://github.com/Considious/SLINK-Browser-Extension/blob/audit/test-foundation/TESTER-CHANGELOG.md).
- [Pre-audit full-history backup](https://github.com/Considious/SLINK-Browser-Extension/tree/backup/pre-audit-2026-10-24).

## Install in a separate Chrome profile

1. Keep your normal Chrome profile and installed SLINK unchanged. Create a separate Chrome profile for testing.
2. Download the ZIP above and extract it. Keep the extracted directory; Chrome will run the extension from it.
3. In the test profile, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the extracted folder containing `manifest.json`.
4. Check that the installed name is **SLINK Audit Test** and the version is the tester version above.
5. Sign in to Torn and authenticate SLINK normally in that test profile. Use harmless sample targets and settings for tests. Do not copy API keys into feedback or recordings.

Do not run stable and tester copies together in the same profile. Existing application storage keys are preserved; this does not isolate two copies sharing a Torn origin. Candidate 5 adds a shared Chat macro record and a one-time, non-destructive import of existing Torn-page buttons. It does not reset settings. A new browser profile naturally starts with its own settings.

When a new candidate is published, download/extract its ZIP and use **Load unpacked** or the extension's **Reload** control for that extracted folder. The Web Store does not distribute these side-branch builds. Return to your normal profile to use stable SLINK.

## Included in candidate 1

- Dashboard dependency and permission corrections for Faction Officers and Museums, including the Armory Recaller destination.
- Intelligence-cache writes recover after a transient write failure.
- Racing avoids repeatedly recreating its recommendation, recognizes the normal `sid=racing` route and no longer auto-scrolls the page.

Follow the linked changelog for step-by-step test and break-it instructions. This is not a claim that the wider foreground/lifecycle, settings persistence, dashboard parity or shared-provider work is complete.

## Developer verification

Run `npm run test:audit` for the focused candidate checks. They cover the actual dashboard imports, exact-grant access, revocation, Recaller navigation, intelligence queue recovery and Racing behavior, together with selected existing domain tests.

The full script inventory currently reports 49 passing and 18 failing scripts across both clients (67 total). The failures are inherited from the pre-audit baseline. See `docs/audit/BASELINE.md`; do not represent the full suite as green.
