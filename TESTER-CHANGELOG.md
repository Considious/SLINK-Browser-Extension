# SLINK — What changed and what to test

## What changed

- Added faction Rooms alongside Torn chat, with compact room buttons, descriptions and clearer message backgrounds.
- Rooms follows Torn's chat width, height and spacing. Switching away from Torn no longer makes other chats slide underneath it.
- Room messages keep arriving while Torn is unfocused. Switching to another Torn tab transfers the connection instead of running duplicate copies.
- Enter sends; Shift+Enter adds a new line.
- Messages show player names and Torn IDs, with unread badges and an optional saved message sound.
- Leaders can control room access, speaking permissions and timed restrictions.

## What to test

- [ ] Open several Torn chats beside Rooms. Change Torn's chat size, resize the screen, then minimize and reopen Rooms. Check alignment and spacing.
- [ ] Click another app or tab, receive messages, and return. Check unread numbers, sounds and that chats have not overlapped.
- [ ] Switch between several Torn tabs. Check for duplicate messages or sounds and unnecessary reconnects.
- [ ] Send with Enter, add a line with Shift+Enter, and try sending while muted or read-only.
- [ ] Check names and descriptions. Turn message sound off, reload, and confirm it stays off.
- [ ] Have several members post, reply and reconnect. Confirm private/officer-only rooms stay restricted and timed mutes/access changes work.
- [ ] Confirm existing keys, themes, alert settings and saved targets remain saved after reload.

If something fails, report your device, SLINK version and what you were doing. Do not clear storage or reinstall PDA to test.

