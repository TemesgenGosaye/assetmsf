import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode, Eye, EyeOff, Mail, Lock, ArrowLeft,
  Shield, Check, KeyRound, Sun, Moon, Boxes, Home as HomeIcon, Sprout,
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

/* ---------------------------------------------------------------------- */
/*  Brand panel — sugarcane line motif, bilingual identity, module list   */
/* ---------------------------------------------------------------------- */

function CaneField() {
  // Deterministic "field" of stalks: varied height, spacing and node count —
  // a signature element grounded in the factory's own subject matter.
  const stalks = useMemo(
    () =>
      Array.from({ length: 16 }).map((_, i) => {
        const x = (i / 15) * 100;
        const height = 55 + ((i * 37) % 40); // 55–95
        const nodes = 3 + (i % 3);
        const sway = 3 + (i % 4);
        const delay = (i % 6) * 0.4;
        const opacity = i % 3 === 0 ? 0.55 : 0.22;
        return { x, height, nodes, sway, delay, opacity, key: i };
      }),
    []
  );

  return (
    <svg
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] w-full"
      viewBox="0 0 400 260"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {stalks.map((s) => {
        const baseX = (s.x / 100) * 400;
        const topY = 260 - (s.height / 100) * 260;
        return (
          <g
            key={s.key}
            style={{
              transformOrigin: `${baseX}px 260px`,
              animation: `cane-sway ${4 + s.sway}s ease-in-out ${s.delay}s infinite`,
            }}
          >
            <line
              x1={baseX}
              y1="260"
              x2={baseX}
              y2={topY}
              stroke="#C98A3D"
              strokeWidth="1.4"
              strokeOpacity={s.opacity}
              strokeLinecap="round"
            />
            {Array.from({ length: s.nodes }).map((_, n) => {
              const ny = 260 - ((n + 1) * (260 - topY)) / (s.nodes + 1);
              return (
                <line
                  key={n}
                  x1={baseX - 3}
                  y1={ny}
                  x2={baseX + 3}
                  y2={ny}
                  stroke="#C98A3D"
                  strokeWidth="1.4"
                  strokeOpacity={s.opacity + 0.15}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function BrandPanel() {
  const modules = [
    { icon: Boxes, label: "Asset Management", note: "Track, tag and audit factory equipment" },
    { icon: HomeIcon, label: "House Allocation", note: "Manage staff housing and assignments" },
    { icon: Shield, label: "Secured access", note: "JWT-authenticated, LAN restricted" },
  ];

  return (
    <div className="relative hidden w-[46%] shrink-0 flex-col justify-between overflow-hidden bg-[#0B4F2F] px-14 py-12 lg:flex">
      {/* Background field */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B4F2F] via-[#0E5A37] to-[#093F26]" />
        <CaneField />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B4F2F] via-transparent to-transparent" />
      </div>

      {/* Top: identity */}
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <img src="/msf_logo.jpg" alt="MSF" className="h-11 w-11 rounded-lg object-contain ring-1 ring-white/15" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Enterprise Asset Management
            </p>
            <p
              className="text-[15px] text-white/90"
              style={{ fontFamily: "'Noto Sans Ethiopic', sans-serif" }}
            >
              መተሐራ ስኳር ፋብሪካ
            </p>
          </div>
        </div>
      </div>

      {/* Middle: headline */}
      <div className="relative z-10 max-w-md">
        <h1
          className="text-[38px] font-medium leading-[1.15] text-white"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          One system for every asset on the factory floor.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-white/60">
          EAMS brings asset tracking and staff housing into a single record for
          Metahara Sugar Factory's IT Department.
        </p>

        <div className="mt-10 space-y-5">
          {modules.map(({ icon: Icon, label, note }) => (
            <div key={label} className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
                <Icon className="h-[18px] w-[18px] text-[#E3B36C]" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-white/90">{label}</p>
                <p className="text-[13px] text-white/45">{note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: footer meta */}
      <div className="relative z-10 flex items-center gap-2 text-[12px] text-white/40">
        <Sprout className="h-[14px] w-[14px]" />
        <span>Metahara, Oromia &middot; IT Department &middot; Internal network only</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Form building blocks                                                   */
/* ---------------------------------------------------------------------- */

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  show: boolean;
  onToggle: () => void;
}

function PasswordInput({ id, value, onChange, placeholder, autoComplete, show, onToggle }: PasswordInputProps) {
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/45" />
      <Input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder || "Enter your password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[48px] w-full rounded-xl border border-border/60 bg-background pl-[42px] pr-12 text-[14.5px] shadow-sm transition-all duration-200 focus:border-[#0B4F2F]/50 focus:shadow-[0_0_0_4px_rgba(11,79,47,0.08)] placeholder:text-muted-foreground/40"
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/45 hover:bg-muted/40 hover:text-foreground transition-colors"
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
}

function SubmitButton({ loading, label, loadingLabel, disabled }: {
  loading: boolean; label: string; loadingLabel: string; disabled?: boolean;
}) {
  return (
    <Button
      type="submit"
      disabled={disabled || loading}
      className="mt-2 h-[48px] w-full rounded-xl bg-[#0B4F2F] text-[14.5px] font-medium text-white shadow-[0_6px_20px_-6px_rgba(11,79,47,0.5)] transition-all duration-200 hover:bg-[#0E5A37] hover:shadow-[0_8px_28px_-6px_rgba(11,79,47,0.55)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2.5">
          <span className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin" />
          {loadingLabel}
        </span>
      ) : (
        label
      )}
    </Button>
  );
}

function FormDivider() {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border/50" />
      </div>
      <div className="relative flex justify-center text-[11px] uppercase">
        <span className="bg-background px-3 tracking-[0.1em] text-muted-foreground/45 font-medium">or</span>
      </div>
    </div>
  );
}

const inputClass = "h-[48px] w-full rounded-xl border border-border/60 bg-background pl-[42px] text-[14.5px] shadow-sm transition-all duration-200 focus:border-[#0B4F2F]/50 focus:shadow-[0_0_0_4px_rgba(11,79,47,0.08)] placeholder:text-muted-foreground/40";

/* ---------------------------------------------------------------------- */
/*  Page                                                                   */
/* ---------------------------------------------------------------------- */

export default function Login() {
  const { toast } = useToast();
  const navigate = useNavigate();
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
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "light" : "dark");
  };

  const isAuthed = useMemo(() => {
    try { return Boolean(localStorage.getItem(CURRENT_USER_KEY)); } catch { return false; }
  }, []);

  useEffect(() => {
    if (isAuthed) navigate("/", { replace: true });
  }, [isAuthed, navigate]);

  const finishLogin = useCallback(async (user: DjangoUser) => {
    setAttempts(0);
    setPassword("");
    setEmail(user.email);
    // Redirect applicants to their dashboard, others to main app
    if (user.role === "APPLICANT") {
      navigate("/applicant/dashboard", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const validateEmail = (v: string) => {
    if (!v.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address";
    return "";
  };

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

  const currentYear = new Date().getFullYear();
  const stepInfo = stepLabels[step];

  return (
    <div className="relative flex min-h-screen w-full bg-background">
      {/* Fonts. For production, move this into index.html <head> instead. */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter:wght@400;500;600&family=Noto+Sans+Ethiopic:wght@400;500&display=swap');
        @keyframes cane-sway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(1.4deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="cane-sway"] { animation: none !important; }
        }
      `}</style>

      <BrandPanel />

      {/* Mobile brand strip */}
      <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-[#0B4F2F] px-6 py-4 lg:hidden">
        <img src="/msf_logo.jpg" alt="MSF" className="h-8 w-8 rounded-md object-contain ring-1 ring-white/15" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">EAMS</p>
          <p className="text-[13px] text-white/85" style={{ fontFamily: "'Noto Sans Ethiopic', sans-serif" }}>
            መተሐራ ስኳር ፋብሪካ
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 pb-10 pt-24 sm:px-10 lg:px-16 lg:py-12">
        <button
          onClick={toggleTheme}
          className="absolute right-6 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-background/80 text-muted-foreground/70 backdrop-blur-sm transition-colors hover:bg-muted/40 hover:text-foreground"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <div className="w-full max-w-[380px]">
          <div className="mb-9">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0B4F2F] dark:text-[#7BC29A]">
              EAMS
            </p>
            <h1
              className="mt-2 text-[26px] font-medium text-foreground"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {stepInfo.title}
            </h1>
            <p className="mt-1.5 text-[14px] text-muted-foreground/75">{stepInfo.desc}</p>
          </div>

          <div key={animKey} className="animate-fade-in">
            {step === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[13px] font-medium text-foreground/70">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/45" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@metaharasugar.gov.et"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                      autoFocus
                      className={`${inputClass} ${emailError ? "border-destructive/60 focus:border-destructive/60 focus:shadow-[0_0_0_4px_rgba(220,38,38,0.1)]" : ""}`}
                      autoComplete="email"
                      aria-invalid={!!emailError}
                    />
                  </div>
                  {emailError && <p className="pl-1 text-[12px] text-destructive/80">{emailError}</p>}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-[13px] font-medium text-foreground/70">Password</Label>
                    <button
                      type="button"
                      onClick={() => changeStep("forgot-password")}
                      className="text-[12.5px] font-medium text-[#0B4F2F] hover:underline dark:text-[#7BC29A]"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={setPassword}
                    show={showPassword}
                    onToggle={() => setShowPassword(!showPassword)}
                    autoComplete="current-password"
                  />
                </div>

                <SubmitButton loading={loading} label="Sign in" loadingLabel="Signing in..." />

                <FormDivider />

                <Button
                  variant="outline"
                  type="button"
                  onClick={() => navigate("/scan")}
                  className="h-[48px] w-full rounded-xl border-border/60 bg-background text-[14.5px] font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                >
                  <QrCode className="mr-2.5 h-[18px] w-[18px]" />
                  Scan QR code
                </Button>
              </form>
            )}

            {step === "forgot-password" && (
              <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email" className="text-[13px] font-medium text-foreground/70">Email address</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/45" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="name@metaharasugar.gov.et"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                      autoFocus
                      className={inputClass}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <SubmitButton loading={loading} label="Send verification code" loadingLabel="Sending code..." />

                <button
                  type="button"
                  onClick={() => changeStep("login")}
                  className="flex w-full items-center justify-center gap-1.5 pt-1 text-[13px] text-muted-foreground/60 hover:text-foreground"
                >
                  <ArrowLeft className="h-[14px] w-[14px]" />
                  Back to sign in
                </button>
              </form>
            )}

            {step === "verify-otp" && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="otp" className="text-[13px] font-medium text-foreground/70">Verification code</Label>
                  <div className="relative">
                    <Shield className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/45" />
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      autoFocus
                      className="h-[52px] w-full rounded-xl border border-border/60 bg-background pl-[42px] text-center text-[22px] tracking-[0.4em] text-foreground shadow-sm focus:border-[#0B4F2F]/50 focus:shadow-[0_0_0_4px_rgba(11,79,47,0.08)]"
                      autoComplete="one-time-code"
                    />
                  </div>
                </div>

                <SubmitButton loading={loading} label="Verify code" loadingLabel="Verifying..." disabled={otp.length !== 6} />

                <div className="flex flex-col items-center gap-2.5 pt-1">
                  <button type="button" onClick={() => changeStep("forgot-password")} className="text-[13px] text-muted-foreground/60 hover:text-foreground">
                    Change email address
                  </button>
                  <button type="button" onClick={() => changeStep("login")} className="flex items-center gap-1.5 text-[13px] text-muted-foreground/60 hover:text-foreground">
                    <ArrowLeft className="h-[14px] w-[14px]" />
                    Back to sign in
                  </button>
                </div>
              </form>
            )}

            {step === "reset-password" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-[13px] font-medium text-foreground/70">New password</Label>
                  <PasswordInput
                    id="new-password"
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="Enter new password"
                    show={showPassword}
                    onToggle={() => setShowPassword(!showPassword)}
                    autoComplete="new-password"
                  />
                  {newPassword && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <div className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors ${newPassword.length >= 8 ? "bg-[#0B4F2F]/15 text-[#0B4F2F] dark:text-[#7BC29A]" : "bg-muted/40 text-muted-foreground/30"}`}>
                        <Check className="h-2.5 w-2.5" />
                      </div>
                      <span className={`text-[12px] ${newPassword.length >= 8 ? "text-[#0B4F2F] dark:text-[#7BC29A]" : "text-muted-foreground/45"}`}>
                        At least 8 characters
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-[13px] font-medium text-foreground/70">Confirm password</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/45" />
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass + " pr-3"}
                      autoComplete="new-password"
                    />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="pt-0.5 text-[12px] text-destructive/80">Passwords do not match</p>
                  )}
                </div>

                <SubmitButton
                  loading={loading}
                  label="Reset password"
                  loadingLabel="Resetting password..."
                  disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 8}
                />

                <button
                  type="button"
                  onClick={() => changeStep("login")}
                  className="flex w-full items-center justify-center gap-1.5 pt-1 text-[13px] text-muted-foreground/60 hover:text-foreground"
                >
                  <ArrowLeft className="h-[14px] w-[14px]" />
                  Back to sign in
                </button>
              </form>
            )}
          </div>

          <p className="mt-10 text-center text-[12px] text-muted-foreground/40">
            &copy; {currentYear} Metahara Sugar Factory &middot; IT Department
          </p>
        </div>
      </div>
    </div>
  );
}