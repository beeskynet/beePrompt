import React, { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { solarizedlight } from "react-syntax-highlighter/dist/esm/styles/prism";
import MaterialButton from "./MaterialButton";
import remarkGfm from "remark-gfm";

interface Props {
  node?: HTMLElement;
  children?: string | null;
  inline?: string;
  className?: string;
}

function Markdown({ children, className, ...props }: Props) {
  const onClick = (text: string) => () => {
    navigator.clipboard.writeText(text);
  };
  return (
    <ReactMarkdown
      className={`markdown ${className}`}
      //style={{ lineHeight: 2 }}
      rehypePlugins={[rehypeRaw]}
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          // inlineが常にundefinedになるので、改行で判定
          return String(children).indexOf("\n") !== -1 || match ? (
            <div className="relative group/nest">
              <MaterialButton
                className="absolute top-3 right-1 invisible"
                groupHoverVisible="nest"
                name="content_copy"
                onClick={onClick(String(children))}
                blur
                blurColorRga="253, 246, 227"
              />
              <SyntaxHighlighter style={solarizedlight} language={match ? match[1] : ""} PreTag="div" {...props}>
                {children}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code className={`${className} p-1`} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
export default Markdown;
