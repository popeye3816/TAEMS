import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "기술지원 통합관리",
  description: "고객사 점검·이슈·일정·지식을 한곳에서 관리하는 사내 기술지원 시스템",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
