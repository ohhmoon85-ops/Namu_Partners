"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "로그인에 실패했습니다.");
        return;
      }
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-navy-900 px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8">
        <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-gold">
          NAMU PARTNERS
        </p>
        <h1 className="mt-2 text-[22px] font-extrabold tracking-tight text-navy-900">
          관리자 로그인
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          접수 관리 및 캐시백 집계를 위한 내부 전용 화면입니다.
        </p>

        <label className="label mt-7" htmlFor="admin-password">
          비밀번호
        </label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className={`field ${error ? "field-error" : ""}`}
        />

        {error && (
          <p role="alert" className="mt-2 text-[13px] font-medium text-red-600">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
          {loading ? "확인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
