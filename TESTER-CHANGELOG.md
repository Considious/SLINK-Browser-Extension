# SLINK — What changed and what to test

## What changed

- **Saved settings:** improved PDA saving for themes and chat preferences, while keeping existing settings and keys. Other saved-data protections remain in place.
- **PDA saving:** added compatibility handling for the reported Null/String storage error without clearing existing data. User-data saves are read back before being reported complete, and failed saves identify the storage operation that failed.
- **PDA terms and queued saves:** corrected duplicate terms/sign-in requests receiving an empty native response, and saves timing out while still waiting in SLINK's queue. A queued save is not marked saved; completion still requires confirmation. The separate native Null/String read failure remains under investigation.
- **Access verification:** retrying with the same key and current terms no longer clears still-valid access before the replacement login succeeds. PDA sign-in errors now identify the failed step and response status without exposing your key. The reported member-only unreadable-response issue remains under investigation.
- **Forms and checkboxes:** background updates should no longer close editors, erase typing or change unrelated selections.
- **Autosave:** many personal settings now save as you change them, with a warning and retry option if saving fails.
- **Loading and performance:** improved page loading, reduced unnecessary checking, and better recovery after switching tabs or returning to PDA.
- **PDA chat performance:** stopped repeated whole-chat processing when only a header or unrelated page content changes. New GIFs and Fair Fight bubbles still appear, existing ones remain during app switching, and the Halloween basket checker now runs only on Items.
- **PDA script on PC:** corrected startup being blocked by the browser's Content Security Policy. No security settings need to be disabled. Startup errors now show the underlying failure instead of only saying startup did not finish.
- **Battle stats and Fair Fight:** improved reuse of your current stats and handling of missing estimates. An unavailable Fair Fight service should not stop the rest of a module working.
- **Mugging:** improved target checking and refreshes. Unchecked targets are clearly marked, and failed checks should not erase known estimates.
- **Extension dashboard:** repaired missing module access and buttons, including QOL and Officer tools.
- **Museums and Events:** corrected Museum inventory requests and event calendar reading, including Halloween dates and personal event start times.
- **Racing and other QOL tools:** repaired car highlighting and improved the stability of settings and controls across Abroad Stocks, Company, Money and Events.
- **Chat media:** restored the original working GIF/image renderer and added sticker-page support. Direct sticker links keep their original addresses. The in-chat picker scrolls immediately, keeps settings in QOL → Chat, and has a Send to chat button instead of requiring copy/paste. Chat images can be turned off in Chat settings.
- **Dashboard buttons:** icons and alert counts now sit beside labels instead of covering them.
- **Extension name:** restored the normal SLINK name.
- **Chat Fair Fight bubbles:** one fixed badge between the avatar and sender's name, inside Torn's sender container—not below the avatar or after the name. Existing badges and GIF/sticker images remain in place when focus changes. Redrawn senders reuse remembered estimates without waiting for another lookup.
- **Themes:** added an optional setting to apply your SLINK theme to Torn pages.
- **Error messages:** clearer explanations of what failed and what to do next. Terms-loading errors now identify the affected service instead of only saying the information was incomplete.

## What needs tested

Please try the checks that apply to you, on PDA or the extension.

