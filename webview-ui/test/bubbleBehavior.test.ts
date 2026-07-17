import assert from 'node:assert/strict';

import { test } from 'vitest';

import { isPersistentWaitingBubble } from '../src/office/engine/bubbleBehavior.js';

test('awaiting-input waiting bubble is persistent', () => {
  assert.equal(isPersistentWaitingBubble('waiting', true), true);
});

test('turn-finished ("Done") waiting bubble is transient', () => {
  assert.equal(isPersistentWaitingBubble('waiting', false), false);
  assert.equal(isPersistentWaitingBubble('waiting', undefined), false);
});

test('non-waiting bubbles are never persistent', () => {
  assert.equal(isPersistentWaitingBubble('permission', true), false);
  assert.equal(isPersistentWaitingBubble(null, true), false);
});
