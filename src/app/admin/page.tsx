import type { Metadata } from "next";
import AdminConsole from "@/components/admin/AdminConsole";
import AdminLogin from "@/components/admin/AdminLogin";
import { isAuthenticated } from "@/lib/auth";

export const metadata: Metadata = {
  title: "관리자",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAuthenticated())) return <AdminLogin />;
  return <AdminConsole />;
}
