import { Suspense } from "react";
import { LoginForm } from "./login-form";

const NOTICES: Record<string, string> = {
  inactive: "비활성화된 계정입니다. 관리자에게 문의하세요.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold text-blue-700">UniPoint</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">기술지원 통합관리</h1>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Suspense fallback={<div className="h-56" />}>
            <LoginFormWithParams searchParams={searchParams} />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          계정이 없으면 관리자에게 요청하세요.
        </p>
      </div>
    </main>
  );
}

async function LoginFormWithParams({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const error = typeof params.error === "string" ? NOTICES[params.error] : undefined;
  return <LoginForm next={next} notice={error} />;
}
