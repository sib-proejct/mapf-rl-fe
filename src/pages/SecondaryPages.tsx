import React, { useState } from "react";
import { useAppConfig } from "../app/providers/ThemeLanguageContext.tsx";
import { useOperations } from "../app/providers/OperationsContext.tsx";
import {
  Box,
  Layers,
  Radio,
  FileText,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Bot,
  Flag,
  Clock,
  Sparkles,
  Sliders,
  Cpu,
  BarChart3,
  Search,
  Filter,
  Plus,
  ArrowRight,
  TrendingUp,
  Activity,
  Check,
  Copy,
} from "lucide-react";
import { OrderList } from "../components/orders/OrderList.tsx";
import { OrderInspector } from "../components/orders/OrderInspector.tsx";
import { OrderActionDialog } from "../components/orders/OrderActionDialog.tsx";
import { IncidentCenter } from "../components/incidents/IncidentCenter.tsx";
import { formatStateAge } from "../utils/time/time.ts";

/* -------------------------------------------------------------------------- */
/* 1. OrdersPage: Order Dispatch Matrix & Lifecycle Operations                */
/* -------------------------------------------------------------------------- */
export const OrdersPage: React.FC = () => {
  const { t } = useAppConfig();
  const { snapshot, setSelectedRobotId, setIsOrderModalOpen } = useOperations();
  const [filterState, setFilterState] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const orders = snapshot?.orders || [];
  const executingOrders = orders.filter((o) => o.state === "Executing");
  const appliedOrders = orders.filter((o) => o.state === "Applied");
  const completedOrdersCount = 42; // Simulation historical baseline

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-8 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 dark:bg-[#2997FF]/15 flex items-center justify-center text-[#0071E3] dark:text-[#2997FF]">
              <Box className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              Order Dispatch Matrix & Lifecycle
            </h2>
          </div>
          <p className="text-xs text-[#86868B] mt-1">
            Real-time multi-agent order lifecycle management, Application Ack vs
            Execution tracking, and idempotent mutation dispatch
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="px-4 py-2 rounded-full bg-[#0071E3] dark:bg-[#2997FF] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Dispatch Order</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 sm:gap-4.5">
        <div className="apple-card p-4 sm:p-5">
          <span className="text-[11px] font-semibold text-[#86868B] block mb-1">
            Active Orders In Flight
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#0071E3] dark:text-[#2997FF] tabular-nums">
              {orders.length}
            </span>
            <span className="text-xs text-[#86868B]">orders</span>
          </div>
        </div>

        <div className="apple-card p-4 sm:p-5">
          <span className="text-[11px] font-semibold text-[#86868B] block mb-1">
            Application Ack (Applied)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#0071E3] dark:text-[#2997FF] tabular-nums">
              {appliedOrders.length}
            </span>
            <span className="text-xs text-[#86868B]">acknowledged</span>
          </div>
        </div>

        <div className="apple-card p-4 sm:p-5">
          <span className="text-[11px] font-semibold text-[#86868B] block mb-1">
            Currently Executing
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#34C759] dark:text-[#30D158] tabular-nums">
              {executingOrders.length}
            </span>
            <span className="text-xs text-[#86868B]">in physics motion</span>
          </div>
        </div>

        <div className="apple-card p-4 sm:p-5">
          <span className="text-[11px] font-semibold text-[#86868B] block mb-1">
            Completed Today
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
              {completedOrdersCount}
            </span>
            <span className="text-xs text-[#86868B]">100% on-time</span>
          </div>
        </div>
      </div>

      {/* Main Order Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left Column (5 cols): Canonical Order List Component */}
        <div className="lg:col-span-5">
          <OrderList />
        </div>

        {/* Right Column (7 cols): Order Inspector & Lifecycle Timeline */}
        <div className="lg:col-span-7 apple-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.06] pb-3.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
              <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Order Inspector & Lifecycle Timeline
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#86868B]">
              Phase 3 Integrated View
            </span>
          </div>

          <OrderInspector />
        </div>
      </div>

      {/* Phase 3 Modals */}
      <OrderActionDialog />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. ScenariosPage: Multi-Agent Benchmark Replay & Simulation Studio         */
/* -------------------------------------------------------------------------- */
export const ScenariosPage: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<string>("warehouse_32");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(84);
  const totalSteps = 250;

  const scenarios = [
    {
      id: "warehouse_32",
      title: "Logistics Fulfillment Center",
      grid: "32 × 32 Grid",
      agents: "16 Robots",
      makespan: "128 Steps",
      conflictsAvoided: 42,
      complexity: "Standard",
    },
    {
      id: "bottleneck_16",
      title: "Narrow Chokepoint Transit",
      grid: "16 × 16 Grid",
      agents: "8 Robots",
      makespan: "94 Steps",
      conflictsAvoided: 89,
      complexity: "High Contention",
    },
    {
      id: "crossdock_48",
      title: "High-Density Cross-Dock",
      grid: "48 × 48 Grid",
      agents: "32 Robots",
      makespan: "212 Steps",
      conflictsAvoided: 134,
      complexity: "Ultra Heavy",
    },
  ];

  const selected =
    scenarios.find((s) => s.id === activeScenario) || scenarios[0];

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-8 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 dark:bg-[#2997FF]/15 flex items-center justify-center text-[#0071E3] dark:text-[#2997FF]">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              Scenario Studio & Benchmark Replay
            </h2>
          </div>
          <p className="text-xs text-[#86868B] mt-1">
            Reproducible benchmark suite for reinforcement learning and CBS
            solvers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentStep(0)}
            className="p-2 rounded-full border border-black/[0.08] dark:border-white/[0.1] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Reset Simulation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-4 py-2 rounded-full bg-[#0071E3] dark:bg-[#2997FF] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Replay</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Run Scenario</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scenario Bento Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((scen) => (
          <div
            key={scen.id}
            onClick={() => setActiveScenario(scen.id)}
            className={`apple-card p-5 cursor-pointer transition-all ${
              activeScenario === scen.id
                ? "ring-2 ring-[#0071E3] dark:ring-[#2997FF] shadow-md"
                : "hover:scale-[1.01]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-bold text-[#0071E3] dark:text-[#2997FF]">
                {scen.grid}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#86868B]">
                {scen.complexity}
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mb-3">
              {scen.title}
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#86868B]">
              <div>
                <span>Agents: </span>
                <span className="text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold">
                  {scen.agents}
                </span>
              </div>
              <div>
                <span>Makespan: </span>
                <span className="text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold">
                  {scen.makespan}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Scenario Visualizer Panel */}
      <div className="apple-card p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.06] pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
            <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Simulation Step Visualizer ({selected.title})
            </h3>
          </div>
          <span className="font-mono text-xs font-bold text-[#0071E3] dark:text-[#2997FF]">
            Step {currentStep} / {totalSteps}
          </span>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-[#F5F5F7] dark:bg-[#252528] h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-[#0071E3] dark:bg-[#2997FF] h-full transition-all duration-300 rounded-full"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono text-[#86868B]">
          <div className="p-3 bg-[#F5F5F7] dark:bg-[#252528] rounded-xl">
            <span className="block text-[10px] uppercase text-[#86868B] mb-1">
              Active Agents
            </span>
            <span className="text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {selected.agents}
            </span>
          </div>
          <div className="p-3 bg-[#F5F5F7] dark:bg-[#252528] rounded-xl">
            <span className="block text-[10px] uppercase text-[#86868B] mb-1">
              Conflicts Avoided
            </span>
            <span className="text-base font-bold text-[#34C759] dark:text-[#30D158]">
              {selected.conflictsAvoided}
            </span>
          </div>
          <div className="p-3 bg-[#F5F5F7] dark:bg-[#252528] rounded-xl">
            <span className="block text-[10px] uppercase text-[#86868B] mb-1">
              Makespan Delta
            </span>
            <span className="text-base font-bold text-[#0071E3] dark:text-[#2997FF]">
              -14.2% (RL Policy)
            </span>
          </div>
          <div className="p-3 bg-[#F5F5F7] dark:bg-[#252528] rounded-xl">
            <span className="block text-[10px] uppercase text-[#86868B] mb-1">
              Reproducibility
            </span>
            <span className="text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Deterministic Seed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. PoliciesPage: RL Policy Weights & Package Rollout Matrix                */
/* -------------------------------------------------------------------------- */
export const PoliciesPage: React.FC = () => {
  const policies = [
    {
      id: "rl-cardinal-ppo/0.4.2",
      name: "Cardinal PPO Dense Corridor Policy",
      version: "0.4.2",
      status: "ACTIVE",
      deployedTo: "4 Robots (100%)",
      checksum:
        "5555555555555555555555555555555555555555555555555555555555555555",
      successRate: "99.8%",
      makespanImprovement: "+18.4%",
    },
    {
      id: "cardinal-baseline/1.0.0",
      name: "Deterministic A* + Space-Time Reservation",
      version: "1.0.0",
      status: "STANDBY",
      deployedTo: "Fallback Safe Mode",
      checksum:
        "4444444444444444444444444444444444444444444444444444444444444444",
      successRate: "100.0%",
      makespanImprovement: "0.0% (Baseline)",
    },
  ];

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-8 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 dark:bg-[#2997FF]/15 flex items-center justify-center text-[#0071E3] dark:text-[#2997FF]">
              <Cpu className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              RL Policy Package & Rollout Control
            </h2>
          </div>
          <p className="text-xs text-[#86868B] mt-1">
            Active neural network policy checkpoints, inference benchmarks, and
            safe canary deployments
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button className="px-4 py-2 rounded-full bg-[#0071E3] dark:bg-[#2997FF] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            <span>Deploy New Policy</span>
          </button>
        </div>
      </div>

      {/* Policies List */}
      <div className="space-y-4">
        {policies.map((p) => (
          <div key={p.id} className="apple-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.04] dark:border-white/[0.06] pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {p.name}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      p.status === "ACTIVE"
                        ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20"
                        : "bg-black/5 dark:bg-white/10 text-[#86868B] border-transparent"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <span className="font-mono text-xs text-[#0071E3] dark:text-[#2997FF] font-semibold mt-0.5 block">
                  {p.id}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.1] text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  Inspect Checkpoint
                </button>
                {p.status !== "ACTIVE" && (
                  <button className="px-3 py-1.5 rounded-full bg-[#0071E3] dark:bg-[#2997FF] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                    Promote to Active
                  </button>
                )}
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 bg-[#F5F5F7] dark:bg-[#252528] rounded-xl">
                <span className="block text-[10px] text-[#86868B] mb-0.5">
                  Deployed Scope
                </span>
                <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {p.deployedTo}
                </span>
              </div>
              <div className="p-3 bg-[#F5F5F7] dark:bg-[#252528] rounded-xl">
                <span className="block text-[10px] text-[#86868B] mb-0.5">
                  Success Rate
                </span>
                <span className="font-bold text-[#34C759] dark:text-[#30D158]">
                  {p.successRate}
                </span>
              </div>
              <div className="p-3 bg-[#F5F5F7] dark:bg-[#252528] rounded-xl">
                <span className="block text-[10px] text-[#86868B] mb-0.5">
                  Efficiency Gain
                </span>
                <span className="font-bold text-[#0071E3] dark:text-[#2997FF]">
                  {p.makespanImprovement}
                </span>
              </div>
              <div className="p-3 bg-[#F5F5F7] dark:bg-[#252528] rounded-xl">
                <span className="block text-[10px] text-[#86868B] mb-0.5">
                  SHA-256 Digest
                </span>
                <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate block">
                  {p.checksum.slice(0, 16)}...
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. EventsPage: Persistent Incident Center & Safety Audit Logs              */
/* -------------------------------------------------------------------------- */
export const EventsPage: React.FC = () => {
  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-8 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D70015]/10 dark:bg-[#FF453A]/15 flex items-center justify-center text-[#D70015] dark:text-[#FF453A]">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              Incident Center & Safety Audit Logs
            </h2>
          </div>
          <p className="text-xs text-[#86868B] mt-1">
            Permanent, audited supervision of multi-agent safety stops, deadlock
            recoveries, collision risks, and RFC 9457 telemetry
          </p>
        </div>
      </div>

      {/* Embedded Persistent Incident Center */}
      <div className="apple-card p-5 sm:p-6">
        <IncidentCenter embedded />
      </div>

      <OrderActionDialog />
    </div>
  );
};
