import { Link, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FilePlus, Files, ClipboardList,
  User, ChevronLeft, ArrowLeftFromLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";

interface Props {
  isMobile?: boolean;
  onNavigate?: () => void;
  className?: string;
}

const navItems = [
  { name: "Dashboard", href: "/requester/dashboard", icon: LayoutDashboard },
  { name: "New Application", href: "/requester/new", icon: FilePlus },
  { name: "My Applications", href: "/requester/my", icon: Files },
  { name: "Application Status", href: "/requester/status", icon: ClipboardList },
  { name: "Profile", href: "/requester/profile", icon: User },
];

function NavItem({ item, collapsed, onNavigate }: {
  item: typeof navItems[0];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  const inner = (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
        active
          ? "bg-primary/10 text-primary shadow-sm"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
        active ? "bg-primary text-primary-foreground shadow-sm" : "bg-transparent group-hover:bg-muted/60",
      )}>
        <Icon className="h-4 w-4" />
      </div>
      {!collapsed && <span>{item.name}</span>}
    </div>
  );

  if (onNavigate) {
    return (
      <SheetClose asChild onClick={onNavigate}>
        <Link to={item.href}>{inner}</Link>
      </SheetClose>
    );
  }

  return <NavLink to={item.href} end={item.href === "/requester/dashboard"}>{inner}</NavLink>;
}

export function RequesterSidebar({ isMobile, onNavigate, className }: Props) {
  const collapsed = false;

  return (
    <aside className={cn(
      "flex h-full flex-col border-r border-border/40 bg-card",
      className,
    )}>
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-border/30 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-md">
          <span className="text-sm font-bold text-primary-foreground">S</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight text-foreground">SAMS</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-primary/70">Requester</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavItem key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Back to main app */}
      <div className="border-t border-border/30 p-3">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 transition-all"
        >
          <ArrowLeftFromLine className="h-3.5 w-3.5" />
          Back to Main App
        </Link>
      </div>
    </aside>
  );
}