- [ ] **Settings stay saved:** change a few alert choices, leave SLINK, change pages and restart the app/browser. Confirm those choices remain.
- [ ] **PDA storage:** update the existing SLINK script without deleting it. Try Save and authenticate, change an alert/theme/chat choice, then reload. Confirm saving succeeds and existing settings and targets remain. If it still fails, report the full storage error; do not clear app data.
- [ ] **PDA terms and saves:** try Load current terms and Save and authenticate. Terms should load even if another check is running. Several settings changes may show Saving, but should not fail just because earlier saves are still queued.
- [ ] **Access retries:** verify your existing saved key. If a request fails, still-valid access should remain unless the key or policy changed, or the service explicitly rejected access. If PDA shows an unreadable sign-in response again, report the complete new error message; do not send a private API key.
- [ ] **Alerts behave correctly:** try Enable all, Disable all and individual checkboxes. The selected boxes, enabled count and actual alerts should agree. Snoozed alerts should stay snoozed after refreshing.
- [ ] **Acknowledgements stick:** mark city purchases complete and check that the reminder stays dismissed for the day. Completed crime uniques should not be reported as missing.
- [ ] **Editors stay open:** type in a target or settings field while SLINK refreshes. Your text, cursor, checkboxes and open sections should not reset. Try an invalid target ID, then correct it without re-entering your notes.
- [ ] **Individual checkboxes work:** change one Market Watch item or Officer permission. It must not toggle the whole category or other permissions.
- [ ] **Autosave works:** change a setting that saves automatically, wait for confirmation, then leave and return. Confirm the saved value remains.
- [ ] **Your page and size are remembered:** leave SLINK on Alerts or Market Watch, then change Torn pages. It should return to that module. Resizing should stay saved without stretching controls or creating huge gaps.
- [ ] **PDA navigation is usable:** reach every Combat and QOL subtab. Check that buttons, text and alerts fit and can be scrolled where needed.
- [ ] **Loading feels better:** switch tabs/windows, change pages, and background/return to PDA. Watch for slowdowns, flickering themes, repeated restarts or duplicate buttons.
- [ ] **PDA stays responsive:** leave a busy chat open while browsing, scrolling and using SLINK. Confirm typing and page controls respond promptly, new GIFs/stickers still appear, and switching away and back does not remove existing images or Fair Fight bubbles. Check the Halloween basket helper still appears on Items.
- [ ] **PDA script on PC:** if you use it through a desktop userscript manager, update the existing script and confirm it opens, accepts your saved/manual key and retains settings with normal browser security enabled.
- [ ] **Battle stats stay current:** refresh your stats in Mugging, then close SLINK and refresh Torn. The newer total should remain rather than reverting. Compare it with other combat modules.
- [ ] **Mugging targets update:** find targets and refresh after checks finish. Unchecked entries should be clearly labelled, known estimates should remain, and known targets above your selected Fair Fight limit should not be treated as suitable.
- [ ] **Racing highlights the right car:** use a completed build with an exact saved nickname. The matching official race should highlight that car once, without selecting it or repeatedly scrolling.
- [ ] **QOL pages work:** check Abroad Stocks leave times, Company information, Museum prices and Money figures against what you can see in Torn. Open Halloween from Events even when it is not active. Inputs should remain editable during refreshes.
- [ ] **Dashboard and Officer buttons work:** open your permitted modules on the extension dashboard. Check report copying and the Armory Recaller entry. Opening the armory should not recall anything automatically.
- [ ] **Chat tools work:** enable GIFs & stickers and chat images in QOL → Chat. Open a faction, company or private chat and click GIF. Search once and immediately scroll the results—no reopening should be needed. Click Send to chat and confirm the chosen GIF/sticker appears as an image, not just a link. Try older GIPHY page links and direct sticker links too. Turn chat images off and confirm that stays saved. Check custom buttons, profile/【ATTACK】 links and Fair Fight bubbles. Searching must not send anything; sending with an existing draft must ask first.
- [ ] **Themes remain usable:** enable Torn-page theming, change theme/opacity, navigate and reload. Text should remain readable, decoration must not block buttons, and disabling the option should restore Torn’s appearance.
- [ ] **Chat stays in place:** check for one SLINK Fair Fight badge between the avatar and sender's name, on the same line. Nothing should sit below the avatar or after the name. Click outside chat, switch away and return: existing images and badges should not disappear or wait to reload. Turning either feature off should still remove it.
- [ ] **Errors are understandable:** if a normal check fails, does the message explain the problem and next step? Reconnecting and retrying should not erase settings. Do not deliberately fill or clear your storage to provoke an error.
