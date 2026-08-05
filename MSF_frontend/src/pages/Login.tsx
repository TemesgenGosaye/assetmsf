import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode, Eye, EyeOff, Mail, Lock, ArrowLeft,
  Shield, KeyRound, Sun, Moon, ShieldCheck, Fingerprint,
  Gauge, Home, Building2, Users, ArrowRight, Clock3,
  CircleCheck, MailCheck, TriangleAlert, Sparkles, Check, BadgeCheck,
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
  login: { title: "Sign in", desc: "Use your factory account to access the portal." },
  "forgot-password": { title: "Reset your password", desc: "Enter your email and we'll send a verification code." },
  "verify-otp": { title: "Check your email", desc: "Enter the 6-digit code we just sent you." },
  "reset-password": { title: "Choose a new password", desc: "Use at least 8 characters." },
};

const FEATURES = [
  { icon: ShieldCheck, label: "Encrypted, token-secured sessions" },
  { icon: Fingerprint, label: "Role-based access control" },
  { icon: Gauge, label: "Real-time approvals & notifications" },
];

const STATS = [
  { icon: Home, value: "103", label: "Houses managed" },
  { icon: Building2, value: "7", label: "Departments" },
  { icon: Users, value: "23", label: "Active users" },
];

const PARTICLES = [
  { left: "6%", size: 7, delay: "0s", dur: "16s" },
  { left: "14%", size: 4, delay: "3s", dur: "20s" },
  { left: "24%", size: 9, delay: "6s", dur: "18s" },
  { left: "36%", size: 5, delay: "1.5s", dur: "22s" },
  { left: "48%", size: 7, delay: "9s", dur: "19s" },
  { left: "58%", size: 4, delay: "4s", dur: "24s" },
  { left: "70%", size: 8, delay: "7s", dur: "17s" },
  { left: "80%", size: 5, delay: "2s", dur: "21s" },
  { left: "88%", size: 6, delay: "11s", dur: "23s" },
  { left: "94%", size: 4, delay: "5s", dur: "20s" },
];

