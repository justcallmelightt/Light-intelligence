import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

export function AssistantMarkdown({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      urlTransform={defaultUrlTransform}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </Markdown>
  );
}
