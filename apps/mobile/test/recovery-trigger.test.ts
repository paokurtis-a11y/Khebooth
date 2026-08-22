import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldRecoverFromAppState, shouldRecoverFromNetwork } from '../src/station/recovery-trigger';

test('network recovery triggers only when a connection is back and not known unreachable', () => {
  assert.equal(shouldRecoverFromNetwork({ isConnected: true, isInternetReachable: true }), true);
  assert.equal(shouldRecoverFromNetwork({ isConnected: true, isInternetReachable: undefined }), true);
  assert.equal(shouldRecoverFromNetwork({ isConnected: true, isInternetReachable: false }), false);
  assert.equal(shouldRecoverFromNetwork({ isConnected: false, isInternetReachable: false }), false);
  assert.equal(shouldRecoverFromNetwork({}), false);
});

test('app recovery triggers only when KHE returns to the active foreground state', () => {
  assert.equal(shouldRecoverFromAppState('active'), true);
  assert.equal(shouldRecoverFromAppState('background'), false);
  assert.equal(shouldRecoverFromAppState('inactive'), false);
  assert.equal(shouldRecoverFromAppState('unknown'), false);
});
