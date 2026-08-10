import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { listUsers, updateUser, type AppUser } from "@/services/users";
import { djangoRequest } from "@/services/djangoAuth";
import { trackActivity } from "@/services/notifications";
import { cn } from "@/lib/utils";
import {
  AlertCircle, Building2, Camera, Check, Clock,
  KeyRound, Loader2, Lock, Mail, Phone,
  Save, Shield, Trash2, User,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────
function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

const ROLE_BADGE: Record<string, string> = {
  admin:       "border-primary/30 bg-primary/10 text-primary",
  manager:     "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  field_staff: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  auditor:     "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  requester:   "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  applicant:   "border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400",
};

function roleLabel(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const capped = Math.min(score, 4);
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "bg-red-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500"];
  return { score: capped, label: labels[capped], color: colors[capped] };
}

// ── UI sub-components ─────────────────────────────────────────────────────
function Section({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-muted/30 px-6 py-4">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-5 p-6">{children}</div>
    </div>
  );
}

function Field({ label, id, icon, hint, children }: {
  label: string; id?: string; icon: React.ReactNode; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[180px_1fr] sm:items-start sm:gap-4">
      <Label htmlFor={id} className="flex items-center gap-2 pt-2.5 text-sm font-semibold text-foreground">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/50 text-muted-foreground">
          {icon}
        </span>
        {label}
      </Label>
      <div className="space-y-1">
        {children}
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function Profile() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  // ── state ──
  const [user, setUser]             = useState<AppUser | null>(null);
  const [loading, setLoading]       = useState(true);

  // info fields
  const [name, setName]             = useState("");
  const [phone, setPhone]           = useState("");
  const [department, setDept]       = useState("");
  const [emailNotif, setEmailNotif] = useState(true);

  // photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);

  // password
  const [oldPw, setOldPw]       = useState("");
  const [newPw, setNewPw]       = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // loading flags
  const [savingInfo, setSavingInfo]   = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingPw, setSavingPw]       = useState(false);

  // ── load current user ──
  useEffect(() => {
    (async () => {
      try {
        const uid = localStorage.getItem("current_user_id");
        if (!uid) return;
        const all = await listUsers();
        const me = all.find((u) => u.id === uid);
        if (!me) return;
        setUser(me);
        setName(me.name || "");
        setPhone(me.phone || "");
        setDept(me.department || "");
        if (me.avatar_url) setPhotoPreview(me.avatar_url);
        setEmailNotif(localStorage.getItem("profile_email_notif") !== "0");
      } catch {
        toast({ title: "Failed to load profile", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── photo pick ──
  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 5 MB.", variant: "destructive" });
      return;
    }
    setPhotoFile(file);
    setPhotoChanged(true);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoChanged(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── save photo (multipart to /auth/users/{id}/) ──
  const handleSavePhoto = async () => {
    if (!user?.id) return;
    setSavingPhoto(true);
    try {
      const fd = new FormData();
      if (photoFile) {
        fd.append("profile_image", photoFile);
      }
      const res = await djangoRequest<any>(`/auth/users/${user.id}/`, {
        method: "PATCH",
        body: photoFile ? fd : JSON.stringify({ profile_image: null }),
      });
      if (!res.success) throw new Error(res.message || "Failed");
      const updated: AppUser = {
        ...user,
        avatar_url: res.data?.profile_image ?? null,
      };
      setUser(updated);
      setPhotoChanged(false);
      // sync header avatar
      try {
        const raw = localStorage.getItem("auth_user");
        if (raw) localStorage.setItem("auth_user", JSON.stringify({ ...JSON.parse(raw), avatar_url: updated.avatar_url }));
      } catch {}
      toast({ title: "Photo updated" });
    } catch (e: any) {
      toast({ title: "Photo update failed", description: e?.message, variant: "destructive" });
    } finally {
      setSavingPhoto(false);
    }
  };

  // ── save personal info ──
  const handleSaveInfo = async () => {
    if (!user?.id) return;
    if (!name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSavingInfo(true);
    try {
      const updated = await updateUser(user.id, { name, phone, department });
      setUser(updated);
      await trackActivity("user", "update", { entityName: name, entityId: user.id, changes: ["Profile"] });
      try {
        const raw = localStorage.getItem("auth_user");
        if (raw) localStorage.setItem("auth_user", JSON.stringify({ ...JSON.parse(raw), name, email: user.email }));
      } catch {}
      toast({ title: "Profile saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSavingInfo(false);
    }
  };

  // ── change password (dedicated endpoint) ──
  const handleChangePw = async () => {
    if (!oldPw)  { toast({ title: "Current password required", variant: "destructive" }); return; }
    if (!newPw)  { toast({ title: "New password required", variant: "destructive" }); return; }
    if (newPw !== confirmPw) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    const { score } = passwordStrength(newPw);
    if (score < 2) { toast({ title: "Password too weak", description: "Use at least 8 characters with uppercase and numbers.", variant: "destructive" }); return; }
    setSavingPw(true);
    try {
      const res = await djangoRequest<any>("/auth/change-password/", {
        method: "POST",
        body: JSON.stringify({ old_password: oldPw, new_password: newPw, new_password_confirm: confirmPw }),
      });
      if (!res.success) throw new Error(res.message || "Failed");
      setOldPw(""); setNewPw(""); setConfirmPw("");
      toast({ title: "Password changed" });
    } catch (e: any) {
      toast({ title: "Password change failed", description: e?.message, variant: "destructive" });
    } finally {
      setSavingPw(false);
    }
  };

  // ── loading skeleton ──
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-background">
        <div className="max-w-sm rounded-2xl border border-border bg-card p-10 text-center shadow-xl">
          <User className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
          <p className="font-semibold text-foreground">User not found</p>
          <p className="mt-1 text-sm text-muted-foreground">Please log out and sign back in.</p>
        </div>
      </div>
    );
  }

  const roleLower = (user.role || "").toLowerCase();
  const initials = (user.name || user.email || "?")
    .split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const pw = passwordStrength(newPw);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Breadcrumbs items={[{ label: "Profile" }]} />
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Manage your personal information, photo, and password</p>
      </div>

      <div className="space-y-6">
        {/* Photo */}
        <Section title="Profile Photo" description="A picture that identifies you in the app.">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-muted">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-muted-foreground">{initials}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()} disabled={savingPhoto}>
                <Camera className="h-4 w-4" />
                Change photo
              </Button>
              <Button type="button" size="sm" className="gap-2" onClick={handleSavePhoto} disabled={savingPhoto || !photoChanged}>
                {savingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
              <Button type="button" variant="ghost" size="sm" className="gap-2 text-destructive" onClick={onRemovePhoto} disabled={savingPhoto}>
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>
          </div>
        </Section>

        {/* Personal info */}
        <Section title="Personal Information" description="Your name, contact details and department.">
          <Field label="Full Name" id="name" icon={<User className="h-3.5 w-3.5" />}>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" icon={<Mail className="h-3.5 w-3.5" />}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{user.email || "—"}</span>
              <Badge variant="outline" className={cn("gap-1", ROLE_BADGE[roleLower])}>
                <Shield className="h-3 w-3" />
                {roleLabel(user.role || "")}
              </Badge>
            </div>
          </Field>
          <Field label="Phone" id="phone" icon={<Phone className="h-3.5 w-3.5" />}>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251 ..." />
          </Field>
          <Field label="Department" id="department" icon={<Building2 className="h-3.5 w-3.5" />}>
            <Input id="department" value={department} onChange={(e) => setDept(e.target.value)} placeholder="e.g. Factory Operations" />
          </Field>
          <Field label="Last Login" icon={<Clock className="h-3.5 w-3.5" />}>
            <span className="text-sm text-muted-foreground">{fmt(user.last_login)}</span>
          </Field>
          <Field label="Email Notifications" icon={<Mail className="h-3.5 w-3.5" />}>
            <button
              type="button"
              onClick={() => {
                const next = !emailNotif;
                setEmailNotif(next);
                try { localStorage.setItem("profile_email_notif", next ? "1" : "0"); } catch {}
              }}
              className={cn(
                "flex h-6 w-11 items-center rounded-full border px-0.5 transition-colors",
                emailNotif ? "justify-end border-primary bg-primary" : "justify-start border-border bg-muted",
              )}
            >
              <span className="h-4 w-4 rounded-full bg-background shadow" />
            </button>
          </Field>
          <Separator />
          <div className="flex justify-end">
            <Button onClick={handleSaveInfo} disabled={savingInfo} className="gap-2">
              {savingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingInfo ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </Section>

        {/* Password */}
        <Section title="Change Password" description="Keep your account secure with a strong password.">
          <Field label="Current Password" id="oldPw" icon={<KeyRound className="h-3.5 w-3.5" />}>
            <Input id="oldPw" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </Field>
          <Field label="New Password" id="newPw" icon={<Lock className="h-3.5 w-3.5" />}>
            <Input id="newPw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
            <div className="flex items-center gap-2 pt-1">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-all", pw.color)} style={{ width: `${(pw.score / 4) * 100}%` }} />
              </div>
              <span className="w-12 text-right text-[11px] text-muted-foreground">{pw.label}</span>
            </div>
          </Field>
          <Field label="Confirm Password" id="confirmPw" icon={<Check className="h-3.5 w-3.5" />}>
            <Input id="confirmPw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" />
          </Field>
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>You will need your current password to change it. For security, always sign out on shared devices.</span>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button onClick={handleChangePw} disabled={savingPw} className="gap-2">
              {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {savingPw ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
