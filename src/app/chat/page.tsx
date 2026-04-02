"use client";

import { ChatPanel } from "@/components/chat/chat-panel";

export default function ChatPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-foreground">AI Financial Advisor</h1>
        <p className="text-sm text-muted-foreground">
          Chat with Claude about your finances, get advice, and plan payments
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <ChatPanel />
      </div>
    </div>
  );
}
