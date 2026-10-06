import React, { createContext, useContext, useEffect, useState } from "react";
import type { LocalMapState } from "../../contracts/local-map-control.generated.ts";
import {
  setLiveMapAvailable,
  setMapGeneration,
} from "../../services/maps/mapGeneration.ts";
import { defaultApiClient } from "../../services/api/client.ts";
import { resetRobotMotionCache } from "../../contracts/fixtures/stressFleet.ts";
import { useAppConfig } from "./ThemeLanguageContext.tsx";

const Context = createContext<{
  state: LocalMapState | null;
  available: boolean;
  activate: (mapId: string) => Promise<void>;
}>({ state: null, available: false, activate: async () => {} });
export const useLiveMapControl = () => useContext(Context);

export function LiveMapControl({ children }: { children: React.ReactNode }) {
  const { language } = useAppConfig();
  const [state, setState] = useState<LocalMapState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);

  useEffect(() => {
    setLiveMapAvailable(false);
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await defaultApiClient.fetchLocalMaps();
        if (stopped) return;
        setLiveMapAvailable(!next || next.phase === "ACTIVE");
        setMapGeneration(next?.generation ?? null);
        setState(next);
        setLoaded(true);
        setError(null);
      } catch (err) {
        if (!stopped) {
          setLiveMapAvailable(false);
          setLoaded(true);
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!stopped) timer = setTimeout(() => void poll(), 1000);
      }
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  const cancelSelection = () => {
    setSelection(null);
    requestAnimationFrame(() =>
      document.getElementById("map-preset-select")?.focus(),
    );
  };
  const phaseLabel = state
    ? {
        ACTIVE: language === "ko" ? "연결 확인 중" : "Checking connection",
        STOPPING:
          language === "ko" ? "기존 맵 정지 중" : "Stopping current map",
        RESETTING:
          language === "ko" ? "작업 상태 초기화 중" : "Resetting work state",
        PREPARING:
          language === "ko" ? "새 맵 준비 중" : "Preparing selected map",
        FAILED: language === "ko" ? "맵 전환 실패" : "Map switch failed",
      }[state.phase]
    : null;
  const activate = async (mapId: string) => {
    if (
      !state ||
      pending ||
      (error && state.phase === "ACTIVE") ||
      (state.phase === "ACTIVE" && state.activeMapId === mapId)
    )
      return;
    setSelection(mapId);
  };
  const submitActivation = async () => {
    if (!state || !selection || pending) return;
    const mapId = selection;
    setSelection(null);
    setPending(true);
    setLiveMapAvailable(false);
    try {
      const next = await defaultApiClient.activateLocalMap(
        mapId,
        state.generation,
      );
      setState(next);
      setMapGeneration(next.generation);
      setLiveMapAvailable(next.phase === "ACTIVE");
      setError(null);
      resetRobotMotionCache();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };
  const active = loaded && !pending && (!state || state.phase === "ACTIVE");
  return (
    <Context.Provider value={{ state, available: active && !error, activate }}>
      {error && active && (
        <div
          role="alert"
          className="border-b border-amber-500 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950 dark:text-amber-100"
        >
          {language === "ko"
            ? "서버 연결을 확인할 수 없어 Live 조작을 중지했습니다. Fixture 모드는 계속 사용할 수 있습니다. 연결을 자동으로 다시 확인합니다."
            : "Live controls are paused while the server connection is unavailable. Fixture mode remains available. The connection will be checked again automatically."}
        </div>
      )}
      {active ? (
        <React.Fragment key={state?.generation ?? "legacy"}>
          <div
            aria-hidden={selection ? true : undefined}
            style={selection ? { pointerEvents: "none" } : undefined}
          >
            {children}
          </div>
        </React.Fragment>
      ) : (
        <div
          className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white dark:bg-black text-black dark:text-white"
          role="status"
          aria-live="polite"
        >
          <p>
            {language === "ko" ? "맵을 준비하고 있습니다" : "Preparing map"}
          </p>
          <p>
            {error ||
              state?.error ||
              phaseLabel ||
              (language === "ko" ? "서버 연결 중" : "Connecting")}
          </p>
          {(error || state?.phase === "FAILED") && state && (
            <button
              className="rounded-lg border px-4 py-2"
              onClick={() => void activate(state.targetMapId)}
            >
              {language === "ko" ? "다시 시도" : "Retry"}
            </button>
          )}
        </div>
      )}
      {selection && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="map-confirm-title"
            aria-describedby="map-confirm-description"
            className="max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setSelection(null);
              }
              if (event.key === "Tab") {
                const buttons =
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "button",
                  );
                if (event.shiftKey && document.activeElement === buttons[0]) {
                  event.preventDefault();
                  buttons[buttons.length - 1].focus();
                } else if (
                  !event.shiftKey &&
                  document.activeElement === buttons[buttons.length - 1]
                ) {
                  event.preventDefault();
                  buttons[0].focus();
                }
              }
            }}
          >
            <h2 id="map-confirm-title" className="text-lg font-semibold">
              {language === "ko"
                ? "맵 변경 및 작업 초기화"
                : "Change map and reset work"}
            </h2>
            <p id="map-confirm-description" className="mt-3">
              {language === "ko"
                ? "선택한 맵의 오더·작업 이력·예약·적재·실행 상태를 삭제합니다. 등록 로봇은 보존하고 시작 위치·초기 배터리로 되돌립니다."
                : "Delete the selected map's orders, history, reservations, cargo and execution state. Registered robots are preserved and return to starting positions with initial battery."}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                autoFocus
                className="rounded-lg border px-4 py-2"
                onClick={cancelSelection}
              >
                {language === "ko" ? "취소" : "Cancel"}
              </button>
              <button
                className="rounded-lg bg-[#0071E3] px-4 py-2 text-white"
                onClick={() => void submitActivation()}
              >
                {language === "ko"
                  ? "초기화하고 맵 변경"
                  : "Reset and change map"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Context.Provider>
  );
}
