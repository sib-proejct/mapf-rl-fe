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
import { formatStateAge } from "../utils/time/time.ts";

/* -------------------------------------------------------------------------- */
/* 1. OrdersPage: Order Dispatch Matrix & Lifecycle Operations                */
/* -------------------------------------------------------------------------- */
export const OrdersPage: React.FC = () => {
  const { t } = useAppConfig();
  const { snapshot, setSelectedRobotId } = useOperations();
  const [filterState, setFilterState] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  // Mock initial orders data for dispatch matrix
  const orders = snapshot?.orders || [];
  const filteredOrders = orders.filter((o) => {
    const matchesFilter =
      filterState === "ALL" || o.state.toUpperCase() === filterState;
    const matchesSearch =
      !searchQuery || o.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const executingOrders = orders.filter((o) => o.state === "Executing");
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
              Order Dispatch Matrix
            </h2>
          </div>
          <p className="text-xs text-[#86868B] mt-1">
            Real-time multi-agent order lifecycle management and dispatch
            allocation
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-full bg-[#0071E3] dark:bg-[#2997FF] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Dispatch Order</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4.5">
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
            Currently Executing
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#34C759] dark:text-[#30D158] tabular-nums">
              {executingOrders.length}
            </span>
            <span className="text-xs text-[#86868B]">in progress</span>
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

        {/* Right Column (7 cols): Order Dispatch Timeline & Details */}
        <div className="lg:col-span-7 apple-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.06] pb-3.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
              <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Order Allocation Details
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#86868B]">
              Phase 1 Live Dispatch View
            </span>
          </div>

          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={`matrix-${order.id}`}
                className="bg-[#F5F5F7] dark:bg-[#252528] p-4 rounded-2xl border border-black/[0.03] dark:border-white/[0.05] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    <span>{order.id}</span>
                    <span className="text-[10px] font-normal text-[#86868B] bg-white dark:bg-[#1C1C1E] px-2 py-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
                      Version #{order.orderUpdateId}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#86868B]">
                    {order.submittedAtUtc
                      ? formatStateAge(order.submittedAtUtc)
                      : "Live"}
                  </span>
                </div>

                {/* Assignments Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {order.assignments.map((assign, idx) => (
                    <div
                      key={`assign-card-${idx}`}
                      onClick={() => setSelectedRobotId(assign.robotId)}
                      className="bg-white dark:bg-[#1C1C1E] p-2.5 rounded-xl flex items-center justify-between border border-black/[0.04] dark:border-white/[0.06] hover:border-[#0071E3] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <Bot className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF]" />
                        <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#0071E3]">
                          {assign.robotId}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[11px] text-[#86868B]">
                        <Flag className="w-3 h-3 text-[#34C759]" />
                        <span>
                          ({assign.goalColumn}, {assign.goalRow})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
              Simulation & Benchmark Studio
            </h2>
          </div>
          <p className="text-xs text-[#86868B] mt-1">
            Reproduce multi-agent path finding scenarios and evaluate RL
            conflict avoidance policies
          </p>
        </div>
      </div>

      {/* Scenario Selection Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((sc) => {
          const isActive = sc.id === activeScenario;
          return (
            <div
              key={sc.id}
              onClick={() => setActiveScenario(sc.id)}
              className={`apple-card p-5 cursor-pointer transition-all ${
                isActive
                  ? "ring-2 ring-[#0071E3] dark:ring-[#2997FF] shadow-md"
                  : "hover:border-black/15 dark:hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div>
                  <h3 className="font-bold text-sm text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {sc.title}
                  </h3>
                  <span className="font-mono text-[11px] text-[#86868B]">
                    {sc.grid} · {sc.agents}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    sc.complexity === "High Contention"
                      ? "bg-[#FF9500]/10 text-[#FF9500]"
                      : "bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF]"
                  }`}
                >
                  {sc.complexity}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2.5 border-t border-black/[0.04] dark:border-white/[0.06]">
                <div>
                  <span className="text-[10px] text-[#86868B] block">
                    Makespan
                  </span>
                  <span className="font-mono font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {sc.makespan}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#86868B] block">
                    Conflicts Avoided
                  </span>
                  <span className="font-mono font-bold text-[#34C759]">
                    {sc.conflictsAvoided} cases
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Playback Control Deck */}
      <div className="apple-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#1D1D1F] dark:text-[#F5F5F7]">
              Scenario Playback: {selected.title}
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-[#0071E3] dark:text-[#2997FF] tabular-nums">
            Step {currentStep} / {totalSteps}
          </span>
        </div>

        {/* Scrubber Timeline Bar */}
        <div className="relative w-full">
          <input
            type="range"
            min="0"
            max={totalSteps}
            value={currentStep}
            onChange={(e) => setCurrentStep(Number(e.target.value))}
            className="w-full h-2 bg-[#F5F5F7] dark:bg-[#252528] rounded-full appearance-none cursor-pointer accent-[#0071E3] dark:accent-[#2997FF]"
          />
        </div>

        {/* Transport Controls */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setCurrentStep(0)}
            className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#86868B] transition-colors cursor-pointer"
            title="Reset to start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="w-11 h-11 rounded-full bg-[#0071E3] dark:bg-[#2997FF] text-white flex items-center justify-center shadow-md hover:scale-105 transition-transform cursor-pointer"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>
          <button
            onClick={() => setCurrentStep((p) => Math.min(p + 10, totalSteps))}
            className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#86868B] transition-colors cursor-pointer"
            title="Fast forward 10 steps"
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. PoliciesPage: RL Multi-Agent Model Zoo & Canary Rollout Manager        */
/* -------------------------------------------------------------------------- */
export const PoliciesPage: React.FC = () => {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("mappo_v2");
  const [canaryRollout, setCanaryRollout] = useState<number>(25);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);

  const policies = [
    {
      id: "mappo_v2",
      name: "MAPPO-Spatial v2.4",
      architecture: "Multi-Agent PPO + GNN Attention",
      status: "Active Production",
      latencyMs: "2.4ms",
      throughput: "410 steps/sec",
      hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      rewardScore: 98.4,
    },
    {
      id: "qmix_v3",
      name: "QMIX-Decomposed v3.1",
      architecture: "Value-Factorization QMIX",
      status: "Canary Testing",
      latencyMs: "3.1ms",
      throughput: "320 steps/sec",
      hash: "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
      rewardScore: 95.2,
    },
    {
      id: "primal_v1",
      name: "PRIMAL-GraphHybrid v1.8",
      architecture: "Decentralized RL + CBS Solver",
      status: "Benchmark Baseline",
      latencyMs: "5.8ms",
      throughput: "180 steps/sec",
      hash: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
      rewardScore: 91.8,
    },
  ];

  const selectedPolicy =
    policies.find((p) => p.id === selectedPolicyId) || policies[0];

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-8 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 dark:bg-[#2997FF]/15 flex items-center justify-center text-[#0071E3] dark:text-[#2997FF]">
              <Radio className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              RL Policy Zoo & Rollout Manager
            </h2>
          </div>
          <p className="text-xs text-[#86868B] mt-1">
            Manage neural network policy packages, check cryptographic hashes,
            and configure canary rollouts
          </p>
        </div>
      </div>

      {/* Model Zoo Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {policies.map((p) => {
          const isSelected = p.id === selectedPolicyId;
          return (
            <div
              key={p.id}
              onClick={() => setSelectedPolicyId(p.id)}
              className={`apple-card p-5 cursor-pointer transition-all ${
                isSelected
                  ? "ring-2 ring-[#0071E3] dark:ring-[#2997FF] shadow-md"
                  : "hover:border-black/15 dark:hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-bold text-sm text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {p.name}
                  </h3>
                  <p className="text-[11px] text-[#86868B] mt-0.5">
                    {p.architecture}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    p.status === "Active Production"
                      ? "bg-[#34C759]/10 text-[#248A3D] dark:text-[#30D158]"
                      : "bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF]"
                  }`}
                >
                  {p.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-3 mt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
                <div className="bg-[#F5F5F7] dark:bg-[#252528] p-2 rounded-xl">
                  <span className="text-[10px] text-[#86868B] block">
                    Inference Latency
                  </span>
                  <span className="font-mono font-bold text-[#0071E3] dark:text-[#2997FF]">
                    {p.latencyMs}
                  </span>
                </div>
                <div className="bg-[#F5F5F7] dark:bg-[#252528] p-2 rounded-xl">
                  <span className="text-[10px] text-[#86868B] block">
                    Throughput
                  </span>
                  <span className="font-mono font-bold text-[#34C759]">
                    {p.throughput}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Canary Deployment & Package Verification Slider */}
      <div className="apple-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
            <span className="font-bold text-sm text-[#1D1D1F] dark:text-[#F5F5F7]">
              Canary Rollout Distribution: {selectedPolicy.name}
            </span>
          </div>
          <span className="font-mono text-sm font-bold text-[#0071E3] dark:text-[#2997FF]">
            {canaryRollout}% of Active Fleet
          </span>
        </div>

        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={canaryRollout}
            onChange={(e) => setCanaryRollout(Number(e.target.value))}
            className="w-full h-2 bg-[#F5F5F7] dark:bg-[#252528] rounded-full appearance-none cursor-pointer accent-[#0071E3] dark:accent-[#2997FF]"
          />
          <div className="flex justify-between text-[10px] text-[#86868B] font-mono">
            <span>0% (Shadow Mode)</span>
            <span>25% Canary</span>
            <span>50% Split</span>
            <span>100% Full Fleet</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. EventsPage: Real-time Incident Audit Stream & Safety Log Center         */
/* -------------------------------------------------------------------------- */
export const EventsPage: React.FC = () => {
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const events = [
    {
      id: "EV-9401",
      timestamp: "14:28:10 UTC",
      severity: "CRITICAL",
      type: "Safety Emergency Halt",
      robotId: "robot-02",
      description:
        "Proximity breach detected (<0.35m threshold) against static pallet obstacle.",
      resolution: "Controlled deceleration enacted. All clear signal verified.",
    },
    {
      id: "EV-9400",
      timestamp: "14:25:44 UTC",
      severity: "WARNING",
      type: "Deadlock Potential",
      robotId: "robot-05",
      description: "Head-on trajectory conflict at intersection cell (12, 8).",
      resolution: "Replanned with priority queue yield rule. Delay: +1.2s.",
    },
    {
      id: "EV-9399",
      timestamp: "14:20:12 UTC",
      severity: "INFO",
      type: "Order Dispatched",
      robotId: "robot-01",
      description:
        "Order ORD-1002 assigned successfully with optimal route (14 steps).",
      resolution: "Nominal execution in progress.",
    },
    {
      id: "EV-9398",
      timestamp: "14:15:02 UTC",
      severity: "INFO",
      type: "Controller Reconcile",
      robotId: "fleet-all",
      description:
        "Synchronized policy SHA256 weights checksum across 16 active agents.",
      resolution: "Verified 100% hash match.",
    },
  ];

  const filteredEvents = events.filter((e) => {
    const matchesSev =
      filterSeverity === "ALL" || e.severity === filterSeverity;
    const matchesSearch =
      !searchQuery ||
      e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.robotId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSev && matchesSearch;
  });

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-8 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 dark:bg-[#2997FF]/15 flex items-center justify-center text-[#0071E3] dark:text-[#2997FF]">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              Incident Center & Safety Audit Logs
            </h2>
          </div>
          <p className="text-xs text-[#86868B] mt-1">
            Real-time multi-agent safety alerts, deadlock resolutions, and RFC
            9457 telemetry events
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Severity Tabs */}
        <div className="inline-flex bg-[#F2F4F6] dark:bg-[#252528] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] items-center gap-1 text-[11px] overflow-x-auto no-scrollbar">
          {["ALL", "CRITICAL", "WARNING", "INFO"].map((sev) => {
            const isActive = filterSeverity === sev;
            return (
              <button
                key={`sev-${sev}`}
                onClick={() => setFilterSeverity(sev)}
                className={`px-3 py-1 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-white dark:bg-[#1C1C1E] text-[#191F28] dark:text-[#F5F5F7] font-bold shadow-xs"
                    : "text-[#8B95A1] dark:text-[#86868B] hover:text-[#191F28] dark:hover:text-[#F5F5F7]"
                }`}
              >
                {sev}
              </button>
            );
          })}
        </div>

        {/* Search Box */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search incident ID, robot, or description..."
            className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-full pl-9 pr-4 py-1.5 text-xs text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3] dark:focus:border-[#2997FF] transition-all w-full sm:w-72"
          />
        </div>
      </div>

      {/* Events Timeline Feed */}
      <div className="apple-card divide-y divide-black/[0.04] dark:divide-white/[0.06] overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#86868B]">
            No incident events matching your filter criteria.
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const isCritical = ev.severity === "CRITICAL";
            const isWarning = ev.severity === "WARNING";

            return (
              <div
                key={ev.id}
                className="p-4 sm:p-5 hover:bg-[#F5F5F7]/60 dark:hover:bg-[#252528]/60 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isCritical
                          ? "bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20"
                          : isWarning
                            ? "bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/20"
                            : "bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] border-[#0071E3]/20"
                      }`}
                    >
                      {ev.severity}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {ev.id}
                    </span>
                    <span className="text-[#D2D2D7] dark:text-[#3A3A3C]">
                      ·
                    </span>
                    <span className="font-mono text-[11px] text-[#0071E3] dark:text-[#2997FF] font-semibold">
                      {ev.robotId}
                    </span>
                    <span className="text-[#D2D2D7] dark:text-[#3A3A3C]">
                      ·
                    </span>
                    <span className="font-semibold text-xs text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {ev.type}
                    </span>
                  </div>

                  <p className="text-xs text-[#86868B] leading-relaxed">
                    {ev.description}
                  </p>

                  <div className="flex items-center gap-1 text-[11px] text-[#34C759] dark:text-[#30D158] font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{ev.resolution}</span>
                  </div>
                </div>

                <div className="shrink-0 text-right font-mono text-[11px] text-[#86868B]">
                  {ev.timestamp}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
