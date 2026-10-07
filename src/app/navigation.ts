export const pagePaths = {
  operations: "/operations",
  orders: "/orders",
  scenarios: "/scenarios",
  policies: "/policies",
  events: "/events",
  motion: "/motion",
} as const;

export type NavTab = keyof typeof pagePaths;

export function pageFromPath(pathname: string): NavTab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (
    (Object.keys(pagePaths) as NavTab[]).find(
      (page) => pagePaths[page] === path,
    ) ?? "operations"
  );
}
