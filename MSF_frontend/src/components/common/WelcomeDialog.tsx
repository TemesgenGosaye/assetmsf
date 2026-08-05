import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Clock,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/* ─── Types ─────────────────────────────────────────────── */
type WelcomeData = { name: string; email: string; role: string };

/* ─── Helpers ───────────────────────────────────────────── */
function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  return "Good evening";
}

function roleLabel(role: string) {
  return role
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function roleColor(role: string) {
  const r = role.toLowerCase();
  if (r.includes("super_admin") || r.includes("superadmin")) return "#a855f7";
  if (r.includes("admin")) return "#d97706";
  if (r.includes("manager")) return "#2563eb";
  if (r.includes("request")) return "#059669";
  if (r.includes("applicant")) return "#0891b2";
  return "#64748b";
}

/* Read the app's live accent colour (--primary) so the welcome
   experience always matches the user's chosen theme accent.      */
function usePrimaryTones() {
  return useMemo(() => {
    let v = "16 52% 58%";
    try {
      v =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--primary")
          .trim() || v;
    } catch {}
    const [h, s, l] = v.split(/\s+/).map((n) => parseFloat(n) || 0);
    const mk = (light: number, sat = s, alpha = 1) =>
      `hsl(${h} ${Math.max(0, Math.min(100, sat))}% ${Math.max(
        0,
        Math.min(92, light),
      )}%${alpha < 1 ? ` / ${alpha}` : ""})`;
    return {
      base: mk(l),
      soft: mk(Math.min(92, l + 16)),
      deep: mk(Math.max(0, l - 22)),
      darker: mk(Math.max(0, l - 36)),
      alpha: (a: number) => mk(l, s, a),
    };
  }, []);
}

/* ─── Decorative crystal lattice ────────────────────────────
   Subtle geometric tiling (sugar-crystal motif) used on the
   brand panel. Pure SVG, low opacity, zero JS cost.            */
function CrystalPattern({ color = "rgba(255,255,255,0.08)" }: { color?: string }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="sams-lattice" width="46" height="46" patternUnits="userSpaceOnUse">
          <path
            d="M23 3 L43 23 L23 43 L3 23 Z"
            fill="none"
            stroke={color}
            strokeWidth="1"
          />
          <path
            d="M23 14 L32 23 L23 32 L14 23 Z"
            fill="none"
            stroke={color}
            strokeWidth="0.6"
          />
          <circle cx="23" cy="23" r="1.4" fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#sams-lattice)" />
    </svg>
  );
}

/* ─── Full-page celebration ────────────────────────────────
   A restrained, tasteful burst of light when the user enters.
   Shockwave rings from the button, then a soft shower. Self-cleans. */
const STAR_PALETTE = [
  "#fbbf24", "#f59e0b", "#fde047", "#f472b6", "#c084fc",
  "#818cf8", "#38bdf8", "#34d399", "#fb7185",
];
const STAR_PATH = "M12 1.9l2.85 6.2 6.75.6-5.05 4.55 1.5 6.6L12 16.5 5.95 19.85l1.5-6.6L2.4 8.7l6.75-.6z";

type ParticleKind = "star" | "spark" | "strip";

