import { PageHeader, ComingSoon } from "@/components/page-header";
import { Guarded } from "@/components/guarded";

export default function Page() {
  return (
    <>
      <PageHeader title="업무량" description="엔지니어별 담당 고객사·점검·이슈 현황을 봅니다." />
      <Guarded href="/workload">
        <ComingSoon milestone="M6" items={["엔지니어 × 월 점검/이슈 히트맵", "평균 처리시간", "피크월 경고"]} />
      </Guarded>
    </>
  );
}
