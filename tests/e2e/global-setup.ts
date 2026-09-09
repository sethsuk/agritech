// Next.js dev mode compiles each route on first hit — on this project's WSL /mnt/c
// filesystem that can take well past a test's action timeout the first time a route
// is visited. Pre-warm every route the suite touches (unauthenticated is fine; a
// redirect to /login still forces the route to compile) so the timed tests don't pay
// that cost mid-assertion.
const ROUTES = [
  "/", "/login", "/scan", "/dashboard", "/alerts", "/trees", "/workers", "/workers/new",
  "/workers/warmup", "/managers", "/managers/new", "/my-logs", "/my-logs/warmup",
  "/tree/AL5-5", "/tree/AL5-5/task/watering_v1",
  "/api/health", "/api/task-definitions", "/api/trees/AL5-5",
];

export default async function globalSetup() {
  const baseURL = "http://localhost:3000";
  for (const route of ROUTES) {
    try {
      await fetch(`${baseURL}${route}`, { redirect: "manual" });
    } catch {
      // Best-effort warmup — a real failure here will surface as a normal test failure.
    }
  }
}
