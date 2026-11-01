# SLINK — What changed and what to test

## What changed

- Faction rooms now use compact buttons with visible descriptions and clearer message backgrounds.
- Rooms match Torn chat height/width and sit alongside the other open chats. Closing Rooms restores their positions.
- Enter sends a message; Shift+Enter adds a new line. Muted/read-only members cannot bypass restrictions with Enter.
- Added Torn-style unread badges and an optional short message sound. New messages can notify you without opening each room first.
- Messages show player names with Torn IDs. Reconnect refreshes the verified name; old messages use known names where available.

- Added 12-hour snoozes to alerts, including company addiction, stakeouts and War retals.
- Fixed Alerts-page snoozes for company addiction and other supplemental reminders.
- War now has separate personal controls to turn retal alerts off, mute just retal sound, or snooze retals for your chosen number of hours. Other War warnings keep working.

- PDA now keeps alert counts and notifications current while leaving hidden panels alone. Opening a panel shows its latest information.
- Reduced unnecessary background saves when no target checks are due or polling is disabled.
- Grouped background player updates into fewer saves and removed a duplicated saved copy of player intelligence. Keys, notes, stats and known estimates are retained.
- Saved Targets now shows 50 entries per page with Previous and Next. All saved targets remain available and monitoring still checks the full list.
- Kept the recent PDA native saving fix and confirmed-save/retry behavior intact. Preference changes still save without waiting for a background batch.

## What to test

- [ ] Open several Torn chats and Rooms. Change Torn's Height and Width settings, resize the screen, then minimize/reopen Rooms. Check for overlap and that the other chats return to their normal positions.
- [ ] Check room descriptions and send with Enter, add a line with Shift+Enter, then try Enter while muted or read-only.
- [ ] Receive a message with Rooms minimized and in a room you have not opened. Check the unread number, then read the messages and check it clears.
- [ ] Turn Message sound off, reload, and confirm it stays off. Old messages, edits and reconnects should not make extra sounds.
- [ ] Check names such as Considious [3853023], including after reconnecting.

- [ ] Snooze company addiction and another alert for 12 hours. Confirm they disappear immediately and remain snoozed after a page reload.
- [ ] In War, disable retal alerts, then re-enable them. Mute only retal sound and confirm retals stay visible while other War warnings still work.
- [ ] Snooze one retal, then try the all-retal custom-hours control and Resume. Confirm the settings survive reloads.

- [ ] Receive, snooze and let alerts expire with SLINK minimized. Check the button/bar count, then open Alerts and check the details.
- [ ] Open Access or another module with many saved targets. Check that opening and normal Torn gameplay feel responsive.
- [ ] Page through Saved Targets; edit a note, switch away and return. Confirm targets, notes and unsaved editor text are retained.
- [ ] Try active stakeouts and disabled/re-enabled polling. Due checks and notifications should still work.
- [ ] Change chat, theme and alert settings, then reload. Confirm they remain saved and authentication works.
- [ ] Confirm existing chat GIFs/stickers, highlights and Fair Fight bubbles still work.

If something fails, report your device, SLINK version, page and whether SLINK was minimized. Do not clear storage or reinstall PDA to test this update.

