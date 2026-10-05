import React, { useEffect, useRef, useState } from "react";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { defaultApiClient, ProblemError } from "../../services/api/client.ts";

export const RobotRemoveButton: React.FC<{ robotId: string }> = ({
  robotId,
}) => {
  const { useFixture, refreshSnapshot, setSelectedRobotId } = useOperations();
  const { language } = useAppConfig();
  const ko = language === "ko";
  const [supported, setSupported] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    setSupported(false);
    setConfirming(false);
    setPending(false);
    setError(null);
    requestId.current = null;
    if (useFixture) return;
    const controller = new AbortController();
    void Promise.all([
      defaultApiClient.robotProvisioning(robotId, {
        signal: controller.signal,
      }),
      defaultApiClient.robotRemovalCapabilities({ signal: controller.signal }),
    ])
      .then(([, capability]) => {
        if (!controller.signal.aborted) setSupported(capability.available);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [robotId, useFixture]);

  useEffect(() => {
    if (!supported) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const outcome = await defaultApiClient.robotRemoval(robotId, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (outcome.state === "REMOVED") {
          await refreshSnapshot();
          if (!controller.signal.aborted) setSelectedRobotId(null);
          return;
        }
        setPending(true);
        setError(null);
      } catch (err) {
        if (
          !controller.signal.aborted &&
          pending &&
          !(err instanceof ProblemError && err.problem.status === 404)
        )
          setError(
            ko
              ? "제거 상태를 확인하지 못했습니다. 다시 확인 중입니다."
              : "Unable to check removal status. Retrying.",
          );
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 1000);
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [supported, robotId, pending, ko, refreshSnapshot, setSelectedRobotId]);

  async function remove() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    try {
      await defaultApiClient.removeRobot(robotId, {
        contractVersion: "1.0.0",
        requestId: requestId.current,
      });
      setPending(true);
      setConfirming(false);
    } catch (err) {
      if (err instanceof ProblemError && err.problem.status < 500)
        requestId.current = null;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (!supported || useFixture) return null;
  return (
    <div className="space-y-2 text-xs">
      {pending ? (
        <p role="status">
          {ko
            ? "로봇 정지 및 제거 확인 중…"
            : "Stopping robot and confirming removal…"}
        </p>
      ) : confirming ? (
        <div
          role="alertdialog"
          aria-label={ko ? "로봇 제거 확인" : "Confirm robot removal"}
          className="rounded-xl border border-red-300 p-3 space-y-2"
        >
          <p>
            {ko
              ? `${robotId} 로봇을 제거하시겠습니까? 작업 이력은 보존됩니다. 진행 중인 작업이 있으면 제거할 수 없습니다.`
              : `Remove ${robotId}? History is retained. Finish or cancel active Orders first.`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="rounded-lg bg-red-600 text-white px-3 py-2 disabled:opacity-40"
            >
              {ko ? "제거" : "Remove"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="rounded-lg border px-3 py-2"
            >
              {ko ? "취소" : "Cancel"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-red-300 text-red-600 dark:text-red-400 px-3 py-2"
        >
          {ko ? "로봇 제거" : "Remove robot"}
        </button>
      )}
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400 break-words">
          {error}
        </p>
      )}
    </div>
  );
};
