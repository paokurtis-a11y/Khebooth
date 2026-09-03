import assert from 'node:assert/strict';
import test from 'node:test';
import type { StationDiagnosticReportContract } from '@khe/contracts';
import type { StationExperienceApi } from '../src/api/station-api';
import { createMobileDiagnosticReport, diagnosticFingerprint, scrubMobileDiagnosticText } from '../src/diagnostics/diagnostic-sanitizer';
import { MobileDiagnosticReporter } from '../src/diagnostics/mobile-diagnostic-reporter';
import { MemoryLocalStore } from '../src/offline/memory-store';

test('le diagnostic masque les secrets, jetons et adresses e-mail', () => {
  const cleaned = scrubMobileDiagnosticText(
    'Bearer very.secret.token password=hunter2 {"token":"json-secret"} user=paokurtis@gmail.com https://khe.test?a=1&token=abc123',
    2_000,
  );
  assert.equal(cleaned.includes('very.secret.token'), false);
  assert.equal(cleaned.includes('hunter2'), false);
  assert.equal(cleaned.includes('paokurtis@gmail.com'), false);
  assert.equal(cleaned.includes('abc123'), false);
  assert.equal(cleaned.includes('json-secret'), false);
  assert.match(cleaned, /REDACTED/);
});

test('une même erreur garde la même empreinte mais reçoit un identifiant de rapport unique', () => {
  const first = createMobileDiagnosticReport({
    source: 'capture.camera',
    error: new Error('Preview unavailable'),
    appVersion: '0.3.9',
    platform: 'android-35',
    now: new Date('2026-09-03T10:00:00.000Z'),
    random: () => 0.1,
  });
  const second = createMobileDiagnosticReport({
    source: 'capture.camera',
    error: new Error('Preview unavailable'),
    appVersion: '0.3.9',
    platform: 'android-35',
    now: new Date('2026-09-03T10:01:00.000Z'),
    random: () => 0.2,
  });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.notEqual(first.reportId, second.reportId);
  assert.notEqual(diagnosticFingerprint('capture.camera', 'Preview unavailable'), diagnosticFingerprint('sharing', 'Preview unavailable'));
});

test('un rapport reste en file hors ligne puis disparaît après envoi réussi', async () => {
  const store = new MemoryLocalStore();
  let online = false;
  const received: StationDiagnosticReportContract[] = [];
  const api = {
    reportDiagnostic: async (_token: string, report: StationDiagnosticReportContract) => {
      if (!online) throw new Error('network request failed');
      received.push(report);
      return { accepted: true as const, deduplicated: false, rateLimited: false, conversationId: 'support-1', emailSent: true };
    },
  } as unknown as StationExperienceApi;
  const reporter = new MobileDiagnosticReporter(api, store);
  const report = createMobileDiagnosticReport({
    source: 'sharing.error-boundary',
    error: new Error('render failed'),
    appVersion: '0.3.9',
    platform: 'android-35',
  });

  await reporter.capture('station-token', report);
  assert.equal((await store.listPendingDiagnostics()).length, 1);

  const queued = (await store.listPendingDiagnostics())[0];
  assert.ok(queued);
  await store.upsertDiagnostic({ ...queued, nextAttemptAt: new Date(0).toISOString() });
  online = true;
  await reporter.flush('station-token');

  assert.equal(received.length, 1);
  assert.equal(received[0]?.fingerprint, report.fingerprint);
  assert.equal((await store.listPendingDiagnostics()).length, 0);
});