function makeParticle(kind: ParticleKind, color: string, size: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;z-index:9999;will-change:transform,opacity;";
  if (kind === "star") {
    el.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><path fill="${color}" d="${STAR_PATH}"/></svg>`;
  } else if (kind === "spark") {
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = "50%";
    el.style.background = color;
    el.style.boxShadow = `0 0 ${Math.round(size * 1.5)}px ${color}`;
  } else {
    el.style.width = `${size}px`;
    el.style.height = `${Math.max(3, Math.round(size * 0.35))}px`;
    el.style.borderRadius = "2px";
    el.style.background = color;
  }
  return el;
}

function launchParticle(p: {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  size: number;
  life: number;
}) {
  const color = STAR_PALETTE[Math.floor(Math.random() * STAR_PALETTE.length)];
  const el = makeParticle(p.kind, color, p.size);
  document.body.appendChild(el);

  const start = performance.now();
  let x = p.x;
  let y = p.y;
  const vx = p.vx;
  let vy = p.vy;
  let rot = Math.random() * 360;
  const vr = (Math.random() * 360) / 900 * (Math.random() > 0.5 ? 1 : -1);

  function tick(now: number) {
    const t = (now - start) / p.life;
    if (t >= 1) { el.remove(); return; }
    x += vx * 0.016;
    vy += p.gravity * 0.016;
    y += vy * 0.016;
    rot += vr;
    const fadeStart = 0.6;
    const alpha = t < fadeStart ? 1 : Math.max(0, 1 - (t - fadeStart) / (1 - fadeStart));
    const tw = 1 + Math.sin(now / 90 + x) * 0.16;
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) rotate(${rot}deg) scale(${tw.toFixed(3)})`;
    el.style.opacity = alpha.toFixed(3);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function ringBurst(x: number, y: number, color: string, duration: number) {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;pointer-events:none;z-index:9999;";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = "30px";
  el.style.height = "30px";
  el.style.borderRadius = "50%";
  el.style.border = `3px solid ${color}`;
  el.style.boxShadow = `0 0 22px ${color}`;
  el.style.transform = "translate(-50%,-50%)";
  document.body.appendChild(el);
  const start = performance.now();
  function tick(now: number) {
    const t = (now - start) / duration;
    if (t >= 1) { el.remove(); return; }
    el.style.transform = `translate(-50%,-50%) scale(${(1 + t * 7).toFixed(3)})`;
    el.style.opacity = (1 - t).toFixed(3);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function celebrate(origin: HTMLElement | null) {
  const rect = origin ? origin.getBoundingClientRect() : null;
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

  ringBurst(cx, cy, STAR_PALETTE[1], 650);
  ringBurst(cx, cy, STAR_PALETTE[4], 830);

  const kinds: ParticleKind[] = ["star", "star", "spark", "strip", "spark"];
  for (let i = 0; i < 40; i++) {
    const angle = (Math.PI * 2 * i) / 40 + (Math.random() - 0.5) * 0.6;
    const speed = 120 + Math.random() * 240;
    launchParticle({
      kind: kinds[i % kinds.length],
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      gravity: 170,
      size: 8 + Math.random() * 14,
      life: 900 + Math.random() * 800,
    });
  }

  setTimeout(() => {
    for (let i = 0; i < 60; i++) {
      launchParticle({
        kind: i % 4 === 0 ? "star" : i % 3 === 0 ? "strip" : "spark",
        x: Math.random() * window.innerWidth,
        y: -20 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 80,
        vy: 40 + Math.random() * 120,
        gravity: 240,
        size: 7 + Math.random() * 12,
        life: 1800 + Math.random() * 1600,
      });
    }
  }, 220);
}

/* ─── Main component ─────────────────────────────────────── */
export function WelcomeDialog() {
  const [data, setData] = useState<WelcomeData | null>(null);
  const [phase, setPhase] = useState<"in" | "idle" | "out">("in");
  const [now, setNow] = useState<Date | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tones = usePrimaryTones();

  useEffect(() => {
    const read = () => {
      try {
        const raw = sessionStorage.getItem("sams:welcome");
        if (raw) {
          sessionStorage.removeItem("sams:welcome");
          setData(JSON.parse(raw));
          setPhase("in");
          setNow(new Date());
          setTimeout(() => setPhase("idle"), 700);
        }
      } catch {}
    };
    read();
    window.addEventListener("sams:welcome", read);
    return () => window.removeEventListener("sams:welcome", read);
  }, []);

  useEffect(() => {
    if (!data) return;
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, [data]);

  const greet = useMemo(() => greeting(), []);
  const displayName = useMemo(
    () => data?.name?.trim() || data?.email?.split("@")[0]?.trim() || "there",
    [data],
  );

  const timeText = useMemo(
    () =>
      now?.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) ?? "",
    [now],
  );
  const dateText = useMemo(
    () =>
      now?.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }) ?? "",
    [now],
  );
  const yearText = useMemo(() => String(now?.getFullYear() ?? new Date().getFullYear()), [now]);

  const close = () => {
    if (btnRef.current) celebrate(btnRef.current);
    setPhase("out");
    setTimeout(() => setData(null), 450);
  };

  if (!data) return null;

  const role = roleColor(data.role || "");
  const SESSION = [
    { icon: LockKeyhole, title: "Encrypted", sub: "Session secured" },
    { icon: BadgeCheck, title: "Verified", sub: "Identity confirmed" },
    { icon: Activity, title: "Online", sub: "Workspace synced" },
  ];

  return (
    <>
      <style>{`
        @keyframes samsIn {
          0%   { opacity: 0; transform: translateY(30px) scale(0.95); }
          60%  { opacity: 1; transform: translateY(-5px) scale(1.012); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes samsOut {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(18px) scale(0.95); }
        }
        @keyframes samsReveal {
          0%   { opacity: 0; transform: translateY(14px); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes samsSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes samsDrift {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(10px, -12px) scale(1.12); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes samsPulse {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        @keyframes samsShimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes samsBlink {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          50%      { opacity: 0.75; box-shadow: 0 0 8px 2px rgba(34,197,94,0.35); }
        }
        .sams-display {
          font-family: 'Fraunces', Georgia, 'Times New Roman', serif;
          font-variation-settings: "opsz" 72;
        }
        @media (prefers-reduced-motion: reduce) {
          .sams-welcome, .sams-welcome * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <Dialog open onOpenChange={close}>
        <DialogContent
          hideCloseButton
          className="sams-welcome border-0 bg-transparent p-0 shadow-none sm:max-w-[620px] [&>button]:hidden"
        >
          <DialogTitle className="sr-only">Welcome to Metahara Sugar Factory</DialogTitle>

          <div
            className="relative overflow-hidden rounded-[20px]"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border) / 0.7)",
              boxShadow:
                "0 40px 100px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset",
              backdropFilter: "blur(24px)",
              animation:
                phase === "in"
                  ? "samsIn 0.7s cubic-bezier(0.16,1,0.3,1) forwards"
                  : phase === "out"
                  ? "samsOut 0.4s ease-in forwards"
                  : "none",
            }}
          >
            {/* Brand accent line across the top edge */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[3px]"
              style={{
                background: `linear-gradient(90deg, ${tones.soft}, ${tones.base}, ${tones.deep})`,
              }}
            />

            <div className="grid sm:grid-cols-[232px_1fr]">
              {/* ── Brand panel ────────────────────────────── */}
              <div
                className="relative flex items-center gap-5 overflow-hidden p-6 text-left sm:flex-col sm:justify-center sm:gap-6 sm:p-8 sm:text-center"
                style={{
                  background: `linear-gradient(168deg, ${tones.soft} 0%, ${tones.base} 32%, ${tones.deep} 70%, ${tones.darker} 100%)`,
                }}
              >
                {/* Dot grid */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage: `radial-gradient(${tones.alpha(0.16)} 1px, transparent 1.5px)`,
                    backgroundSize: "20px 20px",
                  }}
                />
                {/* Crystal lattice */}
                <CrystalPattern />

                {/* Glow orbs */}
                <div
                  className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${tones.alpha(0.42)} 0%, transparent 70%)`,
                    animation: "samsDrift 9s ease-in-out infinite",
                  }}
                />
                <div
                  className="pointer-events-none absolute -bottom-16 -left-12 h-48 w-48 rounded-full"
                  style={{
                    background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)",
                    animation: "samsDrift 11s ease-in-out infinite reverse",
                  }}
                />
                {/* Glass sheen */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(200deg, rgba(255,255,255,0.16) 0%, transparent 38%)",
                  }}
                />

                {/* Logo */}
                <div
                  className="relative flex h-20 w-20 shrink-0 items-center justify-center sm:h-24 sm:w-24"
                  style={{ animation: "samsReveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.05s both" }}
                >
                  <div
                    className="absolute inset-[-9px] rounded-full border border-dashed"
                    style={{ borderColor: "rgba(255,255,255,0.3)", animation: "samsSpin 24s linear infinite" }}
                  />
                  <div
                    className="absolute inset-[-3px] rounded-full"
                    style={{
                      background: "radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 64%)",
                      animation: "samsPulse 3s ease-in-out infinite",
                    }}
                  />
                  <div
                    className="relative h-full w-full overflow-hidden rounded-full ring-2 ring-white/30"
                    style={{ boxShadow: "0 16px 44px -12px rgba(0,0,0,0.6)" }}
                  >
                    <img
                      src="/msf_logo.jpg"
                      alt="Metahara Sugar Factory"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>

                {/* Wordmark */}
                <div
                  className="relative min-w-0"
                  style={{ animation: "samsReveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.12s both" }}
                >
                  <p
                    className="text-[11px] font-bold uppercase leading-snug tracking-[0.2em] text-white"
                    style={{ textShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
                  >
                    Metahara Sugar
                    <br />
                    Factory S.C.
                  </p>
                  <p className="mt-1.5 text-[11px] font-medium text-white/75">መተሐራ ስኳር ፋብሪካ</p>
                  <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/55">
                    Enterprise Asset &amp; Housing Management
                  </p>
                </div>

                {/* Trust chips (desktop) */}
                <div
                  className="relative hidden gap-2 sm:flex"
                  style={{ animation: "samsReveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}
                >
                  {[
                    { icon: ShieldCheck, label: "Secure" },
                    { icon: BadgeCheck, label: "Verified" },
                  ].map(({ icon: Icon, label }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/85 backdrop-blur-sm"
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* ── Welcome panel ──────────────────────────── */}
              <div className="relative flex flex-col overflow-hidden bg-background p-6 sm:p-7">
                {/* Soft accent glow in the corner */}
                <div
                  className="pointer-events-none absolute -top-20 -right-16 h-44 w-56 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${tones.alpha(0.13)} 0%, transparent 70%)`,
                  }}
                />

                {/* Header */}
                <div
                  className="relative flex items-center justify-between gap-3"
                  style={{ animation: "samsReveal 0.7s cubic-bezier(0.16,1,0.3,1) 0.15s both" }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <img
                      src="/sams_logo.png"
                      alt="SAMS"
                      className="h-5 w-5 shrink-0 rounded-full object-cover"
                    />
                    <span className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Smart Asset Management
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold tabular-nums">
                    <Clock className="h-3.5 w-3.5" style={{ color: tones.base }} />
                    <span style={{ color: tones.base }}>{timeText}</span>
                  </div>
                </div>

                {/* Greeting + name */}
                <div
                  className="relative mt-7"
                  style={{ animation: "samsReveal 0.75s cubic-bezier(0.16,1,0.3,1) 0.22s both" }}
                >
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    <span
                      className="inline-block h-px w-5"
                      style={{ background: tones.base }}
                    />
                    Welcome back
                  </p>
                  <h2 className="sams-display mt-3 text-[30px] font-semibold leading-[1.12] tracking-tight text-foreground sm:text-[34px]">
                    <span className="block">{greet},</span>
                    <span className="block italic" style={{ color: tones.base }}>
                      {displayName}
                    </span>
                  </h2>
                </div>

                {/* Email + role */}
                <div
                  className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2"
                  style={{ animation: "samsReveal 0.7s cubic-bezier(0.16,1,0.3,1) 0.3s both" }}
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{data.email}</span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      background: `${role}1a`,
                      borderColor: `${role}40`,
                      color: role,
                    }}
                  >
                    <Sparkles className="h-3 w-3" />
                    {roleLabel(data.role || "Member")}
                  </span>
                </div>

                {/* Divider */}
                <div
                  className="relative mt-6 h-px w-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, hsl(var(--border)), transparent)`,
                  }}
                />

                {/* Session tiles */}
                <div
                  className="relative mt-5 grid grid-cols-3 gap-2"
                  style={{ animation: "samsReveal 0.7s cubic-bezier(0.16,1,0.3,1) 0.38s both" }}
                >
                  {SESSION.map(({ icon: Icon, title, sub }) => (
                    <div
                      key={title}
                      className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-2.5 py-3"
                    >
                      <Icon className="h-4 w-4" style={{ color: tones.base }} />
                      <span className="text-xs font-semibold text-foreground">{title}</span>
                      <span className="text-[10px] leading-tight text-muted-foreground">{sub}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div
                  className="relative mt-auto pt-7"
                  style={{ animation: "samsReveal 0.7s cubic-bezier(0.16,1,0.3,1) 0.46s both" }}
                >
                  <button
                    ref={btnRef}
                    onClick={close}
                    className="group relative w-full overflow-hidden rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:brightness-110 active:scale-[0.98]"
                    style={{
                      background: `linear-gradient(135deg, ${tones.base}, ${tones.deep})`,
                      boxShadow: `0 14px 34px -10px ${tones.alpha(0.55)}`,
                    }}
                  >
                    <span
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.22) 50%, transparent 60%)",
                        backgroundSize: "200% auto",
                        animation: "samsShimmer 2.6s linear infinite",
                      }}
                    />
                    <span className="relative flex items-center justify-center gap-2">
                      Enter Workspace
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </button>
                </div>

                {/* Footer */}
                <div
                  className="relative mt-4 flex items-center justify-between gap-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80"
                  style={{ animation: "samsReveal 0.7s cubic-bezier(0.16,1,0.3,1) 0.54s both" }}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        background: "#22c55e",
                        animation: "samsBlink 2s ease-in-out infinite",
                      }}
                    />
                    System online
                  </span>
                  <span className="truncate">
                    Metahara Sugar Factory &middot; {yearText}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
