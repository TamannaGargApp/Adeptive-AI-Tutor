import { Children, isValidElement } from "react";
import ReactMarkdown from "react-markdown";

import { isRunnable } from "@/lib/codeRunner";

import RunnableCode from "./RunnableCode";

/** Code blocks in a language the browser can run get a Run button; other code is shown as-is. */
function CodeBlock({ children }: { children: React.ReactNode }) {
  const child = Children.toArray(children)[0];
  if (isValidElement<{ className?: string; children?: React.ReactNode }>(child)) {
    const language = /language-(\w+)/.exec(child.props.className ?? "")?.[1];
    const code = String(Children.toArray(child.props.children).join("")).replace(/\n$/, "");
    if (isRunnable(language)) return <RunnableCode code={code} language={language} />;
  }
  return (
    <pre className="overflow-x-auto rounded-lg bg-code px-4 py-3 font-mono text-sm leading-relaxed text-code-fg">
      {children}
    </pre>
  );
}

/** Renders tutor replies. Raw HTML is not rendered, which keeps AI output from injecting markup. */
export default function Markdown({ content }: { content: string }) {
  return (
    <div className="space-y-3 [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc">
      <ReactMarkdown
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
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