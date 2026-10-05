import React, { useEffect, useMemo, useRef, useState } from "react";
import { Gauge, RefreshCw } from "lucide-react";
import { useAppConfig } from "../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../app/providers/OperationsContext.tsx";
import { defaultApiClient, ProblemError } from "../services/api/client.ts";
import type {
  MotionProfile,
  MotionProfileLimits,
  SetMotionProfilesRequest,
} from "../contracts/provisioning.generated.ts";

const requested: MotionProfileLimits = {
  maxLinearSpeedMps: 1.5,
  maxLinearAccelerationMps2: 1.0,
  maxLinearDecelerationMps2: 1.5,
  maxLinearJerkMps3: 3.0,
};

// Symmetric jerk-limited speed curve over 10 metres, using the slower accel/decel.
function speedCurve(limits: MotionProfileLimits) {
  const a = Math.min(
    limits.maxLinearAccelerationMps2,
    limits.maxLinearDecelerationMps2,
  );
  const j = limits.maxLinearJerkMps3;
  const rampTime = (v: number) => {
    const tj = Math.min(a / j, Math.sqrt(v / j));
    return 2 * tj + Math.max(0, v / a - tj);
  };
  let low = 0,
    high = limits.maxLinearSpeedMps;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (mid * rampTime(mid) <= 10) low = mid;
    else high = mid;
  }
  const v = low,
    tj = Math.min(a / j, Math.sqrt(v / j));
  const ta = Math.max(0, v / a - tj),
    ramp = 2 * tj + ta;
  const cruise = Math.max(0, 10 / v - ramp),
    duration = 2 * ramp + cruise;
  const accelerate = (time: number) =>
    time < tj
      ? (j * time * time) / 2
      : time < tj + ta
        ? (j * tj * tj) / 2 + j * tj * (time - tj)
        : v - (j * (ramp - time) ** 2) / 2;
  const values = Array.from({ length: 201 }, (_, i) => {
    const time = (duration * i) / 200;
    const speed =
      time < ramp
        ? accelerate(time)
        : time < ramp + cruise
          ? v
          : accelerate(duration - time);
    return `${40 + (600 * i) / 200},${180 - (140 * speed) / limits.maxLinearSpeedMps}`;
  });
  return { points: values.join(" "), duration };
}

