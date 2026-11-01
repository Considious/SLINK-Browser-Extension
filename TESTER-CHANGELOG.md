# SLINK — What changed and what to test

## What changed

- Rooms now waits for Torn's chat bar before restoring a saved window, instead of appearing in the top-left corner.
- Rooms matches the visible gap between native Torn chats, including the outside frame and scaled chat layouts.
- Reserving space no longer animates independently of the Rooms window. Torn's normal chat movement remains available.
- Height, focus retention, room sounds, permissions and storage behavior are unchanged.

## What to test

- [ ] Leave Rooms open and refresh Torn. It must reappear beside the chats without clicking it or flashing at the top left.
- [ ] Open several Torn chats. Compare the native chat-to-chat gap with the gap beside Rooms; there should be no overlap.
- [ ] Change chat size, resize the browser and try browser zoom. Confirm the gap stays even.
- [ ] Switch to another app, return, then minimize and reopen Rooms. Check that spacing and height remain correct.
- [ ] Open room controls in the dashboard; they should remain inside the dashboard rather than becoming a floating chat.

If something fails, report your device, SLINK version and what you were doing. Do not clear storage or reinstall PDA to test.
