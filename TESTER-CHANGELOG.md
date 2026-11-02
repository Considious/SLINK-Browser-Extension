# SLINK — What changed and what to test

## What changed

- Fixed room management failing when the shared faction member-directory table was missing. Existing chat history, licenses and Leader assignments are unchanged. An empty member directory is not an online-user count.
- PDA users with the specific native Null/String settings-read failure can manually choose **Recover saving from this page** under Access → Storage troubleshooting. Recovery saves and verifies the settings currently available on the page before selecting a fresh native record. Original records remain untouched. It does not run automatically or change healthy users' saved storage.
- **Copy storage report** remains available in Access for investigating save failures without sharing your keys or saved settings.
- Torn's chat bar, unread badges and native popups now appear above Rooms instead of being covered by it. Room position, spacing and size are unchanged.
- Rooms now remembers being minimized even when sign-in or terms verification fails.
- Chat Central's updated configuration uses normal SLINK permissions and terms acceptance, preserving existing rooms and Leaders. This requires its Cloudflare build to deploy successfully; a failed deployment cannot be fixed by repeatedly accepting terms.
- Saved terms acceptance is rechecked after loading policy details, so accepting while a request is in progress does not leave it checking an older saved value.
- If services disagree, the error identifies that disagreement and preserves your saved acceptance, key and settings.

## What to test

- [ ] Open Faction Rooms in the dashboard and check that room management loads without the HTTP 500 error. Check that existing rooms still open normally.
- [ ] If PDA has the native Null/String settings-read error, update the installed script, retry saving once, then open Access → Storage troubleshooting → Recover saving from this page. Review the confirmation. After success, reload and check your theme, terms acceptance and alert preferences remain. Settings missing from the current session are not automatically restored from the unreadable original.
- [ ] If recovery fails or is unavailable, use Copy storage report and send the result with the error. Do not clear saved data.
- [ ] Receive a native Torn chat message while Rooms is open. Check that its unread badge is visible and clickable above Rooms.
- [ ] Open Torn chat settings or a native popup near Rooms. Check that Rooms does not cover it.
- [ ] Accept the current terms once in Access, then open Rooms and its management page. Confirm it does not repeatedly ask for the same acceptance.
- [ ] Minimize Rooms while it shows a sign-in or terms error, then change pages. Check that it stays minimized.
- [ ] Check existing rooms, message history and assigned Leaders still work after the chat service updates. A user with only administrator status must not gain room management unless explicitly assigned as a Chat Leader.
- [ ] Reload Torn, switch focus and resize chat. Confirm the corrected spacing and height still work.

Do not clear saved data to resolve a terms disagreement. Report the affected screen and error code instead.
