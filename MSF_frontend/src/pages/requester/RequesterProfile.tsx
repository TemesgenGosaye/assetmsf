import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, User, Mail, Shield, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listUsers, updateUser, type AppUser } from "@/services/users";
import { trackActivity } from "@/services/notifications";

export default function RequesterProfile() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const uid = localStorage.getItem("current_user_id");
        if (!uid) return;
        const allUsers = await listUsers();
        const me = allUsers.find((u) => u.id === uid);
        if (me) {
          setCurrentUser(me);
          setName(me.name || "");
          setEmail(me.email || "");
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!currentUser?.id) return;
    setSaving(true);
    try {
      await updateUser(currentUser.id, { name, email });
      await trackActivity("user", "update", {
        entityName: name || currentUser.name,
        entityId: currentUser.id,
        changes: ["Profile"],
      });
      toast({ title: "Profile updated", description: "Your profile has been updated successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const roleBadgeColor: Record<string, string> = {
    admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    manager: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    requester: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pb-10">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <button
        type="button"
        onClick={() => navigate("/requester/dashboard")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your personal information</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            Personal Information
          </CardTitle>
          <CardDescription>Update your name and email address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current info summary */}
          {currentUser && (
            <div className="flex flex-wrap gap-3 border-b border-border/30 pb-4">
              <Badge variant="outline" className={`gap-1.5 ${roleBadgeColor[currentUser.role?.toLowerCase()] || ""}`}>
                <Shield className="h-3 w-3" />
                {currentUser.role}
              </Badge>
              {currentUser.department && (
                <Badge variant="outline" className="gap-1.5">
                  <Building2 className="h-3 w-3" />
                  {currentUser.department}
                </Badge>
              )}
              <Badge variant="outline" className="gap-1.5">
                <Mail className="h-3 w-3" />
                {currentUser.email}
              </Badge>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl border-border/60"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl border-border/60"
            />
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