export const MotionProfilesPage: React.FC = () => {
  const { language } = useAppConfig();
  const ko = language === "ko";
  const { transportMode, setTransportMode } = useOperations();
  const live = transportMode === "LIVE_WEBSOCKET";
  const [profiles, setProfiles] = useState<MotionProfile[]>([]);
  const [selection, setSelection] = useState("all");
  const [draft, setDraft] = useState<MotionProfileLimits>(requested);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const pending = useRef<SetMotionProfilesRequest | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!live) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    const read = async () => {
      try {
        const outcome = await defaultApiClient.motionProfiles({
          signal: controller.signal,
        });
        if (!active) return;
        setProfiles(outcome.profiles);
        if (!initialized.current && outcome.profiles.length) {
          setDraft(outcome.profiles[0].limits);
          initialized.current = true;
        }
        setReadError("");
      } catch (err) {
        if (!controller.signal.aborted)
          setReadError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    void read();
    const timer = window.setInterval(read, 2000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [live, reload]);

  const targets = profiles.filter(
    (profile) => selection === "all" || selection === profile.robotId,
  );
  const fields = [
    ["maxLinearSpeedMps", ko ? "최대 속도" : "Maximum speed", "m/s", 3],
    ["maxLinearAccelerationMps2", ko ? "가속도" : "Acceleration", "m/s²", 3],
    ["maxLinearDecelerationMps2", ko ? "감속도" : "Deceleration", "m/s²", 3],
    ["maxLinearJerkMps3", ko ? "가가속도 (jerk)" : "Jerk", "m/s³", 30],
  ] as const;
  const valid = fields.every(
    ([key, , , max]) =>
      Number.isFinite(draft[key]) && draft[key] >= 0.1 && draft[key] <= max,
  );
  const curve = useMemo(
    () => (valid ? speedCurve(draft) : null),
    [draft, valid],
  );
  const update = (next: MotionProfileLimits) => {
    setDraft(next);
    pending.current = null;
    setNotice("");
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!live || readError || saving || !valid || !targets.length) return;
    const command = pending.current ?? {
      contractVersion: "1.0.0" as const,
      requestId: crypto.randomUUID(),
      targets: targets.map(({ robotId, version }) => ({ robotId, version })),
      limits: { ...draft },
    };
    pending.current = command;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await defaultApiClient.saveMotionProfiles(command);
      pending.current = null;
      setNotice(
        ko
          ? "저장했습니다. 로봇이 정지한 상태에서 적용하고 아래 적용 상태를 갱신합니다."
          : "Saved. The simulator applies the profile at rest; application status appears below.",
      );
      setReload((value) => value + 1);
    } catch (err) {
      if (err instanceof ProblemError && err.problem.status < 500)
        pending.current = null;
      const code = err instanceof ProblemError ? err.problem.code : "";
      setError(
        code === "ROBOT_BUSY"
          ? ko
            ? "이동 또는 작업 중인 로봇이 있습니다. 작업 종료 후 저장하거나 대기 중인 로봇만 선택하세요."
            : "A robot is busy. Finish its order or select an idle robot."
          : code === "MOTION_PROFILE_VERSION_CONFLICT"
            ? ko
              ? "다른 변경이 반영되었습니다. 최신 값을 다시 불러온 후 저장하세요."
              : "The profile changed. Reload current values before saving."
            : err instanceof Error
              ? err.message
              : String(err),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Gauge className="text-[#0071E3]" />
            {ko ? "속도 프로파일" : "Motion profiles"}
          </h1>
          <p className="text-sm text-[#86868B] mt-2">
            {ko
              ? "로봇의 속도·가속도·감속도·가가속도 제한을 설정합니다."
              : "Configure robot speed, acceleration, deceleration and jerk limits."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError("");
            setReload((value) => value + 1);
          }}
          disabled={!live || saving}
          className="flex items-center gap-2 text-sm text-[#0071E3] disabled:opacity-40"
        >
          <RefreshCw size={16} />
          {ko ? "새로고침" : "Refresh"}
        </button>
      </header>
      {!live && (
        <p role="status" className="apple-card p-5">
          {ko
            ? "Live WS 모드에서 실제 로봇의 설정을 수정할 수 있습니다."
            : "Switch to Live WS to edit real robot settings."}
          <button
            type="button"
            onClick={() => setTransportMode("LIVE_WEBSOCKET")}
            className="ml-3 text-[#0071E3] font-medium"
          >
            {ko ? "실시간 연결" : "Connect live"}
          </button>
        </p>
      )}
      {(error || readError) && (
        <p
          role="alert"
          className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm"
        >
          {error || readError}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-sm"
        >
          {notice}
        </p>
      )}
      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={save} className="apple-card p-6 space-y-5">
          <label className="block text-sm font-medium">
            {ko ? "적용 대상" : "Apply to"}
            <select
              value={selection}
              disabled={saving || !live}
              onChange={(event) => {
                const value = event.target.value;
                setSelection(value);
                pending.current = null;
                const profile = profiles.find(
                  (profile) => profile.robotId === value,
                );
                if (profile) update(profile.limits);
              }}
              className="mt-2 block w-full rounded-xl border border-black/10 dark:border-white/20 bg-transparent p-3"
            >
              <option value="all">{ko ? "전체 로봇" : "All robots"}</option>
              {profiles.map((profile) => (
                <option key={profile.robotId} value={profile.robotId}>
                  {profile.robotId}
                </option>
              ))}
            </select>
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            {fields.map(([key, label, unit, max]) => (
              <label key={key} className="block text-sm font-medium">
                {label} <span className="text-[#86868B]">({unit})</span>
                <input
                  type="number"
                  min="0.1"
                  max={max}
                  step="0.1"
                  required
                  disabled={saving || !live}
                  value={Number.isNaN(draft[key]) ? "" : draft[key]}
                  onChange={(event) =>
                    update({
                      ...draft,
                      [key]:
                        event.target.value === ""
                          ? NaN
                          : Number(event.target.value),
                    })
                  }
                  className="mt-2 block w-full rounded-xl border border-black/10 dark:border-white/20 bg-transparent p-3 tabular-nums"
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-[#86868B] leading-relaxed">
            {ko
              ? "작업이 끝난 대기 로봇에 저장할 수 있습니다. 실제 속도는 경로 예약과 안전 제동에 따라 제한됩니다. 비상 제동 설정은 유지합니다."
              : "Save when the robot is idle after its order. Route reservations and safety braking can reduce actual speed. Emergency braking stays unchanged."}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={
                !live ||
                loading ||
                saving ||
                !!readError ||
                !valid ||
                !targets.length
              }
              className="bg-[#0071E3] text-white px-5 py-3 rounded-xl text-sm font-medium disabled:opacity-40"
            >
              {saving
                ? ko
                  ? "저장 중…"
                  : "Saving…"
                : ko
                  ? "프로파일 저장"
                  : "Save profile"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => update({ ...requested })}
              className="px-4 py-3 rounded-xl border border-black/10 dark:border-white/20 text-sm"
            >
              {ko ? "권장 기본값 불러오기" : "Load recommended defaults"}
            </button>
          </div>
        </form>
        <section className="apple-card p-6 space-y-4">
          <h2 className="font-semibold">
            {ko ? "속도 곡선 미리보기" : "Speed curve preview"}
          </h2>
          <p className="text-sm text-[#86868B]">
            {ko
              ? "10m 직선의 출발 → 순항 → 정지 예시입니다. 더 작은 가속·감속 한계로 계산합니다."
              : "Start → cruise → stop over 10 m, using the lower acceleration/deceleration limit."}
          </p>
          {curve ? (
            <>
              <svg
                viewBox="0 0 680 220"
                role="img"
                aria-label={
                  ko
                    ? "예상 시간에 따른 속도 곡선"
                    : "Estimated speed versus time"
                }
                className="w-full"
              >
                <path
                  d="M40 30V180H650"
                  fill="none"
                  stroke="currentColor"
                  opacity="0.3"
                />
                <path
                  d="M40 40H650 M40 110H650"
                  fill="none"
                  stroke="currentColor"
                  opacity="0.1"
                />
                <polyline
                  points={curve.points}
                  fill="none"
                  stroke="#0071E3"
                  strokeWidth="3"
                />
                <text x="40" y="20" fill="currentColor" fontSize="12">
                  {draft.maxLinearSpeedMps.toFixed(1)} m/s
                </text>
                <text x="40" y="205" fill="currentColor" fontSize="12">
                  0 s
                </text>
                <text x="590" y="205" fill="currentColor" fontSize="12">
                  {curve.duration.toFixed(1)} s
                </text>
              </svg>
              <p className="text-xs text-[#86868B]">
                {ko
                  ? "예상 시간입니다. 장애물·통행 대기는 반영하지 않으며 이동 허가에는 사용하지 않습니다."
                  : "Times are estimates. Obstacles and passage waits are excluded; estimates do not authorize movement."}
              </p>
            </>
          ) : (
            <p>{ko ? "유효한 값을 입력하세요." : "Enter valid limits."}</p>
          )}
        </section>
      </div>
      <section className="apple-card p-6 overflow-x-auto">
        <h2 className="font-semibold mb-4">
          {ko ? "저장 및 적용 상태" : "Saved and applied status"}
        </h2>
        {loading ? (
          <p role="status">{ko ? "불러오는 중…" : "Loading…"}</p>
        ) : !profiles.length ? (
          <p>
            {ko
              ? "표시할 로봇 프로파일이 없습니다."
              : "No robot profiles available."}
          </p>
        ) : (
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead>
              <tr className="text-[#86868B] border-b border-black/10 dark:border-white/10">
                <th className="py-3 pr-4">{ko ? "로봇" : "Robot"}</th>
                {fields.map(([key, label, unit]) => (
                  <th key={key} className="py-3 pr-4 font-medium">
                    {label} ({unit})
                  </th>
                ))}
                <th>{ko ? "상태" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr
                  key={profile.robotId}
                  className="border-b border-black/5 dark:border-white/5"
                >
                  <td className="py-4 font-mono">{profile.robotId}</td>
                  {fields.map(([key]) => (
                    <td key={key} className="tabular-nums">
                      {profile.limits[key].toFixed(1)}
                    </td>
                  ))}
                  <td
                    className={
                      profile.appliedVersion === profile.version
                        ? "text-green-700 dark:text-green-400"
                        : "text-amber-700 dark:text-amber-400"
                    }
                  >
                    {profile.appliedVersion === profile.version
                      ? ko
                        ? "적용 완료"
                        : "Applied"
                      : ko
                        ? "적용 대기"
                        : "Pending"}{" "}
                    <span className="text-xs text-[#86868B]">
                      v{profile.version}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
