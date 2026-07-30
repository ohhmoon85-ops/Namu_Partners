import { NextResponse } from "next/server";
import { notifyServed } from "@/lib/notify";
import { pollQueue, setNotifyOptIn } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/queue/[ticket] — 대기실 실시간 상태 (기획서 4.3)
 * 폴링될 때마다 경과 시간만큼 대기열을 소진시키고 현재 순위를 반환한다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticket: string }> }
) {
  const { ticket } = await params;
  const { snapshot, served } = await pollQueue(ticket);

  if (!snapshot) {
    return NextResponse.json(
      { ok: false, error: "접수번호를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 순서가 도래한 신청자에게 알림톡/문자를 발송한다.
  // 폴링 응답을 지연시키지 않도록 await 하지 않는다.
  if (served.length > 0) {
    void notifyServed(served);
  }

  return NextResponse.json({ ok: true, ...snapshot });
}

/**
 * POST /api/queue/[ticket] — 알림 수신 신청/해제 (자리 비움 허용)
 * body: { notifyOptIn: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticket: string }> }
) {
  const { ticket } = await params;

  let body: { notifyOptIn?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const application = await setNotifyOptIn(ticket, body.notifyOptIn === true);
  if (!application) {
    return NextResponse.json(
      { ok: false, error: "접수번호를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, notifyOptIn: application.notifyOptIn });
}
