import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode, Eye, EyeOff, Mail, Lock, ArrowLeft,
  Shield, KeyRound, Sun, Moon,
} from "lucide-react";

import { Label } from "@/components/ui/label";
import { loginWithDjango, type DjangoUser } from "@/services/djangoAuth";
import {
  requestPasswordReset,
  verifyPasswordResetCode,
  completePasswordReset,
} from "@/services/passwordReset";

const CURRENT_USER_KEY = "current_user_id";

type Step = "login" | "forgot-password" | "verify-otp" | "reset-password";

const stepLabels: Record<Step, { title: string; desc: string }> = {
  login: { title: "Sign in", desc: "Use your factory account to access EAMS." },
  "forgot-password": { title: "Reset your password", desc: "Enter your email and we'll send a verification code." },
  "verify-otp": { title: "Check your email", desc: "Enter the 6-digit code we just sent you." },
  "reset-password": { title: "Choose a new password", desc: "Use at least 8 characters." },
};

/* ------------------------------------------------------------------ */
/*  Ambient backdrop — a single quiet signature instead of a split panel */
/* ------------------------------------------------------------------ */

/** A handful of crystal facets settle into place once on load, low in the
 *  frame, behind the card — raw cane resolving into structured sugar,
 *  echoing raw input resolving into a structured asset record. */
