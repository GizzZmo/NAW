import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { LookAheadScheduler } from './AudioWorkletEngine';

test('scheduler dispatches events in time order within the look-ahead horizon', () => {
  let now = 1;
  const scheduler = new LookAheadScheduler(() => now, 25, 10);
  const fired: string[] = [];

  scheduler.schedule({ time: 1.08, callback: () => fired.push('later') });
  scheduler.schedule({ time: 1.02, callback: () => fired.push('first') });
  scheduler._dispatchDue();

  assert.deepEqual(fired, ['first']);
  now = 1.1;
  scheduler._dispatchDue();
  assert.deepEqual(fired, ['first', 'later']);
});

test('scheduler rejects invalid event times and callbacks', () => {
  const scheduler = new LookAheadScheduler(() => 0);
  assert.throws(() => scheduler.schedule({ time: Number.NaN, callback: () => undefined }), RangeError);
  assert.throws(() => scheduler.schedule({ time: -1, callback: () => undefined }), RangeError);
  assert.throws(() => scheduler.schedule({ time: 1, callback: null as unknown as () => void }), TypeError);
});

test('scheduler cancellation removes only matching pending events', () => {
  const scheduler = new LookAheadScheduler(() => 0);
  scheduler.schedule({ time: 1, callback: () => undefined });
  scheduler.schedule({ time: 2, callback: () => undefined });
  scheduler.cancel(event => event.time === 1);
  assert.equal(scheduler.pendingCount, 1);
});
