import type { AuthoritativeSnapshot } from "../../domain/snapshot/types.ts";
import type { Robot, RobotOperationalState } from "../../domain/robot/types.ts";
import type { Order } from "../../domain/order/types.ts";
import type {
  RasterMap,
  MapTopology,
  MapNode,
  MapEdge,
} from "../../domain/map/types.ts";
import { cellToWorld } from "../../utils/coordinates/coordinates.ts";
import { deriveMapTopology } from "../../utils/map/topology.ts";

/**
 * Generates an authoritative snapshot with a scalable fleet (e.g. 100 robots)
 * placed realistically on traversable grid corridors.
 */
export function generateStressSnapshot(
  count: number,
  baseMap: RasterMap,
): AuthoritativeSnapshot {
  const widthCells = baseMap.widthCells;
  const heightCells = baseMap.heightCells;
  const resolution = baseMap.resolutionMeters;
  const origin = baseMap.origin;

  const topology = deriveMapTopology(baseMap);

  // Find all traversable nodes
  const traversableNodes = topology.nodes.filter((n) => n.isTraversable);
  const placeNodes = topology.nodes.filter(
    (n) => n.isTraversable && n.type === "place",
  );
  const pickNodes = topology.nodes.filter(
    (n) => n.isTraversable && n.type === "pick",
  );
  const chargerNodes = topology.nodes.filter(
    (n) => n.isTraversable && n.type === "charger",
  );
  const highwayNodes = topology.nodes.filter(
    (n) =>
      n.isTraversable &&
      (n.zone?.includes("Highway") || n.zone?.includes("Crossway")),
  );

  const robots: Robot[] = [];
  const orders: Order[] = [];

  for (let i = 0; i < count; i++) {
    const id = `robot-${String(i + 1).padStart(3, "0")}`;

    // Stagger placement across highways, aisles, and chargers
    let spawnNode = traversableNodes[(i * 13) % traversableNodes.length];
    if (i < chargerNodes.length) {
      spawnNode = chargerNodes[i];
    } else if (highwayNodes.length > 0 && i % 3 === 0) {
      spawnNode = highwayNodes[(i * 5) % highwayNodes.length];
    }

    const baseWorld = cellToWorld(
      { column: spawnNode.column, row: spawnNode.row },
      resolution,
      origin,
    );

    const xMeters = baseWorld.x;
    const yMeters = baseWorld.y;
    const yawRadians =
      spawnNode.column % 2 === 0 ? Math.PI / 2 : (3 * Math.PI) / 2;

    let state: RobotOperationalState = "EXECUTING";
    let connectivity: "CONNECTED" | "DISCONNECTED" = "CONNECTED";
    let safety: "NORMAL" | "WAIT" | "CONTROLLED_STOP" = "NORMAL";

    if (i % 25 === 0 && i > 0) {
      connectivity = "DISCONNECTED";
      state = "UNKNOWN";
    } else if (i % 15 === 0) {
      safety = "CONTROLLED_STOP";
      state = "HELD";
    } else if (i % 4 === 0) {
      state = "IDLE";
    }

    const orderId =
      state === "EXECUTING"
        ? `order-stress-${String(i + 1).padStart(3, "0")}`
        : undefined;

    robots.push({
      id,
      stateVersion: 1,
      simulationTimeMs: 10000 + i * 50,
      occurredAtUtc: new Date(Date.now() - (i % 60) * 1000).toISOString(),
      pose: {
        xMeters: Number(xMeters.toFixed(3)),
        yMeters: Number(yMeters.toFixed(3)),
        yawRadians: Number(yawRadians.toFixed(3)),
      },
      operationalState: state,
      connectivity,
      freshness: "CURRENT",
      safety,
      activeController: {
        mode: "CARDINAL",
        identity: "cardinal-rl/v2.1",
      },
      currentOrderId: orderId,
      batteryPercent: 50 + ((i * 17) % 50),
      sessionEpoch: 1,
      simulatorId: "sim-stress-cluster",
    });

    if (orderId) {
      const isPlaceGoal = i % 3 === 0;
      const isPickGoal = i % 3 === 1;
      let goalCol: number;
      let goalRow: number;

      if (isPlaceGoal && placeNodes.length > 0) {
        const pNode = placeNodes[i % placeNodes.length];
        goalCol = pNode.column;
        goalRow = pNode.row;
      } else if (isPickGoal && pickNodes.length > 0) {
        const pkNode = pickNodes[(i * 7) % pickNodes.length];
        goalCol = pkNode.column;
        goalRow = pkNode.row;
      } else {
        const randomTraversable =
          traversableNodes[(i * 11) % traversableNodes.length] || spawnNode;
        goalCol = randomTraversable.column;
        goalRow = randomTraversable.row;
      }

      orders.push({
        id: orderId,
        orderUpdateId: 0,
        state: "Executing",
        submittedAtUtc: new Date().toISOString(),
        assignments: [
          {
            robotId: id,
            goalColumn: goalCol,
            goalRow: goalRow,
          },
        ],
      });
    }
  }

  return {
    contractVersion: "1.0.0",
    snapshotAt: new Date().toISOString(),
    cursor: {
      streamId: `fleet-stress-${count}`,
      eventSequence: 1000 + count,
    },
    freshness: "CURRENT",
    map: baseMap,
    robots,
    orders,
  };
}

interface RobotMotionState {
  fromNodeId: number;
  toNodeId: number;
  progress: number;
  speed: number;
}

const robotMotionCache = new Map<string, RobotMotionState>();
let cachedTopology: MapTopology | null = null;
let lastTopologyKey = "";

