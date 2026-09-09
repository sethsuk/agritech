import { redirect } from "next/navigation";
import { currentUser, isStaff } from "@/lib/auth/currentUser";

// Root: redirect to the right dashboard based on auth + role.
export default async function RootPage() {
  const me = await currentUser();
  if (!me) redirect("/login");

  redirect(isStaff(me.role) ? "/dashboard" : "/scan");
}
