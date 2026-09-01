# SLINK Browser Extension

Chrome-first Manifest V3 client for Shared Live Intelligence NetworK systems.

[Privacy Policy](PRIVACY.md)

Version 0.15.0 replaces the reserved center module with compact private player
stats. One combined Torn `/v2/user` request supplies the current personal stats,
working stats, and personal faction-armory balance; four historical personal-stat
snapshots calculate true 1-, 2-, 7-, and 30-day changes. The panel shows Xanax,
energy cans, refills, attacks, respect, retals, activity, networth trends, working
stats, and armory funds. Values are cached only in the browser, refresh once each
Torn day shortly after 00:00 TCT, and can be refreshed manually. No SLINK Worker
or D1 storage participates in this feature.

Version 0.14.3 prevents obsolete extension pages from generating repeated Chrome
errors after an update. When Chrome invalidates an old dashboard, popup, or Torn
content-script context, that old page now becomes quietly inactive instead of
catching the runtime failure and throwing a replacement exception. A missing
background receiver is retried once before a genuine service error is reported,
and previously unguarded clear/revoke actions now handle failures locally.

Version 0.14.2 completes the queued War-target controls in both the extension
dashboard and in-Torn panel. War targets can be filtered by a custom Fair Fight
range and by Okay/not-Okay status, then sorted by availability or Fair Fight;
those choices persist locally. Med-out claims now use an explicit target Torn ID
and, for officers, an optional assignee Torn ID instead of per-card claim buttons.
Stale Chrome contexts caused by updating the extension are also caught and shown
as a useful reconnect message instead of an uncaught runtime-message failure.

Version 0.14.1 polishes the War interface and closes several Torn-integration
gaps. Retals now include faction, target, status, battle-stat and Fair Fight
details with Copy, Torn-only Send, Attack, Profile, and per-player dismissal.
The collapsed SLINK bubble flashes red for active retals and shows an officer-only
armory alert state. The panel remembers its active module and War tab across Torn
navigation, the inside gate now covers Torn's profile Attack button, and armory
status/requests use a distinct SLINK column without overwriting Torn's Action
column. All attack links now use Torn's current `page.php?sid=attack&user2ID=`
route; obsolete loader routes are rejected by build validation.

Version 0.14.0 makes War collection demand-driven with one polling owner across
all open Torn tabs and the extension dashboard. It removes the legacy background
War alarm, adds a second background throttle, adds faction-wide Termed-war
major-bonus inside gates, and adds transient Warlord/Revitalize armory requests
with holder status. Requests live only in the per-war coordinator and expire;
they do not create D1 rows.

Version 0.13.0 adds the officer-only Armory Recaller to the in-Torn War panel.
It reuses the proven one-item-per-click workflow, preserves the 12-hour member
cache and borrower whitelist, and refuses to scan or click unless Torn is the
focused page. The standalone dashboard only opens the Recaller in Torn; it
cannot perform armory actions itself.

Version 0.12.0 replaces the broken Torn module pop-out with a reliable
**Restore GUI in Torn** action. It clears off-screen panel and bubble positions,
reopens the shell, and reapplies Extension-only, Hybrid, or Torn display changes
without ever refreshing Torn. Live retals again show War/retal flags, faction,
the attacked member, current status, battle-stat estimate, and Fair Fight
estimate. Officer logs are grouped by player and expand into dated/time-stamped
opponent and outcome details while retaining the low-write ten-minute buckets.

Version 0.11.1 makes the administrator permission view show effective faction
access as inherited instead of incorrectly appearing empty. Inherited grants
remain separate from direct paid/manual grants and cannot be accidentally
rewritten by the administrator form. Worker authentication errors now include
the safe backend detail needed to identify a D1 schema or entitlement failure.

Version 0.11.0 adds the queued War coordination and theme work. War officers
can set one faction-wide inside-hit cap and assign med-out targets to another
Torn member. Personal mug tracking now includes total, minimum, average, and
maximum values, and the current chain/War summary is fetched and copied only
when the user presses **Copy report**. The three premium themes now use a
bundled coil ornament preset instead of being color swaps alone.

