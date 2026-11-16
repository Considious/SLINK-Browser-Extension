# SLINK QOL Batch 6 status

## DONE

## IN PROGRESS

- CRIME-01 · Extension and PDA · LIVE VERIFY. Shared route reconciliation now drives Arson, Pickpocketing, Cracking, Disposal, Forgery, Hustling, and Scamming. The Extension coordinator is in `src/core/crime-lifecycle.js` and the matching PDA fragment is `SLINK-PDA/src/00-crime-lifecycle.part`. The regression fixtures cover route entry and exit, late/replaced Torn content, history, visibility, and access. Run the live checks in `TESTER-CHANGELOG.md`.

- CRIME-02 · Extension and PDA · LIVE VERIFY. The dashboard preserves an explicit crime selection across refresh and module restart, using Torn’s current crime for the initial view when no selection is saved. The Extension and PDA regression tests pass. Run the live click and tap checks in `TESTER-CHANGELOG.md`.

## TO DO

- CRIME-03 · Extension and PDA. Check dictionary availability, theme link contrast, and the individual Disposal, Forgery, and Hustling outputs.
- Priority 1 · Extension, PDA, and Cloudflare. Reconcile the remaining active Casino, Companion, Stocks, Timers, Page Tools, Items/Armory, Quick Use, and Mugging checks against current code.
- Priority 2 · Extension and PDA. Reconcile Access, API Usage and module switches, then the local client features in the implementation brief.

## DEFERRED/BLOCKED

- Server-migration architecture in the implementation brief, including Rooms transport, Ranked War archive collection, and Mugging storage and scheduling redesign.

## KNOWN ISSUES

- Live Arson and Pickpocketing re-entry, the other five helper routes, and PDA device parity are pending confirmation on the preview.

## RECENTLY CHANGED

- CRIME-01 · Added one shared route lifecycle and the first cross-client route fixtures.
