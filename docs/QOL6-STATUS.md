# SLINK QOL Batch 6 status

## DONE

## IN PROGRESS

- CRIME-01 · Extension and PDA · LIVE VERIFY. Shared route reconciliation now drives Arson, Pickpocketing, Cracking, Disposal, Forgery, Hustling, and Scamming. The Extension coordinator is in `src/core/crime-lifecycle.js` and the matching PDA fragment is `SLINK-PDA/src/00-crime-lifecycle.part`. The regression fixtures cover route entry and exit, late/replaced Torn content, history, visibility, and access. Run the live checks in `TESTER-CHANGELOG.md`.

- CRIME-02 · Extension and PDA · LIVE VERIFY. The dashboard preserves an explicit crime selection across refresh and module restart, using Torn’s current crime for the initial view when no selection is saved. The Extension and PDA regression tests pass. Run the live click and tap checks in `TESTER-CHANGELOG.md`.

- CRIME-03 · Cloudflare Services · AWAITING DEPLOYMENT. Cloudflare Workers rejects the dictionary seed fetch’s previous redirect mode. The QOL6 branch restores lazy seeding with manual redirect handling. Verify the live endpoint and clients after deployment.
- CRIME-04 · Extension and PDA · LIVE VERIFY. Crime guide links use themed text and a control surface with visible underline and focus. Check Candy Cartel in light and dark, visited styling, keyboard focus, and touch.

- CRIME-05 · Extension and PDA · LIVE VERIFY. Disposal attaches guidance under the job title shown by Torn’s current flex section. The captured-row fixture covers job changes and disablement.
- CRIME-06 · Extension and PDA · LIVE VERIFY. Forgery identifies the open project picker directly, including when Torn renders it outside the card. The captured-picker fixture covers risk labels, locked options, re-entry, and disablement.
- CRIME-07 · Extension and PDA · LIVE VERIFY. Hustling adds concise guidance under each game title based on Torn’s available actions and current bets. The supplied Cornhole row and simulated crowd and betting states pass on both clients.

- CASINO-01 · Extension and PDA · LIVE VERIFY. The Casino visibility panel uses stable, readable switches and recognizes Poker’s current holdem route.
- CASINO-02 · Extension and PDA · LIVE VERIFY. Torn’s native Casino tiles wrap with even gaps when games are hidden. Fixture checks cover saved visibility, restoration, and access to unrelated controls.

- COMPANION-01 · Extension and PDA · LIVE VERIFY. Companion settings align their dropdowns and stack in narrow space. In Extension, Back to dashboard stays in the scrollable theme content area. Check the Gothic theme, narrow windows, and keyboard focus.

- CRIME-08 · Extension and PDA · LIVE VERIFY. Crime headers containing the native stats banner retain Torn’s header styling. Artwork and frame paint are bounded at the banner. Check the native stats toggle and adjacent buttons on PDA.

- COMPANION-02 · User verified on an earlier build. Jack stays active when minimized and clicking opens the dashboard; dragging keeps him on the page.
- COMPANION-03 · LIVE VERIFY. Wander tries a safe walk before rest and hunker-down animates in and out. Stay and reduced motion respect position and motion preferences.
- COMPANION-04 · LIVE VERIFY. Small, Normal and Large persist and use size-aware viewport and overlap checks.

- STOCKS-01 · Extension and PDA · LIVE VERIFY. SLINK quote controls are in a separate Stocks panel. The quantity helper reattaches when Torn replaces a form or the stock root. Verify two consecutive trades on Extension with TornTools and Confirm placement on PDA.

- BAZAAR-01 · Extension and PDA · LIVE VERIFY. Page tools can optionally collapse the seller description. Verify its setting persists and Bazaar listing and purchase controls remain available.

## TO DO
- Priority 1 · Extension, PDA, and Cloudflare. Reconcile the remaining active Casino, Companion, Stocks, Timers, Page Tools, Items/Armory, Quick Use, and Mugging checks against current code.
- Priority 2 · Extension and PDA. Reconcile Access, API Usage and module switches, then the local client features in the implementation brief.

## DEFERRED/BLOCKED

- Server-migration architecture in the implementation brief, including Rooms transport, Ranked War archive collection, and Mugging storage and scheduling redesign.

## KNOWN ISSUES

- Live Arson and Pickpocketing re-entry, the other five helper routes, and PDA device parity are pending confirmation on the preview.

## RECENTLY CHANGED

- CRIME-01 · Added one shared route lifecycle and the first cross-client route fixtures.
