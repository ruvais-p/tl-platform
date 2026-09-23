import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type OpportunityMarkdownProps = {
  children: string;
  className?: string;
};

export function safeOpportunityUrl(url: string) {
  const value = url.trim();
  if (value.startsWith("/") || value.startsWith("#")) return value;
  try {
    const parsed = new URL(value);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? value : "";
  } catch {
    return "";
  }
}

export function OpportunityMarkdown({ children, className = "" }: OpportunityMarkdownProps) {
  return (
    <div className={`opportunity-markdown ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={safeOpportunityUrl}
        components={{
          a: ({ href = "", children: label }) => {
            const external = /^https?:\/\//i.test(href);
            return (
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
              >
                {label}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
