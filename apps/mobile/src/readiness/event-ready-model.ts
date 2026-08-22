export type ReadinessLevel = 'PASS' | 'WARN' | 'BLOCK' | 'INFO';
export type EventReadyState = 'READY' | 'ATTENTION' | 'BLOCKED';

export interface ReadinessCheck {
  id: string;
  title: string;
  detail: string;
  level: ReadinessLevel;
}

export function eventReadyState(checks: ReadinessCheck[]): EventReadyState {
  if (checks.some((check) => check.level === 'BLOCK')) return 'BLOCKED';
  if (checks.some((check) => check.level === 'WARN')) return 'ATTENTION';
  return 'READY';
}

export function isRecentHeartbeat(value: string | Date | null | undefined, nowMs = Date.now(), maxAgeMs = 6_000): boolean {
  if (!value) return false;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) && nowMs - timestamp >= 0 && nowMs - timestamp <= maxAgeMs;
}

export function countBlockingChecks(checks: ReadinessCheck[]): number {
  return checks.filter((check) => check.level === 'BLOCK').length;
}

export function countWarnings(checks: ReadinessCheck[]): number {
  return checks.filter((check) => check.level === 'WARN').length;
}
