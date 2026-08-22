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
  // 1. Pillar when specified: B-01 at (7, 4)
  const pillar = classifyNodeType(7, 4, true, 32, 20);
  assert.equal(pillar.type, "pillar");
  assert.equal(pillar.name, "Pillar B-01 (7, 4)");
  assert.equal(pillar.zone, "Structure");

  // Pick cell (6, 5) facing Rack B
  const pickNode = classifyNodeType(6, 5, false, 32, 20);
  assert.equal(pickNode.type, "pick");
  assert.equal(pickNode.zone, "Aisle Pick Point (Bay B)");

  // Transfer aisle waypoint at (5, 5)
  const transferWaypoint = classifyNodeType(5, 5, false, 32, 20);
  assert.equal(transferWaypoint.type, "waypoint");

  // 2. Place Station on bottom row (Place WS)
  const ws = classifyNodeType(3, 0, false, 32, 20);
  assert.equal(ws.type, "place");
  assert.equal(ws.zone, "Place Zone");

  // 3. Place Chute on top row (Sortation Place Zone)
  const chute = classifyNodeType(3, 19, false, 32, 20);
  assert.equal(chute.type, "place");
  assert.equal(chute.zone, "Sortation Place Zone");

  // 4. Charger on right wall (concentrated on East side)
  const chargerEast = classifyNodeType(31, 6, false, 32, 20);
  assert.equal(chargerEast.type, "charger");
  assert.equal(chargerEast.zone, "Charging Bay (East)");

  // 5. Left wall (0, 6) is now a regular aisle waypoint
  const westWaypoint = classifyNodeType(0, 6, false, 32, 20);
  assert.equal(westWaypoint.type, "waypoint");

  // 6. Buffer right in front of Place Station at (3, 1)
  const buffer = classifyNodeType(3, 1, false, 32, 20);
  assert.equal(buffer.type, "buffer");
  assert.equal(buffer.zone, "Place Buffer Zone");

  // 7. Storage Rack Pod at (8, 8) in Bay B
  const podRack = classifyNodeType(8, 8, false, 32, 20);
  assert.equal(podRack.type, "rack");
  assert.equal(podRack.zone, "Rack Bay B (South Block)");

  // 8. Central Crossway waypoints at row 9 and 10
  const crosswayRow9 = classifyNodeType(8, 9, false, 32, 20);
  assert.equal(crosswayRow9.type, "waypoint");
  assert.equal(crosswayRow9.zone, "Central Crossway");

  const crosswayRow10 = classifyNodeType(8, 10, false, 32, 20);
  assert.equal(crosswayRow10.type, "waypoint");
  assert.equal(crosswayRow10.zone, "Central Crossway");
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
    6,
    "Should have 6 structural pillars in 32x20 grid: B-19, E-19, B-11, E-11, B-01, E-01",
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
  const placeNodes = topology.nodes.filter((n) => n.type === "place");
  const chargerNodes = topology.nodes.filter((n) => n.type === "charger");
  const bufferNodes = topology.nodes.filter((n) => n.type === "buffer");

  assert.equal(
    placeNodes.length,
    12,
    "Should have 12 Place Stations (6 bottom WS + 6 top chutes)",
  );
  assert.equal(
    chargerNodes.length,
    6,
    "Should have 6 Automated Charging Bays on East side",
  );
  assert.equal(bufferNodes.length, 12, "Should have 12 Staging Buffers");

  // Check directional edge constraints for Place stations:
  // 1. Place Stations (Row 0): Inflow from Buffer (col, 1) and West (col - 1, 0), Outflow to (col + 1, 0)
  const bottomPlaceNodes = placeNodes.filter((n) => n.row === 0);
  for (const place of bottomPlaceNodes) {
    const incoming = topology.nodeIncomingEdges.get(place.id) || [];
    const outgoing = topology.nodeOutgoingEdges.get(place.id) || [];
    assert.ok(incoming.length > 0);
    assert.ok(outgoing.length > 0);
    assert.ok(
      incoming.some((e) => e.fromRow === 1 && e.fromColumn === place.column),
      "Place station should have vertical ingress from Buffer (col, 1)",
    );
    assert.ok(
      outgoing.some((e) => e.toRow === 0 && e.toColumn === place.column + 1),
      "Place station should have horizontal egress to (col + 1, 0)",
    );
  }

  // 2. Place Chutes (Top row 19): Inflow from Buffer (col, 18), Outflow to (col - 1, 19)
  const topPlaceNodes = placeNodes.filter((n) => n.row === 19);
  for (const chute of topPlaceNodes) {
    const incoming = topology.nodeIncomingEdges.get(chute.id) || [];
    const outgoing = topology.nodeOutgoingEdges.get(chute.id) || [];
    assert.ok(incoming.length > 0);
    assert.ok(outgoing.length > 0);
    assert.ok(
      incoming.some((e) => e.fromRow === 18 && e.fromColumn === chute.column),
      "Place Chute should have vertical ingress from Buffer (col, 18)",
    );
    assert.ok(
      outgoing.some((e) => e.toRow === 19 && e.toColumn === chute.column - 1),
      "Place Chute should have horizontal egress to (col - 1, 19)",
    );
  }

  // 3. Chargers: Bidirectional feeder with adjacent aisle column (col 30)
  for (const charger of chargerNodes) {
    assert.equal(
      charger.column,
      31,
      "All chargers must be on the East / right wall",
    );
    const outgoing = topology.nodeOutgoingEdges.get(charger.id) || [];
    assert.ok(outgoing.length > 0);
    assert.ok(
      outgoing.every((e) => e.toColumn === 30 && e.toRow === charger.row),
    );
  }
});

test("getNodeTypeUiMeta returns appropriate metadata for all node types", () => {
  const types = ["rack", "charger", "pillar", "buffer", "place", "waypoint"];
  for (const type of types) {
    const meta = getNodeTypeUiMeta(type);
    assert.ok(meta.labelKo);
    assert.ok(meta.labelEn);
    assert.ok(meta.strokeColor);
    assert.ok(meta.fillColor);
  }
});

test("deriveMapTopology correctly builds graph for 64x40 Mega Warehouse map", async () => {
  const { MEGA_WAREHOUSE_MAP_FIXTURE } = await import(
    "../src/contracts/fixtures/largeWarehouseMap.ts"
  );
  const topology = deriveMapTopology(MEGA_WAREHOUSE_MAP_FIXTURE);

  assert.equal(
    topology.nodes.length,
    64 * 40,
    "Should have 2560 nodes in 64x40 grid",
  );
  assert.ok(topology.edges.length > 0, "Should have generated edges");

  // Check pillars: 5 columns x 4 rows = 20 structural pillars
  const pillarNodes = topology.nodes.filter((n) => n.type === "pillar");
  assert.equal(pillarNodes.length, 20, "Should have 20 structural pillars");

  // Check place stations: 15 bottom WS + 15 top Chutes = 30
  const placeNodes = topology.nodes.filter((n) => n.type === "place");
  assert.equal(placeNodes.length, 30, "Should have 30 Place Stations");

  // Check chargers: 9 West + 9 East = 18
  const chargerNodes = topology.nodes.filter((n) => n.type === "charger");
  assert.equal(
    chargerNodes.length,
    18,
    "Should have 18 Automated Docking Bays",
  );

  // Check storage racks
  const rackNodes = topology.nodes.filter((n) => n.type === "rack");
  assert.ok(rackNodes.length > 500, "Should have substantial rack pods");
});
