// 지식베이스 표시용 상수 (클라이언트에서도 사용)

export const KB_CATEGORIES = ["WAS", "APM", "OS", "DB", "네트워크", "보안", "기타"] as const;
export const KB_KINDS = ["case", "guide"] as const;
export type KbKind = (typeof KB_KINDS)[number];

export const KB_KIND_LABEL: Record<KbKind, string> = { case: "문제 해결 사례", guide: "가이드" };
export const KB_STATUS_LABEL: Record<string, string> = { draft: "초안", published: "게시" };

export function parseTags(v: string | null | undefined) {
  return [...new Set((v ?? "").split(/[,#\s]+/).map((t) => t.trim()).filter(Boolean))].slice(0, 20);
}
