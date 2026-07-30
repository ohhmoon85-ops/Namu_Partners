import type { Metadata } from "next";
import Link from "next/link";
import WaitingRoom from "@/components/waiting/WaitingRoom";
import { pollQueue } from "@/lib/store";
import { notifyServed } from "@/lib/notify";

export const metadata: Metadata = {
  title: "접수 대기실",
  description: "접수 순번과 예상 대기시간을 확인하실 수 있습니다.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WaitingPage({
  params,
}: {
  params: Promise<{ ticket: string }>;
}) {
  const { ticket } = await params;
  const { snapshot, served } = await pollQueue(decodeURIComponent(ticket));

  if (served.length > 0) void notifyServed(served);

  if (!snapshot) {
    return (
      <div className="container-np max-w-2xl py-24 text-center">
        <h1 className="text-[24px] font-extrabold text-navy-900">
          접수 내역을 찾을 수 없습니다
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          접수번호가 올바른지 확인해 주세요. 접수번호는 신청 완료 시 화면과
          문자로 안내됩니다.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/status" className="btn-primary">
            접수 조회하기
          </Link>
          <Link href="/apply" className="btn-ghost">
            새로 신청하기
          </Link>
        </div>
      </div>
    );
  }

  return <WaitingRoom initial={snapshot} />;
}
