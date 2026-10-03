// Aggregate snapshot connectivity may include retired simulators. The caller must
// queue submission requires Core connectivity; Core checks robot readiness at dispatch.
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
