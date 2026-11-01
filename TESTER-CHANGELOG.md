# SLINK — What changed and what to test

## What changed

- Reduced unnecessary chat processing that could slow down attacks, Crimes and other pages, especially with busy chats open.
- Fair Fight bubbles and GIFs update where needed instead of repeatedly processing the whole conversation.
- Fixed another case where replacing a chat window created duplicate SLINK Fair Fight bubbles.
- Chat highlights process changed messages without repeatedly redoing the conversation.
- Kept the recent PDA saving fix intact. Keys, themes and preferences are not cleared or reset.

## What to test

- [ ] Attack and use Crimes with busy faction chat open. Compare responsiveness with chat minimized and reopened.
- [ ] Send and receive GIFs/stickers; use the in-chat search and scroll its results.
- [ ] Check for one SLINK Fair Fight bubble before each sender's name, without overlap or duplicates.
- [ ] Switch pages, minimize/reopen chat, then leave the app and return. Existing images and bubbles should remain; new messages should still update.
- [ ] Check highlighted words in existing and new messages.
- [ ] Change chat, theme and alert settings, then reload. Confirm they remain saved and Access works.

If something fails, report your device, SLINK version, page and whether chat was open. Do not clear storage or reinstall PDA to test this update.
