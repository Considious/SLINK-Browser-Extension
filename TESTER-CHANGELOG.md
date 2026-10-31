# SLINK — What changed and what to test

## What changed

- **Saved settings:** improved PDA saving for themes and chat preferences, while keeping existing settings and keys. Other saved-data protections remain in place.
- **Forms and checkboxes:** background updates should no longer close editors, erase typing or change unrelated selections.
- **Autosave:** many personal settings now save as you change them, with a warning and retry option if saving fails.
- **Loading and performance:** improved page loading, reduced unnecessary checking, and better recovery after switching tabs or returning to PDA.
- **Battle stats and Fair Fight:** improved reuse of your current stats and handling of missing estimates. An unavailable Fair Fight service should not stop the rest of a module working.
- **Mugging:** improved target checking and refreshes. Unchecked targets are clearly marked, and failed checks should not erase known estimates.
- **Extension dashboard:** repaired missing module access and buttons, including QOL and Officer tools.
- **Museums and Events:** corrected Museum inventory requests and event calendar reading, including Halloween dates and personal event start times.
- **Racing and other QOL tools:** repaired car highlighting and improved the stability of settings and controls across Abroad Stocks, Company, Money and Events.
- **Chat Fair Fight bubbles:** corrected duplicates alongside existing Fair Fight bubbles, stretched badges and bubbles disappearing after chat redraws.
- **Themes:** added an optional setting to apply your SLINK theme to Torn pages.
- **Error messages:** clearer explanations of what failed and what to do next. Terms-loading errors now identify the affected service instead of only saying the information was incomplete.

## What needs tested

Please try the checks that apply to you, on PDA or the extension.

- [ ] **Settings stay saved:** change a few alert choices, leave SLINK, change pages and restart the app/browser. Confirm those choices remain.
- [ ] **Alerts behave correctly:** try Enable all, Disable all and individual checkboxes. The selected boxes, enabled count and actual alerts should agree. Snoozed alerts should stay snoozed after refreshing.
- [ ] **Acknowledgements stick:** mark city purchases complete and check that the reminder stays dismissed for the day. Completed crime uniques should not be reported as missing.
- [ ] **Editors stay open:** type in a target or settings field while SLINK refreshes. Your text, cursor, checkboxes and open sections should not reset. Try an invalid target ID, then correct it without re-entering your notes.
- [ ] **Individual checkboxes work:** change one Market Watch item or Officer permission. It must not toggle the whole category or other permissions.
- [ ] **Autosave works:** change a setting that saves automatically, wait for confirmation, then leave and return. Confirm the saved value remains.
- [ ] **Your page and size are remembered:** leave SLINK on Alerts or Market Watch, then change Torn pages. It should return to that module. Resizing should stay saved without stretching controls or creating huge gaps.
- [ ] **PDA navigation is usable:** reach every Combat and QOL subtab. Check that buttons, text and alerts fit and can be scrolled where needed.
- [ ] **Loading feels better:** switch tabs/windows, change pages, and background/return to PDA. Watch for slowdowns, flickering themes, repeated restarts or duplicate buttons.
- [ ] **Battle stats stay current:** refresh your stats in Mugging, then close SLINK and refresh Torn. The newer total should remain rather than reverting. Compare it with other combat modules.
- [ ] **Mugging targets update:** find targets and refresh after checks finish. Unchecked entries should be clearly labelled, known estimates should remain, and known targets above your selected Fair Fight limit should not be treated as suitable.
- [ ] **Racing highlights the right car:** use a completed build with an exact saved nickname. The matching official race should highlight that car once, without selecting it or repeatedly scrolling.
- [ ] **QOL pages work:** check Abroad Stocks leave times, Company information, Museum prices and Money figures against what you can see in Torn. Open Halloween from Events even when it is not active. Inputs should remain editable during refreshes.
- [ ] **Dashboard and Officer buttons work:** open your permitted modules on the extension dashboard. Check report copying and the Armory Recaller entry. Opening the armory should not recall anything automatically.
- [ ] **Chat tools work:** open faction, company and private chats. Check custom buttons, profile/【ATTACK】 links, GIF/sticker searches and optional Fair Fight bubbles. Existing drafts and native chat controls should remain usable; nothing should send without your action.
- [ ] **Themes remain usable:** enable Torn-page theming, change theme/opacity, navigate and reload. Text should remain readable, decoration must not block buttons, and disabling the option should restore Torn’s appearance.
- [ ] **Errors are understandable:** if a normal check fails, does the message explain the problem and next step? Reconnecting and retrying should not erase settings. Do not deliberately fill or clear your storage to provoke an error.
