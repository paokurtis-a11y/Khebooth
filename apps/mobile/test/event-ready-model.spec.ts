import assert from 'node:assert/strict';
import test from 'node:test';
import { countBlockingChecks, countWarnings, eventReadyState, isRecentHeartbeat, type ReadinessCheck } from '../src/readiness/event-ready-model';

function check(level: ReadinessCheck['level']): ReadinessCheck {
  return { id: level, title: level, detail: level, level };
}

test('KHE Event Ready is READY when checks are passing or informational', () => {
  assert.equal(eventReadyState([check('PASS'), check('INFO'), check('PASS')]), 'READY');
});

test('KHE Event Ready is ATTENTION when at least one warning exists without a blocker', () => {
  assert.equal(eventReadyState([check('PASS'), check('WARN'), check('INFO')]), 'ATTENTION');
  assert.equal(countWarnings([check('WARN'), check('PASS'), check('WARN')]), 2);
});

test('KHE Event Ready is BLOCKED when any blocking check fails', () => {
  assert.equal(eventReadyState([check('PASS'), check('WARN'), check('BLOCK')]), 'BLOCKED');
  assert.equal(countBlockingChecks([check('BLOCK'), check('PASS'), check('BLOCK')]), 2);
});

test('KHE Event Ready only considers a recent CAPTURE heartbeat online', () => {
  const now = Date.parse('2026-08-22T08:00:00.000Z');
  assert.equal(isRecentHeartbeat('2026-08-22T07:59:56.000Z', now), true);
  assert.equal(isRecentHeartbeat('2026-08-22T07:59:50.000Z', now), false);
  assert.equal(isRecentHeartbeat(null, now), false);
});
