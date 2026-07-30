import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-np max-w-xl py-28 text-center">
      <p className="stat-figure text-[64px] text-gold-200">404</p>
      <h1 className="mt-4 text-[24px] font-extrabold tracking-tight text-navy-900">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        주소가 변경되었거나 삭제된 페이지일 수 있습니다.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/" className="btn-primary">
          메인으로
        </Link>
        <Link href="/status" className="btn-ghost">
          접수 조회
        </Link>
      </div>
    </div>
  );
}
