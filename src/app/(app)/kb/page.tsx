import { PageHeader, ComingSoon } from "@/components/page-header";
import { Guarded } from "@/components/guarded";

export default function Page() {
  return (
    <>
      <PageHeader title="지식베이스" description="처리 경험을 검색 가능한 지식으로 쌓습니다." />
      <Guarded href="/kb">
        <ComingSoon milestone="M5" items={["KB 검색·작성", "완료 이슈에서 KB 초안 생성", "이슈 등록 시 유사 KB 추천"]} />
      </Guarded>
    </>
  );
}
