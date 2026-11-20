# SLINK tester checklist

- [Extension 0.19.146 preview ZIP](https://codeload.github.com/Considious/SLINK-Browser-Extension/zip/refs/heads/feature/qol-batch-6)
- [Torn PDA 0.4.264 preview installer](https://raw.githubusercontent.com/Considious/Torn-Scripts/feature/qol-batch-6/SLINK-PDA/SLINK_PDA_Dashboard.user.js)


## ACTIVE FIXES — PRIORITY 1 — Extension first, PDA parity required

These are the highest-priority QOL6 work. **Fixes/regressions take priority over new feature implementation.** Unless a platform-specific reason is documented, apply the same lifecycle/layout correction to PDA and verify both clients. Keep these items open until the fix is implemented and the corresponding live test passes.



## Jack O’ Slink companion

- [x] **Companion runtime persistence:** User verified Jack stays active when the dashboard closes or minimizes on an earlier build.
- [x] **Jack click-to-open:** User verified click/tap reopens the dashboard and dragging is distinguished from a tap on an earlier build.
- [ ] Open the dashboard with Jack positioned underneath it. On desktop he should move out of the way and return to the same spot after minimizing. On a narrow screen or in PDA’s full-screen dashboard, verify he does not intercept controls and returns to his Torn-page position after minimizing.
- [ ] Check placement during rotation, scrolling, Torn chat, menus, and keyboard use. Test Companion settings on a narrow display; the title, settings and minimize controls must fit. Switch tabs and confirm that Jack pauses appropriately without disappearing or jumping.
- [ ] Check the slink, alert, edge peek, and sleepy slump using actual element movement/animation. Turn on system reduced motion and verify Jack stays stationary.

## TESTING NEEDED — IMPLEMENTED FIXES

Keep each item unchecked until it passes on the Extension preview and Torn PDA where applicable. Client fixes below are available from the preview links above. Worker-backed checks use the production services noted below.

**Mission Rewards — available in the preview, live testing needed**

- [ ] On Extension and PDA, open Missions with an item, an ammo offer, and a mod. Verify that SLINK shows available market value and owned quantity beneath the Buy controls, with no repeated credit price or duplicate TornTools labels. Check narrow card layout and purchase confirmation. Verify Hollow Point and general special-ammo progress and confirm the Dragon’s Breath bar appears only for a 12-gauge incendiary offer while the honor is unfinished.

**Christmas dashboard — available in the preview, live testing needed**

- [ ] Select Naughty List · Christmas 2026 on Extension and Torn PDA. At a narrow width and after rotating PDA, verify Mugging target names, action buttons, and Refresh all sit inside the rails. Scroll and open another module to check the same boundaries and card readability, then switch to Candy Cartel or Halloween to confirm the layout resets.

**Crime helper remounts — available in the preview, live testing needed**

- [ ] Enable all seven helpers. Open Arson, Pickpocketing, Cracking, Disposal, Forgery, Hustling, and Scamming in Torn. Leave each crime and return twice without changing its toggle. Confirm old advice clears and current advice appears once. Repeat using direct links and browser Back/Forward, and verify on Android/iOS PDA.
- [ ] **Arson:** use the direct Arson link and verify the materials/formula UI works after re-entry.
- [ ] **Pickpocketing:** verify the advice and the filter independently. Check that virtualized Torn rows and target controls remain usable.
- [ ] **Scamming:** use an active response preview to verify the remount and complete the detailed Scamming checks below.

**Crimes dashboard selection — available in the preview, live testing needed**

- [ ] In SLINK → Efficiency → Crimes, select Forgery, Disposal, or another non-Arson subpage with one click/tap. Verify the intended tab and helper settings appear and stay selected through a data refresh, minimize/reopen, and leaving and returning to Crimes.
- [ ] Open a direct Torn crime link in a fresh tab and verify SLINK initially shows the matching crime. After choosing another crime explicitly, verify SLINK preserves that choice through a page reload. Repeat in the Extension standalone dashboard where applicable and on Android/iOS PDA.

**Cracking dictionary — live Worker verified**

- [ ] The production seed page returned HTTP 200 with 678 words. Verify the next read serves the cached page. Verify a known shared match and a multi-page request on Extension and PDA. Check that offline starter matches and the manual retry still work when the shared service is unavailable.

**Crime guide link contrast — available in both client previews**

- [ ] In Efficiency → Crimes, open each guide link in Candy Cartel and one other theme in light and dark mode. Check readability before and after visiting, on hover, with visible keyboard focus in Extension, and on Torn PDA touch. Also check the standalone Extension dashboard.

**Disposal advice, Forgery project picker, and inline Hustling guidance — available in both client previews**

- [ ] **Disposal:** Check General Waste, Old Furniture, and Broken Appliance. Verify the note appears below the job name, updates when Torn recycles a job row, and clears when disabled or when leaving Disposal. Keep the method buttons and Dispose control usable.
- [ ] **Forgery:** Open the project picker and check Parking Permit, Concert Ticket, Collection Bucket, and a locked Passport. Verify risk labels appear in the open picker, disappear when disabled or leaving the route, and keep native level, selection, and lock behavior intact.
- [ ] **Hustling:** Check a game with no crowd, then with Hype available, then with active bets. Verify the guidance appears beneath the matching game name, updates when the options change, leaves all controls usable, and clears on disable or route exit.

**Casino switches, Poker and tile spacing — available in both client previews**

- [ ] **Visibility controls:** In light and dark mode, verify readable labels and switches on desktop and PDA. Hide Poker and another game, check the count and verify the setting survives reload. Confirm keyboard focus remains on the switch and help, settings, and native controls remain usable.
- [ ] **Tile spacing:** Hide games from different rows. Confirm the cards close the gaps and wrap with even spacing at desktop and phone widths. Try all games hidden, then use Show all games to restore Torn’s original layout.

**Companion settings layout — available in both client previews**

- [ ] Open Companion settings in Gothic and other themes. On Extension, confirm Back to dashboard and the header controls stay within the themed content area and keyboard focus returns to the settings button. On both clients, check long labels and aligned dropdowns at normal width, then narrow the panel and confirm controls stack without clipping.

**Native crime banner — available in both client previews**

- [ ] Check every available crime with SLINK Torn theming on and off. Verify the native banner keeps its colors, its artwork stays clear of buttons below it, and the stats toggle opens and closes normally. Repeat on PDA in portrait and landscape.

**Jack’s movement and size — available in both client previews**

- [ ] **Movement:** On an unobstructed Torn page in Wander, watch for a visible walk and a smooth hunker-down and recovery. Check that Stay keeps Jack in place and reduced motion keeps Jack stationary.
- [ ] **Size:** Try Small, Normal, and Large, then reload and verify the choice persists. Check drag, viewport edges, and PDA rotation at Large.

**Stocks trade layout — available in both client previews**

- [ ] On Extension with TornTools enabled, complete two consecutive test trades without reloading. Check that the purchase summary, history columns, and money field stay aligned after each rerender. Confirm Fill Torn shares targets the current quantity field.
- [ ] On PDA, check that Torn’s Confirm stays visible and usable on a narrow screen and that Fill Torn shares changes only the quantity.

**Bazaar description hider — available in both client previews**

- [ ] In Quality of Life → Page tools, enable Hide Bazaar description. Open a Bazaar with large seller artwork and verify the description collapses while listings and purchase controls remain available. Reload, visit a second Bazaar, disable the setting, and verify the description returns. Repeat on PDA.

**Passive admin exclusion and Mugging Find Targets**

Worker fixes are on Cloudflare Services `main` at `696831c`. Mugging reports the new live version. Leveling responds, but its live version does not identify this commit.

- [ ] After confirming the worker deployment, verify an admin account does not supply passive Leveling or Mugging work, donated capacity, or passive Fair Fight checks through Mugging. Verify ordinary contributors and explicit admin actions still work.
- [ ] After the worker deployment, press Find Targets twice within 15 minutes and verify no ID from the first batch returns in the second. Try with a first-batch target changing status and a pool with no other eligible targets.
- [ ] On Extension and PDA, simulate a stalled Find Targets request. Check that the timeout clears the busy state, the next attempt works, and a late reply does not replace the current results.

## ACTIVE FEATURE TESTING — PRIORITY 2

Run these after higher-priority live fixes are addressed. These checks cover implemented client features that are expected to survive the server migration with little or no architectural rewrite.

## Batch 1 — Page tools

- [ ] Extension: open Quality of Life → Page tools and turn each feature on and off.
- [ ] PDA: repeat the checks below on Android and iOS.
- [ ] Add, reorder and remove quick-use favorites. Reload and check that your changes stick.
- [ ] Click a favorite once. It should use one item without a second confirmation.
- [ ] Try an energy or nerve refill from the faction armory. The shortcut should not work from Items.
- [ ] Try the leave-hospital and heal-to-full shortcuts. Each click should use only one item.
- [ ] Set your Torn blood type. Check that healing picks a compatible bag and saves O bags when another compatible armory bag is available.
- [ ] Optional: test the incompatible-bag shortcut only if you want to hospitalize your character.
- [ ] Refresh item information. Check that candy, alcohol and energy drink effects reflect your faction bonuses and that item values are labeled as estimates.
- [ ] Add, edit and reorder custom links. Reload and check that they still open as expected.
- [ ] Check that the controls are readable and easy to tap with your theme.
- [ ] Once the update service is available for testing, check that older builds show a notice and up-to-date builds don't.

## Batch 2 — Stocks preview

- [ ] On the extension and PDA, open Torn Stocks and load your portfolio. Check the value and profit/loss against your holdings.
- [ ] Check the next benefit cost for a stock you already own a benefit block in.
- [ ] Enter a buy budget or sell amount and click **Fill Torn shares**. Check the share count and estimated cost or proceeds. Nothing should trade until you confirm in Torn.
- [ ] Try an amount above your cash or shares. The helper should warn you and leave the share field unchanged.
- [ ] Hide a stock, reload, then use **Show hidden stocks** to restore it.
- [ ] **Extension — post-buy stock layout regression:** complete a stock purchase and verify SLINK does not scatter/overlap the purchase summary, history columns, TornTools money input, or surrounding Torn stock UI. The layout must remain aligned immediately after confirmation and after subsequent buys without reload.
- [ ] **PDA — stock confirmation obstruction:** open a stock and proceed to the buy/confirm flow. Verify SLINK helper boxes do not cover Torn's Confirm button or other required controls at narrow/mobile widths. Re-test after completing a purchase and selecting another stock.

## Batch 2 — Bank comparison

- [ ] On extension and PDA, open Torn’s Bank and load the SLINK comparison.
- [ ] Change the amount and compare the term estimates with Money & Property for the same amount. Check the displayed merits and stock bonus.
- [ ] Try an amount over $2 billion. It should show a warning.
- [ ] Leave and reopen Bank. The panel should only appear on Bank, and using it should never fill or submit Torn’s investment form.

## Batch 2 — Timers and company

- [ ] **Page Tools toggle — SLINK timers:** add/verify a dedicated switch that fully hides/disables the SLINK timers surface without disabling unrelated Page Tools. Reload and navigate between pages to confirm the preference persists.
- [ ] **Timer placement:** position the compact timer surface in the same general sidebar/content location used by TornTools rather than leaving it detached or overly prominent. Verify it does not cover Torn controls in Extension or PDA.
- [ ] **Timer simplification:** the normal user-facing surface should show only concise values: **OC: Dd Hh Mm**, **Ranked War: Dd Hh Mm**, **Company Addiction: -X**, and **Virus timer: Dd Hh Mm** when those values exist. Do not show verbose strings such as exact end timestamps, checked-at timestamps, booster cooldown prose, or other diagnostic detail in the normal surface.
- [ ] **Virus timer automatic freshness:** there should be no required **Check virus timer** button. If the value is missing/stale, refresh it automatically through the normal shared API/cache path and display the countdown when available.
- [ ] On the company page, compare the displayed addiction penalty with Company in SLINK. Directors should still see any appropriately authorized employee information elsewhere; regular members should not see restricted employee data.
- [ ] Check that missing or stale timer/company information does not appear as a fake zero countdown or zero penalty.

## Batch 2 — Rehab guide

- [ ] On extension and PDA, open Switzerland’s Rehab page. Check that the guide appears beside Torn’s controls.
- [ ] Compare a full rehab and a target that leaves some addiction. Check the session count and price against Torn’s quote, including any discount.
- [ ] If cash is short, check that the guide warns you. Changing the guide’s target should never move Torn’s slider or submit rehab.
- [ ] If Torn doesn’t show rehab options, check that SLINK doesn’t invent a price or session count.

## Batch 3 — City map items

- [ ] On extension and PDA, open the City map with an uncollected item. Check that the highlight points to the item and the list shows it.
- [ ] Turn highlights off and back on. Zoom and move the map; the highlights should stay with the items.
- [ ] Collect an item using Torn’s own marker. Check that it disappears from SLINK after Torn updates the map.
- [ ] Check the map with no items. Leave for Bank or Quick Links; the City item guide should not follow you.

## Batch 3 — Mission hints and rewards

- [ ] Open a known Duke contract on extension and PDA. Check the hint against Torn’s actual objective; unknown contracts should say no verified hint is available.
- [ ] Open the reward shop. Compare credit costs and affordability with Torn’s balance, then check estimated value per credit on an item with a recent price.
- [ ] Check a reward without a recent market price. It should not be shown as worth zero.
- [ ] Switch contracts and reward offers. Check that the labels follow the current offer and never accept a contract or buy anything.

## Batch 3 — Private profile notes

- [ ] On extension and PDA, save a note on a Torn profile and reload. The note should still be there.
- [ ] Open a second profile. Its note should be separate; switching back should show the original note.
- [ ] Clear the text and save. Reopen the profile and check the note is gone.

## Batch 4 — Faction member filter

- [ ] On extension and PDA, open the faction member list and choose **Filter members**. Search by partial name, exact ID (with or without brackets), and faction role.
- [ ] Try a search with no matches, then press **Reset**. All loaded members should return.
- [ ] Save a preset and reload. Check that the search and role are restored. Choose **Hide member filter** to show all members again.
- [ ] Switch away from Members and back. Check there is only one filter and that Torn's own sorting and profile links still work.
- [ ] Filter by activity, status, special flags, and level range. Check that the results match Torn's roster.
- [ ] Sort by level, Fair Fight and battle-stat estimate. Check that the existing roster reorders without a second list, unknown values sort last, and **Reset** brings back Torn's order.

## Batch 4 — Organized Crimes participants

- [ ] On extension and PDA, open **Faction Officers**, run the existing OC check, and expand **OC participants and open roles**. Compare assigned names, open roles, and missing items against Torn.
- [ ] Check a faction with no recruiting or planning crimes. The panel should say so after a check.
- [ ] Check that an account without OC access cannot see the section.

## Batch 4 — Friends, Enemies and Targets

- [ ] Open each Torn list on extension and PDA. Search by name or ID, filter by activity or level, and sort. The original list should update in place.
- [ ] Save a different preset for each list and reload. Switch pages within a list and check that the filter still works. Reset should restore Torn's original order.
- [ ] Try Fair Fight and battle-stat filters with and without cached values. Check that unknown values aren't shown as zero.

## Batch 4 — Hospital, Jail and User List

- [ ] On Hospital and Jail, sort by time left and filter to a range. Compare against Torn's displayed timers.
- [ ] On Hospital, switch between available and unavailable revives. No player action should be triggered.
- [ ] On the User List, try activity, level, special flags and sorting. Change Torn's search or page, then reset the SLINK filter. Check that Torn's original controls and order still work.

## Batch 4 — Abroad People, Travel Items and City Shops

- [ ] On Abroad People, try activity, status, and level filters. Reset should restore the original list.
- [ ] In a travel shop, filter by name, item type, price and stock. Check that the native buy panel stays visible when open.
- [ ] In a city shop, filter by name, price and stock. Check that the results update in Torn's original purchase list and that the filter never buys anything.

## Batch 4 — Faction Armory

- [ ] On extension and PDA, open your faction’s Weapons or Armor tab. The Armory filter and recaller should be absent without the officer Armory permission.
- [ ] Test all three recall modes, search by item or borrower, and protect a member. A protected loan should never be offered as a recall candidate.
- [ ] With an eligible loan you intend to recall, press **Recall next** once. Check that exactly one item is recalled, protected loans are untouched, and the page doesn't advance.

## Batch 4 — Final filters and safety helpers

- [ ] Filter Auction House by item, bonus, or ranked tier; filter the Ranked War roster by side, name, level, or status; filter Custom Races by track/name, laps, password, or car compatibility. Reset should show the original lists.
- [ ] On Stocks, search by name or symbol and switch between owned and unowned. Check that saved hidden stocks can still be restored.
- [ ] Open a factionmate's profile. Check the warning. Save an allied faction ID and open a member's profile; the ally warning should appear without changing the Attack link.
- [ ] On Company → Stock, request suggestions. Check the quantities against daily sales and free storage. SLINK should never fill or submit the order.

## Batch 5 — Weapon mastery merits

- [ ] On extension and PDA, press **Show weapon merits** on an item page. Verify a weapon with a known mastery upgrade shows green bonuses beside the original Damage and Accuracy numbers.
- [ ] Check a weapon with no mastery and a non-damaging temporary item. Neither should gain a suffix. Check that long numbers fit with light and dark mode at PDA width.
- [ ] Change merit levels, then revisit/reload the relevant Items or Armory surface. If the cached merit data is less than 6 hours old, SLINK should reuse it. If it is 6+ hours old or missing, SLINK should refresh it automatically from the API without requiring a manual Refresh button. No weapon stats or gameplay should change.

## Batch 5 — Gym progress

- [ ] On extension and PDA, open **SLINK Gym progress** on Torn's Gym page. Check the next-gym percentage against Torn's gym list.
- [ ] Compare the specialist stat requirements with your visible stats. A missing or unverified prerequisite should not show as eligible.
- [ ] After training manually, check that the guide updates when Torn updates its numbers. The guide must never train, buy a membership, or switch gyms.

## Batch 5 — Weapon experience and special bonuses

- [ ] On Items, verify weapon XP and its two effects appear automatically for a weapon you know when the feature is enabled. Unknown XP should not appear as zero. If cached XP data is 6+ hours old or missing, SLINK should refresh it automatically from the API instead of requiring a manual refresh.
- [ ] Press **Explain special bonuses** on a ranked item and compare the explanation with Torn's tooltip. It should work by tap without changing weapon controls.
- [ ] On the attack page, check that XP appears only on your weapons and that attacking and weapon selection are unchanged.

## Batch 5 — Casino helpers

- [ ] On High-Low, enter the visible rank. Ace should have 0% Higher and 2 should have 0% Lower. No bet or choice should be made for you.
- [ ] On Blackjack, enter your visible cards and the dealer's upcard. Try a soft hand and a six-card Charlie. The guide should not press game controls.
- [ ] On the Casino lobby in extension and PDA, hide two games, reload, restore one individually, then use Show all games. Check the hidden count, and confirm that other games, Casino help/settings, and game controls stay available.

## Batch 5 — Rental comparison

- [ ] On Properties, open **SLINK rental comparison**, load property types, and compare a familiar type. Check the per-day range and exact-term upfront rent against Torn's listed asking prices.
- [ ] Change the lease days or minimum happiness. Results should update without a second lookup. Switching property types should clear the old results.
- [ ] Confirm the helper leaves Torn's lease fields and submit controls untouched.

## Batch 6 — Faction exports

- [ ] As a regular member, filter the faction roster or Ranked War roster and export it. The CSV should include only the currently shown rows, with profile links.
- [ ] As an officer, run the Armory or OC check and export the results. If the latest check failed, the exported rows should say they’re the last available results.
- [ ] Try downloading and copying a CSV on extension and PDA. A selectable text fallback should be available.

## Batch 6 — Filter presets and navigation

- [ ] Save different presets on Travel Items, City Shops, Auction House, Ranked War, Custom Races, and Stocks. Reload and check that each restores its own preset. Reset should clear it.
- [ ] On a long faction or player list, enable the filter and scroll to the bottom. **Back to filters** should bring you to the controls without changing pages or clearing your filters.

## End-of-project live pass — Performance and reliability

- [ ] Enable Efficiency → Crimes → Cracking on extension and PDA. Compare a known dictionary match, a longer password, and a prefix/suffix variant against Torn’s revealed slots. Guesses must be labeled separately and nothing should be entered or submitted automatically. Check that rows with fewer than two revealed characters show no advice, then leave and return to Cracking and verify the toggle and layout.
- [ ] With the Cracking helper enabled and server collection active, verify a confirmed success queues only the Torn-generated answer; a fully revealed but unfinished job, failed attempt, or cancelled job queues nothing. Retry a batch after a failed upload and verify the shared dictionary deduplicates it. Check that turning the helper off stops uploads, background tabs do not capture or initiate uploads, and the local dictionary still works offline.
- [ ] Verify the success marker switches from an enabled “Crack, 5 nerve” to a disabled “You have already cracked this password” after your click. Reload an already-cracked row and verify it is not counted as a new result.
- [ ] Simulate more than 20 queued answers and confirm the queue drains across batches. Simulate a missing endpoint, a slow response, and a partial acknowledgement: Cracking must remain usable and unacknowledged answers must stay queued without repeated rapid retries.
- [ ] After the Cracking dictionary Worker and bucket are ready, reveal a leading character and check that the matching shared dictionary loads without a full download. Use Load more on a multi-page bucket. Check the fallback with an unknown leading character and offline, and confirm the dictionary request never contains the full pattern, answer, or Torn API key.
- [ ] Verify lazy seeding: choose a dictionary page not yet in R2 and request it through the existing Contribution Worker. Confirm it returns the GitHub page and creates the matching R2 object. Request the same page again and verify the Worker serves it from R2 without another GitHub fetch. Do not clear existing R2 objects to run this check.

- [ ] On extension and PDA, enable Efficiency → Crimes → Pickpocket. Enter Torn’s Pickpocketing page and verify the filter sits above the targets without covering the first target’s controls; on mobile, repeat after wrapping the filter controls and while scrolling.
- [ ] Check recommendations at a known crime skill, a risky build or activity, and a Police Officer (rating 350). Change min/max, verify the target list updates without moving virtual rows over one another, then choose Show all. Leave and return, refresh, and disable the helper; check that the saved setting is respected and the Uniques tracker is unaffected.

- [ ] With Arson Helper enabled, leave Arson and return without touching the toggle or reopening the materials list. Check an Intimidation job and a job with a real damage requirement. Open Torn’s material picker with SLINK’s formula visible and verify every material is tappable.

- [ ] On the same PDA device, compare page changes with SLINK disabled and with the feature preview installed. Compare a fresh load and repeat navigation. Note whether Torn becomes usable before SLINK does and whether the theme appears late.
- [ ] After one successful startup, refresh or switch pages with a slow connection. Cached SLINK should start without waiting for the update check. Check that an available update takes effect on a later page load, not in the middle of the current page.
- [ ] If the theme still flashes, check whether the delay is before SLINK applies the theme or while the artwork is loading. Do not clear saved settings to test this.
- [ ] Leave the dashboard and sidebar timers collapsed while using active chat. Check scrolling and typing, then expand the timers and confirm they are current.
- [ ] Open Items, Stocks, Missions, and a long faction list. With filters or overlays enabled, scroll and change tabs; check for delays, lost keyboard focus, duplicate controls, or stale results.
- [ ] Use a test Armory loan you intend to recall. Check that a rapid double press can’t submit twice and that a different copy of the same item loaned to the same player isn’t recalled if Torn replaces the row mid-action.
- [ ] Confirm the update notice doesn't tell feature-preview testers to replace their preview with the production build.

## End-of-project live pass — Disposal

- [ ] Enable the Disposal helper on extension and PDA. Confirm General Waste recommends Bury, Old Furniture recommends Burn, and Broken Appliance recommends Sink. Check that advice follows the job after a list refresh and disappears when the helper is disabled or you leave Disposal.
- [ ] Check Firearm and Dead Body when available: neither should be labeled Safe. Verify advice does not cover controls or change the selected method, and unknown job types receive no recommendation.
- [ ] Open the guide links from the Disposal, Arson, Pickpocketing, and Cracking subtabs.

## End-of-project live pass — Forgery

- [ ] Open Efficiency → Crimes → Forgery in the extension overlay, extension dashboard, and PDA. Check the progression tip and open the Ultimate Forgery Guide. Switch to another subtab and confirm the Forgery tip is gone.
- [ ] Enable “Show project difficulty in Torn” and open the Forgery project picker on desktop and PDA. Check Parking Permit (Lower risk), Concert Ticket (Moderate), Passport (High risk), and Collection Bucket (Unrated). Check that locked projects remain locked, level and name stay readable on mobile, and keyboard/tap selection and Begin Project still work. Toggle the feature off and back on, then leave and return to Forgery.

## End-of-project live pass — Hustling

- [ ] Turn on “Show Hustling guidance in Torn” under Efficiency → Crimes → Hustling in the extension and PDA. With a crowd and no bets, check that Hype is suggested only when the Hype control is present.
- [ ] After bets appear, check that the displayed game and stakes match Torn, and attention/suspicion update with the crowd. An actual loss should not be described as a successful intentional loss. Check that the helper never clicks or enables controls, and disappears when turned off or when leaving Hustling.
- [ ] On desktop and PDA, check that the summary leaves the native game controls, first row, and outcome close buttons fully visible.

## End-of-project live pass — Scamming

- [ ] On extension and PDA, enable Scamming guidance and open two replies. Check each target has its own current tile and no landing range is shown before Torn displays one. Confirm Capitalize is reported only when enabled.
- [ ] Select a response without sending it. If Torn shows a landing preview, compare its tile numbers and check that only overlap with a live failure tile triggers a warning. Without a visible range, no prediction should appear.
- [ ] Confirm the helper never selects or sends a response, leaves native controls usable on mobile, and disappears on disable or when leaving Scamming.

## Live pass — Items / Armory presentation and Quick Use

- [ ] Extension first, then PDA parity: open **Items** in Candy Cartel and at least one other theme. Weapon merits, weapon XP, special-bonus explanations, and Quick Use must render inside clearly bounded SLINK containers/cards rather than loose text over Torn/theme artwork. Verify readable text, borders, spacing, focus/hover states, and no overlap with theme art.
- [ ] Review the rest of Batch 6 helpers for the same presentation defect. Any helper injected into a Torn page should use theme-safe semantic tokens and a defined container/anchor so it visually belongs to SLINK and remains readable across themes.
- [ ] Verify weapon merit/XP freshness behavior: cached data younger than 6 hours is reused; missing or 6+ hour-old data refreshes automatically; normal page use should not require a manual Refresh control. API refresh must respect the shared limiter and avoid duplicate pulls across Items and Faction Armory.
- [ ] **Quick Use — Edit mode:** press Edit. Usable Torn item categories/items should become clearly selectable; items that cannot be used should not be highlighted/selectable. Click Torn's **Use** action on a usable item and confirm that item is added as an icon to Quick Items without consuming the item. Add several different usable items.
- [ ] **Quick Use — remove/edit:** while Edit mode is active, every saved Quick Item icon should expose a small clear X/remove affordance. Remove one icon, leave Edit mode, reload/navigate away and back, and verify the edited Quick Items list persists.
- [ ] **Quick Use — actual use:** outside Edit mode, click a saved Quick Item icon while at least one copy is owned. Exactly one item should be used from that one deliberate click, without Torn's normal confirmation step. Verify no double-use on rapid/double click and a clear unavailable/out-of-stock state when no copy is owned.
- [ ] **Quick Use — Specials:** verify **Medical: Leave Hospital** chooses the minimum suitable medical use needed to leave hospital while minimizing medical cooldown, and **Medical: Optimal Life** chooses the minimum suitable medical use needed to fill life while minimizing medical cooldown. These must remain one-click user-triggered actions and should not chain unrelated Torn actions.
- [ ] **Quick Use — layout:** verify the Quick Items container, Edit/Done control, saved icons, Special Options, labels, and remove X controls remain readable and aligned in Candy Cartel, another theme, light/dark appearance, narrow desktop widths, and PDA.
- [ ] **Faction Armory parity:** apply the same theme-safe container treatment, automatic 6-hour merit/XP freshness behavior, and relevant item-helper styling to Faction Armory surfaces. Confirm Items-only Quick Use controls do not leak into Armory unless intentionally supported there.

### War — local-first observation and Link Formatter integration (new patch; extension/PDA parity)

- [ ] On the actively viewed `factions.php?step=your&type=1#/war/rank` page, use **Torn's already-rendered enemy roster / naturally occurring native war responses** for immediate activity, status, travel description, and hospital expiry updates. No additional non-API Torn requests. Avoid processing unfocused pages; keep API polling as fallback for missing/stale fields or absent page. Label source, observation time and data freshness; reject older responses replacing newer local observations.
- [ ] Toggle **Link Formatter** in SLINK → War settings. Enabled: add one 📄 button per enemy row, preserve the tested two-click prepare-then-send UX, Shift-click copy, hospital timers and stat fallback, and keep own faction untouched. Disabled: remove only SLINK-owned UI and restore layout. With the standalone formatter installed, do not duplicate buttons or fight over widths. Test FFScouter/Torn Tools, header alignment, hash navigation, rerenders, and startup load.
- [ ] Confirm no active-page status capture, forwarding, alerts or remote sharing while Torn is unfocused/backgrounded. Extension/PDA feature parity and manual testing required before release. Verify no new player action is automated.

## POST-SERVER MIGRATION / ARCHITECTURE HOLD — DO NOT PRIORITIZE NOW

These items are intentionally deferred because their backend/storage/scheduling architecture is expected to change substantially when SLINK moves to a dedicated server. Do not spend QOL6 implementation time optimizing the current Cloudflare-specific architecture unless a critical correctness/safety issue requires an immediate patch. UI/read-only verification may continue where useful.

**Still-active exception:** the API Usage + module-toggle dashboard remains an active feature and is not part of this hold.

### War Machine pre-war heat mapping — DEFERRED UNTIL SERVER SETUP

- [ ] **Central scheduler, not every client:** the War Machine backend owns pre-war API polling as part of existing heat-map rotations. Normal roster coverage remains approximately **once per 5 minutes**. Beginning **6 hours before an officially scheduled ranked war**, promote **only the assigned opponent faction** to **at most one API-based status poll per minute** (30 seconds only after explicit API-budget and policy review). Deduplicate across officers, keys, tabs, and workers; stop promotion when war ends/cancels or the schedule changes, then revert to normal rotation.
- [ ] Record member status transitions, first-observed traveling departure/return direction, destination and `plane_image_type` when available, observation timestamp, source, and confidence. Do **not** treat first sight of an ongoing flight as actual departure. Derive tentative arrival windows, not fabricated exact timestamps; show **blue estimated countdowns** distinct from confirmed hospital timers. Preserve travel modifiers and uncertain speed classes.
- [ ] Feed fresh, timestamped, source-labeled opponent observations into SLINK War using the existing authorized backend channel. Local focused-page/native observations have priority when fresher; remote observations must not silently overwrite them. Reject stale/out-of-order updates. Respect key-owner consent, API rate limits, permissions, and retention limits.
- [ ] Validate six-hour activation and one-minute upper bound, other factions retaining five-minute cadence, no duplicate polling with multiple clients/keys, missed/changed schedules, no page/tab required, storage recovery, and correct fallback when War Machine is offline.

### SLINK accessibility: speech-to-text and optional voice commands — DESIGN / RULES REVIEW

- [ ] Add an **opt-in push-to-talk speech-to-text** option for SLINK chat/search/notes or other editable text fields, with visible microphone permission/recording indicator, editable transcription, manual submit, and desktop/PDA capability checks. Do not record or send audio without consent; disclose any platform speech service and avoid logging raw audio/transcripts.
- [ ] Investigate **“Hey SLINK” wake-word** as a separate opt-in accessibility feature. Do not enable persistent microphone listening or action execution by default; require Torn-staff rules review before any voice command triggers Torn requests or gameplay. Start with read-only navigation/help or filling a draft, and keep an explicit click/keypress confirmation for submissions.
- [ ] Test permissions denied/unavailable, accents/noisy input, audio privacy, reduced motion, keyboard alternatives, tab focus/background suspension, and voice-to-text vs send separation. Verify no unattended Torn gameplay or non-API requests occur.

### Ranked War archive / backfill — DEFERRED

- [ ] **Background collector must run independently of page activity:** the archive/backfill currently appears to stop as soon as the website/tab loses activity. Move/repair the collector so backfill continues continuously on the backend without requiring a browser page to remain open, focused, refreshed, or revisited. There are roughly 60K wars to populate; this cannot depend on interactive page presence.
- [ ] Keep the existing safety limits while backgrounded: no more than **10 archive API calls/minute overall** and no more than **5 archive calls/person/minute** when multiple opted-in officer keys participate. Helper keys remain excluded from routine refreshes.
- [ ] Verify an authorized officer can browse and filter archived wars, another faction cannot read them, and revoked credentials stop that key's participation without stopping unrelated authorized collection.
- [ ] Close the site entirely during backfill, leave it closed long enough to prove continued progress, then reopen and confirm the cursor/progress advanced without client activity.
- [ ] Compare an archived report and rolling 30-day totals with Torn; incomplete coverage must be labeled. Confirm backfill includes wars that do not involve SLINKY, shows both opponents' war-time ranks/stats, and exports filtered rows to CSV.
- [ ] With two saved officer keys, verify the second key is unused until its owner opts in; after opt-in, both may share backfill within the per-person/global limits. Opt-out/revocation must immediately remove that key from scheduling.


Add user-facing checks here as features and fixes are queued so nothing has to be remembered later. Run the combined live test pass only after the rest of the to-do list is complete. Until then, the next step is the next unfinished implementation or investigation item.

Use the feature preview with the production build disabled. Check items off as they pass. For anything that fails, note your device and what happened.

### SLINK Rooms / Chat backend — DEFERRED

- [ ] On extension and PDA, post a direct Imgur PNG link and a direct GIF link in a custom SLINK Room. With automatic media previews enabled, both should render inline; compare with the same links in normal Torn chat. With automatic previews off, verify the links remain usable and media does not load automatically.
- [ ] Once the themed room artwork is added, check that Halloween and Candy Cartel icons appear in the room picker for users with the matching permission, are unavailable to select without it, and display correctly in the room header and chat bar after saving and reopening.
- [ ] Create both a personal and a faction room. Verify the theme picker offers Torn default and only the creator’s unlocked themes. Join from a second account without the theme grant and verify it sees the same room artwork while its own SLINK dashboard theme stays unchanged.
- [ ] Change the room theme as the creator, then return it to Torn default. Verify a different Chat Leader can still manage room access but cannot change the creator’s theme. Check an older unthemed room still opens normally.
- [ ] Post a message containing prose and a direct image URL. Confirm surrounding text remains readable, the image still links to the original, and an unavailable image falls back to a link. Toggle automatic media off and on while a room window is already open.
- [ ] With Torn in light mode, open Card Skimming on PDA and extension. Verify the header, labels and action buttons are readable and there is no dark overlay across the crime rows. Repeat in dark mode and on another crime.
- [ ] Once the Theme Lab comparison is available, check that both scenes use the same selected theme, show matching Torn/SLINK light or dark appearance, and stay readable side by side and when stacked. The mock Torn page must not navigate or perform gameplay actions.
- [ ] On extension and PDA, try Halloween 2026, Candy Cartel, and Christmas Naughty List. Switch Torn between light and dark: SLINK should switch immediately, keep the selected artwork, and leave alerts and controls readable. Toggle Higher theme contrast and check that it stays selected after navigation and reload. On extension, also open the standalone dashboard and check that it uses Torn’s last mode.

- [ ] Extension and PDA (Android/iOS): Abroad, verify **Set up Travel Run** is visible without expanding the plan. Configure a sale, Xanax → Shark Fin, and a medical fallback. Save, then check that the current action stays visible with the plan collapsed and that a refresh restores progress. Repeat the Sell, Buy and Travel Home checks below in PDA using touch.
- [ ] Sell: carry several copies of the listed item and one unrelated item. Verify the action selects the correct stack, opens Sell if required, and fills Max on its own press. Torn's Yes stays manual. Confirm the sale in Torn before marking the step done; opening a panel, setting Max, or canceling must not advance.
- [ ] Buy: verify Max uses Torn's own quantity control and the next press opens the matching item's Buy panel. Test unavailable stock and insufficient cash, then skip Xanax to Shark Fin without buying anything automatically. A completed purchase skips later choices and the medical fallback. Try a stale or duplicate row and verify no action fires on an uncertain match.
- [ ] Skip both buy choices: verify the configured medical fallback appears and can be marked done after manual item use or skipped. Verify **Open Travel Home** opens the correct Torn panel and never confirms departure. Check that switching away and back leaves the toolbar and progress intact.
- [ ] With Arson Helper already enabled, open Crimes, switch into Arson, leave for a different crime, then return without touching the toggle. Repeat with a direct Arson reload and after Access is verified. Confirm the helper appears only in Arson and retains its material knowledge.
- [ ] On Items, enable Reduce pack-opening animations and open a supply pack. Verify the reward and controls remain visible, Torn still controls when Use Another is available, and only the manual opening uses an item. Disable the setting and check the animation returns. Check wallets and coin purses separately where they share the pack reveal.
- [ ] On a Torn profile and attack page, enable Show Fair Fight. Verify it looks up only the displayed opponent using your own saved FFScouter key, labels any backup source, and shows unknown values as unavailable. Switch opponents, disable the toggle, and check that chat’s own Fair Fight setting is unchanged.
- [ ] Fair Fight Bounties (extension/PDA): test missing, invalid and unregistered keys; access without policy consent; explicit acceptance; empty and populated boards; disabled targets; faction shared pools; manual Attack links; eligible Hospitalize vs Mug, Leave or assist; first-come/overlap behavior; claim verification and payout; rate limiting; mobile layout; and independent Torn Bounties settings.
- [ ] Ranked Gear preview: compare an actual completed auction against the archive, verify an unsold row is excluded, and check that resale of the same UID is a separate comp. Verify the archive resumes after a failed page and compares perks in either order.
- [ ] Bunker Watch preview: confirm live Weaver weapon and armor response fields and pagination; verify a Small Arms Cache ask divided by 20, the manual rate, and a known two-perk weapon. Simulate Weaver failure and check that historical prices stay available. Once client alerts are wired, test one alert per UID and price, a material price drop, and desktop/PDA layout.
- [ ] Open Market → Ranked Gear on extension and PDA. Verify the Price Checker shows completed-sale median and individual sales, with the Bunker value displayed separately. Save a broad watch, reopen the panel, and confirm the same UID/price is not marked new again; a price drop of at least 5% should be marked new. Pause the watch and verify it stops checking.

### Other server-migration-sensitive work — DEFERRED

- Chat/Rooms backend architecture and Cloudflare Durable Object optimization beyond critical bug containment.
- Mugging backend/storage architecture, R2 write-optimization redesign, and Cloudflare-specific scheduling. **Mugging correctness fixes remain active.**
- Fair Fight / large target-checking backend scheduling beyond obvious API-abuse fixes.
- Ranked Gear history/storage architecture where it depends on backend persistence.
- Faction analytics high-frequency collectors and persistent backfill jobs.
- Faction/alliance marketplace backend/auth/storage implementation.
- Automatic permission-purchase fulfillment backend.
- Market Watch backend scheduling redesign that exists mainly to work around Cloudflare limits.
- Trade watcher persistent/background backend implementation; local calculator/UI work can proceed.
- Cloudflare account-splitting work that may become irrelevant after migration.