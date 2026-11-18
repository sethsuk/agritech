import { RouteSkeleton } from "@/components/RouteStates";

/** Shown instantly on navigation while the route's server work runs. */
export default function Loading() {
  return <RouteSkeleton />;
}
