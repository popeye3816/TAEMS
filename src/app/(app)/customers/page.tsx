import { PageHeader, ComingSoon } from "@/components/page-header";
import { Guarded } from "@/components/guarded";

export default function Page() {
  return (
    <>
      <PageHeader title="고객사" description="고객사별 시스템·담당자·계약·점검이력을 한곳에서 봅니다." />
      <Guarded href="/customers">
        <ComingSoon milestone="M2" items={["고객사 목록·검색·필터", "고객사 상세 (시스템·담당자·계약·점검이력·이슈·접속정보)", "기존 엑셀 데이터 가져오기"]} />
      </Guarded>
    </>
  );
}
