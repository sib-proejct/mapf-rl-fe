import React, { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { defaultApiClient, ProblemError } from "../../services/api/client.ts";
import type {
  CreateRobotRequest,
  ProvisioningOutcome,
  RetryRobotRequest,
} from "../../contracts/provisioning.generated.ts";
import { adaptProvisioningOutcome } from "../../contracts/adapters/provisioning.ts";

const storageKey = "mapf_pending_robot_creation";
interface PendingCreation {
  command: CreateRobotRequest;
  outcome?: ProvisioningOutcome;
  retry?: RetryRobotRequest;
}
function recoverPending(): PendingCreation | null {
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) return null;
    const value = JSON.parse(stored) as PendingCreation;
    if (
      value.command?.contractVersion !== "1.0.0" ||
      typeof value.command.requestId !== "string" ||
      !value.command.map ||
      !value.command.start
    )
      return null;
    if (value.outcome) value.outcome = adaptProvisioningOutcome(value.outcome);
    return value;
  } catch {
    return null;
  }
}
function persist(value: PendingCreation | null) {
  try {
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
    else sessionStorage.removeItem(storageKey);
  } catch {
    /* The in-memory request still supports safe retries. */
  }
}

export const RobotCreateForm: React.FC = () => {
  const {
    snapshot,
    useFixture,
    selectedNode,
    setSelectedRobotId,
    refreshSnapshot,
  } = useOperations();
  const { t } = useAppConfig();
  const [pending, setPending] = useState<PendingCreation | null>(
    recoverPending,
  );
  const [open, setOpen] = useState(() => !!recoverPending());
  const [available, setAvailable] = useState(false);
  const [column, setColumn] = useState("");
  const [row, setRow] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [pollError, setPollError] = useState(false);
  const submitting = useRef(false);
  const readyHandled = useRef<string | null>(null);
  const map = snapshot?.map;
  const state = pending?.outcome?.state;
  const waiting = state === "PENDING" || state === "STARTING";
  const frozen = !!pending;
  const valid =
    !!map &&
    column !== "" &&
    row !== "" &&
    Number.isInteger(Number(column)) &&
    Number.isInteger(Number(row)) &&
    Number(column) >= 0 &&
    Number(row) >= 0 &&
    Number(column) < map.widthCells &&
    Number(row) < map.heightCells &&
    map.cells[Number(row) * map.widthCells + Number(column)] === 0;

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

  useEffect(() => {
    if (open && !frozen && selectedNode?.isTraversable) {
      setColumn(String(selectedNode.column));
      setRow(String(selectedNode.row));
    }
  }, [open, frozen, selectedNode]);

  useEffect(() => {
    if (!pending?.outcome || !waiting || useFixture) return;
    const controller = new AbortController();
    const robotId = pending.outcome.robotId;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const outcome = await defaultApiClient.robotProvisioning(robotId, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setPollError(false);
        setPending((previous) => {
          if (!previous || previous.outcome?.robotId !== robotId)
            return previous;
          const value = { ...previous, outcome };
          persist(value);
          return value;
        });
      } catch {
        if (!controller.signal.aborted) setPollError(true);
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 1000);
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [pending?.outcome?.robotId, waiting, useFixture]);

  useEffect(() => {
    if (
      state !== "READY" ||
      !pending?.outcome ||
      readyHandled.current === pending.outcome.robotId
    )
      return;
    const robotId = pending.outcome.robotId;
    readyHandled.current = robotId;
    void refreshSnapshot().then(() => setSelectedRobotId(robotId));
  }, [state, pending?.outcome?.robotId, refreshSnapshot, setSelectedRobotId]);

  async function submit() {
    if (submitting.current || (!pending && !valid) || !map) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    setUncertain(false);
    let value: PendingCreation = pending ?? {
      command: {
        contractVersion: "1.0.0",
        requestId: crypto.randomUUID(),
        map: {
          mapId: map.mapId,
          revision: map.revision,
          contentDigestSha256: map.contentDigestSha256,
        },
        start: { column: Number(column), row: Number(row) },
      },
    };
    if (value.outcome?.state === "FAILED" && !value.retry)
      value = {
        ...value,
        retry: { contractVersion: "1.0.0", requestId: crypto.randomUUID() },
      };
    setPending(value);
    persist(value);
    try {
      const outcome =
        value.retry && value.outcome
          ? await defaultApiClient.retryRobotProvisioning(
              value.outcome.robotId,
              value.retry,
            )
          : await defaultApiClient.createRobot(value.command);
      const next = { command: value.command, outcome };
      persist(next);
      setPending(next);
    } catch (err) {
      const unknownOutcome =
        !(err instanceof ProblemError) || err.problem.status >= 500;
      setUncertain(unknownOutcome);
      setError(err instanceof Error ? err.message : String(err));
      if (!unknownOutcome && !value.outcome) {
        setPending(null);
        persist(null);
      }
      if (!unknownOutcome && value.outcome) {
        const next = { command: value.command, outcome: value.outcome };
        setPending(next);
        persist(next);
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (useFixture) return null;
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
              disabled={
                busy ||
                waiting ||
                (!!pending && state !== "READY" && state !== "FAILED")
              }
              onClick={() => {
                setOpen(false);
                setPending(null);
                persist(null);
                setError(null);
                setUncertain(false);
              }}
              className="p-1 disabled:opacity-30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p>{t("robotAddSelect")}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <label>
                {t("robotAddColumn")}
                <input
                  aria-label={t("robotAddColumn")}
                  type="number"
                  min="0"
                  step="1"
                  max={map ? map.widthCells - 1 : undefined}
                  value={pending ? pending.command.start.column : column}
                  disabled={frozen || busy}
                  onChange={(event) => setColumn(event.target.value)}
                  className="block w-full mt-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                />
              </label>
              <label>
                {t("robotAddRow")}
                <input
                  aria-label={t("robotAddRow")}
                  type="number"
                  min="0"
                  step="1"
                  max={map ? map.heightCells - 1 : undefined}
                  value={pending ? pending.command.start.row : row}
                  disabled={frozen || busy}
                  onChange={(event) => setRow(event.target.value)}
                  className="block w-full mt-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                />
              </label>
            </div>
            {!pending && !valid && (
              <p className="mt-2">{t("robotAddInvalid")}</p>
            )}
            {state !== "READY" && !waiting && (
              <button
                type="submit"
                disabled={busy || !available || (!pending && !valid)}
                className="mt-2 rounded-xl px-3 py-2 bg-[#0071E3] text-white disabled:opacity-40"
              >
                {pending ? t("robotAddRetry") : t("robotAddSubmit")}
              </button>
            )}
          </form>
          <div role="status" aria-live="polite">
            {pending?.outcome && (
              <p className="font-mono break-all">
                {pending.outcome.robotId} · {state}
              </p>
            )}
            {waiting && <p>{t("robotAddPending")}</p>}
            {state === "READY" && <p>{t("robotAddReady")}</p>}
            {state === "FAILED" && (
              <p>
                {t("robotAddFailed")} {pending?.outcome?.failureCode}
              </p>
            )}
            {(uncertain || (pending && !pending.outcome && !busy)) && (
              <p>{t("robotAddUncertain")}</p>
            )}
            {pollError && <p>{t("robotAddPollError")}</p>}
          </div>
          {error && (
            <p
              role="alert"
              className="text-red-600 dark:text-red-400 break-words"
            >
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
};
