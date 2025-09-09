"use client";

import { Message } from "@/types";
import { cn } from "@/lib/utils";
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Image from "next/image";
import { FileText, File, ChevronRight, ChevronLeft, Info, Copy } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { renderToStaticMarkup } from 'react-dom/server';

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

interface MarkdownComponentProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface ChatMessageProps {
  message: Message;
}

const CustomCodeRenderer: Components['code'] = ({ inline, className, children, ...props }: CodeProps) => {
    return !inline ? (
      <code className={cn("text-sm font-mono", className)} {...props}>{children}</code>
    ) : (
      <code className="bg-neutral-700 px-1 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
    );
};

// Define the components for rendering Markdown to HTML
const markdownComponents: Components = {
  table: (props: MarkdownComponentProps) => (
    <table className="border-collapse text-sm table-fixed" style={{ transform: "scale(0.7)", transformOrigin: "top left" }}>
      {props.children}
    </table>
  ),
  thead: (props: MarkdownComponentProps) => (
    <thead className="border-b border-neutral-600 bg-neutral-800">
      {props.children}
    </thead>
  ),
  tbody: (props: MarkdownComponentProps) => (
    <tbody className="divide-y divide-neutral-800">
      {props.children}
    </tbody>
  ),
  tr: (props: MarkdownComponentProps) => (
    <tr className="hover:bg-neutral-800/50">
      {props.children}
    </tr>
  ),
  th: (props: MarkdownComponentProps) => (
    <th className="px-4 py-3 text-left font-medium text-neutral-300 break-words w-64">
      {props.children}
    </th>
  ),
  td: (props: MarkdownComponentProps) => (
    <td className="px-4 py-3 align-top break-words w-64">
      {props.children}
    </td>
  ),
  p: (props: MarkdownComponentProps) => <p className="my-1.5">{props.children}</p>,
  pre: (props: MarkdownComponentProps) => <pre className="bg-neutral-800 p-3 rounded my-2 overflow-x-auto">{props.children}</pre>,
  code: CustomCodeRenderer,
  ul: (props: MarkdownComponentProps) => <ul className="list-disc list-outside pl-5 my-1.5">{props.children}</ul>,
  ol: (props: MarkdownComponentProps) => <ol className="list-decimal list-outside pl-5 my-1.5">{props.children}</ol>,
  li: (props: MarkdownComponentProps) => <li className="my-0.5">{props.children}</li>,
};

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === "user";
  const questionPrefix = "**Question**: ";
  const hasQuestion = message.text.includes(questionPrefix);
  const isPolicyMessage = message.sender === "bot" && message.text.includes("**Here is your generated policy**");

  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<"above" | "below">("above");
  const [copyMarkdownSuccess, setCopyMarkdownSuccess] = useState<string | boolean>(false);
  const [copyRichTextSuccess, setCopyRichTextSuccess] = useState<string | boolean>(false);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isTooltipVisible && tooltipRef.current && buttonRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const spaceAbove = buttonRect.top;
      const tooltipHeight = tooltipRect.height;
      if (spaceAbove < tooltipHeight + 8) {
        setTooltipPosition("below");
      } else {
        setTooltipPosition("above");
      }
    }
  }, [isTooltipVisible]);

  // Extract the policy content without the "Here is your generated policy" header or additional intro text
  const extractPolicyContent = () => {
    const policyMarker = "**Here is your generated policy**:\n\n";
    const index = message.text.indexOf(policyMarker);
    if (index === -1) {
      return message.text; // Fallback if marker not found
    }

    // Get the content after the marker
    const content = message.text.substring(index + policyMarker.length);

    // Look for the start of the actual policy content (e.g., a Markdown heading or meaningful content)
    const lines = content.split('\n');
    let policyStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip empty lines or lines that seem like introductory text
      // Look for the first meaningful content, like a heading (##, #) or a paragraph
      if (line && (line.startsWith('#') || !line.toLowerCase().includes("here's the filled in policy"))) {
        policyStartIndex = i;
        break;
      }
    }

    // Join the lines starting from the first meaningful content
    return lines.slice(policyStartIndex).join('\n').trim();
  };

  // Fallback method using document.execCommand for clipboard copy
  const fallbackCopyText = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful ? true : "Failed to copy using fallback method.";
    } catch (err) {
      document.body.removeChild(textArea);
      return err instanceof Error
        ? "Fallback copy failed: " + err.message
        : "Fallback copy failed: Unknown error";
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      const policyContent = extractPolicyContent();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(policyContent);
        setCopyMarkdownSuccess(true);
      } else {
        // Fallback to execCommand
        const result = fallbackCopyText(policyContent);
        setCopyMarkdownSuccess(result);
      }
      setTimeout(() => setCopyMarkdownSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy Markdown text: ", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setCopyMarkdownSuccess("Failed: " + errorMessage);
      setTimeout(() => setCopyMarkdownSuccess(false), 2000);
    }
  };

  const handleCopyRichText = async () => {
    try {
      const policyContent = extractPolicyContent();

      // Render the policy content (Markdown) to HTML
      const htmlContent = renderToStaticMarkup(
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {policyContent}
        </ReactMarkdown>
      );

      // Check if ClipboardItem is supported
      if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([policyContent], { type: 'text/plain' });

        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          }),
        ]);
        setCopyRichTextSuccess(true);
      } else {
        // Fallback: Copy as plain text
        const result = fallbackCopyText(policyContent);
        setCopyRichTextSuccess(result === true ? "Copied as plain text (rich text not supported)." : result);
      }
      setTimeout(() => setCopyRichTextSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy rich text: ", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setCopyRichTextSuccess("Failed: " + errorMessage);
      setTimeout(() => setCopyRichTextSuccess(false), 2000);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <>
          <div className="flex-shrink-0 w-7 h-7 mt-1">
            <Image src="/logo.png" alt="Maatra Bot Logo" width={28} height={28} />
          </div>
          <div className="flex-grow max-w-[95%] bg-neutral-900 rounded-lg px-4 py-2 text-neutral-100 text-sm overflow-visible">
            <div className="prose prose-sm prose-invert w-full max-w-none break-words relative">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: (props: MarkdownComponentProps) => {
                    const TableWithScrollIndicators = () => {
                      const scrollContainerRef = useRef<HTMLDivElement>(null);
                      const tableWrapperRef = useRef<HTMLDivElement>(null);
                      const [canScrollLeft, setCanScrollLeft] = useState(false);
                      const [canScrollRight, setCanScrollRight] = useState(false);
                      const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

                      useEffect(() => {
                        const checkScroll = () => {
                          const container = scrollContainerRef.current;
                          if (container) {
                            setCanScrollLeft(container.scrollLeft > 0);
                            setCanScrollRight(
                              container.scrollWidth > container.clientWidth &&
                              container.scrollLeft < container.scrollWidth - container.clientWidth
                            );
                          }
                        };

                        checkScroll();
                        const container = scrollContainerRef.current;
                        if (container) {
                          container.addEventListener('scroll', checkScroll);
                          window.addEventListener('resize', checkScroll);
                        }

                        const resizeObserver = new ResizeObserver(checkScroll);
                        if (container) {
                          resizeObserver.observe(container);
                        }

                        return () => {
                          if (container) {
                            container.removeEventListener('scroll', checkScroll);
                            window.removeEventListener('resize', checkScroll);
                            resizeObserver.disconnect();
                          }
                        };
                      }, []);

                      useEffect(() => {
                        const table = tableWrapperRef.current?.querySelector('table');
                        if (table) {
                          const wrapper = tableWrapperRef.current;
                          if (wrapper) {
                            const originalWidth = table.scrollWidth;
                            const originalHeight = table.scrollHeight;
                            const scale = 0.7;
                            wrapper.style.width = `${originalWidth * scale}px`;
                            wrapper.style.height = `${originalHeight * scale}px`;
                          }
                        }
                      }, []);

                      const stopScrolling = () => {
                        if (scrollIntervalRef.current) {
                          clearInterval(scrollIntervalRef.current);
                          scrollIntervalRef.current = null;
                        }
                      };

                      const handleScrollLeft = () => {
                        const container = scrollContainerRef.current;
                        if (container) {
                          container.scrollBy({ left: -100, behavior: "smooth" });
                        }
                      };

                      const handleScrollRight = () => {
                        const container = scrollContainerRef.current;
                        if (container) {
                          container.scrollBy({ left: 100, behavior: "smooth" });
                        }
                      };

                      const startScrollLeft = () => {
                        stopScrolling();
                        const container = scrollContainerRef.current;
                        if (container) {
                          scrollIntervalRef.current = setInterval(() => {
                            container.scrollBy({ left: -10 });
                          }, 50);
                        }
                      };

                      const startScrollRight = () => {
                        stopScrolling();
                        const container = scrollContainerRef.current;
                        if (container) {
                          scrollIntervalRef.current = setInterval(() => {
                            container.scrollBy({ left: 10 });
                          }, 50);
                        }
                      };

                      const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, direction: 'left' | 'right') => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (direction === 'left') {
                            startScrollLeft();
                          } else {
                            startScrollRight();
                          }
                        }
                      };

                      const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          stopScrolling();
                        }
                      };

                      return (
                        <div className="my-4 w-full relative">
                          {canScrollLeft && (
                            <button
                              onClick={handleScrollLeft}
                              onMouseDown={startScrollLeft}
                              onMouseUp={stopScrolling}
                              onMouseLeave={stopScrolling}
                              onKeyDown={(e) => handleKeyDown(e, 'left')}
                              onKeyUp={handleKeyUp}
                              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-neutral-800/80 p-1 rounded-r-md z-10 cursor-pointer hover:bg-neutral-700/80"
                              aria-label="Scroll table left"
                            >
                              <ChevronLeft className="w-4 h-4 text-neutral-300" />
                            </button>
                          )}
                          <div 
                            ref={scrollContainerRef}
                            className="w-full overflow-x-scroll table-scroll-container"
                          >
                            <div ref={tableWrapperRef} className="inline-block">
                              <table 
                                className="border-collapse text-sm table-fixed"
                                style={{ transform: "scale(0.7)", transformOrigin: "top left" }}
                              >
                                {props.children}
                              </table>
                            </div>
                          </div>
                          {canScrollRight && (
                            <button
                              onClick={handleScrollRight}
                              onMouseDown={startScrollRight}
                              onMouseUp={stopScrolling}
                              onMouseLeave={stopScrolling}
                              onKeyDown={(e) => handleKeyDown(e, 'right')}
                              onKeyUp={handleKeyUp}
                              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-neutral-800/80 p-1 rounded-l-md z-10 cursor-pointer hover:bg-neutral-700/80"
                              aria-label="Scroll table right"
                            >
                              <ChevronRight className="w-4 h-4 text-neutral-300" />
                            </button>
                          )}
                        </div>
                      );
                    };
                    return <TableWithScrollIndicators />;
                  },
                  thead: (props: MarkdownComponentProps) => (
                    <thead className="border-b border-neutral-600 bg-neutral-800">
                      {props.children}
                    </thead>
                  ),
                  tbody: (props: MarkdownComponentProps) => (
                    <tbody className="divide-y divide-neutral-800">
                      {props.children}
                    </tbody>
                  ),
                  tr: (props: MarkdownComponentProps) => (
                    <tr className="hover:bg-neutral-800/50">
                      {props.children}
                    </tr>
                  ),
                  th: (props: MarkdownComponentProps) => (
                    <th className="px-4 py-3 text-left font-medium text-neutral-300 break-words w-64">
                      {props.children}
                    </th>
                  ),
                  td: (props: MarkdownComponentProps) => (
                    <td className="px-4 py-3 align-top break-words w-64">
                      {props.children}
                    </td>
                  ),
                  p: (props: MarkdownComponentProps) => <p className="my-1.5">{props.children}</p>,
                  pre: (props: MarkdownComponentProps) => <pre className="bg-neutral-800 p-3 rounded my-2 overflow-x-auto">{props.children}</pre>,
                  code: CustomCodeRenderer,
                  ul: (props: MarkdownComponentProps) => <ul className="list-disc list-outside pl-5 my-1.5">{props.children}</ul>,
                  ol: (props: MarkdownComponentProps) => <ol className="list-decimal list-outside pl-5 my-1.5">{props.children}</ol>,
                  li: (props: MarkdownComponentProps) => <li className="my-0.5">{props.children}</li>,
                }}
              >
                {message.text}
              </ReactMarkdown>
              {hasQuestion && message.validAnswers && (
                <div className="mt-2 flex items-center">
                  <div className="relative inline-block">
                    <button
                      ref={buttonRef}
                      onClick={() => setIsTooltipVisible(!isTooltipVisible)}
                      className="flex items-center gap-1 px-3 py-1 rounded-full bg-accent-gold/10 hover:bg-accent-gold/20 border border-accent-gold/30 text-neutral-200 text-xs transition-colors duration-200"
                      aria-label="Show example answer"
                    >
                      <Info className="w-4 h-4 text-accent-gold/70" />
                      <span>Starter Example</span>
                    </button>
                    {isTooltipVisible && (
                      <span
                        ref={tooltipRef}
                        className={cn(
                          "absolute left-0 bg-neutral-800/90 text-neutral-300 text-xs rounded-md p-2 w-80 z-10 shadow-sm",
                          tooltipPosition === "above" ? "bottom-full mb-2" : "top-full mt-2"
                        )}
                      >
                        {message.validAnswers}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {isPolicyMessage && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleCopyRichText}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1 rounded-full border text-xs transition-colors duration-200",
                      copyRichTextSuccess === true
                        ? "bg-green-500/20 border-green-500 text-green-300"
                        : typeof copyRichTextSuccess === "string"
                        ? "bg-red-500/20 border-red-500 text-red-300"
                        : "bg-accent-gold/10 hover:bg-accent-gold/20 border-accent-gold/30 text-neutral-200"
                    )}
                    aria-label="Copy policy text as rich text"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copyRichTextSuccess === true ? "Copied!" : typeof copyRichTextSuccess === "string" ? "Failed" : "Formatted"}</span>
                  </button>
                  <button
                    onClick={handleCopyMarkdown}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1 rounded-full border text-xs transition-colors duration-200",
                      copyMarkdownSuccess === true
                        ? "bg-green-500/20 border-green-500 text-green-300"
                        : typeof copyMarkdownSuccess === "string"
                        ? "bg-red-500/20 border-red-500 text-red-300"
                        : "bg-accent-gold/10 hover:bg-accent-gold/20 border-accent-gold/30 text-neutral-200"
                    )}
                    aria-label="Copy policy text with Markdown formatting"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copyMarkdownSuccess === true ? "Copied!" : typeof copyMarkdownSuccess === "string" ? "Failed" : "Raw"}</span>
                  </button>
                  <span className="text-xs text-neutral-400">
                    (Formatted version works for Rich Text apps like Word, Google Docs)
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {isUser && (
        <>
          <div className="flex flex-col items-end max-w-[85%]">
              <div
                className={cn(
                  "w-fit",
                  "rounded-lg px-4 py-2",
                  "text-sm text-neutral-100",
                  "bg-neutral-700",
                  !message.attachment && "mb-0"
                )}
              >
                {message.text}
              </div>
              {message.attachment && (
                  <div className="mt-2 flex items-center gap-2 border border-neutral-600 rounded-lg p-2 bg-neutral-800/50 w-fit max-w-full">
                      {message.attachment.type.startsWith('text/') || message.attachment.name.toLowerCase().endsWith('.txt') ? (
                          <FileText className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                      ) : (
                          <File className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                      )}
                      <div className="flex flex-col overflow-hidden">
                          <span className="text-xs font-medium text-neutral-200 truncate">
                              {message.attachment.name}
                          </span>
                          <span className="text-xs text-neutral-500">
                              {message.attachment.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || message.attachment.name.toLowerCase().endsWith('.docx')
                                ? 'Word Document'
                                : message.attachment.type === 'text/plain' || message.attachment.name.toLowerCase().endsWith('.txt')
                                ? 'Text Document'
                                : 'Document'}
                          </span>
                      </div>
                  </div>
              )}
          </div>
        </>
      )}
    </div>
  );
}