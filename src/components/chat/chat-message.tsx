"use client";

import { ChatMessage } from "@/types/chat";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

function formatMessageContent(content: string) {
  // Simple markdown-ish formatting
  return content
    .split("\n")
    .map((line, i) => {
      // Bold
      let formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Inline code
      formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-secondary px-1 py-0.5 rounded text-xs">$1</code>');
      // Bullet points
      if (formatted.startsWith("- ") || formatted.startsWith("• ")) {
        formatted = `<span class="ml-2">• ${formatted.slice(2)}</span>`;
      }
      // Numbered lists
      const numMatch = formatted.match(/^(\d+)\.\s/);
      if (numMatch) {
        formatted = `<span class="ml-2">${formatted}</span>`;
      }
      return `<span key="${i}">${formatted}</span>`;
    })
    .join("<br/>");
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 mb-4", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary" : "bg-secondary"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-secondary-foreground" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        )}
      >
        <div
          dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }}
        />
      </div>
    </div>
  );
}
