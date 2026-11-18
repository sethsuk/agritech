import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/gate";
import { NewManagerForm } from "@/components/manager/NewManagerForm";

// Owner-only page — managers (including this one) can't reach this even by URL.
// Role checks live per-page/per-layout (see CLAUDE.md "Auth & role routing").
export default async function NewManagerPage() {
  const me = await getSession();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/dashboard");
  return <NewManagerForm />;
}
