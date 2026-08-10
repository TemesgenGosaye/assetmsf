import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode, Eye, EyeOff, Mail, Lock, ArrowLeft,
  Shield, KeyRound, Sun, Moon, ShieldCheck, ArrowRight, Clock3,
  CircleCheck, MailCheck, TriangleAlert, Check, BadgeCheck, Loader2,
} from "lucide-react";

import { loginWithDjango, type DjangoUser } from "@/services/djangoAuth";
import {
  requestPasswordReset,
  verifyPasswordResetCode,
  completePasswordReset,
} from "@/services/passwordReset";

const CURRENT_USER_KEY = "current_user_id";

type Step = "login" | "forgot-password" | "verify-otp" | "reset-password";

const stepLabels: Record<Step, { title: string; desc: string }> = {
  login: { title: "Sign in", desc: "Use your factory account to access the enterprise portal." },
  "forgot-password": { title: "Reset your password", desc: "Enter your email and we'll send a verification code." },
  "verify-otp": { title: "Check your email", desc: "Enter the 6-digit code we just sent you." },
  "reset-password": { title: "Choose a new password", desc: "Use at least 8 characters." },
};

/* ------------------------------------------------------------------ */
/*  Enterprise login — single centered access card                      */
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
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem("theme") === "dark" || (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches); } catch { return false; }
  });
  const [now, setNow] = useState(() => new Date());
  const [capsOn, setCapsOn] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const amGreeting =
    hour < 12 ? "እንደምን አነጋህ" : hour < 17 ? "እንደምን አረድክ" : "እንደምን አመሸህ";
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const clock = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  };

  const onCapsKey = (e: React.KeyboardEvent) => {
    try { setCapsOn(!!e.getModifierState("CapsLock")); } catch {}
  };

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
    try {
      sessionStorage.setItem(
        "sams:welcome",
        JSON.stringify({
          name: user.name || user.email,
          email: user.email,
          role: user.role || "",
        }),
      );
      window.dispatchEvent(new CustomEvent("sams:welcome"));
    } catch {}
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
    { label: "Too weak", color: "bg-red-500" },
    { label: "Weak", color: "bg-amber-500" },
    { label: "Fair", color: "bg-yellow-400" },
    { label: "Good", color: "bg-lime-500" },
    { label: "Strong", color: "bg-[#cc7c5e]" },
  ];

  const changeStep = (s: Step) => {
    setStep(s);
    setAnimKey((k) => k + 1);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setPasswordError("");
    setLoginError("");
    setResetSuccess(false);
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    if (!password) { setPasswordError("Password is required"); return; }
    setLoading(true);
    if (attempts >= 5) await new Promise((r) => setTimeout(r, 1500));
    try {
      try { localStorage.setItem("django_remember", rememberMe ? "true" : "false"); } catch {}
      const user = await loginWithDjango(email.trim(), password);
      if (!user) {
        setAttempts((a) => a + 1);
        setLoginError("Invalid email or password. Please try again.");
        triggerShake();
        toast({ title: "Invalid credentials", description: "Email or password is incorrect.", variant: "destructive" });
        return;
      }
      setLoginSuccess(true);
      await new Promise((r) => setTimeout(r, 600));
      await finishLogin(user);
    } catch {
      setLoginError("Unable to sign in. Please check your connection and try again.");
      toast({ title: "Sign in failed", description: "Unable to sign in. Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setLoginError("");
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
      setResetSuccess(true);
    } catch {
      toast({ title: "Failed to reset password", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const stepInfo = stepLabels[step];

  return (
    <div className="elogin">
      <style>{`
        .elogin {
          --el-display: 'Fraunces', Georgia, 'Times New Roman', serif;
          --el-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          position: relative;
          min-height: 100dvh;
          width: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        /* ── Minimal backdrop ── */
        .elogin-bg { position: absolute; inset: 0; z-index: 0; }
        .elogin-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
        }
        .elogin-glow-a {
          width: 620px; height: 620px;
          left: 50%; top: -280px;
          transform: translateX(-50%);
          background: hsl(16 52% 58% / 0.13);
        }
        .elogin-glow-b {
          width: 560px; height: 560px;
          right: -200px; bottom: -220px;
          background: hsl(16 52% 70% / 0.10);
        }
        html.dark .elogin-glow-a { background: hsl(16 52% 58% / 0.10); }
        html.dark .elogin-glow-b { background: hsl(16 52% 58% / 0.07); }
        .elogin-grid {
          position: absolute; inset: 0;
          pointer-events: none;
          background-image: radial-gradient(hsl(16 52% 58% / 0.08) 1px, transparent 1.5px);
          background-size: 28px 28px;
          -webkit-mask-image: radial-gradient(ellipse 70% 65% at 50% 38%, #000 18%, transparent 78%);
          mask-image: radial-gradient(ellipse 70% 65% at 50% 38%, #000 18%, transparent 78%);
        }

        /* ── Top bar ── */
        .elogin-top {
          position: relative; z-index: 10;
          width: 100%;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 22px clamp(16px, 4vw, 40px);
        }
        .elogin-brand { display: flex; align-items: center; gap: 12px; }
        .elogin-brand-logo {
          width: 42px; height: 42px;
          border-radius: 50%; object-fit: cover;
          box-shadow: 0 10px 22px -8px hsl(16 52% 45% / 0.55);
          border: 1px solid hsl(var(--border));
        }
        .elogin-brand-name { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; }
        .elogin-brand-sub { font-size: 11.5px; color: hsl(var(--muted-foreground)); line-height: 1.3; }
        .elogin-theme {
          width: 42px; height: 42px;
          border-radius: 999px;
          display: grid; place-items: center;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          cursor: pointer;
          transition: transform .2s, border-color .2s, box-shadow .2s, background .2s;
        }
        .elogin-theme:hover {
          transform: translateY(-1px);
          border-color: hsl(var(--primary));
          box-shadow: 0 10px 22px -10px hsl(16 52% 58% / 0.5);
          background: hsl(16 52% 58% / 0.08);
        }

        /* ── Main column ── */
        .elogin-main {
          position: relative; z-index: 10;
          flex: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 12px clamp(16px, 4vw, 40px) 42px;
        }

        /* ── Access card ── */
        .elogin-card {
          position: relative;
          width: 100%; max-width: 448px;
          border-radius: 22px;
          background: hsl(var(--card) / 0.92);
          border: 1px solid hsl(var(--border));
          box-shadow:
            0 1px 2px hsl(0 0% 0% / 0.05),
            0 28px 70px -28px hsl(16 52% 30% / 0.28),
            0 0 0 1px hsl(16 52% 58% / 0.04);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          overflow: hidden;
          animation: elogin-enter .55s cubic-bezier(.16,1,.3,1) both;
        }
        .elogin-card::before {
          content: "";
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, transparent, hsl(16 52% 58%) 30%, hsl(38 92% 62%) 70%, transparent);
          z-index: 2;
        }
        .elogin-card-inner { position: relative; padding: 34px clamp(24px, 5vw, 36px) 22px; }

        /* ── Card header ── */
        .elogin-head { display: flex; flex-direction: column; align-items: center; text-align: center; }
        .elogin-logo { position: relative; width: 58px; height: 58px; }
        .elogin-logo::before {
          content: "";
          position: absolute; inset: -7px;
          border-radius: 50%;
          background: hsl(16 52% 58% / 0.14);
          filter: blur(14px);
        }
        .elogin-logo img {
          position: relative;
          width: 100%; height: 100%;
          border-radius: 50%; object-fit: cover;
          border: 2px solid hsl(var(--card));
          box-shadow: 0 10px 24px -8px hsl(16 52% 45% / 0.6);
        }
        .elogin-eyebrow {
          margin-top: 16px;
          font-size: 10.5px; font-weight: 700;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: hsl(var(--primary));
        }
        .elogin-title {
          margin-top: 8px;
          font-family: var(--el-display);
          font-size: 30px; font-weight: 600;
          letter-spacing: -0.02em; line-height: 1.1;
        }
        .elogin-desc { margin-top: 8px; font-size: 14px; color: hsl(var(--muted-foreground)); line-height: 1.5; }
        .elogin-greet {
          margin-top: 20px;
          display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px;
          padding: 8px 14px;
          border-radius: 999px;
          background: hsl(16 52% 58% / 0.08);
          border: 1px solid hsl(16 52% 58% / 0.18);
          color: hsl(16 52% 40%);
          font-size: 12.5px; font-weight: 600;
        }
        html.dark .elogin-greet {
          color: hsl(16 52% 74%);
          background: hsl(16 52% 58% / 0.12);
          border-color: hsl(16 52% 58% / 0.25);
        }
        .elogin-greet .ampm { color: hsl(var(--muted-foreground)); }

        /* ── Steps / pills ── */
        .elogin-steps { display: flex; align-items: center; margin-top: 24px; padding: 0 2px; }
        .elogin-pill {
          display: flex; align-items: center; gap: 7px;
          font-size: 10.5px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: hsl(var(--muted-foreground));
          white-space: nowrap;
        }
        .elogin-pill .dot {
          width: 24px; height: 24px;
          border-radius: 999px;
          display: grid; place-items: center;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          transition: all .3s;
          flex-shrink: 0;
        }
        .elogin-pill.on { color: hsl(var(--primary)); }
        .elogin-pill.on .dot {
          background: linear-gradient(135deg, hsl(16 52% 58%), hsl(16 52% 50%));
          border-color: transparent;
          color: #fff;
          box-shadow: 0 6px 16px -6px hsl(16 52% 45% / 0.6);
        }
        .elogin-pill.done .dot {
          background: hsl(16 52% 58% / 0.14);
          border-color: hsl(16 52% 58% / 0.5);
          color: hsl(16 52% 45%);
        }
        html.dark .elogin-pill.done .dot { color: hsl(16 52% 74%); }
        .elogin-steps .conn { flex: 1; height: 1px; background: hsl(var(--border)); margin: 0 10px; min-width: 14px; }
        .elogin-steps .done + .conn { background: hsl(16 52% 58% / 0.6); }

        /* ── Inline banners ── */
        .elogin-banner {
          display: flex; align-items: flex-start; gap: 9px;
          padding: 11px 14px;
          border-radius: 12px;
          font-size: 13px; font-weight: 500; line-height: 1.45;
        }
        .elogin-banner svg { flex-shrink: 0; margin-top: 1px; }
        .elogin-banner.error {
          background: hsl(0 72% 51% / 0.08);
          border: 1px solid hsl(0 72% 51% / 0.25);
          color: hsl(0 72% 42%);
        }
        html.dark .elogin-banner.error { color: hsl(0 62.8% 74%); }
        .elogin-banner.success {
          background: hsl(142 76% 36% / 0.08);
          border: 1px solid hsl(142 76% 36% / 0.25);
          color: hsl(142 76% 30%);
        }
        html.dark .elogin-banner.success { color: hsl(142 76% 68%); }

        /* ── Fields ── */
        .elogin-label { font-size: 13px; font-weight: 600; color: hsl(var(--foreground)); }
        .elogin-field { position: relative; }
        .elogin-field-icon {
          position: absolute;
          left: 16px; top: 50%;
          transform: translateY(-50%);
          height: 18px; width: 18px;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
        .elogin-input {
          height: 48px;
          width: 100%;
          border-radius: 999px;
          border: 1px solid hsl(var(--input));
          background: hsl(var(--background));
          padding: 0 48px 0 44px;
          font-size: 14.5px;
          color: hsl(var(--foreground));
          outline: none;
          transition: border-color .2s, box-shadow .2s, background .2s;
        }
        html.dark .elogin-input { background: hsl(var(--secondary) / 0.55); }
        .elogin-input::placeholder { color: hsl(var(--muted-foreground)); opacity: 0.75; }
        .elogin-input:focus {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 4px hsl(16 52% 58% / 0.16);
        }
        .elogin-input.has-error { border-color: hsl(0 72% 51% / 0.65); }
        .elogin-input.has-error:focus { border-color: hsl(0 72% 51% / 0.7); box-shadow: 0 0 0 4px hsl(0 72% 51% / 0.12); }
        .elogin-input.otp {
          text-align: center;
          font-size: 22px;
          letter-spacing: 0.4em;
          padding: 0 16px;
        }
        .elogin-eye {
          position: absolute;
          right: 8px; top: 50%;
          transform: translateY(-50%);
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px;
          border-radius: 999px;
          border: none;
          background: transparent;
          color: hsl(var(--muted-foreground));
          cursor: pointer;
          transition: background .2s, color .2s;
        }
        .elogin-eye:hover { background: hsl(16 52% 58% / 0.12); color: hsl(var(--primary)); }
        .elogin-error {
          display: flex; align-items: center; gap: 6px;
          padding: 2px 6px;
          font-size: 12.5px; font-weight: 500;
          color: hsl(0 72% 45%);
        }
        html.dark .elogin-error { color: hsl(0 62.8% 74%); }
        .elogin-caps {
          display: flex; align-items: center; gap: 6px;
          padding: 2px 6px;
          font-size: 12px;
          color: hsl(38 92% 42%);
        }
        html.dark .elogin-caps { color: hsl(38 92% 60%); }

        .elogin-link {
          font-size: 12.5px; font-weight: 600;
          color: hsl(var(--primary));
          background: none; border: none; cursor: pointer; padding: 0;
          transition: opacity .2s;
        }
        .elogin-link:hover { opacity: 0.75; text-decoration: underline; text-underline-offset: 3px; }
        .elogin-back {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%;
          margin-top: 6px;
          padding: 8px;
          font-size: 13px; font-weight: 600;
          color: hsl(var(--muted-foreground));
          background: none; border: none; cursor: pointer;
          border-radius: 999px;
          transition: color .2s, background .2s;
        }
        .elogin-back:hover { color: hsl(var(--primary)); background: hsl(16 52% 58% / 0.07); }

        /* ── Buttons ── */
        .elogin-btn {
          position: relative;
          height: 50px;
          width: 100%;
          border-radius: 999px;
          border: none;
          cursor: pointer;
          font-size: 15px; font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, hsl(16 52% 58%), hsl(16 52% 50%));
          box-shadow: 0 14px 30px -12px hsl(16 52% 45% / 0.6);
          overflow: hidden;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          transition: transform .2s, box-shadow .3s, filter .2s;
        }
        .elogin-btn:hover { transform: translateY(-1px); box-shadow: 0 18px 38px -14px hsl(16 52% 45% / 0.65); }
        .elogin-btn:active { transform: translateY(0) scale(0.99); }
        .elogin-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; box-shadow: none; }
        .elogin-ghost {
          height: 48px;
          width: 100%;
          border-radius: 999px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          font-size: 14px; font-weight: 600;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: background .2s, border-color .2s, transform .2s;
        }
        .elogin-ghost:hover { background: hsl(16 52% 58% / 0.07); border-color: hsl(16 52% 58% / 0.5); transform: translateY(-1px); }

        .elogin-divider { display: flex; align-items: center; gap: 12px; }
        .elogin-divider::before, .elogin-divider::after { content: ""; flex: 1; height: 1px; background: hsl(var(--border)); }
        .elogin-divider span {
          font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase;
          color: hsl(var(--muted-foreground));
          font-family: var(--el-mono);
        }

        /* ── Remember me ── */
        .elogin-remember { display: flex; align-items: center; gap: 9px; cursor: pointer; user-select: none; }
        .elogin-remember > span { font-size: 13px; font-weight: 500; color: hsl(var(--foreground)); }
        .elogin-check {
          height: 18px; width: 18px;
          border-radius: 6px;
          border-color: hsl(var(--border)) !important;
          box-shadow: none !important;
        }
        .elogin-check[data-state="checked"] {
          background: hsl(var(--primary)) !important;
          border-color: transparent !important;
          box-shadow: 0 6px 14px -6px hsl(16 52% 45% / 0.6) !important;
        }
        .elogin-mono { font-family: var(--el-mono); }
        .elogin-session-hint { font-size: 11px; color: hsl(var(--muted-foreground)); opacity: 0.8; }

        /* ── Card footer ── */
        .elogin-card-foot {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: 22px; padding-top: 16px;
          border-top: 1px solid hsl(var(--border));
          font-size: 12px;
          color: hsl(var(--muted-foreground));
        }

        /* ── Trust / footer ── */
        .elogin-trust { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 24px; }
        .elogin-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card) / 0.6);
          font-size: 11px; font-weight: 600;
          color: hsl(var(--muted-foreground));
        }
        .elogin-foot {
          margin-top: 16px;
          text-align: center;
          font-size: 12px;
          color: hsl(var(--muted-foreground));
        }
        .elogin-foot button {
          color: inherit;
          background: none; border: none; cursor: pointer;
          text-decoration: underline; text-underline-offset: 2px;
          transition: opacity .2s;
        }
        .elogin-foot button:hover { opacity: 0.75; }

        /* ── Micro-interactions ── */
        @keyframes elogin-enter {
          from { opacity: 0; transform: translateY(16px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes elogin-step {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .elogin-step { animation: elogin-step .4s cubic-bezier(.16,1,.3,1) both; }
        @keyframes elogin-shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(3px); }
          30%, 50%, 70% { transform: translateX(-5px); }
          40%, 60% { transform: translateX(5px); }
        }
        .elogin-shake { animation: elogin-shake .55s cubic-bezier(.36,.07,.19,.97) both; }

        .elogin :focus-visible {
          outline: 2px solid hsl(var(--ring));
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .elogin-card, .elogin-step, .elogin-shake { animation: none !important; }
        }
      `}</style>

      {/* Minimal backdrop */}
      <div className="elogin-bg" aria-hidden="true">
        <div className="elogin-glow elogin-glow-a" />
        <div className="elogin-glow elogin-glow-b" />
        <div className="elogin-grid" />
      </div>

      {/* Top bar */}
      <header className="elogin-top">
        <div className="elogin-brand">
          <img src="/msf_logo.jpg" alt="" className="elogin-brand-logo" />
          <div>
            <p className="elogin-brand-name">Metahara Sugar Factory</p>
            <p className="elogin-brand-sub" style={{ fontFamily: "'Noto Sans Ethiopic', sans-serif" }}>
              መተሐራ ስኳር ፋብሪካ · EAMS
            </p>
          </div>
        </div>
        <button type="button" onClick={toggleTheme} className="elogin-theme" aria-label="Toggle theme">
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
      </header>

      {/* Main column */}
      <main className="elogin-main">
        <div className={"elogin-card" + (shaking ? " elogin-shake" : "")}>
          <div className="elogin-card-inner">
            <div className="elogin-head">
              <div className="elogin-logo">
                <img src="/msf_logo.jpg" alt="Metahara Sugar Factory logo" />
              </div>
              <p className="elogin-eyebrow">Metahara · Secure Portal</p>
              <h1 className="elogin-title">{stepInfo.title}</h1>
              <p className="elogin-desc">{stepInfo.desc}</p>
              {step === "login" && (
                <p className="elogin-greet" title={`${amGreeting} · ${today}`}>
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>{greeting} · {today}</span>
                  <span className="elogin-mono ampm">{clock}</span>
                </p>
              )}
            </div>

            {step !== "login" && (
              <div className="elogin-steps">
                {(
                  [
                    { key: "forgot-password" as Step, icon: Mail, label: "Email" },
                    { key: "verify-otp" as Step, icon: MailCheck, label: "Code" },
                    { key: "reset-password" as Step, icon: KeyRound, label: "New password" },
                  ]
                ).map((s, i, arr) => {
                  const order: Record<string, number> = { "forgot-password": 1, "verify-otp": 2, "reset-password": 3 };
                  const on = step === s.key;
                  const done = order[step] > order[s.key];
                  const Icon = s.icon;
                  return (
                    <Fragment key={s.key}>
                      <span className={`elogin-pill ${on ? "on" : ""} ${done ? "done" : ""}`}>
                        <span className="dot">
                          {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                        </span>
                        <span className="hidden sm:inline">{s.label}</span>
                      </span>
                      {i < arr.length - 1 && <span className="conn" />}
                    </Fragment>
                  );
                })}
              </div>
            )}

            <div key={animKey} className="elogin-step mt-6 space-y-5">
              {step === "login" && (
                <form onSubmit={handleLogin} className="space-y-5" noValidate>
                  {loginError && (
                    <div className="elogin-banner error" role="alert">
                      <TriangleAlert className="h-4 w-4" />
                      <span>{loginError}</span>
                    </div>
                  )}
                  {resetSuccess && (
                    <div className="elogin-banner success" role="status">
                      <CircleCheck className="h-4 w-4" />
                      <span>Password reset successful. Sign in with your new password.</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="elogin-label">Email address</Label>
                    <div className="elogin-field">
                      <Mail className="elogin-field-icon" aria-hidden="true" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@metaharasugar.gov.et"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setEmailError(""); setLoginError(""); setResetSuccess(false); }}
                        autoFocus
                        autoComplete="email"
                        aria-invalid={!!emailError}
                        aria-describedby={emailError ? "email-error" : undefined}
                        className={cn("elogin-input", emailError && "has-error")}
                      />
                    </div>
                    {emailError && (
                      <p id="email-error" className="elogin-error" role="alert">
                        <TriangleAlert className="h-3.5 w-3.5" />
                        {emailError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="elogin-label">Password</Label>
                      <button type="button" onClick={() => changeStep("forgot-password")} className="elogin-link">
                        Forgot password?
                      </button>
                    </div>
                    <div className="elogin-field">
                      <Lock className="elogin-field-icon" aria-hidden="true" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setPasswordError(""); setLoginError(""); }}
                        onKeyUp={onCapsKey}
                        onKeyDown={onCapsKey}
                        autoComplete="current-password"
                        aria-invalid={!!passwordError}
                        aria-describedby={passwordError ? "password-error" : undefined}
                        className={cn("elogin-input", passwordError && "has-error")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="elogin-eye"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                    {passwordError && (
                      <p id="password-error" className="elogin-error" role="alert">
                        <TriangleAlert className="h-3.5 w-3.5" />
                        {passwordError}
                      </p>
                    )}
                    {capsOn && (
                      <p className="elogin-caps">
                        <TriangleAlert className="h-3.5 w-3.5" />
                        Caps Lock is on
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="elogin-remember">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(c) => setRememberMe(!!c)}
                        className="elogin-check"
                      />
                      <span>Keep me signed in</span>
                    </label>
                    <span className="elogin-session-hint elogin-mono">
                      {rememberMe ? "trusted device" : "this session"}
                    </span>
                  </div>

                  <button type="submit" disabled={loading} className="elogin-btn">
                    {loading ? (
                      <>
                        <Loader2 className="h-[18px] w-[18px] animate-spin" />
                        {loginSuccess ? "Signed in" : "Signing in..."}
                      </>
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="h-[18px] w-[18px]" />
                      </>
                    )}
                  </button>

                  <div className="elogin-divider">
                    <span>or</span>
                  </div>

                  <button type="button" onClick={() => navigate("/scan")} className="elogin-ghost">
                    <QrCode className="h-[18px] w-[18px]" />
                    Scan QR code
                  </button>
                </form>
              )}

              {step === "forgot-password" && (
                <form onSubmit={handleRequestPasswordReset} className="space-y-5" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-email" className="elogin-label">Email address</Label>
                    <div className="elogin-field">
                      <Mail className="elogin-field-icon" aria-hidden="true" />
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="name@metaharasugar.gov.et"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                        autoFocus
                        autoComplete="email"
                        aria-invalid={!!emailError}
                        aria-describedby={emailError ? "reset-email-error" : undefined}
                        className={cn("elogin-input", emailError && "has-error")}
                      />
                    </div>
                    {emailError && (
                      <p id="reset-email-error" className="elogin-error" role="alert">
                        <TriangleAlert className="h-3.5 w-3.5" />
                        {emailError}
                      </p>
                    )}
                  </div>

                  <button type="submit" disabled={loading} className="elogin-btn">
                    {loading ? (
                      <>
                        <Loader2 className="h-[18px] w-[18px] animate-spin" />
                        Sending code...
                      </>
                    ) : (
                      <>Send verification code</>
                    )}
                  </button>

                  <button type="button" onClick={() => changeStep("login")} className="elogin-back">
                    <ArrowLeft className="h-[14px] w-[14px]" />
                    Back to sign in
                  </button>
                </form>
              )}

              {step === "verify-otp" && (
                <form onSubmit={handleVerifyOtp} className="space-y-5" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="otp" className="elogin-label">Verification code</Label>
                    <div className="elogin-field">
                      <Shield className="elogin-field-icon" aria-hidden="true" />
                      <Input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        placeholder="000000"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6}
                        autoFocus
                        autoComplete="one-time-code"
                        aria-label="6-digit verification code"
                        className="elogin-input otp"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading || otp.length !== 6} className="elogin-btn">
                    {loading ? (
                      <>
                        <Loader2 className="h-[18px] w-[18px] animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>Verify code</>
                    )}
                  </button>

                  <div className="flex flex-col items-center gap-2 pt-1">
                    <button type="button" onClick={() => changeStep("forgot-password")} className="elogin-link">
                      Change email address
                    </button>
                    <button type="button" onClick={() => changeStep("login")} className="elogin-back">
                      <ArrowLeft className="h-[14px] w-[14px]" />
                      Back to sign in
                    </button>
                  </div>
                </form>
              )}

              {step === "reset-password" && (
                <form onSubmit={handleResetPassword} className="space-y-5" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="elogin-label">New password</Label>
                    <div className="elogin-field">
                      <Lock className="elogin-field-icon" aria-hidden="true" />
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        className="elogin-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="elogin-eye"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                    {newPassword && (
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex gap-1.5 px-2">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                                i < passwordStrength(newPassword) ? strengthMeta[passwordStrength(newPassword)].color : "bg-muted"
                              }`}
                            />
                          ))}
                        </div>
                        <p className={`px-2 text-[12px] ${passwordStrength(newPassword) >= 3 ? "text-[#b45f41] dark:text-[#e08a67]" : "text-muted-foreground"}`}>
                          {strengthMeta[passwordStrength(newPassword)].label}
                          {passwordStrength(newPassword) >= 3 ? " — ready" : newPassword.length < 8 ? " · at least 8 characters" : ""}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="elogin-label">Confirm password</Label>
                    <div className="elogin-field">
                      <KeyRound className="elogin-field-icon" aria-hidden="true" />
                      <Input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        aria-invalid={!!confirmPassword && newPassword !== confirmPassword}
                        aria-describedby={confirmPassword && newPassword !== confirmPassword ? "confirm-password-error" : undefined}
                        className={cn("elogin-input", confirmPassword && newPassword !== confirmPassword && "has-error")}
                      />
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p id="confirm-password-error" className="elogin-error" role="alert">
                        <TriangleAlert className="h-3.5 w-3.5" />
                        Passwords do not match
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 8 || loading}
                    className="elogin-btn"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-[18px] w-[18px] animate-spin" />
                        Resetting password...
                      </>
                    ) : (
                      <>Reset password</>
                    )}
                  </button>

                  <button type="button" onClick={() => changeStep("login")} className="elogin-back">
                    <ArrowLeft className="h-[14px] w-[14px]" />
                    Back to sign in
                  </button>
                </form>
              )}
            </div>

            <div className="elogin-card-foot">
              <ShieldCheck className="h-4 w-4" />
              <span>256-bit encrypted session · MSF IT Department</span>
            </div>
          </div>
        </div>

        <div className="elogin-trust">
          <span className="elogin-badge"><BadgeCheck className="h-3.5 w-3.5" /> SSL Secured</span>
          <span className="elogin-badge"><ShieldCheck className="h-3.5 w-3.5" /> Encrypted transport</span>
          <span className="elogin-badge"><CircleCheck className="h-3.5 w-3.5" /> All systems operational</span>
        </div>

        <p className="elogin-foot elogin-mono">
          © 2026 Metahara Sugar Factory · IT Department
          {" · "}
          <button
            type="button"
            onClick={() => navigate("/help")}
          >
            Need help?
          </button>
        </p>
      </main>
    </div>
  );
}
