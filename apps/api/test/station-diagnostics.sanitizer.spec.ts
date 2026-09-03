import { normalizeStationDiagnosticReport, scrubDiagnosticText } from '../src/stations/station-diagnostics.sanitizer';

describe('station diagnostic sanitizer', () => {
  it('redacts credentials and personal email addresses before persistence', () => {
    const cleaned = scrubDiagnosticText(
      'authorization=secret Bearer abc.def.ghi password=hunter2 {"token":"json-secret"} owner@example.com?token=query-secret',
      2_000,
    );
    expect(cleaned).not.toContain('hunter2');
    expect(cleaned).not.toContain('owner@example.com');
    expect(cleaned).not.toContain('query-secret');
    expect(cleaned).not.toContain('json-secret');
    expect(cleaned).toContain('[REDACTED]');
  });

  it('normalizes untrusted input and limits the context', () => {
    const report = normalizeStationDiagnosticReport({
      reportId: '../../report-1',
      fingerprint: 'camera/hash?!',
      severity: 'NOT_REAL',
      source: 'capture.camera',
      message: 'token=super-secret camera failed',
      stack: 'Error at owner@example.com',
      context: { password: 'hunter2', attempt: 2, connected: false },
      appVersion: '0.3.9',
      platform: 'android-35',
      occurredAt: 'invalid-date',
    }, new Date('2026-09-03T10:00:00.000Z'));

    expect(report.reportId).toBe('....report-1');
    expect(report.fingerprint).toBe('camerahash');
    expect(report.severity).toBe('ERROR');
    expect(report.message).not.toContain('super-secret');
    expect(report.stack).not.toContain('owner@example.com');
    expect(report.context?.password).not.toBe('hunter2');
    expect(report.occurredAt).toBe('2026-09-03T10:00:00.000Z');
  });
});
