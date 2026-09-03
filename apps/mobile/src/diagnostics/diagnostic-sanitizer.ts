import type { DiagnosticSeverity, StationDiagnosticReportContract } from '@khe/contracts';

const SECRET_ASSIGNMENT = /\b(password|passwd|pwd|token|secret|api[-_]?key|authorization|cookie|session)\b["']?\s*[:=]\s*["']?([^\s,;"'}]+)/gi;
const BEARER_TOKEN = /\bBearer\s+[-A-Za-z0-9._~+/=]*/gi;
const JWT_TOKEN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]{10,})?\b/g;
const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SENSITIVE_QUERY = /([?&](?:token|secret|key|password|signature|authorization)=)[^&#\s]+/gi;
const SENSITIVE_CONTEXT_KEY = /^(?:password|passwd|pwd|token|secret|api[-_]?key|authorization|cookie|session)$/i;

export function scrubMobileDiagnosticText(value: unknown, maxLength: number): string {
  const source = typeof value === 'string' ? value : String(value ?? '');
  return source
    .replace(BEARER_TOKEN, 'Bearer [REDACTED]')
    .replace(JWT_TOKEN, '[JWT REDACTED]')
    .replace(SECRET_ASSIGNMENT, (_match, key: string) => `${key}=[REDACTED]`)
    .replace(SENSITIVE_QUERY, '$1[REDACTED]')
    .replace(EMAIL_ADDRESS, '[EMAIL REDACTED]')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function safeStringify(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ''}`;
  if (typeof value === 'string') return value;
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, nested) => {
      if (nested instanceof Error) return { name: nested.name, message: nested.message, stack: nested.stack };
      if (typeof nested === 'bigint') return nested.toString();
      if (nested && typeof nested === 'object') {
        if (seen.has(nested)) return '[Circular]';
        seen.add(nested);
      }
      return nested;
    });
  } catch {
    return String(value ?? '');
  }
}

export function formatDiagnosticArguments(values: unknown[]): string {
  return scrubMobileDiagnosticText(values.map(safeStringify).join(' '), 1_000);
}

function normalizeContext(context: Record<string, unknown> | undefined): Record<string, string | number | boolean | null> {
  if (!context) return {};
  return Object.fromEntries(Object.entries(context).slice(0, 24).map(([rawKey, rawValue]) => {
    const key = scrubMobileDiagnosticText(rawKey, 50) || 'context';
    if (SENSITIVE_CONTEXT_KEY.test(key)) return [key, '[REDACTED]'];
    if (rawValue === null || typeof rawValue === 'boolean') return [key, rawValue];
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) return [key, rawValue];
    return [key, scrubMobileDiagnosticText(safeStringify(rawValue), 300)];
  }));
}

export function diagnosticFingerprint(source: string, message: string): string {
  let hash = 2166136261;
  for (const character of `${source}|${message}`.toLowerCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `mobile-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

interface DiagnosticInput {
  source: string;
  error: unknown;
  context?: Record<string, unknown>;
  severity?: DiagnosticSeverity;
  appVersion: string;
  platform: string;
  now?: Date;
  random?: () => number;
}

export function createMobileDiagnosticReport(input: DiagnosticInput): StationDiagnosticReportContract {
  const now = input.now ?? new Date();
  const source = scrubMobileDiagnosticText(input.source, 100) || 'mobile-runtime';
  const rawMessage = input.error instanceof Error ? input.error.message : safeStringify(input.error);
  const message = scrubMobileDiagnosticText(rawMessage, 1_000) || 'Erreur mobile sans message';
  const rawStack = input.error instanceof Error ? input.error.stack : '';
  const stack = scrubMobileDiagnosticText(rawStack, 4_000) || null;
  const random = input.random ?? Math.random;
  return {
    reportId: `mobile-${now.getTime().toString(36)}-${Math.floor(random() * 0x1000000).toString(36).padStart(5, '0')}`,
    fingerprint: diagnosticFingerprint(source, message),
    severity: input.severity ?? 'ERROR',
    source,
    message,
    stack,
    context: normalizeContext(input.context),
    appVersion: scrubMobileDiagnosticText(input.appVersion, 30) || 'unknown',
    platform: scrubMobileDiagnosticText(input.platform, 60) || 'react-native',
    occurredAt: now.toISOString(),
  };
}