Theme definitions are loaded as strictly validated visual JSON through the
existing SLINK War Worker. The extension rejects remote JavaScript, HTML, CSS,
URLs, and executable content, keeps a last-known-good local catalog, and falls
back to its bundled themes if the service or GitHub is unavailable. This lets
new visual-token themes and their `slink.theme.<id>` scopes be published from
the central Cloudflare-services repository without a new Chrome Web Store
package; all theme behavior remains bundled in the extension.

Version 0.10.0 recognizes an assigned ranked-war opponent before the war starts.
Med-out claims and officer-controlled faction settings become available as soon
as the matchup is assigned, status collection begins five minutes before the
scheduled start, and attack, retal, logging, chain, and personal-stat collection
remain disabled until the war is active. The movable in-Torn panel can also
collapse into a draggable bubble that follows the selected SLINK theme.

Version 0.9.1 prevents extension state changes from ever refreshing or navigating
Torn. Changes that cannot be applied safely in place wait for the user's next
normal navigation. The build now rejects page-refresh and page-navigation APIs.

Version 0.9.0 adds permission-gated SLINK themes across the dashboard, popup,
and in-Torn panels while retaining faction-chat copying, local FFScouter
outside-target discovery, and inactive-war API backoff.
Version 0.8.0 restores faction-chat target callouts, adds shared officer-controlled
War mode and med-out claims, and makes the War settings save explicitly. Version
0.7.1 collapsed verified API access into a compact one-third-width card,
used the freed dashboard space for live retals, and kept War targets active if
optional historical log storage is unavailable. The dashboard retains one local
Torn credential area, an explicitly separate remotely saved Public Only donation,
three equal module slots, and a single Leveling/War target deck. War includes Fair
Fight sorting, estimated battle stats, faction-chat callouts, shared officer-controlled
War mode, med-out claims, chain and Turtle Timer state, attack/war/mug counters,
configurable alerts, and API-based ranked-war discovery.

War logs and faction-wide mode changes require `slink.war.officer` or `admin.*`.
The permission manager and diagnostics pages are visible only to the signed sole administrator. The
permission manager can assign `slink.level`, `slink.war`, and `slink.war.officer`
to a Torn ID for a duration measured in hours; it cannot assign `admin.*`.

The War module uses `slink.war` for product access. It elects one active public
status collector, prioritizing clients without faction API access, and one
faction-capable attack collector. Live snapshots, retals, deduplication, and
collector leases remain in a per-war Durable Object. D1 receives only
ten-minute aggregate counters for losses, escapes, and observed-online war
hits. `slink.war.faction` is detected during authentication and is never a
purchased or manually assigned permission.

Version 0.5.0 added demand-aware API contribution to the multi-feature
interface foundation. Leveling can now run in **Contribute API only** mode:
it supplies assigned checks without showing targets or counting as an active
Leveling user. A normal Leveling session also stops creating demand after 20
minutes without interface activity and resumes as soon as the user interacts.

Version 0.4.1 added the multi-feature interface foundation and encrypted,
extension-wide Public Only API key donations:

- Torn-only content injection
- a background service worker
- extension-scoped storage
- scheduled alarms
- background/content messaging
- browser capability declarations
- D1-backed, Worker-issued role and scope handling
- `slink.level` access for the complete Leveling service
- a private `admin.*` namespace for Considious
- an admin-only zero routine API-contribution override
- a permission-aware module registry with per-module Torn visibility
- a tabbed main Torn panel for enabled modules
- per-module pop-out/pop-back-in controls and persistent movable positions
- centralized theme tokens plus three permission-gated cosmetic themes:
  `slink.theme.pursuit`, `slink.theme.underglow`, and
  `slink.theme.black-chrome`
- an inline, separate API Donation area with explicit remote-storage wording
- remote AES-GCM storage for donated Public Only keys through the separate
  SLINK Contribution Service
