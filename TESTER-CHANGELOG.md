# SLINK — What changed and what to test

## What changed

- Affected PDA users can now explicitly choose **Delete unreadable records and rebuild** in Access → Storage troubleshooting. It deletes only SLINK settings records confirmed to have the native Null/String read failure, plus their associated pieces and pointers, then verifies a clean saved copy of the settings on the current page. Readable records, saved targets, Torn's browser storage and other scripts are left alone. This never runs automatically. Deleted records cannot be recovered.
- PDA room management now keeps its own mounted form through repeated unrelated module updates, preserving unfinished text.
- PDA's manual storage recovery now saves recovered data in smaller, verified pieces instead of another single growing record. Interrupted saves keep the last confirmed version. It can repair the reported failure recurring in the older recovery format, and no longer tries reading all old records as a fallback for recovered settings.
- War settings, War display-mode changes and individual module visibility changes no longer rebuild unrelated panels. Room management keeps its form and unfinished text. The Rooms loading label now clears after initialization.
- Fixed room management failing when the shared faction member-directory table was missing. Existing chat history, licenses and Leader assignments are unchanged. An empty member directory is not an online-user count.
- PDA users with the specific native Null/String settings-read failure can manually choose **Recover saving from this page** under Access → Storage troubleshooting. Recovery saves and verifies the settings currently available on the page before selecting a fresh native record. Original records remain untouched. It does not run automatically or change healthy users' saved storage.
- **Copy storage report** remains available in Access for investigating save failures without sharing your keys or saved settings.
- Torn's chat bar, unread badges and native popups now appear above Rooms instead of being covered by it. Room position, spacing and size are unchanged.
- Rooms now remembers being minimized even when sign-in or terms verification fails.
- Chat Central's updated configuration uses normal SLINK permissions and terms acceptance, preserving existing rooms and Leaders. This requires its Cloudflare build to deploy successfully; a failed deployment cannot be fixed by repeatedly accepting terms.
- Saved terms acceptance is rechecked after loading policy details, so accepting while a request is in progress does not leave it checking an older saved value.
- If services disagree, the error identifies that disagreement and preserves your saved acceptance, key and settings.

## What to test

- [ ] For the recurring native Null/String settings error only: update the installed PDA script to 0.4.155, reload Torn and open Access → Storage troubleshooting. Choose **Delete unreadable records and rebuild** and carefully review the permanent-deletion confirmation. Keep the page open until success. Reload, navigate between pages and use SLINK for several minutes; check your theme, accepted terms and preferences remain saved. Cancelling must change nothing. If the option is hidden, Copy storage report checks whether this specific repair is applicable. Do not clear all storage.
- [ ] Leave room management open and type an unfinished room name. Change War preferences or its display mode from another SLINK window; confirm only War changes and the room form and draft remain. Hide/show another module and check that unrelated panels stay untouched too.
- [ ] Open Faction Rooms in the dashboard and check that room management loads without the HTTP 500 error. Check that existing rooms still open normally.
- [ ] If PDA has the native Null/String settings-read error, update the installed script to 0.4.154 or later and reload Torn. Open Access → Storage troubleshooting → Recover saving from this page. Review the confirmation. After success, reload, use several modules for a few minutes, then check your theme, terms acceptance and alert preferences still save. Settings missing from the current session are not automatically restored from unreadable originals. If recovery reports that its native allowance is full, follow that message rather than clearing data or repeatedly authenticating.
- [ ] If recovery fails or is unavailable, use Copy storage report and send the result with the error. Do not clear saved data.
- [ ] Receive a native Torn chat message while Rooms is open. Check that its unread badge is visible and clickable above Rooms.
- [ ] Open Torn chat settings or a native popup near Rooms. Check that Rooms does not cover it.
- [ ] Accept the current terms once in Access, then open Rooms and its management page. Confirm it does not repeatedly ask for the same acceptance.
- [ ] Minimize Rooms while it shows a sign-in or terms error, then change pages. Check that it stays minimized.
- [ ] Check existing rooms, message history and assigned Leaders still work after the chat service updates. A user with only administrator status must not gain room management unless explicitly assigned as a Chat Leader.
- [ ] Reload Torn, switch focus and resize chat. Confirm the corrected spacing and height still work.

Do not clear saved data to resolve a terms disagreement. Report the affected screen and error code instead.