/* ------------------------------------------------------------------ */
/*  Cinematic login — brand panel + glassmorphic access card           */
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
  const [now, setNow] = useState(() => new Date());
  const [capsOn, setCapsOn] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [shaking, setShaking] = useState(false);
  const spotRef = useRef<HTMLDivElement>(null);

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

  const onSpotMove = (e: React.MouseEvent) => {
    const el = spotRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
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
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    if (!password) { toast({ title: "Password is required", variant: "destructive" }); return; }
    setLoading(true);
    if (attempts >= 5) await new Promise((r) => setTimeout(r, 1500));
    try {
      try { localStorage.setItem("django_remember", rememberMe ? "true" : "false"); } catch {}
      const user = await loginWithDjango(email.trim(), password);
      if (!user) {
        setAttempts((a) => a + 1);
        triggerShake();
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
    <div className="msf-login">
      <style>{`
        .msf-login {
          --msf-ink: #231f1a;
          --msf-mut: #6b6259;
          --msf-line: rgba(23, 17, 12, 0.10);
          --msf-glass: rgba(255, 255, 255, 0.72);
          --msf-glow: rgba(204, 124, 94, 0.35);
          --msf-copper: #cc7c5e;
          --msf-copper-deep: #b45f41;
          --msf-amber: #e7b98a;
          position: relative;
          min-height: 100dvh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 28px 20px;
          color: var(--msf-ink);
        }
        html.dark .msf-login {
          --msf-ink: #f4efe9;
          --msf-mut: #b3a79b;
          --msf-line: rgba(255, 255, 255, 0.12);
          --msf-glass: rgba(28, 25, 22, 0.66);
          --msf-glow: rgba(204, 124, 94, 0.28);
        }

        /* ── Cinematic backdrop ── */
        .msf-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          background:
            radial-gradient(1200px 800px at 12% 8%, var(--msf-glow), transparent 60%),
            radial-gradient(1000px 700px at 88% 92%, rgba(231, 185, 138, 0.35), transparent 55%),
            linear-gradient(160deg, #f7f1e9 0%, #f1e3d4 45%, #e8d6c2 100%);
        }
        html.dark .msf-bg {
          background:
            radial-gradient(1200px 800px at 12% 8%, rgba(204, 124, 94, 0.22), transparent 60%),
            radial-gradient(1000px 700px at 88% 92%, rgba(231, 185, 138, 0.12), transparent 55%),
            linear-gradient(160deg, #161513 0%, #201d1a 45%, #2a241f 100%);
        }

        .msf-aurora {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.5;
          mix-blend-mode: screen;
          pointer-events: none;
        }
        html:not(.dark) .msf-aurora { mix-blend-mode: multiply; opacity: 0.4; }
        .msf-aurora-a { width: 520px; height: 520px; left: -140px; top: -140px; background: #f2c9a8; animation: msf-drift 22s ease-in-out infinite; }
        .msf-aurora-b { width: 480px; height: 480px; right: -120px; bottom: -100px; background: #e0b18a; animation: msf-drift2 26s ease-in-out infinite; }
        .msf-aurora-c { width: 380px; height: 380px; left: 38%; top: 55%; background: #f6ddc4; animation: msf-drift3 30s ease-in-out infinite; }
        @keyframes msf-drift { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(60px,40px) scale(1.12); } }
        @keyframes msf-drift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-70px,-50px) scale(1.1); } }
        @keyframes msf-drift3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-60px) scale(1.18); } }

        .msf-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(120, 90, 60, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120, 90, 60, 0.06) 1px, transparent 1px);
          background-size: 56px 56px;
          -webkit-mask-image: radial-gradient(ellipse 90% 70% at 50% 40%, #000 30%, transparent 75%);
          mask-image: radial-gradient(ellipse 90% 70% at 50% 40%, #000 30%, transparent 75%);
        }
        html.dark .msf-grid {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
        }

        .msf-noise {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.45;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
        }

        .msf-p {
          position: absolute;
          bottom: -24px;
          border-radius: 9999px;
          background: radial-gradient(circle at 30% 30%, #fff, rgba(204, 124, 94, 0.9));
          box-shadow: 0 0 12px var(--msf-glow);
          opacity: 0;
          animation: msf-rise linear infinite;
          pointer-events: none;
        }
        @keyframes msf-rise {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          12% { opacity: 0.9; }
          100% { transform: translateY(-108vh) rotate(240deg); opacity: 0; }
        }

        /* ── Layout shell ── */
        .msf-shell {
          position: relative;
          z-index: 10;
          display: grid;
          width: 100%;
          max-width: 1200px;
          align-items: center;
          gap: 56px;
        }
        @media (min-width: 1024px) {
          .msf-shell { grid-template-columns: 1.05fr 1fr; }
        }

        /* ── Brand panel ── */
        .msf-brand {
          display: none;
          flex-direction: column;
          gap: 34px;
          padding: 42px 38px;
          border-radius: 32px;
          color: #f6eee6;
          background:
            radial-gradient(120% 120% at 0% 0%, rgba(204, 124, 94, 0.28), transparent 55%),
            radial-gradient(120% 120% at 100% 100%, rgba(231, 185, 138, 0.16), transparent 55%),
            linear-gradient(160deg, #2c241d, #1c1712);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.7);
          animation: msf-enter .8s cubic-bezier(.16,1,.3,1) both;
        }
        @media (min-width: 1024px) { .msf-brand { display: flex; } }
        .msf-brand .chip {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(8px);
        }
        .msf-brand .chip-ic {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: rgba(204, 124, 94, 0.28);
          color: #f0b49a;
          flex-shrink: 0;
        }
        .msf-brand .stat {
          padding: 14px 12px;
          text-align: center;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(8px);
        }

        /* ── Right column ── */
        .msf-right {
          display: flex;
          flex-direction: column;
          gap: 18px;
          width: 100%;
        }
        .msf-eyebrow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--msf-mut);
          font-family: 'IBM Plex Mono', monospace;
        }
        .msf-theme {
          width: 44px;
          height: 44px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          border: 1px solid var(--msf-line);
          background: var(--msf-glass);
          color: var(--msf-ink);
          backdrop-filter: blur(10px);
          cursor: pointer;
          transition: transform .25s, border-color .25s, box-shadow .25s;
        }
        .msf-theme:hover { transform: translateY(-2px); border-color: var(--msf-copper); box-shadow: 0 10px 24px -12px var(--msf-glow); }

        /* ── Card ── */
        .msf-card {
          position: relative;
          width: 100%;
          max-width: 460px;
          margin-left: auto;
          margin-right: auto;
          border-radius: 28px;
          background: var(--msf-glass);
          border: 1px solid var(--msf-line);
          backdrop-filter: blur(24px) saturate(1.4);
          -webkit-backdrop-filter: blur(24px) saturate(1.4);
          box-shadow: 0 30px 80px -30px rgba(60, 35, 20, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.5);
          overflow: hidden;
          animation: msf-enter .7s cubic-bezier(.16,1,.3,1) both;
        }
        html.dark .msf-card {
          box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
        .msf-card::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(90deg, transparent, var(--msf-copper) 30%, var(--msf-amber) 70%, transparent);
          opacity: 0.95;
          z-index: 2;
        }
        .msf-card-head {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .msf-eyebrow-sm {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--msf-copper-deep);
          font-family: 'IBM Plex Mono', monospace;
        }
        html.dark .msf-eyebrow-sm { color: #e08a67; }
        .msf-card-foot {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          border-top: 1px solid var(--msf-line);
          font-size: 12px;
          color: var(--msf-mut);
        }

        /* ── Fields ── */
        .msf-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--msf-mut);
        }
        .msf-input {
          height: 48px;
          width: 100%;
          border-radius: 14px;
          border: 1px solid var(--msf-line);
          background: rgba(255, 255, 255, 0.65);
          padding: 0 46px 0 44px;
          font-size: 14.5px;
          color: var(--msf-ink);
          outline: none;
          transition: border-color .25s, box-shadow .25s, background .25s;
        }
        html.dark .msf-input { background: rgba(255, 255, 255, 0.05); }
        .msf-input::placeholder { color: var(--msf-mut); opacity: 0.75; }
        .msf-input:focus {
          border-color: var(--msf-copper);
          box-shadow: 0 0 0 4px rgba(204, 124, 94, 0.18);
        }
        .msf-input.has-error { border-color: rgba(220, 38, 38, 0.6); }
        .msf-input.has-error:focus { border-color: rgba(220, 38, 38, 0.7); box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.14); }
        .msf-input.otp {
          text-align: center;
          font-size: 22px;
          letter-spacing: 0.4em;
          padding: 0 12px;
        }
        .msf-eye {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: var(--msf-mut);
          cursor: pointer;
          transition: background .2s, color .2s;
        }
        .msf-eye:hover { background: rgba(204, 124, 94, 0.12); color: var(--msf-copper); }

        .msf-link {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--msf-copper-deep);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          transition: opacity .2s;
        }
        html.dark .msf-link { color: #e08a67; }
        .msf-link:hover { opacity: 0.75; text-decoration: underline; }
        .msf-back {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          margin-top: 8px;
          padding: 6px;
          font-size: 13px;
          color: var(--msf-mut);
          background: none;
          border: none;
          cursor: pointer;
          transition: color .2s;
        }
        .msf-back:hover { color: var(--msf-copper); }

        /* ── Buttons ── */
        .msf-cta {
          position: relative;
          height: 50px;
          width: 100%;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          font-size: 14.5px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, var(--msf-copper) 0%, var(--msf-copper-deep) 100%);
          box-shadow: 0 14px 30px -12px rgba(180, 95, 65, 0.55);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform .2s, box-shadow .3s;
        }
        .msf-cta:hover { transform: translateY(-2px); box-shadow: 0 20px 40px -14px rgba(180, 95, 65, 0.6); }
        .msf-cta:active { transform: translateY(0) scale(0.99); }
        .msf-cta:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .msf-cta::after {
          content: "";
          position: absolute;
          top: 0; left: -120%;
          width: 55%;
          height: 100%;
          background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.35), transparent);
          transform: skewX(-20deg);
          transition: left .7s ease;
          pointer-events: none;
        }
        .msf-cta:hover::after { left: 150%; }
        .msf-ghost {
          height: 50px;
          width: 100%;
          border-radius: 14px;
          border: 1px solid var(--msf-line);
          background: transparent;
          color: var(--msf-ink);
          font-size: 14.5px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background .2s, border-color .2s, transform .2s;
        }
        .msf-ghost:hover { background: rgba(204, 124, 94, 0.08); border-color: var(--msf-copper); transform: translateY(-1px); }

        /* ── Micro-interactions ── */
        @keyframes msf-enter {
          from { opacity: 0; transform: translateY(22px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes msf-step {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .msf-step { animation: msf-step .45s cubic-bezier(.16,1,.3,1) both; }

        /* Cursor spotlight on the card */
        .msf-spot {
          position: absolute;
          inset: 0;
          border-radius: 28px;
          pointer-events: none;
          z-index: 1;
          background: radial-gradient(280px circle at var(--mx, 50%) var(--my, 30%), rgba(204, 124, 94, 0.16), transparent 65%);
          opacity: 0;
          transition: opacity .4s;
        }
        .msf-card:hover .msf-spot { opacity: 1; }
        .msf-card-body { position: relative; z-index: 2; }

        /* Shake on failed sign-in */
        @keyframes msf-shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(3px); }
          30%, 50%, 70% { transform: translateX(-5px); }
          40%, 60% { transform: translateX(5px); }
        }
        .msf-shake { animation: msf-shake .55s cubic-bezier(.36,.07,.19,.97) both; }

        /* Remember-me checkbox */
        .msf-remember { display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
        .msf-check {
          position: relative;
          width: 20px; height: 20px;
          border-radius: 7px;
          border: 1px solid var(--msf-line);
          background: rgba(255, 255, 255, 0.6);
          display: grid; place-items: center;
          transition: background .2s, border-color .2s, box-shadow .2s;
          flex-shrink: 0;
        }
        html.dark .msf-check { background: rgba(255, 255, 255, 0.06); }
        .msf-remember input { position: absolute; opacity: 0; pointer-events: none; }
        .msf-remember input:checked + .msf-check {
          background: linear-gradient(135deg, var(--msf-copper), var(--msf-copper-deep));
          border-color: transparent;
          box-shadow: 0 6px 14px -6px rgba(180, 95, 65, 0.6);
        }
        .msf-check svg { opacity: 0; transform: scale(0.6); transition: opacity .2s, transform .2s; color: #fff; }
        .msf-remember input:checked + .msf-check svg { opacity: 1; transform: scale(1); }

        /* Caps-lock hint */
        .msf-caps { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 11.5px; color: #b45309; }

        /* Trust badges */
        .msf-trust { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
        .msf-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid var(--msf-line);
          background: var(--msf-glass);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .06em;
          color: var(--msf-mut);
          backdrop-filter: blur(8px);
        }

        /* Brand panel greeting */
        .msf-greet {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(8px);
        }
        .msf-greet .date { font-size: 12px; opacity: 0.8; }

        /* Staggered reveal */
        .msf-reveal { animation: msf-enter .7s cubic-bezier(.16,1,.3,1) both; }
        .msf-delay-1 { animation-delay: .1s; }
        .msf-delay-2 { animation-delay: .18s; }
        .msf-delay-3 { animation-delay: .26s; }
        .msf-delay-4 { animation-delay: .34s; }

        /* Step pills */
        .msf-steprow { display: flex; align-items: center; }
        .msf-pill {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--msf-mut);
          white-space: nowrap;
        }
        .msf-pill .dot {
          width: 22px; height: 22px;
          border-radius: 999px;
          display: grid; place-items: center;
          border: 1px solid var(--msf-line);
          background: var(--msf-glass);
          transition: all .35s;
          flex-shrink: 0;
        }
        .msf-pill.on { color: var(--msf-copper-deep); }
        html.dark .msf-pill.on { color: #e08a67; }
        .msf-pill.on .dot {
          background: linear-gradient(135deg, var(--msf-copper), var(--msf-copper-deep));
          border-color: transparent;
          color: #fff;
          box-shadow: 0 6px 14px -6px rgba(180, 95, 65, 0.6);
        }
        .msf-pill.done .dot { background: rgba(204, 124, 94, 0.18); border-color: var(--msf-copper); color: var(--msf-copper-deep); }
        html.dark .msf-pill.done .dot { color: #e08a67; }
        .msf-pill .conn { flex: 1; height: 1px; background: var(--msf-line); margin: 0 10px; min-width: 16px; }
        .msf-steprow .conn { flex: 1; height: 1px; background: var(--msf-line); margin: 0 10px; min-width: 16px; }
        .msf-steprow .msf-pill.done + .conn { background: var(--msf-copper); }

        .msf-login :focus-visible {
          outline: 2px solid var(--msf-copper);
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .msf-aurora, .msf-p { animation: none !important; }
          .msf-brand, .msf-card, .msf-step, .msf-shake, .msf-reveal { animation: none !important; }
        }
      `}</style>

      {/* Cinematic backdrop */}
      <div className="msf-bg" aria-hidden="true">
        <div className="msf-aurora msf-aurora-a" />
        <div className="msf-aurora msf-aurora-b" />
        <div className="msf-aurora msf-aurora-c" />
        <div className="msf-grid" />
        <div className="msf-noise" />
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="msf-p"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              animationDuration: p.dur,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      <div className="msf-shell">
        {/* Brand story panel */}
        <aside className="msf-brand">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-[#cc7c5e]/50 blur-xl" />
              <img
                src="/msf_logo.jpg"
                alt="MSF"
                className="relative h-16 w-16 rounded-2xl object-cover shadow-2xl ring-2 ring-white/30"
              />
            </div>
            <div>
              <p className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: "'Petrona', serif" }}>
                Metahara Sugar Factory
              </p>
              <p className="text-[13px] opacity-80" style={{ fontFamily: "'Noto Sans Ethiopic', sans-serif" }}>
                መተሐራ ስኳር ፋብሪካ · MSF IT
              </p>
            </div>
          </div>

          <div className="msf-greet msf-reveal">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#cc7c5e]/25 text-[#f0b49a]">
                <Clock3 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold">{greeting}</p>
                <p className="text-[12px] opacity-80" style={{ fontFamily: "'Noto Sans Ethiopic', sans-serif" }}>{amGreeting}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[20px] font-bold leading-tight" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{clock}</p>
              <p className="date">{today}</p>
            </div>
          </div>

          <div className="msf-reveal msf-delay-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f0b49a]/40 bg-[#cc7c5e]/20 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#f0b49a]">
              <Sparkles className="h-3.5 w-3.5" />
              Housing Engine · Live
            </span>
            <h1
              className="mt-4 text-[40px] xl:text-[52px] font-semibold leading-[1.05] tracking-tight"
              style={{ fontFamily: "'Petrona', serif" }}
            >
              The operating heart of your factory, in one secure portal.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed opacity-80">
              Housing, assets, approvals and reporting — unified in a single,
              audited workspace, built for the way Metahara Sugar Factory works.
            </p>
          </div>

          <div className="space-y-3 msf-reveal msf-delay-2">
            {FEATURES.map((f) => (
              <div key={f.label} className="chip">
                <span className="chip-ic"><f.icon className="h-[18px] w-[18px]" /></span>
                <span className="text-[13.5px] font-medium">{f.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 msf-reveal msf-delay-3">
            {STATS.map((s) => (
              <div key={s.label} className="stat">
                <p className="text-[22px] font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{s.value}</p>
                <p className="mt-1 text-[10.5px] uppercase tracking-wider opacity-75">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="msf-reveal msf-delay-4 text-[13px] opacity-80" style={{ fontFamily: "'Noto Sans Ethiopic', sans-serif" }}>
            ደህንነት በመተማመን የተገነባ — Secure by design, trusted by operations.
          </p>
        </aside>

        {/* Access card */}
        <div className="msf-right">
          <div className="flex items-center justify-between px-1">
            <p className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              <span className="msf-eyebrow">Metahara · Secure Portal</span>
            </p>
            <button type="button" onClick={toggleTheme} className="msf-theme" aria-label="Toggle theme">
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>

          <div
            ref={spotRef}
            onMouseMove={onSpotMove}
            className={"msf-card" + (shaking ? " msf-shake" : "")}
          >
            <div className="msf-spot" aria-hidden="true" />
            <div className="msf-card-body p-7 sm:p-9">
              <div className="msf-card-head">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-[#cc7c5e]/50 blur-lg" />
                  <img
                    src="/msf_logo.jpg"
                    alt="MSF"
                    className="relative h-12 w-12 rounded-full object-cover ring-2 ring-white/30"
                  />
                </div>
                <div>
                  <p className="msf-eyebrow-sm">Welcome back</p>
                  <h2 className="text-[26px] font-semibold tracking-tight" style={{ fontFamily: "'Petrona', serif" }}>
                    {stepInfo.title}
                  </h2>
                </div>
              </div>
              <p className="mt-2 text-[13.5px] text-muted-foreground dark:text-white/55">{stepInfo.desc}</p>

              {step !== "login" && (
                <div className="mt-6">
                  <div className="msf-steprow">
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
                          <span className={`msf-pill ${on ? "on" : ""} ${done ? "done" : ""}`}>
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
                </div>
              )}

              <div key={animKey} className="msf-step mt-7 space-y-4">
                {step === "login" && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="msf-label">Email</Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground dark:text-white/40" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="name@metaharasugar.gov.et"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                          autoFocus
                          autoComplete="email"
                          aria-invalid={!!emailError}
                          className={"msf-input" + (emailError ? " has-error" : "")}
                        />
                      </div>
                      {emailError && <p className="pl-1 text-[12px] text-red-500 dark:text-red-400">{emailError}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="msf-label">Password</Label>
                        <button type="button" onClick={() => changeStep("forgot-password")} className="msf-link">
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground dark:text-white/40" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyUp={onCapsKey}
                          onKeyDown={onCapsKey}
                          autoComplete="current-password"
                          className="msf-input"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="msf-eye"
                          tabIndex={-1}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                        </button>
                      </div>
                      {capsOn && (
                        <p className="msf-caps">
                          <TriangleAlert className="h-3.5 w-3.5" />
                          Caps Lock is on
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="msf-remember">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <span className="msf-check">
                          <Check className="h-3 w-3" />
                        </span>
                        <span className="text-[13px] font-medium">Keep me signed in</span>
                      </label>
                      <span className="text-[11px] opacity-60" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                        {rememberMe ? "trusted device" : "this session"}
                      </span>
                    </div>

                    <button type="submit" disabled={loading} className="msf-cta">
                      {loading ? (
                        <span className="flex items-center justify-center gap-2.5">
                          <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Signing in...
                        </span>
                      ) : (
                        <>
                          Sign in
                          <ArrowRight className="h-[18px] w-[18px]" />
                        </>
                      )}
                    </button>

                    <div className="relative my-2 flex items-center gap-3">
                      <span className="h-px flex-1 bg-[#d7cdc3] dark:bg-white/10" />
                      <span
                        className="text-[10.5px] uppercase tracking-[0.16em] opacity-60"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        or
                      </span>
                      <span className="h-px flex-1 bg-[#d7cdc3] dark:bg-white/10" />
                    </div>

                    <button type="button" onClick={() => navigate("/scan")} className="msf-ghost">
                      <QrCode className="h-[18px] w-[18px]" />
                      Scan QR code
                    </button>
                  </form>
                )}

                {step === "forgot-password" && (
                  <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-email" className="msf-label">Email address</Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground dark:text-white/40" />
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="name@metaharasugar.gov.et"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                          autoFocus
                          autoComplete="email"
                          className="msf-input"
                        />
                      </div>
                    </div>

                    <button type="submit" disabled={loading} className="msf-cta">
                      {loading ? (
                        <span className="flex items-center justify-center gap-2.5">
                          <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Sending code...
                        </span>
                      ) : (
                        <>Send verification code</>
                      )}
                    </button>

                    <button type="button" onClick={() => changeStep("login")} className="msf-back">
                      <ArrowLeft className="h-[14px] w-[14px]" />
                      Back to sign in
                    </button>
                  </form>
                )}

                {step === "verify-otp" && (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="otp" className="msf-label">Verification code</Label>
                      <div className="relative">
                        <Shield className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground dark:text-white/40" />
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
                          className="msf-input otp"
                        />
                      </div>
                    </div>

                    <button type="submit" disabled={loading || otp.length !== 6} className="msf-cta">
                      {loading ? (
                        <span className="flex items-center justify-center gap-2.5">
                          <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Verifying...
                        </span>
                      ) : (
                        <>Verify code</>
                      )}
                    </button>

                    <div className="flex flex-col items-center gap-2 pt-1">
                      <button type="button" onClick={() => changeStep("forgot-password")} className="msf-link">
                        Change email address
                      </button>
                      <button type="button" onClick={() => changeStep("login")} className="msf-back">
                        <ArrowLeft className="h-[14px] w-[14px]" />
                        Back to sign in
                      </button>
                    </div>
                  </form>
                )}

                {step === "reset-password" && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password" className="msf-label">New password</Label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground dark:text-white/40" />
                        <Input
                          id="new-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                          className="msf-input"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="msf-eye"
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
                                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                                  i < passwordStrength(newPassword) ? strengthMeta[passwordStrength(newPassword)].color : "bg-[#d7cdc3] dark:bg-white/10"
                                }`}
                              />
                            ))}
                          </div>
                          <p className={`text-[12px] ${passwordStrength(newPassword) >= 3 ? "text-[#b45f41] dark:text-[#e08a67]" : "text-muted-foreground dark:text-white/40"}`}>
                            {strengthMeta[passwordStrength(newPassword)].label}
                            {passwordStrength(newPassword) >= 3 ? " — ready" : newPassword.length < 8 ? " · at least 8 characters" : ""}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password" className="msf-label">Confirm password</Label>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground dark:text-white/40" />
                        <Input
                          id="confirm-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          className="msf-input"
                        />
                      </div>
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="pt-0.5 text-[12px] text-red-500 dark:text-red-400">Passwords do not match</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 8 || loading}
                      className="msf-cta"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2.5">
                          <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Resetting password...
                        </span>
                      ) : (
                        <>Reset password</>
                      )}
                    </button>

                    <button type="button" onClick={() => changeStep("login")} className="msf-back">
                      <ArrowLeft className="h-[14px] w-[14px]" />
                      Back to sign in
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="msf-card-foot">
              <ShieldCheck className="h-4 w-4" />
              <span>256-bit encrypted session · MSF IT Department</span>
            </div>
          </div>

          <div className="msf-trust px-1">
            <span className="msf-badge"><BadgeCheck className="h-3.5 w-3.5" /> SSL Secured</span>
            <span className="msf-badge"><ShieldCheck className="h-3.5 w-3.5" /> Encrypted transport</span>
            <span className="msf-badge"><CircleCheck className="h-3.5 w-3.5" /> All systems operational</span>
          </div>

          <p className="px-1 text-center text-[12px] opacity-70" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            © 2026 Metahara Sugar Factory · IT Department
            {" · "}
            <button
              type="button"
              onClick={() => navigate("/help")}
              className="opacity-80 underline-offset-2 transition-opacity hover:opacity-100 hover:underline"
            >
              Need help?
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
