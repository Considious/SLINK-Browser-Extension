# SLINK — What changed and what to test

## What changed

- Torn's chat bar, unread badges and native popups now appear above Rooms instead of being covered by it. Room position, spacing and size are unchanged.
- Updated Chat Central's deployment to the same current terms as normal Access. An older chat service can no longer misleadingly tell you to keep accepting a newer policy you already accepted.
- Saved terms acceptance is rechecked after loading policy details, so accepting while a request is in progress does not leave it checking an older saved value.
- If services disagree, the error identifies that disagreement and preserves your saved acceptance, key and settings.

## What to test

- [ ] Receive a native Torn chat message while Rooms is open. Check that its unread badge is visible and clickable above Rooms.
- [ ] Open Torn chat settings or a native popup near Rooms. Check that Rooms does not cover it.
- [ ] Accept the current terms once in Access, then open Rooms and its management page. Confirm it does not repeatedly ask for the same acceptance.
- [ ] Reload Torn, switch focus and resize chat. Confirm the corrected spacing and height still work.

Do not clear saved data to resolve a terms disagreement. Report the affected screen and error code instead.
