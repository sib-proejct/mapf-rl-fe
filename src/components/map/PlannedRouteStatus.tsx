import { useAppConfig } from "../../app/providers/ThemeLanguageContext.tsx";
import type { Robot } from "../../domain/robot/types.ts";
import type { Order } from "../../domain/order/types.ts";

export function PlannedRouteStatus({
  robot,
  order,
  available,
  disconnected,
}: {
  robot?: Robot;
  order?: Order;
  available: boolean;
  disconnected: boolean;
}) {
  const { t } = useAppConfig();
  if (!robot) return null;
  const status =
    disconnected ||
    robot.connectivity !== "CONNECTED" ||
    robot.freshness !== "CURRENT"
      ? t("mapRouteStale")
      : order && ["Submitted", "Planning", "Replanning"].includes(order.state)
        ? t("mapRoutePlanning")
        : available
          ? t("mapPlannedRoute")
          : t("mapRouteUnavailable");
  return (
    <div
      role="status"
      className="absolute bottom-12 left-3 z-10 pointer-events-none rounded-lg bg-white/90 dark:bg-[#1C1C1E]/90 px-3 py-2 text-xs text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="w-6 border-t-[3px] border-violet-600 dark:border-violet-300"
        />
        {status}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span
          aria-hidden="true"
          className="w-6 border-t-2 border-dashed border-blue-500"
        />
        {t("mapObservedTrail")}
      </div>
    </div>
  );
}
