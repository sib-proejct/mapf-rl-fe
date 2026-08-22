import React from "react";
import { useAppConfig } from "../app/providers/ThemeLanguageContext.tsx";
import { Box, Layers, Radio, FileText } from "lucide-react";
import { OrderList } from "../components/orders/OrderList.tsx";

export const OrdersPage: React.FC = () => {
  const { t } = useAppConfig();
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Box className="w-5 h-5 text-apple-blue" />
        <h2 className="text-xl font-bold text-apple-text-primary">
          {t("navOrders")}
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <OrderList />
        <div className="apple-card p-6 flex flex-col items-center justify-center text-center text-apple-text-secondary min-h-[300px]">
          <p className="text-xs">
            Phase 1: Read-only order view. Order mutation workflows (Create,
            Cancel, Reassign) arrive in Phase 3.
          </p>
        </div>
      </div>
    </div>
  );
};

export const ScenariosPage: React.FC = () => {
  const { t } = useAppConfig();
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-apple-blue" />
        <h2 className="text-xl font-bold text-apple-text-primary">
          {t("navScenarios")}
        </h2>
      </div>
      <div className="apple-card p-8 text-center text-apple-text-secondary">
        <p className="text-sm font-medium text-apple-text-primary">
          Scenario Simulation & Playback
        </p>
        <p className="text-xs mt-1">
          Scenario execution, benchmark reproduction, and simulation controls
          arrive in Phase 4.
        </p>
      </div>
    </div>
  );
};

export const PoliciesPage: React.FC = () => {
  const { t } = useAppConfig();
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Radio className="w-5 h-5 text-apple-blue" />
        <h2 className="text-xl font-bold text-apple-text-primary">
          {t("navPolicies")}
        </h2>
      </div>
      <div className="apple-card p-8 text-center text-apple-text-secondary">
        <p className="text-sm font-medium text-apple-text-primary">
          Policy Package & Rollout Manager
        </p>
        <p className="text-xs mt-1">
          Canary rollout distribution, package approval metadata, and rollback
          controls arrive in Phase 4.
        </p>
      </div>
    </div>
  );
};

export const EventsPage: React.FC = () => {
  const { t } = useAppConfig();
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-apple-blue" />
        <h2 className="text-xl font-bold text-apple-text-primary">
          {t("navEvents")}
        </h2>
      </div>
      <div className="apple-card p-8 text-center text-apple-text-secondary">
        <p className="text-sm font-medium text-apple-text-primary">
          Incident Center & Audit Events
        </p>
        <p className="text-xs mt-1">
          Comprehensive incident correlation, safety logs, and audit trails
          arrive in Phase 3.
        </p>
      </div>
    </div>
  );
};
