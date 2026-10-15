// 점검 주기 정의와, 엑셀의 점검시기 문구("매월", "분기 (2,5,11)", "1,4,7,10 월" 등)를 주기로 바꾸는 해석기.
// 외부 의존성이 없어야 한다. scripts/import/plans.ts에서도 그대로 불러 쓴다.

export const CYCLES = ["monthly", "bimonthly", "quarterly", "half", "yearly", "percall"] as const;
export type Cycle = (typeof CYCLES)[number];

export const CYCLE_LABELS: Record<Cycle, string> = {
  monthly: "매월",
  bimonthly: "격월",
  quarterly: "분기",
  half: "반기",
  yearly: "연 1회",
  percall: "퍼콜(요청 시)",
};

export const METHODS = ["방문", "원격", "혼합"] as const;
export type Method = (typeof METHODS)[number];

export const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// 주기별 기본 점검 월
export const DEFAULT_MONTHS: Record<Cycle, number[]> = {
  monthly: ALL_MONTHS,
  bimonthly: [2, 4, 6, 8, 10, 12],
  quarterly: [3, 6, 9, 12],
  half: [6, 12],
  yearly: [12],
  percall: [],
};

export type ParsedPlan = {
  cycle: Cycle;
  months: number[];
  method: Method;
  visit_months: number[];
  needs_review: boolean;
  source_note: string;
};

export function formatMonths(months: readonly number[]) {
  if (months.length === 12) return "매월";
  return months.length ? `${months.join("·")}월` : "-";
}

export function describePlan(p: { cycle: string; months: readonly number[]; method: string; visit_months: readonly number[] }) {
  const base = p.cycle === "percall" ? CYCLE_LABELS.percall : `${CYCLE_LABELS[p.cycle as Cycle] ?? p.cycle} (${formatMonths(p.months)})`;
  const how = p.method === "혼합" ? `원격, ${formatMonths(p.visit_months)} 방문` : p.method;
  return p.cycle === "percall" ? base : `${base} · ${how}`;
}

// 고객사의 점검시기 문구를 해석한다. 점검하지 않는 고객사("X", 빈 값)는 null.
export function parseCycleNote(note: string | null | undefined, remoteAccess?: string | null): ParsedPlan | null {
  const text = (note ?? "").trim();
  const t = text.toLowerCase().replace(/\s+/g, " ");
  if (!t || /^x$/.test(t)) return null;

  const explicit = explicitMonths(t);
  // "인수인계: 월"처럼 '월'만 있으면 매월. 단 "1,4,7,10 월"의 '월'은 나열된 달을 뜻하므로 제외한다.
  const hasMonthly = t.includes("매월") || (!explicit && /(^|[\s:/(])월($|[\s/,)])/.test(t));
  const hasBimonthly = t.includes("격월");
  const hasQuarter = t.includes("분기");
  const hasHalf = t.includes("반기");
  const hasPercall = /percall|퍼콜/.test(t);

  let cycle: Cycle;
  let months: number[];
  let review = false;

  if (hasBimonthly) {
    cycle = "bimonthly";
    months = explicit ?? DEFAULT_MONTHS.bimonthly;
    review = !explicit;
  } else if (hasMonthly) {
    cycle = "monthly";
    months = ALL_MONTHS;
    review = hasPercall; // 여러 행을 합친 고객사 등
  } else if (explicit) {
    cycle = explicit.length === 2 ? "half" : explicit.length === 1 ? "yearly" : "quarterly";
    months = explicit;
  } else if (hasQuarter) {
    cycle = "quarterly";
    months = DEFAULT_MONTHS.quarterly;
    review = true; // 분기 월이 적혀 있지 않아 3·6·9·12월로 가정
  } else if (hasHalf) {
    cycle = "half";
    months = DEFAULT_MONTHS.half;
    review = true;
  } else if (hasPercall) {
    return { cycle: "percall", months: [], method: "원격", visit_months: [], needs_review: false, source_note: text };
  } else {
    return null;
  }

  // 방식: "매월 … 분기 방문"은 혼합, 문구에 원격/방문이 있으면 그대로, 없으면 원격 가능 여부로 정한다.
  let method: Method;
  let visit: number[] = [];
  const quarterVisit = /분기\s*방문/.test(t);
  if (cycle === "monthly" && quarterVisit) {
    method = "혼합";
    visit = (explicit ?? DEFAULT_MONTHS.quarterly).filter((m) => months.includes(m));
  } else if (t.includes("원격") && t.includes("방문")) {
    method = "방문";
    review = true; // "매월(원격2, 방문1)"처럼 횟수가 섞인 경우
  } else if (t.includes("원격")) {
    method = "원격";
  } else if (t.includes("방문")) {
    method = "방문";
  } else {
    method = remoteAccess === "가능" ? "원격" : "방문";
  }

  return { cycle, months, method, visit_months: visit, needs_review: review, source_note: text };
}

function explicitMonths(t: string): number[] | null {
  // "(3,6,9,12)", "1,4,7,10 월", "(2,5,11)" 처럼 숫자를 쉼표로 나열한 부분
  const m = t.match(/(\d{1,2}(?:\s*[,·]\s*\d{1,2})+)/);
  if (!m) return null;
  const list = [...new Set(m[1].split(/[,·]/).map((x) => Number(x.trim())))]
    .filter((n) => n >= 1 && n <= 12)
    .sort((a, b) => a - b);
  return list.length ? list : null;
}
