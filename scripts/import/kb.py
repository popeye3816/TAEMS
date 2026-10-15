"""
지식베이스 초기 자료를 JSON으로 만든다. (적재는 scripts/import/kb-load.mjs)

  python scripts/import/kb.py

원본
  - 문제 해결 사례 엑셀 (Trouble Shooting Cases)
  - 기술지원_업체정보/_공통/*.md 가이드 (일정 문서·이전 버전 SOP 제외)

민감정보 가림: 사설 IP(10.x, 172.16~31.x, 192.168.x), 휴대전화 번호, password=값
결과: .import/kb.json, .import/kb-검토.md
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import openpyxl

sys.stdout.reconfigure(encoding="utf-8")

CASES_XLSX = Path(r"C:\work\doc\기술지원문서_표준화_쳬계화 관련\Trouble Shooting Cases V0.1(이충호).xlsx")
GUIDE_DIR = Path(r"C:\work\doc\기술지원_업체정보\_공통")
OUT = Path(".import")

# 시스템이 대신하는 일정 문서와, 최신판(v1.3)이 있는 이전 SOP는 가져오지 않는다
SKIP = {
    "정기점검_일정_마스터.md",
    "정기점검_실제날짜_분석.md",
    "제니퍼_패치_SOP_v1.0.md",
    "제니퍼_패치_SOP_v1.1.md",
    "제니퍼_패치_SOP_v1.2.md",
}

PRIVATE_IP = re.compile(
    r"\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b"
)
PHONE = re.compile(r"\b01[016789]-?\d{3,4}-?\d{4}\b")
SECRET = re.compile(r"(?i)(\w*(?:password|passwd|pwd)\w*|비밀번호|패스워드)(\s*[:=]\s*)(\S+)")


def mask(text: str | None) -> tuple[str | None, list[str]]:
    if not text:
        return text, []
    found = []
    if PRIVATE_IP.search(text):
        found.append(f"사설 IP {len(set(PRIVATE_IP.findall(text)))}개")
        text = PRIVATE_IP.sub("<IP>", text)
    if PHONE.search(text):
        found.append(f"전화번호 {len(set(PHONE.findall(text)))}개")
        text = PHONE.sub("010-****-****", text)
    if SECRET.search(text):
        found.append(f"비밀번호 값 {len(SECRET.findall(text))}개")
        text = SECRET.sub(lambda m: f"{m.group(1)}{m.group(2)}****", text)
    return text, found


def category_for(name: str) -> str:
    n = name.lower()
    if "제니퍼" in name or "jennifer" in n or "apm" in n:
        return "APM"
    if "selinux" in n or n.startswith("os"):
        return "OS"
    if "was" in n or "websphere" in n or "웹스피어" in name or "점검" in name:
        return "WAS"
    return "기타"


def cases() -> list[dict]:
    ws = openpyxl.load_workbook(CASES_XLSX, data_only=True).worksheets[0]
    out = []
    for r in ws.iter_rows(min_row=4, values_only=True):
        no, kind, product, date, author, customer, problem, body, env, attach, etc = (
            (str(v).strip() if v is not None else "") for v in r[1:12]
        )
        if not no.isdigit() or not problem:
            continue
        body_m, found = mask(body)
        is_guide = customer == "내부" and len(body) > 200  # 사내 팁·가이드 성격
        notes = [x for x in (f"첨부(원본): {attach}" if attach else "", etc) if x]
        item = {
            "source_note": f"Trouble Shooting Cases #{no} ({date})",
            "kind": "guide" if is_guide else "case",
            "title": problem if len(problem) > 8 else f"{product} {problem}".strip(),
            "category": {"WAS": "WAS", "APM": "APM", "OS": "OS"}.get(kind, "기타"),
            "product": product or None,
            "environment": env or None,
            "tags": [t for t in (kind, product.split()[0] if product else "") if t],
            "author_name": author or None,
            "customer_name": None if customer == "내부" else customer,
            "masked": found,
        }
        if is_guide:
            item["content"] = "\n\n".join([body_m or "", *notes])
            item["status"] = "published"
        else:
            item["symptom"] = problem
            item["solution"] = body_m or None
            item["content"] = "\n\n".join(notes) or None
            # 해결 내용이 없는 사례는 초안으로 둔다
            item["status"] = "published" if body_m else "draft"
        out.append(item)
    return out


def guides() -> list[dict]:
    out = []
    for f in sorted(GUIDE_DIR.glob("*.md")):
        if f.name in SKIP:
            continue
        text = f.read_text(encoding="utf-8", errors="replace")
        title = next((l.lstrip("#").strip() for l in text.splitlines() if l.startswith("#")), f.stem)
        body, found = mask(text)
        out.append({
            "source_note": f"_공통/{f.name}",
            "kind": "guide",
            "status": "published",
            "title": title,
            "category": category_for(f.name + title),
            "product": None,
            "environment": None,
            "tags": [w for w in re.findall(r"SOP|PVU|로그|패치|세션|클러스터|점검|설정", f.stem)][:5],
            "content": body,
            "author_name": None,
            "customer_name": None,
            "masked": found,
        })
    return out


def main():
    items = cases() + guides()
    OUT.mkdir(exist_ok=True)
    (OUT / "kb.json").write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = ["# 지식베이스 가져오기 검토", "", "| 출처 | 제목 | 종류 | 상태 | 가린 정보 |", "|---|---|---|---|---|"]
    for i in items:
        lines.append(f"| {i['source_note']} | {i['title'][:40]} | {i['kind']} | {i['status']} | {', '.join(i['masked'])} |")
    lines += ["", f"제외: {', '.join(sorted(SKIP))}"]
    (OUT / "kb-검토.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
