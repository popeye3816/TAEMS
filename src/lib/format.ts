// 날짜·시간은 항상 한국 시간으로 보여준다 (서버는 UTC로 동작)
const dateTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  const parts = Object.fromEntries(dateTime.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

// <input type="datetime-local"> 값(시간대 없음)을 한국 시간으로 해석한다
export function kstInputToIso(value: string) {
  return new Date(`${value.length === 16 ? `${value}:00` : value}+09:00`).toISOString();
}

// 오늘 날짜 (한국 기준, YYYY-MM-DD)
export function todayKst() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

// 경과시간 계산 기준 시각. 서버 컴포넌트는 요청마다 한 번 렌더링되므로 요청 시각으로 쓴다.
export function requestTime() {
  return Date.now();
}
