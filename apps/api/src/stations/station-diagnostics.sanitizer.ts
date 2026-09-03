export type DiagnosticSeverity = 'WARNING' | 'ERROR' | 'FATAL';

export interface StationDiagnosticReport {
  reportId: string;
  fingerprint: string;
  severity: DiagnosticSeverity;
  source: string;
  message: string;
  stack: string | null;
  context: Record<string, string | number | boolean | null>;
  appVersion: string;
  platform: string;
  occurredAt: string;
}

const SECRET_ASSIGNMENT = /\b(password|passwd|pwd|token|secret|api[-_]?key|authorization|cookie|session)\b["']?\s*[:=]\s*["']?([^\s,;"'}]+)/gi;
const BEARER_TOKEN = /\bBearer\s+[-A-Za-z0-9._~+/=]*/gi;
const JWT_TOKEN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]{10,})?\b/g;
const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SENSITIVE_QUERY = /([?&](?:token|secret|key|password|signature|authorization)=)[^&#\s]+/gi;
const SENSITIVE_CONTEXT_KEY = /^(?:password|passwd|pwd|token|secret|api[-_]?key|authorization|cookie|session)$/i;

export function scrubDiagnosticText(value: unknown, maxLength: number): string {
  const source = typeof value === 'string' ? value : String(value ?? '');
  return source
    .replace(BEARER_TOKEN, 'Bearer [REDACTED]')
    .replace(JWT_TOKEN, '[JWT REDACTED]')
    .replace(SECRET_ASSIGNMENT, (_match, key: string) => `${key}=[REDACTED]`)
    .replace(SENSITIVE_QUERY, '$1[REDACTED]')
    .replace(EMAIL_ADDRESS, '[EMAIL REDACTED]')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function diagnosticSeverity(value: unknown): DiagnosticSeverity {
  return value === 'FATAL' || value === 'WARNING' ? value : 'ERROR';
}

function diagnosticContext(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 24);
  return Object.fromEntries(entries.map(([rawKey, rawValue]) => {
    const key = scrubDiagnosticText(rawKey, 50) || 'context';
    if (SENSITIVE_CONTEXT_KEY.test(key)) return [key, '[REDACTED]'];
    if (rawValue === null || typeof rawValue === 'boolean') return [key, rawValue];
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) return [key, rawValue];
    return [key, scrubDiagnosticText(rawValue, 300)];
  }));
}

function fallbackFingerprint(source: string, message: string): string {
  let hash = 2166136261;
  for (const character of `${source}|${message}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `server-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function normalizeStationDiagnosticReport(input: unknown, now = new Date()): StationDiagnosticReport {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const source = scrubDiagnosticText(raw.source, 100) || 'mobile-runtime';
  const message = scrubDiagnosticText(raw.message, 1_000) || 'Erreur mobile sans message';
  const suppliedFingerprint = scrubDiagnosticText(raw.fingerprint, 80).replace(/[^a-zA-Z0-9._-]/g, '');
  const occurredAt = typeof raw.occurredAt === 'string' && Number.isFinite(Date.parse(raw.occurredAt))
    ? new Date(raw.occurredAt)
    : now;

  return {
    reportId: scrubDiagnosticText(raw.reportId, 80).replace(/[^a-zA-Z0-9._-]/g, '') || `report-${now.getTime()}`,
    fingerprint: suppliedFingerprint || fallbackFingerprint(source, message),
    severity: diagnosticSeverity(raw.severity),
    source,
    message,
    stack: scrubDiagnosticText(raw.stack, 4_000) || null,
    context: diagnosticContext(raw.context),
    appVersion: scrubDiagnosticText(raw.appVersion, 30) || 'unknown',
    platform: scrubDiagnosticText(raw.platform, 60) || 'react-native',
    occurredAt: occurredAt.toISOString(),
  };
}
