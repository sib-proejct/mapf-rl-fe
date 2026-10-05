export function generateTransportWave(
  count: number,
  picks: readonly string[],
  places: readonly string[],
  random: () => number = Math.random,
): { pick: string; place: string; robot: string }[] {
  if (!Number.isInteger(count) || count < 1 || count > 100)
    throw new Error("Task count must be an integer from 1 to 100.");
  if (!picks.length || !places.length)
    throw new Error("Choose at least one PICK and PLACE station.");
  return Array.from({ length: count }, () => ({
    pick: picks[Math.floor(random() * picks.length)],
    place: places[Math.floor(random() * places.length)],
    robot: "",
  }));
}
