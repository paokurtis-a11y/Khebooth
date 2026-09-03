import type { DiagnosticSeverity } from '@khe/contracts';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import type { StationExperienceApi } from '../api/station-api';
import { APP_VERSION } from '../legal/legal-and-info';
import type { LocalStore } from '../offline/local-store';
import { createMobileDiagnosticReport, formatDiagnosticArguments } from './diagnostic-sanitizer';
import { MobileDiagnosticReporter } from './mobile-diagnostic-reporter';

type GlobalErrorUtils = {
  getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

export function useMobileDiagnostics(api: StationExperienceApi, store: LocalStore, stationToken: string | null) {
  const reporter = useMemo(() => new MobileDiagnosticReporter(api, store), [api, store]);
  const tokenRef = useRef(stationToken);
  tokenRef.current = stationToken;

  const reportError = useCallback(async (
    source: string,
    error: unknown,
    context?: Record<string, unknown>,
    severity: DiagnosticSeverity = 'ERROR',
  ): Promise<void> => {
    const token = tokenRef.current;
    if (!token) return;
    try {
      const report = createMobileDiagnosticReport({
        source,
        error,
        context,
        severity,
        appVersion: APP_VERSION,
        platform: `${Platform.OS}-${String(Platform.Version)}`,
      });
      await reporter.capture(token, report);
    } catch {
      // Le diagnostic ne doit jamais faire planter ni ralentir la station.
    }
  }, [reporter]);

  useEffect(() => {
    if (!stationToken) return;
    void reporter.flush(stationToken).catch(() => undefined);
    const timer = setInterval(() => {
      if (tokenRef.current) void reporter.flush(tokenRef.current).catch(() => undefined);
    }, 30_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && tokenRef.current) void reporter.flush(tokenRef.current).catch(() => undefined);
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [reporter, stationToken]);

  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...values: unknown[]) => {
      originalConsoleError(...values);
      void reportError('console.error', new Error(formatDiagnosticArguments(values)), undefined, 'ERROR');
    };

    const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
    const previousHandler = errorUtils?.getGlobalHandler?.();
    if (errorUtils?.setGlobalHandler) {
      errorUtils.setGlobalHandler((error, isFatal) => {
        let delegated = false;
        const delegate = () => {
          if (delegated) return;
          delegated = true;
          previousHandler?.(error, isFatal);
        };
        const fallback = setTimeout(delegate, 750);
        void reportError('react-native.global', error, { fatal: Boolean(isFatal) }, isFatal ? 'FATAL' : 'ERROR')
          .finally(() => { clearTimeout(fallback); delegate(); });
      });
    }

    return () => {
      console.error = originalConsoleError;
      if (previousHandler && errorUtils?.setGlobalHandler) errorUtils.setGlobalHandler(previousHandler);
    };
  }, [reportError]);

  return { reportError };
}
