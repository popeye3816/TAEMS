"use client";

import { useEffect } from "react";
import { recordKbView } from "./actions";

// 실제로 문서를 연 경우에만 조회수를 올린다 (미리 불러오기는 제외)
export function ViewRecorder({ id }: { id: string }) {
  useEffect(() => {
    recordKbView(id).catch(() => {});
  }, [id]);
  return null;
}