/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function Login() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [animKey, setAnimKey] = useState(0);
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem("theme") === "dark" || (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches); } catch { return false; }
  });

  useEffect(() => {
    const root = document.documentElement;
    const syncDark = () => setIsDark(root.classList.contains("dark"));
    syncDark();
    const obs = new MutationObserver(syncDark);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const next = !isDark;
    setIsDark(next);
    if (next) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    window.dispatchEvent(new Event("storage"));
  };

  const isAuthed = useMemo(() => {
    try { return Boolean(localStorage.getItem(CURRENT_USER_KEY)); } catch { return false; }
  }, []);

  useEffect(() => {
    if (isAuthed) navigate(returnTo || "/dashboard", { replace: true });
  }, [isAuthed, navigate, returnTo]);

  const finishLogin = useCallback(async (user: DjangoUser) => {
    setAttempts(0);
    setPassword("");
    setEmail(user.email);
    if ((user as any).must_change_password) {
      navigate("/force-change-password", { replace: true });
      return;
    }
    if (returnTo) {
      navigate(returnTo, { replace: true });
    } else if (user.role === "APPLICANT") {
      navigate("/applicant/new", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, returnTo]);

  const validateEmail = (v: string) => {
    if (!v.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address";
    return "";
  };

  const passwordStrength = (p: string): number => {
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(s, 4);
  };
  const strengthMeta = [
    { label: "Too weak", color: "bg-destructive" },
    { label: "Weak", color: "bg-amber-500" },
    { label: "Fair", color: "bg-yellow-400" },
    { label: "Good", color: "bg-lime-500" },
    { label: "Strong", color: "bg-primary" },
  ];

  const changeStep = (s: Step) => {
    setStep(s);
    setAnimKey((k) => k + 1);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    if (!password) { toast({ title: "Password is required", variant: "destructive" }); return; }
    setLoading(true);
    if (attempts >= 5) await new Promise((r) => setTimeout(r, 1500));
    try {
      const user = await loginWithDjango(email.trim(), password);
      if (!user) {
        setAttempts((a) => a + 1);
        toast({ title: "Invalid credentials", description: "Email or password is incorrect.", variant: "destructive" });
        return;
      }
      await finishLogin(user);
    } catch {
      toast({ title: "Sign in failed", description: "Unable to sign in. Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      toast({ title: "Verification code sent", description: "Please check your email for the 6-digit verification code." });
      changeStep("verify-otp");
    } catch (error: any) {
      if (error.message === "EMAIL_NOT_FOUND") {
        toast({
          title: "Email not found",
          description: "No account exists with this email address. Please check and try again.",
          variant: "destructive"
        });
      } else {
        toast({ title: "Failed to send code", description: "Something went wrong. Please try again.", variant: "destructive" });
      }
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) { toast({ title: "Verification code is required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await verifyPasswordResetCode(email, otp.trim());
      changeStep("reset-password");
    } catch {
      toast({ title: "Invalid or expired code", description: "Please check your code or request a new one.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) { toast({ title: "New password is required", variant: "destructive" }); return; }
    if (newPassword !== confirmPassword) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    if (newPassword.length < 8) { toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await completePasswordReset(`${email}|${otp}`, newPassword);
      toast({ title: "Password reset successful", description: "You can now log in with your new password." });
      setStep("login");
      setPassword(""); setOtp(""); setNewPassword(""); setConfirmPassword("");
    } catch {
      toast({ title: "Failed to reset password", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const stepInfo = stepLabels[step];

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-12">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Petrona:opsz,wght@8..30,400;8..30,500;8..30,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+Ethiopic:wght@400;500&display=swap');

        @keyframes card-rise {
          0% { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .card-rise { animation: card-rise 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @media (prefers-reduced-motion: reduce) {
          .crystal-facet { animation: none !important; opacity: 1 !important; }
          .card-rise { animation: none !important; }
        }
      `}</style>

      {/* Ambient backdrop with modern gradient */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, var(--bg-start), var(--bg-end))` }} />

      {/* Modern header bar */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-end">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-105"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-[20px] w-[20px]" /> : <Moon className="h-[20px] w-[20px]" />}
            </button>
          </div>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-32 left-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute bottom-20 right-10 h-40 w-40 rounded-full bg-purple-400/20 blur-3xl" />

      {/* Centered card */}
      <div className="card-rise relative z-10 w-full max-w-[420px]" style={{ background: "var(--card-bg)" }}>
        {/* Outer glow — subtle accent ring in dark mode */}
        <div className="absolute -inset-px rounded-[20px] bg-gradient-to-br from-primary/20 via-transparent to-primary/10 opacity-60 dark:opacity-40 blur-sm pointer-events-none" />
        {/* Card body */}
        <div className="relative rounded-[20px] border border-border/60 bg-white/80 p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06),0_24px_60px_-12px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.03] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-12px_rgba(0,0,0,0.5)] sm:p-9">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/20 blur-xl" />
              <img src="/msf_logo.jpg" alt="MSF" className="relative h-14 w-14 rounded-2xl object-cover shadow-2xl ring-2 ring-white/30" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground dark:text-white tracking-tight" style={{ fontFamily: "'Petrona', serif" }}>
                MSF Asset Management
              </h1>
              <p className="text-xs text-foreground/70 dark:text-white/70" style={{ fontFamily: "'Noto Sans Ethiopic', sans-serif" }}>
                መተሐራ ስኳር ፋብሪካ
              </p>
            </div>
          </div>

          <h1
            className="text-[26px] font-medium leading-tight text-foreground dark:text-white"
            style={{ fontFamily: "'Petrona', serif" }}
          >
            {stepInfo.title}
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground dark:text-white/50">{stepInfo.desc}</p>

          {step !== "login" && (
            <div className="mb-1 mt-6 flex items-center gap-2">
              {(["forgot-password", "verify-otp", "reset-password"] as Step[]).map((s) => {
                const order: Record<string, number> = { "forgot-password": 1, "verify-otp": 2, "reset-password": 3 };
                const active = order[s] <= order[step];
                return (
                  <div key={s} className="flex flex-1 items-center gap-2">
                    <div className={`h-1 flex-1 rounded-full transition-colors duration-500 ${active ? "bg-primary" : "bg-border dark:bg-white/10"}`} />
                  </div>
                );
              })}
            </div>
          )}

          <div key={animKey} className="mt-7 animate-float-up stagger">
            {step === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[13px] font-medium text-muted-foreground dark:text-white/70">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground dark:text-white/35" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@metaharasugar.gov.et"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                      autoFocus
                      className={`h-[48px] w-full rounded-xl border border-border bg-background pl-[42px] text-[14.5px] text-foreground shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/50 focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)] dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/25 dark:focus:border-primary/50 ${emailError ? "border-destructive/60 focus:border-destructive/60 focus:shadow-[0_0_0_4px_rgba(220,38,38,0.15)]" : ""}`}
                      autoComplete="email"
                      aria-invalid={!!emailError}
                    />
                  </div>
                  {emailError && <p className="pl-1 text-[12px] text-destructive dark:text-red-400">{emailError}</p>}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-[13px] font-medium text-muted-foreground dark:text-white/70">Password</Label>
                    <button
                      type="button"
                      onClick={() => changeStep("forgot-password")}
                      className="text-[12.5px] font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground dark:text-white/35" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-[48px] w-full rounded-xl border border-border bg-background pl-[42px] pr-12 text-[14.5px] text-foreground shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/50 focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)] dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/25 dark:focus:border-primary/50"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 h-[48px] w-full rounded-xl bg-primary text-[14.5px] font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-[hsl(var(--primary-hover))] hover:shadow-primary/35 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <span className="h-4 w-4 rounded-full border-2 border-[#1B120A]/25 border-t-[#1B120A] animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    "Sign in"
                  )}
                  
                </Button>

                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border dark:border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase">
                    <span
                      className="px-3 tracking-[0.14em] text-slate-400 font-medium"
                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      or
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  type="button"
                  onClick={() => navigate("/scan")}
                  className="h-[48px] w-full rounded-xl border border-border bg-background text-[14.5px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground dark:border-white/15 dark:bg-white/[0.03] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <QrCode className="mr-2.5 h-[18px] w-[18px]" />
                  Scan QR code 
                </Button>
              </form>
            )}

            {step === "forgot-password" && (
              <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email" className="text-[13px] font-medium text-muted-foreground dark:text-white/70">Email address</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground dark:text-white/35" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="name@metaharasugar.gov.et"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                      autoFocus
                      className="h-[48px] w-full rounded-xl border border-border bg-background pl-[42px] text-[14.5px] text-foreground shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/50 focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)] dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/25 dark:focus:border-primary/50"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 h-[48px] w-full rounded-xl bg-primary text-[14.5px] font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-[hsl(var(--primary-hover))] active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <span className="h-4 w-4 rounded-full border-2 border-[#1B120A]/25 border-t-[#1B120A] animate-spin" />
                      Sending code...
                    </span>
                  ) : (
                    "Send verification code"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => changeStep("login")}
                  className="flex w-full items-center justify-center gap-1.5 pt-1 text-[13px] text-muted-foreground hover:text-foreground dark:text-white/45 dark:hover:text-white"
                >
                  <ArrowLeft className="h-[14px] w-[14px]" />
                  Back to sign in
                </button>
              </form>
            )}

            {step === "verify-otp" && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="otp" className="text-[13px] font-medium text-muted-foreground dark:text-white/70">Verification code</Label>
                  <div className="relative">
                    <Shield className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground dark:text-white/35" />
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      autoFocus
                      className="h-[52px] w-full rounded-xl border border-border bg-background pl-[42px] text-center text-[22px] tracking-[0.4em] text-foreground shadow-sm focus:border-primary/50 focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)] dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:focus:border-primary/50"
                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      autoComplete="one-time-code"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="mt-2 h-[48px] w-full rounded-xl bg-primary text-[14.5px] font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-[hsl(var(--primary-hover))] active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <span className="h-4 w-4 rounded-full border-2 border-[#1B120A]/25 border-t-[#1B120A] animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    "Verify code"
                  )}
                </Button>

                <div className="flex flex-col items-center gap-2.5 pt-1">
                  <button type="button" onClick={() => changeStep("forgot-password")} className="text-[13px] text-muted-foreground hover:text-foreground dark:text-white/45 dark:hover:text-white">
                    Change email address
                  </button>
                  <button type="button" onClick={() => changeStep("login")} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground dark:text-white/45 dark:hover:text-white">
                    <ArrowLeft className="h-[14px] w-[14px]" />
                    Back to sign in
                  </button>
                </div>
              </form>
            )}

            {step === "reset-password" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-[13px] font-medium text-muted-foreground dark:text-white/70">New password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground dark:text-white/35" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-[48px] w-full rounded-xl border border-border bg-background pl-[42px] pr-12 text-[14.5px] text-foreground shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/50 focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)] dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/25 dark:focus:border-primary/50"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                  {newPassword && (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < passwordStrength(newPassword) ? strengthMeta[passwordStrength(newPassword)].color : "bg-border dark:bg-white/10"}`}
                          />
                        ))}
                      </div>
                      <p className={`text-[12px] ${passwordStrength(newPassword) >= 3 ? "text-primary" : "text-muted-foreground dark:text-white/40"}`}>
                        {strengthMeta[passwordStrength(newPassword)].label}
                        {passwordStrength(newPassword) >= 3 ? " — ready" : newPassword.length < 8 ? " · at least 8 characters" : ""}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-[13px] font-medium text-muted-foreground dark:text-white/70">Confirm password</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground dark:text-white/35" />
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-[48px] w-full rounded-xl border border-border bg-background pl-[42px] text-[14.5px] text-foreground shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/50 focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)] dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/25 dark:focus:border-primary/50"
                      autoComplete="new-password"
                    />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="pt-0.5 text-[12px] text-red-400">Passwords do not match</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 8 || loading}
                  className="mt-2 h-[48px] w-full rounded-xl bg-primary text-[14.5px] font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-[hsl(var(--primary-hover))] active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <span className="h-4 w-4 rounded-full border-2 border-[#1B120A]/25 border-t-[#1B120A] animate-spin" />
                      Resetting password...
                    </span>
                  ) : (
                    "Reset password"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => changeStep("login")}
                  className="flex w-full items-center justify-center gap-1.5 pt-1 text-[13px] text-muted-foreground hover:text-foreground dark:text-white/45 dark:hover:text-white"
                >
                  <ArrowLeft className="h-[14px] w-[14px]" />
                  Back to sign in
                </button>
              </form>
            )}
          </div>
        </div>

        <p
          className="mt-6 flex items-center justify-center text-center text-[11px] text-slate-400"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          <span>&copy; 20206 powered by Temesgen Msf IT Departement</span>
          
        </p>
      </div>
    </div>
  );
}