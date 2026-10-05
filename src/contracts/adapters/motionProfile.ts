import type { MotionProfilesOutcome } from "../provisioning.generated.ts";

export function adaptMotionProfiles(value: unknown): MotionProfilesOutcome {
  if (!value || typeof value !== "object")
    throw new Error("Invalid motion profile response");
  const result = value as MotionProfilesOutcome;
  if (result.contractVersion !== "1.0.0" || !Array.isArray(result.profiles))
    throw new Error("Unsupported motion profile response");
  const ids = new Set<string>();
  for (const profile of result.profiles) {
    if (
      !profile ||
      typeof profile.robotId !== "string" ||
      ids.has(profile.robotId) ||
      !Number.isSafeInteger(profile.version) ||
      profile.version < 0 ||
      !Number.isSafeInteger(profile.appliedVersion) ||
      profile.appliedVersion < 0 ||
      profile.appliedVersion > profile.version ||
      !profile.limits
    )
      throw new Error("Invalid robot motion profile");
    ids.add(profile.robotId);
    for (const [key, upper] of [
      ["maxLinearSpeedMps", 3],
      ["maxLinearAccelerationMps2", 3],
      ["maxLinearDecelerationMps2", 3],
      ["maxLinearJerkMps3", 30],
    ] as const) {
      const number = profile.limits[key];
      if (!Number.isFinite(number) || number < 0.1 || number > upper)
        throw new Error("Invalid motion limit");
    }
  }
  return result;
}
