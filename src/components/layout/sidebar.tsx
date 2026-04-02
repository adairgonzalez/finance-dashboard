"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, MessageSquare, Calculator, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "AI Advisor", icon: MessageSquare },
  { href: "/recommendations", label: "Paycheck Planner", icon: Calculator },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-card border-r border-border">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
        <CreditCard className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-bold text-foreground">FinanceHub</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Demo Mode — Using sample data
        </p>
      </div>
    </div>
  );
}
