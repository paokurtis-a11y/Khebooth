import assert from 'node:assert/strict';
import test from 'node:test';
import { canStartCapture } from '../src/capture/capture-start-policy';

test('une capture démarre uniquement depuis le bouton local', () => {
  assert.equal(canStartCapture('LOCAL_BUTTON'), true);
  assert.equal(canStartCapture('REMOTE_COMMAND'), false);
});
