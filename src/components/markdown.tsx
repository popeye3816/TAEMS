import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 지식베이스 본문 표시. HTML 태그는 그대로 렌더링하지 않는다(react-markdown 기본값).
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
