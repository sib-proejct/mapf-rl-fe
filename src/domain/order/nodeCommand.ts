// Aggregate snapshot connectivity may include retired simulators. The caller must
// still require CURRENT, CONNECTED, IDLE and NORMAL on the selected robot.
export function isNodeCommandTransportReady(
  mode: string,
  state: string,
  socketConnected: boolean,
): boolean {
  if (mode === "FIXTURE_STREAM") return true;
  if (mode === "LIVE_WEBSOCKET")
    return socketConnected && ["Current", "Disconnected"].includes(state);
  return (
    mode === "POLLING_FALLBACK" && ["Current", "Disconnected"].includes(state)
  );
}
