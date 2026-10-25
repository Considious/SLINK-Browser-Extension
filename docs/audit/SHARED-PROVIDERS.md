# Candidate 4: selective shared providers

This testing-only batch implements Phase 4's provider contracts without migrating target records or claiming Phase 2/3 native-storage guarantees are complete.

## Personal stats

`core/shared-data.js` is the factory; `background/shared-data-service.js` supplies extension storage, HTTP and the existing Torn rate limiter. PDA loads the same factory at startup through `src/00-shared-data.part`, with `pdaSharedData()` supplying its existing storage bridge and limiter. Nothing is downloaded lazily when opening a module.

The compatible response is `/v2/user?selections=battlestats,basic`. The current official [Torn OpenAPI schema](https://www.torn.com/swagger/openapi.json) wraps basic information in `profile`; the response must identify the account and supply all four raw components and level. No user key was used for schema verification. Total and Leveling's existing sum-of-square-roots score come from those components, never from a community estimate or a legacy total.

Each cache entry is bound to a SHA-256 fingerprint of the credential, not the credential itself. This deliberately does not assume that two different keys belong to one player. Same-key compatible requests coalesce. Forced requests supersede older nonforced requests; a late response cannot overwrite a newer request's data. Stats and level retain distinct as-of fields. Consumers retain their existing freshness requirements and permission/terms gates.

Extension state is additive in `shared.providers.v1`; legacy keys are not erased. PDA catalog/provider state is additive in its existing data cache. Canonical personal records are also kept under the existing dedicated own-stat key, with a `sharedProviderPersonal` map. PDA selects newer records per audience when reconciling that map. Its older display-cache compatibility remains, but legacy totals are not admitted to the canonical provider. A known authenticated-account mismatch is not displayed as current Mugging stats.

The queue serializes writes within one provider instance and recovers after rejection. It does not create a native storage transaction or a cross-WebView lock. Existing PDA storageWrite acknowledgement limitations remain; no cloud backup is automatically restored.

## Full public item catalog

Market, Museum, Abroad landing prices and Money use the compatible `cat=All` endpoint. Metadata and per-item price clocks are independent. Existing normalization/filtering remains in place. A missing price retains its prior price/as-of time or remains unavailable; a real zero is authoritative. A price-sensitive request whose complete coverage is too old fails rather than promoting unknown values to current prices. Consumers keep their existing cached display/error behavior.

Private inventory, live item-market listings, supplier observations, bank rates and stock/merit catalogs remain separate. Catalog cache access does not grant a feature permission. Market's signed access check and the other feature gates remain at their entry points.

## Target intelligence

Both normalizers persist `fieldMeta` source/time entries independently for status, name, level, raw target estimate, FF, bounty count and bounty total. A partial input only updates fields actually observed. Status-only activity does not refresh the estimate clock. An estimate-only initial record is not treated as a fresh status check. Missing/null bounty data is not a clear; explicit zero is. Serialized metadata survives subsequent normalization.

Shared FF has optional `fairFightContext` containing observerId and ownStatsAt. The extension contextual accessor rejects missing/mismatched context; Target List no longer treats an unbound shared FF value as current. Contributor reports retain raw target estimates but omit observer-dependent FF. Existing feature-owned War/Bounty/Leveling FF caches, formulas and outage behavior are not globally migrated in this batch.

## Verification and remaining work

New shared-data behavioral regressions run separately against extension and PDA code. Existing Money fixtures load the real factory/adapter rather than bypassing the catalog contract. Tests cover coalescing, force order, write recovery, incomplete responses, unknown versus zero, account isolation and independent field ages. PDA startup verification covers every manifest file from one pinned source revision.

This does not prove live Torn rendering or physical Android persistence. Complete the cumulative tester checklist, then address remaining editor/lifecycle/native-storage work, dashboard parity and startup/performance before any main promotion.
