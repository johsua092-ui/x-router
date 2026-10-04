import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/db";
import DashboardLayout from "@/shared/components/DashboardLayout";

export const dynamic = "force-dynamic";

export default function ProtectedLayout({ children }) {
  const token = cookies().get("xr_session")?.value;
  const user = sessionUser(token);
  if (!user) redirect("/login");
  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
