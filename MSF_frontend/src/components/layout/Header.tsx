import {
  Bell,
  Search,
  Menu,
  Settings as SettingsIcon,
  Users as UsersIcon,
  LogOut,
  ShieldCheck,
  Sun,
  Moon,
  BarChart3,
  Activity,
  CheckCircle,
  XCircle,
  Calendar,
  Megaphone,
  ClipboardCheck,
  Package,
  Building2,
  User,
  Home,
  QrCode,
  Radio,
} from "lucide-react";
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

import {
  listNotifications,
  addNotification,
  markAllRead,
  clearAllNotifications,
  type Notification,
} from "@/services/notifications";

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

  const [authUser, setAuthUser] = useState<{
    id: string;
    name: string;
    email: string;
    role?: string;
    avatar_url?: string | null;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const [globalResults, setGlobalResults] = useState<{
    nav: any[];
    assets: any[];
    properties: any[];
    users: any[];
    qrcodes: any[];
    tickets: any[];
    approvals: any[];
    transfers: any[];
  }>({
    nav: [],
    assets: [],
    properties: [],
    users: [],
    qrcodes: [],
    tickets: [],
    approvals: [],
    transfers: [],
  });

  const [searching, setSearching] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutHint, setShortcutHint] = useState("");
  const [isDark, setIsDark] = useState(false);

  // NEW: instrument-panel elevation — header gains a stronger shadow / hairline
  // once the page scrolls, like a panel edge catching light.
  const [scrolled, setScrolled] = useState(false);

  const roleLower = (authUser?.role || "").toLowerCase();
  const isAdminRole = roleLower === "admin";

  const userEmail = authUser?.email || "";
  const fullName = (authUser?.name || "").trim();

  const firstName =
    fullName.split(" ").filter(Boolean)[0] || null;

  const userInitials = (fullName || "User")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const userAvatarUrl = authUser?.avatar_url || null;

  // ============================================================
  // GREETING
  // ============================================================

  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? "Good Morning"
      : hour < 18
        ? "Good Afternoon"
        : "Good Evening";

  // ============================================================
  // SIGN OUT
  // ============================================================

  const handleSignOut = () => {
    try {
      localStorage.removeItem("django_access_token");
      localStorage.removeItem("django_refresh_token");
      localStorage.removeItem("django_user");
      localStorage.removeItem("current_user_id");
      localStorage.removeItem("auth_user");
    } catch {}

    navigate("/login", { replace: true });
  };

  // ============================================================
  // THEME
  // ============================================================

  const toggleTheme = () => {
    const next = !isDark;

    setIsDark(next);

    const root = document.documentElement;

    if (next) {
      root.classList.add("dark");

      try {
        localStorage.setItem("theme", "dark");
      } catch {}
    } else {
      root.classList.remove("dark");

      try {
        localStorage.setItem("theme", "light");
      } catch {}
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");

      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;

      const dark = stored
        ? stored === "dark"
        : prefersDark;

      setIsDark(dark);

      const root = document.documentElement;

      if (dark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    } catch {}
  }, []);

  // ============================================================
  // SCROLL ELEVATION (new)
  // ============================================================

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ============================================================
  // KEYBOARD SHORTCUT
  // ============================================================

  useEffect(() => {
    try {
      const navObj =
        typeof navigator !== "undefined"
          ? navigator
          : undefined;

      if (!navObj) return;

      const ua = (navObj.userAgent || "").toLowerCase();
      const platform = (navObj.platform || "").toLowerCase();

      const uaDataPlatform = (
        (navObj as any).userAgentData?.platform || ""
      ).toLowerCase();

      const platformInfo =
        `${platform} ${uaDataPlatform}`;

      if (ua.includes("android")) {
        setShortcutHint("");
        return;
      }

      if (
        /mac|iphone|ipad|ipod/.test(platformInfo) ||
        /mac|iphone|ipad|ipod/.test(ua)
      ) {
        setShortcutHint("⌘K");
        return;
      }

      if (
        /win/.test(platformInfo) ||
        ua.includes("windows")
      ) {
        setShortcutHint("Ctrl+K");
        return;
      }

      setShortcutHint("Ctrl+K");
    } catch {
      setShortcutHint("");
    }
  }, []);

  // ============================================================
  // AUTH USER
  // ============================================================

  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth_user");

      setAuthUser(
        raw ? JSON.parse(raw) : null
      );
    } catch {
      setAuthUser(null);
    }
  }, []);

  // ============================================================
  // AUTH USER UPDATE LISTENER
  // ============================================================

  useEffect(() => {
    const handler = () => {
      try {
        const raw =
          localStorage.getItem("auth_user");

        setAuthUser(
          raw ? JSON.parse(raw) : null
        );
      } catch {}
    };

    window.addEventListener(
      "storage",
      handler
    );

    window.addEventListener(
      "auth-user-updated",
      handler
    );

    return () => {
      window.removeEventListener(
        "storage",
        handler
      );

      window.removeEventListener(
        "auth-user-updated",
        handler
      );
    };
  }, []);

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  useEffect(() => {
    (async () => {
      try {
        if (false) {
          const cleared =
            sessionStorage.getItem(
              "demo_notifs_cleared"
            ) === "1";

          if (!cleared) {
            await clearAllNotifications();

            await addNotification(
              {
                title:
                  "Welcome to the SAMS Demo",
                message:
                  "Explore the app with sample data. Changes are not saved.",
                type: "system",
              },
              { silent: true }
            );

            await addNotification(
              {
                title: "QR generated",
                message:
                  "QR for AST-005 is ready to download.",
                type: "qr",
              },
              { silent: true }
            );

            await addNotification(
              {
                title: "Report ready",
                message:
                  "Monthly Asset Report has been generated.",
                type: "report",
              },
              { silent: true }
            );
          }
        }

        const data =
          await listNotifications(50);

        setNotifications(data);
      } catch {
        // Ignore notification errors
      }
    })();
  }, []);

  // ============================================================
  // REALTIME NOTIFICATION POLLING
  // ============================================================

  useEffect(() => {
    if (false) return;

    const interval = setInterval(
      async () => {
        try {
          const data =
            await listNotifications(50);

          setNotifications((prev) => {
            const prevUnread =
              prev.filter(
                (n) => !n.read
              ).length;

            const newUnread =
              data.filter(
                (n) => !n.read
              ).length;

            if (newUnread > prevUnread) {
              try {
                import("@/lib/sound").then(
                  (m) =>
                    m.playNotificationSound()
                );
              } catch {}
            }

            return data;
          });
        } catch {
          // Ignore
        }
      },
      30_000
    );

    return () =>
      clearInterval(interval);
  }, []);

  // ============================================================
  // NOTIFICATION COUNT
  // ============================================================

  const unreadCount = useMemo(() => {
    return notifications.filter(
      (n) => !n.read
    ).length;
  }, [notifications]);

  const badgeLabel =
    unreadCount > 9
      ? "9+"
      : String(unreadCount || "");

  // ============================================================
  // PREFIX / NAVIGATION
  // ============================================================

  const prefix = false ? "/demo" : "";

  const navItems = [
    {
      label: "Dashboard",
      path:
        `${prefix}/` === "/demo/"
          ? "/demo"
          : "/",
      roles: ["admin", "manager", "user"],
    },
    {
      label: "Assets",
      path: `${prefix}/assets`,
      roles: ["admin", "manager", "user"],
    },
    {
      label: "Transfers",
      path: `${prefix}/transfers`,
      roles: ["admin", "manager", "user"],
    },
    {
      label: "Properties",
      path: `${prefix}/properties`,
      roles: ["admin", "manager", "user"],
    },
    {
      label: "House Opp",
      path: `${prefix}/house-opp`,
      roles: ["admin", "manager", "user"],
    },
    {
      label: "QR Codes",
      path: `${prefix}/qr-codes`,
      roles: ["admin", "manager", "user"],
    },
    {
      label: "Reports",
      path: `${prefix}/reports`,
      roles: ["admin", "manager"],
    },
    {
      label: "Users",
      path: `${prefix}/users`,
      roles: ["admin"],
    },
    {
      label: "Settings",
      path: `${prefix}/settings`,
      roles: ["admin"],
    },
  ].filter(
    (i) =>
      i.roles.includes(roleLower as any) ||
      roleLower === ""
  );

  // ============================================================
  // NOTIFICATION TARGET
  // ============================================================

  function getNotificationTarget(
    n: Notification
  ): string {
    const type =
      (n.type || "").toLowerCase();

    const getTicketId = () => {
      const m1 = (n.title || "").match(
        /TCK-\d+/
      );

      const m2 = (n.message || "").match(
        /TCK-\d+/
      );

      return (
        m1?.[0] ||
        m2?.[0] ||
        null
      );
    };

    if (type.startsWith("ticket")) {
      const id = getTicketId();

      const path = id
        ? `/tickets?id=${encodeURIComponent(id)}`
        : "/tickets";

      return false
        ? `/demo${path}`
        : path;
    }

    if (type === "qr") {
      const m = (
        n.message || ""
      ).match(
        /\b([A-Z]+-\d+)\b/
      );

      const assetId = m?.[1];

      const path = assetId
        ? `/assets/${assetId}`
        : "/qr-codes";

      return assetId
        ? path
        : false
          ? `/demo${path}`
          : path;
    }

    if (type === "report") {
      return false
        ? "/demo/reports"
        : "/reports";
    }

    if (type === "system") {
      return false
        ? "/demo"
        : "/";
    }

    if (type === "asset") {
      return false
        ? "/demo/assets"
        : "/assets";
    }

    if (type === "property") {
      return false
        ? "/demo/properties"
        : "/properties";
    }

    if (type === "user") {
      return false
        ? "/demo/users"
        : "/users";
    }

    if (type === "house") {
      return false
        ? "/demo/house-opp"
        : "/house-opp";
    }

    if (type === "newsletter") {
      return false
        ? "/demo/newsletter"
        : "/newsletter";
    }

    if (type === "allocation") {
      return false
        ? "/demo/residential-hub"
        : "/residential-hub";
    }

    if (type === "audit") {
      return false
        ? "/demo/audit"
        : "/audit";
    }

    if (type === "scan") {
      return false
        ? "/demo/audit"
        : "/audit";
    }

    if (type === "department") {
      return false
        ? "/demo/users"
        : "/users";
    }

    if (type === "approval") {
      return false
        ? "/demo/approvals"
        : "/approvals";
    }

    if (type === "setting") {
      return false
        ? "/demo/settings"
        : "/settings";
    }

    return false ? "/demo" : "/";
  }

  // ============================================================
  // UNIFIED SEARCH RESULTS
  // ============================================================

  const unifiedResults = useMemo(() => {
    const q =
      search.trim().toLowerCase();

    const out: Array<{
      key: string;
      label: string;
      sub?: string;
      path: string;
      group: string;
    }> = [];

    const synonyms: Array<{
      terms: string[];
      label: string;
      path: string;
    }> = [
      {
        terms: [
          "dashboard",
          "home",
          "main",
        ],
        label: "Dashboard",
        path:
          navItems.find(
            (i) =>
              i.label === "Dashboard"
          )?.path || "/",
      },
      {
        terms: [
          "assets",
          "asset",
          "inventory",
        ],
        label: "Assets",
        path:
          navItems.find(
            (i) => i.label === "Assets"
          )?.path || "/assets",
      },
      {
        terms: [
          "transfers",
          "transfer",
          "movement",
          "relocation",
        ],
        label: "Transfers",
        path:
          navItems.find(
            (i) =>
              i.label === "Transfers"
          )?.path || "/transfers",
      },
      {
        terms: [
          "properties",
          "property",
          "location",
          "site",
        ],
        label: "Properties",
        path:
          navItems.find(
            (i) =>
              i.label === "Properties"
          )?.path || "/properties",
      },
      {
        terms: [
          "qr",
          "qrcodes",
          "qr codes",
          "scan",
        ],
        label: "QR Codes",
        path:
          navItems.find(
            (i) =>
              i.label === "QR Codes"
          )?.path || "/qr-codes",
      },
      {
        terms: [
          "reports",
          "report",
          "export",
        ],
        label: "Reports",
        path:
          navItems.find(
            (i) =>
              i.label === "Reports"
          )?.path || "/reports",
      },
      {
        terms: [
          "users",
          "user",
          "accounts",
        ],
        label: "Users",
        path:
          navItems.find(
            (i) =>
              i.label === "Users"
          )?.path || "/users",
      },
      {
        terms: [
          "settings",
          "config",
          "preferences",
        ],
        label: "Settings",
        path:
          navItems.find(
            (i) =>
              i.label === "Settings"
          )?.path || "/settings",
      },
      {
        terms: [
          "tickets",
          "ticket",
          "maintenance",
        ],
        label: "Tickets",
        path:
          navItems.find(
            (i) =>
              i.label === "Tickets"
          )?.path || "/tickets",
      },
      {
        terms: [
          "approvals",
          "approval",
          "requests",
        ],
        label: "Approvals",
        path:
          navItems.find(
            (i) =>
              i.label === "Approvals"
          )?.path || "/approvals",
      },
    ];

    if (!false) {
      synonyms.push({
        terms: [
          "audit",
          "audits",
        ],
        label: "Audit",
        path:
          navItems.find(
            (i) =>
              i.label === "Audit"
          )?.path || "/audit",
      });
    }

    const synMatches = q
      ? synonyms.filter((s) =>
          s.terms.some((t) =>
            q.includes(t)
          )
        )
      : [];

    const nav = q
      ? [
          ...navItems.filter(
            (i) =>
              i.label
                .toLowerCase()
                .includes(q) ||
              i.path
                .toLowerCase()
                .includes(q)
          ),
          ...synMatches.map((m) => ({
            label: m.label,
            path: m.path,
          })),
        ]
      : [];

    out.push(
      ...nav
        .slice(0, 6)
        .map((i) => ({
          key: `nav:${i.path}`,
          label: i.label,
          sub: i.path,
          path: i.path,
          group: "Pages",
        }))
    );

    const add = (
      arr: any[],
      group: string,
      toItem: (
        x: any
      ) => {
        label: string;
        sub?: string;
        path: string;
        key?: string;
      }
    ) => {
      for (const x of arr.slice(0, 5)) {
        const t = toItem(x);

        out.push({
          key:
            t.key ||
            `${group}:${t.path}:${t.label}`,
          label: t.label,
          sub: t.sub,
          path: t.path,
          group,
        });
      }
    };

    add(
      globalResults.assets,
      "Assets",
      (a: any) => ({
        label:
          `${a.id} — ${
            a.name || ""
          }`.trim(),
        sub:
          `${a.type || ""} @ ${
            a.property || ""
          }${
            a.serial_number
              ? ` · ${a.serial_number}`
              : ""
          }`.trim(),
        path: `${prefix}/assets/${a.id}`,
      })
    );

    add(
      globalResults.properties,
      "Properties",
      (p: any) => ({
        label:
          `${p.id} — ${p.name}`.trim(),
        sub:
          `${p.type || ""} · ${
            p.status || ""
          }`.trim(),
        path: `${prefix}/properties`,
      })
    );

    add(
      globalResults.users,
      "Users",
      (u: any) => ({
        label:
          u.name || u.email,
        sub:
          `${u.email} · ${u.role}${
            u.department
              ? " · " + u.department
              : ""
          }`,
        path: `${prefix}/users`,
      })
    );

    add(
      globalResults.qrcodes,
      "QR Codes",
      (q: any) => ({
        label: q.id,
        sub:
          `${
            q.asset_id ||
            q.assetId ||
            ""
          } · ${
            q.property || ""
          }`,
        path: `${prefix}/qr-codes`,
      })
    );

    add(
      globalResults.tickets,
      "Tickets",
      (t: any) => ({
        label:
          `${t.id} — ${
            t.title || ""
          }`.trim(),
        sub:
          `${t.status || ""}${
            t.assignee
              ? ` · ${t.assignee}`
              : ""
          }${
            t.created_by
              ? ` · ${t.created_by}`
              : ""
          }`,
        path: `${prefix}/tickets`,
      })
    );

    add(
      globalResults.approvals,
      "Approvals",
      (a: any) => ({
        label:
          `${a.id} — ${
            a.asset_id || ""
          }`.trim(),
        sub:
          `${a.status || ""}${
            a.department
              ? ` · ${a.department}`
              : ""
          }`,
        path: `${prefix}/approvals`,
      })
    );

    add(
      globalResults.transfers,
      "Transfers",
      (t: any) => ({
        label:
          `${
            t.transfer_code ||
            t.id
          } — ${
            t.asset_code || ""
          }`.trim(),
        sub:
          `${
            t.status || ""
          } · ${
            t.reason || ""
          }`.trim(),
        path: `${prefix}/transfers`,
      })
    );

    return out;
  }, [
    search,
    navItems,
    globalResults,
    prefix,
  ]);

  // ============================================================
  // NAVIGATION
  // ============================================================

  const goTo = (path: string) => {
    setSearch("");
    setSearchOpen(false);
    setHighlight(0);

    navigate(path);
  };

  // ============================================================
  // COMMAND PALETTE SHORTCUT
  // ============================================================

  useEffect(() => {
    const handler = (
      e: KeyboardEvent
    ) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();

        setPaletteOpen(
          (v) => !v
        );
      }
    };

    window.addEventListener(
      "keydown",
      handler
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handler
      );
  }, []);

  // ============================================================
  // AVATAR
  // ============================================================

  const iconBase = isMobile
    ? isAdminRole
      ? "relative h-10 w-10 rounded-full bg-[#0f2942]/60 p-0 shadow-sm"
      : "h-8 w-8 rounded-full bg-[#0f2942]/60 p-0 shadow-sm"
    : isAdminRole
      ? "relative h-10 w-10 p-0"
      : "h-8 w-8 p-0";

  const triggerAvatar = (
    <Avatar className="h-full w-full">
      {userAvatarUrl && (
        <AvatarImage
          src={userAvatarUrl}
          alt={fullName}
        />
      )}

      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-800 text-white font-mono font-bold border border-blue-400/40">
        {userInitials}
      </AvatarFallback>
    </Avatar>
  );

  const decoratedTriggerAvatar =
    isAdminRole ? (
      <span className="relative flex h-full w-full items-center justify-center">
        <span
          className={cn(
            "relative flex h-full w-full items-center justify-center",
            "rounded-full p-1",
            "bg-gradient-to-br from-[#c9a227] via-[#e8c874] to-[#c9a227]",
            "shadow-[0_4px_14px_rgba(201,162,39,0.28)]",
            "transition-all duration-300",
            "group-hover:shadow-[0_6px_20px_rgba(201,162,39,0.4)]"
          )}
        >
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[#0a1f33] p-[2px]">
            {triggerAvatar}
          </span>
        </span>

        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5",
            "flex h-4 w-4 items-center justify-center",
            "rounded-full",
            "bg-gradient-to-br from-[#c9a227] to-[#a5811c]",
            "text-[#0a1f33]",
            "shadow-md",
            "ring-2 ring-[#0a1f33]"
          )}
        >
          <ShieldCheck className="h-2.5 w-2.5" strokeWidth={2.5} />
        </span>
      </span>
    ) : (
      triggerAvatar
    );

  // ============================================================
  // NOTIFICATIONS DROPDOWN
  // ============================================================

  const notificationsDropdown = (
    <DropdownMenu
      onOpenChange={async (open) => {
        setNotifOpen(open);

        if (open) {
          await markAllRead();

          const data =
            await listNotifications(50);

          setNotifications(data);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Notifications${
            unreadCount > 0
              ? ` — ${unreadCount} unread`
              : ""
          }`}
          className={cn(
            "group relative flex items-center justify-center",
            "h-9 w-9 rounded-lg",
            "border border-slate-600/60",
            "bg-slate-700/60",
            "text-slate-300",
            "transition-all duration-200",
            "hover:border-blue-500/50 hover:bg-slate-700 hover:text-blue-400",
            "focus-visible:outline-none",
            "focus-visible:ring-2",
            "focus-visible:ring-blue-400/40"
          )}
        >
          <Bell
            className={cn(
              "h-[18px] w-[18px]",
              "transition-all duration-200",
              unreadCount > 0
                ? "text-blue-400 group-hover:text-blue-300"
                : "text-slate-300 group-hover:text-blue-400"
            )}
            strokeWidth={1.8}
          />

          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute -right-1 -top-1 z-10",
                "flex min-w-[17px] h-[17px]",
                "items-center justify-center",
                "rounded-full px-1",
                "bg-red-500",
                "text-[9px] font-mono font-bold leading-none text-white",
                "ring-2 ring-slate-900",
                "shadow-sm",
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
        sideOffset={10}
        className={cn(
          "w-[350px] overflow-hidden rounded-xl p-0",
          "border border-[#1f4a6e]/70",
          "bg-slate-950/95",
          "backdrop-blur-2xl",
          "shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
          "ring-1 ring-[#c9a227]/10"
        )}
      >
        {/* NOTIFICATION HEADER */}
        <div
          className={cn(
            "flex items-center justify-between",
            "border-b border-[#1f4a6e]/60",
            "bg-gradient-to-r",
            "from-[#c9a227]/[0.08]",
            "via-[#173f63]/40",
            "to-transparent",
            "px-4 py-4"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center",
                "rounded-lg",
                "bg-[#c9a227]/10",
                "text-[#e8c874]",
                "border border-[#c9a227]/25"
              )}
            >
              <Bell className="h-4 w-4" />
            </div>

            <div>
              <p className="text-sm font-bold tracking-wide text-[#eaf2fa] font-mono uppercase text-[13px]">
                Notifications
              </p>

              <p className="mt-0.5 text-[11px] text-[#5f88ab] font-mono">
                {unreadCount
                  ? `${unreadCount} new updates`
                  : "System nominal — all clear"}
              </p>
            </div>
          </div>

          {notifications.length > 0 && (
            <button
              onClick={async () => {
                await clearAllNotifications();

                setNotifications([]);

                if (false) {
                  try {
                    sessionStorage.setItem(
                      "demo_notifs_cleared",
                      "1"
                    );
                  } catch {}
                }
              }}
              className={cn(
                "flex items-center gap-1.5",
                "rounded-lg px-2 py-1.5",
                "text-[11px] font-mono font-semibold uppercase tracking-wide",
                "text-[#e0824a]",
                "transition-colors",
                "hover:bg-[#e0824a]/10 hover:text-[#ef9a67]"
              )}
            >
              <XCircle className="h-3.5 w-3.5" />
              Clear all
            </button>
          )}
        </div>

        {/* NOTIFICATION LIST */}
        <div className="max-h-[390px] overflow-y-auto p-2">
          {notifications.length === 0 ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center",
                "gap-2 rounded-lg",
                "border border-dashed",
                "border-[#1f4a6e]/60",
                "bg-[#0e2a44]/30",
                "px-4 py-10 text-center"
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center",
                  "rounded-xl",
                  "bg-[#0e2a44] border border-[#1f4a6e]/60"
                )}
              >
                <Bell className="h-5 w-5 text-[#5f88ab]" />
              </div>

              <span className="text-sm font-semibold text-[#c3d8ea] font-mono">
                No notifications
              </span>

              <span className="max-w-[220px] text-xs leading-relaxed text-[#5f88ab]">
                Updates will appear here as you work.
              </span>
            </div>
          ) : (
            notifications
              .slice(0, 12)
              .map((n) => {
                const to =
                  getNotificationTarget(n);

                const isUnread =
                  !n.read;

                const typeLabel =
                  (n.type || "")
                    .replace(/_/g, " ");

                const getNotificationIcon =
                  () => {
                    const t =
                      n.type?.toLowerCase() ||
                      "";

                    if (
                      t.startsWith("ticket")
                    ) {
                      return (
                        <Calendar className="h-4 w-4 text-amber-400" />
                      );
                    }

                    if (
                      t === "qr" ||
                      t === "qr_code"
                    ) {
                      return (
                        <QrCode className="h-4 w-4 text-emerald-400" />
                      );
                    }

                    if (t === "report") {
                      return (
                        <BarChart3 className="h-4 w-4 text-violet-400" />
                      );
                    }

                    if (t === "system") {
                      return (
                        <SettingsIcon className="h-4 w-4 text-[#8fb8d6]" />
                      );
                    }

                    if (t === "approval") {
                      return (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      );
                    }

                    if (t === "asset") {
                      return (
                        <Package className="h-4 w-4 text-sky-400" />
                      );
                    }

                    if (t === "property") {
                      return (
                        <Building2 className="h-4 w-4 text-indigo-400" />
                      );
                    }

                    if (t === "user") {
                      return (
                        <User className="h-4 w-4 text-cyan-400" />
                      );
                    }

                    if (t === "house") {
                      return (
                        <Home className="h-4 w-4 text-orange-400" />
                      );
                    }

                    if (t === "newsletter") {
                      return (
                        <Megaphone className="h-4 w-4 text-pink-400" />
                      );
                    }

                    if (t === "allocation") {
                      return (
                        <UsersIcon className="h-4 w-4 text-teal-400" />
                      );
                    }

                    if (t === "audit") {
                      return (
                        <ClipboardCheck className="h-4 w-4 text-red-400" />
                      );
                    }

                    if (t === "scan") {
                      return (
                        <QrCode className="h-4 w-4 text-lime-400" />
                      );
                    }

                    if (t === "department") {
                      return (
                        <Building2 className="h-4 w-4 text-fuchsia-400" />
                      );
                    }

                    if (t === "setting") {
                      return (
                        <SettingsIcon className="h-4 w-4 text-slate-400" />
                      );
                    }

                    return (
                      <Activity className="h-4 w-4 text-[#e8c874]" />
                    );
                  };

                return (
                  <DropdownMenuItem
                    key={n.id}
                    className="group mx-0.5 my-1 rounded-lg p-0 focus:bg-transparent"
                  >
                    <Link
                      to={to}
                      className={cn(
                        "flex w-full items-start gap-3",
                        "rounded-lg px-3 py-3",
                        "transition-all duration-200",
                        "hover:bg-[#0e2a44]",
                        "border border-transparent hover:border-[#1f4a6e]/60"
                      )}
                      onClick={() =>
                        setNotifOpen(false)
                      }
                    >
                      <div className="mt-0.5 shrink-0">
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center",
                            "rounded-lg",
                            isUnread
                              ? "bg-[#c9a227]/10 border border-[#c9a227]/20"
                              : "bg-[#0e2a44] border border-[#1f4a6e]/50"
                          )}
                        >
                          {getNotificationIcon()}
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "line-clamp-2 text-sm",
                              isUnread
                                ? "font-bold text-[#eaf2fa]"
                                : "font-semibold text-[#8fb8d6]"
                            )}
                          >
                            {n.title ||
                              typeLabel ||
                              "Notification"}
                          </p>

                          <span className="whitespace-nowrap text-[10px] text-[#5f88ab] font-mono">
                            {formatDistanceToNow(
                              parseISO(
                                n.created_at
                              ),
                              {
                                addSuffix: true,
                              }
                            )}
                          </span>
                        </div>

                        {n.message && (
                          <p className="line-clamp-2 text-xs leading-relaxed text-[#5f88ab]">
                            {n.message}
                          </p>
                        )}

                        {typeLabel && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "mt-1 w-fit rounded-md",
                              "border-[#c9a227]/30",
                              "bg-[#c9a227]/[0.08]",
                              "px-1.5 py-0.5",
                              "text-[9px] font-mono font-bold",
                              "uppercase tracking-[0.12em]",
                              "text-[#e8c874]"
                            )}
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

  // ============================================================
  // USER MENU
  // ============================================================

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "group rounded-full p-0",
            "overflow-visible hover:bg-transparent",
            iconBase
          )}
        >
          {decoratedTriggerAvatar}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className={cn(
          "w-72 overflow-hidden rounded-xl p-0",
          "border border-[#1f4a6e]/70",
          "bg-slate-950/95",
          "backdrop-blur-2xl",
          "shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
          "ring-1 ring-[#c9a227]/10"
        )}
      >
        {/* USER HEADER */}
        <div
          className={cn(
            "relative overflow-hidden",
            "border-b border-[#1f4a6e]/60",
            "bg-gradient-to-br",
            "from-[#c9a227]/[0.10]",
            "via-[#173f63]/30",
            "to-transparent",
            "px-4 py-4"
          )}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#c9a227]/[0.08] blur-2xl" />

          <div className="relative flex items-center gap-3">
            <Avatar className="h-11 w-11 ring-2 ring-[#0a1f33] border border-[#c9a227]/30">
              {userAvatarUrl && (
                <AvatarImage
                  src={userAvatarUrl}
                  alt={fullName}
                />
              )}

              <AvatarFallback className="bg-gradient-to-br from-[#0e2a44] to-[#173f63] text-sm font-mono font-bold text-[#e8c874]">
                {userInitials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-bold text-[#eaf2fa]">
                {authUser?.name ||
                  "Guest User"}
              </p>

              {userEmail && (
                <p className="max-w-[13rem] truncate text-xs text-[#5f88ab] font-mono">
                  {userEmail}
                </p>
              )}

              {roleLower && !false && (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md",
                    "border-[#c9a227]/30",
                    "bg-[#c9a227]/[0.08]",
                    "px-1.5 py-0.5",
                    "text-[9px] font-mono font-bold",
                    "uppercase tracking-[0.12em]",
                    "text-[#e8c874]"
                  )}
                >
                  {roleLower}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* USER ACTIONS */}
        <div className="p-2">
          <DropdownMenuItem
            onClick={() =>
              navigate(
                false
                  ? "/demo/profile"
                  : "/profile"
              )
            }
            className={cn(
              "mx-1 flex cursor-pointer items-center gap-3",
              "rounded-lg px-3 py-2.5",
              "text-[#c3d8ea]",
              "transition-colors",
              "hover:bg-[#0e2a44]"
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0e2a44] border border-[#1f4a6e]/60">
              <UsersIcon className="h-4 w-4" />
            </span>

            <span className="text-sm font-medium">
              Profile
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() =>
              navigate(
                false
                  ? "/demo/settings"
                  : "/settings"
              )
            }
            className={cn(
              "mx-1 flex cursor-pointer items-center gap-3",
              "rounded-lg px-3 py-2.5",
              "text-[#c3d8ea]",
              "transition-colors",
              "hover:bg-[#0e2a44]"
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0e2a44] border border-[#1f4a6e]/60">
              <SettingsIcon className="h-4 w-4" />
            </span>

            <span className="text-sm font-medium">
              Settings
            </span>
          </DropdownMenuItem>

          {isAdminRole && (
            <>
              <DropdownMenuSeparator className="my-2 bg-[#1f4a6e]/50" />

              <DropdownMenuItem
                onClick={() =>
                  navigate(
                    false
                      ? "/demo/users"
                      : "/users"
                  )
                }
                className={cn(
                  "mx-1 flex cursor-pointer items-center gap-3",
                  "rounded-lg px-3 py-2.5",
                  "text-[#c3d8ea]",
                  "transition-colors",
                  "hover:bg-[#c9a227]/[0.08]",
                  "hover:text-[#e8c874]"
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c9a227]/10 border border-[#c9a227]/25">
                  <UsersIcon className="h-4 w-4 text-[#e8c874]" />
                </span>

                <span className="text-sm font-medium">
                  User Management
                </span>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator className="my-2 bg-[#1f4a6e]/50" />

          <DropdownMenuItem
            onClick={handleSignOut}
            className={cn(
              "mx-1 flex cursor-pointer items-center gap-3",
              "rounded-lg px-3 py-2.5",
              "text-[#e0824a]",
              "transition-colors",
              "hover:bg-[#e0824a]/10 hover:text-[#ef9a67]"
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e0824a]/10">
              <LogOut className="h-4 w-4" />
            </span>

            <span className="text-sm font-medium">
              Sign out
            </span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // ============================================================
  // HEADER
  // ============================================================

  return (
    <header
      className={cn(
        "app-header sticky top-0 z-50",
        "h-16 md:h-[68px]",
        "border-b transition-all duration-300",
        "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 backdrop-blur-xl",
        scrolled
          ? "border-slate-700 shadow-[0_4px_24px_rgba(0,0,0,0.25)]"
          : "border-slate-700/60 shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
      )}
    >
      {/* ======================================================
          BLUEPRINT / INSTRUMENT-PANEL BACKGROUND
      ======================================================= */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-0 h-full w-80 bg-gradient-to-r from-blue-600/10 to-transparent" />
        <div className="absolute right-0 top-0 h-full w-60 bg-gradient-to-l from-indigo-600/8 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
      </div>

      {/* ======================================================
          MOBILE HEADER
      ======================================================= */}

      {isMobile ? (
        <div className="relative flex h-full w-full items-center px-3">

          {/* LEFT */}
          <div className="flex items-center gap-1.5">
            <button
              aria-label="Open menu"
              onClick={onMenuClick}
              className={cn(
                "group inline-flex h-9 w-9 items-center justify-center",
                "rounded-lg",
                "border border-slate-600/60",
                "bg-slate-700/60",
                "text-slate-300",
                "shadow-sm",
                "transition-all duration-200",
                "hover:border-blue-500/50",
                "hover:bg-slate-700",
                "hover:text-blue-400"
              )}
            >
              <Menu className="h-[18px] w-[18px] transition-transform group-hover:scale-105" />
            </button>

            <button
              type="button"
              onClick={() =>
                setPaletteOpen(true)
              }
              className={cn(
                "group inline-flex h-9 w-9 items-center justify-center",
                "rounded-lg",
                "border border-slate-600/60",
                "bg-slate-700/60",
                "text-slate-300",
                "shadow-sm",
                "transition-all duration-200",
                "hover:border-blue-500/50",
                "hover:bg-slate-700",
                "hover:text-blue-400"
              )}
            >
              <Search className="h-[17px] w-[17px] transition-transform group-hover:scale-105" />
            </button>
          </div>

          {/* CENTER BRAND */}
          <Link
            to={prefix || "/dashboard"}
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5"
            aria-label="Go to dashboard"
          >
            <span className="font-mono text-[15px] font-bold tracking-[0.18em] text-slate-100">
              EAM<span className="text-blue-400">S</span>
            </span>
          </Link>

          {/* RIGHT */}
          <div className="ml-auto flex items-center gap-1.5">

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={cn(
                "h-9 w-9 rounded-lg p-0",
                "border border-slate-600/60",
                "bg-slate-700/60 text-slate-300",
                "transition-all duration-200",
                "hover:border-blue-500/50",
                "hover:bg-slate-700",
                "hover:text-blue-400"
              )}
            >
              {isDark ? (
                <Sun className="h-[17px] w-[17px] text-amber-400" />
              ) : (
                <Moon className="h-[17px] w-[17px] text-slate-300" />
              )}
            </Button>

            {notificationsDropdown}

            {userMenu}
          </div>
        </div>
      ) : (

        /* ======================================================
           DESKTOP HEADER
        ======================================================= */

        <div className="relative flex h-full items-center justify-between gap-4 px-4 md:px-6">

          {/* BRAND */}
          <Link
            to={prefix || "/dashboard"}
            className="flex shrink-0 items-center gap-2.5"
            aria-label="Go to dashboard"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-blue-500/30 bg-blue-500/10">
              <Radio className="h-4 w-4 text-blue-400" strokeWidth={1.8} />
            </div>

            <div className="hidden flex-col leading-none lg:flex">
              <span className="font-mono text-[15px] font-bold tracking-[0.16em] text-slate-100">
                EAM<span className="text-blue-400">S</span>
              </span>
              <span className="mt-0.5 text-[9px] font-mono uppercase tracking-[0.2em] text-slate-400">
                Metahara Sugar Factory
              </span>
            </div>
          </Link>

          {/* SEARCH AREA */}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-3">

            <div className="relative w-full max-w-[420px]">

              <Search
                className={cn(
                  "pointer-events-none absolute left-3.5 top-1/2",
                  "h-[16px] w-[16px]",
                  "-translate-y-1/2",
                  "text-slate-400"
                )}
              />

              <Input
                aria-label="Search"
                placeholder="Search anything..."
                className={cn(
                  "h-10 w-full rounded-lg",
                  "border border-slate-600/60",
                  "bg-slate-700/50",
                  "pl-10 pr-16",
                  "text-sm text-slate-100",
                  "placeholder:text-slate-400",
                  "shadow-inner",
                  "transition-all duration-200",
                  "hover:border-slate-500",
                  "hover:bg-slate-700/80",
                  "focus:border-blue-500/60",
                  "focus:bg-slate-700",
                  "focus:ring-4 focus:ring-blue-500/10",
                  "focus-visible:ring-4 focus-visible:ring-blue-500/10"
                )}
                readOnly
                onFocus={() =>
                  setPaletteOpen(true)
                }
                onClick={() =>
                  setPaletteOpen(true)
                }
              />

              {shortcutHint && (
                <span
                  className={cn(
                    "pointer-events-none absolute right-2 top-1/2",
                    "-translate-y-1/2",
                    "rounded-md",
                    "border border-slate-600/60",
                    "bg-slate-800",
                    "px-2 py-1",
                    "text-[10px] font-mono font-semibold tracking-wide",
                    "text-slate-400",
                    "shadow-sm"
                  )}
                >
                  {shortcutHint}
                </span>
              )}
            </div>
          </div>

          {/* RIGHT CONTROLS */}
          <div className="flex items-center gap-1.5 md:gap-2.5">

            {/* GREETING / SYSTEM STATUS PANEL */}
            {fullName && (
              <div
                className={cn(
                  "hidden lg:flex items-center gap-3",
                  "rounded-lg px-3.5 py-2",
                  "border border-slate-600/60",
                  "bg-slate-700/50",
                  "shadow-sm",
                  "transition-all duration-200",
                  "hover:border-blue-500/40",
                  "hover:bg-slate-700"
                )}
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 bg-emerald-400" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-slate-800 bg-emerald-400" />
                </span>

                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="text-[9px] font-mono font-medium uppercase tracking-[0.16em] text-slate-400">
                    {greeting} · Online
                  </span>
                  <span className="text-xs font-bold text-slate-100">
                    {firstName || fullName || "Administrator"}
                  </span>
                </div>
              </div>
            )}

            {/* DIVIDER */}
            <div className="hidden h-7 w-px bg-slate-600/60 sm:block" />

            {/* THEME */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={cn(
                "h-9 w-9 rounded-lg p-0",
                "border border-slate-600/60",
                "bg-slate-700/60 text-slate-300",
                "transition-all duration-200",
                "hover:border-blue-500/50",
                "hover:bg-slate-700",
                "hover:text-blue-400"
              )}
            >
              {isDark ? (
                <Sun className="h-[17px] w-[17px] text-amber-400" />
              ) : (
                <Moon className="h-[17px] w-[17px] text-slate-300" />
              )}
            </Button>

            {/* NOTIFICATIONS */}
            {notificationsDropdown}

            {/* USER MENU */}
            {userMenu}
          </div>
        </div>
      )}

      {/* COMMAND PALETTE */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        role={authUser?.role || null}
      />
    </header>
  );
}