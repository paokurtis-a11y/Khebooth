import { countBlockingChecks, countWarnings, eventReadyState, isRecentHeartbeat, type ReadinessCheck } from '../src/readiness/event-ready-model';

function check(level: ReadinessCheck['level']): ReadinessCheck {
  return { id: level, title: level, detail: level, level };
}

describe('KHE Event Ready', () => {
  it('is READY when checks are passing or informational', () => {
    expect(eventReadyState([check('PASS'), check('INFO'), check('PASS')])).toBe('READY');
  });

  it('is ATTENTION when at least one warning exists without a blocker', () => {
    expect(eventReadyState([check('PASS'), check('WARN'), check('INFO')])).toBe('ATTENTION');
    expect(countWarnings([check('WARN'), check('PASS'), check('WARN')])).toBe(2);
  });

  it('is BLOCKED when any blocking check fails', () => {
    expect(eventReadyState([check('PASS'), check('WARN'), check('BLOCK')])).toBe('BLOCKED');
    expect(countBlockingChecks([check('BLOCK'), check('PASS'), check('BLOCK')])).toBe(2);
  });

  it('only considers a recent CAPTURE heartbeat online', () => {
    const now = Date.parse('2026-08-22T08:00:00.000Z');
    expect(isRecentHeartbeat('2026-08-22T07:59:56.000Z', now)).toBe(true);
    expect(isRecentHeartbeat('2026-08-22T07:59:50.000Z', now)).toBe(false);
    expect(isRecentHeartbeat(null, now)).toBe(false);
  });
});
