import React, { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { defaultApiClient } from "../../services/api/client.ts";
import type {
  CreateRobotRequest,
  ProvisioningOutcome,
} from "../../contracts/provisioning.generated.ts";
import {
  decodePendingCreation,
  submitRobotBatch,
  waiting,
  retryable,
  type PendingCreation,
} from "../../domain/robot/creation.ts";
import {
  generateRobotPlacement,
  placementCandidates,
} from "../../domain/robot/placement.ts";

const storageKey = "mapf_pending_robot_creation";
function recoverPending(): PendingCreation[] | null {
  try {
    return decodePendingCreation(sessionStorage.getItem(storageKey));
  } catch {
    return null;
  }
}
function persist(value: PendingCreation[] | null) {
  try {
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
    else sessionStorage.removeItem(storageKey);
  } catch {
    /* In-memory requests retain their idempotency keys. */
  }
}
export const RobotCreateForm: React.FC = () => {
  const {
    snapshot,
    useFixture,
    topology,
    setSelectedRobotId,
    refreshSnapshot,
    robotPlacementNodeIds: ids,
    setRobotPlacementNodeIds: setIds,
    setRobotPlacementActive,
    robotPlacementClick,
    dismissNodeConfirmation,
  } = useOperations();
  const { t, language } = useAppConfig();
  const ko = language === "ko";
  const [pending, setPending] = useState(recoverPending);
  const pendingRef = useRef(pending);
  const [open, setOpen] = useState(!!pending);
  const [available, setAvailable] = useState(false);
  const [mode, setMode] = useState("manual");
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState(false);
  const submitting = useRef(false);
  const handled = useRef(new Set<string>());
  const map = snapshot?.map;
  const mapKey = map
    ? `${map.mapId}:${map.revision}:${map.contentDigestSha256}`
    : "";
  const candidates =
    map && topology
      ? placementCandidates(map, topology.nodes, snapshot?.robots ?? [])
      : [];
  const save = (value: PendingCreation[] | null) => {
    pendingRef.current = value;
    persist(value);
    setPending(value);
  };
  useEffect(() => {
    if (!pendingRef.current) {
      setIds([]);
      setError(null);
    }
  }, [mapKey, setIds]);
  useEffect(() => {
    setRobotPlacementActive(open && !useFixture);
    return () => {
      setRobotPlacementActive(false);
      setIds([]);
    };
  }, [open, useFixture, setRobotPlacementActive, setIds]);
  useEffect(() => {
    if (!open || useFixture) return;
    robotPlacementClick.current = (id) => {
      if (pending || busy || mode !== "manual") return;
      if (ids.includes(id)) {
        setIds(ids.filter((value) => value !== id));
        return;
      }
      if (!candidates.some((node) => node.id === id)) {
        setError(
          ko
            ? "비어 있는 이동 가능 노드를 선택하세요."
            : "Choose an unoccupied traversable node.",
        );
        return;
      }
      if (ids.length >= 100) {
        setError(
          ko ? "최대 100대까지 추가할 수 있습니다." : "Add up to 100 robots.",
        );
        return;
      }
      setError(null);
      setIds([...ids, id]);
    };
    return () => {
      robotPlacementClick.current = null;
    };
  }, [
    open,
    useFixture,
    pending,
    busy,
    mode,
    ids,
    candidates,
    ko,
    robotPlacementClick,
    setIds,
  ]);
  useEffect(() => {
    if (
      pending &&
      topology &&
      map &&
      pending[0].command.map.mapId === map.mapId &&
      pending[0].command.map.revision === map.revision &&
      pending[0].command.map.contentDigestSha256 === map.contentDigestSha256
    ) {
      setIds(
        pending.flatMap((entry) =>
          topology.nodes
            .filter(
              (node) =>
                node.column === entry.command.start.column &&
                node.row === entry.command.start.row,
            )
            .map((node) => node.id),
        ),
      );
    } else if (pending) setIds([]);
  }, [pending, topology, mapKey, setIds]);
  useEffect(() => {
    if (useFixture) {
      setAvailable(false);
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      try {
        const capability = await defaultApiClient.robotProvisioningCapabilities(
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) setAvailable(capability.available);
      } catch {
        if (!controller.signal.aborted) setAvailable(false);
      }
      if (!controller.signal.aborted) timer = setTimeout(check, 5000);
    }
    void check();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [useFixture]);
  const hasWaiting = !!pending?.some(waiting);
  useEffect(() => {
    if (!hasWaiting || useFixture) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let failed = false;
      const outcomes = new Map<string, ProvisioningOutcome>();
      for (const entry of pendingRef.current ?? []) {
        if (!waiting(entry) || !entry.outcome) continue;
        try {
          const outcome = await defaultApiClient.robotProvisioning(
            entry.outcome.robotId,
            { signal: controller.signal },
          );
          if (controller.signal.aborted) return;
          outcomes.set(entry.command.requestId, outcome);
        } catch {
          if (controller.signal.aborted) return;
          failed = true;
        }
      }
      if (outcomes.size)
        save(
          (pendingRef.current ?? []).map((value) =>
            outcomes.has(value.command.requestId)
              ? { ...value, outcome: outcomes.get(value.command.requestId)! }
              : value,
          ),
        );
      setPollError(failed);
      if (!controller.signal.aborted) timer = setTimeout(poll, 1000);
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [hasWaiting, useFixture]);
  useEffect(() => {
    const ready =
      pending?.filter(
        (entry) =>
          entry.outcome?.state === "READY" &&
          !handled.current.has(entry.outcome.robotId),
      ) ?? [];
    if (!ready.length) return;
    ready.forEach((entry) => handled.current.add(entry.outcome!.robotId));
    void refreshSnapshot()
      .then(() => {
        if (pendingRef.current?.length === 1)
          setSelectedRobotId(ready[0].outcome!.robotId);
      })
      .catch(() =>
        setError(
          ko
            ? "로봇은 생성되었지만 목록 갱신에 실패했습니다."
            : "Robots are ready, but refreshing the fleet failed.",
        ),
      );
  }, [pending, refreshSnapshot, setSelectedRobotId, ko]);

  async function submit() {
    if (submitting.current || !available || useFixture) return;
    let entries = pendingRef.current;
    if (!entries) {
      if (
        !map ||
        !ids.length ||
        ids.some((id) => !candidates.some((node) => node.id === id))
      ) {
        setError(
          ko
            ? "비어 있는 시작 노드를 선택하세요."
            : "Select unoccupied start nodes.",
        );
        return;
      }
      entries = ids.map((id) => {
        const node = topology!.nodeMap.get(id)!;
        return {
          command: {
            contractVersion: "1.0.0",
            requestId: crypto.randomUUID(),
            map: {
              mapId: map.mapId,
              revision: map.revision,
              contentDigestSha256: map.contentDigestSha256,
            },
            start: { column: node.column, row: node.row },
          } satisfies CreateRobotRequest,
        };
      });
      save(entries);
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await submitRobotBatch(entries, defaultApiClient, (value) =>
        save(
          (pendingRef.current ?? []).map((previous) =>
            previous.command.requestId === value.command.requestId
              ? value
              : previous,
          ),
        ),
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  if (useFixture) return null;
  const unresolved = pending?.some(
    (entry) => (!entry.outcome && !entry.rejected) || entry.uncertain,
  );
  const displayEntries: {
    command: { requestId?: string; start: { column: number; row: number } };
    outcome?: ProvisioningOutcome;
    rejected?: boolean;
    uncertain?: boolean;
    error?: string;
  }[] =
    pending ??
    ids.flatMap((id) => {
      const node = topology?.nodeMap.get(id);
      return node ? [{ command: { start: node } }] : [];
    });
  const inputClass =
    "rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 disabled:opacity-40";
  return (
    <div className="mb-3 shrink-0 text-xs">
      {!open ? (
        <>
          <button
            type="button"
            disabled={!available || !map}
            onClick={() => {
              setOpen(true);
              setSelectedRobotId(null);
              dismissNodeConfirmation();
            }}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-[#0071E3] text-white disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("robotAdd")}
          </button>
          {!available && (
            <p className="mt-1 text-[#86868B]">{t("robotAddUnavailable")}</p>
          )}
        </>
      ) : (
        <section
          aria-label={t("robotAdd")}
          className="rounded-2xl border border-black/10 dark:border-white/10 p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <strong>{t("robotAdd")}</strong>
            <button
              type="button"
              aria-label={t("robotAddClose")}
              disabled={busy || hasWaiting || unresolved}
              onClick={() => {
                setOpen(false);
                save(null);
                setIds([]);
                setError(null);
                setPollError(false);
              }}
              className="p-1 disabled:opacity-30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="space-y-2"
          >
            <fieldset disabled={!!pending || busy} className="space-y-2">
              <div
                role="group"
                aria-label={ko ? "입력 방식" : "Input mode"}
                className="flex gap-2"
              >
                {[
                  ["manual", ko ? "노드 선택" : "Select nodes"],
                  ["bulk", ko ? "자동 배치" : "Automatic placement"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => {
                      setMode(value);
                      setError(null);
                    }}
                    className={`${inputClass} ${mode === value ? "bg-[#0071E3]/10 text-[#0071E3]" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mode === "manual" ? (
                <p>
                  {ko
                    ? "맵의 노드를 클릭해 추가하세요. 다시 클릭하면 해제됩니다."
                    : "Click map nodes to add them. Click again to deselect."}
                </p>
              ) : (
                <div className="flex gap-2 items-end">
                  <label>
                    {ko ? "추가 대수 (1–100)" : "Robot count (1–100)"}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={count}
                      onChange={(event) => setCount(event.target.value)}
                      className={`block w-24 mt-1 ${inputClass}`}
                    />
                  </label>
                  <button
                    type="button"
                    className={inputClass}
                    onClick={() => {
                      try {
                        setIds(
                          generateRobotPlacement(Number(count), candidates),
                        );
                        setError(null);
                      } catch {
                        setIds([]);
                        setError(
                          ko
                            ? `1–100대 정수를 입력하세요. 현재 배치 가능: ${candidates.length}대.`
                            : `Enter an integer from 1 to 100. Available nodes: ${candidates.length}.`,
                        );
                      }
                    }}
                  >
                    {ko ? "미리 배치" : "Preview"}
                  </button>
                </div>
              )}
              {!!ids.length && (
                <button
                  type="button"
                  onClick={() => setIds([])}
                  className={inputClass}
                >
                  {ko ? "전체 해제" : "Clear all"}
                </button>
              )}
            </fieldset>
            <ul
              className="max-h-64 overflow-auto space-y-2"
              aria-label={ko ? "시작 위치 목록" : "Start positions"}
            >
              {displayEntries.map((entry, index) => {
                const node = topology?.nodes.find(
                  (node) =>
                    node.column === entry.command.start.column &&
                    node.row === entry.command.start.row,
                );
                return (
                  <li
                    key={entry.command.requestId ?? ids[index]}
                    className="rounded-lg bg-black/5 dark:bg-white/5 p-2 break-words"
                  >
                    <div className="flex justify-between gap-2">
                      <span>
                        {index + 1}. {node?.name ?? ""} (
                        {entry.command.start.column}, {entry.command.start.row})
                      </span>
                      {!pending && (
                        <button
                          type="button"
                          aria-label={
                            ko
                              ? `${index + 1}번 위치 삭제`
                              : `Remove position ${index + 1}`
                          }
                          onClick={() =>
                            setIds(ids.filter((id) => id !== ids[index]))
                          }
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {pending && (
                      <>
                        <p>
                          {entry.outcome
                            ? `${entry.outcome.robotId} · ${entry.outcome.state}`
                            : entry.rejected
                              ? ko
                                ? "등록 거절"
                                : "Rejected"
                              : ko
                                ? "응답 확인 필요 / 등록 대기"
                                : "Unconfirmed / queued"}
                        </p>
                        {entry.outcome?.failureCode && (
                          <p>{entry.outcome.failureCode}</p>
                        )}
                        {entry.uncertain && <p>{t("robotAddUncertain")}</p>}
                        {entry.error && (
                          <p
                            role="alert"
                            className="text-red-600 dark:text-red-400"
                          >
                            {entry.error}
                          </p>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            {(!pending || pending.some(retryable)) && (
              <button
                type="submit"
                disabled={
                  busy || !available || (!pending && (!map || !ids.length))
                }
                className="w-full rounded-xl px-3 py-2 bg-[#0071E3] text-white disabled:opacity-40"
              >
                {busy
                  ? ko
                    ? "등록 중…"
                    : "Submitting…"
                  : pending
                    ? ko
                      ? "미완료 항목 재시도"
                      : "Retry unfinished"
                    : ko
                      ? `${ids.length}대 로봇 추가`
                      : `Add ${ids.length} robots`}
              </button>
            )}
          </form>
          <div role="status" aria-live="polite">
            {pending && (
              <p>
                {ko
                  ? `완료 ${pending.filter((entry) => entry.outcome?.state === "READY").length} / ${pending.length}대 · 실패 ${pending.filter((entry) => entry.rejected || entry.outcome?.state === "FAILED").length}대`
                  : `Ready ${pending.filter((entry) => entry.outcome?.state === "READY").length} / ${pending.length} · Failed ${pending.filter((entry) => entry.rejected || entry.outcome?.state === "FAILED").length}`}
              </p>
            )}
            {hasWaiting && <p>{t("robotAddPending")}</p>}
            {pollError && <p>{t("robotAddPollError")}</p>}
          </div>
          {error && (
            <p role="alert" className="text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
};
