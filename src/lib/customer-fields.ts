// 고객사 화면·폼에서 함께 쓰는 선택지와 항목 이름 (클라이언트에서도 사용)

export const LEVELS = ["상", "중", "하"] as const;
export const SUPPORT_LEVELS = ["1차", "2차"] as const;
export const REMOTE_ACCESS = ["가능", "부분", "불가"] as const;
export const PRODUCTS = ["WAS", "Jennifer", "IHS", "Liberty", "J*Link", "Cognos", "기타"] as const;
export const ENVIRONMENTS = ["운영", "개발", "기타"] as const;
export const EDITIONS = ["ND", "BASE"] as const;

export const STATUS_LABELS: Record<string, string> = { active: "진행", ended: "계약종료" };
export const ASSIGNMENT_ROLE_LABELS: Record<string, string> = { primary: "정", secondary: "부" };

export const SUPPORT_LEVEL_HINT: Record<string, string> = {
  "1차": "누가 지원해도 무관",
  "2차": "고급 엔지니어 필요",
};

// 개요 탭의 서술형 항목. 인수인계서 항목과 1:1로 대응한다.
export const NARRATIVE_FIELDS = [
  { key: "address", label: "고객사 위치" },
  { key: "visit_procedure", label: "방문 시 출입 절차" },
  { key: "support_method", label: "지원 빈도·방법 (일정 조율 방식)" },
  { key: "inspection_method", label: "정기점검 방법" },
  { key: "incident_procedure", label: "장애 발생 시 조치 절차" },
  { key: "contact_temperament", label: "고객 담당자 성향" },
  { key: "system_env_note", label: "대상 시스템 환경·구성" },
  { key: "extra_requirements", label: "계약 제품 외 추가 지원 요건" },
  { key: "site_notes", label: "사이트 특이사항·미해결 이슈" },
  { key: "notes", label: "기타 메모" },
] as const;

export type NarrativeKey = (typeof NARRATIVE_FIELDS)[number]["key"];

// 상세 화면 탭
export const CUSTOMER_TABS = [
  { key: "overview", label: "개요" },
  { key: "systems", label: "시스템·버전" },
  { key: "contacts", label: "고객 담당자" },
  { key: "engineers", label: "담당 엔지니어" },
  { key: "contracts", label: "계약" },
  { key: "access", label: "접속정보" },
  { key: "history", label: "점검이력·이슈" },
] as const;
export type CustomerTab = (typeof CUSTOMER_TABS)[number]["key"];

export function formatAmount(v: number | null | undefined) {
  return v == null ? "" : `${v.toLocaleString("ko-KR")}원`;
}
