"use client";

import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html lang="en">
      <head>
        <title>FinanceHub — Personal Finance Dashboard</title>
        <meta name="description" content="Track credit cards, get AI advice, and plan your paycheck" />
      </head>
      <body className="font-sans antialiased">
        <div className="flex h-screen overflow-hidden">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex md:w-64 md:flex-shrink-0">
            <Sidebar />
          </aside>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <div
                className="fixed inset-0 bg-black/50"
                onClick={() => setSidebarOpen(false)}
              />
              <div className="fixed inset-y-0 left-0 w-64 z-50">
                <Sidebar onNavigate={() => setSidebarOpen(false)} />
              </div>
            </div>
          )}

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            {/* Mobile header */}
            <div className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background px-4 py-3 md:hidden">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-foreground"
              >
                {sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
              <span className="font-semibold">FinanceHub</span>
            </div>
            <div className="h-full">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
