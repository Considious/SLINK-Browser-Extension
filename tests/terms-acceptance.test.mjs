import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const permission = read('src/background/permission-service.js');
const leveling = read('src/background/leveling-service.js');
const war = read('src/background/war-service.js');
const dashboard = read('src/dashboard/dashboard.js');
const adhd = read('src/background/adhd-service.js');

assert.match(permission, /accepted\?\.sha256 \|\| accepted\?\.documentSha256/);
assert.match(permission, /leveling\.acceptedTerms\.v1/);
assert.match(permission, /war\.acceptedTerms\.v1/);
assert.match(leveling, /access\.acceptedTerms\.v1/);
assert.match(leveling, /war\.acceptedTerms\.v1/);
assert.match(leveling, /accepted\.documentSha256 \|\| accepted\.sha256/);
assert.match(war, /access\.acceptedTerms\.v1/);
assert.match(war, /leveling\.acceptedTerms\.v1/);
assert.match(war, /accepted\?\.sha256 \|\| accepted\?\.documentSha256/);
assert.match(dashboard, /enabledTermsAccepted/);
assert.match(dashboard, /enabled:leveling\?\.settings\?\.hasTornKey === true/);
assert.doesNotMatch(dashboard, /acceptTerms\s*:\s*acceptTerms\s*&&/);
assert.match(dashboard, /leveling\.settings\.save[\s\S]*?acceptTerms\s*\n\s*}\)\)/);
assert.match(dashboard, /war\.settings\.save[\s\S]*?turtleMinutes:[^\n]+acceptTerms/);
assert.match(dashboard, /access\.settings\.save[\s\S]*?tornKey,\s*\n\s*acceptTerms/);
assert.match(adhd, /SNAPSHOT_MAX_AGE_MS = 15 \* 60_000/);
assert.match(adhd, /function usableSnapshot/);
assert.match(adhd, /const snapshot = usableSnapshot\(currentRuntime\)/);

console.log('SLINK shared Terms and stale-alert regression checks passed.');

