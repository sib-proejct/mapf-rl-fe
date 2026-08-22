import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyNodeType,
  deriveMapTopology,
  getNodeTypeUiMeta,
} from "../src/utils/map/topology.ts";
import { CANONICAL_MAP_FIXTURE } from "../src/contracts/fixtures/canonical.ts";
import { adaptRasterMap } from "../src/contracts/adapters/mapAdapter.ts";

test("classifyNodeType correctly classifies specialized warehouse nodes", () => {
  // 1. Pillar when blocked
  const pillar = classifyNodeType(6, 5, true, 32, 20);
  assert.equal(pillar.type, "pillar");
  assert.equal(pillar.zone, "Structure");

  // 2. Workstation on bottom row (G2P Pick)
  const ws = classifyNodeType(3, 0, false, 32, 20);
  assert.equal(ws.type, "workstation");
  assert.equal(ws.zone, "Picking Zone");

  // 3. Chute on top row (Sortation / Inbound)
  const chute = classifyNodeType(3, 19, false, 32, 20);
  assert.equal(chute.type, "chute");
  assert.equal(chute.zone, "Sortation Zone");

  // 4. Charger on left wall
  const chargerWest = classifyNodeType(0, 6, false, 32, 20);
  assert.equal(chargerWest.type, "charger");
  assert.equal(chargerWest.zone, "Charging Bay");

  // 5. Charger on right wall
  const chargerEast = classifyNodeType(31, 6, false, 32, 20);
  assert.equal(chargerEast.type, "charger");
  assert.equal(chargerEast.zone, "Charging Bay");

  // 6. Buffer right in front of Workstation at (3, 1)
  const buffer = classifyNodeType(3, 1, false, 32, 20);
  assert.equal(buffer.type, "buffer");
  assert.equal(buffer.zone, "WS Buffer Zone");

  // 7. Storage Rack Pod at (8, 8) in Bay B
  const podRack = classifyNodeType(8, 8, false, 32, 20);
  assert.equal(podRack.type, "rack");
  assert.equal(podRack.zone, "Rack Bay B (South Block)");

  // 8. Storage Aisle waypoint at (4, 8)
  const aisleWaypoint = classifyNodeType(4, 8, false, 32, 20);
  assert.equal(aisleWaypoint.type, "waypoint");
  assert.equal(aisleWaypoint.zone, "Storage Aisle");
});

test("deriveMapTopology produces valid graph with nodes and directed/bidirectional edges", () => {
  const rasterMap = adaptRasterMap(CANONICAL_MAP_FIXTURE);
  const topology = deriveMapTopology(rasterMap);

  assert.equal(topology.nodes.length, 32 * 20);
  assert.ok(topology.edges.length > 0);

  // Check node lookups
  const node0 = topology.nodeMap.get(0);
  assert.ok(node0);
  assert.equal(node0.column, 0);
  assert.equal(node0.row, 0);

  // Check that blocked pillar nodes have no edges
  const pillarNodes = topology.nodes.filter((n) => n.type === "pillar");
  assert.equal(
    pillarNodes.length,
    12,
    "Should have 12 structural pillars in 32x20 grid",
  );
  for (const pillar of pillarNodes) {
    const outgoing = topology.nodeOutgoingEdges.get(pillar.id) || [];
    const incoming = topology.nodeIncomingEdges.get(pillar.id) || [];
    assert.equal(
      outgoing.length,
      0,
      `Pillar ${pillar.id} should have 0 outgoing edges`,
    );
    assert.equal(
      incoming.length,
      0,
      `Pillar ${pillar.id} should have 0 incoming edges`,
    );
  }

  // Check station nodes presence
  const wsNodes = topology.nodes.filter((n) => n.type === "workstation");
  const chuteNodes = topology.nodes.filter((n) => n.type === "chute");
  const chargerNodes = topology.nodes.filter((n) => n.type === "charger");
  const bufferNodes = topology.nodes.filter((n) => n.type === "buffer");

  assert.equal(
    wsNodes.length,
    6,
    "Should have 6 Pick Workstations (WS-01 ~ WS-06)",
  );
  assert.equal(
    chuteNodes.length,
    6,
    "Should have 6 Place Chutes (Chute-01 ~ Chute-06)",
  );
  assert.equal(chargerNodes.length, 6, "Should have 6 Automated Charging Bays");
  assert.equal(bufferNodes.length, 12, "Should have 12 Staging Buffers");

  // Check directional edge constraints for specialized stations:
  // 1. Workstations (Row 0): Inflow from Buffer (col, 1), Outflow to (col + 1, 0)
  for (const ws of wsNodes) {
    const incoming = topology.nodeIncomingEdges.get(ws.id) || [];
    const outgoing = topology.nodeOutgoingEdges.get(ws.id) || [];
    assert.ok(incoming.length > 0);
    assert.ok(outgoing.length > 0);
    assert.ok(
      incoming.every((e) => e.fromRow === 1 && e.fromColumn === ws.column),
    );
    assert.ok(
      outgoing.every((e) => e.toRow === 0 && e.toColumn === ws.column + 1),
    );
  }

  // 2. Chutes (Top row 19): Inflow from Buffer (col, 18), Outflow to (col + 1, 19)
  for (const chute of chuteNodes) {
    const incoming = topology.nodeIncomingEdges.get(chute.id) || [];
    const outgoing = topology.nodeOutgoingEdges.get(chute.id) || [];
    assert.ok(incoming.length > 0);
    assert.ok(outgoing.length > 0);
    assert.ok(
      incoming.every((e) => e.fromRow === 18 && e.fromColumn === chute.column),
    );
    assert.ok(
      outgoing.every((e) => e.toRow === 19 && e.toColumn === chute.column + 1),
    );
  }

  // 3. Chargers: Bidirectional feeder with adjacent aisle column
  for (const charger of chargerNodes) {
    const outgoing = topology.nodeOutgoingEdges.get(charger.id) || [];
    assert.ok(outgoing.length > 0);
    assert.ok(
      outgoing.every(
        (e) =>
          (e.toColumn === 1 || e.toColumn === 30) && e.toRow === charger.row,
      ),
    );
  }
});

test("getNodeTypeUiMeta returns appropriate metadata for all node types", () => {
  const types = [
    "rack",
    "charger",
    "pillar",
    "buffer",
    "chute",
    "workstation",
    "waypoint",
  ];
  for (const type of types) {
    const meta = getNodeTypeUiMeta(type);
    assert.ok(meta.labelKo);
    assert.ok(meta.labelEn);
    assert.ok(meta.strokeColor);
    assert.ok(meta.fillColor);
  }
});
