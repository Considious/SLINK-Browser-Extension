import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { plan, steps, advance } = createRequire(import.meta.url)('../src/modules/travel-run.js');
const queue = steps(plan({ sell: 'Plushie', buys: ['Xanax', ' xanax ', '', 'Shark Fin'], fallback: 'hospital' }));

test('sale, priority order, fallback, and return are explicit steps', () => {
  assert.deepEqual(queue.map(step => step.label), ['Sell Plushie', 'Buy Xanax', 'Buy Shark Fin', 'Self-hospitalize', 'Return to Torn']);
  assert.equal(advance(queue, 0, 'done'), 1);
  assert.equal(advance(queue, 1, 'unavailable'), 2);
  assert.equal(advance(queue, 2, 'unavailable'), 3);
  assert.equal(advance(queue, 3, 'done'), 4);
  assert.equal(advance(queue, 4, 'done'), 5);
});

test('buying any option skips remaining options and the fallback', () => {
  assert.equal(advance(queue, 1, 'done'), 4);
  assert.equal(advance(queue, 2, 'done'), 4);
});

test('medical fallback can be skipped; unknown outcomes do not move the run', () => {
  assert.equal(advance(queue, 1, 'unknown'), 1);
  assert.equal(advance(queue, 3, 'unavailable'), 4);
  assert.deepEqual(steps(plan({ fallback: 'constructor' })).map(step => step.type), ['home']);
});
