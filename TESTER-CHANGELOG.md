# SLINK — What changed and what to test

## What changed

- Fixed Chrome's stuck version label. The displayed version now follows the actual extension version.
- Room management is a full-width GUI page, not a miniature chat window. Manage in chat opens that page.
- Removed duplicate sound controls and the misleading settings text. Chat has one global Notification sounds toggle and one sound control to the right of each room.
- Reply, Edit and Delete are now available by right-clicking a message, holding it on mobile, or using Shift+F10 from a focused message.
- Compacted the message composer and moved connection/history tools under Info, leaving more space for messages. Chat window spacing and sizing are unchanged.

## What to test

- [ ] Check Chrome's extension version after reloading the updated files. It should show 0.19.28, not 0.19.25.
- [ ] Open Manage from Rooms. Check that the full GUI opens, with room details, member access, timed restrictions and faction links—not another chat window.
- [ ] Try management in the extension dashboard and PDA. Change rooms and permissions, click away and return, and confirm values remain saved. Non-Leaders must not gain management access.
- [ ] Toggle global notification sounds, then mute one room. Confirm the per-room control sits beside the correct room, saves after reload, and does not mute other rooms.
- [ ] Right-click or long-press messages. Own messages should offer Reply/Edit/Delete; other members' messages should not offer unauthorized actions.
- [ ] Scroll on mobile without holding. It must not accidentally open the action menu. Test Escape and Shift+F10 with a keyboard.
- [ ] Send a multiline message, open Info/history, and minimize/reopen Rooms. Check that the working gap beside Torn chats stays correct.

If something fails, report your device, SLINK version and what you were doing. Do not clear storage or reinstall PDA to test.
