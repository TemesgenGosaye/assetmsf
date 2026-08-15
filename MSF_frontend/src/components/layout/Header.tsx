import { Bell, Search, Menu, Settings as SettingsIcon, Users as UsersIcon, LogOut, ShieldCheck, Sun, Moon, BarChart3, Activity, AlertCircle, CheckCircle, XCircle, Clock, Calendar, MessageSquare, Heart, Star, Zap, TrendingUp, Database, LayoutDashboard, QrCode, Package, AlertTriangle, Building2, User, Home, Megaphone, ClipboardCheck, Sunrise, ArrowRightLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { listNotifications, addNotification, markAllRead, clearAllNotifications, type Notification } from "@/services/notifications";
import { listTransfers } from "@/services/transfers";
import CommandPalette from "@/components/layout/CommandPalette";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [authUser, setAuthUser] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [globalResults, setGlobalResults] = useState<{ nav: any[]; assets: any[]; properties: any[]; users: any[]; qrcodes: any[]; tickets: any[]; approvals: any[]; transfers: any[] }>({ nav: [], assets: [], properties: [], users: [], qrcodes: [], tickets: [], approvals: [], transfers: [] });
  const [searching, setSearching] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutHint, setShortcutHint] = useState("");
  const [isDark, setIsDark] = useState(false);
  const roleLower = (authUser?.role || "").toLowerCase();
  const isAdminRole = roleLower === "admin";
  const userEmail = authUser?.email || "";
  const fullName = (authUser?.name || "").trim();
  const firstName = fullName.split(" ").filter(Boolean)[0] || null;
  const userInitials = (fullName || "User")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  
  // Generate greeting
  const hour = new Date().getHours();

  const handleSignOut = () => {
    try {
      localStorage.removeItem('django_access_token');
      localStorage.removeItem('django_refresh_token');
      localStorage.removeItem('django_user');
      localStorage.removeItem('current_user_id');
      localStorage.removeItem('auth_user');
    } catch {}
    navigate('/login', { replace: true });
  };

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    const root = document.documentElement;
    if (next) {
      root.classList.add("dark");
      try { localStorage.setItem("theme", "dark"); } catch {}
    } else {
      root.classList.remove("dark");
      try { localStorage.setItem("theme", "light"); } catch {}
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = stored ? stored === "dark" : prefersDark;
      setIsDark(dark);
      const root = document.documentElement;
      if (dark) root.classList.add("dark");
      else root.classList.remove("dark");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const navObj = typeof navigator !== "undefined" ? navigator : undefined;
      if (!navObj) return;
      const ua = (navObj.userAgent || "").toLowerCase();
      const platform = (navObj.platform || "").toLowerCase();
      const uaDataPlatform = ((navObj as any).userAgentData?.platform || "").toLowerCase();
      const platformInfo = `${platform} ${uaDataPlatform}`;

      if (ua.includes("android")) {
        setShortcutHint("");
        return;
      }

      if (/mac|iphone|ipad|ipod/.test(platformInfo) || /mac|iphone|ipad|ipod/.test(ua)) {
        setShortcutHint("⌘K");
        return;
      }

      if (/win/.test(platformInfo) || ua.includes("windows")) {
        setShortcutHint("Ctrl+K");
        return;
      }

      setShortcutHint("Ctrl+K");
    } catch {
      setShortcutHint("");
    }
  }, []);

  useEffect(() => {
    try {
      if (false) {
        const raw = sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user');
        setAuthUser(raw ? JSON.parse(raw) : null);
      } else {
        const raw = localStorage.getItem("auth_user");
        setAuthUser(raw ? JSON.parse(raw) : null);
      }
    } catch { setAuthUser(null); }
  }, []);

  // Notifications: load from service (Supabase or localStorage). In demo, seed fake ones each load.
  useEffect(() => {
    (async () => {
      try {
        // In demo, show a fixed set on every load
        if (false) {
          // If user cleared them, keep empty just for this session; after hard reload we re-seed.
          const cleared = sessionStorage.getItem('demo_notifs_cleared') === '1';
          if (!cleared) {
            // Seed 3 notifications; store to local service storage
            await clearAllNotifications();
            await addNotification({ title: 'Welcome to the SAMS Demo', message: 'Explore the app with sample data. Changes are not saved.', type: 'system' }, { silent: true });
            await addNotification({ title: 'QR generated', message: 'QR for AST-005 is ready to download.', type: 'qr' }, { silent: true });
            await addNotification({ title: 'Report ready', message: 'Monthly Asset Report has been generated.', type: 'report' }, { silent: true });
          }
        }
        const data = await listNotifications(50);
        setNotifications(data);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Realtime notification polling — refreshes every 30 seconds in the background
  useEffect(() => {
    if (false) return;
    const interval = setInterval(async () => {
      try {
        const data = await listNotifications(50);
        setNotifications(prev => {
          const prevUnread = prev.filter(n => !n.read).length;
          const newUnread = data.filter(n => !n.read).length;
          if (newUnread > prevUnread) {
            try { import('@/lib/sound').then(m => m.playNotificationSound()); } catch {}
          }
          return data;
        });
      } catch { /* ignore */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // (Removed context chips near search per request)

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount || "");

  const prefix = false ? '/demo' : '';
  const navItems = [
    { label: 'Dashboard', path: `${prefix}/` === '/demo/' ? '/demo' : '/', roles: ['admin','manager','user'] },
    { label: 'Assets', path: `${prefix}/assets`, roles: ['admin','manager','user'] },
    { label: 'Transfers', path: `${prefix}/transfers`, roles: ['admin','manager','user'] },
    { label: 'Properties', path: `${prefix}/properties`, roles: ['admin','manager','user'] },
    { label: 'House Opp', path: `${prefix}/house-opp`, roles: ['admin','manager','user'] },
    { label: 'QR Codes', path: `${prefix}/qr-codes`, roles: ['admin','manager','user'] },
    { label: 'Reports', path: `${prefix}/reports`, roles: ['admin','manager'] },
    { label: 'Users', path: `${prefix}/users`, roles: ['admin'] },
    { label: 'Settings', path: `${prefix}/settings`, roles: ['admin'] },
  ].filter(i => i.roles.includes(roleLower as any) || roleLower === '');

  // Resolve a navigation target for a notification (component scope)
  function getNotificationTarget(n: Notification): string {
    const type = (n.type || '').toLowerCase();
    const getTicketId = () => {
      const m1 = (n.title || '').match(/TCK-\d+/);
      const m2 = (n.message || '').match(/TCK-\d+/);
      return (m1?.[0] || m2?.[0]) || null;
    };
    if (type.startsWith('ticket')) {
      const id = getTicketId();
      const path = id ? `/tickets?id=${encodeURIComponent(id)}` : '/tickets';
      return false ? `/demo${path}` : path;
    }
    if (type === 'qr') {
      const m = (n.message || '').match(/\b([A-Z]+-\d+)\b/);
      const assetId = m?.[1];
      const path = assetId ? `/assets/${assetId}` : '/qr-codes';
      return assetId ? path : (false ? `/demo${path}` : path);
    }
    if (type === 'report') { return false ? '/demo/reports' : '/reports'; }
    if (type === 'system') { return false ? '/demo' : '/'; }
    if (type === 'asset') { return false ? '/demo/assets' : '/assets'; }
    if (type === 'property') { return false ? '/demo/properties' : '/properties'; }
    if (type === 'user') { return false ? '/demo/users' : '/users'; }
    if (type === 'house') { return false ? '/demo/house-opp' : '/house-opp'; }
    if (type === 'newsletter') { return false ? '/demo/newsletter' : '/newsletter'; }
    if (type === 'allocation') { return false ? '/demo/residential-hub' : '/residential-hub'; }
    if (type === 'audit') { return false ? '/demo/audit' : '/audit'; }
    if (type === 'scan') { return false ? '/demo/audit' : '/audit'; }
    if (type === 'department') { return false ? '/demo/users' : '/users'; }
    if (type === 'approval') { return false ? '/demo/approvals' : '/approvals'; }
    if (type === 'setting') { return false ? '/demo/settings' : '/settings'; }
    return isDemoMode() ? '/demo' : '/';
  }

  // Build unified list for keyboard navigation
  const unifiedResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: Array<{ key: string; label: string; sub?: string; path: string; group: string }> = [];
    // Nav: auto-match label and path (no manual keywords)
    const synonyms: Array<{ terms: string[]; label: string; path: string }> = [
      { terms: ['dashboard','home','main'], label: 'Dashboard', path: navItems.find(i=>i.label==='Dashboard')?.path || '/' },
      { terms: ['assets','asset','inventory'], label: 'Assets', path: navItems.find(i=>i.label==='Assets')?.path || '/assets' },
      { terms: ['transfers','transfer','movement','relocation'], label: 'Transfers', path: navItems.find(i=>i.label==='Transfers')?.path || '/transfers' },
      { terms: ['properties','property','location','site'], label: 'Properties', path: navItems.find(i=>i.label==='Properties')?.path || '/properties' },
      { terms: ['qr','qrcodes','qr codes','scan'], label: 'QR Codes', path: navItems.find(i=>i.label==='QR Codes')?.path || '/qr-codes' },
      { terms: ['reports','report','export'], label: 'Reports', path: navItems.find(i=>i.label==='Reports')?.path || '/reports' },
      { terms: ['users','user','accounts'], label: 'Users', path: navItems.find(i=>i.label==='Users')?.path || '/users' },
      { terms: ['settings','config','preferences'], label: 'Settings', path: navItems.find(i=>i.label==='Settings')?.path || '/settings' },
      { terms: ['tickets','ticket','maintenance'], label: 'Tickets', path: navItems.find(i=>i.label==='Tickets')?.path || '/tickets' },
      { terms: ['approvals','approval','requests'], label: 'Approvals', path: navItems.find(i=>i.label==='Approvals')?.path || '/approvals' },
  ];
  // In demo mode, do not suggest Audit via synonyms
  if (!false) {
    synonyms.push({ terms: ['audit','audits'], label: 'Audit', path: navItems.find(i=>i.label==='Audit')?.path || '/audit' });
  }
  
  
    const synMatches = q
      ? synonyms.filter(s => s.terms.some(t => q.includes(t)))
      : [];
    const nav = q
      ? [
          ...navItems.filter(i => i.label.toLowerCase().includes(q) || i.path.toLowerCase().includes(q)),
          ...synMatches.map(m => ({ label: m.label, path: m.path }))
        ]
      : [];
    out.push(
      ...nav.slice(0, 6).map(i => ({ key: `nav:${i.path}` , label: i.label, sub: i.path, path: i.path, group: 'Pages' }))
    );
    // Entities (supabase only)
    const add = (arr: any[], group: string, toItem: (x:any)=>{label:string; sub?:string; path:string; key?:string}) => {
      for (const x of arr.slice(0, 5)) {
        const t = toItem(x);
        out.push({ key: t.key || `${group}:${t.path}:${t.label}`, label: t.label, sub: t.sub, path: t.path, group });
      }
    };
  add(globalResults.assets, 'Assets', (a:any) => ({ label: `${a.id} — ${a.name || ''}`.trim(), sub: `${a.type || ''} @ ${a.property || ''}${a.serial_number?` · ${a.serial_number}`:''}`.trim(), path: `${prefix}/assets/${a.id}` }));
  add(globalResults.properties, 'Properties', (p:any) => ({ label: `${p.id} — ${p.name}`.trim(), sub: `${p.type || ''} · ${p.status || ''}`.trim(), path: `${prefix}/properties` }));
  add(globalResults.users, 'Users', (u:any) => ({ label: u.name || u.email, sub: `${u.email} · ${u.role}${u.department ? ' · ' + u.department : ''}`, path: `${prefix}/users` }));
  add(globalResults.qrcodes, 'QR Codes', (q:any) => ({ label: q.id, sub: `${q.asset_id || q.assetId || ''} · ${q.property || ''}`, path: `${prefix}/qr-codes` }));
  add(globalResults.tickets, 'Tickets', (t:any) => ({ label: `${t.id} — ${t.title || ''}`.trim(), sub: `${t.status || ''}${t.assignee?` · ${t.assignee}`:''}${t.created_by?` · ${t.created_by}`:''}`, path: `${prefix}/tickets` }));
   add(globalResults.approvals, 'Approvals', (a:any) => ({ label: `${a.id} — ${a.asset_id || ''}`.trim(), sub: `${a.status || ''}${a.department?` · ${a.department}`:''}`, path: `${prefix}/approvals` }));
   add(globalResults.transfers, 'Transfers', (t:any) => ({ label: `${t.transfer_code || t.id} — ${t.asset_code || ''}`.trim(), sub: `${t.status || ''} · ${t.reason || ''}`.trim(), path: `${prefix}/transfers` }));
    return out;
  }, [search, navItems, globalResults, prefix]);

  const goTo = (path: string) => {
    setSearch("");
    setSearchOpen(false);
    setHighlight(0);
  navigate(path);
  };

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const iconBase = isMobile
    ? (isAdminRole ? "relative h-10 w-10 rounded-full bg-muted/70 p-0 shadow-sm" : "h-8 w-8 rounded-full bg-muted/70 p-0 shadow-sm")
    : (isAdminRole ? "relative h-10 w-10 p-0" : "h-8 w-8 p-0");

  const notificationsDropdown = (
    <DropdownMenu
      onOpenChange={async (open) => {
        setNotifOpen(open);
        if (open) {
          await markAllRead();
          const data = await listNotifications(50);
          setNotifications(data);
        }
      }}
    >
       <DropdownMenuTrigger asChild>
         <button
           aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
           className={cn(
             "relative flex items-center justify-center rounded-xl transition-all duration-200 outline-none",
             "border border-transparent bg-transparent",
             "hover:border-border/60 hover:bg-muted/60 hover:shadow-sm",
             "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1",
             isMobile ? "h-9 w-9" : "h-8 w-8"
           )}
         >
           {/* Bell icon — always consistent */}
           <Bell
             className={cn(
               "h-[18px] w-[18px] transition-colors duration-200",
               unreadCount > 0 ? "text-foreground" : "text-muted-foreground hover:text-foreground"
             )}
             strokeWidth={1.8}
           />

           {/* Red notification badge */}
           {unreadCount > 0 && (
             <span
               aria-hidden="true"
               className={cn(
                 "absolute -top-1 -right-1 z-10",
                 "flex min-w-[18px] h-[18px] items-center justify-center",
                 "rounded-full bg-red-500 px-1",
                 "text-[10px] font-bold leading-none text-white",
                 "ring-2 ring-background shadow-sm",
                 "animate-in zoom-in-75 duration-200"
               )}
             >
               {badgeLabel}
             </span>
           )}
         </button>
       </DropdownMenuTrigger>
       <DropdownMenuContent
         align="end"
         className="w-80 overflow-hidden rounded-xl border border-border/60 bg-popover p-0 shadow-xl"
       >
         <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-primary/5 to-muted/40 px-4 py-3">
           <div className="flex items-center gap-2">
             <Bell className="h-4 w-4 text-primary" />
             <div>
               <p className="text-sm font-semibold text-foreground">Notifications</p>
               <p className="text-xs text-muted-foreground">
                 {unreadCount ? `${unreadCount} new updates` : 'You are all caught up'}
               </p>
             </div>
           </div>
           {notifications.length > 0 && (
             <button
               onClick={async () => {
                 await clearAllNotifications();
                 setNotifications([]);
                 if (false) {
                   try { sessionStorage.setItem('demo_notifs_cleared', '1'); } catch {}
                 }
               }}
               className="flex items-center gap-1 text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors"
             >
               <XCircle className="h-3 w-3" />
               Clear all
             </button>
           )}
         </div>
         <div className="max-h-80 overflow-y-auto p-2">
           {notifications.length === 0 ? (
             <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-6 text-center">
               <Bell className="h-8 w-8 text-muted-foreground/50" />
               <span className="text-sm font-medium text-muted-foreground">No notifications</span>
               <span className="text-xs text-muted-foreground">Updates will appear here as you work.</span>
             </div>
           ) : (
             notifications.slice(0, 12).map((n) => {
               const to = getNotificationTarget(n);
               const isUnread = !n.read;
               const typeLabel = (n.type || '').replace(/_/g, ' ');
               
               // Icon mapping for notification types
                const getNotificationIcon = () => {
                  const t = n.type?.toLowerCase() || '';
                  if (t.startsWith('ticket')) return <Calendar className="h-4 w-4 text-amber-500" />;
                  if (t === 'qr' || t === 'qr_code') return <QrCode className="h-4 w-4 text-emerald-500" />;
                  if (t === 'report') return <BarChart3 className="h-4 w-4 text-purple-500" />;
                  if (t === 'system') return <SettingsIcon className="h-4 w-4 text-slate-500" />;
                  if (t === 'approval') return <CheckCircle className="h-4 w-4 text-green-500" />;
                  if (t === 'asset') return <Package className="h-4 w-4 text-blue-500" />;
                  if (t === 'property') return <Building2 className="h-4 w-4 text-indigo-500" />;
                  if (t === 'user') return <User className="h-4 w-4 text-cyan-500" />;
                  if (t === 'house') return <Home className="h-4 w-4 text-orange-500" />;
                  if (t === 'newsletter') return <Megaphone className="h-4 w-4 text-pink-500" />;
                  if (t === 'allocation') return <Users className="h-4 w-4 text-teal-500" />;
                  if (t === 'audit') return <ClipboardCheck className="h-4 w-4 text-red-500" />;
                  if (t === 'scan') return <QrCode className="h-4 w-4 text-lime-500" />;
                  if (t === 'department') return <Building2 className="h-4 w-4 text-fuchsia-500" />;
                  if (t === 'setting') return <SettingsIcon className="h-4 w-4 text-gray-500" />;
                  return <Activity className="h-4 w-4 text-primary" />;
                };
               
               return (
                 <DropdownMenuItem
                   key={n.id}
                   className="group mx-1 my-1 rounded-lg px-0 py-0 focus:bg-transparent"
                 >
                   <Link
                     to={to}
                     className="flex w-full items-start gap-3 rounded-lg px-3 py-3 transition-all hover:bg-muted/70 group-hover:scale-[1.01]"
                     onClick={() => setNotifOpen(false)}
                   >
                     <div className="mt-0.5 flex-shrink-0">
                       <div className={`flex h-6 w-6 items-center justify-center rounded-full ${isUnread ? 'bg-primary/10' : 'bg-muted/50'}`}>
                         {getNotificationIcon()}
                       </div>
                     </div>
                     <div className="flex flex-1 flex-col gap-1">
                       <div className="flex items-center justify-between gap-2">
                         <p className="line-clamp-2 text-sm font-semibold text-foreground">
                           {n.title || typeLabel || 'Notification'}
                         </p>
                         <span className="whitespace-nowrap text-xs text-muted-foreground">
                           {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                         </span>
                       </div>
                       {n.message && (
                         <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                           {n.message}
                         </p>
                       )}
                       {typeLabel && (
                         <Badge
                           variant="outline"
                           className="w-fit border-primary/40 bg-primary/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"
                         >
                           {typeLabel}
                         </Badge>
                       )}
                     </div>
                   </Link>
                 </DropdownMenuItem>
               );
             })
           )}
         </div>
       </DropdownMenuContent>
    </DropdownMenu>
  );

  const triggerAvatar = (
    <Avatar className="h-full w-full">
      <AvatarImage src="/placeholder-avatar.jpg" />
      <AvatarFallback className="bg-primary text-primary-foreground">
        {userInitials}
      </AvatarFallback>
    </Avatar>
  );

  const decoratedTriggerAvatar = isAdminRole ? (
    <span className="relative flex h-full w-full items-center justify-center">
      <span
        className="relative flex h-full w-full items-center justify-center rounded-full bg-primary p-1 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-shadow dark:shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
      >
        <span className="flex h-full w-full items-center justify-center rounded-full bg-background p-[2px]">
          {triggerAvatar}
        </span>
      </span>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-background">
        <ShieldCheck className="h-2.5 w-2.5" />
      </span>
    </span>
  ) : (
    triggerAvatar
  );

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("rounded-full p-0 overflow-visible", iconBase)}>
          {decoratedTriggerAvatar}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 overflow-hidden rounded-xl border border-border/60 bg-popover p-0 shadow-xl"
      >
        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/40 px-4 py-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src="/placeholder-avatar.jpg" />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {authUser?.name || "Guest User"}
            </p>
            {userEmail && (
              <p className="max-w-[12rem] truncate text-xs text-muted-foreground">
                {userEmail}
              </p>
            )}
            {roleLower && !false && (
              <Badge
                variant="outline"
                className="border-primary/40 bg-primary/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"
              >
                {roleLower}
              </Badge>
            )}
          </div>
        </div>
        <div className="py-2">
          <DropdownMenuItem
            onClick={() => navigate(false ? '/demo/profile' : '/profile')}
            className="mx-2 flex items-center gap-2 rounded-lg px-3 py-2"
          >
            <UsersIcon className="h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => navigate(false ? '/demo/settings' : '/settings')}
            className="mx-2 flex items-center gap-2 rounded-lg px-3 py-2"
          >
            <SettingsIcon className="h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          {isAdminRole && (
            <>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem
                onClick={() => navigate(false ? '/demo/users' : '/users')}
                className="mx-2 flex items-center gap-2 rounded-lg px-3 py-2"
              >
                <UsersIcon className="h-4 w-4" />
                <span>User Management</span>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator className="my-2" />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="mx-2 flex items-center gap-2 rounded-lg px-3 py-2 text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
       <header className="app-header h-14 md:h-16 border-b border-border/60 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 shadow-sm">
         {isMobile ? (
           <div className="relative flex h-full w-full items-center px-3">
             <div className="flex items-center gap-2">
               <button
                 aria-label="Open menu"
                 onClick={onMenuClick}
                 className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-muted/70 shadow-sm hover:shadow-md transition-all"
               >
                 <Menu className="h-5 w-5 text-primary" />
               </button>
               <button
                 type="button"
                 onClick={() => setPaletteOpen(true)}
                 className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-muted/70 text-xs text-muted-foreground shadow-sm hover:shadow-md transition-all"
               >
                 <Search className="h-4 w-4 text-primary" />
               </button>
             </div>
           <Link
              to={prefix || "/dashboard"}
             className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
             aria-label="Go to dashboard"
           >
             <div 
               className="h-8 w-32 bg-primary transition-colors shadow-lg"
               style={{
                 maskImage: 'url("/qrcodeimage.jpg")',
                 maskSize: 'contain',
                 maskRepeat: 'no-repeat',
                 maskPosition: 'center',
                 WebkitMaskImage: 'url("/qrcodeimage.jpg")',
                 WebkitMaskSize: 'contain',
                 WebkitMaskRepeat: 'no-repeat',
                 WebkitMaskPosition: 'center'
               }}
             />
           </Link>
             <div className="ml-auto flex items-center gap-1.5">
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={toggleTheme}
                 className={cn(
                   "h-9 w-9 rounded-full bg-gradient-to-br from-primary/10 to-muted/70 p-0 shadow-sm hover:shadow-md transition-all",
                   "md:h-8 md:w-8 md:rounded-md md:bg-transparent md:shadow-none"
                 )}
               >
                 {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-600" />}
               </Button>
               {notificationsDropdown}
               {userMenu}
             </div>
           </div>
         ) : (
           <div className="flex h-full items-center justify-between gap-3 px-3 md:px-6">
             <div className="flex flex-1 items-center gap-2 max-w-md">
               <button
                 aria-label="Open menu"
                 onClick={onMenuClick}
                 className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent md:hidden transition-all"
               >
                 <Menu className="h-5 w-5 text-primary" />
               </button>
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary/70" />
                  <Input
                    aria-label="Search"
                    placeholder="ፍለጋ"
                    className="h-8 pl-7 pr-8 rounded-full border border-border/60 bg-muted/60 text-sm placeholder:text-muted-foreground/70 shadow-sm transition-colors hover:bg-muted/70 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    readOnly
                    onFocus={() => setPaletteOpen(true)}
                    onClick={() => setPaletteOpen(true)}
                  />
                  {shortcutHint && (
                    <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md border border-border/60 bg-muted px-1 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground">
                      {shortcutHint}
                    </span>
                  )}
                </div>
             </div>
              <div className="flex items-center gap-2 md:gap-3">

                {/* ── Greeting ── */}
                {fullName && (
                  <div className={cn(
                    "hidden sm:flex items-center gap-3 rounded-full px-3 py-1.5 transition-all duration-300",
                    "border border-border/60 bg-background/80 backdrop-blur-sm shadow-sm",
                    "hover:border-border hover:shadow-md hover:bg-card"
                  )}>
                    {/* Live status dot */}
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className={cn(
                        "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                        hour < 12 ? "bg-amber-400" : hour < 18 ? "bg-emerald-400" : "bg-violet-400"
                      )} />
                      <span className={cn(
                        "relative inline-flex h-2 w-2 rounded-full",
                        hour < 12 ? "bg-amber-400" : hour < 18 ? "bg-emerald-400" : "bg-violet-400"
                      )} />
                    </span>

                    {/* Greeting text */}
                    <span className="flex items-center gap-1.5 leading-none px-1">
                      <span className="text-xs font-semibold text-muted-foreground/90 tracking-normal font-sans">
                        {hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening"}
                      </span>
                      <span className="text-muted-foreground/40 font-light">•</span>
                      <span className="text-xs font-semibold text-foreground tracking-normal font-sans">
                        {firstName || fullName || "Administrator"}
                      </span>
                    </span>
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className="h-8 w-8 p-0 rounded-full transition-all hover:bg-muted/70"
                >
                  {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-500" />}
                </Button>
                {notificationsDropdown}
                {userMenu}
              </div>
           </div>
         )}
         {/* Command Palette */}
         <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={authUser?.role || null} />
       </header>
  );
}
