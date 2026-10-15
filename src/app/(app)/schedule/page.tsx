import { PageHeader, ComingSoon } from "@/components/page-header";
import { Guarded } from "@/components/guarded";

export default function Page() {
  return (
    <>
      <PageHeader title="월별 일정" description="고객사별 점검 주기에 따라 월 점검 일정을 만들고 배정합니다." />
      <Guarded href="/schedule">
        <ComingSoon milestone="M3" items={["고객사별 점검 주기 설정", "다음 달 일정 자동 생성", "캘린더·엔지니어별 보기"]} />
      </Guarded>
    </>
  );
}
