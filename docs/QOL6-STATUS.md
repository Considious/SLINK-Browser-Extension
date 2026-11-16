# SLINK QOL Batch 6 status

## DONE

## IN PROGRESS

- CRIME-01 · Extension and PDA · LIVE VERIFY. Shared route reconciliation now drives Arson, Pickpocketing, Cracking, Disposal, Forgery, Hustling, and Scamming. The Extension coordinator is in `src/core/crime-lifecycle.js` and the matching PDA fragment is `SLINK-PDA/src/00-crime-lifecycle.part`. The regression fixtures cover route entry and exit, late/replaced Torn content, history, visibility, and access. Run the live checks in `TESTER-CHANGELOG.md`.

- CRIME-02 · Extension and PDA · LIVE VERIFY. The dashboard preserves an explicit crime selection across refresh and module restart, using Torn’s current crime for the initial view when no selection is saved. The Extension and PDA regression tests pass. Run the live click and tap checks in `TESTER-CHANGELOG.md`.

- CRIME-03 · Cloudflare Services · AWAITING DEPLOYMENT. Cloudflare Workers rejects the dictionary seed fetch’s previous redirect mode. The QOL6 branch restores lazy seeding with manual redirect handling. Verify the live endpoint and clients after deployment.
- CRIME-04 · Extension and PDA · LIVE VERIFY. Crime guide links use themed text and a control surface with visible underline and focus. Check Candy Cartel in light and dark, visited styling, keyboard focus, and touch.

## TO DO

- CRIME-05 · Extension and PDA. Verify Disposal, Forgery, and Hustling against the Torn DOM.
- Priority 1 · Extension, PDA, and Cloudflare. Reconcile the remaining active Casino, Companion, Stocks, Timers, Page Tools, Items/Armory, Quick Use, and Mugging checks against current code.
- Priority 2 · Extension and PDA. Reconcile Access, API Usage and module switches, then the local client features in the implementation brief.

## DEFERRED/BLOCKED

- Server-migration architecture in the implementation brief, including Rooms transport, Ranked War archive collection, and Mugging storage and scheduling redesign.

## KNOWN ISSUES

- Live Arson and Pickpocketing re-entry, the other five helper routes, and PDA device parity are pending confirmation on the preview.

## RECENTLY CHANGED

- CRIME-01 · Added one shared route lifecycle and the first cross-client route fixtures.
