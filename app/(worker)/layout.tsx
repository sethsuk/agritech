import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentUser, isStaff } from "@/lib/auth/currentUser";

export default async function WorkerLayout({ children }: { children: ReactNode }) {
  const me = await currentUser();
  if (!me) redirect("/login");

  // Ensure role is worker (managers who navigate here should go to /dashboard)
  if (isStaff(me.role)) redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-surface-alt font-[family-name:var(--font-thai)]">
      {children}
    </div>
  );
}
