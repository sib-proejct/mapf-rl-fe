import React, { useState } from "react";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { NormalizedProblem } from "../../contracts/adapters/problem.ts";
import { AlertOctagon, RefreshCw, Copy, Check, Info } from "lucide-react";
import { copyToClipboard } from "../../utils/ids/ids.ts";

export const LoadingSkeleton: React.FC = () => {
  const { t } = useAppConfig();
  return (
    <div
      aria-busy="true"
      aria-label="Loading Operations Snapshot"
      className="apple-card p-8 flex flex-col items-center justify-center min-h-[400px] text-center gap-4"
    >
      <div className="w-12 h-12 rounded-full border-3 border-apple-blue border-t-transparent animate-spin" />
      <div>
        <h3 className="text-base font-semibold text-apple-text-primary">
          {t("stateLoadingTitle")}
        </h3>
        <p className="text-xs text-apple-text-secondary mt-1">
          {t("stateLoadingDesc")}
        </p>
      </div>
    </div>
  );
};

export const EmptyStateView: React.FC = () => {
  const { t } = useAppConfig();
  return (
    <div
      role="region"
      aria-label="No data available"
      className="apple-card p-8 flex flex-col items-center justify-center min-h-[360px] text-center gap-3"
    >
      <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-apple-text-tertiary">
        <Info className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-apple-text-primary">
          {t("stateEmptyTitle")}
        </h3>
        <p className="text-xs text-apple-text-secondary mt-1 max-w-sm">
          {t("stateEmptyDesc")}
        </p>
      </div>
    </div>
  );
};

interface ErrorStateViewProps {
  problem: NormalizedProblem;
  onRetry: () => void;
}

export const ErrorStateView: React.FC<ErrorStateViewProps> = ({
  problem,
  onRetry,
}) => {
  const { t } = useAppConfig();
  const [copiedTrace, setCopiedTrace] = useState<boolean>(false);

  const handleCopyTrace = async () => {
    if (problem.traceId) {
      await copyToClipboard(problem.traceId);
      setCopiedTrace(true);
      setTimeout(() => setCopiedTrace(false), 2000);
    }
  };

  return (
    <div
      role="alert"
      className="apple-card border-rose-500/30 p-6 sm:p-8 flex flex-col items-center justify-center min-h-[400px] text-center gap-4 bg-rose-500/5 dark:bg-rose-500/10"
    >
      <div className="w-14 h-14 rounded-2xl bg-rose-500/15 flex items-center justify-center text-rose-600 dark:text-rose-400">
        <AlertOctagon className="w-7 h-7" />
      </div>

      <div className="max-w-md">
        <div className="inline-block px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 mb-2">
          HTTP {problem.status} • {problem.code}
        </div>
        <h3 className="text-base font-bold text-apple-text-primary">
          {problem.title || t("stateErrorTitle")}
        </h3>
        {problem.detail && (
          <p className="text-xs text-apple-text-secondary mt-1.5 leading-relaxed">
            {problem.detail}
          </p>
        )}
      </div>

      {/* Diagnostics / Correlation */}
      <div className="w-full max-w-md bg-black/5 dark:bg-white/5 rounded-xl p-3 text-left font-mono text-[11px] space-y-1.5 border border-apple-border">
        {problem.traceId && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-apple-text-tertiary">Trace ID:</span>
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-apple-text-primary truncate">
                {problem.traceId}
              </span>
              <button
                onClick={handleCopyTrace}
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors text-apple-text-secondary"
                title="Copy Trace ID"
              >
                {copiedTrace ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        )}

        {problem.requestId && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-apple-text-tertiary">Request ID:</span>
            <span className="text-apple-text-primary truncate">
              {problem.requestId}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-apple-text-tertiary">Category:</span>
          <span className="text-apple-text-primary font-semibold uppercase">
            {problem.category}
          </span>
        </div>
      </div>

      {problem.retryable && (
        <button
          onClick={onRetry}
          className="mt-2 px-4 py-2 rounded-full bg-apple-blue hover:bg-apple-blue-hover text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t("stateErrorRetry")}</span>
        </button>
      )}
    </div>
  );
};
