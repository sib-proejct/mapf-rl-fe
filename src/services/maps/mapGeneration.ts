import { globalMutationManager } from "../../state/mutations/mutationManager.ts";

let generation: number | null = null;
let liveMapAvailable = true;
export function setMapGeneration(value: number | null): void {
  generation = value;
  globalMutationManager.setMapGeneration(value);
}
export function setLiveMapAvailable(value: boolean): void {
  liveMapAvailable = value;
}
export function isLiveMapAvailable(): boolean {
  return liveMapAvailable;
}
export function mapGenerationHeaders(): Record<string, string> {
  return generation === null ? {} : { "X-Map-Generation": String(generation) };
}
export function mapGenerationUrl(value: string): string {
  if (generation === null) return value;
  const url = new URL(value);
  url.searchParams.set("mapGeneration", String(generation));
  return url.toString();
}
