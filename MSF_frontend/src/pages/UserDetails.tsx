import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUser, type AppUser, deleteUser } from "@/services/users";
import { adminSetUserPassword } from "@/services/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { User, Mail, Phone, Shield, Building2, Trash2, Key, Hash } from "lucide-react";
import DetailPage from "@/components/detail/DetailPage";

const ROLE_LABELS: Record<string, string> = {
  admin: "System Administrator",
  manager: "Manager",
  field_staff: "Field Staff",
  auditor: "Auditor",
  requester: "Requester",
  applicant: "Applicant",
};

export default function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResetPwOpen, setIsResetPwOpen] = useState(false);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const authRole = (() => { try { const r = localStorage.getItem("auth_user"); return r ? (JSON.parse(r).role ?? "").toLowerCase() : ""; } catch { return ""; } })();
  const isAdmin = authRole === "admin";

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const userData = await getUser(id);
        setUser(userData);
      } catch (error: any) {
        console.error("Error loading user:", error);
        toast.error(error.message || "Failed to load user details");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleDelete = async () => {
    if (!user) return;
    if (window.confirm(`Are you sure you want to delete user "${user.name}"?`)) {
      try {
        await deleteUser(user.id);
        toast.success("User deleted successfully");
        navigate("/users");
      } catch (error: any) {
        toast.error(error.message || "Failed to delete user");
      }
    }
  };

  const handleResetPassword = async () => {
    if (!user) return;
    const newPw = resetNewPassword.trim();
    if (!newPw) {
      toast.error("Password cannot be empty");
      return;
    }
    try {
      await adminSetUserPassword("", "", user.id, newPw);
      toast.success(`Password successfully updated for ${user.name}`);
      setIsResetPwOpen(false);
      setResetNewPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to reset user password");
    }
  };

  if (loading || !user) {
    return (
      <DetailPage
        backTo="/users"
        breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "Users", to: "/users" }, { label: "User Details" }]}
        title="User Profile"
        hero={{ name: "" }}
        sections={[]}
        loading={loading}
        loadingMessage="Loading user details..."
        notFound={!loading && !user}
        notFoundTitle="User Not Found"
      />
    );
  }

  const initials = user.name.slice(0, 2).toUpperCase();
  const mappedRole = ROLE_LABELS[user.role.toLowerCase()] || user.role;

  return (
    <>
      <DetailPage
        backTo="/users"
        breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "Users", to: "/users" }, { label: "User Details" }]}
        title="User Profile"
        hero={{
          initials,
          name: user.name,
          subtitle: user.email,
          badges: (
            <>
              <Badge variant="outline" className={`text-xs font-semibold uppercase ${
                user.role.toLowerCase() === "admin"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : user.role.toLowerCase() === "manager"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/60 bg-muted text-muted-foreground"
              }`}>
                <Shield className="h-3.5 w-3.5 mr-1 inline" /> {user.role}
              </Badge>
              <Badge className={`text-xs font-semibold ${
                user.status.toLowerCase() === "active"
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
              }`}>
                {user.status}
              </Badge>
            </>
          ),
        }}
        sections={[
          {
            title: "Profile details",
            titleIcon: User,
            fields: [
              { icon: Hash, label: "User ID", value: <span className="font-mono text-xs">{user.id}</span> },
              { icon: Mail, label: "Email Address", value: user.email },
              { icon: Phone, label: "Phone Number", value: user.phone },
            ],
          },
          {
            title: "Scope & Position",
            titleIcon: Shield,
            fields: [
              { icon: Shield, label: "Access Role", value: mappedRole },
              { icon: Building2, label: "Department Scope", value: user.department },
            ],
          },
        ]}
        adminActions={
          isAdmin ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsResetPwOpen(true)} className="gap-1">
                <Key className="h-4 w-4" /> Reset Password
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1">
                <Trash2 className="h-4 w-4" /> Delete User
              </Button>
            </>
          ) : undefined
        }
        sidebar={
          <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold">Preferences & Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Notification alerts</span>
                <Badge variant="outline" className="text-xs font-semibold text-emerald-600 bg-emerald-50">Enabled</Badge>
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground text-center">
                Security-audited SAMS corporate profile
              </div>
            </CardContent>
          </Card>
        }
      />

      <Dialog open={isResetPwOpen} onOpenChange={setIsResetPwOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>
              Enter a new secure password for {user.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="••••••••"
              value={resetNewPassword}
              onChange={(e) => setResetNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPwOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword}>Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
