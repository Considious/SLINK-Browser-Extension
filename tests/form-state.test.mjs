import assert from 'node:assert/strict';
import fs from 'node:fs';

const formState = fs.readFileSync(new URL('../src/core/form-state.js', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../src/content/ui-shell.js', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../src/dashboard/dashboard.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

assert(formState.includes("'input, textarea, select, [contenteditable=\"true\"]'"), 'All editable controls must be guarded.');
assert(formState.includes("new MutationObserver(scheduleRestore)"), 'Background DOM replacements must restore dirty controls.');
assert(formState.includes("focusTarget.focus({ preventScroll:true })"), 'Focused controls must be restored without jumping the page.');
assert(formState.includes("'save|submit|apply|update|confirm|cancel|reset|clear|remove|delete'".replaceAll("'", "")) || formState.includes("(save|submit|apply|update|confirm|cancel|reset|clear|remove|delete)"), 'Explicit save/cancel/reset actions must release guarded state.');
assert(shell.includes("element.dataset.slinkModuleId = module.id"), 'Each Torn module must have a stable form-state scope.');
assert(shell.includes("SLINK.core.formState?.protect(shadow)"), 'The Torn UI shell must install the shared guard once.');
assert(dashboard.includes("SLINK.core.formState?.protect(document)"), 'The extension dashboard must use the same shared guard.');
assert(manifest.content_scripts[0].js.indexOf('src/core/form-state.js') < manifest.content_scripts[0].js.indexOf('src/content/ui-shell.js'), 'The form-state core must load before the UI shell.');

console.log('Shared non-destructive form-state wiring is verified.');
