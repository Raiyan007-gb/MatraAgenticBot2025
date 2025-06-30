"use client";

import { Message } from "@/types";
import { ChatMessage } from "./ChatMessage";
import Image from "next/image";

interface ChatMessagesProps {
  messages: Message[];
  hasStartedChat: boolean;
}

export function ChatMessages({ messages, hasStartedChat }: ChatMessagesProps) {
  if (!hasStartedChat) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-neutral-400 px-4">
        <div className="mb-6">
          <Image
            src="/logo.png"
            alt="Maatra Frontend Logo"
            width={80}
            height={80}
            priority
          />
        </div>
        <h1 className="text-2xl font-medium text-accent-gold mb-2">
          How can I help you today?
        </h1>
      </div>
    );
  }

  // Message list container
  return (
    <div className="space-y-4 w-full">
      {messages.map((msg) => (
        <div key={msg.id}>
          {/* Show "Typing..." animation for bot messages with empty text */}
          {msg.sender === "bot" && !msg.text ? (
            <div className="flex items-start gap-3 w-full">
              <div className="flex-shrink-0 w-7 h-7 mt-1">
                <Image src="/logo.png" alt="Maatra Bot Logo" width={28} height={28} />
              </div>
              <div className="flex-grow max-w-[95%] bg-neutral-900 rounded-lg px-4 py-2 text-neutral-100 text-sm">
                <div className="flex items-center space-x-2">
                  {/* <span className="text-neutral-400">Typing</span> */}
                  <div className="flex space-x-1">
                    <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ChatMessage message={msg} />
          )}
        </div>
      ))}
    </div>
  );
}