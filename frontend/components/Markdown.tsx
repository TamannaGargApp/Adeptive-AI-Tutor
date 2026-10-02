import ReactMarkdown from "react-markdown";

/** Renders tutor replies. Raw HTML is not rendered, which keeps AI output from injecting markup. */
export default function Markdown({ content }: { content: string }) {
  return (
    <div className="space-y-3 [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc">
      <ReactMarkdown
        components={{
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-code px-4 py-3 font-mono text-sm leading-relaxed text-code-fg">
              {children}
            </pre>
          ),
          code: ({ className, children }) =>
            className ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded bg-blue-tint px-1.5 py-0.5 font-mono text-[0.9em] text-blue-deep">{children}</code>
            ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-blue underline">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}