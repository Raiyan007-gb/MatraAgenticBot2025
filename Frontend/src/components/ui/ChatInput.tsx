"use client";

import { useEffect, useRef, useCallback, useState, ChangeEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowUpIcon, Paperclip, FileText, XCircle, File } from "lucide-react";

// Hook for auto-resizing textarea
interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (reset || !textarea.value) {
        textarea.style.height = `${minHeight}px`;
        textarea.style.overflowY = "hidden";
        return;
      }
      textarea.style.height = "auto";
      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      );
      textarea.style.height = `${newHeight}px`;
      if (maxHeight && newHeight >= maxHeight) {
        textarea.style.overflowY = "auto";
      } else {
        textarea.style.overflowY = "hidden";
      }
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    adjustHeight(!textareaRef.current?.value);
  }, [adjustHeight, minHeight, maxHeight]);
  useEffect(() => {
    const handleResize = () => adjustHeight(!textareaRef.current?.value);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

// ChatInputProps Interface
interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (attachedFile?: File | null, simulatedMessage?: string) => void;
  minHeight?: number;
  maxHeight?: number;
  disabled?: boolean;
  isPolicyMode: boolean;
  canGeneratePDF: boolean;
  onGeneratePDF: () => void;
}

// ChatInput Component
export function ChatInput({
  value,
  onChange,
  onSend,
  minHeight = 35,
  maxHeight = 200,
  disabled = false,
  isPolicyMode,
  canGeneratePDF,
  onGeneratePDF,
}: ChatInputProps) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight, maxHeight });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Focus textarea on mount
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  // Effect to adjust height based on external value changes or disabled state
  useEffect(() => {
    adjustHeight(disabled || !value);
  }, [value, adjustHeight, disabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() || selectedFile) {
        onSend(selectedFile);
        setSelectedFile(null);
        // Refocus textarea after sending
        setTimeout(() => {
          if (!disabled && textareaRef.current) {
            textareaRef.current.focus();
          }
        }, 0);
      }
    }
  };

  const handleSendClick = () => {
    if (disabled) return;
    if (value.trim() || selectedFile) {
      onSend(selectedFile);
      setSelectedFile(null);
      // Refocus textarea after sending
      setTimeout(() => {
        if (!disabled && textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  // File Handling Logic
  const handleAttachClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = [
        "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/pdf",
        "image/png", // Added PNG support
      ];
      const fileNameLower = file.name.toLowerCase();
      const isDocx = fileNameLower.endsWith(".docx");
      const isPdf = fileNameLower.endsWith(".pdf");
      const isTxt = fileNameLower.endsWith(".txt");
      const isPng = fileNameLower.endsWith(".png");

      if (allowedTypes.includes(file.type) || isDocx || isPdf || isTxt || isPng) {
        setSelectedFile(file);
        // Refocus textarea after file selection
        setTimeout(() => {
          if (!disabled && textareaRef.current) {
            textareaRef.current.focus();
          }
        }, 0);
      } else {
        alert("Invalid file type. Please select a .txt, .docx, .pdf, or .png file.");
        setSelectedFile(null);
      }
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Refocus textarea after removing file
    setTimeout(() => {
      if (!disabled && textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  };

  // Build Policy Toggle Handler
  const handlePolicyToggle = () => {
    if (disabled) return;
    const simulatedMessage = isPolicyMode ? "exit" : "build policy";
    onSend(null, simulatedMessage);
    // Refocus textarea after toggling policy mode
    setTimeout(() => {
      if (!disabled && textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  };

  // JSX Return
  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      <div
        className={cn(
          "relative flex flex-col bg-neutral-900 rounded-xl border border-accent-gold/20 overflow-hidden",
          disabled && "opacity-70 cursor-not-allowed"
        )}
      >
        {/* Display Selected File Info */}
        {selectedFile && !disabled && (
          <div className="flex items-center justify-between p-2 px-4 border-b border-neutral-800 text-xs text-neutral-400 bg-neutral-800/30">
            <span className="truncate mr-2 flex-grow">
              Attached: {selectedFile.name}
            </span>
            <button
              onClick={handleRemoveFile}
              className="p-1 rounded-full hover:bg-neutral-700 flex-shrink-0"
              aria-label="Remove attached file"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Textarea Area */}
        <div>
          <Textarea
            ref={textareaRef}
            value={value}
            rows={1}
            onChange={(e) => {
              if (!disabled) {
                onChange(e.target.value);
                adjustHeight();
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? "Waiting for response..."
                : selectedFile
                ? "Add a message or send file..."
                : "Ask a question..."
            }
            disabled={disabled}
            className={cn(
              "w-full pl-4 pr-4 py-3",
              "resize-none",
              "bg-transparent",
              "border-none",
              "text-white text-sm",
              "focus:outline-none focus-visible:outline-none",
              "placeholder:text-neutral-500 placeholder:text-sm",
              `min-h-[${minHeight}px]`,
              "disabled:cursor-not-allowed"
            )}
            style={{ height: `${minHeight}px`, overflowY: "hidden" }}
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".txt,.docx,.pdf,.png,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,image/png" // Added PNG support
            className="hidden"
            disabled={disabled}
          />
        </div>

        {/* Buttons Section */}
        <div className="flex items-center justify-between p-2 border-t border-neutral-800 mt-auto">
          {/* Left buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={disabled}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-400"
              aria-label="Attach file"
            >
              <Paperclip className="w-4 h-4" />
              <span className="sr-only">Attach</span>
            </button>
            {/* <button
              type="button"
              onClick={onGeneratePDF}
              disabled={disabled || !canGeneratePDF}
              className={cn(
                "px-2 py-1 rounded-lg text-sm transition-colors border flex items-center justify-between gap-1",
                canGeneratePDF
                  ? "text-white border-accent-gold bg-accent-gold/20 hover:bg-accent-gold/30 animate-pulse shadow-[0_0_10px_2px_rgba(202,167,47,0.7)]"
                  : "text-neutral-400 border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800",
                (disabled || !canGeneratePDF) && "opacity-50 cursor-not-allowed hover:bg-transparent hover:border-neutral-700"
              )}
              aria-label="Generate PDF"
            >
              <File className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">{canGeneratePDF ? "Generate PDF" : "Generate PDF"}</span>
            </button> */}
            {/* Build Policy Toggle Button */}
            <button
              type="button"
              onClick={handlePolicyToggle}
              disabled={disabled}
              className={cn(
                "px-2 py-1 rounded-lg text-sm transition-colors flex items-center justify-between gap-1",
                isPolicyMode
                  ? "bg-accent-gold text-black border border-accent-gold animate-pulse shadow-[0_0_10px_2px_rgba(202,167,47,0.7)]"
                  : "text-neutral-400 border border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800",
                disabled &&
                  "opacity-50 cursor-not-allowed hover:bg-transparent hover:border-neutral-700"
              )}
              aria-label={isPolicyMode ? "Exit policy mode" : "Enter policy mode"}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">
                {isPolicyMode ? "Exit Policy" : "Build Policy"}
              </span>
            </button>
            <button
              type="button"
              onClick={onGeneratePDF}
              disabled={disabled || !canGeneratePDF}
              className={cn(
                "px-2 py-1 rounded-lg text-sm transition-colors border flex items-center justify-between gap-1",
                canGeneratePDF
                  ? "text-white border-accent-gold bg-accent-gold/20 hover:bg-accent-gold/30 animate-pulse shadow-[0_0_10px_2px_rgba(202,167,47,0.7)]"
                  : "text-neutral-400 border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800",
                (disabled || !canGeneratePDF) && "opacity-50 cursor-not-allowed hover:bg-transparent hover:border-neutral-700"
              )}
              aria-label="Generate PDF"
            >
              <File className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">{canGeneratePDF ? "Create PDF" : "Create PDF"}</span>
            </button>
          </div>
          {/* Send Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendClick}
              disabled={disabled || (!value.trim() && !selectedFile)}
              className={cn(
                "p-1.5 rounded-lg flex items-center justify-center transition-all duration-200 ease-in-out",
                !disabled && (value.trim() || selectedFile)
                  ? "bg-white text-accent-gold hover:bg-neutral-200"
                  : "bg-neutral-800 text-neutral-600 cursor-not-allowed",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              aria-label="Send message"
            >
              <ArrowUpIcon className="w-4 h-4" />
              <span className="sr-only">Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}