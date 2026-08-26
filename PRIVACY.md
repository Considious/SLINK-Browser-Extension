# SLINK Browser Extension Privacy Policy

**Effective date:** August 26, 2026  
**Last updated:** August 26, 2026

## Scope and purpose

This Privacy Policy applies to the SLINK Browser Extension ("SLINK"). SLINK's
single purpose is to provide Torn players with combat-assistance and
faction-war coordination features, including Leveling recommendations, War
targets and status information, retaliation alerts, med-out claims, and
related coordination tools.

SLINK is an independent project and is not produced, endorsed, or operated by
Torn, FFScouter, Google, or Cloudflare.

## Information SLINK handles

SLINK handles only information needed to provide its disclosed features.

### Torn account identifiers

SLINK may process a Torn numeric user ID, username, faction ID, faction
membership, SLINK roles, and permission scopes. These identifiers are used to
verify identity, determine product access, and coordinate faction features.

### Authentication information

SLINK may process a user-provided Torn API key, an optional FFScouter API key,
SLINK session tokens, and an API-donation management token.

- Ordinary Torn and FFScouter keys are saved in the extension's local Chrome
  storage. They are used only for the features selected by the user.
- A Torn key is transmitted over HTTPS to the applicable SLINK Worker during
  authentication so SLINK can verify Torn identity, faction membership, API
  access, accepted terms, and product permissions. Ordinary user API keys are
  not retained in SLINK's remote databases.
- Keys may be sent directly over HTTPS to the Torn API or FFScouter when their
  corresponding feature requires data from that service.
- A separately submitted **Public Only** Torn API key may be donated through an
  explicit consent flow. The SLINK Contribution Service validates and stores
  that donated key in encrypted form for allowlisted public requests while the
  donor is offline. The extension cannot retrieve the plaintext donated key.
  Revocation erases its encrypted key material.

Users should never submit an API key through support messages, GitHub issues,
or any public channel.

### Torn gameplay and user activity

Depending on the enabled modules and API access level, SLINK may process:

- battle-stat and Fair Fight estimates;
- target IDs, names, levels, status, hospital timing, travel status, and
  activity indicators;
- attacks, results, timestamps, retaliation data, chain state, and War
  counters;
- faction and opposing-faction identifiers and member information;
- target observations contributed to shared Leveling or War services;
- med-out claims and user-triggered faction-chat callouts; and
- timestamps showing recent interaction with SLINK, used to stop unnecessary
  polling when the extension is idle.

SLINK does not record keystrokes, mouse movement, or general browser activity.
It does not read or retain faction-chat conversations. A faction callout is
placed into Torn's chat composer only after the user presses the relevant
button.

### Limited Torn website content and page information

The content script runs only on `https://www.torn.com/`. It may read limited
visible Torn page content needed to identify the current combat target and
status shown by Torn. It also stores the most recently registered Torn origin
and page path locally for extension-injection diagnostics.

SLINK does not monitor pages on unrelated websites or maintain a general
browsing-history profile.

### Preferences, diagnostics, and temporary operational data

SLINK stores settings such as enabled modules, polling preferences, panel
position and visibility, theme selection, terms acceptance, API-use counters,
worker connection status, temporary target caches, pending checks, and error or
diagnostic state. These values keep the extension functional across Manifest V3
service-worker restarts and help the user diagnose configuration problems.

## How information is used

SLINK uses the information described above only to:

- authenticate the Torn user and determine SLINK permissions;
- provide Leveling recommendations and Fair Fight estimates;
- provide War targets, status, retaliation alerts, claims, counters, and
  authorized officer features;
- coordinate shared target observations and avoid duplicate API work;
- operate an optional Public Only API-key contribution service;
- remember user settings and accepted terms;
- enforce API-rate limits and reduce unnecessary polling; and
- maintain, secure, and diagnose SLINK's disclosed functionality.

SLINK does not use user data for advertising, credit decisions, unrelated
analytics, or data-broker activity.

## Storage and retention

### Local Chrome storage

Ordinary API keys, settings, sessions, permissions, caches, and diagnostics are
stored in `chrome.storage.local` on the user's device. Local information remains
until the user removes it through SLINK, clears the extension's data, or
uninstalls the extension. Session tokens also expire according to their issued
expiration time.

### SLINK services

SLINK services may retain identity and permission records, accepted-terms
records, product-access grants, shared target observations, War coordination
records, and aggregated War logs where required to provide the selected
features. Expired or revoked grants are not accepted for access.

A donated Public Only API key remains encrypted until it is replaced or
revoked. Revocation removes its encrypted key material. Non-secret consent and
audit records may be retained to document the terms that governed the service.

Temporary War snapshots, collector leases, and deduplication state may be held
in short-lived service storage. Aggregated War records may be retained for
authorized officer and administrative views.

## Services that receive information

Information is shared only as necessary with:

- **Torn API**, to retrieve data authorized by the user's Torn API key;
- **FFScouter**, when the user supplies an FFScouter key and enables features
  that require Fair Fight data;
- **SLINK Workers**, to authenticate users, enforce permissions, coordinate
  Leveling and War data, manage claims, and operate optional API contribution;
  and
- **Cloudflare**, which hosts SLINK Workers and databases and processes the
  network requests required to deliver those services.

SLINK does not sell personal information or authentication information. SLINK
does not share information with advertising platforms or data brokers.

## Security

SLINK uses HTTPS for transmissions to Torn, FFScouter, and SLINK services.
Remote requests are restricted to the specific HTTPS origins declared in the
extension manifest. All extension-executed code is packaged with the extension;
remote responses are treated as data and are not executed as code.

Donated Public Only API keys are encrypted at rest by the SLINK Contribution
Service. No system can guarantee absolute security, so users should protect
their Chrome profile and device, use the least-privileged API access that meets
their needs, and revoke any key they believe may be compromised.

## User choices and deletion

Users may:

- remove locally saved Torn and FFScouter keys from the SLINK dashboard;
- clear authenticated sessions;
- disable individual in-Torn interfaces;
- revoke a donated Public Only key, which erases its encrypted key material;
- clear all local extension data or uninstall SLINK; and
- request assistance concerning remote SLINK records by contacting the project.

Do not include API keys, session tokens, or other secrets in a deletion or
support request.

## Limited Use compliance

The use of information received from Google APIs will adhere to the Chrome Web
Store User Data Policy, including the Limited Use requirements.

SLINK limits its use and transfer of user data to providing and improving its
disclosed user-facing features, maintaining security and reliability, complying
with applicable law, and investigating abuse where necessary. SLINK does not
permit human access to user data except with specific user consent for support,
for security or abuse investigation, when legally required, or when data has
been aggregated and anonymized for permitted internal operations.

## Changes to this policy

This policy may be updated when SLINK's features or data practices change. The
effective date and last-updated date will be revised, and material changes will
be disclosed through the extension or its public project pages before the new
practice begins where required.

## Contact

Privacy and support questions may be submitted through the
[SLINK Browser Extension repository](https://github.com/Considious/SLINK-Browser-Extension).
Do not post API keys or other secrets publicly.
