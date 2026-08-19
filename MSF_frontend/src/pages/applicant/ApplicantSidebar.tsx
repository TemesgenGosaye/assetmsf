import { Link, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FilePlus, Files, ClipboardList,
  User, ChevronLeft, ArrowLeftFromLine, Home, Wrench,
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
  { name: "Dashboard", href: "/applicant/dashboard", icon: LayoutDashboard },
  { name: "New Application", href: "/applicant/new", icon: FilePlus },
  { name: "My Applications", href: "/applicant/my", icon: Files },
  { name: "Application Status", href: "/applicant/status", icon: ClipboardList },
  { name: "Maintenance Request", href: "/applicant/maintenance", icon: Wrench },
  { name: "Profile", href: "/applicant/profile", icon: User },
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
          ? "bg-[#0B4F2F]/10 text-[#0B4F2F] dark:text-[#7BC29A] shadow-sm"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
        active ? "bg-[#0B4F2F] text-white dark:bg-[#7BC29A] dark:text-[#0B4F2F] shadow-sm" : "bg-transparent group-hover:bg-muted/60",
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

  return <NavLink to={item.href} end={item.href === "/applicant/dashboard"}>{inner}</NavLink>;
}

export function ApplicantSidebar({ isMobile, onNavigate, className }: Props) {
  const collapsed = false;

  return (
    <aside className={cn(
      "flex h-full flex-col border-r border-border/40 bg-card",
      className,
    )}>
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-border/30 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B4F2F] to-[#0E5A37] shadow-md">
          <Home className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight text-foreground">EAMS</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-[#0B4F2F]/70 dark:text-[#7BC29A]/70">Applicant</span>
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
