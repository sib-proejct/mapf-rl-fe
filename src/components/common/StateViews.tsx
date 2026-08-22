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
      className="bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.06] dark:border-white/[0.08] shadow-sm p-8 sm:p-12 flex flex-col items-center justify-center min-h-[400px] text-center gap-4 transition-colors duration-300"
    >
      <div className="w-10 h-10 rounded-full border-2 border-[#0071E3] dark:border-[#2997FF] border-t-transparent animate-spin" />
      <div>
        <h3 className="text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
          {t("stateLoadingTitle")}
        </h3>
        <p className="text-xs text-[#86868B] mt-1 font-normal">
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
      className="bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.06] dark:border-white/[0.08] shadow-sm p-8 sm:p-12 flex flex-col items-center justify-center min-h-[360px] text-center gap-3.5 transition-colors duration-300"
    >
      <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center text-[#86868B]">
        <Info className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
          {t("stateEmptyTitle")}
        </h3>
        <p className="text-xs text-[#86868B] mt-1 max-w-sm font-normal">
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
      className="bg-white dark:bg-[#1C1C1E] rounded-3xl border border-[#FF3B30]/30 dark:border-[#FF453A]/40 p-6 sm:p-10 flex flex-col items-center justify-center min-h-[400px] text-center gap-4 bg-gradient-to-b from-[#FF3B30]/5 to-transparent transition-colors duration-300"
    >
      <div className="w-14 h-14 rounded-2xl bg-[#FF3B30]/15 text-[#FF3B30] dark:text-[#FF453A] flex items-center justify-center">
        <AlertOctagon className="w-7 h-7" />
      </div>

      <div className="max-w-md">
        <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FF3B30]/15 text-[#D70015] dark:text-[#FF453A] mb-2">
          HTTP {problem.status} • {problem.code}
        </div>
        <h3 className="text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
          {problem.title || t("stateErrorTitle")}
        </h3>
        {problem.detail && (
          <p className="text-xs text-[#86868B] mt-1.5 leading-relaxed font-normal">
            {problem.detail}
          </p>
        )}
      </div>

      {/* Diagnostics / Correlation */}
      <div className="w-full max-w-md bg-[#F5F5F7] dark:bg-[#252528] rounded-2xl p-3.5 text-left font-mono text-[11px] space-y-1.5 border border-black/[0.04] dark:border-white/[0.06]">
        {problem.traceId && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#86868B]">Trace ID:</span>
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-[#1D1D1F] dark:text-[#F5F5F7] truncate font-bold">
                {problem.traceId}
              </span>
              <button
                onClick={handleCopyTrace}
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors text-[#86868B] cursor-pointer"
                title="Copy Trace ID"
              >
                {copiedTrace ? (
                  <Check className="w-3 h-3 text-[#34C759]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        )}

        {problem.requestId && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#86868B]">Request ID:</span>
            <span className="text-[#1D1D1F] dark:text-[#F5F5F7] truncate font-bold">
              {problem.requestId}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-[#86868B]">Category:</span>
          <span className="text-[#1D1D1F] dark:text-[#F5F5F7] font-bold uppercase">
            {problem.category}
          </span>
        </div>
      </div>

      {problem.retryable && (
        <button
          onClick={onRetry}
          className="mt-2 px-5 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] dark:hover:bg-[#0071E3] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t("stateErrorRetry")}</span>
        </button>
      )}
    </div>
  );
};
