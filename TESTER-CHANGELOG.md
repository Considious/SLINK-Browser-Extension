# SLINK — What changed and what to test

## What changed

- PDA now has a read-only **Copy storage report** button in Access → Storage troubleshooting. If saving fails, this helps identify the failure without sharing your key or settings. This is a diagnostic, not a confirmed fix for persistent native-storage errors.
- Torn's chat bar, unread badges and native popups now appear above Rooms instead of being covered by it. Room position, spacing and size are unchanged.
- Terms errors now distinguish disagreement between services from missing acceptance. Chat Central's deployment update is still blocked; repeated acceptance cannot resolve that deployment problem.
- Saved terms acceptance is rechecked after loading policy details, so accepting while a request is in progress does not leave it checking an older saved value.
- If services disagree, the error identifies that disagreement and preserves your saved acceptance, key and settings.

## What to test

- [ ] If PDA cannot save, open Access → Storage troubleshooting → Copy storage report and send the report with your error. Do not clear saved data.
- [ ] Receive a native Torn chat message while Rooms is open. Check that its unread badge is visible and clickable above Rooms.
- [ ] Open Torn chat settings or a native popup near Rooms. Check that Rooms does not cover it.
- [ ] Accept the current terms once in Access, then open Rooms and its management page. Confirm it does not repeatedly ask for the same acceptance.
- [ ] Reload Torn, switch focus and resize chat. Confirm the corrected spacing and height still work.

Do not clear saved data to resolve a terms disagreement. Report the affected screen and error code instead.
