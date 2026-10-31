# Candidate 5: standalone dashboard parity

Scope: Phase 5's dashboard feature inventory from the implementation plan. This is an implemented tester batch, not a claim that every original audit recommendation or live/device acceptance check is complete. The standalone dashboard is extension-only; PDA remains at Candidate 4.

## Architecture

`core/dashboard-host.js` adapts the existing module registry/presenters to the dashboard. It supplies title, subtitle, status, actions, styles and retained content roots. Only the selected permitted module starts; switching page/view, hiding the document or revoking access invalidates its lifecycle immediately. Starts/stops are serialized, late startup is cleaned up, and cleanup failure does not poison subsequent switches. Target List's existing retained-editor state is reused.

Combat gets a sub-navigation: Leveling & War (the original overview), Bounties, Mugging and Target List. QoL gains Chat. Existing dashboard storage keys for page/QoL selection remain; Combat's extra subview uses additive `ui.dashboard.combatView`. Initialization restores all selections before starting a hosted module. Opening the dashboard without an explicit requested destination now respects the stored page.

Existing overview/efficiency refresh loops are gated to their visible dashboard view. Cached status reads at startup no longer request hidden Market/Merits/Dollar/Player Stats refreshes. This is UI-loop gating, not removal of background alerts or configured contribution/stakeout services. Existing `system.status` behavior remains; this does not claim startup is network-free.

The dashboard does not import player-intelligence DOM scraping. Target Refresh delegates to its existing background route; profile/attack links open Torn in a separate tab. Chat does not install a dashboard chat observer. Racing and Events do not install Torn-page observers in dashboard presentation.

## Feature/action dispositions

| Area | Actions | Disposition / evidence |
| --- | --- | --- |
| Bounties | enable, reward/status/FF/BS/unknown filters, scan settings | Same registered module and background routes; real-browser fixture renders its settings. Live scan/provider behavior still requires tester review. |
| Bounties | scan/restart, cached results, countdowns, Save Target | Same presenter/handlers, no copied scanner. Existing domain tests retained. |
| Bounties | profile/attack links | Explicit new Torn tab; no dashboard DOM scraping. Original sessionStorage profile-intent hint is not transported between origins; this source-specific enrichment handoff remains unresolved. |
| Mugging | local enable, min/max FF, count, Find targets, own stats | Same presenter/routes and Part 4 stats provider. Find targets retains forced own-stat refresh. Real-browser fixture checks mounted controls. |
| Mugging | results, Profile/Attack, Save Target | Same presenter/routes; Torn links open separately. Real target/provider results need tester review. |
| Target List | add/edit/delete, tags, notes, sources | Same presenter and storage authority. Real-browser fixture exercises add/edit/cancel and retained draft across a view switch. |
| Target List | polling, stakeouts, snoozes | Same handlers/services. Hosted timers stop when hidden; configured background service behavior is unchanged. Live expiry/notification delivery remains tester work. |
| Target List | Refresh | Uses existing background refresh only, not a fake Torn document. Browser fixture verifies the route is called without the DOM helper. |
| Leveling | Save Target | Added to existing dashboard cards using `targetList.add`, tagged Level and source Leveling. |
| War/outside | Save Target | Added beside existing attack/profile/copy actions; preserves War versus outside provenance. Existing FF outage/filter logic and attack safety gates are unchanged. |
| Leveling/War | other overview actions | Existing dashboard controls retained, not wholesale reimplemented. Full live war/officer action-by-action acceptance is explicitly pending. |
| Chat | highlight terms/colors/enabled, add/remove/save | Same Chat module; no message scanning on dashboard. Browser fixture edits/saves a term. Applying highlights still happens on Torn. |
| Chat | macro labels/messages/destinations/enabled, add/remove/save | Dashboard editor uses guarded background configuration routes shared with the Torn chat editor. Revision conflicts retain drafts. Messages are stored as data, not evaluated or sent by the dashboard. |
| Chat | existing Torn-origin buttons | One-time ID-preserving import when Chat starts on Torn. Existing localStorage is not cleared. A completed import marker prevents deleted macros being re-imported on subsequent loads. Conflicts keep canonical IDs; failures do not clear legacy data. |
| Chat | insert/send, profile/page tokens, newsletter | Remains explicit Torn-page user interaction in the existing custom-buttons script. Dashboard configures but does not send messages or resolve its own extension URL as a Torn page token. |
| Company | stats, thresholds, director train view | Same module, director-only condition unchanged. |
| Company | director employee chat reminder | Dashboard shows Copy reminder, Message and Open profile/chat; hides unavailable direct Send. Native fill/send remains Torn-only. Browser fixture verifies the dashboard distinction. Clipboard success requires browser permission/user gesture. |
| Officers | thresholds, manual checks, role grants | Same module/service permission predicates and handlers. Actual faction data/role assignments need tester review. |
| Recaller | open and operate | Saves the requested War Armory subtab and opens the native faction armory. Actual recalling remains a manual Torn-page action. Unit/browser fixtures verify the handoff URL, not live inventory recall. |
| Remaining QoL | Racing, Abroad, Museum, Money, Events | Existing presenters preserved; now mounted through the shared host with late-render guards. Original domain regressions retained. |

## Chat storage safety

New additive configuration record: `qol.chat.macros.v1`, with revision, macro list and one-time legacy import marker. `chat-config-service.js` serializes saves/imports and requires the current Chat permission/session, including admin override. Saves require an expected revision; stale edits or failed writes reject without replacing the accepted record. Both editors preserve drafts after failure. The old Torn-origin local copy is mirrored only after a successful canonical save.

The import does not continuously reconcile two authorities: the canonical extension record wins after initial migration. A new browser profile or different extension ID is a separate installation. Do not run stable and audit extensions together in one profile. Older builds that do not know this record cannot be claimed to participate in its revision protocol.

## Verification boundaries

`tests/dashboard-parity.test.mjs` exercises real host lifecycle, exact/admin/denied permissions, revocation, late startup, Recaller delegation, macro import/save conflicts/write failure, retained newer typing and dashboard destination preservation. `audit-foundation` continues real registry access and intelligence queue checks, with its obsolete adapter-slice checks replaced by the new real-host contract test.

The synthetic headless Edge fixture uses actual dashboard HTML/CSS, imports, navigation and feature modules, but mocked service results and an entrypoint that exposes navigation without authenticating or running the full startup request set. It checks target actions/drafts, combat views, Chat editing, Company/Recaller handoffs, denied access and 390/1100px panel fit. It is not evidence of live Torn, Chrome Store installation, native PDA behavior or every original parity-matrix row. The original report artifacts are not present in this workspace; the inventory above follows the saved implementation plan. Remaining unresolved/live checks are deliberately listed rather than marked complete.
