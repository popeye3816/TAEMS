import { PageHeader, ComingSoon } from "@/components/page-header";
import { Guarded } from "@/components/guarded";

export default function Page() {
  return (
    <>
      <PageHeader title="이슈" description="장애·문의 이슈를 접수부터 완료까지 관리합니다." />
      <Guarded href="/issues">
        <ComingSoon milestone="M4" items={["이슈 등록·배정", "접수 → 배정 → 처리중 → 완료", "완료 시 원인/조치 필수 입력"]} />
      </Guarded>
    </>
  );
}