- revocation that erases remote encrypted key material
- an automatic SLINK Worker connection check
- a readable, selectable diagnostic report
- a full-tab SLINK dashboard outside Torn
- live Worker terms and authenticated member sessions
- Leveling recommendations and local Fair Fight estimates
- FFScouter refinement cached locally
- coordinated, paced Torn status collection and durable retry state
- deterministic client-side target ownership across active collectors
- local completion of unchanged `Okay` checks without a Worker or D1 request
- activity-snapshot and attack-page observation reporting

The Leveling Torn and FFScouter API keys and signed SLINK session stay in extension-local
background storage and are never returned to the Torn content script or dashboard.
The Torn key is sent to the SLINK Worker only during authentication, matching the
current Leveling terms and Worker contract.

A donated Public Only key follows a different, explicit consent flow. It is
validated and encrypted by the SLINK Contribution Service for allowlisted
public requests while the donor is offline. Feature modules cannot retrieve
the plaintext key. The extension retains only a random management token used
to view or revoke the donation.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `SLINK-Browser-Extension` folder.
5. Open Torn and click the SLINK extension button.
6. Choose **Open SLINK dashboard** for full-page setup and monitoring.

`Load unpacked` is the development installation flow. A published Chrome Web
Store build will use Chrome's normal one-click installation flow.

## Test it

The tests use Node.js only; there are no packages to install.

```text
npm test
```

## Architecture

```text
Torn page content script
    <-> runtime messages
Extension service worker
    <-> extension storage / alarms / approved remote APIs
SLINK Workers, Torn API, and FFScouter
```

`src/core` contains shared extension-safe replacements for the reusable parts of Core Lib. Page-specific DOM work stays in `src/content`; privileged network and scheduling work stays in `src/background`.

## Permission model

SLINK uses two separate permission layers:

1. **Browser capabilities** control which browser APIs and remote origins the installed extension may access. Torn, Torn API, FFScouter, and the SLINK Worker are core dependencies and are granted together at installation. There are no separate in-app permission buttons.
2. **SLINK scopes** are supplied by the authenticated SLINK Worker and control which modules and server operations the Torn user may use.

Before authentication, the extension has no SLINK server scopes. Torn authentication establishes identity, while the standalone `slink-permissions` D1 database supplies product access. Current Slinky's members receive `slink.level` and `slink.war` automatically; users outside the faction may receive either product scope through an active purchased or manual grant. A successful faction-attack capability probe adds the temporary `slink.war.faction` scope for that War session. Faction-wide War control and retained logs require `slink.war.officer`. Considious also receives `admin.*`; diagnostics and permission management are not exposed without that signed scope. Each Worker signs its product scopes into its own session, and the extension combines them only for module visibility.

`admin.*` exposes the zero routine API-contribution override in both the Torn panel and full dashboard. The Worker rejects a zero-capacity claim from any session without that scope. Authentication still performs one Torn key validation, and Leveling may refresh the administrator's own battle stats locally; the override applies to routine shared-service contribution checks.

## Interface rule

SLINK overlay panels must be movable with mouse and touch, persist their last
position, remain clamped inside the visible viewport, and provide a position
reset. Every feature uses the shared tabbed shell. A feature can be popped into
its own movable window and returned to the main panel without losing state.
The combined Torn panel can collapse into a persistent movable, theme-aware
bubble without disabling background module behavior or alerts.
Tabs are created only when the user's scope permits the module and its **Show
GUI in Torn** preference is enabled.

## Adding a module

A module registers an ID, its required SLINK scopes, a URL matcher, and `start`/`stop` functions. Add its script before `src/content/content-script.js` in the manifest.

```javascript
SLINK_EXTENSION.modules.register({
  id: 'example',
  title: 'Example',
  defaultShowInTorn: false,
  requiredScopes: ['example.read'],
  matches: url => url.hostname === 'www.torn.com',
  async start(context) {
    context.ui.setStatus('Example ready', 'ready');
  }
});
```

## Planned next milestone

Verify Leveling and War against live Torn use, then add the next feature module to the same shared shell. Admin remains a separate private module sharing the same core.

