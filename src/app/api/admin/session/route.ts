import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkPassword, issueSession } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/session — 관리자 로그인 */
export async function POST(request: Request) {
  // 비밀번호 무차별 대입 방어
  const limit = rateLimit(`admin-login:${clientIp(request)}`, 5, 5 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `로그인 시도가 너무 많습니다. ${limit.retryAfter}초 후 다시 시도해 주세요.`,
      },
      { status: 429 }
    );
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "요청 형식 오류" }, { status: 400 });
  }

  if (!checkPassword(String(body.password ?? ""))) {
    return NextResponse.json(
      { ok: false, error: "비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const session = issueSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(session.name, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.maxAge,
  });
  return response;
}

/** DELETE /api/admin/session — 로그아웃 */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
