# SLINK — What changed and what to test

## What changed

- PDA now keeps alert counts and notifications current while leaving hidden panels alone. Opening a panel shows its latest information.
- Reduced unnecessary background saves when no target checks are due or polling is disabled.
- Grouped background player updates into fewer saves and removed a duplicated saved copy of player intelligence. Keys, notes, stats and known estimates are retained.
- Saved Targets now shows 50 entries per page with Previous and Next. All saved targets remain available and monitoring still checks the full list.
- Kept the recent PDA native saving fix and confirmed-save/retry behavior intact. Preference changes still save without waiting for a background batch.

## What to test

- [ ] Receive, snooze and let alerts expire with SLINK minimized. Check the button/bar count, then open Alerts and check the details.
- [ ] Open Access or another module with many saved targets. Check that opening and normal Torn gameplay feel responsive.
- [ ] Page through Saved Targets; edit a note, switch away and return. Confirm targets, notes and unsaved editor text are retained.
- [ ] Try active stakeouts and disabled/re-enabled polling. Due checks and notifications should still work.
- [ ] Change chat, theme and alert settings, then reload. Confirm they remain saved and authentication works.
- [ ] Confirm existing chat GIFs/stickers, highlights and Fair Fight bubbles still work.

If something fails, report your device, SLINK version, page and whether SLINK was minimized. Do not clear storage or reinstall PDA to test this update.
