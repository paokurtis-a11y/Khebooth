import type { StationDiagnosticReportContract } from '@khe/contracts';
import type { StationExperienceApi } from '../api/station-api';
import type { LocalStore } from '../offline/local-store';
import type { QueuedDiagnosticReport } from '../offline/types';

const CLIENT_DEDUPLICATION_MS = 60_000;
const MAX_BACKOFF_MS = 15 * 60_000;

function retryDelay(retryCount: number): number {
  return Math.min(MAX_BACKOFF_MS, 5_000 * (2 ** Math.min(8, retryCount)));
}

function queued(report: StationDiagnosticReportContract): QueuedDiagnosticReport {
  return {
    ...report,
    occurredAt: new Date(report.occurredAt).toISOString(),
    retryCount: 0,
    nextAttemptAt: new Date().toISOString(),
    lastError: null,
  };
}

function payload(report: QueuedDiagnosticReport): StationDiagnosticReportContract {
  const { retryCount: _retryCount, nextAttemptAt: _nextAttemptAt, lastError: _lastError, ...value } = report;
  return value;
}

export class MobileDiagnosticReporter {
  private flushPromise: Promise<void> | null = null;
  private readonly recentFingerprints = new Map<string, number>();

  constructor(private readonly api: StationExperienceApi, private readonly store: LocalStore) {}

  async capture(stationToken: string, report: StationDiagnosticReportContract): Promise<void> {
    const now = Date.now();
    const lastSeenAt = this.recentFingerprints.get(report.fingerprint) ?? 0;
    if (now - lastSeenAt < CLIENT_DEDUPLICATION_MS) return;
    this.recentFingerprints.set(report.fingerprint, now);
    await this.store.upsertDiagnostic(queued(report));
    await this.flush(stationToken);
  }

  async flush(stationToken: string): Promise<void> {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.flushQueued(stationToken).finally(() => { this.flushPromise = null; });
    return this.flushPromise;
  }

  private async flushQueued(stationToken: string): Promise<void> {
    const reports = await this.store.listPendingDiagnostics(10);
    const now = Date.now();
    for (const report of reports) {
      if (Date.parse(report.nextAttemptAt) > now) continue;
      try {
        await this.api.reportDiagnostic(stationToken, payload(report));
        await this.store.removeDiagnostic(report.reportId);
      } catch (error) {
        const retryCount = report.retryCount + 1;
        await this.store.upsertDiagnostic({
          ...report,
          retryCount,
          nextAttemptAt: new Date(Date.now() + retryDelay(retryCount)).toISOString(),
          lastError: error instanceof Error ? error.message.slice(0, 300) : 'Envoi impossible',
        });
        break;
      }
    }
  }
}
