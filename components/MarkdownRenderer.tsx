"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

type Props = { source: string };

// AC5.2: rehype-sanitize strips dangerous HTML (script tags, event handlers, etc.).
// The `prose` class from @tailwindcss/typography provides readable body typography.
export function MarkdownRenderer({ source }: Props) {
  return (
    <div className="prose prose-gray max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
