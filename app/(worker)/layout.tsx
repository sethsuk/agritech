import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth/gate";

export default async function WorkerLayout({ children }: { children: ReactNode }) {
  const me = await getSession();
  if (!me) redirect("/login");

  // Ensure role is worker (managers who navigate here should go to /dashboard)
  if (isStaff(me.role)) redirect("/dashboard");
  // Deactivated: the auth ban stops new sign-ins, but an existing session can outlive
  // it — send them to login, which signs them out and explains why.
  if (!me.active) redirect("/login?reason=inactive");

  return (
    <div className="min-h-dvh bg-surface-alt">
      {children}
    </div>
  );
}