export function resetRobotMotionCache(): void {
  robotMotionCache.clear();
  cachedTopology = null;
  lastTopologyKey = "";
}

/**
 * Deterministically advances robot poses along warehouse topological edges.
 */
export function advanceStressMotion(
  snapshot: AuthoritativeSnapshot,
  _tickCount: number,
  topology?: MapTopology | null,
): AuthoritativeSnapshot {
  const map = snapshot.map;
  if (!map) return snapshot;

  const currentTopology =
    topology ||
    (() => {
      const topologyKey = `${map.mapId}-${map.revision}-${map.cells.length}`;
      if (cachedTopology && lastTopologyKey === topologyKey) {
        return cachedTopology;
      }
      cachedTopology = deriveMapTopology(map);
      lastTopologyKey = topologyKey;
      return cachedTopology;
    })();

  const updatedRobots = snapshot.robots.map((robot) => {
    if (
      robot.connectivity === "DISCONNECTED" ||
      robot.operationalState === "IDLE" ||
      robot.operationalState === "HELD" ||
      robot.operationalState === "CHARGING" ||
      robot.safety === "CONTROLLED_STOP"
    ) {
      const isCharging = robot.operationalState === "CHARGING";
      const batteryPercent = isCharging
        ? Math.min(
            100,
            (robot.batteryPercent ?? 42) + (_tickCount % 10 === 0 ? 1 : 0),
          )
        : robot.batteryPercent;
      return {
        ...robot,
        simulationTimeMs: robot.simulationTimeMs + 50,
        batteryPercent,
      };
    }

    let nav = robotMotionCache.get(robot.id);

    // Initialize or validate navigation state
    if (
      !nav ||
      !currentTopology.nodeMap.has(nav.fromNodeId) ||
      !currentTopology.nodeMap.has(nav.toNodeId)
    ) {
      // Find nearest traversable node to current pose
      let bestNode =
        currentTopology.nodes.find((n: MapNode) => n.isTraversable) ||
        currentTopology.nodes[0];
      let bestDist = Infinity;
      for (const n of currentTopology.nodes) {
        if (!n.isTraversable) continue;
        const d = Math.hypot(
          n.xMeters - robot.pose.xMeters,
          n.yMeters - robot.pose.yMeters,
        );
        if (d < bestDist) {
          bestDist = d;
          bestNode = n;
        }
      }

      const outgoing = currentTopology.nodeOutgoingEdges.get(bestNode.id) || [];
      const hash = Math.abs(
        robot.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0),
      );
      const targetNodeId =
        outgoing.length > 0
          ? outgoing[hash % outgoing.length].toNodeId
          : bestNode.id;

      // Speed between 0.03 and 0.05 per tick (~0.6 - 1.0 m/s at 20 ticks/sec)
      const speed = 0.035 + (hash % 4) * 0.005;

      nav = {
        fromNodeId: bestNode.id,
        toNodeId: targetNodeId,
        progress: 0,
        speed,
      };
      robotMotionCache.set(robot.id, nav);
    }

    // Advance motion progress along edge
    nav.progress += nav.speed;

    if (nav.progress >= 1.0) {
      const prevFrom = nav.fromNodeId;
      const reachedNodeId = nav.toNodeId;
      nav.fromNodeId = reachedNodeId;
      nav.progress = Math.max(0, nav.progress - 1.0);

      const outgoing =
        currentTopology.nodeOutgoingEdges.get(reachedNodeId) || [];
      if (outgoing.length > 0) {
        // Avoid immediate U-turn if other branches exist
        const forwardEdges = outgoing.filter(
          (e: MapEdge) => e.toNodeId !== prevFrom,
        );
        const candidates = forwardEdges.length > 0 ? forwardEdges : outgoing;
        const chosen =
          candidates[Math.floor(Math.random() * candidates.length)];
        nav.toNodeId = chosen.toNodeId;
      } else {
        const incoming =
          currentTopology.nodeIncomingEdges.get(reachedNodeId) || [];
        nav.toNodeId =
          incoming.length > 0 ? incoming[0].fromNodeId : reachedNodeId;
      }
    }

    const fromNode = currentTopology.nodeMap.get(nav.fromNodeId);
    const toNode = currentTopology.nodeMap.get(nav.toNodeId);

    let xMeters = robot.pose.xMeters;
    let yMeters = robot.pose.yMeters;
    let yawRadians = robot.pose.yawRadians;

    if (fromNode && toNode) {
      const p = Math.min(Math.max(nav.progress, 0), 1);
      xMeters = fromNode.xMeters + (toNode.xMeters - fromNode.xMeters) * p;
      yMeters = fromNode.yMeters + (toNode.yMeters - fromNode.yMeters) * p;

      const dx = toNode.xMeters - fromNode.xMeters;
      const dy = toNode.yMeters - fromNode.yMeters;
      if (Math.hypot(dx, dy) > 0.001) {
        yawRadians = Math.atan2(dy, dx);
        if (yawRadians < 0) {
          yawRadians += 2 * Math.PI;
        }
      }
    }

    return {
      ...robot,
      pose: {
        xMeters: Number(xMeters.toFixed(3)),
        yMeters: Number(yMeters.toFixed(3)),
        yawRadians: Number(yawRadians.toFixed(4)),
      },
      simulationTimeMs: robot.simulationTimeMs + 50,
    };
  });

  return {
    ...snapshot,
    snapshotAt: new Date().toISOString(),
    robots: updatedRobots,
  };
}
