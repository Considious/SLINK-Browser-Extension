# SLINK audit tester build — candidate 2

This is an early testing build, not the Chrome Web Store release. Main has not changed. The full audit plan is not implemented yet.

- Version: **0.19.9.2**, displayed as **0.19.09 Audit Test 2**.
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

Do not run stable and tester copies together in the same profile. This candidate preserves current application storage keys; it does not isolate two copies sharing a Torn origin. No saved-data migration or reset is part of candidate 2. A new browser profile naturally starts with its own settings.

When a new candidate is published, download/extract its ZIP and use **Load unpacked** or the extension's **Reload** control for that extracted folder. The Web Store does not distribute these side-branch builds. Return to your normal profile to use stable SLINK.

## Included in candidate 1

- Dashboard dependency and permission corrections for Faction Officers and Museums, including the Armory Recaller destination.
- Intelligence-cache writes recover after a transient write failure.
- Racing avoids repeatedly recreating its recommendation, recognizes the normal `sid=racing` route and no longer auto-scrolls the page.

Follow the linked changelog for step-by-step test and break-it instructions. This is not a claim that the wider foreground/lifecycle, settings persistence, dashboard parity or shared-provider work is complete.

## Developer verification

Run `npm run test:audit` for the focused candidate checks. They cover the actual dashboard imports, exact-grant access, revocation, Recaller navigation, intelligence queue recovery and Racing behavior, together with selected existing domain tests.

The full script inventory currently reports 39 passing and 18 failing scripts across both clients (57 total). The failures are inherited from the pre-audit baseline. See `docs/audit/BASELINE.md`; do not represent the full suite as green.
