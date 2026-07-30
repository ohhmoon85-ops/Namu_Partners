import type { Metadata } from "next";
import StatusLookup from "@/components/status/StatusLookup";

export const metadata: Metadata = {
  title: "접수 조회",
  description: "접수번호와 휴대폰 번호로 가입 신청 진행상태를 확인하세요.",
  robots: { index: false, follow: false },
};

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>;
}) {
  const params = await searchParams;
  return <StatusLookup initialTicket={(params.ticket ?? "").toUpperCase()} />;
}
