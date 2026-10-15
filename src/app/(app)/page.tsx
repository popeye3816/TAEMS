import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { ContentSkeleton } from "@/components/page-header";

const DASHBOARD_WIDGETS: Record<Role, { title: string; desc: string }[]> = {
  admin: [
    { title: "이번 달 점검 진행률", desc: "예정·완료·결과서 제출 현황" },
    { title: "결과서 미제출", desc: "점검은 끝났지만 결과서가 없는 건" },
    { title: "미배정·지연 이슈", desc: "배정 대기, 처리 기준일 초과" },
    { title: "엔지니어 업무량", desc: "이번 달 엔지니어별 점검·이슈 건수" },
  ],
  engineer: [
    { title: "이번 주 내 점검", desc: "일정과 고객사 출입·접속 정보" },
    { title: "내 진행 이슈", desc: "배정받은 이슈와 경과시간" },
    { title: "최근 지식베이스", desc: "새로 등록된 KB 문서" },
  ],
  sales: [
    { title: "이번 달 결과서", desc: "담당 고객사의 점검결과서 제출 현황과 다운로드" },
    { title: "대가 청구 대기", desc: "결과서가 올라온 고객사 목록" },
  ],
};

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">{user.name}님, 안녕하세요</h1>
        <p className="mt-1 text-sm text-slate-500">{ROLE_LABELS[user.role]} 대시보드</p>
      </div>
      {params.denied && (
        <p role="alert" className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          해당 메뉴에 접근할 권한이 없습니다.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {DASHBOARD_WIDGETS[user.role].map((w) => (
          <section key={w.title} className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">{w.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{w.desc}</p>
            <p className="mt-4 text-xs text-slate-400">데이터 연결 예정</p>
          </section>
        ))}
      </div>
    </>
  );
}
