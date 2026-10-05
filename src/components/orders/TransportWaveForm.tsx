import React, { useState, useRef } from "react";
import { X, Layers } from "lucide-react";
import { useOperations } from "../../app/providers/OperationsContext.tsx";
import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import { generateTransportWave } from "../../domain/order/transportWave.ts";
import type { PendingMutation } from "../../domain/mutation/types.ts";

export interface TransportWaveFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export const TransportWaveForm: React.FC<TransportWaveFormProps> = ({
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}) => {
  const { snapshot, transportMode, createOrder, retryMutation } =
    useOperations();
  const { language } = useAppConfig();
  const ko = language === "ko";
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (val: boolean) => {
    if (isControlled) {
      onOpenChange?.(val);
    } else {
      setUncontrolledOpen(val);
    }
  };
  const [rows, setRows] = useState([{ id: 0, pick: "", place: "", robot: "" }]);
  const [mode, setMode] = useState("manual");
  const [count, setCount] = useState("100");
  // Null means all current stations, including catalogs loaded after opening.
  const [selectedPicks, setSelectedPicks] = useState<string[] | null>(null);
  const [selectedPlaces, setSelectedPlaces] = useState<string[] | null>(null);
  const [page, setPage] = useState(0);
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
        if (!rows.length || rows.length > 100)
          throw new Error(
            ko ? "작업은 1–100개여야 합니다." : "Provide 1–100 tasks.",
          );
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
        setPage(0);
        setMode("manual");
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
      {!hideTrigger && (
        <button
          type="button"
          disabled={busy || uncertain}
          onClick={() => setOpen(!open)}
          className="rounded-xl px-3 py-2 bg-[#0071E3]/10 text-[#0071E3]"
        >
          {ko ? "운반 작업 / 웨이브" : "Transport / Wave"}
        </button>
      )}
      {open && (
        <form
          onSubmit={submit}
          className="p-3 rounded-2xl border border-[#0071E3]/20 bg-[#0071E3]/[0.04] dark:bg-[#2997FF]/10 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF]" />
              <h4 className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {ko ? "운반 작업 / 웨이브" : "Transport / Wave"}
              </h4>
            </div>
            <button
              type="button"
              aria-label={ko ? "입력 닫기" : "Close form"}
              disabled={busy || uncertain}
              onClick={() => {
                setOpen(false);
                setError(null);
                setMutation(null);
              }}
              className="p-1 rounded-full text-[#86868B] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[#86868B] text-[11px] leading-relaxed">
            {ko
              ? "같은 로봇이 PICK → PLACE를 수행합니다. 여러 행은 한 웨이브로 등록됩니다."
              : "One robot performs PICK → PLACE. Multiple rows form a wave."}
          </p>
          <fieldset disabled={busy || uncertain} className="space-y-3">
            <div
              className="inline-flex p-1 bg-black/5 dark:bg-white/5 rounded-xl gap-1"
              role="group"
              aria-label={ko ? "입력 방식" : "Input mode"}
            >
              {[
                ["manual", ko ? "직접 입력" : "Manual"],
                ["bulk", ko ? "일괄 생성" : "Bulk generation"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => {
                    setMode(value);
                    setPage(0);
                  }}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
                    mode === value
                      ? "bg-white dark:bg-[#2C2C2E] shadow-sm text-black dark:text-white"
                      : "text-gray-500 hover:text-black dark:hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "bulk" && (
              <div className="space-y-3">
                {[
                  {
                    label: "PICK",
                    stations: picks,
                    selected: selectedPicks,
                    setSelected: setSelectedPicks,
                  },
                  {
                    label: "PLACE",
                    stations: places,
                    selected: selectedPlaces,
                    setSelected: setSelectedPlaces,
                  },
                ].map(
                  ({ label, stations: candidates, selected, setSelected }) => (
                    <details
                      key={label}
                      className="rounded-xl border border-black/10 dark:border-white/10 p-2"
                    >
                      <summary className="cursor-pointer font-medium">
                        {label} (
                        {selected === null
                          ? ko
                            ? `전체 ${candidates.length}개`
                            : `All ${candidates.length}`
                          : ko
                            ? `${selected.length}/${candidates.length}개 선택됨`
                            : `${selected.length}/${candidates.length} selected`}
                        )
                      </summary>
                      <fieldset className="space-y-2 pt-2">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setSelected(null)}
                            className="text-xs text-[#0071E3] hover:underline"
                          >
                            {ko ? "전체 선택" : "Select all"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelected([])}
                            className="text-xs text-[#0071E3] hover:underline"
                          >
                            {ko ? "선택 해제" : "Clear selection"}
                          </button>
                        </div>
                        <div className="max-h-32 overflow-auto space-y-1">
                          {candidates.map((station) => {
                            const key = cellKey(station);
                            return (
                              <label key={key} className="flex gap-2">
                                <input
                                  type="checkbox"
                                  checked={
                                    selected === null || selected.includes(key)
                                  }
                                  onChange={(event) =>
                                    setSelected((current) => {
                                      const keys =
                                        current ?? candidates.map(cellKey);
                                      return event.target.checked
                                        ? [...keys, key]
                                        : keys.filter((value) => value !== key);
                                    })
                                  }
                                />
                                {station.name} ({key})
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    </details>
                  ),
                )}
                <label className="block">
                  {ko ? "작업 수 (1–100)" : "Task count (1–100)"}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={count}
                    onChange={(event) => setCount(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <p>
                  {ko
                    ? "각 작업의 PICK·PLACE를 무작위 선택합니다. 같은 조합이 반복될 수 있습니다. 로봇은 자동 배정됩니다."
                    : "Random PICK and PLACE per task; combinations may repeat. Robots are assigned automatically."}
                </p>
                <button
                  type="button"
                  className="w-full rounded-xl py-2 px-3 bg-[#0071E3]/10 hover:bg-[#0071E3]/20 text-[#0071E3] font-medium transition-colors"
                  onClick={() => {
                    setError(null);
                    const pickKeys = picks
                      .map(cellKey)
                      .filter(
                        (key) =>
                          selectedPicks === null || selectedPicks.includes(key),
                      );
                    const placeKeys = places
                      .map(cellKey)
                      .filter(
                        (key) =>
                          selectedPlaces === null ||
                          selectedPlaces.includes(key),
                      );
                    if (
                      !Number.isInteger(Number(count)) ||
                      Number(count) < 1 ||
                      Number(count) > 100
                    ) {
                      setError(
                        ko
                          ? "작업 수는 1–100 사이의 정수여야 합니다."
                          : "Task count must be an integer from 1 to 100.",
                      );
                      return;
                    }
                    if (!pickKeys.length || !placeKeys.length) {
                      setError(
                        ko
                          ? "PICK과 PLACE 후보를 각각 하나 이상 선택하세요."
                          : "Choose at least one PICK and PLACE station.",
                      );
                      return;
                    }
                    setRows(
                      generateTransportWave(
                        Number(count),
                        pickKeys,
                        placeKeys,
                      ).map((row) => ({ ...row, id: nextId.current++ })),
                    );
                    setPage(0);
                  }}
                >
                  {rows.some((row) => row.pick || row.place)
                    ? ko
                      ? "다시 생성 — 현재 목록 대체"
                      : "Regenerate — replace current list"
                    : ko
                      ? "작업 생성"
                      : "Generate tasks"}
                </button>
              </div>
            )}
            <details className="rounded-xl border border-black/10 dark:border-white/10 p-2 text-xs">
              <summary className="cursor-pointer font-medium text-gray-500 hover:text-black dark:hover:text-white flex items-center justify-between">
                <span>
                  {ko ? "총 작업 리스트" : "Total task list"}:{" "}
                  <strong className="text-black dark:text-white font-mono">
                    {rows.length}
                  </strong>
                  {ko ? "개" : ""}
                </span>
                <span className="text-[11px] opacity-70">
                  {ko ? "펼치기 / 접기" : "Toggle list"}
                </span>
              </summary>
              <div className="space-y-3 pt-2">
                <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-gray-500 font-medium">
                        <th className="py-2 px-2.5 w-10 text-center">#</th>
                        <th className="py-2 px-2">PICK</th>
                        <th className="py-2 px-2">PLACE</th>
                        <th className="py-2 px-2">{ko ? "로봇" : "Robot"}</th>
                        <th className="py-2 px-2.5 text-center whitespace-nowrap w-16">
                          {ko ? "삭제" : "Remove"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {rows.slice(page * 10, (page + 1) * 10).map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-2 px-2.5 text-center text-gray-500 font-mono text-xs">
                            {rows.indexOf(row) + 1}
                          </td>
                          {(["pick", "place"] as const).map((key) => (
                            <td key={key} className="py-1.5 px-2">
                              <select
                                aria-label={`${key.toUpperCase()} #${rows.indexOf(row) + 1}`}
                                value={row[key]}
                                onChange={(event) =>
                                  update(row.id, key, event.target.value)
                                }
                                className={inputClass}
                              >
                                <option value="">
                                  {ko ? "station 선택" : "Select station"}
                                </option>
                                {(key === "pick" ? picks : places).map(
                                  (station) => (
                                    <option
                                      key={cellKey(station)}
                                      value={cellKey(station)}
                                    >
                                      {station.name} ({cellKey(station)})
                                    </option>
                                  ),
                                )}
                              </select>
                            </td>
                          ))}
                          <td className="py-1.5 px-2">
                            <select
                              aria-label={`${ko ? "로봇" : "Robot"} #${rows.indexOf(row) + 1}`}
                              value={row.robot}
                              onChange={(event) =>
                                update(row.id, "robot", event.target.value)
                              }
                              className={inputClass}
                            >
                              <option value="">
                                {ko
                                  ? "가용 시 자동 할당"
                                  : "Assign when available"}
                              </option>
                              {snapshot?.robots.map((robot) => (
                                <option key={robot.id} value={robot.id}>
                                  {robot.id} · {robot.operationalState}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              aria-label={`${ko ? "행 삭제" : "Remove row"} #${rows.indexOf(row) + 1}`}
                              disabled={rows.length === 1}
                              onClick={() => {
                                setRows((current) =>
                                  current.filter((item) => item.id !== row.id),
                                );
                                setPage(0);
                              }}
                              className="px-2 py-1 text-xs rounded-lg text-[#C93400] hover:bg-[#C93400]/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors font-medium whitespace-nowrap"
                            >
                              {ko ? "삭제" : "Remove"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 10 && (
                  <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() => setPage((current) => current - 1)}
                      className="px-2 py-1 rounded-lg border border-black/10 dark:border-white/10 disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      {ko ? "이전" : "Previous"}
                    </button>
                    <span className="font-medium">
                      {page + 1} / {Math.ceil(rows.length / 10)}
                    </span>
                    <button
                      type="button"
                      disabled={(page + 1) * 10 >= rows.length}
                      onClick={() => setPage((current) => current + 1)}
                      className="px-2 py-1 rounded-lg border border-black/10 dark:border-white/10 disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      {ko ? "다음" : "Next"}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  disabled={rows.length >= 100}
                  onClick={() =>
                    setRows((current) => [
                      ...current,
                      { id: nextId.current++, pick: "", place: "", robot: "" },
                    ])
                  }
                  className="w-full py-2 rounded-xl border border-dashed border-black/20 dark:border-white/20 text-gray-500 hover:text-black dark:hover:text-white hover:border-black/40 dark:hover:border-white/40 disabled:opacity-40 transition-colors font-medium"
                >
                  {ko ? "+ 작업 추가 (최대 100개)" : "+ Add task (up to 100)"}
                </button>
              </div>
            </details>
          </fieldset>
          {(error || mutation?.error || uncertain) && (
            <p role="alert" className="text-[#C93400] text-xs font-medium">
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
            className="w-full rounded-xl px-4 py-2.5 bg-[#0071E3] hover:bg-[#0071E3]/90 text-white font-medium disabled:opacity-50 transition-colors shadow-sm"
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
