# SLINK — What changed and what to test

## What changed

- Corrected the remaining overlap between Rooms and Torn chats. Chat height and focus behavior are unchanged.
- Fixed the dashboard's unclickable message-sound checkbox.
- Added a separate message-sound checkbox for each room. Muted rooms still show unread counts.
- Added room controls and Leader management to the SLINK GUI and extension dashboard.
- Rooms is offered by default, unless you already switched it off. A one-time notice explains that Rooms is independent third-party chat before it connects.
- Updated the shared API/data terms to cover chat, media providers and the current API-backed tools. You will be asked to accept the updated terms.

## What to test

- [ ] Open several Torn chats beside Rooms, resize them, and switch to another app. Confirm the gaps stay even with no overlap.
- [ ] Change message sound in the SLINK GUI. Reload and confirm it stays saved.
- [ ] Mute one room while leaving another audible. Receive messages in both; check sound and unread counts.
- [ ] Open Rooms and Manage rooms from the GUI and extension dashboard. Check room descriptions, member permissions and timed restrictions. Non-Leaders must not gain management access.
- [ ] Check the first-use notice. Cancelling must not connect; continuing should show rooms. An existing Rooms opt-out must stay off.
- [ ] Accept the current terms and reload. Confirm existing keys, themes, alerts and settings remain saved, especially on PDA.

If something fails, report your device, SLINK version and what you were doing. Do not clear storage or reinstall PDA to test.
