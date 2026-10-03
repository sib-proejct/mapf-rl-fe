import React, { useState, useRef } from "react";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import type { PendingMutation } from "../../domain/mutation/types.ts";

export const TransportWaveForm: React.FC = () => {
  const { snapshot, transportMode, createOrder, retryMutation } =
    useOperations();
  const { language } = useAppConfig();
  const ko = language === "ko";
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([{ id: 0, pick: "", place: "", robot: "" }]);
  const nextId = useRef(1);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [mutation, setMutation] = useState<PendingMutation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uncertain = mutation?.state === "uncertain";
  const stations = snapshot?.map.stationCatalog ?? [];
  const picks = stations.filter((station) => station.type === "pick");
  const places = stations.filter((station) => station.type === "place");
  const update = (id: number, key: "pick" | "place" | "robot", value: string) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  const cellKey = (station: { column: number; row: number }) =>
    `${station.column},${station.row}`;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      let result: PendingMutation;
      if (uncertain && mutation)
        result = await retryMutation(mutation.requestId);
      else {
        if (!snapshot?.map)
          throw new Error(ko ? "맵이 필요합니다." : "Load a map first.");
        const tasks = rows.map((row) => {
          const pick = picks.find((station) => cellKey(station) === row.pick);
          const place = places.find(
            (station) => cellKey(station) === row.place,
          );
          if (!pick || !place)
            throw new Error(
              ko
                ? "PICK과 PLACE station을 선택하세요."
                : "Choose PICK and PLACE stations.",
            );
          return {
            ...(row.robot ? { robotId: row.robot } : {}),
            steps: [
              {
                goalColumn: pick.column,
                goalRow: pick.row,
                arrivalAction: "PICK" as const,
              },
              {
                goalColumn: place.column,
                goalRow: place.row,
                arrivalAction: "PLACE" as const,
              },
            ],
          };
        });
        const map = {
          mapId: snapshot.map.mapId,
          mapRevision: snapshot.map.revision,
        };
        result = await createOrder(
          rows.length === 1 ? { ...map, task: tasks[0] } : { ...map, tasks },
        );
      }
      setMutation(result);
      if (result.state === "confirmed") {
        setOpen(false);
        setRows([{ id: nextId.current++, pick: "", place: "", robot: "" }]);
        setMutation(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  if (transportMode === "FIXTURE_STREAM") return null;
  const inputClass =
    "w-full rounded-xl p-2 bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 text-xs";
  return (
    <div className="space-y-2 text-xs">
      <button
        type="button"
        disabled={busy || uncertain}
        onClick={() => setOpen(!open)}
        className="rounded-xl px-3 py-2 bg-[#0071E3]/10 text-[#0071E3]"
      >
        {ko ? "운반 작업 / 웨이브" : "Transport / Wave"}
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="space-y-3 rounded-xl border border-black/10 dark:border-white/10 p-3"
        >
          <p>
            {ko
              ? "같은 로봇이 PICK → PLACE를 수행합니다. 여러 행은 한 웨이브로 등록됩니다."
              : "One robot performs PICK → PLACE. Multiple rows form a wave."}
          </p>
          <fieldset disabled={busy || uncertain} className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.id} className="space-y-2">
                <div className="flex justify-between">
                  <span>#{index + 1}</span>
                  <button
                    type="button"
                    disabled={rows.length === 1}
                    onClick={() =>
                      setRows((current) =>
                        current.filter((item) => item.id !== row.id),
                      )
                    }
                  >
                    {ko ? "행 삭제" : "Remove row"}
                  </button>
                </div>
                <label className="block">
                  PICK
                  <select
                    required
                    value={row.pick}
                    onChange={(e) => update(row.id, "pick", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">
                      {ko ? "적재 station 선택" : "Select pickup"}
                    </option>
                    {picks.map((station) => (
                      <option key={cellKey(station)} value={cellKey(station)}>
                        {station.name} ({cellKey(station)})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  PLACE
                  <select
                    required
                    value={row.place}
                    onChange={(e) => update(row.id, "place", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">
                      {ko ? "하역 station 선택" : "Select dropoff"}
                    </option>
                    {places.map((station) => (
                      <option key={cellKey(station)} value={cellKey(station)}>
                        {station.name} ({cellKey(station)})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  {ko ? "로봇" : "Robot"}
                  <select
                    value={row.robot}
                    onChange={(e) => update(row.id, "robot", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">
                      {ko ? "가용 시 자동 할당" : "Assign when available"}
                    </option>
                    {snapshot?.robots.map((robot) => (
                      <option key={robot.id} value={robot.id}>
                        {robot.id} · {robot.operationalState}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
            <button
              type="button"
              disabled={rows.length >= 100}
              onClick={() =>
                setRows((current) => [
                  ...current,
                  { id: nextId.current++, pick: "", place: "", robot: "" },
                ])
              }
            >
              {ko ? "+ 작업 추가 (최대 100개)" : "+ Add task (up to 100)"}
            </button>
          </fieldset>
          {(error || mutation?.error || uncertain) && (
            <p role="alert" className="text-[#C93400]">
              {error ||
                mutation?.error?.detail ||
                (ko
                  ? "응답 확인 필요: 같은 ID로 재시도하세요."
                  : "Outcome uncertain: retry with the same ID.")}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !snapshot?.map}
            className="rounded-xl px-3 py-2 bg-[#0071E3] text-white disabled:opacity-50"
          >
            {busy
              ? ko
                ? "등록 중…"
                : "Submitting…"
              : uncertain
                ? ko
                  ? "같은 ID로 재시도"
                  : "Retry same ID"
                : rows.length === 1
                  ? ko
                    ? "운반 작업 등록"
                    : "Queue transport"
                  : ko
                    ? `${rows.length}개 웨이브 등록`
                    : `Queue wave (${rows.length})`}
          </button>
        </form>
      )}
    </div>
  );
};
