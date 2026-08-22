import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSyncNetwork, shouldImmediateReconnect } from '../src/settings/network-policy';

const base = { wifiPreferred: true, askBeforeMobileData: true };

test('offline or unreachable network never starts an upload', () => {
  assert.equal(evaluateSyncNetwork(base, { type: 'WIFI' as never, isConnected: false, isInternetReachable: false }, false), 'OFFLINE');
  assert.equal(evaluateSyncNetwork(base, { type: 'WIFI' as never, isConnected: true, isInternetReachable: false }, false), 'OFFLINE');
});

test('Wi-Fi and ethernet-like connections are allowed without prompting', () => {
  assert.equal(evaluateSyncNetwork(base, { type: 'WIFI' as never, isConnected: true, isInternetReachable: true }, false), 'ALLOW');
  assert.equal(evaluateSyncNetwork(base, { type: 'ETHERNET' as never, isConnected: true, isInternetReachable: true }, false), 'ALLOW');
});

test('cellular asks once when confirmation is enabled and then allows the approved session', () => {
  const cellular = { type: 'CELLULAR' as never, isConnected: true, isInternetReachable: true };
  assert.equal(evaluateSyncNetwork(base, cellular, false), 'PROMPT_CELLULAR');
  assert.equal(evaluateSyncNetwork(base, cellular, true), 'ALLOW');
});

test('Wi-Fi preferred blocks unapproved cellular when mobile confirmation is disabled', () => {
  const cellular = { type: 'CELLULAR' as never, isConnected: true, isInternetReachable: true };
  assert.equal(evaluateSyncNetwork({ wifiPreferred: true, askBeforeMobileData: false }, cellular, false), 'WAIT_FOR_WIFI');
  assert.equal(evaluateSyncNetwork({ wifiPreferred: false, askBeforeMobileData: false }, cellular, false), 'ALLOW');
});

test('automatic station recovery only fires when the setting is enabled', () => {
  assert.equal(shouldImmediateReconnect(true, true), true);
  assert.equal(shouldImmediateReconnect(false, true), false);
  assert.equal(shouldImmediateReconnect(true, false), false);
});
