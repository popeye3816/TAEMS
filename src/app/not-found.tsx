import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="card max-w-md p-6 text-center">
        <p className="text-sm font-semibold text-blue-700">404</p>
        <h1 className="mt-1 text-lg font-bold text-slate-900">찾는 화면이 없습니다</h1>
        <p className="mt-2 text-sm text-slate-600">주소가 바뀌었거나 삭제된 항목일 수 있습니다.</p>
        <Link href="/" className="btn-primary mt-5">대시보드로</Link>
      </div>
    </main>
  );
}
