"use client";

import { useEffect } from "react";
import Link from "next/link";

// 화면을 그리다 오류가 나면 보여준다. 자세한 내용은 Vercel 로그(digest)로 찾는다.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card mx-auto mt-10 max-w-lg p-6 text-center">
      <h1 className="text-lg font-bold text-slate-900">화면을 불러오지 못했습니다</h1>
      <p className="mt-2 text-sm text-slate-600">잠시 후 다시 시도해 주세요. 계속되면 관리자에게 아래 오류 번호를 알려 주세요.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-slate-400">오류 번호: {error.digest}</p>}
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" onClick={() => retry()} className="btn-primary">다시 시도</button>
        <Link href="/" className="btn-secondary">대시보드로</Link>
      </div>
    </div>
  );
}
