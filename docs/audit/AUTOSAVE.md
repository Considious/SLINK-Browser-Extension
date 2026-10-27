# Shared preference autosave contract

Candidate 18 adds Racing nickname inputs. Field keys are build ID plus `:name`; completion/view actions flush nickname drafts before separate acknowledged patches. The owner reads the existing garage inside a recoverable queue, validates 1–22-character names, preserves unknown build/record fields, and never accepts a full stale UI snapshot. Suggested names persist as the existing empty custom-name sentinel. Invalid text stays visible but is not committed. Cards remain mounted and filter via visibility, so view/completion changes cannot rebuild the nickname fields. No Racing APIs or automatic car clicks are introduced. PDA receives only the independent highlight fix, not this extension storage/ack contract.

Candidate 16 introduces `SLINK.core.formState.autosave`. Bounties is the first consumer; Candidate 17 adopts it for Company personal addiction-alert thresholds. This is an extension UI helper, not a native PDA transaction layer, cloud restore mechanism, replacement storage owner or permission bypass.

Company's settings owner serializes read/merge/write operations, preserves unknown stored fields and returns only normalized settings after storage completion. It never refreshes the company/roster as a side effect of saving a preference. The UI submits one changed threshold, keeps its editor mounted across same-company/role refreshes and fences older full-status settings without freezing actual company or director-role updates. Director-only employee threshold visibility and explicit Refresh/chat actions remain unchanged. These are personal reminder thresholds, not shared company policy. Cleanup awaits the helper; page-hide/abrupt termination limitations below still apply.

```js
const controller = SLINK.core.formState.autosave({
  root: contentRoot,
  fields: { 'my-setting-input': 'settingKey' },
  read: key => committedSettings[key],
  save: patch => sendToExistingBackgroundMutationOwner(patch),
  select: response => response.settings,
  onCommit: (acknowledgedPatch, response) => {
    committedSettings = { ...committedSettings, ...acknowledgedPatch };
    // Patch read-only results/status, not the mounted editor.
  },
  onState: status => updateSmallStatusIndicator(status),
  delay: 600
});
controller.mount(); // after an actual editor mount, not every data render
await controller.flush(); // before an action that needs committed settings
await controller.stop(); // await during retained-module cleanup
```

The configured own-ID allowlist is authoritative. Never register API keys, terms acceptance, purchases, messages, attacks, money transfers or full faction-policy submissions as generic preference autosave. Toggle/select `change` submits immediately; text/number `input` is debounced, with change/blur flushing. Blank/incomplete numbers are retained and reported, not converted into defaults. Valid out-of-range values are normalized by the existing background owner. Registering an input does not grant authorization; existing route/feature permission checks remain mandatory.

`save` must submit immediately to a recoverable, serialized background mutation owner. Do not add another deferred UI write queue: it can reorder intent across paused/resumed instances. Return a small acknowledged object containing canonical values for every submitted field, without credentials. Reject failed writes or invalid/missing acknowledgements. The helper handles per-field response ordering, shared form-guard tickets, newer typing and duplicate same-value pending submissions. `onCommit` receives only the accepted submitted field patch, not authority to replace unrelated settings with an old full snapshot. Consumers must separately fence full result/runtime responses against newer writes.

Keep the actual editor nodes mounted. The helper updates a confirmed field only if its ticket is current; it does not make arbitrary consumer rerenders safe. Update only changed read-only results, status and button state. Use `state()`/`onState` for Saving/Saved/Failed/invalid, and `retry()` for failed drafts. `mount()` waits for the existing local form guard's retained drafts; known-model differences are recovered, invalid drafts remain visible, and undefined/null model values do not cause default writes. No remote backup is read.

`flush()` settles all submitted/in-flight writes and rejects if a draft is invalid or a save failed. Do not start dependent operations after rejection. `stop()` is idempotent, submits pending valid drafts, removes listeners/timers and waits for local write completion; failed drafts remain in the existing form guard. Page-hide flush is best effort. Abrupt browser/process termination before acknowledgement cannot be promised to preserve uncommitted typing; Saved means an acknowledgement was received, not merely a click.

Autosave must not cause Torn/provider requests, scan restarts or expensive full-result reads per keystroke. Bounties sends `deferScanRestart:true` (transport only, not stored), receives a small redacted settings acknowledgement and coalesces any local result read after writes settle. Enabling the tracker deliberately resumes its existing scheduler; filter edits do not restart its crawl. Manual Refresh/Restart flush preferences before acting. Credentials remain behind Save API keys. Other editors still need explicit adoption/testing; do not simply remove their Save buttons.
