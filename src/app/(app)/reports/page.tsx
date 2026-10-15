import { PageHeader, ComingSoon } from "@/components/page-header";
import { Guarded } from "@/components/guarded";

export default function Page() {
  return (
    <>
      <PageHeader title="점검결과서" description="점검결과서 양식을 내려받고, 완성본을 올리고 내려받습니다." />
      <Guarded href="/reports">
        <ComingSoon milestone="M3" items={["표준·고객사 전용 양식 다운로드", "결과서 업로드 (고객 서명본 표시)", "영업: 담당 고객사 결과서 다운로드"]} />
      </Guarded>
    </>
  );
}
