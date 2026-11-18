import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth/gate";

// Root: redirect to the right dashboard based on auth + role.
export default async function RootPage() {
  const me = await getSession();
  if (!me) redirect("/login");

  redirect(isStaff(me.role) ? "/dashboard" : "/scan");
}
